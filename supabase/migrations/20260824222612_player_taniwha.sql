-- ════════════════════════════════════════════════════════════════════════════
-- 20260824222612 — Taniwha progression: state, crowns, and the choice
-- ════════════════════════════════════════════════════════════════════════════
--
-- Requires 20260824220633 (event_placements + player_event_wins).
-- Mirrors lib/taniwha.ts. Design and reasoning: TANIWHA_SYSTEM_PLAN.md.
--
-- THE MODEL, IN FOUR LINES
--   Every 1,000 lifetime points fills one slot; every tenth slot is a crown.
--   body-part budget = floor(p/1000) − floor(p/10000), capped at 99  (11 × 9)
--   crown capacity   = floor(p/10000),                 capped at 11
--   A crown needs its capacity AND its act: one qualified referral for Whānau,
--   9 of the 12 events won for a domain.
--
-- ⚠ POINTS GRANT A BUDGET, NOT AN ADDRESS.
-- The intuitive model — slot 15 is "taniwha two, part five" — is wrong, because
-- a player may SWITCH which taniwha they are building and their parts STAY on
-- the one they were placed on (plan decision 10). Under a fixed map an
-- abandoned taniwha's slots are gone and it could never be resumed. So the
-- distribution of parts across taniwha is stored state, driven by the player's
-- choices, and only the TOTAL is derived from points.
--
-- Consequence for `colour_awards`: it is NOT repurposed. It holds ~19 rows
-- recording colours that were really awarded and really celebrated, on real
-- dates. Rewriting those into taniwha parts would fabricate history, and the
-- numbers do not even line up (Kahurangi was rung 7 at 5,000 points; 5,000
-- points is 5 parts). It stays exactly as it is, as the record of the retired
-- colours era, and the new system gets its own table.

-- ── 1. Which domain an event belongs to, in SQL ─────────────────────────────
--
-- The crown condition is "9 of the 12 events in THIS domain", so the server has
-- to know an event's domain to award a crown without trusting the client.
--
-- It cannot use session_events.domain_number. That column records the numbering
-- OF THE DAY, and the numbering has changed twice: June 2026 renamed and
-- renumbered the domains together (Power was #5, is now #3, and #5 is now
-- Anaerobic Endurance), and August 2026 moved five events between domains.
-- Counting on it would credit a May 2026 Power win to Anaerobic Endurance and
-- release a crown for a domain the player never competed in. See the long note
-- in 20260824220633 part 6.
--
-- So the CURRENT roster is mirrored here, seeded from lib/eventData.ts.
-- __tests__/taniwha.test.ts fails if this table and eventData ever disagree,
-- which is the only thing standing between this and the six-copies-of-the-
-- colour-ladder problem. ANY roster change must update both.

CREATE TABLE IF NOT EXISTS event_domains (
  event_name    TEXT PRIMARY KEY,
  domain_number INT  NOT NULL CHECK (domain_number BETWEEN 1 AND 10),
  slug          TEXT NOT NULL
);

COMMENT ON TABLE event_domains IS
  'Current event-to-domain mapping, mirrored from lib/eventData.ts. NEVER use '
  'session_events.domain_number for this — it records the numbering of the day '
  'and the domains were renumbered in June 2026.';

ALTER TABLE event_domains ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS event_domains_select_all ON event_domains;
CREATE POLICY event_domains_select_all ON event_domains FOR SELECT USING (true);
GRANT SELECT ON event_domains TO anon, authenticated;

