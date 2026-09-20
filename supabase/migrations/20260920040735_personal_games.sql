-- ════════════════════════════════════════════════════════════════════════════
-- 20260920040735 — Personal games: a planned workout, played on the live screen
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT
--   1. workouts.planned_events — the events a player planned, in play order,
--      as lib/eventData.ts slugs. An empty array is a plain log (every workout
--      before this), a non-empty one is a PERSONAL GAME: the player sets it up
--      in the same screen a kaiwhakawa uses for an official game and plays it
--      on the same live screen.
--   2. workouts.finished_at — when the player tapped Finish. A personal game is
--      "open" while this is NULL and the day it was performed is still today;
--      nothing sweeps it, because the day itself closes it.
--
-- A personal game is NOT a sessions row, deliberately. sessions carries the
-- one-active-game rule, the placement and award triggers and the public game
-- report; a personal game is training, never ranked, and its entries already
-- have a home in workout_entries.
--
-- Every slug is checked against event_domains by the guard, the same rule
-- workout_entries.event_slug already follows, so a plan can never name an
-- event that is not on the roster.
--
-- DEPLOY ORDER: either is safe. The client reads both columns in their own
-- guarded query and treats 42703 (column missing) as "personal games are not
-- live yet"; a workout logged without them behaves exactly as before.

-- ── 1. The columns ──────────────────────────────────────────────────────────
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS planned_events text[] NOT NULL DEFAULT '{}'
    CONSTRAINT workouts_planned_events_size CHECK (cardinality(planned_events) <= 30),
  ADD COLUMN IF NOT EXISTS finished_at timestamptz;

COMMENT ON COLUMN public.workouts.planned_events IS
  'Event slugs planned for a personal game, in play order. Empty = a plain logged workout.';
COMMENT ON COLUMN public.workouts.finished_at IS
  'When the player tapped Finish. NULL and performed_on = today means still being played.';

-- ── 2. The guard ────────────────────────────────────────────────────────────
-- Redefined WHOLE, from the live definition, with one rule added: every slug in
-- planned_events must be an event on the roster. Everything else is unchanged
-- and pinned by __tests__/personalGameSchema.test.ts, which fails if a rule
-- from 20260915214702 goes missing here.
CREATE OR REPLACE FUNCTION public.guard_workouts_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_bad text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    -- service_role has no auth.uid() and must say who logged it.
    NEW.logged_by  := COALESCE(auth.uid(), NEW.logged_by);
    -- Witnessed means a kaiwhakawā watched someone ELSE do it. A kaiwhakawā's
    -- own session, or their own child's, is as self-reported as anyone's.
    NEW.witnessed  := auth.uid() IS NOT NULL AND public.is_judge() AND NEW.player_id <> auth.uid()
      AND NOT EXISTS (SELECT 1 FROM players WHERE id = NEW.player_id AND parent_id = auth.uid());
  ELSE
    IF OLD.witnessed AND auth.uid() IS NOT NULL AND NOT public.is_judge() THEN
      RAISE EXCEPTION 'workout: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
    END IF;
    NEW.id         := OLD.id;
    NEW.player_id  := OLD.player_id;
    NEW.logged_by  := OLD.logged_by;
    NEW.witnessed  := OLD.witnessed;
    NEW.created_at := OLD.created_at;
  END IF;

  -- ADDED 20260920040735: a plan only means something against the roster, the
  -- same rule workout_entries.event_slug follows. Checked only when it changes,
  -- so an untouched old workout never pays for it.
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

-- ── 3. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'workouts'
         AND column_name IN ('planned_events', 'finished_at')) <> 2 THEN
    RAISE EXCEPTION 'personal games: a column is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workouts_planned_events_size') THEN
    RAISE EXCEPTION 'personal games: the plan size CHECK is missing';
  END IF;
  -- The added rule AND the rules it was added to. A redefinition that loses the
  -- witnessed rule would otherwise pass silently.
  IF (SELECT prosrc FROM pg_proc WHERE proname = 'guard_workouts_write') NOT LIKE '%event_domains%'
     OR (SELECT prosrc FROM pg_proc WHERE proname = 'guard_workouts_write') NOT LIKE '%a witnessed workout can only be changed%' THEN
    RAISE EXCEPTION 'personal games: guard_workouts_write lost a rule';
  END IF;
END;
$$;
