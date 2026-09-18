-- ─── Retire points server-side ───────────────────────────────────────────────
-- Settled in a /grill-me with Tāne on 2026-09-18 (five decisions, recorded in
-- CLAUDE.md under "Points retired from the app"). Points left every page in
-- v0.9.0.0; this stops the database producing them.
--
--   1. VOID IS RECORDED, NOT INFERRED. Until now a voided game was recognised by
--      the ABSENCE of points: closed, stamped points_awarded_at, no row carrying
--      points_earned (lib/playerGrades.ts voidedSessionIds). Stop writing points
--      and every finished game fits that description, so the grading engine
--      would discard them all. sessions.voided_at / voided_by record it instead,
--      set by a trigger on the one update only Void performs, and backfilled
--      from the old rule while it is still true.
--   2. OLD POINTS ARE FROZEN, NOT DELETED. Future games leave the point
--      columns NULL; history stays readable (/privacy promises it is kept).
--   3. A CLOSING GAME DOES ONLY WHAT IS STILL READ: placements and the summary
--      row. No points_earned, no rankings, no refresh_rankings_rank(), and
--      trg_update_average_placement is dropped (its only job was rankings).
--   4. DEAD CODE: the rankings/totals keys leave leaderboard_page() and
--      player_dashboard(); claim_colour_award() is revoked from everyone. The
--      other two old-ladder functions stay, uncalled.
--   5. Voided games stay hidden and there is no un-void.
--
-- DEPLOY ORDER: CODE FIRST. The client reads voided_at in its own guarded query
-- and falls back to the legacy rule on 42703, so it is correct on both sides of
-- this migration. The reverse order is NOT safe: an old client reading a game
-- closed after this migration sees no points and calls it voided.
--
-- Body of award_session_points is the LIVE prosrc (read from pg_proc and
-- carried through 20260917021257) with Step 2 replaced. Placement logic in Step
-- 1 is untouched, byte for byte.

-- ── 1. Void, recorded ────────────────────────────────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS voided_at timestamptz,
  ADD COLUMN IF NOT EXISTS voided_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- The old rule, applied while it is still true (points are still on every
-- finished game at this point in the transaction).
UPDATE public.sessions s
SET voided_at = COALESCE(s.ended_at, s.points_awarded_at)
WHERE s.voided_at IS NULL
  AND NOT s.is_active
  AND s.points_awarded_at IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.results r WHERE r.session_id = s.id)
  AND NOT EXISTS (SELECT 1 FROM public.results r WHERE r.session_id = s.id AND r.points_earned IS NOT NULL);

-- Void is the ONLY update that closes a game and stamps points_awarded_at in the
-- same statement (app/components/JudgeCard.tsx handleVoidSession). End leaves
-- the stamp to the award trigger, which stamps it in a LATER update when the
-- game is already closed, and close_expired_sessions() never touches it. So
-- this marks exactly the voids, with no client change.
CREATE OR REPLACE FUNCTION public.mark_session_voided()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $fn$
BEGIN
  IF OLD.is_active AND NOT NEW.is_active
     AND OLD.points_awarded_at IS NULL AND NEW.points_awarded_at IS NOT NULL
     AND NEW.voided_at IS NULL THEN
    NEW.voided_at := NEW.points_awarded_at;
    NEW.voided_by := auth.uid();
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS session_void_recorded ON public.sessions;
CREATE TRIGGER session_void_recorded
  BEFORE UPDATE OF is_active, points_awarded_at ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.mark_session_voided();

-- ── 2. Point columns may be empty ────────────────────────────────────────────
ALTER TABLE public.session_player_summary
  ALTER COLUMN total_placement_points DROP NOT NULL,
  ALTER COLUMN total_placement_points DROP DEFAULT,
  ALTER COLUMN effort_points DROP NOT NULL,
  ALTER COLUMN effort_points DROP DEFAULT,
  ALTER COLUMN effort_level DROP NOT NULL,
  ALTER COLUMN effort_level DROP DEFAULT;

