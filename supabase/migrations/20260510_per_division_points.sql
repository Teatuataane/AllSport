-- Per-division scoring: each division competes independently.
-- Gap and placement points are calculated per division, not across all players.
-- No scoring multipliers — all divisions earn points at face value.
-- Solo players in a division automatically win if they submit at least one score.
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

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
  v_total_points     NUMERIC;
  v_is_first_session BOOLEAN;
  v_has_streak       BOOLEAN;
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

  -- ── Step 1: compute per-division session ranks ─────────────────────────────
  -- For each event, rank players within their division by raw_score DESC.
  -- Sum per-event ranks per player → total_placement.
  -- Rank players within division by total_placement ASC → division_rank.
  -- Write division_rank back to results.placement for all rows of that player.

  WITH scored_players AS (
    SELECT DISTINCT r.player_id, p.division
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
  ),
  event_div_ranks AS (
    SELECT
      r.player_id,
      sp.division,
      RANK() OVER (
        PARTITION BY r.event_id, sp.division
        ORDER BY r.raw_score DESC NULLS LAST
      ) AS event_rank
    FROM results r
    JOIN scored_players sp ON sp.player_id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.raw_score IS NOT NULL
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

  -- ── Step 2: award points per division ─────────────────────────────────────

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

    -- Process each player in this division
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
      -- Placement points: 1st = 100, each rank lower = 100 - (gap × (rank-1)), min 10
      v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

      -- ── Bonuses ────────────────────────────────────────────────────────────
      v_bonus := 10; -- attendance

      -- Personal best: any event where this player's placement is better than
      -- their previous best in that event across all prior sessions
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
      IF rec.placement = 1 THEN
        v_bonus := v_bonus + 10;
      END IF;

      -- First session ever
      SELECT NOT EXISTS (
        SELECT 1 FROM results
        WHERE player_id = rec.player_id AND session_id != NEW.id
      ) INTO v_is_first_session;
      IF v_is_first_session THEN v_bonus := v_bonus + 10; END IF;

      -- Streak bonus (4 of last 5 sessions)
      SELECT streak_active INTO v_has_streak FROM calculate_streak(rec.player_id);
      IF v_has_streak THEN v_bonus := v_bonus + 10; END IF;

      -- Championship bonus
      IF NEW.is_championship THEN v_bonus := v_bonus + 100; END IF;

      v_total_points := ROUND(v_placement_points + v_bonus);

      -- Write points to all result rows for this player in this session
      UPDATE results
      SET points_earned = v_total_points
      WHERE session_id = NEW.id AND player_id = rec.player_id;

      -- Upsert season rankings
      INSERT INTO rankings (player_id, season_year, total_points, total_sessions, current_rank, division)
      VALUES (rec.player_id, v_season_year, v_total_points, 1, 0, rec.division)
      ON CONFLICT (player_id, season_year) DO UPDATE SET
        total_points   = rankings.total_points + EXCLUDED.total_points,
        total_sessions = rankings.total_sessions + 1,
        updated_at     = NOW();

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
