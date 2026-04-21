-- Family accounts: link child player profiles to a parent user account
ALTER TABLE players ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES players(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_players_parent_id ON players(parent_id);

-- RLS: parents can insert child profiles (parent_id = their own id)
CREATE POLICY "Players can insert child profiles" ON players
  FOR INSERT WITH CHECK (
    parent_id = auth.uid()
  );

-- RLS: parents can update their child profiles
CREATE POLICY "Parents can update child profiles" ON players
  FOR UPDATE USING (
    parent_id = auth.uid()
  );

-- RLS: parents can delete their child profiles
CREATE POLICY "Parents can delete child profiles" ON players
  FOR DELETE USING (
    parent_id = auth.uid()
  );

-- RLS: results — parents can submit scores for their child profiles
CREATE POLICY "Parents can submit scores for child profiles" ON results
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid()
    )
  );
