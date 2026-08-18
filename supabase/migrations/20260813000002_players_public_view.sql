-- ════════════════════════════════════════════════════════════════════════════
-- 20260813000002 — players_public: the safe subset of the player roster
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  REWRITTEN 2026-08-16. Read this before editing.
--
-- This migration originally created a view with columns age_years, age_group
-- and a show_full_name-gated full_name. It was never applied. By the time it
-- would have run, a `players_public` view ALREADY EXISTED in production,
-- created out-of-band by a parallel piece of work with a different shape:
-- a single `age` integer, a coalesced `name`, and no legal name at all.
--
-- That mismatch broke three queries in production once v0.5.6.0 deployed
-- (the live session's player-info map and judge roster, and the game report),
-- because the shipped client asked for columns the live view does not have.
--
-- Two things follow, and both matter:
--
-- 1. THIS FILE NOW MATCHES THE LIVE VIEW EXACTLY — same columns, same order,
--    same expressions. That is what makes `CREATE OR REPLACE VIEW` legal here:
--    Postgres refuses to replace a view if the replacement renames, reorders,
--    drops or retypes any existing column ("cannot change name of view column").
--    Running the original version against production would have ABORTED the
--    whole `supabase db push`, after 20260813000000 and ...001 had applied.
--    If you change a column below, you must DROP the view first, and you must
--    check every caller in app/ before you do.
--
-- 2. The view is now defined in this repo, so a database rebuilt from
--    migrations alone gets it. Previously it existed only in production and in
--    an unmerged branch, which meant `supabase db reset` produced a schema the
--    deployed app could not run against.
--
-- SECURITY MODEL (unchanged, and the reason the view exists at all)
-- The view runs with OWNER rights (security_invoker = false), so it reads
-- through whatever RLS sits on `players`. That is the point: it is the single
-- audited hole in an otherwise closed table, and it can only ever expose these
-- columns. The lockdown that actually closes public read on `players` is a
-- separate migration; this one is additive and protects nothing on its own.
--
-- WHAT IS DELIBERATELY ABSENT
-- email, phone, city, region, country, gender, parent_name, parent_email,
-- parent_phone, bodyweight_kg, referral_code, role, and date_of_birth. Verified
-- against production on 2026-08-16: an unauthenticated caller could read all of
-- those for all 27 players, including 8 under-18s and one set of guardian
-- contact details. `age` replaces date_of_birth because every cross-player
-- consumer wants a bracket, not a birthday.
--
-- Note `name` never falls back to full_name — it ends at the literal 'Unknown'.
-- A legal name cannot leak through this view by any path.

CREATE OR REPLACE VIEW public.players_public
WITH (security_invoker = false) AS
SELECT
  p.id,
  p.display_name,
  p.username,
  COALESCE(NULLIF(p.display_name, ''), NULLIF(p.username, ''), 'Unknown') AS name,
  p.division,
  p.icon,
  p.is_active,
  p.is_guest,
  CASE
    WHEN p.date_of_birth IS NULL THEN NULL
    ELSE date_part('year',
           age((now() AT TIME ZONE 'Pacific/Auckland')::date, p.date_of_birth))::int
  END AS age
FROM public.players p;

GRANT SELECT ON public.players_public TO anon, authenticated;

COMMENT ON VIEW public.players_public IS
  'Public-safe player roster. The ONLY sanctioned path to another player''s row. '
  'Read your own row, your children''s rows, or — as a kaiwhakawā — any row, '
  'from `players` itself. Column changes require DROP + CREATE and a sweep of '
  'every caller in app/; CREATE OR REPLACE cannot rename or drop view columns.';

-- ── Verification ────────────────────────────────────────────────────────────
-- These must all succeed unauthenticated (the view is owner-rights on purpose):
--   curl "$URL/rest/v1/players_public?select=id,division"                 -- leaderboard, dashboard
--   curl "$URL/rest/v1/players_public?select=id,division,age"             -- live session player info
--   curl "$URL/rest/v1/players_public?select=id,display_name,username,name"        -- judge roster
--   curl "$URL/rest/v1/players_public?select=id,display_name,username,name,division" -- game report
--   curl "$URL/rest/v1/players_public?select=display_name,username"       -- my-koha
-- And this must 400 with "column ... does not exist":
--   curl "$URL/rest/v1/players_public?select=email"
