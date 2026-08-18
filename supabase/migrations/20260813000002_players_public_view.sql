-- ════════════════════════════════════════════════════════════════════════════
-- 20260813000002 — players_public: superseded, kept as a no-op
-- ════════════════════════════════════════════════════════════════════════════
--
-- THIS MIGRATION NO LONGER DEFINES THE VIEW. The authoritative definition of
-- `players_public` is 20260816000000_players_public_show_division.sql, which
-- does a DROP + CREATE and therefore lands whatever shape it finds.
--
-- WHY THIS FILE WAS EMPTIED, AND WHY IT MATTERS
--
-- `players_public` has been redefined three times, from three parallel
-- branches, twice applied directly to production without going through
-- supabase/migrations at all:
--
--   1. this branch, originally  : age_years, age_group, gated full_name
--   2. applied out-of-band      : name, age
--   3. applied out-of-band      : full_name, age_years, age_group, show_division
--
-- This file was rewritten once already, to chase shape 2. By the time it was
-- merged, production had moved to shape 3. It contained:
--
--     CREATE OR REPLACE VIEW public.players_public AS SELECT ... AS name ...
--
-- and `CREATE OR REPLACE VIEW` can only APPEND columns. It cannot rename,
-- reorder, retype or remove one. Against the live view that statement raises
--
--     cannot change name of view column "full_name" to "name"
--
-- which ABORTS the entire `supabase db push` — after 20260813000000 and
-- ...000001 have already applied, and BEFORE 20260813000003 (the PII lockdown,
-- the entire point of the exercise) has run. The result is a half-migrated
-- schema with the guards on and the lockdown off, and the contact details of
-- 27 players, 8 of them minors, still readable by anyone.
--
-- Chasing the shape a third time would only re-arm the same trap. So this file
-- stops defining the view, one migration owns that definition, and it owns it
-- with DROP + CREATE so it can never be shape-dependent again.
--
-- Ordering note: 20260813000003 runs between this file and 20260816000000. It
-- only touches policies on `players` and revokes anon's grant, and never
-- references `players_public`, so the gap where the view may not exist (on a
-- freshly reset database) is harmless.
--
-- The GRANT below is kept because it is idempotent and cheap, and because it
-- means a database where the view already exists ends this migration with the
-- correct grant regardless of how the view got there. It is guarded so a fresh
-- `supabase db reset`, where the view does not exist yet, does not fail here.

DO $$
BEGIN
  IF to_regclass('public.players_public') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON public.players_public TO anon, authenticated';
  END IF;
END $$;

-- ── If you are adding a column to players_public ────────────────────────────
-- Edit 20260816000000, not this file, and sweep every caller in app/ first.
-- The client and this view have already drifted apart twice, and each time it
-- broke the live session and the game report in production.
