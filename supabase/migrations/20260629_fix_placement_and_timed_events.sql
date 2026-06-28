-- ════════════════════════════════════════════════════════════════════════════
-- 20260629 — Fix overall placement, points doubling, and timed-event ranking
-- ════════════════════════════════════════════════════════════════════════════
--
-- Run ONCE in the Supabase SQL Editor. This migration supersedes the (unapplied)
-- 20260526 / 20260526b trigger fixes — it is self-contained, so whatever version
-- of award_session_points currently lives in production is fully replaced.
--
-- Fixes:
--  1. OVERALL PLACEMENT — the old trigger only summed the ranks of events a player
--     actually scored, so playing 5 of 10 events gave a LOWER (better) total than
--     playing all 10. Now every scored player is ranked across EVERY session event;
--     a missed event = last place in the division (= number of players in that
--     division who played the session). Lowest total still wins.
--  2. POINTS DOUBLING — the season total is computed once as placement + effort
--     (not by summing points_earned, which is duplicated across every event row).
--  3. TIMED EVENTS (faster wins) — one-time re-encode of historical raw_score for
--     the 10 "faster is better" difficulty+time events so they rank by fastest time.
--
-- ── Part 1: one-time data re-encode for faster-wins timed events ──────────────
-- difficulty+time raw_score = tierIdx*10000 + within-tier term. For these events
-- the within-tier term flips from `seconds` (longer wins) to `10000 - seconds`
-- (faster wins). Applying the flip is its own inverse, so DO NOT run twice.

UPDATE results r
SET raw_score = (r.raw_score / 10000) * 10000 + (10000 - (r.raw_score % 10000))
FROM session_events se
WHERE r.event_id = se.id
  AND r.raw_score IS NOT NULL
  AND se.event_name IN (
    'Running', 'Cycling', 'Ski Erg', 'Row Erg', 'Weighted Carry',
    'Bronco', 'Walking', 'Burpee Broad Jump', 'Climbing', 'Repeat High Jump'
  );

-- ── Part 2: corrected award_session_points trigger ───────────────────────────

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

  -- ── Step 1: per-division placement across ALL session events ───────────────
  -- Every scored player is ranked on every event in the session. A player with
  -- no score for an event is ranked last in their division for that event
  -- (= number of players in the division who played the session). Total placement
  -- is the sum of those event ranks; lowest total = 1st in division.

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
      -- ── Placement points ─────────────────────────────────────────────────
      -- 1st always = 100. Each rank costs one gap. Floor at 10 on earned points.
      v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

      -- ── Effort points ────────────────────────────────────────────────────
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

      -- Total = placement + effort (no bonuses), computed ONCE per player
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

      -- ── Write session summary for points history (dashboard) ─────────────
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

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();
