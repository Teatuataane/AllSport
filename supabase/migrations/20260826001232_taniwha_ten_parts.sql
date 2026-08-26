-- ============================================================================
-- 20260826001232 - Ten body parts per taniwha, and the implement
-- ============================================================================
--
-- Re-cuts a taniwha from nine body parts plus a crown to TEN body parts plus a
-- crown. Mirrors lib/taniwha.ts; two tests read this file and fail if the two
-- drift apart.
--
-- WHAT CHANGED IN THE DESIGN
--   * Neck and head merged into one part. "You have unlocked a neck" was never
--     going to feel like anything, and a merged head reads better in silhouette.
--   * Parirau (wings/fins) added.
--   * Part TEN is now the IMPLEMENT - the tool of that taniwha's discipline,
--     drawn from a real event in the domain. It is the only part that differs
--     between taniwha, and it lives in lib/taniwha.ts, not here: SQL never needs
--     to know WHICH implement a taniwha carries, only how many parts it holds.
--
-- WHY THE ARITHMETIC GETS SIMPLER
-- The budget was floor(p/1000) - floor(p/10000). That subtraction existed only
-- because every tenth slot was consumed by a crown. With ten body parts the
-- crown stops consuming a slot at all: crowns are a separate track, opened by
-- points and filled by an act.
--
--     body-part budget   floor(p/1000),  capped at 110   (11 taniwha x 10)
--     crown capacity     floor(p/10000), capped at 11
--
-- PEAK_POINTS is unchanged at 110,000 and no crown threshold moves.
--
-- NOBODY IS AFFECTED BY THE BACKFILL. The two budgets differ only above 10,000
-- lifetime points, and the highest total in production is about 5,155. Below
-- 10,000, floor(p/1000) - 0 IS floor(p/1000). The re-sync at the end is a
-- no-op today and exists so the invariant holds the moment someone crosses.

-- -- 1. Ten body parts, not nine ---------------------------------------------

ALTER TABLE player_taniwha DROP CONSTRAINT IF EXISTS player_taniwha_body_parts_check;
ALTER TABLE player_taniwha
  ADD CONSTRAINT player_taniwha_body_parts_check CHECK (body_parts BETWEEN 0 AND 10);

-- -- 2. The ladder arithmetic ------------------------------------------------

CREATE OR REPLACE FUNCTION public.taniwha_body_budget(p_points INT)
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT LEAST(GREATEST(p_points, 0) / 1000, 110)
$$;

-- Unchanged, restated so this file is the single place to read the ladder.
CREATE OR REPLACE FUNCTION public.taniwha_crown_capacity(p_points INT)
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT LEAST(GREATEST(p_points, 0) / 10000, 11)
$$;

-- -- 3. A finished body is ten parts -----------------------------------------
-- Both functions carried forward from 20260824222612 with only the 9 -> 10
-- change. Everything else in them is byte-identical.