DELETE FROM event_domains;
INSERT INTO event_domains (event_name, domain_number, slug) VALUES
  ('1A Press', 1, 'one-arm-press'),
  ('Arthur Lift', 1, 'arthur-lift'),
  ('Clean & Press', 1, 'clean-and-press'),
  ('Deadlift', 1, 'deadlift'),
  ('Pause Back Squat', 1, 'pause-squat'),
  ('Pause Bench', 1, 'pause-bench'),
  ('Pause Chinup', 1, 'pause-chin-up'),
  ('Pause Dips', 1, 'pause-dips'),
  ('Pause Front Squat', 1, 'pause-front-squat'),
  ('Pause Row', 1, 'pause-row'),
  ('Turkish Getup', 1, 'turkish-get-up'),
  ('Zercher Dead', 1, 'zercher-deadlift'),
  ('1 Leg Squat', 2, '1-leg-squat'),
  ('Back Lever', 2, 'back-lever'),
  ('Chin Hang', 2, 'chin-hang'),
  ('Climbing', 2, 'rope-climb'),
  ('Front Lever', 2, 'front-lever'),
  ('Handstand', 2, 'hand-walk'),
  ('Headstand', 2, 'headstand'),
  ('Human Flag', 2, 'flag'),
  ('Iron Cross', 2, 'iron-cross'),
  ('L-Sit Hold', 2, 'l-sit-hold'),
  ('Planche', 2, 'planche'),
  ('Windshield Wipers', 2, 'windshield-wipers'),
  ('1A Snatch', 3, 'one-arm-snatch'),
  ('Arm Wrestling', 3, 'arm-wrestling'),
  ('Australian Football', 3, 'australian-football'),
  ('Clean & Jerk', 3, 'clean-and-jerk'),
  ('High Jump', 3, 'high-jump'),
  ('Javelin', 3, 'javelin-throw'),
  ('Kelly Snatch', 3, 'kelly-snatch'),
  ('Shotput', 3, 'shot-put'),
  ('Snatch', 3, 'snatch'),
  ('Standing Broad Jump', 3, 'standing-broad-jump'),
  ('Tug of War', 3, 'tug-of-war'),
  ('Vertical Jump', 3, 'vertical-jump'),
  ('100m Sprint', 4, '100m-sprint'),
  ('200m Sprint', 4, '200m-sprint'),
  ('American Football', 4, 'american-football'),
  ('Beach Flags', 4, 'beach-flags'),
  ('Capture the Flag', 4, 'capture-the-flag'),
  ('Kabaddi', 4, 'kabaddi'),
  ('Rats & Rabbits', 4, 'rats-and-rabbits'),
  ('Repeat High Jump', 4, 'repeat-high-jump'),
  ('Speed Chess', 4, 'speed-chess'),
  ('T-Race', 4, 't-race'),
  ('Tag', 4, 'tag'),
  ('Touch Rugby', 4, 'touch-rugby'),
  ('Ab Rollout', 5, 'ab-wheel-rollout'),
  ('Chinup Contest', 5, 'chin-up-contest'),
  ('Finger Pushup', 5, 'finger-push-up'),
  ('GHD Situp', 5, 'ghd-situp'),
  ('Hamstring Curl', 5, 'hamstring-curl'),
  ('Leg Ext Hold', 5, 'leg-extension'),
  ('Pushup Contest', 5, 'push-up-contest'),
  ('Sandbag to Shoulder', 5, 'sandbag-to-shoulder'),
  ('Tibialis Curl', 5, 'tibialis-curl'),
  ('Toe Lift', 5, 'toe-lift'),
  ('Toe Squat', 5, 'toe-balance'),
  ('Wall Sit', 5, 'wall-sit'),
  ('Breath Hold', 6, 'breath-hold'),
  ('Bronco', 6, 'bronco'),
  ('Burpee Broad Jump', 6, 'burpee-broad-jump'),
  ('Cycling', 6, 'cycling'),
  ('Duck Walk', 6, 'duck-walk'),
  ('Row Erg', 6, 'row-erg'),
  ('Running', 6, 'running'),
  ('Scooting', 6, 'scooting'),
  ('Ski Erg', 6, 'ski-erg'),
  ('Weighted Carry', 6, 'weighted-carry'),
  ('Wheelbarrow Pull', 6, 'wheelbarrow-pull'),
  ('Wheelbarrow Push', 6, 'wheelbarrow-push'),
  ('Bridge', 7, 'bridge'),
  ('Foot Behind Head Pose', 7, 'foot-behind-head'),
  ('Forward Fold', 7, 'forward-fold'),
  ('Forward Split', 7, 'front-split'),
  ('Full Bound Twist', 7, 'full-bound-twist'),
  ('Middle Split', 7, 'middle-split'),
  ('Needle Pose', 7, 'needle-pose'),
  ('Pancake', 7, 'pancake'),
  ('Rear Hand Clasp', 7, 'rear-hand-clasp'),
  ('Shoulder Dislocate', 7, 'shoulder-dislocate'),
  ('Side Bend', 7, 'side-bend'),
  ('Standing Split', 7, 'standing-split'),
  ('Balance Ball', 8, 'balance-ball'),
  ('Breakdancing', 8, 'breakdancing'),
  ('Fencing', 8, 'fencing'),
  ('Foot Juggling', 8, 'foot-juggling'),
  ('Gymnastics', 8, 'gymnastics'),
  ('Juggling', 8, 'juggling'),
  ('Jump Rope', 8, 'jump-rope'),
  ('SKATE', 8, 'skate'),
  ('Slackline', 8, 'slackline'),
  ('Tae Kwon Do', 8, 'tae-kwon-do'),
  ('Trampolining', 8, 'trampolining'),
  ('Wrestling', 8, 'wrestling'),
  ('Badminton', 9, 'badminton'),
  ('Baseball', 9, 'baseball'),
  ('Basketball', 9, 'basketball'),
  ('Cricket', 9, 'cricket'),
  ('Football', 9, 'football'),
  ('Hockey', 9, 'hockey'),
  ('Lacrosse', 9, 'lacrosse'),
  ('Squash', 9, 'squash'),
  ('Tennis', 9, 'tennis'),
  ('Teqball', 9, 'teqball'),
  ('Ultimate Frisbee', 9, 'ultimate-frisbee'),
  ('Volleyball', 9, 'volleyball'),
  ('Archery', 10, 'archery'),
  ('Bocce', 10, 'bocce'),
  ('Bowling', 10, 'bowling'),
  ('Carrom', 10, 'carrom'),
  ('Darts', 10, 'darts'),
  ('Disc Golf', 10, 'disc-golf'),
  ('Dodgeball', 10, 'dodgeball'),
  ('Golf', 10, 'golf'),
  ('Handball', 10, 'handball'),
  ('Kubb', 10, 'kubb'),
  ('Netball', 10, 'netball'),
  ('Table Tennis', 10, 'table-tennis')
