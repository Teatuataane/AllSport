-- ════════════════════════════════════════════════════════════════════════════
-- 20260920053207 — A game played as a SWAP counts toward the rating
-- ════════════════════════════════════════════════════════════════════════════
--
-- A player who swaps today's Tennis for Badminton plays a real match, against a
-- real opponent, in front of a kaiwhakawā — but the score lands in
-- `workout_entries`, which `matches` could not reference, so the game counted
-- as training and nothing else. Game-event colours above Kahurangi need ten
-- RATED games, so a player who swaps is shut out of them.
--
-- DECIDED with Tāne, 2026-09-20: a win, draw or loss may be recorded on a swap
-- AT AN OFFICIAL GAME, and nowhere else. A personal game stays drills only.
-- `20260916211643` refused every logged game result because a logged game has
-- nobody on the other side; at an official game there IS somebody, they are a
-- registered player, and a kaiwhakawā is in the room. That is the whole
-- difference, and `workouts.session_id` is what encodes it.
--
-- WHAT
--   1. `matches` may hang off a `workout_entries` row instead of a `results`
--      row — exactly one of the two.
--   2. `matches.event_name` is stored for an entry match, because a swapped
--      event has no `session_events` row to read the name from, and the rating
--      groups games by event NAME.
--   3. `record_entry_match()` — the entry counterpart of `record_match()`. A
--      separate function rather than an overload: two functions differing only
--      by a uuid argument are ambiguous to PostgREST.
--   4. The entries guard allows a Game rung ONLY on a game-linked workout.
--
-- The outcome is still derived server-side, never sent: a Game rung encodes it
-- in the score as `tier * 10000 + (win 2 / draw 1 / loss 0)` (lib/scoring.ts),
-- so the term is read back here. `__tests__/rateSwapGames.test.ts` pins that
-- encoding against the client's, because this is the second place that knows it.
--
-- DEPLOY ORDER: code first or migration first are both safe. The client treats
-- PGRST202 (function not deployed) as "not recording yet" and the score still
-- saves, exactly as match recording has since September.

BEGIN;

