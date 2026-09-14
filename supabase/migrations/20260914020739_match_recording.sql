-- ════════════════════════════════════════════════════════════════════════════
-- 20260914020739 — Record head-to-head matches by player id
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY
-- A head-to-head game has only ever been recorded as HALF a match: each player
-- writes their own `results` row, and the opponent is `results.opponent_name`,
-- free text and optional. Measured against production on 13 September 2026:
-- 25% of game results name an opponent at all, aliases break the rest ("Tāne"
-- and "Coach Tāne" are two people to any machine), a team cannot be written
-- down, and in the whole history only 11 matches were recorded by BOTH players.
--
-- Tāne wants the upper colours on game events gated by player-to-player skill,
-- with a minimum of 10 recorded games in a sport before a colour. No rating is
-- trustworthy on free-text halves. This records the match itself.
--
-- THE SHAPE
-- A match hangs off the RECORDER'S OWN result row (`result_id`, unique):
--   · deleting the score deletes its match (ON DELETE CASCADE), so the two can
--     never drift, and the kaiwhakawā's existing delete powers already cover it;
--   · editing the score re-records the match (record_match replaces by result);
--   · the server derives session, event, player and outcome FROM that row, so
--     the client sends only opponent ids and cannot state an outcome that
--     disagrees with the score it just submitted.
-- `match_players` holds the sides as player ids, so a 1v1 and a 5v5 are the
-- same shape. The app sends one opponent today; teams need only a UI.
--
-- WHAT IS DELIBERATELY NOT HERE
--   · No rating. That comes after a season of matches exists to calibrate it.
--   · No confirmation flow. `confirmed_by` / `confirmed_at` are reserved for a
--     kaiwhakawā confirming results. When BOTH players record the same game,
--     that agreement is DERIVED by lib/matches.ts, never stored — stored
--     agreement goes stale the moment either side edits.
--   · No backfill. History's opponents are free-text names; resolving them to
--     ids would be guessing, and a rating's whole value is that it isn't.
--     Recording starts from deploy.
--   · Guests. A guest has no stable identity and cannot be rated. Games against
--     guests still record as `results.opponent_name`, exactly as before.
--
-- WHO MAY WRITE
-- Only through record_match(), never directly — so `matches` and
-- `match_players` cannot disagree. It mirrors the rules for writing the result
-- itself: your own row, your child's, or any row as kaiwhakawā
-- (`results_insert_own`), and only into an OPEN session unless kaiwhakawā
-- (`guard_results_write`, 20260813000001).
--
-- WHO MAY READ
-- Anyone, the same as `results` (`results_select_all USING (true)`). A match
-- reveals nothing `results` does not already: player ids and opponents are
-- public there today.
--
-- DEPLOY ORDER: code first or migration first are both safe. The client treats
-- a missing function (PGRST202) as "not recording yet" and the score still
-- saves; this file creates tables nothing else reads yet.
--
-- NOT VERIFIED AGAINST A DATABASE when written: Docker was not running, so it
-- was never applied locally. Apply from `main`, then verify by querying the
-- objects (see the closing checks), never by trusting `migration list`.

BEGIN;

-- ── 1. Tables ───────────────────────────────────────────────────────────────
CREATE TABLE public.matches (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- The recorder's own result row. One match per result, replaced on edit.
  result_id    uuid NOT NULL UNIQUE REFERENCES public.results(id) ON DELETE CASCADE,
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_id     uuid NOT NULL REFERENCES public.session_events(id) ON DELETE CASCADE,
  -- Relative to side 'a', which always holds the result's own player.
  outcome      text NOT NULL CHECK (outcome IN ('a', 'b', 'draw')),
  -- Who pressed submit: the player, their parent, or a kaiwhakawā. Audit only.
  recorded_by  uuid NOT NULL,
  -- Reserved for a kaiwhakawā confirmation flow. Not written by this migration.
  confirmed_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
  confirmed_at timestamptz
);

CREATE TABLE public.match_players (
  match_id  uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  -- No ON DELETE, matching results.player_id: a player is anonymised on
  -- erasure, never deleted, so the competition record stays whole.
  player_id uuid NOT NULL REFERENCES public.players(id),
  side      text NOT NULL CHECK (side IN ('a', 'b')),
  -- A player sits in a match once, on one side.
  PRIMARY KEY (match_id, player_id)
);

CREATE INDEX match_players_player_idx ON public.match_players (player_id);
CREATE INDEX matches_session_event_idx ON public.matches (session_id, event_id);

-- ── 2. Access ───────────────────────────────────────────────────────────────
ALTER TABLE public.matches       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.match_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY matches_select_all       ON public.matches       FOR SELECT USING (true);
CREATE POLICY match_players_select_all ON public.match_players FOR SELECT USING (true);