-- ── 3. A closing game: placements and the summary row, nothing else ─────────
CREATE OR REPLACE FUNCTION public.award_session_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
BEGIN
  -- Atomic claim: exactly one execution may pass this point per session.
  UPDATE sessions
  SET points_awarded_at = NOW()
  WHERE id = NEW.id AND points_awarded_at IS NULL;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM results
    WHERE session_id = NEW.id AND player_id IS NOT NULL AND raw_score IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- ── Step 1: per-division placement across ALL session events ───────────────
  WITH scored_players AS (
    SELECT DISTINCT r.player_id, p.division
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
  ),
  div_size AS (
    SELECT division, COUNT(*) AS n
    FROM scored_players
    GROUP BY division
  ),
  sess_events AS (
    SELECT id AS event_id
    FROM session_events
    WHERE session_id = NEW.id
  ),
  best_per_event AS (
    SELECT DISTINCT ON (r.player_id, r.event_id)
      r.player_id, r.event_id, r.raw_score
    FROM results r
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
    ORDER BY r.player_id, r.event_id, r.raw_score DESC
  ),
  grid AS (
    SELECT sp.player_id, sp.division, e.event_id, b.raw_score
    FROM scored_players sp
    CROSS JOIN sess_events e
    LEFT JOIN best_per_event b
      ON b.player_id = sp.player_id AND b.event_id = e.event_id
  ),
  event_div_ranks AS (
    SELECT
      g.player_id,
      g.division,
      g.event_id,
      CASE
        WHEN g.raw_score IS NULL THEN ds.n  -- missed event = last in division
        ELSE RANK() OVER (
          PARTITION BY g.event_id, g.division
          ORDER BY g.raw_score DESC NULLS LAST
        )
      END AS event_rank
    FROM grid g
    JOIN div_size ds ON ds.division = g.division
  ),
  player_event_totals AS (
    SELECT player_id, division, SUM(event_rank) AS total_placement
    FROM event_div_ranks
    GROUP BY player_id, division
  ),
  division_ranks AS (
    SELECT
      player_id,
      RANK() OVER (PARTITION BY division ORDER BY total_placement ASC) AS division_rank
    FROM player_event_totals
  )
  UPDATE results r
  SET placement = dr.division_rank
  FROM division_ranks dr
  WHERE r.player_id = dr.player_id
    AND r.session_id = NEW.id;

  -- ── Step 2: one summary row per player ─────────────────────────────────────
  -- Placement only. Points retired in September 2026 (20260918021529), so the
  -- point columns are left NULL: "not scored under points", never a real 0.
  -- The row itself stays because wins, play history, the referral count
  -- (trg_increment_referral_count fires on its INSERT) and the 10th/25th/50th
  -- milestones all read it. ON CONFLICT touches ONLY the placement, so a
  -- re-run can never wipe a historical row's points.
  INSERT INTO session_player_summary (
    session_id, player_id, overall_placement,
    total_placement_points, effort_points, effort_level
  )
  SELECT DISTINCT ON (r.player_id)
    NEW.id, r.player_id, r.placement, NULL, NULL, NULL
  FROM results r
  JOIN players p ON p.id = r.player_id
  WHERE r.session_id = NEW.id
    AND r.player_id IS NOT NULL
    AND r.placement IS NOT NULL
  ORDER BY r.player_id, r.placement ASC
  ON CONFLICT (session_id, player_id) DO UPDATE SET
    overall_placement = EXCLUDED.overall_placement;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_average_placement ON public.session_player_summary;

-- ── 4. Dead keys and a dead write path ───────────────────────────────────────
-- leaderboard_page: the rankings key and points_earned are gone. p_season is
-- kept, unused, so the signature (and the client call) does not change.
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
        'placement',     r.placement
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

-- Unchanged from 20260915054550, restated because the function was recreated.
revoke all on function public.leaderboard_page(int) from public;
grant execute on function public.leaderboard_page(int) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.player_dashboard(p_player_ids uuid[])
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  select jsonb_build_object(

    -- The play-history timeline, with the session joined so the client needs no
    -- second trip for date and venue.
    'summaries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'session_id',            sps.session_id,
        'player_id',             sps.player_id,
        'overall_placement',     sps.overall_placement,
        'total_placement_points', sps.total_placement_points,
        'effort_points',         sps.effort_points,
        'effort_level',          sps.effort_level,
        'session_date',          s.session_date,
        'location',              s.location,
        'is_championship',       s.is_championship
      ) order by s.session_date desc, sps.session_id)
      from session_player_summary sps
      join sessions s on s.id = sps.session_id
      where sps.player_id = any(p_player_ids)
    ), '[]'::jsonb),

    -- The colours era. Kept because those colours were really earned on real
    -- dates; rewriting them as taniwha limbs would fabricate history, and the
    -- numbers do not line up (Kahurangi was rung 7 at 5,000 points; 5,000 points
    -- is 5 limbs).
    'awards', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',       ca.player_id,
        'rung',            ca.rung,
        'colour_name',     ca.colour_name,
        'points_at_award', ca.points_at_award,
        'awarded_at',      ca.awarded_at,
        'session_date',    s.session_date,
        'location',        s.location
      ) order by ca.player_id, ca.rung desc)
      from colour_awards ca
      left join sessions s on s.id = ca.session_id
      where ca.player_id = any(p_player_ids)
    ), '[]'::jsonb),

    -- Headline counts the client would otherwise derive by pulling every result
    -- row for every household member. `games` counts distinct sessions with any
    -- result; `prs` counts is_pr rows. Games WON is not here on purpose — it needs
    -- the division-rank definition that `sessionWins` already owns in TypeScript,
    -- and duplicating that rule in SQL is how two rankings metrics start
    -- disagreeing.
    'counts', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id', c.player_id,
        'games',     c.games,
        'prs',       c.prs
      ) order by c.player_id)
      from (
        select r.player_id,
               count(distinct r.session_id) as games,
               count(*) filter (where r.is_pr) as prs
        from results r
        where r.player_id = any(p_player_ids)
        group by r.player_id
      ) c
    ), '[]'::jsonb)
  );
