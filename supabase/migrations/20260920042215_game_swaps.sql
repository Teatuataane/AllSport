-- ════════════════════════════════════════════════════════════════════════════
-- 20260920042215 — Swaps and extras at an official game
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT
--   workouts.session_id — the game a workout was done AT. A player who swaps an
--   official event for another in the same domain, or adds an extra, writes it
--   into a workout linked to that game rather than into `results`.
--
-- WHY NOT `results`
--   Five things rank off `results`: award_session_points, compute_event_placements,
--   the live leaderboard, the game report and lib/percentile.ts. A swapped score
--   must never reach any of them, and putting it in `results` would mean adding
--   an "official only" filter to all five, where missing one leaks a swap into a
--   placement. `workout_entries` already means "counts toward colours, never
--   toward a ranking".
--
-- EVIDENCE
--   An entry on a game-linked workout is `game` evidence, not `solo`: official
--   scores are entered by the players themselves too, in the same room, in front
--   of the same kaiwhakawā. That only holds if the server enforces the window,
--   which is what the two guard changes below do:
--     · session_id can only be set while that game is open, and never changed
--       afterwards (it is pinned on UPDATE, like player_id);
--     · an entry on a game-linked workout can only be written while the game is
--       open. After it closes, only a kaiwhakawā can.
--   Without those, anyone could attach a home workout to a past game and upgrade
--   it to `game` evidence.
--
-- DEPLOY ORDER: CODE FIRST, then this. Every read of session_id is its own
-- guarded query and treats 42703 as "not live yet". Reversed, an old bundle
-- would ignore the column and keep writing unlinked workouts, which is wrong
-- but not harmful.

-- ── 1. The column ───────────────────────────────────────────────────────────
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.sessions(id) ON DELETE SET NULL;

-- One swap workout per player per game. Without this, two quick taps on Swap
-- create two workouts and the screen's single-row read starts failing.
CREATE UNIQUE INDEX IF NOT EXISTS workouts_one_per_game
  ON public.workouts (player_id, session_id) WHERE session_id IS NOT NULL;

COMMENT ON COLUMN public.workouts.session_id IS
  'The official game this workout was done at: swapped and extra events. Set only while that game is open.';

-- ── 2. The workout guard ────────────────────────────────────────────────────
-- Redefined WHOLE from 20260920040735, with the session rule added. Every rule
-- it already carried is pinned by __tests__/gameSwaps.test.ts.
CREATE OR REPLACE FUNCTION public.guard_workouts_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad    text;
  v_active boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    -- service_role has no auth.uid() and must say who logged it.
    NEW.logged_by  := COALESCE(auth.uid(), NEW.logged_by);
    -- Witnessed means a kaiwhakawā watched someone ELSE do it. A kaiwhakawā's
    -- own session, or their own child's, is as self-reported as anyone's.
    NEW.witnessed  := auth.uid() IS NOT NULL AND public.is_judge() AND NEW.player_id <> auth.uid()
      AND NOT EXISTS (SELECT 1 FROM players WHERE id = NEW.player_id AND parent_id = auth.uid());

    -- ADDED 20260920042215: a workout may only be attached to a game that is
    -- still being played. A kaiwhakawā is exempt, exactly as they are in
    -- guard_results_write (they score for other players, and after the fact).
    IF NEW.session_id IS NOT NULL AND auth.uid() IS NOT NULL AND NOT public.is_judge() THEN
      SELECT is_active INTO v_active FROM sessions WHERE id = NEW.session_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'workout: unknown game %', NEW.session_id USING ERRCODE = '42501';
      END IF;
      IF NOT v_active THEN
        RAISE EXCEPTION 'workout: that game has finished' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    IF OLD.witnessed AND auth.uid() IS NOT NULL AND NOT public.is_judge() THEN
      RAISE EXCEPTION 'workout: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
    END IF;
    NEW.id         := OLD.id;
    NEW.player_id  := OLD.player_id;
    NEW.logged_by  := OLD.logged_by;
    NEW.witnessed  := OLD.witnessed;
    NEW.created_at := OLD.created_at;
    -- Pinned like player_id: a workout cannot be attached to a game, or moved
    -- to another, after the fact. That is what makes `game` evidence mean
    -- something.
    NEW.session_id := OLD.session_id;
  END IF;

  -- A plan only means something against the roster, the same rule
  -- workout_entries.event_slug follows. Checked only when it changes.
  IF TG_OP = 'INSERT' OR NEW.planned_events IS DISTINCT FROM OLD.planned_events THEN
    SELECT s INTO v_bad
      FROM unnest(COALESCE(NEW.planned_events, '{}')) AS s
     WHERE NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = s)
     LIMIT 1;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'workout: % is not an event on the roster', v_bad USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. The entries guard ────────────────────────────────────────────────────
-- Redefined WHOLE from 20260916211643, with the game window added. Its other
-- rules (witnessed, the 7-day window, the roster check, the Game-rung refusal,
-- and the fitting-only exception) are pinned by the test.
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
      -- ADDED 20260920042215: an entry made AT a game counts as `game`
      -- evidence, so it may only be written while that game is open — the same
      -- window guard_results_write gives an official score.
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

  -- A logged workout never records a GAME. A game result is a match between
  -- players at an official session, where the rating and match recording live;
  -- logged, it would count toward the win/draw/loss record with nobody on the
  -- other side. Game rungs are recognised by NAME because the database does not
  -- hold the ladders; __tests__/workoutEntriesIntegrity.test.ts fails if a Game
  -- rung is ever named otherwise.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('wrestling')) THEN
    RAISE EXCEPTION 'workout entry: a game result is recorded at an official game, not logged' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 4. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
DECLARE
  v_workouts text := (SELECT prosrc FROM pg_proc WHERE proname = 'guard_workouts_write');
  v_entries  text := (SELECT prosrc FROM pg_proc WHERE proname = 'guard_workout_entries_write');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'workouts' AND column_name = 'session_id') THEN
    RAISE EXCEPTION 'game swaps: workouts.session_id is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'workouts_one_per_game') THEN
    RAISE EXCEPTION 'game swaps: the one-workout-per-game index is missing';
  END IF;
  -- The rules added here.
  IF v_workouts NOT LIKE '%that game has finished%' OR v_workouts NOT LIKE '%NEW.session_id := OLD.session_id%' THEN
    RAISE EXCEPTION 'game swaps: the workout guard lost its session rule';
  END IF;
  IF v_entries NOT LIKE '%that game has finished%' THEN
    RAISE EXCEPTION 'game swaps: the entries guard lost its session rule';
  END IF;
  -- And the rules they already had: a whole redefinition is how one goes missing.
  IF v_workouts NOT LIKE '%a witnessed workout can only be changed%'
     OR v_workouts NOT LIKE '%is not an event on the roster%'
     OR v_entries NOT LIKE '%more than 7 days old%'
     OR v_entries NOT LIKE '%not logged%' THEN
    RAISE EXCEPTION 'game swaps: a guard lost a rule it already had';
  END IF;
END;
$$;
