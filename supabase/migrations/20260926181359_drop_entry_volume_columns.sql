-- ─── Drop workout_entries.count and volume_distance_m ────────────────────────
-- Training units were removed from AllSport on 27 September 2026 (v0.21.0.0).
-- These two columns held the VOLUME a unit was counted from (sets, holds,
-- metres), and nothing reads them any more: grading reads raw_score, the
-- activity report reads duration_seconds.
--
-- DEPLOY ORDER: CODE FIRST, THEN THIS MIGRATION. The v0.21.0.0 bundle neither
-- selects nor writes these columns. An older bundle still selects them
-- (lib/loadGrades.ts, the personal-game screen, the swap hook), and a missing
-- COLUMN is 42703, which takes the WHOLE PostgREST request down: HOME's colours
-- and the workout screen would fail outright. Apply only once the new bundle is
-- serving, and hard-refresh any kaiwhakawā device that was left open.
--
-- guard_workout_entries_write is REDEFINED WHOLE, because its fitting-only rule
-- named both columns, and a plpgsql trigger referencing a dropped column raises
-- at RUNTIME on every write, not at migration time. The body below is the LIVE
-- prosrc read from production on 2026-09-26 (the 20260920053207 definition),
-- with exactly those two lines removed. Nothing else changes.
--
-- The 3 rows holding a value are archived first (RLS on, no policies), the same
-- pattern as every earlier archive: CREATE TABLE AS does not inherit RLS, and
-- anything in `public` is reachable through PostgREST.

-- 1. Archive what is about to be dropped.
CREATE TABLE IF NOT EXISTS public.workout_entries_volume_archive_20260926181359 AS
SELECT id, workout_id, event_slug, count, volume_distance_m, now() AS archived_at
FROM public.workout_entries
WHERE count IS NOT NULL OR volume_distance_m IS NOT NULL;

ALTER TABLE public.workout_entries_volume_archive_20260926181359 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_volume_archive_20260926181359 FROM anon, authenticated;

-- 2. The guard, without the two columns.
CREATE OR REPLACE FUNCTION public.guard_workout_entries_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_witnessed    boolean;
  v_performed_on date;
  v_session      uuid;
  v_active       boolean;
  v_fitting_only boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.id         := OLD.id;
    NEW.workout_id := OLD.workout_id;
    NEW.created_at := OLD.created_at;
    -- Choosing the event for an entry that was not fitted yet, and nothing
    -- else. Always allowed: the not-fitted list exists so old logs can count
    -- once they are fitted (decision 14).
    v_fitting_only := OLD.event_slug IS NULL AND NEW.event_slug IS NOT NULL
      AND NEW.activity IS NOT DISTINCT FROM OLD.activity
      AND NEW.duration_seconds IS NOT DISTINCT FROM OLD.duration_seconds
      AND NEW.raw_score IS NOT DISTINCT FROM OLD.raw_score;
  END IF;

  SELECT witnessed, performed_on, session_id
    INTO v_witnessed, v_performed_on, v_session
    FROM workouts WHERE id = NEW.workout_id;

  IF auth.uid() IS NOT NULL AND NOT public.is_judge() AND NOT v_fitting_only THEN
    -- A witnessed workout is the kaiwhakawā's record: a player adding or
    -- changing an entry under it would inherit the witnessed label.
    IF v_witnessed THEN
      RAISE EXCEPTION 'workout entry: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
    END IF;

    IF v_session IS NOT NULL THEN
      -- An entry made AT a game counts as `game` evidence, so it may only be
      -- written while that game is open — the same window guard_results_write
      -- gives an official score.
      SELECT is_active INTO v_active FROM sessions WHERE id = v_session;
      IF NOT COALESCE(v_active, false) THEN
        RAISE EXCEPTION 'workout entry: that game has finished' USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Decision 17 applies to every write, not only to creating the workout:
      -- otherwise a new best effort could be slipped into a months-old log.
      IF v_performed_on < (now() AT TIME ZONE 'Pacific/Auckland')::date - 7 THEN
        RAISE EXCEPTION 'workout entry: that workout is more than 7 days old' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  IF NEW.event_slug IS NOT NULL AND NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = NEW.event_slug) THEN
    RAISE EXCEPTION 'workout entry: % is not an event on the roster', NEW.event_slug USING ERRCODE = '22023';
  END IF;

  -- CHANGED 20260920053207: a game result is allowed on a workout linked to an
  -- official game (a swap: a real opponent, a kaiwhakawā in the room) and
  -- nowhere else. Logged at home it would still count a win with nobody on the
  -- other side, which is what 20260916211643 exists to stop. Game rungs are
  -- recognised by NAME because the database does not hold the ladders;
  -- __tests__/workoutEntriesIntegrity.test.ts fails if that ever stops being
  -- true.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('wrestling'))
     AND v_session IS NULL THEN
    RAISE EXCEPTION 'workout entry: a game result is recorded at an official game, not logged' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

-- 3. Drop the columns. Their CHECK constraints go with them.
ALTER TABLE public.workout_entries DROP COLUMN IF EXISTS count;
ALTER TABLE public.workout_entries DROP COLUMN IF EXISTS volume_distance_m;

-- 4. Assert it took, so a partial run cannot report success.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'workout_entries'
               AND column_name IN ('count', 'volume_distance_m')) THEN
    RAISE EXCEPTION 'drop volume: a column survived';
  END IF;
  -- Comments stripped first: a bare match on prosrc has matched a comment before.
  IF regexp_replace((SELECT prosrc FROM pg_proc WHERE proname = 'guard_workout_entries_write'), '--[^\n]*', '', 'g')
     ~* '\m(count|volume_distance_m)\M' THEN
    RAISE EXCEPTION 'drop volume: guard_workout_entries_write still names a dropped column';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.workout_entries_volume_archive_20260926181359'::regclass) THEN
    RAISE EXCEPTION 'drop volume: archive has no RLS';
  END IF;
END $$;
