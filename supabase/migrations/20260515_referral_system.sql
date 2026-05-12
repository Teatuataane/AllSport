-- Referral system: referral_code on players, referrals table, auto-triggers

-- 1. Add referral_code to players
ALTER TABLE players ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE;

-- 2. Backfill existing players with deterministic codes
UPDATE players
SET referral_code = UPPER(substring(md5(id::text), 1, 6))
WHERE referral_code IS NULL AND id IS NOT NULL;

-- 3. Auto-generate code for new players
CREATE OR REPLACE FUNCTION set_player_referral_code()
RETURNS TRIGGER AS $$
DECLARE
  v_code TEXT;
  v_attempts INT := 0;
BEGIN
  IF NEW.referral_code IS NULL THEN
    LOOP
      v_code := UPPER(substring(md5(NEW.id::text || v_attempts::text || extract(epoch from NOW())::text), 1, 6));
      BEGIN
        NEW.referral_code := v_code;
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        v_attempts := v_attempts + 1;
        IF v_attempts > 10 THEN RAISE; END IF;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_set_player_referral_code ON players;
CREATE TRIGGER trg_set_player_referral_code
  BEFORE INSERT ON players
  FOR EACH ROW EXECUTE FUNCTION set_player_referral_code();

-- 4. Referrals table
CREATE TABLE IF NOT EXISTS referrals (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  referrer_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_id    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_count  INT         DEFAULT 0 NOT NULL,
  qualified_at   TIMESTAMPTZ,
  UNIQUE(referred_id)
);

-- 5. RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referrals_read_own" ON referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referred_id = auth.uid());

CREATE POLICY "referrals_read_judge" ON referrals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
  );

CREATE POLICY "referrals_insert" ON referrals
  FOR INSERT WITH CHECK (true);

CREATE POLICY "referrals_update" ON referrals
  FOR UPDATE USING (true);

-- 6. Increment session count when session_player_summary row is inserted
CREATE OR REPLACE FUNCTION increment_referral_session_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE referrals
  SET
    session_count = session_count + 1,
    qualified_at  = CASE
      WHEN session_count + 1 >= 10 AND qualified_at IS NULL THEN NOW()
      ELSE qualified_at
    END
  WHERE referred_id = NEW.player_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_referral_count ON session_player_summary;
CREATE TRIGGER trg_increment_referral_count
  AFTER INSERT ON session_player_summary
  FOR EACH ROW EXECUTE FUNCTION increment_referral_session_count();

-- 7. Public RPC to look up referrer display name from a referral code (safe, no PII)
CREATE OR REPLACE FUNCTION get_referrer_by_code(p_code TEXT)
RETURNS TABLE(display_name TEXT, referrer_id UUID) AS $$
BEGIN
  RETURN QUERY
    SELECT
      COALESCE(p.display_name, p.username, p.full_name) AS display_name,
      p.id AS referrer_id
    FROM players p
    WHERE UPPER(p.referral_code) = UPPER(p_code)
      AND (p.is_active IS NULL OR p.is_active = true)
    LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
