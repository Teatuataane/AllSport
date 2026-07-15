-- ════════════════════════════════════════════════════════════════════════════
-- 20260713 — Fix the ×2 session/points doubling (orphaned trigger) + data repair
-- ════════════════════════════════════════════════════════════════════════════
--
-- Run ONCE in the Supabase SQL Editor. Every statement is idempotent — safe to
-- re-run if it fails partway.
--
-- ROOT CAUSE: 20260429_v2_clean_schema.sql created a SECOND trigger on sessions
-- (`on_session_end`) with no WHEN condition, calling the same
-- award_session_points() function. Every later migration replaced the function
-- and re-created `auto_award_points` — but never dropped `on_session_end`.
-- Since late April both triggers have fired on every session close, so the
-- function ran twice per close: rankings.total_sessions +2 and season points
-- added twice. (results.points_earned and session_player_summary write with
-- idempotent upserts, so THOSE stayed correct — they are the truth source for
-- the repair below.) The internal points_awarded_at guard did not stop the
-- second trigger because both fire off the same UPDATE row image.
--
--  Part 0 — diagnostic (read-only; run alone first if you want to see the state)
--  Part 1 — drop the orphaned trigger
--  Part 2 — atomic claim guard inside award_session_points (double-fire proof)
--  Part 3 — rebuild 2026 rankings from session_player_summary (+ results
--            fallback for sessions closed before summaries existed)
--  Part 4 — refresh ranks and average placement

-- ── Part 0: diagnostic (read-only) ───────────────────────────────────────────
-- Expect to see BOTH auto_award_points AND on_session_end before the fix:
SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'sessions'::regclass AND NOT tgisinternal;

-- Per-player: current rankings vs what the summaries say (2026):
SELECT
  r.player_id,
  p.display_name,
  r.total_sessions            AS rankings_sessions,
  COALESCE(t.actual_sessions, 0) AS actual_sessions,
  r.total_points              AS rankings_points,
  COALESCE(t.actual_points, 0)   AS summary_points
FROM rankings r
JOIN players p ON p.id = r.player_id
LEFT JOIN (
  SELECT sps.player_id,
         COUNT(*) AS actual_sessions,
         SUM(sps.total_placement_points + sps.effort_points) AS actual_points
  FROM session_player_summary sps
  JOIN sessions s ON s.id = sps.session_id
  WHERE EXTRACT(YEAR FROM s.session_date)::INT = 2026
  GROUP BY sps.player_id
) t ON t.player_id = r.player_id
WHERE r.season_year = 2026
ORDER BY p.display_name;

-- ── Part 1: drop the orphaned duplicate trigger ──────────────────────────────

DROP TRIGGER IF EXISTS on_session_end ON sessions;

-- ── Part 2: award_session_points with an atomic claim guard ──────────────────
-- Identical maths to 20260629; the only change is the guard. The function now
-- CLAIMS the session by stamping points_awarded_at as its first action — any
-- second execution (duplicate trigger, concurrent close, manual re-fire) sees
-- the stamp and exits. The stamp UPDATE cannot re-fire auto_award_points
-- because by then OLD.is_active is already false.

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
  -- Atomic claim: exactly one execution may pass this point per session.
  UPDATE sessions
  SET points_awarded_at = NOW()
  WHERE id = NEW.id AND points_awarded_at IS NULL;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Nothing to process if no scored results (claim already stamped above)
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

    END LOOP;
  END LOOP;

  PERFORM refresh_rankings_rank(v_season_year);

  RETURN NEW;
END;
$$;

-- Re-attach the (single) trigger, unchanged
DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();

-- ── Part 3: rebuild 2026 rankings from the un-doubled truth sources ──────────
-- session_player_summary rows are idempotent upserts (correct even when the
-- trigger double-fired). Sessions closed before 20260514 (no summary rows)
-- fall back to results.points_earned, which repeats the per-session total on
-- every row for that player → take MAX per player per session.
-- 2025 rows (historic points) are untouched.

