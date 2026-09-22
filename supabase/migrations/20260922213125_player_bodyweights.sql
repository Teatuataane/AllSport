-- Bodyweight of the day.
--
-- Strength standards are a ratio of bodyweight. Until now that bodyweight was a
-- 10kg band picked on /profile, and ONE player in 27 ever set one — the
-- kaiwhakawa. The band is replaced by a declaration made on the day, at the top
-- of the scoring screen, where the question is actually relevant.
--
-- Two problems this closes, both measured against production on 2026-09-23:
--
--   1. Skipping the field was the winning move. domainGrade() drops ungradeable
--      events from the denominator, and 12 of Maximal Strength's 14 events are
--      ratio standards, so an undeclared player had the domain judged on 2
--      events needing 1 while a declared player needed 6 of 14. The engine
--      change that fixes it lives in lib/playerGrades.ts; this migration is the
--      half that gives it a number to work with.
--   2. The band midpoint over-graded the heavy half of every band by about a
--      rung on the main lifts (150kg deadlift at 79.9kg bodyweight: Koura
--      earned, Uenuku awarded).
--
-- WHAT THIS MIGRATION DOES NOT DO: it does not drop players.bodyweight_band,
-- players.bodyweight_band_first, results.bodyweight_band or
-- workout_entries.bodyweight_band. A missing COLUMN returns 42703 and takes the
-- whole PostgREST request down, and four app surfaces plus lib/loadGrades.ts
-- still select them. The drops are a SEPARATE later migration, once no deployed
-- bundle reads them. That is also why public.delete_my_account is untouched
-- here: it sets both band columns to NULL and would raise at runtime the moment
-- they went away, failing every self-service erasure.
--
-- DEPLOY CODE FIRST, THEN THIS. lib/loadGrades.ts reads player_bodyweights in
-- its own guarded query and treats PGRST205/42P01 as "not live yet", so the old
-- bundle against the new table is fine and the new bundle against the old
-- database is fine. Either order is safe; code-first keeps the window shortest.

BEGIN;

-- ── 1. The table ────────────────────────────────────────────────────────────
-- One row per player per day. A score grades against the most recent
-- declaration at or before its own day, which is sessions.session_date for a
-- result (trigger-derived at Pacific/Auckland by 20260902020602) and
-- workouts.performed_on for a logged entry.
--
-- Exact kilograms, not a band: the midpoint approximation is what handed out
-- the free rung. Bounded 20-400 to catch a typo, not to judge anybody.
CREATE TABLE IF NOT EXISTS public.player_bodyweights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  measured_on  date NOT NULL,
  kg           numeric NOT NULL CHECK (kg >= 20 AND kg <= 400),
  recorded_by  uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, measured_on)
);

CREATE INDEX IF NOT EXISTS player_bodyweights_player_day_idx
  ON public.player_bodyweights (player_id, measured_on DESC);

COMMENT ON TABLE public.player_bodyweights IS
  'A player''s declared bodyweight on a given NZ day. A score grades against '
  'the most recent declaration at or before its own day. Append-only for '
  'players: measured_on is pinned server-side and corrections go through '
  'public.record_bodyweight().';
COMMENT ON COLUMN public.player_bodyweights.recorded_by IS
  'Who entered it. Null for the player themselves; a kaiwhakawa id when they '
  'recorded a weigh-in on someone''s behalf.';

-- ── 2. measured_on is pinned to the NZ day, server-side ─────────────────────
-- Per-row stamping existed so nobody could re-declare a past weight and
-- re-price colours they already hold. A date-keyed table hands that back unless
-- the date is not the client's to choose. Named zone, never a fixed +12: NZDT
-- is +13 from late September (20260902020602 learned this the hard way).
--
-- SECURITY INVOKER and the current_user test, NOT auth.uid(): a SECURITY
-- DEFINER function runs with auth.uid() still set to the calling player, so an
-- auth.uid() guard would also pin the kaiwhakawa's correction to today and
-- defeat the very path section 4 exists to provide. Same reasoning, and the
-- same trap, as 20260921182106 and pin_bodyweight_band_first.
CREATE OR REPLACE FUNCTION public.pin_bodyweight_measured_on()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;                           -- trusted server code only
  END IF;
  NEW.measured_on := (now() AT TIME ZONE 'Pacific/Auckland')::date;
  NEW.created_at  := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pin_bodyweight_measured_on ON public.player_bodyweights;
