-- Fix award_session_points: compute placements dynamically from raw_scores
-- (previously relied on results.placement being pre-written, which never happened)
--
-- Also adds a public SELECT policy on sessions so dashboard history works.

-- ============================================================
-- 1. Sessions SELECT policy
-- ============================================================

DROP POLICY IF EXISTS "Public read sessions" ON sessions;
CREATE POLICY "Public read sessions" ON sessions
  FOR SELECT USING (true);

-- ============================================================
-- 2. Rewrite award_session_points
-- ============================================================

CREATE OR REPLACE FUNCTION award_session_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_player_count     INT;
  v_gap              NUMERIC;
  v_season_year      INT;
  rec                RECORD;
  v_placement_points NUMERIC;
  v_multiplier       NUMERIC;
  v_bonus            NUMERIC;
  v_total_points     NUMERIC;
  v_is_first_session BOOLEAN;
  v_has_streak       BOOLEAN;
BEGIN
  -- Step 1: compute per-player overall session rank from raw_scores.
  -- For each event, rank players by raw_score DESC (higher = better).
  -- Sum those per-event ranks → total_placement.
  -- Rank players by total_placement ASC → overall session rank (lowest sum wins).
  -- Write the session rank back to ALL result rows for this player so the
  -- trigger loop below can read it.

  WITH event_ranks AS (
    SELECT
      player_id,
      RANK() OVER (PARTITION BY event_id ORDER BY raw_score DESC NULLS LAST) AS event_rank
    FROM results
    WHERE session_id = NEW.id
      AND player_id IS NOT NULL
      AND raw_score IS NOT NULL
  ),
  player_totals AS (
    SELECT
      player_id,
      SUM(event_rank) AS total_placement
    FROM event_ranks
    GROUP BY player_id
  ),
  player_session_ranks AS (
    SELECT
      player_id,
      RANK() OVER (ORDER BY total_placement ASC) AS session_rank
    FROM player_totals
  )
  UPDATE results r
  SET placement = psr.session_rank
  FROM player_session_ranks psr
  WHERE r.player_id = psr.player_id
    AND r.session_id = NEW.id;

  -- Step 2: count players who submitted at least one score
  v_player_count := (
    SELECT COUNT(DISTINCT player_id)
    FROM results
    WHERE session_id = NEW.id AND player_id IS NOT NULL AND raw_score IS NOT NULL
  );

  IF v_player_count = 0 THEN
    RETURN NEW;
  END IF;

  v_season_year := EXTRACT(YEAR FROM NOW())::INT;
  v_gap         := GREATEST(100.0 / v_player_count, 10.0);

  -- Step 3: award points to each player
  FOR rec IN
    SELECT DISTINCT ON (r.player_id)
      r.player_id,
      r.placement,
      p.division,
      p.date_of_birth
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.placement IS NOT NULL
    ORDER BY r.player_id, r.placement ASC
  LOOP
    -- Placement points: 1st = 100, each subsequent step down = 100 - (gap × (rank-1)), min 10
    v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

    -- Division multiplier (check Masters Women before Open Women so ×1.4 isn't shadowed)
    v_multiplier := 1.0;
    IF rec.division = 'Juniors' THEN
      v_multiplier := 1.2;
    ELSIF rec.division = 'Women''s'
      AND rec.date_of_birth IS NOT NULL
      AND EXTRACT(YEAR FROM AGE(rec.date_of_birth)) >= 40 THEN
      v_multiplier := 1.4;  -- Masters Women
    ELSIF rec.division = 'Women''s' THEN
      v_multiplier := 1.2;  -- Open Women
    ELSIF rec.division = 'Men''s'
      AND rec.date_of_birth IS NOT NULL
      AND EXTRACT(YEAR FROM AGE(rec.date_of_birth)) >= 40 THEN
      v_multiplier := 1.2;  -- Masters Men
    END IF;

    -- Bonus points
    v_bonus := 10; -- attendance

    -- Personal best: any event in this session where this player's placement is
    -- better than their previous best in that event across all prior sessions
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

    -- Top performance (1st place overall)
    IF rec.placement = 1 THEN
      v_bonus := v_bonus + 10;
    END IF;

    -- First session ever
    SELECT NOT EXISTS (
      SELECT 1 FROM results
      WHERE player_id = rec.player_id
        AND session_id != NEW.id
    ) INTO v_is_first_session;
    IF v_is_first_session THEN
      v_bonus := v_bonus + 10;
    END IF;

    -- Streak bonus (4 of last 5 sessions)
    SELECT streak_active INTO v_has_streak
    FROM calculate_streak(rec.player_id);
    IF v_has_streak THEN
      v_bonus := v_bonus + 10;
    END IF;

    -- Championship bonus
    IF NEW.is_championship THEN
      v_bonus := v_bonus + 100;
    END IF;

    v_total_points := ROUND((v_placement_points * v_multiplier) + v_bonus);

    -- Write points back to all result rows for this player in this session
    UPDATE results
    SET points_earned = v_total_points
    WHERE session_id = NEW.id
      AND player_id = rec.player_id;

    -- Upsert season rankings
    INSERT INTO rankings (player_id, season_year, total_points, total_sessions, current_rank, division)
    VALUES (rec.player_id, v_season_year, v_total_points, 1, 0, rec.division)
    ON CONFLICT (player_id, season_year) DO UPDATE SET
      total_points   = rankings.total_points + EXCLUDED.total_points,
      total_sessions = rankings.total_sessions + 1,
      updated_at     = NOW();

  END LOOP;

  -- Stamp to prevent double-fire
  UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;

  -- Refresh ranks within each division
  PERFORM refresh_rankings_rank(v_season_year);

  RETURN NEW;
END;
$$;

-- Re-attach trigger (DROP + CREATE to ensure clean state)
DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();
