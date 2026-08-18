-- ════════════════════════════════════════════════════════════════════════════
-- 20260816 — expose show_division on players_public
-- ════════════════════════════════════════════════════════════════════════════
--
-- 20260813000002 made show_full_name real by gating full_name in SQL, and
-- dropped city/region entirely so show_location has nothing left to leak.
-- show_division was the one preference still doing nothing.
--
-- It cannot be enforced the same way. Division is STRUCTURAL — it decides which
-- pool you are ranked in — so masking the column would empty the Men's /
-- Women's / Juniors sections rather than hide a label. What the registration
-- copy actually promises is the label ("Your division shown next to your
-- name"), which in practice is the "1st Masters" / "1st 60+" sub-division badge
-- on the live-session leaderboard.
--
-- So: keep division always readable, and expose the flag so the client can drop
-- that badge. The preference becomes real without breaking the standings.
--
-- ── Why DROP + CREATE rather than CREATE OR REPLACE ─────────────────────────
-- CREATE OR REPLACE VIEW can only APPEND columns. It cannot rename, reorder,
-- retype or remove one, and it fails outright with "cannot change name of view
-- column" if you try.
--
-- That is not hypothetical here. This view has been redefined more than once,
-- from more than one branch, and 20260813000002 was itself rewritten to match a
-- shape that had been applied to production out-of-band. Depending on which of
-- those a given database has, the ten columns below may or may not line up with
-- what is already there — and under CREATE OR REPLACE a mismatch ABORTS the
-- whole `supabase db push`, part-way through, leaving the schema half-migrated.
--
-- DROP + CREATE always lands, whatever shape it finds. Nothing depends on this
-- view in the database (no other view, no function, no policy references it —
-- it is read only by the client), so the drop is safe and CASCADE is not needed.
-- Idempotent: safe to re-run, and safe to run against any prior shape.
--
-- If you change a column here, sweep every caller in app/ first. The client and
-- this view have already drifted apart twice, and each time it broke the live
-- session and the game report in production.

DROP VIEW IF EXISTS public.players_public;

CREATE VIEW public.players_public AS
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
    WHEN p.date_of_birth IS NOT NULL
      THEN date_part('year', age(p.date_of_birth))::int
  END AS age_years,

  CASE
    WHEN p.date_of_birth IS NULL THEN NULL
    WHEN date_part('year', age(p.date_of_birth)) < 10 THEN 'U10'
    WHEN date_part('year', age(p.date_of_birth)) < 12 THEN 'U12'
    WHEN date_part('year', age(p.date_of_birth)) < 14 THEN 'U14'
    WHEN date_part('year', age(p.date_of_birth)) < 17 THEN 'U16'
  END AS age_group,

  -- NEW. Defaults TRUE so existing rows and any row with a NULL keep showing
  -- the badge exactly as they do today; only an explicit opt-out hides it.
  COALESCE(p.show_division, TRUE) AS show_division

FROM public.players p;

-- Restated because CREATE OR REPLACE does not carry these over on its own in
-- every Postgres version, and because flipping security_invoker on would make
-- the view read through the CALLER's RLS and silently return zero rows to anon.
ALTER VIEW public.players_public SET (security_invoker = off);

GRANT SELECT ON public.players_public TO anon, authenticated;