CREATE TRIGGER trg_pin_bodyweight_measured_on
  BEFORE INSERT OR UPDATE ON public.player_bodyweights
  FOR EACH ROW EXECUTE FUNCTION public.pin_bodyweight_measured_on();

-- ── 3. RLS ──────────────────────────────────────────────────────────────────
-- An exact kilogram is strictly more sensitive than a 10kg band, and `players`
-- shipped world-readable for months, so the SELECT policy is stated rather than
-- assumed. Read: own row, your children, kaiwhakawa. Never joined into
-- players_public or any leaderboard payload.
--
-- No INSERT, UPDATE or DELETE policy exists at all, and the table grants are
-- revoked: every write goes through public.record_bodyweight() below. A
-- PostgREST upsert is INSERT ... ON CONFLICT DO UPDATE and needs the UPDATE
-- privilege, which would reopen exactly the hole the pin closes.
ALTER TABLE public.player_bodyweights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_bodyweights_select_own ON public.player_bodyweights;
CREATE POLICY player_bodyweights_select_own ON public.player_bodyweights
  FOR SELECT TO authenticated
  USING (
    player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players p WHERE p.id = player_bodyweights.player_id AND p.parent_id = auth.uid())
    OR public.is_judge()
  );

REVOKE ALL ON TABLE public.player_bodyweights FROM anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.player_bodyweights FROM authenticated;

