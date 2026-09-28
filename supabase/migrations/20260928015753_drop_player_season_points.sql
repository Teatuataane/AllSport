-- ─── Drop player_season_points ───────────────────────────────────────────────
-- Season points became places in each game on 2026-09-28 (20260928011813):
-- the season_points view ranks player_game_colours, and the backfill filled
-- it the same day. player_season_points held the old rung sums, has not been
-- written since, and was read only by the page's fallback while the view was
-- missing. v0.22.1.0 removes that fallback.
--
-- No archive: its 27 rows were DERIVED numbers (each player's rung sum for
-- the season), recomputable from results by the v0.20.0.0
-- refresh-leaderboard-scores.ts. Nothing in the database depends on it
-- (checked 2026-09-28: no view, rule or function references it).
--
-- player_domain_colours (created in the same migration, 20260924213359) is
-- still live and is NOT touched here.
--
-- Deploy order: either. The view exists, so no deployed bundle reaches the
-- fallback that read this table.

DROP TABLE IF EXISTS public.player_season_points;

DO $$
BEGIN
  IF to_regclass('public.player_season_points') IS NOT NULL THEN
    RAISE EXCEPTION 'drop player_season_points: the table is still there';
  END IF;
  IF to_regclass('public.player_domain_colours') IS NULL
     OR to_regclass('public.season_points') IS NULL THEN
    RAISE EXCEPTION 'drop player_season_points: a live leaderboard object is missing';
  END IF;
END $$;
