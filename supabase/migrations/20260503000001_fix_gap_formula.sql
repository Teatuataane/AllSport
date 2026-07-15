-- Fix gap formula in award_session_points trigger.
-- Old: gap := GREATEST(100.0 / player_count, 10)  — floored the gap at 10
-- New: gap := 100.0 / player_count                 — no floor; min earn of 10 still applies

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
  v_top_placement    INT;
BEGIN
  -- Guard: skip if points already awarded (void path)
  IF NEW.points_awarded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_player_count := (
    SELECT COUNT(DISTINCT player_id) FROM results
    WHERE session_id = NEW.id AND player_id IS NOT NULL
  );

  IF v_player_count = 0 THEN
    RETURN NEW;
  END IF;

  v_season_year   := EXTRACT(YEAR FROM NOW())::INT;
  v_gap           := 100.0 / v_player_count;
  v_top_placement := (
    SELECT MIN(placement) FROM results
    WHERE session_id = NEW.id AND player_id IS NOT NULL AND placement IS NOT NULL
  );

  -- Process each registered player in this session
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
    -- Placement points: 1st = 100, each step = gap, min 10
    v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

    -- Multiplier based on division and age
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
    v_bonus := 10; -- attendance always

    -- Personal best: check if any result in this session beats their previous best placement
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

    -- Top performance in session
    IF rec.placement = v_top_placement THEN
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

    -- Write points back to the result row
    UPDATE results
    SET points_earned = v_total_points
    WHERE session_id = NEW.id
      AND player_id = rec.player_id;

    -- Upsert rankings for this player + season
    INSERT INTO rankings (player_id, season_year, total_points, total_sessions, current_rank, division)
    VALUES (rec.player_id, v_season_year, v_total_points, 1, 0, rec.division)
    ON CONFLICT (player_id, season_year) DO UPDATE SET
      total_points   = rankings.total_points + EXCLUDED.total_points,
      total_sessions = rankings.total_sessions + 1,
      updated_at     = NOW();

  END LOOP;

  -- Mark session as points awarded (idempotency stamp)
  UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;

  RETURN NEW;
END;
$$;

-- Re-attach the trigger
DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();
