-- ════════════════════════════════════════════════════════════════════════════
-- 20260813000003 — Close public read on players (live PII exposure)
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  DO NOT RUN THIS UNTIL THE CLIENT READS players_public.
--
-- This is the one migration in the set that breaks the app if it lands first.
-- Ship the code, confirm /leaderboard and /games still render names, then push
-- this. Reversed, the leaderboard silently empties: RLS returns zero rows
-- rather than an error, so it fails quiet, which is the worst kind.
--
-- Required client changes (all reads of ANOTHER player's row):
--   app/leaderboard/page.tsx:300            players -> players_public
--   app/dashboard/page.tsx:278              players -> players_public
--   app/games/[sessionId]/page.tsx:72       players -> players_public
--   app/scoring/[sessionId]/page.tsx:2174   players -> players_public
--   app/scoring/[sessionId]/page.tsx:2163   players -> players_public, and
--                                           select age_years/age_group instead
--                                           of date_of_birth (getAge/getAgeGroup
--                                           then read the column directly)
--   app/my-koha/page.tsx:101, :113          players -> players_public
--
-- Deliberately NOT changed (they stay on the base table and keep working):
--   app/dashboard/page.tsx:131, app/profile/page.tsx:61,
--   app/scoring/[sessionId]/page.tsx:2137, app/events/[slug]/page.tsx:42,
--   app/judge/page.tsx:22, app/vote/[voteId]/results/page.tsx:93
--       -> own row, `id = auth.uid()`
--   app/dashboard/page.tsx:132, app/profile/page.tsx:62
--       -> children, `parent_id = auth.uid()`
--   app/components/JudgeCard.tsx:454
--       -> judge-only screen, covered by the judge branch
--
-- THE HOLE BEING CLOSED
-- `players_select_all ON players FOR SELECT USING (true)` from the April 2026
-- clean schema, plus a second permissive policy granting the whole table to any
-- logged-in user. Verified against production with nothing but the public anon
-- key and no account: HTTP 200, 27 rows, 19 email addresses, 9 phone numbers,
-- 27 dates of birth, 25 legal names, and one minor's parent name, email and
-- phone. Eight of the 27 players are under 18.
--
-- For a charity working with rangatahi that is a Privacy Act 2020 notifiable
-- breach question, not only an OWASP one.

-- ── 1. Remove every permissive SELECT path ──────────────────────────────────
-- Permissive policies are OR'd, so leaving any one of these in place keeps the
-- table fully open no matter what is added alongside it. Names span every
-- historical revision (20260422000001 and 20260429000000 both defined a broad
-- read policy under different names).
DROP POLICY IF EXISTS "players_select_all"                ON players;
DROP POLICY IF EXISTS "Authenticated users can read players" ON players;
DROP POLICY IF EXISTS "Players can read own profile"      ON players;
DROP POLICY IF EXISTS "Players can view own profile"      ON players;

-- ── 2. One canonical read policy ────────────────────────────────────────────
-- public.is_judge() (20260813000000) rather than an inline
-- `EXISTS (SELECT 1 FROM players …)`: a subquery on players inside a policy ON
-- players re-enters this same policy and raises
-- "infinite recursion detected in policy for relation players".
DROP POLICY IF EXISTS "players_select_self_family_judge" ON players;
CREATE POLICY "players_select_self_family_judge" ON players
  FOR SELECT USING (
    id = auth.uid()
    OR parent_id = auth.uid()
    OR public.is_judge()
  );

-- ── 3. Drop anon's grant entirely ───────────────────────────────────────────
-- The policy above already returns zero rows to a caller with no JWT, since all
-- three branches are false or NULL. Revoking as well means a future policy
-- mistake cannot re-expose contact details to the open internet — it would only
-- ever re-expose them to logged-in users. Defence in depth on the finding that
-- actually shipped.
--
-- Nothing anon-facing needs the base table once the repoint above is done:
-- /leaderboard is the only public page that reads players, and it moves to
-- players_public (which is owner-rights, so it is unaffected by this REVOKE).
REVOKE SELECT ON public.players FROM anon;

-- ── 4. Checked, and intentionally left working ──────────────────────────────
-- Every other policy and function that subqueries `players` still resolves
-- under the new restriction, because each one only ever needs a row the caller
-- can now still see:
--   · `EXISTS (… WHERE id = auth.uid() AND role = 'judge')` in the sessions,
--     session_events, results, koha_donations, wellbeing and voting policies
--     reads the caller's OWN row  -> id = auth.uid() branch.
--   · `EXISTS (… WHERE id = player_id AND parent_id = auth.uid())` in
--     results_insert_own and wellbeing_insert_own reads a CHILD row
--     -> parent_id = auth.uid() branch.
--   · get_wellbeing_report(), get_vote_details(), get_player_top_event(),
--     search_players_by_username() and the referral triggers are all
--     SECURITY DEFINER, so they bypass RLS as before.
-- No cascade change is needed. This was verified by reading each policy body,
-- not assumed.

-- ── Verification ────────────────────────────────────────────────────────────
-- 1. Unauthenticated, must now return 0 rows (or 401), not 27:
--      curl "$URL/rest/v1/players?select=email,phone,date_of_birth" \
--        -H "apikey: $ANON_KEY"
-- 2. Unauthenticated, must still return the roster with NO contact fields:
--      curl "$URL/rest/v1/players_public?select=*" -H "apikey: $ANON_KEY"
-- 3. Confirm the sensitive columns are truly gone from the public path:
--      curl "$URL/rest/v1/players_public?select=email" -H "apikey: $ANON_KEY"
--      -- expect 400, column does not exist
-- 4. Logged in as a non-judge player: reading players returns your own row plus
--    your children only; /leaderboard, /games/[sessionId] and the live session
--    Junior age chips all still render.
