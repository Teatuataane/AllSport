-- Allow authenticated users (judges + players with timer auto-close) to update sessions.
-- Without this policy, the End Session button and timer auto-close both fail with RLS errors.

DROP POLICY IF EXISTS "Authenticated users can update sessions" ON sessions;
CREATE POLICY "Authenticated users can update sessions" ON sessions
  FOR UPDATE USING (auth.role() = 'authenticated');
