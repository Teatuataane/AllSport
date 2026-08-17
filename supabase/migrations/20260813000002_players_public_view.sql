-- ════════════════════════════════════════════════════════════════════════════
-- 20260813000002 — players_public: the safe subset of the player roster
-- ════════════════════════════════════════════════════════════════════════════
--
-- ADDITIVE ONLY. This migration creates a view and grants read on it. It does
-- NOT change any policy, so nothing breaks and nothing is protected yet — the
-- lockdown is 20260813000003, which must not run until the client reads from
-- this view. Splitting them is deliberate: the same code-before-migration
-- ordering the event rename in 20260801000000 had to learn the hard way.
--
-- WHY A VIEW AT ALL
-- The app genuinely needs a public roster: /leaderboard maps player_id to a
-- division, /games/[sessionId] shows every competitor's name, the live session
-- needs ages for the Junior age chips. What it does not need is email, phone,
-- home address or a child's parent's contact details, all of which currently
-- ship to anyone who asks (verified: 27 rows to an unauthenticated caller,
-- 19 emails, 9 phones, 27 dates of birth, 8 of those players under 18).
--
-- SECURITY MODEL
-- The view runs with OWNER rights (security_invoker = off, Postgres' default
-- for views), so it reads through the restrictive RLS that 20260813000003 puts
-- on `players`. That is the point: the view is the single, audited hole in an
-- otherwise closed table, and it can only ever expose these columns.

CREATE OR REPLACE VIEW public.players_public AS
SELECT
  p.id,

  -- Never blank, so every existing display-name -> username -> full-name
  -- fallback in the client keeps working (lib/judgeRoster.ts treats '' as
  -- missing, hence NULLIF rather than plain COALESCE).
  --
  -- The full_name fallback only fires for rows with no display_name AND no
  -- username, which in practice means judge-created guests and pre-2026-04
  -- legacy rows. A registered player always has display_name set at
  -- registration, so an opted-out legal name never reaches this branch.
  COALESCE(
    NULLIF(p.display_name, ''),
    NULLIF(p.username, ''),
    NULLIF(p.full_name, '')
  ) AS display_name,

  NULLIF(p.username, '') AS username,

  -- Honours the promise made at registration: "Your legal name will be visible
  -- on public leaderboards". show_full_name defaults to false and — as of this
  -- migration — was collected but never actually consulted for display, so the
  -- opt-out was cosmetic and every legal name was public regardless. Gating it
  -- here makes the preference real, server-side.
  CASE WHEN p.show_full_name THEN NULLIF(p.full_name, '') END AS full_name,

  p.division,
  p.icon,
  p.is_active,
  p.is_guest,

  -- Age instead of date_of_birth. Every cross-player consumer wants a bracket,
  -- not a birthday: the live session's Junior age chips and age-group winner
  -- badges. Exposing the derived value keeps the feature and drops 27 exact
  -- dates of birth (8 of them children) off the public internet.
  CASE
    WHEN p.date_of_birth IS NOT NULL
      THEN date_part('year', age(p.date_of_birth))::int
  END AS age_years,

  -- Brackets per CLAUDE.md "Junior age-group badges": U10 (0-9), U12 (10-11),
  -- U14 (12-13), U16 (14-16). NULL for adults and for null-DOB juniors, who by
  -- existing behaviour get no age-group badge but still appear in the section.
  CASE
    WHEN p.date_of_birth IS NULL THEN NULL
    WHEN date_part('year', age(p.date_of_birth)) < 10 THEN 'U10'
    WHEN date_part('year', age(p.date_of_birth)) < 12 THEN 'U12'
    WHEN date_part('year', age(p.date_of_birth)) < 14 THEN 'U14'
    WHEN date_part('year', age(p.date_of_birth)) < 17 THEN 'U16'
  END AS age_group

FROM public.players p;

-- Explicit, even though it is the default, because flipping it to `on` would
-- make the view read through the CALLER's RLS and silently return zero rows to
-- anon once 20260813000003 lands — an empty leaderboard with no error.
ALTER VIEW public.players_public SET (security_invoker = off);

GRANT SELECT ON public.players_public TO anon, authenticated;

COMMENT ON VIEW public.players_public IS
  'Public-safe player roster. The ONLY sanctioned path to another player''s row. '
  'Excludes email, phone, city, region, country, gender, parent_name, '
  'parent_email, parent_phone, bodyweight_kg, referral_code, role and '
  'date_of_birth (exposed as age_years / age_group instead). Read your own row, '
  'your children''s rows, or — as a kaiwhakawā — any row, from `players` itself.';

-- Deliberately NOT exposed, for the record. Column list taken from the live
-- table, not from CLAUDE.md's schema section, which lists an `address` column
-- that does not exist and omits `gender` and `referral_code` from the picture:
--   email, phone, city, region, country       — contact details
--   parent_name, parent_email, parent_phone   — a minor's guardian
--   date_of_birth                             — see age_years above
--   gender                                    — not needed for display;
--                                               division already carries it
--   bodyweight_kg                             — health data
--   referral_code                             — lets referrals be forged
--   role                                      — no consumer reads another
--                                               player's role; /judge and
--                                               /vote read their own
--   show_*                                    — preference plumbing
