-- ─── What the leaderboard publishes ─────────────────────────────────────────
-- Decided with Tāne on 2026-09-25. /leaderboard ranks on SEASON POINTS (every
-- official event in every finished game this year scores the colour rung its
-- result reached) and shows each player's DOMAIN COLOURS (the colour the
-- standards give them in each domain) as their best and worst domain. Both
-- are computed by lib/leaderboardScores.ts, the same engine as the colours.
--
-- They are computed on the SERVER and stored here because strength rungs need
-- a player's declared bodyweight, which is private (player_bodyweights). The
-- page is public, so only the resulting numbers are published. Nothing here
-- reveals a bodyweight: a rung is a colour, not a kilogram.
--
-- Written ONLY by app/api/grades/recheck with the service key (and the
-- backfill script, scripts/refresh-leaderboard-scores.ts). No client write
-- policy exists and the write grants are revoked, so nobody can post their own
-- score. Public read, like grade_awards and results, which already expose the
-- facts these numbers are derived from.
--
-- Additive and idempotent. Either deploy order is safe: the page treats a
-- missing table (PGRST205) as "not live yet" and the route ignores a failed
-- write, so colours are never held up by it.

CREATE TABLE IF NOT EXISTS public.player_domain_colours (
  -- No ON DELETE, matching grade_awards: a player is anonymised on erasure,
  -- never deleted. The board hides inactive players.
  player_id    uuid PRIMARY KEY REFERENCES public.players(id),
  -- One rung per domain, in domain order.
  domain_rungs smallint[] NOT NULL CHECK (
    array_length(domain_rungs, 1) = 10
    AND 0 <= ALL (domain_rungs) AND 12 >= ALL (domain_rungs)
  ),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.player_season_points (
  player_id   uuid NOT NULL REFERENCES public.players(id),
  season_year int  NOT NULL CHECK (season_year BETWEEN 2024 AND 2100),
  -- A game is worth at most 120 (ten events at Taniwha); 100,000 is far past
  -- any real season and exists only to refuse garbage.
  points      int  NOT NULL CHECK (points BETWEEN 0 AND 100000),
  games       int  NOT NULL CHECK (games BETWEEN 0 AND 1000),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (player_id, season_year)
);

CREATE INDEX IF NOT EXISTS player_season_points_year_idx
  ON public.player_season_points (season_year, points DESC);

ALTER TABLE public.player_domain_colours ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_season_points ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS player_domain_colours_select_all ON public.player_domain_colours;
CREATE POLICY player_domain_colours_select_all ON public.player_domain_colours FOR SELECT USING (true);
DROP POLICY IF EXISTS player_season_points_select_all ON public.player_season_points;
CREATE POLICY player_season_points_select_all ON public.player_season_points FOR SELECT USING (true);

-- No write policy, and the grants revoked too: a policy added in a hurry later
-- should not be able to open writes by itself.
REVOKE ALL ON public.player_domain_colours FROM anon, authenticated;
REVOKE ALL ON public.player_season_points FROM anon, authenticated;
GRANT SELECT ON public.player_domain_colours TO anon, authenticated;
GRANT SELECT ON public.player_season_points TO anon, authenticated;

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.player_domain_colours'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.player_season_points'::regclass) THEN
    RAISE EXCEPTION 'leaderboard scores: RLS is not enabled';
  END IF;
  IF has_table_privilege('authenticated', 'public.player_domain_colours', 'INSERT')
     OR has_table_privilege('authenticated', 'public.player_season_points', 'INSERT')
     OR has_table_privilege('anon', 'public.player_domain_colours', 'UPDATE')
     OR has_table_privilege('anon', 'public.player_season_points', 'UPDATE') THEN
    RAISE EXCEPTION 'leaderboard scores: a client role can write';
  END IF;
END $$;