-- ── 4. The one write path ───────────────────────────────────────────────────
-- Same authority as writing a score: your own, your child's, or a kaiwhakawa
-- for anyone (can_log_for). A second declaration on the same day REPLACES the
-- first, so a typo is fixable on the day without granting UPDATE to anybody.
--
-- p_measured_on is accepted ONLY from a kaiwhakawa, and that is the whole
-- correction path: a player cannot name a day, so they cannot backdate a
-- weight onto history they have already been graded on.
CREATE OR REPLACE FUNCTION public.record_bodyweight(
  p_player_id uuid,
  p_kg numeric,
  p_measured_on date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day date;
  v_id  uuid;
BEGIN
  IF NOT public.can_log_for(p_player_id) THEN
    RAISE EXCEPTION 'record_bodyweight: not your player' USING ERRCODE = '42501';
  END IF;
  IF p_kg IS NULL OR p_kg < 20 OR p_kg > 400 THEN
    RAISE EXCEPTION 'record_bodyweight: % kg is outside 20-400', p_kg USING ERRCODE = '22023';
  END IF;

  v_day := (now() AT TIME ZONE 'Pacific/Auckland')::date;
  IF p_measured_on IS NOT NULL THEN
    IF NOT public.is_judge() THEN
      RAISE EXCEPTION 'record_bodyweight: only a kaiwhakawa may date a weigh-in'
        USING ERRCODE = '42501';
    END IF;
    IF p_measured_on > v_day THEN
      RAISE EXCEPTION 'record_bodyweight: cannot record a weight in the future'
        USING ERRCODE = '22023';
    END IF;
    v_day := p_measured_on;
  END IF;

  INSERT INTO public.player_bodyweights (player_id, measured_on, kg, recorded_by)
  VALUES (p_player_id, v_day, p_kg,
          CASE WHEN p_player_id = auth.uid() THEN NULL ELSE auth.uid() END)
  ON CONFLICT (player_id, measured_on)
    DO UPDATE SET kg = EXCLUDED.kg, recorded_by = EXCLUDED.recorded_by, created_at = now()
  RETURNING id INTO v_id;

  -- Deliberately does NOT touch players. Clearing grades_checked_at here would
  -- have worked, but __tests__/autoConferral.test.ts asserts that
  -- delete_my_account is the ONLY SECURITY DEFINER function that updates
  -- players — the invariant that keeps a definer function from becoming a way
  -- around guard_players_grading_identity, which is SECURITY INVOKER and
  -- exempts server code by current_user. Section 5 makes grades_need_recheck
  -- probe this table instead, which is the same signal without the write.
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.record_bodyweight(uuid, numeric, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_bodyweight(uuid, numeric, date) TO authenticated, service_role;

COMMENT ON FUNCTION public.record_bodyweight(uuid, numeric, date) IS
  'The only way a bodyweight is written. Own, child, or kaiwhakawa. The day is '
  'today unless a kaiwhakawa names an earlier one, which is the correction path.';

-- ── 5. The cheap recheck probe must see a declaration ───────────────────────
-- grades_need_recheck compares a watermark against results, entries,
-- exemptions, matches and sessions. A new declaration is none of those, so
-- without this a player whose ONLY change is declaring their weight is skipped
-- and their lifts stay ungraded until something else marks them dirty.
-- record_bodyweight() already clears the watermark, and this is the belt to
-- that braces: a declaration written by a migration or the SQL Editor is caught
-- too. Body is otherwise 20260921232728's, unchanged.
CREATE OR REPLACE FUNCTION public.grades_need_recheck(p_player_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  IF NOT public.can_log_for(p_player_id) THEN
    RAISE EXCEPTION 'grades_need_recheck: not your player' USING ERRCODE = '42501';
  END IF;

  SELECT grades_checked_at INTO v_since FROM players WHERE id = p_player_id;
  IF NOT FOUND OR v_since IS NULL THEN
    RETURN true;                      -- never checked
  END IF;

  IF EXISTS (SELECT 1 FROM results WHERE player_id = p_player_id AND created_at > v_since) THEN RETURN true; END IF;
  IF EXISTS (
    SELECT 1 FROM workout_entries e JOIN workouts w ON w.id = e.workout_id
    WHERE w.player_id = p_player_id AND e.created_at > v_since
  ) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM grade_exemptions WHERE player_id = p_player_id AND created_at > v_since) THEN RETURN true; END IF;
  -- New in this migration.
  IF EXISTS (SELECT 1 FROM player_bodyweights WHERE player_id = p_player_id AND created_at > v_since) THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM matches WHERE created_at > v_since OR confirmed_at > v_since
  ) THEN RETURN true; END IF;
  IF EXISTS (
    SELECT 1 FROM results r JOIN sessions s ON s.id = r.session_id
    WHERE r.player_id = p_player_id
      AND (s.ended_at > v_since OR s.voided_at > v_since OR s.points_awarded_at > v_since)
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;
REVOKE ALL ON FUNCTION public.grades_need_recheck(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grades_need_recheck(uuid) TO authenticated, service_role;

-- ── 6. Seed history from the bands that exist ───────────────────────────────
-- Without this every historical lift becomes undeclared the moment the engine
-- stops reading bands, and the pending history replay would confer nothing in
-- Maximal Strength for anybody. The band midpoint is the best value that
-- exists for those rows, and it is exactly what the engine used for them
-- yesterday, so seeding changes no grade.
--
-- Dated to each player's EARLIEST banded row, so one declaration covers their
-- whole banded history through the carry-forward rule. In production on
-- 2026-09-23 this is one player and 402 rows.
--
-- Written as trusted server code: the pin trigger exempts it on current_user,
-- which is what lets it set a past measured_on.
INSERT INTO public.player_bodyweights (player_id, measured_on, kg, recorded_by, created_at)
SELECT
  b.player_id,
  b.first_day,
  CASE b.band
    WHEN 'Under 50kg'     THEN 45
    WHEN '50 to 60kg'     THEN 55
    WHEN '60 to 70kg'     THEN 65
    WHEN '70 to 80kg'     THEN 75
    WHEN '80 to 90kg'     THEN 85
    WHEN '90 to 100kg'    THEN 95
    WHEN '100 to 110kg'   THEN 105
    WHEN '110kg and over' THEN 115
  END,
  NULL,
  now()
FROM (
  SELECT
    r.player_id,
    MIN(COALESCE(s.session_date, (r.created_at AT TIME ZONE 'Pacific/Auckland')::date)) AS first_day,
    -- One band per player in practice; MIN makes it deterministic regardless.
    MIN(r.bodyweight_band) AS band
  FROM public.results r
  LEFT JOIN public.sessions s ON s.id = r.session_id
  WHERE r.player_id IS NOT NULL AND r.bodyweight_band IS NOT NULL
  GROUP BY r.player_id
) b
WHERE b.band IS NOT NULL
ON CONFLICT (player_id, measured_on) DO NOTHING;

-- Anyone who holds a profile band but has no banded result row still gets a
-- declaration, dated today, or they would silently lose strength grading.
INSERT INTO public.player_bodyweights (player_id, measured_on, kg, recorded_by, created_at)
SELECT
  p.id,
  (now() AT TIME ZONE 'Pacific/Auckland')::date,
  CASE p.bodyweight_band
    WHEN 'Under 50kg'     THEN 45
    WHEN '50 to 60kg'     THEN 55
    WHEN '60 to 70kg'     THEN 65
    WHEN '70 to 80kg'     THEN 75
    WHEN '80 to 90kg'     THEN 85
    WHEN '90 to 100kg'    THEN 95
    WHEN '100 to 110kg'   THEN 105
    WHEN '110kg and over' THEN 115
  END,
  NULL,
  now()
FROM public.players p
WHERE p.bodyweight_band IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM public.player_bodyweights b WHERE b.player_id = p.id)
ON CONFLICT (player_id, measured_on) DO NOTHING;

-- Every player who held a band must now hold at least one declaration, or the
-- seed silently under-covered and somebody loses strength grading they had.
DO $$
DECLARE
  v_missing int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.players p
  WHERE p.bodyweight_band IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.player_bodyweights b WHERE b.player_id = p.id);
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'bodyweight seed: % players hold a band but no declaration', v_missing;
  END IF;
END $$;

-- ── 6b. Erasure takes the declarations with it ──────────────────────────────
-- Redefined WHOLE from its definition in 20260921232726 with ONE line added,
-- which is how this repo changes a function nobody can afford to get wrong. The
-- band columns are still set to NULL here: they still exist, and this migration
-- deliberately does not drop them.

CREATE OR REPLACE FUNCTION public.delete_my_account(p_player_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID;
  v_names  TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  v_target := COALESCE(p_player_id, auth.uid());

  -- Yourself, or a child profile you are the parent of. Nothing else.
  IF v_target <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM players WHERE id = v_target AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'you can only erase your own account or a child profile you manage'
      USING ERRCODE = '42501';
  END IF;

  -- Health information goes entirely. WHO-5 answers are the most sensitive
  -- thing we hold, they are voluntary, and nothing outside the player's own
  -- dashboard reads a row: the kaiwhakawā report is an aggregate. Rows already
  -- folded into a published quarterly average cannot be traced back.
  DELETE FROM wellbeing_surveys WHERE player_id = v_target;

  -- ADDED 20260915051927: an exemption's reason can be medical, so it goes
  -- with the rest of the health information.
  DELETE FROM grade_exemptions WHERE player_id = v_target;

  -- ADDED 20260915214702: a training log records where and when someone
  -- trained, and unlike a game result it is not part of anyone else's
  -- competition record. The entries go with it (ON DELETE CASCADE).
  DELETE FROM workouts WHERE player_id = v_target;

  -- ADDED 20260922213125: dated bodyweights are health information and /privacy
  -- promises they go with the account. The table's ON DELETE CASCADE never
  -- fires here, because erasure ANONYMISES the players row rather than deleting
  -- it, so the delete has to be explicit.
  DELETE FROM player_bodyweights WHERE player_id = v_target;

  -- Capture every name this player has been known by BEFORE scrubbing, so the
  -- free-text opponent_name copies can be found afterwards.
  SELECT ARRAY_REMOVE(ARRAY[
    NULLIF(display_name, ''), NULLIF(username, ''), NULLIF(full_name, '')
  ], NULL)
  INTO v_names
  FROM players WHERE id = v_target;

  -- Every identifying attribute. display_name is set rather than nulled so the
  -- leaderboard and past game reports still render a row instead of a blank.
  UPDATE players SET
    full_name       = NULL,
    email           = NULL,
    phone           = NULL,
    date_of_birth   = NULL,
    gender          = NULL,
    city            = NULL,
    region          = NULL,
    country         = NULL,
    parent_name     = NULL,
    parent_email    = NULL,
    parent_phone    = NULL,
    referral_code   = NULL,
    username        = NULL,
    icon            = NULL,
    -- ADDED 20260915051927.
    bodyweight_band = NULL,
    -- ADDED 20260921232726: the first band is a bodyweight attribute too.
    bodyweight_band_first = NULL,
    display_name    = 'Former player',
    show_full_name  = FALSE,
    show_username   = FALSE,
    show_location   = FALSE,
    is_active       = FALSE
  WHERE id = v_target;

  -- The name a kaiwhakawā typed onto a score row is a second copy of it.
  UPDATE results SET player_name = 'Former player'
  WHERE player_id = v_target;

  -- Being named as somebody's opponent is their record of a match, but the
  -- string is this player's name. Scrub the copies; exact match only.
  IF v_names IS NOT NULL AND array_length(v_names, 1) > 0 THEN
    UPDATE results SET opponent_name = 'Former player'
    WHERE opponent_name = ANY (v_names);
  END IF;
END;
$$;

-- ── 7. Assertions ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relname = 'player_bodyweights' AND c.relrowsecurity
  ) THEN
    RAISE EXCEPTION 'player_bodyweights has no row level security';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND table_name = 'player_bodyweights'
      AND grantee IN ('anon', 'authenticated')
      AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE')
  ) THEN
    RAISE EXCEPTION 'player_bodyweights still grants a direct write: record_bodyweight must be the only path';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'record_bodyweight'
      AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public']
  ) THEN
    RAISE EXCEPTION 'record_bodyweight is missing, not SECURITY DEFINER, or has no pinned search_path';
  END IF;

  -- The pin must NOT be definer, or current_user is always the owner and every
  -- client write would be treated as trusted server code.
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'pin_bodyweight_measured_on' AND p.prosecdef
  ) THEN
    RAISE EXCEPTION 'pin_bodyweight_measured_on is SECURITY DEFINER: the current_user test would never fire';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'grades_need_recheck'
      AND prosrc LIKE '%player_bodyweights%'
  ) THEN
    RAISE EXCEPTION 'grades_need_recheck does not probe player_bodyweights';
  END IF;

  -- Erasure must take the declarations, and must still clear the band columns
  -- it cleared before: this is a whole redefinition, which is how a rule goes
  -- missing.
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'delete_my_account'
      AND prosrc LIKE '%DELETE FROM player_bodyweights%'
      AND prosrc LIKE '%bodyweight_band_first = NULL%'
      AND prosrc LIKE '%DELETE FROM workouts%'
      AND prosrc LIKE '%DELETE FROM wellbeing_surveys%'
      AND prosrc LIKE '%DELETE FROM grade_exemptions%'
  ) THEN
    RAISE EXCEPTION 'delete_my_account lost a rule in the redefinition';
  END IF;
END $$;

COMMIT;