;

-- ── 2. The ladder arithmetic ────────────────────────────────────────────────
-- Mirrors bodyPartBudget() and crownCapacity() in lib/taniwha.ts exactly.

CREATE OR REPLACE FUNCTION public.taniwha_body_budget(p_points INT)
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT LEAST(
    GREATEST(p_points, 0) / 1000 - GREATEST(p_points, 0) / 10000,
    99
  )
$$;

CREATE OR REPLACE FUNCTION public.taniwha_crown_capacity(p_points INT)
RETURNS INT LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT LEAST(GREATEST(p_points, 0) / 10000, 11)
$$;

-- ── 3. Progression state ────────────────────────────────────────────────────
-- One row per taniwha a player has ever started. Whānau is created for
-- everyone; domain rows appear when chosen.

CREATE TABLE IF NOT EXISTS player_taniwha (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id     UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  -- 'whanau' or a domain slug. Matches Taniwha.slug in lib/taniwha.ts.
  taniwha_slug  TEXT NOT NULL,
  -- NULL for whānau. This is the DOMAIN, never a collection position.
  domain_number INT CHECK (domain_number BETWEEN 1 AND 10),
  -- Parts one to nine. The crown is not a body part; it is crowned_at.
  body_parts    INT NOT NULL DEFAULT 0 CHECK (body_parts BETWEEN 0 AND 9),
  is_building   BOOLEAN NOT NULL DEFAULT false,
  crowned_at    TIMESTAMPTZ,
  -- The session the crown landed in, so the timeline can say WHERE. Null for a
  -- crown awarded outside a session (a backfill, or a referral qualifying
  -- between games).
  crowned_session_id UUID REFERENCES sessions(id) ON DELETE SET NULL,
  -- 1..11: which crown this was for the player. Records that crowns are
  -- fungible — a domain can take crown one if its wins land before a referral.
  crown_order   INT CHECK (crown_order BETWEEN 1 AND 11),
  celebrated_at TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (player_id, taniwha_slug),
  -- Whānau has no domain; a domain taniwha must have one.
  CHECK ((taniwha_slug = 'whanau') = (domain_number IS NULL)),
  -- A crown is either fully recorded or absent.
  CHECK ((crowned_at IS NULL) = (crown_order IS NULL))
);

-- A player builds at most one taniwha at a time. Partial unique index rather
-- than a CHECK, because the constraint is across rows.
CREATE UNIQUE INDEX IF NOT EXISTS player_taniwha_one_building
  ON player_taniwha (player_id) WHERE is_building;

-- Crowns are ordered and never share a position.
CREATE UNIQUE INDEX IF NOT EXISTS player_taniwha_crown_order
  ON player_taniwha (player_id, crown_order) WHERE crown_order IS NOT NULL;

-- A domain is only ever collected once.
CREATE UNIQUE INDEX IF NOT EXISTS player_taniwha_domain
  ON player_taniwha (player_id, domain_number) WHERE domain_number IS NOT NULL;

ALTER TABLE player_taniwha ENABLE ROW LEVEL SECURITY;

