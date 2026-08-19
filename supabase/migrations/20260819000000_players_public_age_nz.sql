-- ════════════════════════════════════════════════════════════════════════════
-- 20260819000000 — players_public: compute age in NZ time, not UTC
-- ════════════════════════════════════════════════════════════════════════════
--
-- age_years and the four age_group brackets called bare age(), which measures
-- against current_date in the server's UTC. Aotearoa runs 12-13 hours ahead, so
-- for most of the NZ day UTC is still on yesterday and a player reads a year
-- younger on their own birthday.
--
-- LIVE IN PRODUCTION when this was written. Verified 2026-08-19 (NZ), while UTC
-- was still on the 18th: the player born 1972-08-19 came back as 53 when
-- Aotearoa had already turned 54. An earlier instance of the same bug was caught
-- on 2026-08-18 on a player born 1980-08-18 (45 instead of 46). It is the same
-- off-by-one that lib/dates.ts exists to prevent on the client, reintroduced
-- server-side.
--
-- THE BRACKET IS THE PART THAT ACTUALLY HURTS. On the morning of a child's 10th
-- birthday UTC still reads 9, so age_group returns 'U10' and the age-group
-- winner badge goes to the wrong child. A wrong number is cosmetic; a wrong
-- badge is a wrong result.
--
-- WHY A NEW MIGRATION RATHER THAN EDITING 20260816000000
-- That migration is already recorded as applied in production, so it will never
-- run again. Correcting it in place fixes a fresh `supabase db reset` and leaves
-- production wrong forever, with nothing to indicate the fix had not landed.
--
-- WHY CREATE OR REPLACE IS SAFE HERE
-- Only the two age EXPRESSIONS change. Every column keeps its name, position and
-- type, which is exactly the constraint CREATE OR REPLACE VIEW enforces, so no
-- DROP is needed and there is no window where callers see a missing view. The
-- column list below is a byte-for-byte match of 20260816000000 apart from those
-- expressions — if you change a column here, you need DROP + CREATE and a sweep
-- of every caller in app/.

CREATE OR REPLACE VIEW public.players_public AS
SELECT
  p.id,

  COALESCE(
    NULLIF(p.display_name, ''),
    NULLIF(p.username, ''),
    NULLIF(p.full_name, '')
  ) AS display_name,

  NULLIF(p.username, '') AS username,

  CASE WHEN p.show_full_name THEN NULLIF(p.full_name, '') END AS full_name,

  p.division,
  p.icon,
  p.is_active,
  p.is_guest,

  CASE
    WHEN p.date_of_birth IS NOT NULL THEN nz.age_years
  END AS age_years,

  CASE
    WHEN p.date_of_birth IS NULL THEN NULL
    WHEN nz.age_years < 10 THEN 'U10'
    WHEN nz.age_years < 12 THEN 'U12'
    WHEN nz.age_years < 14 THEN 'U14'
    WHEN nz.age_years < 17 THEN 'U16'
  END AS age_group,

  COALESCE(p.show_division, TRUE) AS show_division

FROM public.players p
-- One NZ-local age per row, reused by both columns above so they can never
-- drift apart. A NULL date_of_birth yields NULL here, which both CASEs handle.
CROSS JOIN LATERAL (
  SELECT date_part(
    'year',
    age((now() AT TIME ZONE 'Pacific/Auckland')::date, p.date_of_birth)
  )::int AS age_years
) nz;

-- Re-asserted rather than assumed: this view is owner-rights on purpose, so it
-- can read through the restrictive RLS that 20260813000003 puts on `players`.
-- Flipping it to `on` would silently return zero rows to every anonymous caller.
ALTER VIEW public.players_public SET (security_invoker = off);

GRANT SELECT ON public.players_public TO anon, authenticated;

-- ── Verification ────────────────────────────────────────────────────────────
-- Unauthenticated, on a day when UTC and NZ disagree (i.e. before ~12:00 NZST),
-- every age must match the NZ-local calculation:
--   curl "$URL/rest/v1/players_public?select=id,age_years,age_group"
-- Cross-check against players.date_of_birth for anyone whose birthday is today;
-- that is the only row where the two timezones give different answers.