CREATE OR REPLACE FUNCTION public.sync_player_taniwha(
  p_player_id UUID,
  p_session_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points      INT;
  v_budget      INT;
  v_assigned    INT;
  v_spare       INT;
  v_capacity    INT;
  v_crowns      INT;
  v_referrals   INT;
  v_building    RECORD;
  v_cand        RECORD;
  v_take        INT;
BEGIN
  SELECT COALESCE(lifetime_points, 0) INTO v_points
  FROM player_totals WHERE player_id = p_player_id;
  IF NOT FOUND THEN RETURN; END IF;

  -- Everyone starts with Te Taniwha ō te Whānau, and builds it first unless
  -- they have already moved on.
  INSERT INTO player_taniwha (player_id, taniwha_slug, domain_number, is_building)
  VALUES (p_player_id, 'whanau', NULL,
          NOT EXISTS (SELECT 1 FROM player_taniwha WHERE player_id = p_player_id AND is_building))
  ON CONFLICT (player_id, taniwha_slug) DO NOTHING;

  -- ── a. spend the budget ───────────────────────────────────────────────────
  v_budget := public.taniwha_body_budget(v_points);
  SELECT COALESCE(SUM(body_parts), 0) INTO v_assigned
    FROM player_taniwha WHERE player_id = p_player_id;
  v_spare := v_budget - v_assigned;

  IF v_spare > 0 THEN
    SELECT * INTO v_building
      FROM player_taniwha
     WHERE player_id = p_player_id AND is_building
     LIMIT 1;

    IF FOUND THEN
      v_take := LEAST(v_spare, 10 - v_building.body_parts);
      IF v_take > 0 THEN
        UPDATE player_taniwha
           SET body_parts = body_parts + v_take, updated_at = NOW()
         WHERE id = v_building.id;
      END IF;
    END IF;
    -- Anything still unspent BANKS. It lands the moment the player chooses
    -- their next taniwha, which is the pull back into the app the plan wants
    -- (decision 9). Unspent budget is derived, never stored: it is always
    -- taniwha_body_budget(points) - SUM(body_parts).
  END IF;

  -- ── b. award crowns ───────────────────────────────────────────────────────
  v_capacity := public.taniwha_crown_capacity(v_points);
  SELECT COUNT(*) INTO v_crowns
    FROM player_taniwha WHERE player_id = p_player_id AND crowned_at IS NOT NULL;

  SELECT COUNT(*) INTO v_referrals
    FROM referrals WHERE referrer_id = p_player_id AND qualified_at IS NOT NULL;

  -- Oldest-started first, so the order is stable and reproducible rather than
  -- depending on row order. One crown per pass through the candidates.
  WHILE v_crowns < v_capacity LOOP
    SELECT pt.*
      INTO v_cand
      FROM player_taniwha pt
     WHERE pt.player_id = p_player_id
       AND pt.crowned_at IS NULL
       AND pt.body_parts = 10
       AND (
         -- Whānau: one qualified referral. The only crown a player cannot
         -- earn alone.
         (pt.taniwha_slug = 'whanau' AND v_referrals >= 1)
         OR
         -- A domain: 9 distinct events won, counted through event_domains
         -- (the CURRENT roster), never through session_events.domain_number.
         (pt.domain_number IS NOT NULL AND (
            SELECT COUNT(*)
              FROM player_event_wins w
              JOIN event_domains ed ON ed.event_name = w.event_name
             WHERE w.player_id = p_player_id
               AND ed.domain_number = pt.domain_number
         ) >= 9)
       )
     ORDER BY pt.created_at, pt.id
     LIMIT 1;

    EXIT WHEN NOT FOUND;

    v_crowns := v_crowns + 1;
    UPDATE player_taniwha
       SET crowned_at = NOW(), crown_order = v_crowns,
           crowned_session_id = p_session_id, updated_at = NOW()
     WHERE id = v_cand.id;

    -- A crowned taniwha is finished, so it stops being the one under
    -- construction and the player is prompted to choose their next.
    UPDATE player_taniwha
       SET is_building = false, updated_at = NOW()
     WHERE id = v_cand.id AND is_building;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_player_taniwha(UUID, UUID) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.claim_taniwha_crown(
  p_player_id  UUID,
  p_session_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points   INT;
  v_effort   INT;
  v_crowns   INT;
  v_cand     RECORD;
  v_ok       BOOLEAN := false;
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'claim_taniwha_crown: kaiwhakawā only' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(lifetime_points, 0) INTO v_points
    FROM player_totals WHERE player_id = p_player_id;
  IF NOT FOUND THEN RETURN false; END IF;

  -- Effort level for this session, capped at 20, mirroring the award trigger.
  SELECT LEAST(COALESCE(SUM(COALESCE(effort_task_completions, 0)), 0), 20)
    INTO v_effort
    FROM results
   WHERE player_id = p_player_id AND session_id = p_session_id;

  SELECT COUNT(*) INTO v_crowns
    FROM player_taniwha WHERE player_id = p_player_id AND crowned_at IS NOT NULL;

  -- The guaranteed floor must already clear the next crown's threshold.
  IF v_points + 10 + (COALESCE(v_effort, 0) * 5) < (v_crowns + 1) * 10000 THEN
    RETURN false;
  END IF;

  SELECT pt.* INTO v_cand
    FROM player_taniwha pt
   WHERE pt.player_id = p_player_id
     AND pt.is_building
     AND pt.crowned_at IS NULL
     AND pt.body_parts = 10
     AND (
       (pt.taniwha_slug = 'whanau' AND EXISTS (
          SELECT 1 FROM referrals
           WHERE referrer_id = p_player_id AND qualified_at IS NOT NULL))
       OR
       (pt.domain_number IS NOT NULL AND (
          SELECT COUNT(*)
            FROM player_event_wins w
            JOIN event_domains ed ON ed.event_name = w.event_name
           WHERE w.player_id = p_player_id
             AND ed.domain_number = pt.domain_number
       ) >= 9)
     )
   LIMIT 1;

  IF NOT FOUND THEN RETURN false; END IF;

  UPDATE player_taniwha
     SET crowned_at = NOW(),
         crown_order = v_crowns + 1,
         crowned_session_id = p_session_id,
         celebrated_at = NOW(),
         is_building = false,
         updated_at = NOW()
   WHERE id = v_cand.id AND crowned_at IS NULL;

  GET DIAGNOSTICS v_ok = ROW_COUNT;
  RETURN v_ok;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_taniwha_crown(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.claim_taniwha_crown(UUID, UUID) TO authenticated;

-- -- 4. Re-sync ---------------------------------------------------------------
-- A no-op at today's point levels (see the header), but it keeps the invariant
-- true rather than merely true-so-far.

DO $$
DECLARE p RECORD; n INT := 0;
BEGIN
  FOR p IN SELECT player_id FROM player_totals LOOP
    PERFORM public.sync_player_taniwha(p.player_id);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'taniwha re-synced for % players on the ten-part ladder', n;
END $$;

-- -- Verification --------------------------------------------------------------
-- The budget invariant, which must return ZERO rows:
--   select t.player_id, t.lifetime_points,
--          taniwha_body_budget(t.lifetime_points) as budget,
--          coalesce(sum(pt.body_parts), 0)        as assigned
--     from player_totals t
--     left join player_taniwha pt on pt.player_id = t.player_id
--    group by t.player_id, t.lifetime_points
--   having coalesce(sum(pt.body_parts), 0) > taniwha_body_budget(t.lifetime_points);
--
-- And the new ceiling:
--   select taniwha_body_budget(110000);    -- expect 110
--   select taniwha_body_budget(999999);    -- expect 110
--   select taniwha_crown_capacity(110000); -- expect 11
