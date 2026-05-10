-- Dashboard redesign: player icons, session_player_summary, top event RPC
-- Migration: 20260514

-- ── 1. Player icon (emoji placeholder) ───────────────────────────────────────
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS icon TEXT;

-- ── 2. Session player summary ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.session_player_summary (
  id                   UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  session_id           UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  player_id            UUID NOT NULL REFERENCES auth.users(id),
  overall_placement    INTEGER,
  total_placement_points INTEGER NOT NULL DEFAULT 0,
  effort_points        INTEGER NOT NULL DEFAULT 0,
  effort_level         INTEGER NOT NULL DEFAULT 0,
  UNIQUE(session_id, player_id)
);

ALTER TABLE public.session_player_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sps_select_own" ON public.session_player_summary
  FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "sps_select_judge" ON public.session_player_summary
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'judge')
  );

-- ── 3. Top event RPC ──────────────────────────────────────────────────────────
-- Returns the event where the player's best score ranks highest within their division
CREATE OR REPLACE FUNCTION public.get_player_top_event(p_player_id UUID, p_division TEXT)
RETURNS TABLE(event_name TEXT, player_rank BIGINT, total_players BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  WITH player_bests AS (
    SELECT r.player_id, se.event_name, MAX(r.raw_score) AS best_score
    FROM results r
    JOIN session_events se ON se.id = r.event_id
    JOIN players p ON p.id = r.player_id
    WHERE r.raw_score IS NOT NULL
      AND p.division = p_division
    GROUP BY r.player_id, se.event_name
  ),
  event_ranks AS (
    SELECT
      event_name,
      player_id,
      RANK() OVER (PARTITION BY event_name ORDER BY best_score DESC NULLS LAST) AS rnk,
      COUNT(*) OVER (PARTITION BY event_name) AS total
    FROM player_bests
  )
  SELECT event_name, rnk AS player_rank, total AS total_players
  FROM event_ranks
  WHERE player_id = p_player_id
  ORDER BY rnk ASC, total DESC
  LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_player_top_event(UUID, TEXT) TO authenticated;

-- ── 4. Update award_session_points to also write session_player_summary ───────
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
  IF NEW.points_awarded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM results
    WHERE session_id = NEW.id AND player_id IS NOT NULL AND raw_score IS NOT NULL
  ) THEN
    UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_season_year := EXTRACT(YEAR FROM NOW())::INT;

  -- Step 1: compute per-division session ranks using best score per player
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

  -- Step 2: award placement + effort points per player per division
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
      -- Placement points
      v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

      -- Session bonuses
      v_bonus := 10; -- attendance

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

      IF rec.placement = 1 THEN v_bonus := v_bonus + 10; END IF;

      SELECT NOT EXISTS (
        SELECT 1 FROM results
        WHERE player_id = rec.player_id AND session_id != NEW.id
      ) INTO v_is_first_session;
      IF v_is_first_session THEN v_bonus := v_bonus + 10; END IF;

      SELECT streak_active INTO v_has_streak FROM calculate_streak(rec.player_id);
      IF v_has_streak THEN v_bonus := v_bonus + 10; END IF;

      IF NEW.is_championship THEN v_bonus := v_bonus + 100; END IF;

      -- Effort points
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

      v_total_points := ROUND(v_placement_points + v_bonus + v_effort_pts);

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
        v_total_points, ROUND(v_placement_points + v_bonus), v_effort_pts,
        1, 0
      )
      ON CONFLICT (player_id, season_year, division) DO UPDATE SET
        total_points     = rankings.total_points     + EXCLUDED.total_points,
        placement_points = rankings.placement_points + EXCLUDED.placement_points,
        effort_points    = rankings.effort_points    + EXCLUDED.effort_points,
        total_sessions   = rankings.total_sessions   + 1,
        updated_at       = NOW();

      -- Write session summary for points history
      INSERT INTO session_player_summary (
        session_id, player_id, overall_placement,
        total_placement_points, effort_points, effort_level
      )
      VALUES (
        NEW.id, rec.player_id, rec.placement,
        ROUND(v_placement_points + v_bonus), v_effort_pts, v_effort_level
      )
      ON CONFLICT (session_id, player_id) DO UPDATE SET
        overall_placement      = EXCLUDED.overall_placement,
        total_placement_points = EXCLUDED.total_placement_points,
        effort_points          = EXCLUDED.effort_points,
        effort_level           = EXCLUDED.effort_level;

    END LOOP;
  END LOOP;

  UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;

  PERFORM refresh_rankings_rank(v_season_year);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();
