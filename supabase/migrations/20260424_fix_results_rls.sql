-- Fix missing RLS policies that caused new users to see a blank scoring page
-- after joining a session via code.
--
-- Before this migration:
--   - results had INSERT but no SELECT or UPDATE → leaderboard always empty for
--     new users; score resubmission (upsert UPDATE) silently failed
--   - session_events had no policies → events list empty if RLS was on
--
-- Symptom: user enters session code, navigates to scoring page, sees nothing,
-- goes back to dashboard. Looks like "page refreshed, nothing happened."

-- ── results ─────────────────────────────────────────────────────────────────

ALTER TABLE results ENABLE ROW LEVEL SECURITY;

-- Public read so the leaderboard page (/leaderboard) works for logged-out visitors
-- and the scoring page works for all authenticated users.
DROP POLICY IF EXISTS "Public read results" ON results;
CREATE POLICY "Public read results" ON results
  FOR SELECT USING (true);

-- Players can update their own result rows (needed for upsert resubmission).
-- Without this, the second time a player submits a score for the same event
-- the upsert silently fails (INSERT is covered but UPDATE is not).
DROP POLICY IF EXISTS "Players can update own results" ON results;
CREATE POLICY "Players can update own results" ON results
  FOR UPDATE USING (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid()
    )
  );

-- ── session_events ───────────────────────────────────────────────────────────

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

-- Public read — session events need to be visible on the scoring page for all users.
DROP POLICY IF EXISTS "Public read session events" ON session_events;
CREATE POLICY "Public read session events" ON session_events
  FOR SELECT USING (true);

-- Only judges can insert session events (when creating a session).
DROP POLICY IF EXISTS "Judges can insert session events" ON session_events;
CREATE POLICY "Judges can insert session events" ON session_events
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM players
      WHERE id = auth.uid() AND role = 'judge'
    )
  );
