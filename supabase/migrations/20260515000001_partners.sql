-- Partners table and partner_id on sessions

CREATE TABLE IF NOT EXISTS partners (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  club_name     TEXT        NOT NULL,
  sport         TEXT,
  description   TEXT,
  website_url   TEXT,
  logo_url      TEXT,
  is_active     BOOLEAN     DEFAULT true,
  display_order INT         DEFAULT 0
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "partners_public_read" ON partners
  FOR SELECT USING (true);

CREATE POLICY "partners_judge_write" ON partners
  FOR ALL USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
  );

-- sessions.partner_id links a session to the club venue that hosted it
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
