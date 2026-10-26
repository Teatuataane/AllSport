-- ════════════════════════════════════════════════════════════════════════════
-- 20261026220347 — Playing the kaiwhakawā in a personal training session
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY (Tāne, 27 Oct 2026)
-- In a training session the player should be able to play the kaiwhakawā
-- running it, and that game should count toward both of their ratings. Until
-- now a game result was refused on any workout not linked to an official game
-- (20260916211643, kept by every redefinition since), and a match had to name
-- an official session.
--
-- WHY THIS IS SAFE
-- A training session is a WITNESSED workout the kaiwhakawā created
-- (20260930222237): the kaiwhakawā is in the room and is the other player. The
-- only opponent a training game may name is that kaiwhakawā (workouts.logged_by,
-- who must still be a kaiwhakawā), so it can never be used to put a win over
-- somebody absent on the record. Because the kaiwhakawā is a party to the game
-- and witnessed it, the match is stamped confirmed (confirmed_by = the
-- kaiwhakawā) and lib/matches.ts counts a confirmed match with no session as
-- agreed. A game result in training WITHOUT the kaiwhakawā as opponent (a
-- typed name) is still allowed as a witnessed score, but records no match and
-- rates nobody.
--
-- WHAT CHANGES
--   1. matches.session_id may be NULL, only for a match hung off a workout
--      entry (matches_session_or_entry).
--   2. guard_workout_entries_write: a game result is also allowed on an OPEN
--      training session (witnessed, not finished, today in NZ), the same window
--      a player may write to it at all. Redefined whole from 20261005222950;
--      every other rule is unchanged.
--   3. record_entry_match: an entry in an open training session may record a
--      match against the session's kaiwhakawā and no one else. Redefined whole
--      from 20261005222950; the official-game branch is unchanged.
--
-- DEPLOY ORDER: either is safe. Code first, a training game result is refused
-- by the old guard with "a game result is recorded at an official game", and
-- nothing else changes. Migration first, nothing writes a training game until
-- the code offers it. Additive: no row is rewritten.

BEGIN;

-- ── 1. A match may have no session when it hangs off an entry ───────────────
ALTER TABLE public.matches ALTER COLUMN session_id DROP NOT NULL;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_session_or_entry;
ALTER TABLE public.matches
  ADD CONSTRAINT matches_session_or_entry CHECK (session_id IS NOT NULL OR workout_entry_id IS NOT NULL);

