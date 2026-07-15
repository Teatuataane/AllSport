-- Effort System — May 2026
-- Changes:
-- 1. Remove unique constraint on results (allow multiple scores per player per event per session)
-- 2. Add is_pr + effort_task_completions to results (set by client at submission time)
-- 3. Add effort_points + placement_points to rankings (tracked separately)
-- 4. Rewrite award_session_points trigger:
--    a. Use BEST score per player per event for competitive ranking
--    b. Award effort points: participation + is_pr events + sum(effort_task_completions), cap at 20 levels × 5 pts

-- ── 1. Remove unique constraint ──────────────────────────────────────────────

ALTER TABLE results DROP CONSTRAINT IF EXISTS results_player_id_session_id_event_id_key;

-- ── 2. Add effort columns to results ─────────────────────────────────────────

ALTER TABLE results ADD COLUMN IF NOT EXISTS is_pr boolean NOT NULL DEFAULT false;
ALTER TABLE results ADD COLUMN IF NOT EXISTS effort_task_completions int NOT NULL DEFAULT 0;

-- ── 3. Add effort/placement tracking to rankings ─────────────────────────────

ALTER TABLE rankings ADD COLUMN IF NOT EXISTS effort_points int NOT NULL DEFAULT 0;
ALTER TABLE rankings ADD COLUMN IF NOT EXISTS placement_points int NOT NULL DEFAULT 0;

-- ── 4. Updated award_session_points trigger ───────────────────────────────────
-- Key changes vs previous version:
-- a. Competitive ranking uses BEST raw_score per player per event (not all rows)
-- b. Effort points calculation uses stored is_pr and effort_task_completions columns

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
  v_bonus            NUMERIC;
  v_effort_level     INT;
  v_effort_pts       INT;
  v_total_points     NUMERIC;
  v_is_first_session BOOLEAN;
  v_has_streak       BOOLEAN;
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
  -- With multiple results per player per event, we take the best (highest) raw_score.

  WITH scored_players AS (
    SELECT DISTINCT r.player_id, p.division
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
  ),
  best_per_event AS (
    -- One row per (player, event): best raw_score
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
    -- Players in this division who submitted at least one score
    SELECT COUNT(DISTINCT r.player_id) INTO v_div_player_count
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
      AND p.division = div_rec.division;

    IF v_div_player_count = 0 THEN CONTINUE; END IF;

    v_gap := GREATEST(100.0 / v_div_player_count, 10.0);

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
      -- ── Placement points ────────────────────────────────────────────────────
      v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

      -- ── Session bonuses ─────────────────────────────────────────────────────
      v_bonus := 10; -- attendance

      -- Personal best: improved on previous best placement for any event
      IF EXISTS (
        SELECT 1 FROM results r2
        WHERE r2.player_id = rec.player_id
          AND r2.session_id = NEW.id
          AND r2.event_id IS NOT NULL
          AND r2.placement IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM results r3
            WHERE r3.player_id = rec.player_id
              AND r3.event_id = r2.event_id
              AND r3.session_id != NEW.id
              AND r3.placement < r2.placement
          )
      ) THEN
        v_bonus := v_bonus + 10;
      END IF;

      -- Top performance: 1st in their division
      IF rec.placement = 1 THEN v_bonus := v_bonus + 10; END IF;

      -- First session ever
      SELECT NOT EXISTS (
        SELECT 1 FROM results
        WHERE player_id = rec.player_id AND session_id != NEW.id
      ) INTO v_is_first_session;
      IF v_is_first_session THEN v_bonus := v_bonus + 10; END IF;

      -- Consistency streak (4 of last 5 sessions)
      SELECT streak_active INTO v_has_streak FROM calculate_streak(rec.player_id);
      IF v_has_streak THEN v_bonus := v_bonus + 10; END IF;

      -- Championship bonus
      IF NEW.is_championship THEN v_bonus := v_bonus + 100; END IF;

      -- ── Effort points ───────────────────────────────────────────────────────
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

      v_total_points := ROUND(v_placement_points + v_bonus + v_effort_pts);

      -- Write points to all result rows for this player in this session
      UPDATE results
      SET points_earned = v_total_points
      WHERE session_id = NEW.id AND player_id = rec.player_id;

      -- Upsert season rankings, tracking placement and effort points separately
      INSERT INTO rankings (
        player_id, season_year, division,
        total_points, placement_points, effort_points,
        total_sessions, current_rank
      )
      VALUES (
        rec.player_id, v_season_year, rec.division,
        v_total_points, ROUND(v_placement_points + v_bonus), v_effort_pts,
        1, 0
      )
      ON CONFLICT (player_id, season_year, division) DO UPDATE SET
        total_points     = rankings.total_points     + EXCLUDED.total_points,
        placement_points = rankings.placement_points + EXCLUDED.placement_points,
        effort_points    = rankings.effort_points    + EXCLUDED.effort_points,
        total_sessions   = rankings.total_sessions   + 1,
        updated_at       = NOW();

    END LOOP;
  END LOOP;

  -- Stamp to prevent double-fire
  UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;

  -- Refresh overall ranks within each division for the season
  PERFORM refresh_rankings_rank(v_season_year);

  RETURN NEW;
END;
$$;

-- Re-attach trigger
DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();
