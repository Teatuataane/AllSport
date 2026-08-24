-- ════════════════════════════════════════════════════════════════════════════
-- 20260824220633 — Per-event placement, field size, and the win sheet
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY
-- The taniwha grading system (TANIWHA_SYSTEM_PLAN.md) releases a domain crown
-- when a player has WON 9 of the 12 events in that domain. Nothing in the
-- schema records who won an event: `results.placement` is the player's OVERALL
-- rank in their division for the whole session, and per-event placement has
-- only ever been computed on the fly, client side, by /games/[sessionId].
--
-- Computing it on the fly for the crown would mean loading every result of
-- every session on the dashboard, the leaderboard AND the live kaiwhakawā
-- alert. The app has already been through one performance pass
-- (PERF_AGGREGATION_PLAN.md) specifically to stop doing that, so this stores it.
--
-- This is roadmap item 9 ("per-event placement storage"), which the taniwha
-- work now pays for.
--
--
-- ⚠  event_placement IS NOT THE SAME KIND OF NUMBER AS results.placement
--
-- `results.placement`  = overall session rank, within the player's EXACT
--                        division (7 of them: Men's, Masters Men, …).
--                        Written by award_session_points().
-- `event_placement`    = rank in ONE event, within the player's UNIFIED POOL
--                        (3 of them: men / women / juniors — Masters and
--                        Grandmasters rank inside their gender pool).
--
-- The pools differ ON PURPOSE, for two reasons:
--   1. The exact divisions are tiny. A Masters Women field is routinely one
--      person, and a field of one is a free win. The unified pools are what
--      make the "at least 3 in the field" rule reachable at all.
--   2. lib/percentile.ts and the live leaderboard already rank on unified
--      pools, so a win here agrees with the "1st" a player sees on their
--      My Events card. Ranking wins by exact division would make those two
--      surfaces contradict each other.
--
-- A COMMENT ON COLUMN is attached below so this is visible in psql and in the
-- Supabase table editor, not only in this file.

-- ── 1. Columns ──────────────────────────────────────────────────────────────

ALTER TABLE results
  ADD COLUMN IF NOT EXISTS event_placement  INT,
  ADD COLUMN IF NOT EXISTS event_field_size INT;

COMMENT ON COLUMN results.event_placement IS
  'Rank in THIS event within the unified division pool (men/women/juniors), '
  'ties shared. NULL for guests, unscored rows, and players with no division. '
  'NOT the same pool as results.placement, which uses the exact division.';

COMMENT ON COLUMN results.event_field_size IS
  'How many players of the same unified pool scored this event in this session, '
  'including the player themselves. A win requires >= 3 (see player_domain_wins).';

-- ── 2. Unified pool, in SQL ─────────────────────────────────────────────────
-- Mirrors divisionPool() in lib/rating.ts EXACTLY, including the legacy
-- 'Youth' value, which is still treated as Juniors everywhere in the client.
-- If one of these ever changes, the other must change with it.

CREATE OR REPLACE FUNCTION public.division_pool(p_division TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT CASE p_division
    WHEN 'Men''s'            THEN 'men'
    WHEN 'Masters Men'       THEN 'men'
    WHEN 'Grandmaster Men'   THEN 'men'
    WHEN 'Women''s'          THEN 'women'
    WHEN 'Masters Women'     THEN 'women'
    WHEN 'Grandmaster Women' THEN 'women'
    WHEN 'Juniors'           THEN 'juniors'
    WHEN 'Youth'             THEN 'juniors'
    ELSE NULL
  END
$$;

-- ── 3. Compute one session ──────────────────────────────────────────────────
-- Idempotent: clears the session first, so re-running after a kaiwhakawā edits
-- or deletes a score produces the right answer rather than a stale one.
--
-- Mirrors the ranking that /games/[sessionId] already does client side:
--   rank = 1 + the number of pool players with a STRICTLY higher raw_score.
-- RANK() gives exactly that, and it shares placements on a tie, which is the
-- sport's own rule ("Ties: shared placement awarded").
--
-- raw_score DESC is uniformly "better" for every input mode — time, sprint,
-- timed-effort, score and grip-width are all encoded so a higher raw_score
-- wins — so one comparison is correct for all 120 events, with no per-mode
-- branching. See the difficulty+time encoding note in CLAUDE.md.
--
-- Deliberately excluded, all three per TANIWHA_SYSTEM_PLAN.md §7.3:
--   · guests (player_id IS NULL) — no player row, so no division to pool them
--     into. They neither win nor count toward the field.
--   · rows with no raw_score — a missed event is last place for the SESSION
--     total, but it is not a placement in the event.
--   · players whose division does not map to a pool (NULL, or an unknown
--     value). Same rule lib/percentile.ts already applies.

CREATE OR REPLACE FUNCTION public.compute_event_placements(p_session_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE results
  SET event_placement = NULL, event_field_size = NULL
  WHERE session_id = p_session_id
    AND (event_placement IS NOT NULL OR event_field_size IS NOT NULL);

  WITH scored AS (
    SELECT r.id,
           r.event_id,
           r.raw_score,
           public.division_pool(p.division) AS pool
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = p_session_id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
      AND public.division_pool(p.division) IS NOT NULL
  ),
  ranked AS (
    SELECT id,
           RANK()  OVER (PARTITION BY event_id, pool ORDER BY raw_score DESC) AS placement,
           COUNT(*) OVER (PARTITION BY event_id, pool)                        AS field_size
    FROM scored
  )
  UPDATE results r
  SET event_placement  = k.placement,
      event_field_size = k.field_size
  FROM ranked k
  WHERE r.id = k.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_event_placements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_event_placements(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.compute_event_placements(UUID) FROM authenticated;

-- ── 4. Fire it at session close ─────────────────────────────────────────────
-- A SEPARATE trigger rather than two more lines inside award_session_points().
-- That function has been rewritten by thirteen migrations and is the single
-- most incident-prone object in this schema (the ×2 double-award bug lived in
-- it for three months). Copying two hundred lines forward to add a PERFORM is
-- a worse risk than adding an independent trigger that can be verified on its
-- own.
--
-- The WHEN clause is IDENTICAL to auto_award_points'. Two consequences, both
-- intended:
--   · Postgres fires AFTER triggers in alphabetical name order, so
--     `auto_award_points` runs before `trg_event_placements`. They do not
--     interact — the award ranks on raw_score directly and never reads
--     event_placement.
--   · A VOIDED session stamps points_awarded_at BEFORE closing, so the WHEN
--     clause is false and NEITHER trigger fires. A voided session therefore
--     awards no points AND produces no event wins, which is correct: it did
--     not count.

CREATE OR REPLACE FUNCTION public.trg_compute_event_placements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.compute_event_placements(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_event_placements ON sessions;
CREATE TRIGGER trg_event_placements
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION public.trg_compute_event_placements();

-- ── 5. The columns are server-authoritative ─────────────────────────────────
--
-- ⚠  WITHOUT THIS, THE WHOLE FEATURE IS FORGEABLE.
--
-- guard_results_write() (20260813000001) preserves placement / placement_points
-- / points_earned / bonus_points_total from OLD on UPDATE and nulls them on
-- INSERT, because a player who can set them can mint permanent lifetime colour
-- points. event_placement is exactly the same class of value and worse in one
-- respect: a forged `event_placement = 1` becomes a taniwha crown, and crowns
-- are APPEND-ONLY and never revoked. A player could PATCH their own row in the
-- open session and buy a crown outright.
--
-- Recreated verbatim from 20260813000001 with the two new columns added to
-- both branches. Nothing else in it changed.
--
-- The column list is verified against the live table. A plpgsql trigger that
-- assigns a field the table does not have raises at RUNTIME, not at migration
-- time, and would break EVERY score submission on the first insert.

CREATE OR REPLACE FUNCTION public.guard_results_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active   BOOLEAN;
  v_awarded_at  TIMESTAMPTZ;
BEGIN
  -- service_role / server-side job. Every results write policy requires
  -- auth.uid() IS NOT NULL, so anon never reaches this.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- The server closing a session on a player's behalf. See part 8 for why this
  -- exists and why a client cannot set it. Without it, close_expired_sessions()
  -- aborts for every logged-in non-judge caller.
  IF current_setting('allsport.server_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Kaiwhakawā need post-session edit and delete (Judge Summary tab), and the
  -- award trigger runs under their JWT.
  IF public.is_judge() THEN
    RETURN NEW;
  END IF;

  SELECT s.is_active, s.points_awarded_at
    INTO v_is_active, v_awarded_at
  FROM sessions s
  WHERE s.id = NEW.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'results: unknown session %', NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_is_active, false) IS NOT TRUE THEN
    RAISE EXCEPTION
      'results: session % has ended — ask a kaiwhakawā to make the change',
      NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  IF v_awarded_at IS NOT NULL THEN
    RAISE EXCEPTION 'results: points already awarded for session %', NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.placement          := OLD.placement;
    NEW.placement_points   := OLD.placement_points;
    NEW.points_earned      := OLD.points_earned;
    NEW.bonus_points_total := OLD.bonus_points_total;
    NEW.event_placement    := OLD.event_placement;   -- NEW
    NEW.event_field_size   := OLD.event_field_size;  -- NEW
    NEW.player_id          := OLD.player_id;
    NEW.session_id         := OLD.session_id;
  ELSE
    NEW.placement          := NULL;
    NEW.placement_points   := NULL;
    NEW.points_earned      := NULL;
    NEW.bonus_points_total := 0;
    NEW.event_placement    := NULL;  -- NEW
    NEW.event_field_size   := NULL;  -- NEW
  END IF;

  NEW.effort_task_completions :=
    LEAST(GREATEST(COALESCE(NEW.effort_task_completions, 0), 0), 20);

  RETURN NEW;
END;
$$;

-- The trigger itself is unchanged and still bound to the function above.

-- ── 6. The win rule, defined ONCE ───────────────────────────────────────────
-- Both the /prs win sheet and the crown logic need to know which events a
-- player has won. Defining "a win" in TypeScript as well as in SQL is how the
-- six disagreeing copies of the colour ladder happened, so the field-size
-- threshold of 3 lives here and the client reads this view.
--
-- DISTINCT on event_name, not event_id: session_events holds one row per event
-- PER SESSION, so a player who has won the Deadlift in ten sessions has ten
-- event_ids and one event. Grouping by name is also what /prs,
-- lib/percentile.ts and the My Events card already do — and it is exactly why
-- a rename orphans history, so ANY future event rename must sweep this view
-- too (CLAUDE.md: "Renaming an event requires a session_events.event_name
-- backfill").
--
--
-- ⚠  THERE IS DELIBERATELY NO DOMAIN COLUMN HERE, AND NO player_domain_wins.
--
-- The obvious rollup — GROUP BY se.domain_number — is WRONG, and silently so.
-- `session_events.domain_number` records the domain as it was NUMBERED ON THE
-- DAY, and the numbering has changed twice:
--   · June 2026 renamed AND renumbered the domains together. Power was #5 and
--     is now #3; #5 is now Anaerobic Endurance. Every session_events row from
--     before that carries the old number, and 20260801000000 deliberately left
--     them alone ("rewriting names without numbers would leave rows
--     self-inconsistent").
--   · August 2026 (session 27) MOVED five events between domains: Headstand
--     and L-Sit Hold to Calisthenics, Toe Lift and Toe Squat to Anaerobic
--     Endurance, American Football to Speed.
-- So a win on a Power event in May 2026 would be counted toward Anaerobic
-- Endurance, and a Headstand win from July 2026 toward the wrong domain again.
-- A crown would be released for a domain the player never competed in.
--
-- The current domain of an event is a fact about lib/eventData.ts, not about
-- history, so the rollup belongs in the client, mapping event_name through the
-- current roster — which is precisely what /prs, lib/percentile.ts and the My
-- Events card already do. Putting an event-to-domain table in SQL as well
-- would just re-create the drift this comment exists to prevent.

CREATE OR REPLACE VIEW public.player_event_wins
WITH (security_invoker = on) AS
  SELECT r.player_id,
         se.event_name,
         COUNT(*) AS wins
  FROM results r
  JOIN session_events se ON se.id = r.event_id
  WHERE r.player_id IS NOT NULL
    AND r.event_placement = 1
    AND r.event_field_size >= 3
  GROUP BY r.player_id, se.event_name;

COMMENT ON VIEW public.player_event_wins IS
  'Events each player has won, and how many times. A win = 1st in the unified '
  'division pool with a field of at least 3. THE definition of a win — do not '
  'reimplement the >= 3 threshold in the client. Map event_name to a domain '
  'through lib/eventData.ts, NEVER through session_events.domain_number, which '
  'records the numbering of the day and was renumbered in June 2026.';

GRANT SELECT ON public.player_event_wins TO anon, authenticated;

-- Supports the view and the per-event "have I won this?" lookup on /prs.
-- Partial, so it indexes only winning rows, which are a small fraction.
CREATE INDEX IF NOT EXISTS results_wins_idx
  ON results (player_id, event_id)
  WHERE event_placement = 1 AND event_field_size >= 3;

-- ── 7. Backfill ─────────────────────────────────────────────────────────────
-- Every session that actually counted. The discriminator is the same pair of
-- truth sources recompute_player_total() uses: a session that closed normally
-- has session_player_summary rows, and one that closed before that table
-- existed (pre 20260514) has points_earned on its results. A VOIDED session
-- has neither, because the award trigger never ran for it — which is the only
-- way to tell a void from a normal close after the fact, since both end up
-- with is_active = false and points_awarded_at set.

DO $$
DECLARE
  s        RECORD;
  v_rows   INT;
  v_total  INT := 0;
  v_count  INT := 0;
BEGIN
  FOR s IN
    SELECT ss.id
    FROM sessions ss
    WHERE ss.is_active = false
      AND ss.points_awarded_at IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM session_player_summary sps WHERE sps.session_id = ss.id)
        OR EXISTS (SELECT 1 FROM results r
                    WHERE r.session_id = ss.id AND r.points_earned IS NOT NULL)
      )
    ORDER BY ss.session_date
  LOOP
    v_rows  := public.compute_event_placements(s.id);
    v_total := v_total + v_rows;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'event placements backfilled: % rows across % sessions', v_total, v_count;
END $$;

-- ── 8. SEPARATE BUG, FOUND WHILE BUILDING THIS. Safe to strip if unwanted ───
--
-- close_expired_sessions() ALREADY FAILS for any logged-in non-judge caller,
-- and has since 20260820000000. This migration does not cause it, but the new
-- trigger in part 4 writes to `results` on exactly the same path, so it would
-- inherit the fault.
--
-- The chain:
--   1. `close_expired_sessions()` is granted to anon AND authenticated, on
--      purpose, and is called from /leaderboard, /dashboard and the live
--      session timer.
--   2. It sets sessions.is_active = false, firing auto_award_points.
--   3. award_session_points() does `UPDATE results SET placement = …`
--      (20260802000000, in step 1 of the function).
--   4. That fires trg_guard_results_write. SECURITY DEFINER changes the ROLE
--      but not the JWT, so auth.uid() is still the caller.
--   5. The caller is not a kaiwhakawā, and the session is now closed with
--      points_awarded_at stamped, so the guard raises 42501 "session has
--      ended" and the ENTIRE transaction aborts. The session does not close
--      and nobody is awarded anything.
--
-- Why nobody noticed: /leaderboard is public, so an ANON visitor closes
-- sessions successfully (auth.uid() IS NULL is the guard's first exemption),
-- and pg_cron runs the same RPC every 5 minutes as a superuser with no JWT.
-- Between them the session still closes, just never because of the logged-in
-- player looking at it. The live session screen already logs
-- "close_expired_sessions failed" to the console when it happens
-- (app/scoring/[sessionId]/page.tsx).
--
-- The fix: a transaction-local flag that says "this write is the server
-- closing a session", which the guard honours. It cannot be set by a client —
-- PostgREST only populates GUCs under the `request.` prefix (request.jwt.claims,
-- request.headers, request.method, request.path) and exposes no way to call
-- set_config, so `allsport.server_write` is unreachable from the API.
--
-- Recreated verbatim from 20260820000000 with one added line.

CREATE OR REPLACE FUNCTION public.close_expired_sessions()
RETURNS TABLE (closed_session_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Marks every write in THIS transaction as server-originated. is_local =
  -- true, so it is discarded when the transaction ends and cannot leak into
  -- the next statement on a pooled connection.
  PERFORM set_config('allsport.server_write', 'on', true);

  RETURN QUERY
  UPDATE sessions s
     SET is_active = false,
         ended_at  = s.started_at + INTERVAL '100 minutes'
   WHERE s.is_active = true
     AND s.started_at IS NOT NULL
     AND NOW() >= s.started_at + INTERVAL '100 minutes'
  RETURNING s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_expired_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_sessions() TO anon, authenticated;

-- ── Verification ────────────────────────────────────────────────────────────
-- Run these AFTER pushing. `supabase migration list` is not evidence that a
-- migration ran; query the objects.
--
-- 1. The objects exist:
--      select proname from pg_proc
--       where proname in ('division_pool','compute_event_placements',
--                         'trg_compute_event_placements');   -- expect 3
--      select tgname from pg_trigger where tgname = 'trg_event_placements';
--
-- 2. Both triggers are on sessions, and only these two:
--      select tgname from pg_trigger
--       where tgrelid = 'sessions'::regclass and not tgisinternal;
--      -- expect auto_award_points AND trg_event_placements
--
-- 3. The backfill landed, and no guest or unscored row got a placement:
--      select count(*) from results where event_placement is not null;
--      select count(*) from results
--       where event_placement is not null
--         and (player_id is null or raw_score is null);        -- expect 0
--
-- 4. Ties really are shared (expect no gaps where there should be none, and
--    duplicated 1s where two players tied):
--      select event_id, event_placement, count(*)
--        from results where event_field_size >= 3
--       group by 1,2 having count(*) > 1 limit 5;
--
-- 5. THE ONE TO LOOK AT BEFORE DEPLOYING THE CLIENT — who is already close to
--    a crown, because these wins are retroactive and the first crowns could
--    land within days of the taniwha system shipping:
--      select p.display_name, count(*) as events_won
--        from player_event_wins w
--        join players_public p on p.id = w.player_id
--       group by p.display_name
--       order by events_won desc;
--    (per-domain needs the eventData mapping, so check it on /prs once the
--     client ships — see the warning in part 6)
--
-- 6. The part 8 fix, as a LOGGED-IN NON-JUDGE player (this is the case that
--    was failing). With a session past its 100 minutes:
--      select * from close_expired_sessions();
--    Expect a row back and no 42501. Then confirm it actually awarded:
--      select count(*) from session_player_summary where session_id = '<id>';
--
-- 7. Players excluded for having no mappable division (they can never earn a
--    win until this is fixed, so check the list is empty or expected):
--      select id, display_name, division from players
--       where public.division_pool(division) is null and is_guest is not true;
