-- 20260707 — DR-4 leaderboard cleanup (July 2026 session 20)
-- Run ONCE in the Supabase SQL Editor. Statements are idempotent — safe to re-run.
--
--  1. AVERAGE PLACEMENT — rankings.average_placement was never populated, so the
--     "Avg place" column on /leaderboard showed "—" for every player. A new
--     trigger on session_player_summary keeps it as the season average of
--     overall_placement; a backfill fixes existing rows.
--  2. ORPHANED 'Youth' RANKINGS — Felix Bates has TWO 2026 rankings rows (one
--     'Youth' with 610 pts from before the division rename, one 'Juniors' with
--     260 pts) so he appears twice on /leaderboard. Merge Youth rows into the
--     player's Juniors row for the same season, then relabel any leftovers.
--     (Companion to 20260617_fix_youth_division.sql, which fixed players.division.)

-- ── Part 1: average placement ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_average_placement()
RETURNS TRIGGER AS $$
DECLARE
  v_year INT;
  v_avg  NUMERIC;
BEGIN
  SELECT EXTRACT(YEAR FROM s.session_date)::INT INTO v_year
  FROM sessions s WHERE s.id = NEW.session_id;
  IF v_year IS NULL THEN RETURN NEW; END IF;

  SELECT AVG(sps.overall_placement) INTO v_avg
  FROM session_player_summary sps
  JOIN sessions s ON s.id = sps.session_id
  WHERE sps.player_id = NEW.player_id
    AND EXTRACT(YEAR FROM s.session_date)::INT = v_year
    AND sps.overall_placement IS NOT NULL;

  -- If rankings.average_placement is INTEGER (schema created pre-migrations),
  -- the assignment drops the decimal — cosmetic only; /leaderboard renders either.
  UPDATE rankings
  SET average_placement = ROUND(v_avg, 1)
  WHERE player_id = NEW.player_id AND season_year = v_year;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AFTER trigger: award_session_points upserts the rankings row before it writes
-- session_player_summary, so the rankings row always exists by the time this fires.
DROP TRIGGER IF EXISTS trg_update_average_placement ON session_player_summary;
CREATE TRIGGER trg_update_average_placement
  AFTER INSERT OR UPDATE ON session_player_summary
  FOR EACH ROW EXECUTE FUNCTION update_average_placement();

-- Backfill existing rankings rows from the summaries already written
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

-- ── Part 2: orphaned 'Youth' rankings rows ───────────────────────────────────

-- Merge points + sessions into the player's existing 'Juniors' row (same season)
UPDATE rankings j
SET total_points   = j.total_points + y.total_points,
    total_sessions = j.total_sessions + y.total_sessions
FROM rankings y
WHERE j.division = 'Juniors' AND y.division = 'Youth'
  AND j.player_id = y.player_id AND j.season_year = y.season_year;

DELETE FROM rankings y
WHERE y.division = 'Youth'
  AND EXISTS (
    SELECT 1 FROM rankings j
    WHERE j.player_id = y.player_id AND j.season_year = y.season_year
      AND j.division = 'Juniors'
  );

-- Any Youth rows without a Juniors counterpart just get relabelled
UPDATE rankings SET division = 'Juniors' WHERE division = 'Youth';

-- Recompute current_rank now that rows have merged
SELECT refresh_rankings_rank(EXTRACT(YEAR FROM NOW())::INT);