-- ── 1. A match may belong to a logged entry ─────────────────────────────────
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS workout_entry_id uuid UNIQUE
    REFERENCES public.workout_entries(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_name text;

ALTER TABLE public.matches ALTER COLUMN result_id DROP NOT NULL;
ALTER TABLE public.matches ALTER COLUMN event_id  DROP NOT NULL;

-- Exactly one anchor. Without this a row could carry both and two different
-- scores would claim one match.
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_one_anchor;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_one_anchor CHECK (num_nonnulls(result_id, workout_entry_id) = 1);

-- An entry match has no session_events row, so it must carry its own name.
ALTER TABLE public.matches
  DROP CONSTRAINT IF EXISTS matches_entry_needs_name;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_entry_needs_name
    CHECK (workout_entry_id IS NULL OR event_name IS NOT NULL);

-- ── 2. The entries guard: a Game rung, at a game only ───────────────────────
-- Redefined WHOLE from 20260920042215. Every rule it carried is pinned by
-- __tests__/rateSwapGames.test.ts; the ONE change is the last block.
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
$$;

-- ── 3. Recording the match behind a swapped game ────────────────────────────
CREATE OR REPLACE FUNCTION public.record_entry_match(
  p_entry_id     uuid,
  p_opponent_ids uuid[],
  p_teammate_ids uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_judge   boolean := public.is_judge();
  e         record;
  v_active  boolean;
  v_name    text;
  v_term    int;
  v_outcome text;
  v_opp     uuid[];
  v_mates   uuid[];
  v_match   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: sign in to record a match' USING ERRCODE = '42501';
  END IF;

  SELECT en.id, en.raw_score, en.difficulty_tier, en.event_slug,
         w.player_id, w.session_id
    INTO e
  FROM workout_entries en
  JOIN workouts w ON w.id = en.workout_id
  WHERE en.id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_entry_match: unknown entry %', p_entry_id USING ERRCODE = 'P0002';
  END IF;

  -- Only a swap AT a game is rated. A personal game has no opponent the server
  -- can trust, which is the decision this whole migration rests on.
  IF e.session_id IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: only a game played at an official game is rated'
      USING ERRCODE = '22023';
  END IF;

  -- Same authority as writing the entry itself (can_log_for).
  IF NOT public.can_log_for(e.player_id) THEN
    RAISE EXCEPTION 'record_entry_match: that entry belongs to someone else' USING ERRCODE = '42501';
  END IF;

  IF NOT v_judge THEN
    SELECT is_active INTO v_active FROM sessions WHERE id = e.session_id;
    IF NOT COALESCE(v_active, false) THEN
      RAISE EXCEPTION 'record_entry_match: that game has finished — ask a kaiwhakawā'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT event_name INTO v_name FROM event_domains WHERE slug = e.event_slug;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: % is not an event on the roster', e.event_slug
      USING ERRCODE = '22023';
  END IF;

  -- The outcome comes from the SCORE, never from the caller: a Game rung
  -- encodes win/draw/loss as the within-tier term (lib/scoring.ts).
  IF e.raw_score IS NOT NULL
     AND (e.difficulty_tier ILIKE 'Game%' OR e.event_slug IN ('wrestling')) THEN
    v_term := (e.raw_score::int) % 10000;
    v_outcome := CASE v_term WHEN 2 THEN 'a' WHEN 1 THEN 'draw' WHEN 0 THEN 'b' END;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_opp
  FROM unnest(COALESCE(p_opponent_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> e.player_id;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_mates
  FROM unnest(COALESCE(p_teammate_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> e.player_id;

  IF v_opp && v_mates THEN
    RAISE EXCEPTION 'record_entry_match: a player cannot be on both sides' USING ERRCODE = '22023';
  END IF;

  -- The match mirrors the entry, so whatever was recorded for it goes first.
  DELETE FROM matches WHERE workout_entry_id = p_entry_id;

  IF v_outcome IS NULL OR cardinality(v_opp) = 0 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_opp || v_mates) AS x
    WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = x)
  ) THEN
    RAISE EXCEPTION 'record_entry_match: an opponent is not a registered player'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO matches (workout_entry_id, session_id, event_name, outcome, recorded_by)
  VALUES (p_entry_id, e.session_id, v_name, v_outcome, v_uid)
  RETURNING id INTO v_match;

  INSERT INTO match_players (match_id, player_id, side)
  SELECT v_match, e.player_id, 'a'
  UNION ALL SELECT v_match, x, 'a' FROM unnest(v_mates) AS x
  UNION ALL SELECT v_match, x, 'b' FROM unnest(v_opp)   AS x;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.record_entry_match(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_entry_match(uuid, uuid[], uuid[]) TO authenticated;

COMMENT ON FUNCTION public.record_entry_match(uuid, uuid[], uuid[]) IS
  'Records the match behind a game played as a SWAP at an official game. The '
  'outcome is read from the entry score; only a game-linked workout qualifies.';

-- ── 4. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
DECLARE
  v_entries text := (SELECT prosrc FROM pg_proc WHERE proname = 'guard_workout_entries_write');
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                  WHERE table_schema = 'public' AND table_name = 'matches'
                    AND column_name = 'workout_entry_id') THEN
    RAISE EXCEPTION 'rate swap games: matches.workout_entry_id is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_one_anchor') THEN
    RAISE EXCEPTION 'rate swap games: the one-anchor CHECK is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'record_entry_match' AND prosecdef) THEN
    RAISE EXCEPTION 'rate swap games: record_entry_match is missing or not SECURITY DEFINER';
  END IF;
  -- The relaxation, and the rules it must NOT have taken with it.
  IF v_entries NOT LIKE '%v_session IS NULL%'
     OR v_entries NOT LIKE '%a witnessed workout can only be changed%'
     OR v_entries NOT LIKE '%more than 7 days old%'
     OR v_entries NOT LIKE '%that game has finished%'
     OR v_entries NOT LIKE '%is not an event on the roster%' THEN
    RAISE EXCEPTION 'rate swap games: the entries guard lost a rule';
  END IF;
  -- Every existing match still has exactly one anchor.
  IF EXISTS (SELECT 1 FROM matches WHERE num_nonnulls(result_id, workout_entry_id) <> 1) THEN
    RAISE EXCEPTION 'rate swap games: a match has no anchor, or two';
  END IF;
END;
$$;

COMMIT;