-- No INSERT / UPDATE / DELETE policy exists, and the grants are revoked as
-- well: RLS with no write policy already denies writes, but a later policy
-- added in a hurry should not be able to open them by itself.
REVOKE ALL ON public.matches, public.match_players FROM anon, authenticated;
GRANT SELECT ON public.matches, public.match_players TO anon, authenticated;

-- ── 3. The only way to write ────────────────────────────────────────────────
-- Records (or re-records) the match for one result row. Returns the match id,
-- or NULL when there is nothing to record — the row is not a game result, or
-- no registered opponent was named — in which case any match previously
-- recorded for that row is removed, because the match mirrors the result.
CREATE OR REPLACE FUNCTION public.record_match(
  p_result_id    uuid,
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
  r          record;
  v_active   boolean;
  v_awarded  timestamptz;
  v_outcome  text;
  v_opp      uuid[];
  v_mates    uuid[];
  v_match    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_match: sign in to record a match' USING ERRCODE = '42501';
  END IF;

  SELECT res.id, res.session_id, res.event_id, res.player_id, res.result_type
    INTO r
  FROM results res
  WHERE res.id = p_result_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_match: unknown result %', p_result_id USING ERRCODE = 'P0002';
  END IF;

  -- A guest has no stable identity, so a guest's result cannot anchor a match.
  IF r.player_id IS NULL THEN
    RAISE EXCEPTION 'record_match: a guest result cannot be recorded as a match'
      USING ERRCODE = '22023';
  END IF;

  -- Same authority as writing the result itself (results_insert_own).
  IF NOT (
    r.player_id = v_uid
    OR EXISTS (SELECT 1 FROM players WHERE id = r.player_id AND parent_id = v_uid)
    OR v_judge
  ) THEN
    RAISE EXCEPTION 'record_match: that result belongs to someone else'
      USING ERRCODE = '42501';
  END IF;

  -- Same window as guard_results_write: an open session, unless kaiwhakawā.
  IF NOT v_judge THEN
    SELECT s.is_active, s.points_awarded_at INTO v_active, v_awarded
    FROM sessions s
    WHERE s.id = r.session_id;

    IF COALESCE(v_active, false) IS NOT TRUE OR v_awarded IS NOT NULL THEN
      RAISE EXCEPTION 'record_match: the session has ended — ask a kaiwhakawā'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- The outcome comes from the score, never from the caller.
  v_outcome := CASE r.result_type
    WHEN 'win'  THEN 'a'
    WHEN 'loss' THEN 'b'
    WHEN 'draw' THEN 'draw'
  END;

  -- Distinct, non-null, and never the result's own player.
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_opp
  FROM unnest(COALESCE(p_opponent_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> r.player_id;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_mates
  FROM unnest(COALESCE(p_teammate_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> r.player_id;

  IF v_opp && v_mates THEN
    RAISE EXCEPTION 'record_match: a player cannot be on both sides'
      USING ERRCODE = '22023';
  END IF;

  -- The match mirrors the result, so whatever was recorded for it goes first.
  -- If anything below raises, this DELETE is rolled back with it.
  DELETE FROM matches WHERE result_id = p_result_id;

  IF v_outcome IS NULL OR cardinality(v_opp) = 0 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_opp || v_mates) AS x
    WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = x)
  ) THEN
    RAISE EXCEPTION 'record_match: an opponent is not a registered player'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO matches (result_id, session_id, event_id, outcome, recorded_by)
  VALUES (p_result_id, r.session_id, r.event_id, v_outcome, v_uid)
  RETURNING id INTO v_match;

  INSERT INTO match_players (match_id, player_id, side)
  SELECT v_match, r.player_id, 'a'
  UNION ALL SELECT v_match, x, 'a' FROM unnest(v_mates) AS x
  UNION ALL SELECT v_match, x, 'b' FROM unnest(v_opp)   AS x;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.record_match(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_match(uuid, uuid[], uuid[]) TO authenticated;

COMMENT ON FUNCTION public.record_match(uuid, uuid[], uuid[]) IS
  'Records the head-to-head match behind one game result. The only write path '
  'into matches/match_players. Outcome is derived from the result row.';

-- ── 4. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.matches'::regclass) THEN
    RAISE EXCEPTION 'match recording: RLS is not enabled on matches';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.match_players'::regclass) THEN
    RAISE EXCEPTION 'match recording: RLS is not enabled on match_players';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'record_match' AND prosecdef
      AND 'search_path=public' = ANY (proconfig)
  ) THEN
    RAISE EXCEPTION 'match recording: record_match is missing, not SECURITY DEFINER, or has no pinned search_path';
  END IF;
END $$;

COMMIT;
