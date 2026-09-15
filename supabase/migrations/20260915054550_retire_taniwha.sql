-- ════════════════════════════════════════════════════════════════════════════
-- 20260915054550 — Retire the taniwha
-- ════════════════════════════════════════════════════════════════════════════
--
-- The grading rebuild replaces the taniwha collection with twelve colours
-- earned against standards (Tāne: "Retire taniwha entirely, grades only"). The
-- app no longer reads or writes it; this removes the database half.
--
-- WHAT
--   1. Archives player_taniwha, with RLS on and grants revoked, then drops it.
--      The design record counted 29 rows, no crowns, 25 players on zero pieces
--      and only 2 who ever chose a taniwha: little to preserve, but a record is
--      kept rather than destroyed.
--   2. Drops the trigger that synced it at session close, and all six
--      functions: trg_sync_taniwha, sync_player_taniwha, choose_taniwha,
--      claim_taniwha_crown, taniwha_body_budget, taniwha_crown_capacity.
--   3. Redefines leaderboard_page(): the 'taniwha' key becomes 'grades', each
--      player's highest CONFERRED colour per domain from grade_awards, which is
--      public. Everything else is verbatim from 20260827211610, heal included.
--
-- KEPT, because none of it is taniwha: event_domains (the roster mirror),
-- results.event_placement / event_field_size and player_event_wins (/prs shows
-- wins and average placement from them), colour_awards (the colours era, on
-- /history) and player_totals.
--
-- ORDER: needs 20260915051927 (grade_awards) first, which timestamp order
-- guarantees. The closing checks of 20260910025855 and 20260915040534 call
-- taniwha_body_budget; both run before this, and the newer one returns early
-- once player_taniwha is gone.
--
-- DEPLOY ORDER: CODE FIRST, then this. The new code reads neither
-- player_taniwha nor the 'taniwha' key, and treats 'grades' as optional, so it
-- is safe against the old database. The old code is not safe against this one.
--
-- NOT VERIFIED AGAINST A DATABASE when written: Docker was not running. Apply
-- from `main`, then verify the objects (see the closing checks).
--
-- __tests__/retireTaniwha.test.ts pins this file.

-- ── 1. Archive, then drop ───────────────────────────────────────────────────
-- CREATE TABLE … AS SELECT does NOT inherit RLS, and anything in public is
-- reachable through PostgREST, so RLS is enabled with no policies.
-- Deliberately NOT `IF NOT EXISTS`: a pre-existing archive means a prior
-- partial apply, and silently skipping it while still dropping the table would
-- destroy rows with no copy.
CREATE TABLE public.player_taniwha_archive_20260915054550 AS
SELECT pt.*, now() AS archived_at FROM public.player_taniwha pt;
ALTER TABLE public.player_taniwha_archive_20260915054550 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_taniwha_archive_20260915054550 FROM anon, authenticated;

DROP TRIGGER IF EXISTS trg_taniwha_sync ON public.sessions;
DROP FUNCTION IF EXISTS public.trg_sync_taniwha();
DROP FUNCTION IF EXISTS public.claim_taniwha_crown(uuid, uuid);
DROP FUNCTION IF EXISTS public.choose_taniwha(int);
DROP FUNCTION IF EXISTS public.sync_player_taniwha(uuid, uuid);
DROP FUNCTION IF EXISTS public.taniwha_body_budget(int);
DROP FUNCTION IF EXISTS public.taniwha_crown_capacity(int);
DROP TABLE public.player_taniwha;

-- ── 2. The leaderboard reads conferred colours instead ──────────────────────
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
  -- Best effort, and deliberately so: see 20260827211610. A session that fails
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
    -- Each player's highest CONFERRED colour in each domain. Public, like the
    -- awards themselves. The client derives the overall colour (the lowest of
    -- the ten) so the rule lives in one place, lib/grading.ts.
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',     g.player_id,
        'domain_number', g.domain_number,
        'rung',          g.rung
      ))
      from (
        select ga.player_id, ga.domain_number, max(ga.rung) as rung
        from grade_awards ga
        group by ga.player_id, ga.domain_number
      ) g
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

-- ── 3. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
BEGIN
  IF to_regclass('public.player_taniwha') IS NOT NULL THEN
    RAISE EXCEPTION 'retire taniwha: player_taniwha still exists';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.player_taniwha_archive_20260915054550'::regclass) THEN
    RAISE EXCEPTION 'retire taniwha: RLS is not enabled on the archive';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_taniwha_sync') THEN
    RAISE EXCEPTION 'retire taniwha: trg_taniwha_sync still exists';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname IN (
      'trg_sync_taniwha', 'sync_player_taniwha', 'choose_taniwha',
      'claim_taniwha_crown', 'taniwha_body_budget', 'taniwha_crown_capacity')
  ) THEN
    RAISE EXCEPTION 'retire taniwha: a taniwha function still exists';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'leaderboard_page' AND provolatile = 'v' AND NOT prosecdef
      AND prosrc LIKE '%grade_awards%' AND prosrc NOT LIKE '%player_taniwha%'
  ) THEN
    RAISE EXCEPTION 'retire taniwha: leaderboard_page does not read grade_awards, or changed volatility or rights';
  END IF;
END $$;
