-- Fold close_expired_sessions() into leaderboard_page().
--
-- ⚠ DEPLOY ORDER: MIGRATION FIRST, THEN CODE.
--   Applying this alone is safe and is a NO-OP for behaviour: the deployed
--   client still calls close_expired_sessions() separately, and calling it
--   twice in a row is idempotent (the second pass matches no rows). Only once
--   this is applied may the client drop its own call. Reversed, /leaderboard
--   and /dashboard would stop healing expired sessions until pg_cron's next
--   five-minute sweep.
--
-- WHY
-- /leaderboard awaited close_expired_sessions() and THEN leaderboard_page(),
-- strictly sequentially, because the heal WRITES while leaderboard_page() was
-- STABLE, and because the payload has to observe the heal or it reports a
-- session that has just ended as still live.
--
-- Measured against production from the browser, three runs each:
--
--   sequential (what shipped)   298 ms avg
--   the two in parallel         237 ms avg
--   leaderboard_page alone      172 ms avg
--
-- Parallel recovers only 61 ms and the two requests visibly contend — 237 vs
-- 172 for the same payload — which is the same effect PERF_AGGREGATION_PLAN.md
-- recorded when it found one query costing 2764 ms in a crowd and 134 ms alone.
-- Fewer requests, not more concurrency, is the lever on this backend. Doing the
-- heal inside the function gets the whole page to ~172 ms and keeps the
-- ordering guarantee for free, because it now genuinely happens first.
--
-- WHAT CHANGES
--   - language sql -> plpgsql, so statement ORDER is guaranteed. A single SQL
--     SELECT gives no such guarantee about when a function in a subquery runs,
--     which is the whole point here.
--   - stable -> volatile, because it now writes. A STABLE function that calls a
--     writing one fails at runtime, so this is required, not stylistic.
--   - security invoker is UNCHANGED. close_expired_sessions() is SECURITY
--     DEFINER itself and is granted to anon and authenticated, so it still
--     elevates on its own and this adds no new privilege surface. Critically,
--     it derives expiry from started_at server-side, so a caller can still only
--     ask it to check, never choose the outcome.
--   - The payload body below is VERBATIM from 20260824233516. Nothing about the
--     shape the client reads has changed.
--
-- THE EXCEPTION BLOCK IS NOT DECORATION
-- The client did `await supabase.rpc('close_expired_sessions')` and never looked
-- at the error, so a failing heal has always been survivable — the board still
-- rendered. Folding the call in without a guard would silently upgrade that to
-- fatal: one failure inside the heal would abort the whole function and the
-- leaderboard would render EMPTY. The guard preserves the old tolerance. The
-- same reasoning is why 20260820000002 wraps its pg_cron scheduling.

create or replace function public.leaderboard_page(p_season int)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $fn$
declare
  v_payload jsonb;
begin
  -- Best effort, and deliberately so — see the note above. A session that fails
  -- to close here is picked up by pg_cron within five minutes; a leaderboard
  -- that fails to render is visible to everyone immediately.
  begin
    perform public.close_expired_sessions();
  exception when others then
    raise warning 'leaderboard_page: close_expired_sessions failed (%), serving payload anyway', sqlerrm;
  end;

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
  )
  into v_payload;

  return v_payload;
end;
$fn$;

-- Unchanged from 20260821000000, restated because the function was recreated.
revoke all on function public.leaderboard_page(int) from public;
grant execute on function public.leaderboard_page(int) to anon, authenticated;

-- ── Verification ────────────────────────────────────────────────────────────
-- `supabase migration list` is NOT evidence. Query the objects.
--
-- 1. It is now volatile and still invoker-rights:
--
--      select provolatile, prosecdef
--        from pg_proc where proname = 'leaderboard_page';
--      -- expect provolatile = 'v', prosecdef = false
--
-- 2. It still answers AS ANON, which is who actually loads this page.
--    postgres has BYPASSRLS, so running it as yourself proves nothing:
--
--      begin;
--      set local role anon;
--      select jsonb_array_length(public.leaderboard_page(2026) -> 'rankings') as rankings,
--             jsonb_array_length(public.leaderboard_page(2026) -> 'taniwha')  as taniwha_rows,
--             jsonb_array_length(public.leaderboard_page(2026) -> 'stats' -> 'players') as players;
--      rollback;
--    Expect the same counts as before this migration — 20 rankings, 27 players.
--
-- 3. The heal still runs. With an expired-but-open session present:
--
--      select id, is_active from sessions where is_active;
--      select public.leaderboard_page(2026) is not null;
--      select id, is_active, ended_at from sessions where id = '<that id>';
--      -- expect is_active = false and ended_at = started_at + 100 minutes
