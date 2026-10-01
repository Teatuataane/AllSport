-- Personal training sessions: a session a kaiwhakawā runs for one player,
-- played by both of them while it is open (docs/designs/personal-training-spec.md).
--
-- A training session needs NO new table or column. It is a WITNESSED workout:
-- guard_workouts_write already stamps `witnessed` true when a kaiwhakawā creates
-- a workout for someone else, and only a kaiwhakawā can do that. What changes is
-- who may write scores into it, and when.
--
--   BEFORE  A witnessed workout is closed to everyone but a kaiwhakawā, its
--           entries included (the player could otherwise add solo scores and
--           inherit the witnessed label).
--   AFTER   While the session is OPEN (not finished, and performed today in NZ)
--           the player, or their parent, may also add, edit and delete entries,
--           and every one of them is witnessed because the kaiwhakawā is
--           running it. Once it is finished, or the NZ day ends, it is locked to
--           kaiwhakawā exactly as before. The NZ day closes it in the database
--           itself: no timer, nothing sweeps it.
--
-- The plan (planned_events), Finish, and deleting the workout stay
-- kaiwhakawā-only: guard_workouts_write is NOT touched, so a player still cannot
-- change a witnessed workout's row.
--
-- Also closes a gap that made "locked" untrue: both guards fire on INSERT and
-- UPDATE only, so a player could DELETE the entries of a witnessed workout at
-- any time. The two DELETE guards below are SECURITY INVOKER and test
-- current_user, the pattern 20260921182106 documents: as a definer current_user
-- is always the owner, which would wave every client delete through, and
-- delete_my_account (a definer) must still be able to erase a player's workouts.
--
-- Redefined WHOLE from 20260920053207: every rule it carried is kept and pinned
-- by __tests__/trainingSessions.test.ts; the ONE change is the witnessed block.

CREATE OR REPLACE FUNCTION public.guard_workout_entries_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_witnessed    boolean;
  v_performed_on date;
  v_session      uuid;
  v_active       boolean;
  v_player       uuid;
  v_finished     timestamptz;
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

  SELECT witnessed, performed_on, session_id, player_id, finished_at
    INTO v_witnessed, v_performed_on, v_session, v_player, v_finished
    FROM workouts WHERE id = NEW.workout_id;

  IF auth.uid() IS NOT NULL AND NOT public.is_judge() AND NOT v_fitting_only THEN
    -- A witnessed workout is the kaiwhakawā's record: a player adding or
    -- changing an entry under it would inherit the witnessed label.
    -- CHANGED 20260930222237: except while it is an OPEN training session the
    -- kaiwhakawā is running. Then the player (or their parent) plays in it, and
    -- what they enter is witnessed because the kaiwhakawā is in the room. The
    -- window is the same one isOpen() in lib/personalGame.ts uses.
    IF v_witnessed THEN
      IF NOT (
        v_finished IS NULL
        AND v_performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
        AND public.can_log_for(v_player)
      ) THEN
        RAISE EXCEPTION 'workout entry: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
      END IF;
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

  -- A game result is allowed on a workout linked to an official game (a swap: a
  -- real opponent, a kaiwhakawā in the room) and nowhere else. Logged at home it
  -- would still count a win with nobody on the other side, which is what
  -- 20260916211643 exists to stop. Game rungs are recognised by NAME because the
  -- database does not hold the ladders; __tests__/workoutEntriesIntegrity.test.ts
  -- fails if that ever stops being true.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('wrestling'))
     AND v_session IS NULL THEN
    RAISE EXCEPTION 'workout entry: a game result is recorded at an official game, not logged' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

-- ── Deleting ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.guard_workout_entries_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_witnessed    boolean;
  v_performed_on date;
  v_finished     timestamptz;
BEGIN
  -- Only a direct client call is held to this. delete_my_account is a definer,
  -- so current_user there is the owner, and erasure must keep working.
  IF current_user <> 'authenticated' OR public.is_judge() THEN
    RETURN OLD;
  END IF;

  SELECT witnessed, performed_on, finished_at
    INTO v_witnessed, v_performed_on, v_finished
    FROM workouts WHERE id = OLD.workout_id;

  -- No parent row means this is the cascade from the workout being deleted,
  -- which guard_workouts_delete has already decided.
  IF FOUND AND v_witnessed AND NOT (
    v_finished IS NULL
    AND v_performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
  ) THEN
    RAISE EXCEPTION 'workout entry: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_workout_entries_delete ON public.workout_entries;
CREATE TRIGGER trg_guard_workout_entries_delete
  BEFORE DELETE ON public.workout_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_workout_entries_delete();

CREATE OR REPLACE FUNCTION public.guard_workouts_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF current_user = 'authenticated' AND OLD.witnessed AND NOT public.is_judge() THEN
    RAISE EXCEPTION 'workout: a witnessed workout can only be deleted by a kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_workouts_delete ON public.workouts;
CREATE TRIGGER trg_guard_workouts_delete
  BEFORE DELETE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.guard_workouts_delete();

-- ── Assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE v_src text;
BEGIN
  SELECT prosrc INTO v_src FROM pg_proc WHERE proname = 'guard_workout_entries_write';
  IF v_src IS NULL
     OR v_src NOT LIKE '%can_log_for(v_player)%'
     OR v_src NOT LIKE '%more than 7 days old%'
     OR v_src NOT LIKE '%that game has finished%'
     OR v_src NOT LIKE '%a game result is recorded at an official game%'
     OR v_src NOT LIKE '%v_fitting_only%' THEN
    RAISE EXCEPTION 'training sessions: guard_workout_entries_write lost a rule';
  END IF;

  IF (SELECT count(*) FROM pg_trigger
       WHERE tgname IN ('trg_guard_workout_entries_delete', 'trg_guard_workouts_delete')
         AND NOT tgisinternal) <> 2 THEN
    RAISE EXCEPTION 'training sessions: a delete guard is missing';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc
              WHERE proname IN ('guard_workout_entries_delete', 'guard_workouts_delete')
                AND prosecdef) THEN
    RAISE EXCEPTION 'training sessions: a delete guard is SECURITY DEFINER, so current_user would always be the owner';
  END IF;
END $$;
