-- Short distance efforts rank on their estimate (Tāne, 9 Oct 2026)
--
-- "A 1km time should be estimated from scores less than 1km, but the rule
-- should stand that any 1km time is better than an estimated 1km time."
--
-- v0.30.0.1 (8 Oct 2026) saved a distance effort under the reference (a 500m
-- row on the 1000m Row Erg) as TRAINING: what was done, with raw_score NULL.
-- From v0.32.0.0 such an effort, from a quarter of the reference up, ranks on
-- the time Riegel predicts over the reference, in the LOWER half of its level's
-- band, so every effort that covered the reference beats it:
--
--   covered   tierIdx * 10000 + 10000 - predicted   (unchanged)
--   estimate  tierIdx * 10000 +  5000 - predicted   (new)
--
-- (encodeDistanceEffort in lib/eventData.ts). An estimate never earns a colour
-- (lib/playerGrades.ts), so no colour moves and nothing is withdrawn.
--
-- This re-scores the training rows the old code wrote. Only workout_entries:
-- an official result never took the training path. Rows under a quarter of the
-- reference stay training, as the new code still writes them.
--
-- Every existing covered row already sits in the upper half (a predicted time
-- under 5,000s, 83 minutes, over 1km or 100m); the assertion at the end checks
-- that, because a covered row in the lower half would now read as an estimate.
--
-- ⚠ DEPLOY THE CODE FIRST. The old bundle reads an estimate's raw_score as a
-- covered time of 5000 + secs (an 87-minute 1km): harmless (no colour, last
-- among covered efforts) but wrong on screen until the new code is live.
--
-- Safe to re-run: it only touches rows whose raw_score is still NULL.

-- Reference distance and levels of every open distance event (lib/eventData.ts).
CREATE TEMP TABLE open_distance (slug text PRIMARY KEY, ref int, ref_label text) ON COMMIT DROP;
INSERT INTO open_distance VALUES
  ('running', 1000, '1km'), ('cycling', 1000, '1km'), ('ski-erg', 1000, '1km'),
  ('row-erg', 1000, '1km'), ('scooting', 1000, '1km'), ('walking', 1000, '1km'),
  ('swim', 100, '100m'), ('animal-crawl', 100, '100m');

CREATE TEMP TABLE open_levels (slug text, tier text, idx int) ON COMMIT DROP;
INSERT INTO open_levels VALUES
  ('animal-crawl', 'Crawl', 0), ('animal-crawl', 'Bear Crawl', 1),
  ('animal-crawl', 'Lizard Crawl', 2), ('animal-crawl', 'Duck Walk', 3);

-- Riegel up to the reference, rounded half up as predictedEffortSecs() does.
CREATE TEMP TABLE short_calc ON COMMIT DROP AS
SELECT x.*, round((x.secs::float8 * power(x.ref::float8 / x.metres::float8, 1.06))::numeric)::int AS predicted
FROM (
  SELECT e.id, d.ref, d.ref_label, e.distance_m::float8 AS metres, e.time_seconds::float8 AS secs,
         COALESCE(l.idx, 0) AS idx, l.tier
  FROM workout_entries e
  JOIN open_distance d ON d.slug = e.event_slug
  LEFT JOIN open_levels l ON l.slug = e.event_slug AND l.tier = e.difficulty_tier
  WHERE e.raw_score IS NULL
    AND e.distance_m >= d.ref / 4.0 AND e.distance_m < d.ref
    AND e.time_seconds > 0 AND e.time_seconds <= 86400
    -- A laddered event's row must name one of its levels, as the sheet requires.
    AND (e.event_slug <> 'animal-crawl' OR l.tier IS NOT NULL)
) x;
DELETE FROM short_calc WHERE predicted < 1 OR predicted >= 5000;

-- Pre-image, then the change.
CREATE TABLE public.workout_entries_archive_20261008223803 AS
SELECT e.* FROM workout_entries e WHERE e.id IN (SELECT id FROM short_calc);
ALTER TABLE public.workout_entries_archive_20261008223803 ENABLE ROW LEVEL SECURITY;

-- "500m · 1:47 · est. 1km 3:44", as computeScoreVals writes it.
CREATE OR REPLACE FUNCTION pg_temp.mmss(s numeric) RETURNS text LANGUAGE sql IMMUTABLE AS
$f$ SELECT floor(round(s) / 60)::int || ':' || lpad((round(s)::int % 60)::text, 2, '0') $f$;

UPDATE workout_entries e SET
  raw_score = c.idx * 10000 + 5000 - c.predicted,
  score_label = CASE WHEN c.tier IS NULL THEN '' ELSE 'D' || (c.idx + 1) || ' ' || c.tier || ' · ' END
    || round(c.metres)::int || 'm · ' || pg_temp.mmss(c.secs::numeric)
    || ' · est. ' || c.ref_label || ' ' || pg_temp.mmss(c.predicted)
FROM short_calc c
WHERE e.id = c.id;

DO $$
DECLARE v_moved int; v_low int;
BEGIN
  SELECT count(*) INTO v_moved FROM short_calc;
  RAISE NOTICE 'short distance efforts re-scored as estimates: %', v_moved;
  -- No covered effort may sit in the estimate half of its band.
  SELECT count(*) INTO v_low FROM workout_entries e JOIN open_distance d ON d.slug = e.event_slug
    WHERE e.raw_score IS NOT NULL AND e.distance_m >= d.ref AND e.raw_score % 10000 < 5000;
  IF v_low > 0 THEN RAISE EXCEPTION 'short efforts: % covered workout entries read as estimates', v_low; END IF;
  SELECT count(*) INTO v_low FROM results r JOIN session_events se ON se.id = r.event_id
    JOIN event_domains ed ON ed.event_name = se.event_name JOIN open_distance d ON d.slug = ed.slug
    WHERE r.raw_score IS NOT NULL AND r.distance_m >= d.ref AND r.raw_score % 10000 < 5000;
  IF v_low > 0 THEN RAISE EXCEPTION 'short efforts: % covered results read as estimates', v_low; END IF;
END $$;