WITH contrib AS (
  -- Truth source 1: session summaries
  SELECT sps.player_id,
         sps.session_id,
         (sps.total_placement_points + sps.effort_points)::NUMERIC AS pts,
         sps.total_placement_points::NUMERIC                      AS ppts,
         sps.effort_points::NUMERIC                               AS epts
  FROM session_player_summary sps
  JOIN sessions s ON s.id = sps.session_id
  WHERE EXTRACT(YEAR FROM s.session_date)::INT = 2026

  UNION ALL

  -- Truth source 2: pre-summary sessions (results only)
  SELECT r.player_id,
         r.session_id,
         MAX(r.points_earned)::NUMERIC,
         MAX(r.points_earned)::NUMERIC,  -- effort split unknown pre-summary
         0
  FROM results r
  JOIN sessions s ON s.id = r.session_id
  WHERE EXTRACT(YEAR FROM s.session_date)::INT = 2026
    AND r.player_id IS NOT NULL
    AND r.points_earned IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM session_player_summary sps2
      WHERE sps2.session_id = r.session_id AND sps2.player_id = r.player_id
    )
  GROUP BY r.player_id, r.session_id
),
totals AS (
  SELECT player_id,
         COUNT(DISTINCT session_id) AS n_sessions,
         ROUND(SUM(pts))            AS total_pts,
         ROUND(SUM(ppts))           AS placement_pts,
         ROUND(SUM(epts))           AS effort_pts
  FROM contrib
  GROUP BY player_id
)
UPDATE rankings r
SET total_points     = t.total_pts,
    placement_points = t.placement_pts,
    effort_points    = t.effort_pts,
    total_sessions   = t.n_sessions,
    updated_at       = NOW()
FROM totals t, players p
WHERE r.player_id = t.player_id
  AND r.season_year = 2026
  AND p.id = r.player_id
  -- If a player has multiple 2026 rows (division change), write totals only to
  -- the row matching their current division; 'Youth' rows were merged by 20260707.
  AND (r.division = p.division
       OR NOT EXISTS (
         SELECT 1 FROM rankings r2
         WHERE r2.player_id = r.player_id AND r2.season_year = 2026
           AND r2.division = p.division
       ));

-- Zero any OTHER 2026 rows for players whose totals were just written elsewhere,
-- so no player is counted twice on /leaderboard.
UPDATE rankings r
SET total_points = 0, placement_points = 0, effort_points = 0,
    total_sessions = 0, updated_at = NOW()
FROM players p
WHERE r.season_year = 2026
  AND p.id = r.player_id
  AND r.division <> p.division
  AND EXISTS (
    SELECT 1 FROM rankings r2
    WHERE r2.player_id = r.player_id AND r2.season_year = 2026
      AND r2.division = p.division
  );

-- Any 2026 rankings row for a player with NO surviving contributions is an
-- artifact (e.g. every session voided) — zero the volume but keep the row
-- visible so it can be reviewed rather than silently deleted.
UPDATE rankings r
SET total_sessions = 0, updated_at = NOW()
WHERE r.season_year = 2026
  AND NOT EXISTS (
    SELECT 1 FROM session_player_summary sps
    JOIN sessions s ON s.id = sps.session_id
    WHERE sps.player_id = r.player_id
      AND EXTRACT(YEAR FROM s.session_date)::INT = 2026
  )
  AND NOT EXISTS (
    SELECT 1 FROM results res
    JOIN sessions s2 ON s2.id = res.session_id
    WHERE res.player_id = r.player_id
      AND res.points_earned IS NOT NULL
      AND EXTRACT(YEAR FROM s2.session_date)::INT = 2026
  );

-- ── Part 4: refresh ranks + average placement ────────────────────────────────

SELECT refresh_rankings_rank(2026);

UPDATE rankings r
SET average_placement = sub.avg_placement
FROM (
  SELECT sps.player_id,
         EXTRACT(YEAR FROM s.session_date)::INT AS season_year,
         ROUND(AVG(sps.overall_placement), 1)   AS avg_placement
  FROM session_player_summary sps
  JOIN sessions s ON s.id = sps.session_id
  WHERE sps.overall_placement IS NOT NULL
  GROUP BY sps.player_id, EXTRACT(YEAR FROM s.session_date)::INT
) sub
WHERE r.player_id = sub.player_id AND r.season_year = sub.season_year;

-- Re-run the Part 0 per-player diagnostic afterwards: rankings_sessions should
-- now equal actual_sessions (plus any pre-summary sessions) for every player.
