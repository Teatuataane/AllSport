-- Judge player management
-- Allows judges to add registered players to a session and create guest players.
--
-- Key changes:
-- 1. players.id FK to auth.users removed — guest players have any UUID, no auth account
-- 2. is_guest flag — distinguishes guest players from registered ones
-- 3. RLS updated — judges can insert players/results/bonuses for any player

-- ── 1. Remove auth.users FK from players.id ───────────────────────────────────
-- Registered players keep id = auth.uid() by construction (registration policy).
-- Guest players will use gen_random_uuid() — no auth account required.

ALTER TABLE players DROP CONSTRAINT IF EXISTS players_id_fkey;
ALTER TABLE players ALTER COLUMN id SET DEFAULT gen_random_uuid();

-- ── 2. Guest flag ─────────────────────────────────────────────────────────────

ALTER TABLE players ADD COLUMN IF NOT EXISTS is_guest BOOLEAN NOT NULL DEFAULT false;

-- ── 3. Judges can insert guest player records ─────────────────────────────────
-- Existing "players_insert_own" (id = auth.uid()) covers registered player self-creation.
-- This new policy covers judge-created guests (is_guest = true, any UUID id).

DROP POLICY IF EXISTS "judges_insert_guest" ON players;
CREATE POLICY "judges_insert_guest" ON players
  FOR INSERT WITH CHECK (
    is_guest = true
    AND EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
  );

-- ── 4. Judges can insert results for any player ───────────────────────────────
-- Previous policy only allowed own player_id, null player_id, or children.
-- Now judges bypass this restriction so they can submit on behalf of anyone.

DROP POLICY IF EXISTS "results_insert_own" ON results;
CREATE POLICY "results_insert_own" ON results
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      player_id = auth.uid()
      OR player_id IS NULL
      OR EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
      OR EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
    )
  );

-- ── 5. Judges can insert bonus completions for any player ─────────────────────

DROP POLICY IF EXISTS "bonus_insert_own" ON bonus_completions;
CREATE POLICY "bonus_insert_own" ON bonus_completions
  FOR INSERT WITH CHECK (
    player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
    OR EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
  );
