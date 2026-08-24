-- ════════════════════════════════════════════════════════════════════════════
-- 20260824233516 — Fold taniwha progression into leaderboard_page
-- ════════════════════════════════════════════════════════════════════════════
--
-- v0.6.0.0 shipped the taniwha column on /leaderboard as a SEPARATE query on
-- player_taniwha. That was deliberate — the column had to work before the
-- progression migrations were applied, and leaderboard_page() was already in
-- production — but it undid half of what the performance pass bought: the
-- 7-requests-into-1 collapse from 20260821000000 had quietly become 2.
--
-- Both progression migrations are applied and verified, so the separate query
-- is no longer earning anything.
--
-- Replaces the `colour_rungs` key with `taniwha`. The colour ladder is retired
-- and nothing reads highest_rung on this page any more.
--
-- `max(...) filter (where is_building)` rather than a join: a player has at
-- most one building row (enforced by the partial unique index
-- player_taniwha_one_building), so max() over that filter is exactly that row's
-- slug, and NULL when they have not chosen one. Aggregating avoids the row
-- multiplication a left join would cause against 11 rows per player.
--
-- STILL security invoker, and still reads players_public rather than players.
-- 20260813003 closed public read on players and revoked anon's grant, so a
-- definer function reading it here would work for postgres in the SQL editor
-- and return nothing to the visitors this page exists for.

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
    -- One row per player: how many taniwha they have crowned, and the slug of
    -- the one they are building. Folded in here in 20260824233516 — the client
    -- was fetching player_taniwha separately, which quietly turned the
    -- seven-requests-into-one collapse back into two.
    'taniwha', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',    t.player_id,
        'crowned',      t.crowned,
        'building',     t.building
      ))
      from (
        select pt.player_id,
               count(*) filter (where pt.crowned_at is not null) as crowned,
               max(pt.taniwha_slug) filter (where pt.is_building)  as building
        from player_taniwha pt
        group by pt.player_id
      ) t
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

-- ── Verification ────────────────────────────────────────────────────────────
-- As ANON, which is who actually loads this page. postgres has BYPASSRLS, so
-- running this as yourself in the SQL editor proves nothing:
--
--   begin;
--   set local role anon;
--   select jsonb_array_length(public.leaderboard_page(2026) -> 'taniwha') as taniwha_rows,
--          jsonb_array_length(public.leaderboard_page(2026) -> 'rankings') as rankings;
--   rollback;
--
-- Expect taniwha_rows to match the number of players with a player_taniwha row
-- (27 at the time of writing), and `colour_rungs` to be gone from the payload.
