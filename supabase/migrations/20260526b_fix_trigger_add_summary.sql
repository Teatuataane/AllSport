-- Fix award_session_points trigger — May 2026 (b)
-- The 20260526 migration fixed the gap formula and removed bonuses, but accidentally
-- dropped the session_player_summary INSERT that was added in 20260514.
-- This migration restores it so points history appears on /dashboard.

CREATE OR REPLACE FUNCTION award_session_points()
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
  -- Guard: skip if points already awarded (void path)
  IF NEW.points_awarded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Nothing to process if no scored results
  IF NOT EXISTS (
    SELECT 1 FROM results
    WHERE session_id = NEW.id AND player_id IS NOT NULL AND raw_score IS NOT NULL
  ) THEN
    UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_season_year := EXTRACT(YEAR FROM NOW())::INT;

  -- ── Step 1: compute per-division session ranks using BEST score per player ──

  WITH scored_players AS (
    SELECT DISTINCT r.player_id, p.division
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
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
  event_div_ranks AS (
    SELECT
      bp.player_id,
      sp.division,
      RANK() OVER (
        PARTITION BY bp.event_id, sp.division
        ORDER BY bp.raw_score DESC NULLS LAST
      ) AS event_rank
    FROM best_per_event bp
    JOIN scored_players sp ON sp.player_id = bp.player_id
  ),
  player_totals AS (
    SELECT player_id, division, SUM(event_rank) AS total_placement
    FROM event_div_ranks
    GROUP BY player_id, division
  ),
  division_ranks AS (
    SELECT
      player_id,
      RANK() OVER (PARTITION BY division ORDER BY total_placement ASC) AS division_rank
    FROM player_totals
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
    -- Count players in this division who submitted at least one score
    SELECT COUNT(DISTINCT r.player_id) INTO v_div_player_count
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
      AND p.division = div_rec.division;

    IF v_div_player_count = 0 THEN CONTINUE; END IF;

    -- Gap formula: 100 ÷ players, NO floor on gap.
    -- Minimum 10 pts applies to the awarded points only (GREATEST below).
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
      -- ── Placement points ─────────────────────────────────────────────────────
      -- 1st always = 100. Each rank costs one gap. Floor at 10 on earned points.
      v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

      -- ── Effort points ────────────────────────────────────────────────────────
      -- Participation: distinct events with at least one scored result
      SELECT COUNT(DISTINCT event_id) INTO v_participation
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id
        AND raw_score IS NOT NULL;

      -- PR events: events where client flagged at least one result as is_pr
      SELECT COUNT(DISTINCT event_id) INTO v_pr_events
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id
        AND is_pr = true;

      -- Task completions: sum of effort_task_completions across all submissions
      SELECT COALESCE(SUM(effort_task_completions), 0) INTO v_task_completions
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id;

      -- Cap at 20 effort levels = 100 effort points max
      v_effort_level := LEAST(v_participation + v_pr_events + v_task_completions, 20);
      v_effort_pts   := v_effort_level * 5;

      -- Total = placement + effort (no bonuses)
      v_total_points := ROUND(v_placement_points + v_effort_pts);

      -- Write points to all result rows for this player in this session
      UPDATE results
      SET points_earned = v_total_points
      WHERE session_id = NEW.id AND player_id = rec.player_id;

      -- Upsert season rankings
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

      -- ── Write session summary for points history (dashboard) ─────────────────
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

    END LOOP;
  END LOOP;

  -- Stamp to prevent double-fire
  UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;

  -- Refresh overall ranks within each division for the season
  PERFORM refresh_rankings_rank(v_season_year);

  RETURN NEW;
END;
$$;

-- Re-attach trigger (no change to trigger definition — just ensuring it's in place)
DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();
