-- ─── player_dashboard(): the whole household in one round trip ───────────────
--
-- Stage 2 of the fan-out collapse begun by 20260821000000. That migration's
-- header measured the problem and it has not changed: per-request overhead
-- dominates and concurrent requests contend hard against this project — the same
-- `results` page cost ~2764ms as one of seven in flight and ~134ms running alone,
-- and a 20-row `player_totals` read took 2212ms. Network RTT is ~52ms, so this is
-- neither latency nor execution.
--
-- The redesigned dashboard adds a player switcher for family accounts. Without
-- this function, every tap on a child's chip re-fires the same four-way block for
-- a different player_id, which measurement says is seconds, not milliseconds. With
-- it, the page loads the parent AND every child at once and switching is pure
-- React state.
--
-- DEPLOY ORDER: MIGRATION FIRST, THEN CODE. Purely additive — one new function,
-- no schema or data change — so applying it against the currently deployed bundle
-- is a no-op, because nothing calls it yet. Reversed, the new bundle calls a
-- function that does not exist and the dashboard renders empty.
--
-- ⚠ TANIWHA DATA IS DELIBERATELY ABSENT FROM THIS FUNCTION.
--
-- `player_taniwha` and `player_event_wins` ship in 20260824220633 +
-- 20260824222612, which are written and NOT yet applied. A missing TABLE returns
-- PGRST205 in `error` and the caller can fall back; a missing COLUMN returns 42703
-- and takes the WHOLE query down. Folding either into this bundle would mean that
-- until those two land, one absent table empties the entire dashboard rather than
-- just the taniwha card. The client keeps them as their own two queries, exactly
-- as components/TaniwhaCard.tsx already does. Do not "tidy" them in here later:
-- the isolation is the point, not an oversight.
--
-- Deliberately INVOKER rights (the default), NOT security definer. Every table
-- read below still carries its own RLS, so this returns exactly the rows the
-- caller's own queries returned:
--
--   player_totals            public read
--   rankings                 public read
--   session_player_summary   own rows, or judge
--   colour_awards            own + parent (family) + judge
--   results                  public read
--
-- session_player_summary and colour_awards are the reason p_player_ids is an
-- ARRAY rather than this function deciding the household itself: a parent passing
-- their child's id gets rows because the child's RLS policy already grants the
-- parent access, and anyone passing a stranger's id gets an empty array from the
-- policy rather than a leak from us. The function never needs to know who is
-- related to whom, so it cannot get that judgement wrong.

create or replace function public.player_dashboard(p_player_ids uuid[])
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select jsonb_build_object(

    -- Lifetime points and highest rung. Drives the taniwha card's point figures
    -- (and the colour fallback until the taniwha migrations land).
    'totals', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',       pt.player_id,
        'earned_points',   pt.earned_points,
        'lifetime_points', pt.lifetime_points,
        'lifetime_sessions', pt.lifetime_sessions,
        'highest_rung',    pt.highest_rung
      ) order by pt.player_id)
      from player_totals pt
      where pt.player_id = any(p_player_ids)
    ), '[]'::jsonb),

    -- Current-season division rank only. `rankings` is still seasonal on purpose:
    -- /leaderboard resets each January, the taniwha do not.
    'rankings', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',      r.player_id,
        'division',       r.division,
        'total_points',   r.total_points,
        'total_sessions', r.total_sessions,
        'current_rank',   r.current_rank,
        'average_placement', r.average_placement,
        'season_year',    r.season_year
      ) order by r.player_id)
      from rankings r
      where r.player_id = any(p_player_ids)
        and r.season_year = extract(year from (now() at time zone 'Pacific/Auckland'))::int
    ), '[]'::jsonb),

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
$$;

comment on function public.player_dashboard(uuid[]) is
  'One round trip for the dashboard: totals, current-season rankings, session summaries, colour awards and headline counts for a whole household. INVOKER rights — RLS decides which players the caller may see. Taniwha data is deliberately excluded; see the header of 20260826004819.';

grant execute on function public.player_dashboard(uuid[]) to anon, authenticated;