-- ── 2. Entries: a game result in an open training session ───────────────────
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

  -- CHANGED 20261026220347: also allowed in an OPEN training session (a
  -- witnessed workout, not finished, dated today in NZ), where the kaiwhakawā
  -- is in the room and may be the opponent. The window is the one a player may
  -- write to a training session at all, so a finished session cannot gain a win.
  -- CHANGED 20261005222950: Mas Wrestling, 400m Sprint, 800m Sprint and
  -- Obstacle Course (6 Oct 2026 roster) join the list.
  -- CHANGED 20261005012108: thirteen more pure contests (the races and the
  -- contests whose drill ladders were removed on 5 Oct 2026) join Wrestling in
  -- the list. They have no rung to name, so the slug is the only way to know.
  -- A game result is allowed on a workout linked to an official game (a swap: a
  -- real opponent, a kaiwhakawā in the room), in an open training session, and
  -- nowhere else. Logged at home it would still count a win with nobody on the
  -- other side, which is what 20260916211643 exists to stop. Game rungs are
  -- recognised by NAME because the database does not hold the ladders;
  -- __tests__/workoutEntriesIntegrity.test.ts fails if that ever stops being true.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('wrestling', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war'))
     AND v_session IS NULL
     AND NOT (
       COALESCE(v_witnessed, false)
       AND v_finished IS NULL
       AND v_performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
     ) THEN
    RAISE EXCEPTION 'workout entry: a game result is recorded at an official game, not logged' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Matches: a training game against the session's kaiwhakawā ────────────
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
  v_uid      uuid := auth.uid();
  v_judge    boolean := public.is_judge();
  e          record;
  v_active   boolean;
  v_training boolean := false;
  v_name     text;
  v_term     int;
  v_outcome  text;
  v_opp      uuid[];
  v_mates    uuid[];
  v_match    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: sign in to record a match' USING ERRCODE = '42501';
  END IF;

  SELECT en.id, en.raw_score, en.difficulty_tier, en.event_slug,
         w.player_id, w.session_id, w.witnessed, w.finished_at, w.performed_on, w.logged_by
    INTO e
  FROM workout_entries en
  JOIN workouts w ON w.id = en.workout_id
  WHERE en.id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_entry_match: unknown entry %', p_entry_id USING ERRCODE = 'P0002';
  END IF;

  -- Same authority as writing the entry itself (can_log_for).
  IF NOT public.can_log_for(e.player_id) THEN
    RAISE EXCEPTION 'record_entry_match: that entry belongs to someone else' USING ERRCODE = '42501';
  END IF;

  IF e.session_id IS NULL THEN
    -- CHANGED 20261026220347: a training session (a witnessed workout the
    -- kaiwhakawā runs) may rate a game against that kaiwhakawā. A personal game
    -- still has no opponent the server can trust.
    IF NOT COALESCE(e.witnessed, false) THEN
      RAISE EXCEPTION 'record_entry_match: only a game played at an official game or against your kaiwhakawā in training is rated'
        USING ERRCODE = '22023';
    END IF;
    IF NOT v_judge AND NOT (
      e.finished_at IS NULL AND e.performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
    ) THEN
      RAISE EXCEPTION 'record_entry_match: that training session has finished — ask your kaiwhakawā'
        USING ERRCODE = '42501';
    END IF;
    v_training := true;
  ELSIF NOT v_judge THEN
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
     AND (e.difficulty_tier ILIKE 'Game%' OR e.event_slug IN ('wrestling', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war')) THEN
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

  -- In training the only opponent is the kaiwhakawā running the session, one
  -- on one, and they must still be a kaiwhakawā: anyone else named here would
  -- be a win over someone who never confirmed it.
  IF v_training AND cardinality(v_opp) > 0 AND (
       v_opp <> ARRAY[e.logged_by]
       OR cardinality(v_mates) > 0
       OR NOT EXISTS (SELECT 1 FROM players p WHERE p.id = e.logged_by AND p.role = 'judge')
     ) THEN
    RAISE EXCEPTION 'record_entry_match: in training you can only play the kaiwhakawā running the session'
      USING ERRCODE = '22023';
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

  -- A training game is confirmed by the kaiwhakawā who played and witnessed
  -- it; lib/matches.ts counts a confirmed match with no session as agreed.
  INSERT INTO matches (workout_entry_id, session_id, event_name, outcome, recorded_by, confirmed_by, confirmed_at)
  VALUES (p_entry_id, e.session_id, v_name, v_outcome, v_uid,
          CASE WHEN v_training THEN e.logged_by END,
          CASE WHEN v_training THEN now() END)
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

-- ── 4. Check ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'matches'
                AND column_name = 'session_id' AND is_nullable = 'NO') THEN
    RAISE EXCEPTION 'training games: matches.session_id is still NOT NULL';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'matches_session_or_entry') THEN
    RAISE EXCEPTION 'training games: matches_session_or_entry is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
     WHERE proname = 'record_entry_match' AND prosecdef AND 'search_path=public' = ANY (proconfig)
  ) THEN
    RAISE EXCEPTION 'training games: record_entry_match is missing, not SECURITY DEFINER, or has no pinned search_path';
  END IF;
  IF has_function_privilege('anon', 'public.record_entry_match(uuid, uuid[], uuid[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'training games: anon can execute record_entry_match';
  END IF;
END $$;

COMMIT;
