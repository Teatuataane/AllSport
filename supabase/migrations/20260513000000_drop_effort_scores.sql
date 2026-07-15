-- May 2026: Drop effort_scores table (superseded by results-based effort tracking)
-- ─────────────────────────────────────────────────────────────────────────────
--
-- Context:
-- The effort_scores table was scaffolded in 20260503 to track effort point
-- submissions separately. This approach was replaced: effort tracking now uses
-- two columns on the existing results table (added in 20260512_effort_system.sql):
--   - results.is_pr            BOOLEAN  — whether this result is a season PR
--   - results.effort_task_completions INT — qualifying effort tasks completed per submission
--
-- Effort points at session close (award_session_points trigger):
--   effort_level = LEAST(participation + is_pr_events + sum(effort_task_completions), 20)
--   effort_pts   = effort_level * 5   →  max 100 pts (= 20 levels × 5 pts)
--
-- Score mode (Golf, Disc Golf):
--   inputMode 'score' requires no schema changes.
--   raw_score is stored as a negative integer (fewer strokes = higher raw_score = better rank).
--   score_label stores the human-readable string (e.g. "18 strokes (4 holes)").
--   Both columns already exist on results as NUMERIC and TEXT respectively.

-- Drop realtime publication entry first to avoid FK errors
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS effort_scores;

-- Drop RLS policies
DROP POLICY IF EXISTS "Players can insert own effort scores" ON effort_scores;
DROP POLICY IF EXISTS "Players can view effort scores in their sessions" ON effort_scores;

-- Drop the table
DROP TABLE IF EXISTS effort_scores;
