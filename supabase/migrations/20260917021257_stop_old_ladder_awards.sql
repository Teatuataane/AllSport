-- ─── Stop awarding the retired points-ladder colours ─────────────────────────
-- The twelve-colour grades went live on 2026-09-16 and are conferred by a
-- kaiwhakawā through confer_grade(). But award_session_points() still called
-- award_colour_rungs() and recompute_player_total() at every session close, so
-- the first game to close after the rebuild would have written NEW rows into
-- colour_awards (the retired points ladder) and moved player_totals. /history
-- shows colour_awards as "Earlier colours · points ladder", so a player would
-- have appeared to earn an old-ladder colour today.
--
-- Checked read-only against production before writing this: no session had
-- closed since 2026-09-16 and colour_awards held 0 rows awarded since then, so
-- nothing needs undoing.
--
-- DELIBERATELY NARROW. The body below is the LIVE production prosrc (read from
-- pg_proc, identical to 20260802000000 part 5) with only those two PERFORMs
-- removed. Everything else stays, because it is load-bearing:
--   * results.placement and session_player_summary.overall_placement feed game
--     wins, play history and the referral trigger;
--   * results.points_earned is how lib/playerGrades.ts voidedSessionIds() tells
--     a closed game from a voided one — stop writing it and every future game
--     reads as voided and stops counting toward colours;
--   * rankings and refresh_rankings_rank() are unread by the app but retiring
--     them is the separate points-retirement design (TODOS.md P1).
-- No SECURITY / search_path change, for the same reason: this function is the
-- most incident-prone object in the schema, so one change at a time.
--
-- colour_awards, player_totals and claim_colour_award() are left in place as
-- history. Nothing in the app calls claim_colour_award().

CREATE OR REPLACE FUNCTION public.award_session_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  div_rec            RECORD;
  rec                RECORD;
  v_div_player_count INT;
  v_gap              NUMERIC;
  v_season_year      INT;
  v_placement_points NUMERIC;
  v_effort_level     INT;
  v_effort_pts       INT;
  v_total_points     NUMERIC;
  v_participation    INT;
  v_pr_events        INT;
  v_task_completions INT;
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

  v_season_year := EXTRACT(YEAR FROM NOW())::INT;

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

  -- ── Step 2: award placement + effort points per player per division ─────────
  FOR div_rec IN
    SELECT DISTINCT p.division
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
  LOOP
    SELECT COUNT(DISTINCT r.player_id) INTO v_div_player_count
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
      AND p.division = div_rec.division;

    IF v_div_player_count = 0 THEN CONTINUE; END IF;

    v_gap := 100.0 / v_div_player_count;

    FOR rec IN
      SELECT DISTINCT ON (r.player_id)
        r.player_id,
        r.placement,
        p.division
      FROM results r
      JOIN players p ON p.id = r.player_id
      WHERE r.session_id = NEW.id
        AND r.player_id IS NOT NULL
        AND r.placement IS NOT NULL
        AND p.division = div_rec.division
      ORDER BY r.player_id, r.placement ASC
    LOOP
      v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

      SELECT COUNT(DISTINCT event_id) INTO v_participation
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id
        AND raw_score IS NOT NULL;

      SELECT COUNT(DISTINCT event_id) INTO v_pr_events
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id
        AND is_pr = true;

      SELECT COALESCE(SUM(effort_task_completions), 0) INTO v_task_completions
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id;

      v_effort_level := LEAST(v_participation + v_pr_events + v_task_completions, 20);
      v_effort_pts   := v_effort_level * 5;

      v_total_points := ROUND(v_placement_points + v_effort_pts);

      UPDATE results
      SET points_earned = v_total_points
      WHERE session_id = NEW.id AND player_id = rec.player_id;

      INSERT INTO rankings (
        player_id, season_year, division,
        total_points, placement_points, effort_points,
        total_sessions, current_rank
      )
      VALUES (
        rec.player_id, v_season_year, rec.division,
        v_total_points, ROUND(v_placement_points), v_effort_pts,
        1, 0
      )
      ON CONFLICT (player_id, season_year, division) DO UPDATE SET
        total_points     = rankings.total_points     + EXCLUDED.total_points,
        placement_points = rankings.placement_points + EXCLUDED.placement_points,
        effort_points    = rankings.effort_points    + EXCLUDED.effort_points,
        total_sessions   = rankings.total_sessions   + 1,
        updated_at       = NOW();

      INSERT INTO session_player_summary (
        session_id, player_id, overall_placement,
        total_placement_points, effort_points, effort_level
      )
      VALUES (
        NEW.id, rec.player_id, rec.placement,
        ROUND(v_placement_points), v_effort_pts, v_effort_level
      )
      ON CONFLICT (session_id, player_id) DO UPDATE SET
        overall_placement      = EXCLUDED.overall_placement,
        total_placement_points = EXCLUDED.total_placement_points,
        effort_points          = EXCLUDED.effort_points,
        effort_level           = EXCLUDED.effort_level;

      -- The points-ladder colour awards (the lifetime total recompute and the
      -- rung award) were removed here in 20260917021257. Colours are
      -- conferred by a kaiwhakawā against standards since 2026-09-16; the
      -- old ladder is history and must not grow.

    END LOOP;
  END LOOP;

  PERFORM refresh_rankings_rank(v_season_year);

  RETURN NEW;
END;
$$;

-- ── Closing checks — verify the object, not the ledger ──────────────────────
DO $check$
DECLARE
  v_src text;
  v_secdef boolean;
BEGIN
  SELECT prosrc, prosecdef INTO v_src, v_secdef
  FROM pg_proc WHERE oid = 'public.award_session_points()'::regprocedure;

  -- Match the CALLS, not the names: a comment naming them would pass a bare
  -- LIKE, which is exactly how the first dry run of this file failed.
  IF v_src ~* 'perform\s+award_colour_rungs' OR v_src ~* 'perform\s+recompute_player_total' THEN
    RAISE EXCEPTION 'stop old ladder: award_session_points still awards the points ladder';
  END IF;
  IF v_src NOT LIKE '%SET placement = dr.division_rank%'
     OR v_src NOT LIKE '%SET points_earned = v_total_points%'
     OR v_src NOT LIKE '%INSERT INTO session_player_summary%'
     OR v_src NOT LIKE '%SET points_awarded_at = NOW()%' THEN
    RAISE EXCEPTION 'stop old ladder: a load-bearing write went missing from award_session_points';
  END IF;
  IF NOT v_secdef THEN
    RAISE EXCEPTION 'stop old ladder: award_session_points lost SECURITY DEFINER';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'auto_award_points' AND tgfoid = 'public.award_session_points()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'stop old ladder: auto_award_points no longer calls award_session_points';
  END IF;
END
$check$;
