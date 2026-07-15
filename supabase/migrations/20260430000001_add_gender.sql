-- Add gender column to players
-- Used to auto-calculate division on registration

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('Male', 'Female', 'Other'));