$function$;

REVOKE ALL ON FUNCTION public.claim_colour_award(uuid, uuid, int) FROM PUBLIC, anon, authenticated;

-- ── Closing checks — verify the objects, not the ledger ──────────────────────
DO $check$
DECLARE
  v_src text;
  v_disagree int;
BEGIN
  -- The recorded voids must agree with the legacy rule on every historical
  -- session, or the backfill missed or invented one.
  SELECT count(*) INTO v_disagree
  FROM public.sessions s
  WHERE NOT s.is_active
    AND EXISTS (SELECT 1 FROM public.results r WHERE r.session_id = s.id)
    AND (s.voided_at IS NOT NULL) <> (
      s.points_awarded_at IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM public.results r WHERE r.session_id = s.id AND r.points_earned IS NOT NULL));
  IF v_disagree <> 0 THEN
    RAISE EXCEPTION 'retire points: % sessions disagree between voided_at and the legacy void rule', v_disagree;
  END IF;

  SELECT prosrc INTO v_src FROM pg_proc WHERE oid = 'public.award_session_points()'::regprocedure;
  IF v_src ~* 'points_earned' OR v_src ~* 'insert\s+into\s+rankings' OR v_src ~* 'refresh_rankings_rank'
     OR v_src ~* 'perform\s+award_colour_rungs' OR v_src ~* 'perform\s+recompute_player_total' THEN
    RAISE EXCEPTION 'retire points: award_session_points still writes points';
  END IF;
  IF v_src NOT LIKE '%SET points_awarded_at = NOW()%'
     OR v_src NOT LIKE '%SET placement = dr.division_rank%'
     OR v_src NOT LIKE '%INSERT INTO session_player_summary%' THEN
    RAISE EXCEPTION 'retire points: a load-bearing write went missing from award_session_points';
  END IF;
  IF NOT (SELECT prosecdef FROM pg_proc WHERE oid = 'public.award_session_points()'::regprocedure) THEN
    RAISE EXCEPTION 'retire points: award_session_points lost SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'auto_award_points'
                 AND tgfoid = 'public.award_session_points()'::regprocedure) THEN
    RAISE EXCEPTION 'retire points: auto_award_points no longer calls award_session_points';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'session_void_recorded') THEN
    RAISE EXCEPTION 'retire points: the void trigger is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_average_placement') THEN
    RAISE EXCEPTION 'retire points: trg_update_average_placement still exists';
  END IF;
  IF (SELECT prosrc FROM pg_proc WHERE oid = 'public.leaderboard_page(integer)'::regprocedure) ~ 'rankings|points_earned'
     OR (SELECT prosrc FROM pg_proc WHERE oid = 'public.player_dashboard(uuid[])'::regprocedure) ~ 'from rankings|player_totals' THEN
    RAISE EXCEPTION 'retire points: a dashboard or leaderboard payload still reads points';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE oid = 'public.leaderboard_page(integer)'::regprocedure
                 AND provolatile = 'v' AND NOT prosecdef) THEN
    RAISE EXCEPTION 'retire points: leaderboard_page changed volatility or rights';
  END IF;
  IF NOT has_function_privilege('anon', 'public.leaderboard_page(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION 'retire points: anon lost leaderboard_page, and the public board with it';
  END IF;
  IF has_function_privilege('authenticated', 'public.claim_colour_award(uuid, uuid, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'retire points: claim_colour_award is still executable by authenticated';
  END IF;
END
$check$;
