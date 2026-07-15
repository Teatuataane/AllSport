-- koha_donations: manually entered by judges, tracks donations per player
CREATE TABLE IF NOT EXISTS koha_donations (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  donated_at    DATE        NOT NULL DEFAULT CURRENT_DATE,
  player_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount_nzd    INTEGER     NOT NULL CHECK (amount_nzd > 0),
  notes         TEXT,
  recorded_by   UUID        REFERENCES auth.users(id)
);

ALTER TABLE koha_donations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "koha_donations_own_read" ON koha_donations
  FOR SELECT USING (player_id = auth.uid());

CREATE POLICY "koha_donations_judge_all" ON koha_donations
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
  );

-- RPC: search players by username for referral nomination
CREATE OR REPLACE FUNCTION search_players_by_username(p_query TEXT)
RETURNS TABLE(id UUID, display_name TEXT, username TEXT)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT p.id, p.display_name, p.username
  FROM players p
  WHERE p.username ILIKE '%' || p_query || '%'
    AND p.is_active = true
  ORDER BY p.username
  LIMIT 10;
$$;