-- Public read: the leaderboard shows everyone's crowned count, and the plan
-- makes the taniwha a player is building deliberately public (decision 13).
-- Nothing here is personal data.
DROP POLICY IF EXISTS player_taniwha_select_all ON player_taniwha;
CREATE POLICY player_taniwha_select_all ON player_taniwha FOR SELECT USING (true);
GRANT SELECT ON player_taniwha TO anon, authenticated;

-- No player write path at all. Every change goes through the SECURITY DEFINER
-- functions below, for exactly the reason results.event_placement is guarded:
-- a row here is a permanent, never-revoked award.
REVOKE INSERT, UPDATE, DELETE ON player_taniwha FROM anon, authenticated;

-- ── 4. Sync ─────────────────────────────────────────────────────────────────
-- Called at session close and after a choice. Two jobs:
--   a. spend any unspent body-part budget on the taniwha under construction
--   b. crown anything that has earned it, in the order it earned it
--
-- Deliberately NOT a full recompute of body_parts. The DISTRIBUTION is
-- path-dependent (it follows the player's choices and switches over time), so
-- it cannot be re-derived from points alone the way player_totals.earned_points
-- can. What IS invariant is the TOTAL, and this reconciles against it every
-- time, so a drift self-heals rather than compounding.
--
-- Parts and crowns are NEVER removed. A voided session can lower
-- lifetime_points, and the plan is explicit that an award is never revoked
-- (decision 10, inherited from the colours system). The player simply re-earns
-- the points on the way back up.

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
      v_take := LEAST(v_spare, 9 - v_building.body_parts);
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
       AND pt.body_parts = 9
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

-- ── 5. Choosing, and switching ──────────────────────────────────────────────
-- Switching is free right up until the crown slot passes, and parts do NOT
-- transfer: they stay on the taniwha they were placed on and are resumed if
-- that taniwha is chosen again (plan decision 10). So this only ever moves the
-- `is_building` flag; it never moves a part.
--
-- Refused while the player has a live session, so a crown condition cannot
-- change under a kaiwhakawā who is about to announce it (decision 12).

CREATE OR REPLACE FUNCTION public.choose_taniwha(p_domain_number INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player UUID := auth.uid();
  v_slug   TEXT;
BEGIN
  IF v_player IS NULL THEN
    RAISE EXCEPTION 'choose_taniwha: not signed in' USING ERRCODE = '42501';
  END IF;

  IF p_domain_number IS NULL OR p_domain_number < 1 OR p_domain_number > 10 THEN
    RAISE EXCEPTION 'choose_taniwha: domain % is not 1..10', p_domain_number
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM results r JOIN sessions s ON s.id = r.session_id
     WHERE r.player_id = v_player AND s.is_active
  ) THEN
    RAISE EXCEPTION
      'choose_taniwha: not while a session is live — finish the game first'
      USING ERRCODE = '55006';
  END IF;

  IF EXISTS (
    SELECT 1 FROM player_taniwha
     WHERE player_id = v_player AND domain_number = p_domain_number
       AND crowned_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'choose_taniwha: that taniwha is already crowned'
      USING ERRCODE = '23505';
  END IF;

  SELECT slug INTO v_slug FROM (
    VALUES (1,'kaha'), (2,'kaha-tinana'), (3,'hiko'), (4,'tere'), (5,'manawanui'),
           (6,'manawaroa'), (7,'ngawari'), (8,'mataara'), (9,'ruruku'), (10,'tika')
  ) AS m(n, slug) WHERE m.n = p_domain_number;

  UPDATE player_taniwha SET is_building = false, updated_at = NOW()
   WHERE player_id = v_player AND is_building;

  INSERT INTO player_taniwha (player_id, taniwha_slug, domain_number, is_building)
  VALUES (v_player, v_slug, p_domain_number, true)
  ON CONFLICT (player_id, taniwha_slug)
  DO UPDATE SET is_building = true, updated_at = NOW();

  -- Any banked budget lands immediately on the newly chosen taniwha.
  PERFORM public.sync_player_taniwha(v_player);
END;
$$;

REVOKE ALL ON FUNCTION public.choose_taniwha(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_taniwha(INT) TO authenticated;

-- ── 5b. The mid-session claim ───────────────────────────────────────────────
-- Crowns are normally written when a session closes, which is after everyone
-- has gone home. This is what lets the kaiwhakawā mark the moment in the room
-- (plan decision 19: the coach releases it, not the app).
--
-- It re-derives the condition SERVER SIDE so a client can never mint a crown,
-- and it is deliberately CONSERVATIVE in exactly the way the banner is:
--
--   points  lifetime + 10 + (effort_level × 5) — the guaranteed floor, with NO
--           placement ranking at all, so no other player's result can take it
--           back. Same formula as guaranteedSessionPoints() in lib/taniwha.ts.
--   act     BANKED wins only, via player_event_wins, which is written by the
--           close trigger. A win happening right now is NOT counted: another
--           player can still beat that score before the session ends.
--
-- Idempotent: a second call, or the close trigger arriving later, finds the row
-- already crowned and does nothing.

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
     AND pt.body_parts = 9
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

-- ── 6. Fire at session close ────────────────────────────────────────────────
-- A third trigger with the same WHEN clause as auto_award_points, for the same
-- reason as 20260824220633 part 4: award_session_points() has been rewritten by
-- thirteen migrations and is the most incident-prone object in this schema.
--
-- Name matters. Postgres fires AFTER triggers in ALPHABETICAL order, and this
-- one must run LAST: it reads player_totals (written by auto_award_points) and
-- player_event_wins (written by trg_event_placements).
--   auto_award_points  <  trg_event_placements  <  trg_taniwha_sync
-- A voided session stamps points_awarded_at before closing, so the WHEN clause
-- is false and none of the three fire. Correct: a void did not happen.

CREATE OR REPLACE FUNCTION public.trg_sync_taniwha()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT player_id FROM results
     WHERE session_id = NEW.id AND player_id IS NOT NULL
  LOOP
    PERFORM public.sync_player_taniwha(r.player_id, NEW.id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_taniwha_sync ON sessions;
CREATE TRIGGER trg_taniwha_sync
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION public.trg_sync_taniwha();

-- ── 7. Backfill ─────────────────────────────────────────────────────────────
-- Everyone gets Te Taniwha ō te Whānau and whatever parts their lifetime points
-- have already bought. The highest lifetime total in production is about 5,150,
-- which is 5 body parts and no crown capacity at all, so this is a gentle
-- start: a club of part-built gold taniwha and nobody crowned.

DO $$
DECLARE p RECORD; n INT := 0;
BEGIN
  FOR p IN SELECT player_id FROM player_totals LOOP
    PERFORM public.sync_player_taniwha(p.player_id);
    n := n + 1;
  END LOOP;
  RAISE NOTICE 'taniwha progression seeded for % players', n;
END $$;

-- ── Verification ────────────────────────────────────────────────────────────
-- `supabase migration list` is not evidence. Query the objects.
--
-- 1. The roster mirror is complete and matches lib/eventData.ts:
--      select count(*) from event_domains;                       -- expect 120
--      select domain_number, count(*) from event_domains
--       group by 1 order by 1;                                   -- expect 12 each
--
-- 2. Three triggers on sessions, and they will fire in this order:
--      select tgname from pg_trigger
--       where tgrelid = 'sessions'::regclass and not tgisinternal
--       order by tgname;
--      -- auto_award_points, trg_event_placements, trg_taniwha_sync
--
-- 3. The backfill landed and the budget invariant holds for EVERY player.
--    This is the one that matters — it is the whole model in one query, and it
--    must return zero rows:
--      select t.player_id, t.lifetime_points,
--             taniwha_body_budget(t.lifetime_points) as budget,
--             coalesce(sum(pt.body_parts), 0)        as assigned
--        from player_totals t
--        left join player_taniwha pt on pt.player_id = t.player_id
--       group by t.player_id, t.lifetime_points
--      having coalesce(sum(pt.body_parts), 0)
--             > taniwha_body_budget(t.lifetime_points);
--
-- 4. Nobody is building two taniwha, and nobody was crowned by the backfill:
--      select player_id, count(*) from player_taniwha
--       where is_building group by 1 having count(*) > 1;        -- expect none
--      select count(*) from player_taniwha where crowned_at is not null;
--
-- 5. choose_taniwha refuses what it should. As a signed-in player:
--      select choose_taniwha(0);    -- expect 22023
--      select choose_taniwha(11);   -- expect 22023
--      select choose_taniwha(4);    -- expect success, then:
--      select taniwha_slug, body_parts, is_building
--        from player_taniwha where player_id = auth.uid();
--    Banked parts should have moved onto 'tere' in the same call.
--
-- 6. As anon, the table is readable but not writable:
--      select count(*) from player_taniwha;                      -- works
--      insert into player_taniwha (player_id, taniwha_slug) values (…);
--      -- expect 42501
