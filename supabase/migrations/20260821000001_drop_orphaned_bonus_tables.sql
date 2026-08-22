-- ════════════════════════════════════════════════════════════════════════════
-- 20260821000001 — archive and drop the orphaned bonus tables
-- ════════════════════════════════════════════════════════════════════════════
--
-- The bonus system was removed in May 2026 and replaced by the effort system
-- ("Bonus system removed — replaced entirely by effort system", CLAUDE.md).
-- `bonus_completions` and `bonus_sport_opponents` survived it. Neither is
-- referenced anywhere in app/, components/ or lib/ — verified by grep — and
-- nothing in the schema reads them: `award_session_points` has computed
-- placement + effort only since 20260526000000.
--
-- WHY NOW, BEYOND TIDINESS
-- `bso_insert_own` is `FOR INSERT WITH CHECK (true)`. No auth.uid() check at
-- all. It is the only write path in the schema with no identity condition
-- whatsoever, so on Supabase's default grants an unauthenticated caller can
-- write unbounded rows into a table nothing reads. That is junk data and
-- storage growth rather than a leak, but there is no reason to leave a
-- write-anything door on a dead feature.
--
-- ARCHIVED, NOT JUST DROPPED. `bonus_completions` holds SIX real rows from
-- 2026-05-05: two players, one session, 15 points each, with the opponent
-- names recorded in completion_data. That is history from a live game, not
-- test data. (An earlier note in TODOS.md said "1 leftover row" — that count
-- came from a probe run with limit=1 and was wrong. Corrected here and in
-- TODOS.md.)
--
-- Same archive pattern as 20260801000000 used for the Leg Extension rows, and
-- the same trap it documents:
--
--   CREATE TABLE ... AS SELECT does NOT inherit RLS from its source, and
--   anything in `public` is reachable through PostgREST.
--
-- So RLS is enabled explicitly with zero policies (denies all API access;
-- `service_role` still reads it via BYPASSRLS for a restore) and the grants
-- are revoked. Without those two lines the archive would republish player
-- history to anon — the exact thing this whole run of work closed.
--
-- DROP ORDER MATTERS. bonus_sport_opponents.bonus_completion_id REFERENCES
-- bonus_completions(id), so the child goes first. CASCADE is deliberately NOT
-- used: if some object nobody knew about depends on these, the migration
-- should fail loudly rather than silently drop it too.

-- ── 1. Archive ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bonus_completions_archive_20260821 AS
  SELECT * FROM bonus_completions;

CREATE TABLE IF NOT EXISTS bonus_sport_opponents_archive_20260821 AS
  SELECT * FROM bonus_sport_opponents;

ALTER TABLE bonus_completions_archive_20260821      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_sport_opponents_archive_20260821  ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON bonus_completions_archive_20260821     FROM anon, authenticated;
REVOKE ALL ON bonus_sport_opponents_archive_20260821 FROM anon, authenticated;

COMMENT ON TABLE bonus_completions_archive_20260821 IS
  'Frozen copy of bonus_completions before the table was dropped (2026-08-21). '
  'Six rows from the 2026-05-05 session, from the bonus system replaced by the '
  'effort system in May 2026. RLS on with NO policies: denies all API access, '
  'service_role reads it for a restore. Drop once nobody wants the history.';

COMMENT ON TABLE bonus_sport_opponents_archive_20260821 IS
  'Frozen copy of bonus_sport_opponents before the table was dropped '
  '(2026-08-21). Empty at archive time. Same RLS treatment as its sibling.';

-- ── 2. Drop, child first ────────────────────────────────────────────────────
DROP TABLE IF EXISTS bonus_sport_opponents;
DROP TABLE IF EXISTS bonus_completions;

-- ── Verification ────────────────────────────────────────────────────────────
-- Both must be gone from the API (404 / PGRST205, not an empty array):
--   curl "$URL/rest/v1/bonus_completions?select=*"     -H "apikey: $ANON_KEY"
--   curl "$URL/rest/v1/bonus_sport_opponents?select=*" -H "apikey: $ANON_KEY"
-- The archives must NOT be readable (401 / 42501, the same as the Leg
-- Extension archive):
--   curl "$URL/rest/v1/bonus_completions_archive_20260821?select=*" -H "apikey: $ANON_KEY"
-- And the six rows must have survived:
--   SELECT COUNT(*) FROM bonus_completions_archive_20260821;  -- expect 6
