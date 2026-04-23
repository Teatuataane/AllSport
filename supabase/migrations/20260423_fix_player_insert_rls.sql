-- Players can insert their own profile (id must match their auth.uid)
-- This was missing, causing Google OAuth users to get stuck in a registration loop.
DROP POLICY IF EXISTS "Players can insert own profile" ON players;
CREATE POLICY "Players can insert own profile" ON players
  FOR INSERT WITH CHECK (id = auth.uid());

-- Players can also update their own profile
DROP POLICY IF EXISTS "Players can update own profile" ON players;
CREATE POLICY "Players can update own profile" ON players
  FOR UPDATE USING (id = auth.uid());
