-- ════════════════════════════════════════════════════════════════════════════
-- 20260916211643 — Workout entries: refuse scores no workout can have
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY
-- workout_entries' score columns are plain `numeric`, and Postgres numeric
-- ACCEPTS the strings 'Infinity', '-Infinity' and 'NaN'. Scores are
-- self-reported by design, but these are not scores, they are corrupt values:
-- sent straight to the API, 'Infinity' became a permanent PB and graded as the
-- top colour through the grading engine. v0.8.1.0 made the client ignore them
-- (loggedBestRows, workoutEvidence); this makes the database refuse them, so
-- nothing that reads the table later has to remember to.
--
-- Also refuses a Game-rung result on a logged entry, the other forgery the
-- /ship review of v0.8.1.0 found (a logged "win" with nobody on the other side).
--
-- WHAT
--   1. CHECKs on raw_score (finite), weight_kg, time_seconds and distance_m
--      (finite AND within a plausible range). Numeric NaN sorts ABOVE every
--      other value including Infinity, so `< 'Infinity'` excludes both.
--   2. guard_workout_entries_write() redefined WHOLE, from 20260915214702, with
--      one added block, marked. Pinned by __tests__/workoutSchema.test.ts.
--
-- SAFE TO APPLY: checked against production before writing — workout_entries
-- held 0 rows, so no existing row can violate a new CHECK. Either deploy order
-- is safe: the current client already never sends any of these values.

-- ── 1. Scores a workout can actually have ───────────────────────────────────
ALTER TABLE public.workout_entries
  ADD CONSTRAINT workout_entries_raw_score_finite
    CHECK (raw_score IS NULL OR (raw_score > '-Infinity'::numeric AND raw_score < 'Infinity'::numeric)),
  -- kg, or cm for Shoulder Dislocate's grip width: 0 is a bodyweight hold.
  ADD CONSTRAINT workout_entries_weight_kg_range
    CHECK (weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 1000)),
  ADD CONSTRAINT workout_entries_time_seconds_range
    CHECK (time_seconds IS NULL OR (time_seconds >= 0 AND time_seconds <= 86400)),
  ADD CONSTRAINT workout_entries_distance_m_range
    CHECK (distance_m IS NULL OR (distance_m >= 0 AND distance_m <= 100000));

-- ── 2. No game results in a logged workout ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_workout_entries_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_witnessed    boolean;
  v_performed_on date;
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
      AND NEW.count IS NOT DISTINCT FROM OLD.count
      AND NEW.volume_distance_m IS NOT DISTINCT FROM OLD.volume_distance_m
      AND NEW.duration_seconds IS NOT DISTINCT FROM OLD.duration_seconds
      AND NEW.raw_score IS NOT DISTINCT FROM OLD.raw_score;
  END IF;

  SELECT witnessed, performed_on INTO v_witnessed, v_performed_on FROM workouts WHERE id = NEW.workout_id;
  IF auth.uid() IS NOT NULL AND NOT public.is_judge() AND NOT v_fitting_only THEN
    -- A witnessed workout is the kaiwhakawā's record: a player adding or
    -- changing an entry under it would inherit the witnessed label.
    IF v_witnessed THEN
      RAISE EXCEPTION 'workout entry: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
    END IF;
    -- Decision 17 applies to every write, not only to creating the workout:
    -- otherwise a new best effort could be slipped into a months-old log.
    IF v_performed_on < (now() AT TIME ZONE 'Pacific/Auckland')::date - 7 THEN
      RAISE EXCEPTION 'workout entry: that workout is more than 7 days old' USING ERRCODE = '22023';
    END IF;
  END IF;
  IF NEW.event_slug IS NOT NULL AND NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = NEW.event_slug) THEN
    RAISE EXCEPTION 'workout entry: % is not an event on the roster', NEW.event_slug USING ERRCODE = '22023';
  END IF;
  -- ADDED 20260916211643: a logged workout never records a GAME. A game result
  -- is a match between players at an official session, where the rating and
  -- match recording live; logged, it would count toward the win/draw/loss
  -- record with nobody on the other side. /log never offers a Game rung, so
  -- this only stops rows written straight to the API. Game rungs are
  -- recognised by NAME because the database does not hold the ladders:
  -- __tests__/workoutSchema.test.ts fails if a Game rung is ever named
  -- otherwise, or a drill rung starts with "Game", or the pure-contest list
  -- below stops matching lib/eventData.ts.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('wrestling')) THEN
    RAISE EXCEPTION 'workout entry: a game result is recorded at an official game, not logged' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

-- ── 3. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM pg_constraint
      WHERE conrelid = 'public.workout_entries'::regclass
        AND conname IN ('workout_entries_raw_score_finite', 'workout_entries_weight_kg_range',
                        'workout_entries_time_seconds_range', 'workout_entries_distance_m_range')) <> 4 THEN
    RAISE EXCEPTION 'workout entries integrity: a CHECK constraint is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'guard_workout_entries_write' AND prosecdef AND 'search_path=public' = ANY (proconfig)
      AND prosrc LIKE '%ILIKE ''Game\%''%' ESCAPE '\' AND prosrc LIKE '%v_fitting_only%'
  ) THEN
    RAISE EXCEPTION 'workout entries integrity: the entries guard lost its Game-rung rule or an earlier rule';
  END IF;
END $$;
