-- ════════════════════════════════════════════════════════════════════════════
-- 20260820000001 — search_players_by_username: off the base table, off anon
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE PROBLEM
-- The function (20260515000000) was SECURITY DEFINER, had no search_path, read
-- `players` directly, and was callable by ANON. Verified after the PII lockdown
-- landed: an unauthenticated caller with nothing but the public anon key got 10
-- players back. Owner rights mean 20260813000003 does not apply to it.
--
-- Nothing leaked, because it only ever selected id, display_name and username,
-- all of which players_public exposes anyway. The danger was structural: it was
-- an anon-reachable path INTO the locked table, so the day somebody added a
-- column to its SELECT — an email for a nicer autocomplete, say — the lockdown
-- would have been bypassed with nothing to flag it.
--
-- THREE CHANGES
--
-- 1. Reads `players_public`, not `players`. This is the real fix. The function
--    is now structurally incapable of returning a private column, because it
--    cannot see one. Everything else here is belt and braces.
--
-- 2. SECURITY DEFINER dropped entirely. It only existed to get past RLS on
--    `players`. players_public is owner-rights and publicly readable, so the
--    function needs no elevated rights at all, and the escalation shape (a
--    definer function with a mutable search_path) disappears rather than being
--    mitigated. search_path is pinned anyway, for the next person who edits it.
--
-- 3. anon loses EXECUTE. The only caller is /my-koha, which is auth-gated.
--
-- ALSO: the pattern is escaped. p_query went straight into
-- ILIKE '%' || p_query || '%', so `%` was a wildcard and a single `%` returned
-- the first 10 players in the table. Not SQL injection — it is a parameter, and
-- always was — but it made a substring search behave as a pattern search, which
-- is not what the caller intended. Escaping \, % and _ makes it a literal
-- substring match, which is what the autocomplete on /my-koha actually wants.

CREATE OR REPLACE FUNCTION public.search_players_by_username(p_query TEXT)
RETURNS TABLE (id UUID, display_name TEXT, username TEXT)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT p.id, p.display_name, p.username
  FROM players_public p
  WHERE p.username IS NOT NULL
    AND p.is_active = true
    AND p.username ILIKE
        '%' || replace(replace(replace(p_query, '\', '\\'), '%', '\%'), '_', '\_') || '%'
        ESCAPE '\'
  ORDER BY p.username
  LIMIT 10;
$$;

REVOKE ALL ON FUNCTION public.search_players_by_username(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_players_by_username(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.search_players_by_username(TEXT) TO authenticated;

COMMENT ON FUNCTION public.search_players_by_username(TEXT) IS
  'Username autocomplete for the /my-koha referrer picker. Reads players_public, '
  'never the base table, so it cannot expose a private column. Authenticated only.';

-- ── Verification ────────────────────────────────────────────────────────────
-- Must now be refused for anon (42501 / permission denied):
--   curl -X POST "$URL/rest/v1/rpc/search_players_by_username" \
--        -H "apikey: $ANON_KEY" -H "Content-Type: application/json" \
--        -d '{"p_query":"a"}'
-- And a bare '%' must return nothing rather than the first 10 players, because
-- it is now a literal character:
--   SELECT * FROM search_players_by_username('%');
