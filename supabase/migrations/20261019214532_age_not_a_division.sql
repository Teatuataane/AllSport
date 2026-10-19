-- Age is not a division (v0.42.0.0, Tāne 20 Oct 2026)
--
-- Masters (40+) and Grandmaster (60+) stop being divisions. The colour
-- standards already carry the age allowance, and since v0.42.0.0 the app reads
-- it from the age a player turns in the year being graded, not from the
-- division name. Two problems this removes:
--
--   · A division only changed by hand. A player who turned 40 kept the Open
--     ladder until a kaiwhakawā moved them (one Women's player was in exactly
--     that state on 20 Oct 2026), and a junior who turned 17 kept the U16
--     allowance.
--   · Masters players were ranked apart from everyone else in a game
--     (award_session_points partitions by the stored division). With the
--     allowance in the standards, an older player competes with everyone.
--
-- What it does:
--
--   1. players_public gains birth_year (appended, so CREATE OR REPLACE is
--      allowed). It is no new disclosure: age_years already moves on the
--      birthday, and grading needs the age a player turns in a given year,
--      which age_years alone cannot give.
--   2. Masters and Grandmaster rows fold into Men's and Women's; the legacy
--      'Youth' becomes 'Juniors'. The old values are kept in
--      players_division_archive_20261019 first.
--   3. roll_juniors() moves a junior to Men's or Women's in the year they turn
--      17 (by gender; anyone else takes Men's, as a junior answering "Other"
--      already takes the boys' standards, Tāne 16 Sept 2026). pg_cron runs it
--      daily, so nobody has to remember on 1 January. A kaiwhakawā can still
--      move anyone.
--   4. players_division_check allows only Juniors, Men's and Women's. This
--      also retires the misspelt 'Grandmasters …' values that
--      20261019003642 corrected.
--
-- ORDER: deploy the v0.42.0.0 code FIRST. Older register code writes
-- 'Masters …' for a 40-year-old, which step 4 refuses. The new code reads
-- birth_year in its own query and copes with it missing, so the code is safe
-- against the database before this runs.
--
-- Changing a division clears grades_checked_at (reset_grades_watermark), so
-- every moved player is rechecked. No colour is withdrawn by a recheck.

-- ── 1. players_public.birth_year ──────────────────────────────────────────
-- Byte-for-byte 20260819000000 plus one column at the end.

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

  COALESCE(p.show_division, TRUE) AS show_division,

  date_part('year', p.date_of_birth)::int AS birth_year

FROM public.players p
CROSS JOIN LATERAL (
  SELECT date_part(
    'year',
    age((now() AT TIME ZONE 'Pacific/Auckland')::date, p.date_of_birth)
  )::int AS age_years
) nz;

ALTER VIEW public.players_public SET (security_invoker = off);
GRANT SELECT ON public.players_public TO anon, authenticated;

-- ── 2. Fold the age divisions in, keeping a pre-image ────────────────────────

CREATE TABLE IF NOT EXISTS public.players_division_archive_20261019 AS
SELECT id, division, now() AS archived_at
FROM public.players
WHERE division IN ('Masters Men', 'Masters Women', 'Grandmaster Men', 'Grandmaster Women',
                   'Grandmasters Men', 'Grandmasters Women', 'Youth');

ALTER TABLE public.players_division_archive_20261019 ENABLE ROW LEVEL SECURITY;

-- The constraint is dropped first: it may still hold the misspelt list, and
-- the new one must not be checked until every row fits it.
ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_division_check;

UPDATE public.players SET division = CASE
    WHEN division IN ('Masters Men', 'Grandmaster Men', 'Grandmasters Men') THEN 'Men''s'
    WHEN division IN ('Masters Women', 'Grandmaster Women', 'Grandmasters Women') THEN 'Women''s'
    WHEN division = 'Youth' THEN 'Juniors'
  END
WHERE division IN ('Masters Men', 'Grandmaster Men', 'Grandmasters Men',
                   'Masters Women', 'Grandmaster Women', 'Grandmasters Women', 'Youth');

-- ── 3. Juniors move up in the year they turn 17 ──────────────────────────────

CREATE OR REPLACE FUNCTION public.roll_juniors()
RETURNS int
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_moved int;
BEGIN
  -- The age a player turns this NZ year: the one age the colour standards and
  -- the register form use (lib/seasonYear.ts ageInYear, app/register).
  UPDATE players
  SET division = CASE WHEN lower(coalesce(gender, '')) = 'female' THEN 'Women''s' ELSE 'Men''s' END
  WHERE division = 'Juniors'
    AND date_of_birth IS NOT NULL
    AND date_part('year', (now() AT TIME ZONE 'Pacific/Auckland')::date)
        - date_part('year', date_of_birth) >= 17;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;

-- Server only: pg_cron (and the SQL Editor) run it. guard_players_grading_identity
-- lets a write with no login through, which is what a cron job is.
REVOKE ALL ON FUNCTION public.roll_juniors() FROM PUBLIC, anon, authenticated;

SELECT public.roll_juniors();

-- 12:00 UTC is 00:00 or 01:00 in Aotearoa, so a junior moves up on 1 January.
-- Daily rather than yearly: it costs nothing, and a missed run heals itself.
SELECT cron.unschedule('roll-juniors')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'roll-juniors');
SELECT cron.schedule('roll-juniors', '0 12 * * *', 'SELECT public.roll_juniors();');

-- ── 4. Three divisions ──────────────────────────────────────────────────────

ALTER TABLE public.players ADD CONSTRAINT players_division_check CHECK (division IN (
  'Juniors', 'Men''s', 'Women''s'
));

-- ── Assertions ──────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.players
             WHERE division IS NOT NULL AND division NOT IN ('Juniors', 'Men''s', 'Women''s')) THEN
    RAISE EXCEPTION 'a player still holds an age division';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'players_public' AND column_name = 'birth_year') THEN
    RAISE EXCEPTION 'players_public.birth_year is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'roll-juniors') THEN
    RAISE EXCEPTION 'roll-juniors is not scheduled';
  END IF;
END;
$$;
