-- ─── Season points by place in the game ─────────────────────────────────────
-- Decided with Tāne on 2026-09-28. Season points used to be a player's colour
-- rungs summed across every game. Now everyone in a game is ranked TOGETHER,
-- whatever their division, on their colour total for that game (the ladder
-- already adjusts for age, sex and bodyweight), and places pay 100, 99, 98 …,
-- never below 1. Ties share the higher place (RANK()). The one-point gap is
-- deliberate: the board rewards turning up.
--
-- A player's points now depend on everyone else in their games, so they can
-- no longer be stored per player by that player's recheck. Instead the recheck
-- route publishes each player's colour total per game (player_game_colours)
-- and the season_points view ranks them. lib/leaderboardScores.ts
-- (seasonPointsFromGames) states the same rule, and
-- __tests__/leaderboardScores.test.ts pins this file to it.
--
-- Totals are computed on the server because strength rungs need the private
-- bodyweight; a total is a sum of colours, not a kilogram. Written only by the
-- recheck route and scripts/refresh-leaderboard-scores.ts with the service key.
--
-- player_season_points (20260924213359) is left in place and no longer
-- written. Drop it once the new board is confirmed live and no deployed
-- bundle reads it (only the page's fallback does).
--
-- DEPLOY ORDER: MIGRATION FIRST, then code, then the backfill STRAIGHT AFTER
-- (scripts/refresh-leaderboard-scores.ts --apply). Migration first, because
-- the old code never reads these objects, while new code before it would
-- fail every per-game write and still move the recheck watermark. The
-- backfill is REQUIRED, not optional: until every player has totals, a game
-- ranks only the players who have rows, and their places read too high.
--
-- ROLLBACK: DROP VIEW public.season_points; redeploy the previous code; run
-- the previous refresh-leaderboard-scores.ts --apply to bring
-- player_season_points up to date. The new table can stay.

CREATE TABLE IF NOT EXISTS public.player_game_colours (
  -- No ON DELETE, matching grade_awards: erasure anonymises, never deletes.
  player_id    uuid NOT NULL REFERENCES public.players(id),
  session_id   uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  -- Ten events at Taniwha (12) at most.
  colour_total smallint NOT NULL CHECK (colour_total BETWEEN 0 AND 120),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, session_id)
);

CREATE INDEX IF NOT EXISTS player_game_colours_session_idx
  ON public.player_game_colours (session_id, colour_total DESC);

ALTER TABLE public.player_game_colours ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_game_colours_select_all ON public.player_game_colours;
CREATE POLICY player_game_colours_select_all ON public.player_game_colours FOR SELECT USING (true);

REVOKE ALL ON public.player_game_colours FROM anon, authenticated;
GRANT SELECT ON public.player_game_colours TO anon, authenticated;

-- Invoker rights: both tables it reads are public, so nothing is widened.
-- Finished games only, and never a voided one, even if its totals were
-- written before the kaiwhakawā voided it.
-- DROP + CREATE, never CREATE OR REPLACE: a later change to a column's name,
-- order or type would abort the whole push (CLAUDE.md, Security posture 1),
-- so this file lands whatever shape it finds and stays the one definition.
DROP VIEW IF EXISTS public.season_points;
CREATE VIEW public.season_points WITH (security_invoker = on) AS
WITH placed AS (
  SELECT g.player_id,
         EXTRACT(YEAR FROM s.session_date)::int AS season_year,
         RANK() OVER (PARTITION BY g.session_id ORDER BY g.colour_total DESC) AS place
  FROM public.player_game_colours g
  JOIN public.sessions s ON s.id = g.session_id
  WHERE s.is_active = false AND s.voided_at IS NULL
)
SELECT player_id,
       season_year,
       SUM(GREATEST(101 - place, 1))::int AS points,
       COUNT(*)::int AS games
FROM placed
GROUP BY player_id, season_year;

REVOKE ALL ON public.season_points FROM anon, authenticated;
GRANT SELECT ON public.season_points TO anon, authenticated;

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.player_game_colours'::regclass) THEN
    RAISE EXCEPTION 'season points: RLS is not enabled';
  END IF;
  IF has_table_privilege('authenticated', 'public.player_game_colours', 'INSERT')
     OR has_table_privilege('anon', 'public.player_game_colours', 'UPDATE') THEN
    RAISE EXCEPTION 'season points: a client role can write';
  END IF;
END $$;
