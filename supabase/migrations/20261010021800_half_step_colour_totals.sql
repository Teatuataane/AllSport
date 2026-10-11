-- ─── Half steps in a game's colour total ────────────────────────────────────
-- Tāne, 10 Oct 2026: on a compound event (load and time, load and reps, load
-- and distance) an effort that lifts the LOAD of a higher colour but falls
-- short of its other key (reaching at least half of it) is worth half a
-- colour below that colour (halfStepCredit in lib/grading.ts). The credit
-- counts in a game's colour total, so a total can now end in .5 (47.5 of
-- 120). colour_total was a smallint and would refuse every such game.
--
-- numeric(4,1) holds 0.0 to 120.0 exactly; RANK() orders it the same way.
-- PostgREST returns it as a JSON number, so readers are unchanged.
--
-- The season_points view reads colour_total, and Postgres will not change the
-- type of a column a view depends on, so the view is dropped and recreated
-- around the ALTER. Its body is copied verbatim from 20260928011813, which
-- __tests__/leaderboardScores.test.ts pins to lib/leaderboardScores.ts.
--
-- DEPLOY ORDER: MIGRATION FIRST, then code, then the backfill
-- (scripts/refresh-leaderboard-scores.ts --apply). Migration first, because
-- the old code only ever writes whole numbers, which numeric accepts, while
-- the new code before it would fail every game total with a .5 in it.
--
-- ROLLBACK: redeploy the previous code, run the backfill so every total is
-- whole again, then run this file with smallint in place of numeric(4,1).

BEGIN;

DROP VIEW IF EXISTS public.season_points;

ALTER TABLE public.player_game_colours
  ALTER COLUMN colour_total TYPE numeric(4,1);

CREATE VIEW public.season_points WITH (security_invoker = on) AS
WITH placed AS (
  SELECT g.player_id,
         EXTRACT(YEAR FROM s.session_date)::int AS season_year,
         RANK() OVER (PARTITION BY g.session_id ORDER BY g.colour_total DESC) AS place
  FROM public.player_game_colours g
  JOIN public.sessions s ON s.id = g.session_id
  JOIN public.players_public p ON p.id = g.player_id
  WHERE s.is_active = false AND s.voided_at IS NULL
    AND p.is_active IS NOT FALSE AND p.is_guest IS NOT TRUE
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
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'player_game_colours'
        AND column_name = 'colour_total') <> 'numeric' THEN
    RAISE EXCEPTION 'half steps: colour_total is not numeric';
  END IF;
  -- The CHECK (colour_total BETWEEN 0 AND 120) survives the type change.
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conrelid = 'public.player_game_colours'::regclass AND contype = 'c') THEN
    RAISE EXCEPTION 'half steps: the 0 to 120 check is gone';
  END IF;
  IF NOT has_table_privilege('anon', 'public.season_points', 'SELECT') THEN
    RAISE EXCEPTION 'half steps: the public board cannot read the view';
  END IF;
END $$;

COMMIT;
