-- Fix missing RLS policies for family member accounts
-- The v2 clean schema only added players_insert_own (id = auth.uid()).
-- Parents need to insert/update/delete child profiles, and submit scores/bonuses for them.

-- Players: parent can insert a child profile (parent_id = their auth uid)
CREATE POLICY "players_insert_child" ON players
  FOR INSERT WITH CHECK (parent_id = auth.uid());

-- Players: parent can update their child profiles
CREATE POLICY "players_update_child" ON players
  FOR UPDATE USING (parent_id = auth.uid());

-- Players: parent can delete their child profiles
CREATE POLICY "players_delete_child" ON players
  FOR DELETE USING (parent_id = auth.uid() OR id = auth.uid());

-- Results: allow parent to insert results for their children
DROP POLICY IF EXISTS "results_insert_own" ON results;
CREATE POLICY "results_insert_own" ON results
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      player_id = auth.uid()
      OR player_id IS NULL
      OR EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
    )
  );

-- Bonus completions: allow parent to insert for their children
DROP POLICY IF EXISTS "bonus_insert_own" ON bonus_completions;
CREATE POLICY "bonus_insert_own" ON bonus_completions
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
  );

-- Bonus completions: allow parent to delete for their children
DROP POLICY IF EXISTS "bonus_delete_own_judge" ON bonus_completions;
CREATE POLICY "bonus_delete_own_judge" ON bonus_completions
  FOR DELETE USING (
    player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
  );
