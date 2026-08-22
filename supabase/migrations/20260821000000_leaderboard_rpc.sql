-- ─── Stage 1: collapse the leaderboard/dashboard request fan-out ─────────────
--
-- DEPLOY ORDER: RUN THIS MIGRATION FIRST, THEN SHIP THE CODE.
-- This migration is purely additive (two new functions, no schema or data
-- change), so applying it against the CURRENT deployed bundle is a no-op — the
-- old code never calls them. Reversed, the new bundle calls `leaderboard_page`
-- before it exists and /leaderboard renders an empty board while /dashboard
-- loses its My Events percentiles. This is the opposite of the session-27
-- roster rename, which had to go code-first; the rule is not universal, it
-- follows from which side tolerates the other being stale.
--
-- /leaderboard fired SEVEN concurrent PostgREST requests on mount and /dashboard
-- fired the same four-way stats block. Measurement showed per-request overhead
-- dominates and concurrent requests contend hard against this project: the same
-- `results` page cost ~2764ms as one of seven in flight and ~134ms running alone
-- (a 20x swing with identical SQL), and a 20-row `player_totals` read took
-- 2212ms. Network RTT is only ~52ms, so this is neither latency nor execution.
--
-- These functions therefore exist to reduce the NUMBER OF REQUESTS, not to make
-- any individual query faster. See PERF_AGGREGATION_PLAN.md.
--
-- Deliberately INVOKER rights (the default), NOT security definer. `results`,
-- `sessions`, `session_events`, `rankings` and `player_totals` all still carry
-- `SELECT USING (true)`, so invoker rights return exactly the rows the client
-- queries returned. Nothing becomes visible that was not visible before, and
-- RLS stays in force if a policy is ever tightened.
--
-- The roster is read from `players_public`, NOT `players`. The base table used
-- to be `SELECT USING (true)` as well, but 20260813000003 closed that (it was
-- exposing emails, phone numbers and dates of birth for 27 players, 8 of them
-- minors) and replaced it with self/family/judge. An anonymous visitor now gets
-- ZERO rows from `players`, and RLS returns no rows rather than an error — so a
-- SECURITY DEFINER function here would quietly re-open the hole that migration
-- closed, and an invoker one reading `players` would quietly empty the
-- leaderboard's names and percentile columns. `players_public` is the view
-- granted to anon for exactly this, and its `display_name` is already
-- COALESCE(display_name, username, full_name) with `show_full_name` respected.
--
-- Deliberately NOT aggregating yet. These return the same raw datasets the
-- client already loads, so `sessionWins` and `computePercentiles` keep running
-- unchanged in the browser. Moving the ranking maths into SQL is Stage 2 and is
-- gated on a parity check, because it can silently change what players see.

-- Shared full-history datasets: feeds computePercentiles + sessionWins on both
-- /leaderboard and /dashboard.
create or replace function public.stats_bundle()
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(
    'results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',  r.player_id,
        'session_id', r.session_id,
        'event_id',   r.event_id,
        'raw_score',  r.raw_score,
        'placement',  r.placement
      ) order by r.id)
      from results r
      where r.raw_score is not null
    ), '[]'::jsonb),
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',         se.id,
        'session_id', se.session_id,
        'event_name', se.event_name
      ) order by se.id)
      from session_events se
    ), '[]'::jsonb),
    'sessions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',           s.id,
        'session_date', s.session_date
      ) order by s.id)
      from sessions s
    ), '[]'::jsonb),
    'players', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',       p.id,
        'division', p.division
      ) order by p.id)
      from players_public p
    ), '[]'::jsonb)
  );
$$;

-- Everything /leaderboard needs, in one round trip.
--
-- `rankings.players` is emitted as a nested object so the existing client code
-- (`Array.isArray(r.players) ? r.players[0] : r.players`) keeps working against
-- what PostgREST's embedded-resource syntax used to return.
create or replace function public.leaderboard_page(p_season int)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  with active as (
    select s.* from sessions s where s.is_active limit 1
  )
  select jsonb_build_object(
    'rankings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',                rk.id,
        'player_id',         rk.player_id,
        'total_points',      rk.total_points,
        'total_sessions',    rk.total_sessions,
        'average_placement', rk.average_placement,
        'division',          rk.division,
        'players', case when p.id is null then null else jsonb_build_object(
          'display_name', p.display_name,
          'username',     p.username
        ) end
      ) order by rk.total_points desc)
      from rankings rk
      left join players_public p on p.id = rk.player_id
      where rk.season_year = p_season
    ), '[]'::jsonb),
    'colour_rungs', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',    pt.player_id,
        'highest_rung', pt.highest_rung
      ))
      from player_totals pt
    ), '[]'::jsonb),
    'active_session', (
      select jsonb_build_object(
        'id',               a.id,
        'session_date',     a.session_date,
        'started_at',       a.started_at,
        'location',         a.location,
        'is_championship',  a.is_championship
      ) from active a
    ),
    -- Rows behind the active-session leader chip. Empty when nothing is live.
    'active_session_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',     r.player_id,
        'player_name',   r.player_name,
        'placement',     r.placement,
        'points_earned', r.points_earned
      ))
      from results r
      where r.session_id = (select a.id from active a)
    ), '[]'::jsonb),
    'stats', public.stats_bundle()
  );
$$;

grant execute on function public.stats_bundle()          to anon, authenticated;
grant execute on function public.leaderboard_page(int)   to anon, authenticated;
