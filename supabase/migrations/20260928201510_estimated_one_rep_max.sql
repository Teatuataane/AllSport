-- Lifts rank on their estimated 1RM; Toe Lift and Tibialis Curl change mode
-- (29 Sept 2026, Tāne)
--
-- Three things, in one transaction:
--
--   1. RE-ENCODES every strength lift onto its estimated one-rep max.
--      raw_score was the load alone, so 38kg × 1 beat 35kg × 5. It is now
--      Brzycki, 1RM = w × 36 / (37 − r), reps past 10 counted as 10, to 0.1kg:
--      exactly estimatedOneRm() in lib/scoring.ts, which new scores already use.
--      Recomputed from the SOURCE columns (weight_kg, reps), so it is
--      idempotent, and a logged set that was already converted comes out the
--      same. A one-rep lift (or one with no reps recorded) is unchanged.
--      __tests__/estimatedOneRm.test.ts pins this SQL to the TypeScript.
--
--   2. ARCHIVES then DELETES every Toe Lift and Tibialis Curl score still on
--      the old scale (a heaviest load).
--      Toe Lift is now a weight + hold (like Leg Ext Hold) and Tibialis Curl a
--      2-minute rep contest with load levels (like Sandbag to Shoulder). Their
--      old rows hold a heaviest load in raw_score, which decodes on the new
--      scales as a hold or a rep count that never happened. Same treatment as
--      Leg Extension in 20260801000000. Slugs and names do not change, so
--      event_domains and session_events are untouched.
--
--   3. REPLAYS compute_event_placements() for every closed session whose rows
--      changed, so event placements and wins rank on the new scores.
--      results.placement (the whole-game division rank written at close) is
--      NOT replayed, the same scope as 20260910025855.
--
-- Season points and colours are derived by the recheck route, not here. The
-- code bumps GRADING_RULES_VERSION so every player is rechecked on their next
-- HOME visit; run scripts/refresh-leaderboard-scores.ts --apply straight after
-- this to republish everyone at once. No colour is withdrawn: an ordinary
-- recheck never withdraws.
--
-- ⚠ DEPLOY THE CODE FIRST, THEN THIS, with no game running. Before the code,
-- the old bundle writes Toe Lift and Tib Curl on the old scale and a load-only
-- raw_score for lifts; after it, both are right. Code-first only means lifts
-- scored in the gap are re-encoded here with everything else, and a Toe Lift
-- or Tib Curl scored in the gap is KEPT: only rows still on the old scale are
-- archived (Toe Lift with no hold time, Tib Curl with no level).
-- HARD-REFRESH every kaiwhakawā device afterwards: an old-bundle tab keeps
-- writing a load-only raw_score, which nothing here can catch later.
--
-- ⚠ APPLY IN ONE TRANSACTION (`supabase db push`, `psql -1`, or `db query -f`
-- over this file wrapped in BEGIN/COMMIT with its ledger row). touched_sessions
-- is TEMP … ON COMMIT DROP: run statement by statement, the rewrite and the
-- delete would commit and the replay would fail with nothing to replay.
--
-- ⚠ results.is_pr IS FROZEN. It was set at insert time against loads, and is
-- not recomputed here, so an old multi-rep set that now beats an earlier heavy
-- single stays unflagged. /prs sorts on raw_score and is right either way.
--
-- ⚠ Past game reports compute placements live, so a closed game where only
-- some players scored Toe Lift or Tib Curl now shows that event unscored.
-- Stored placements and wins are unchanged. Same as the Leg Extension archive.
--
-- ⚠ A domain-5 colour already conferred on a Toe Lift or Tib Curl score keeps
-- standing (an ordinary recheck never withdraws), but a kaiwhakawā deleting a
-- domain-5 score later re-judges the domain without these rows. The NOTICE
-- below counts those colours so it is known at apply time.
--
-- Every player with a re-encoded or archived row gets grades_checked_at
-- cleared, so the next recheck runs in full on the new scores. The code's
-- GRADING_RULES_VERSION bump fires at deploy, BEFORE this lands, so on its own
-- it would recheck the old numbers and never again.

-- ── Pre-image, before anything is rewritten ──────────────────────────────────
CREATE TABLE public.results_one_rep_max_preimage_20260928201510 AS
SELECT r.id, r.raw_score, r.score_label, now() AS captured_at
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE se.event_name IN (
  '1A Press', 'Deadlift', 'Clean & Press', 'Pause Back Squat', 'Zercher Dead',
  'Pause Bench', 'Turkish Getup', 'Arthur Lift', 'Pause Row', 'Pause Front Squat',
  'Pullover & Press', 'Loaded Lunge', 'Kelly Snatch', '1A Snatch',
  'Clean & Jerk', 'Snatch')
  AND r.weight_kg > 0 AND r.reps > 1;
ALTER TABLE public.results_one_rep_max_preimage_20260928201510 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_one_rep_max_preimage_20260928201510 FROM anon, authenticated;

CREATE TABLE public.workout_entries_one_rep_max_preimage_20260928201510 AS
SELECT e.id, e.raw_score, e.score_label, now() AS captured_at
FROM workout_entries e
WHERE e.event_slug IN (
  'one-arm-press', 'deadlift', 'clean-and-press', 'pause-squat', 'zercher-deadlift',
  'pause-bench', 'turkish-get-up', 'arthur-lift', 'pause-row', 'pause-front-squat',
  'pullover-and-press', 'loaded-lunge', 'kelly-snatch', 'one-arm-snatch',
  'clean-and-jerk', 'snatch')
  AND e.weight_kg > 0 AND e.reps > 1;
ALTER TABLE public.workout_entries_one_rep_max_preimage_20260928201510 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_one_rep_max_preimage_20260928201510 FROM anon, authenticated;

-- Sessions whose rankings move, captured BEFORE the delete removes the rows
-- that name them.
CREATE TEMP TABLE touched_sessions ON COMMIT DROP AS
SELECT DISTINCT r.session_id
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE r.id IN (SELECT id FROM public.results_one_rep_max_preimage_20260928201510)
   OR (se.event_name = 'Toe Lift' AND r.time_seconds IS NULL)
   OR (se.event_name = 'Tibialis Curl' AND r.difficulty_tier IS NULL);

-- Players whose scores move, for the watermark reset at the end.
CREATE TEMP TABLE touched_players ON COMMIT DROP AS
SELECT DISTINCT r.player_id FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE r.player_id IS NOT NULL AND (
     r.id IN (SELECT id FROM public.results_one_rep_max_preimage_20260928201510)
  OR (se.event_name = 'Toe Lift' AND r.time_seconds IS NULL)
  OR (se.event_name = 'Tibialis Curl' AND r.difficulty_tier IS NULL))
UNION
SELECT DISTINCT w.player_id FROM workout_entries e
JOIN workouts w ON w.id = e.workout_id
WHERE e.id IN (SELECT id FROM public.workout_entries_one_rep_max_preimage_20260928201510)
   OR (e.event_slug = 'toe-lift' AND e.time_seconds IS NULL)
   OR (e.event_slug = 'tibialis-curl' AND e.difficulty_tier IS NULL);

DO $$
DECLARE v_cited int;
BEGIN
  SELECT count(*) INTO v_cited FROM grade_awards
  WHERE domain_number = 5 AND events && ARRAY['toe-lift', 'tibialis-curl', 'leg-extension'];
  RAISE NOTICE 'one-rep max: % Anaerobic Endurance colours cite Toe Lift, Tibialis Curl or Leg Ext Hold (now judged on load AND time)', v_cited;
END $$;

-- ── 1. Re-encode lifts ───────────────────────────────────────────────────────
UPDATE results r
SET raw_score = round(round(r.weight_kg, 2) * 36 / (37 - least(r.reps, 10)), 1),
    score_label = trim_scale(r.weight_kg)::text || 'kg × ' || r.reps || ' reps · est. 1RM '
      || trim_scale(round(round(r.weight_kg, 2) * 36 / (37 - least(r.reps, 10)), 1))::text || 'kg'
WHERE r.id IN (SELECT id FROM public.results_one_rep_max_preimage_20260928201510);

UPDATE workout_entries e
SET raw_score = round(round(e.weight_kg, 2) * 36 / (37 - least(e.reps, 10)), 1),
    score_label = trim_scale(e.weight_kg)::text || 'kg × ' || e.reps || ' reps · est. 1RM '
      || trim_scale(round(round(e.weight_kg, 2) * 36 / (37 - least(e.reps, 10)), 1))::text || 'kg'
WHERE e.id IN (SELECT id FROM public.workout_entries_one_rep_max_preimage_20260928201510);

-- ── 2. Archive then delete Toe Lift and Tibialis Curl ────────────────────────
-- CREATE TABLE … AS does not inherit RLS, and anything in public is reachable
-- through PostgREST: RLS on with no policies, grants revoked.
CREATE TABLE public.results_toe_tib_archive_20260928201510 AS
SELECT r.*, se.event_name AS archived_event_name, now() AS archived_at
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE (se.event_name = 'Toe Lift' AND r.time_seconds IS NULL)
   OR (se.event_name = 'Tibialis Curl' AND r.difficulty_tier IS NULL);
ALTER TABLE public.results_toe_tib_archive_20260928201510 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_toe_tib_archive_20260928201510 FROM anon, authenticated;

CREATE TABLE public.workout_entries_toe_tib_archive_20260928201510 AS
SELECT e.*, now() AS archived_at
FROM workout_entries e
WHERE (e.event_slug = 'toe-lift' AND e.time_seconds IS NULL)
   OR (e.event_slug = 'tibialis-curl' AND e.difficulty_tier IS NULL);
ALTER TABLE public.workout_entries_toe_tib_archive_20260928201510 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_toe_tib_archive_20260928201510 FROM anon, authenticated;

DELETE FROM results WHERE id IN (SELECT id FROM public.results_toe_tib_archive_20260928201510);
DELETE FROM workout_entries WHERE id IN (SELECT id FROM public.workout_entries_toe_tib_archive_20260928201510);

-- ── 3. Replay event placements for closed sessions ───────────────────────────
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT t.session_id FROM touched_sessions t
    JOIN sessions ss ON ss.id = t.session_id
    -- A voided game must stay unplaced (20260910025855 and 20260915040534
    -- both filter it the same way); placing it would mint wins nobody earned.
    WHERE ss.is_active = false AND ss.voided_at IS NULL
  LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;

-- ── The server owns the encoding from now on ─────────────────────────────────
-- A phone still on the old bundle (players sit on the game screen for 100
-- minutes) would keep writing a load-only raw_score for lifts and old-scale
-- Toe Lift / Tib Curl rows, and nothing would ever correct them (Tāne, 29 Sept
-- 2026: guard it). So every write recomputes a lift's raw_score from its source
-- columns with the same expression as the re-encode above, and an old-format
-- Toe Lift or Tib Curl is refused with a message to refresh.
-- Named trg_zz_* so it fires AFTER the guard and band-stamp BEFORE triggers
-- (Postgres fires same-timing triggers in name order): the entries guard's
-- fitting-only check compares raw_score before this rewrites it.
-- __tests__/estimatedOneRm.test.ts pins both lists to lib/eventData.ts.
CREATE OR REPLACE FUNCTION public.enforce_lift_estimate()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_name text;
  v_slug text;
BEGIN
  IF TG_TABLE_NAME = 'results' THEN
    SELECT event_name INTO v_name FROM session_events WHERE id = NEW.event_id;
  ELSE
    v_slug := NEW.event_slug;
  END IF;

  IF v_name IN (
      '1A Press', 'Deadlift', 'Clean & Press', 'Pause Back Squat', 'Zercher Dead',
      'Pause Bench', 'Turkish Getup', 'Arthur Lift', 'Pause Row', 'Pause Front Squat',
      'Pullover & Press', 'Loaded Lunge', 'Kelly Snatch', '1A Snatch',
      'Clean & Jerk', 'Snatch')
     OR v_slug IN (
      'one-arm-press', 'deadlift', 'clean-and-press', 'pause-squat', 'zercher-deadlift',
      'pause-bench', 'turkish-get-up', 'arthur-lift', 'pause-row', 'pause-front-squat',
      'pullover-and-press', 'loaded-lunge', 'kelly-snatch', 'one-arm-snatch',
      'clean-and-jerk', 'snatch') THEN
    -- Only a row that already carries a score. An unfitted entry being fitted
    -- to a lift passes the entries guard as "fitting only" because its
    -- raw_score is unchanged (NULL); minting one here, after that check,
    -- would turn the exemption into a way to score a closed game.
    IF NEW.weight_kg > 0 AND NEW.raw_score IS NOT NULL THEN
      NEW.raw_score := CASE WHEN coalesce(NEW.reps, 1) > 1
        THEN round(round(NEW.weight_kg, 2) * 36 / (37 - least(NEW.reps, 10)), 1)
        ELSE NEW.weight_kg END;
    END IF;
  ELSIF (v_name = 'Toe Lift' OR v_slug = 'toe-lift') AND NEW.time_seconds IS NULL THEN
    RAISE EXCEPTION 'Toe Lift is now a load and a hold time: refresh the app and enter it again'
      USING ERRCODE = '22023';
  ELSIF (v_name = 'Tibialis Curl' OR v_slug = 'tibialis-curl') AND NEW.difficulty_tier IS NULL THEN
    RAISE EXCEPTION 'Tibialis Curl now has load levels: refresh the app and enter it again'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zz_lift_estimate_results ON public.results;
CREATE TRIGGER trg_zz_lift_estimate_results
  BEFORE INSERT OR UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lift_estimate();

DROP TRIGGER IF EXISTS trg_zz_lift_estimate_entries ON public.workout_entries;
CREATE TRIGGER trg_zz_lift_estimate_entries
  BEFORE INSERT OR UPDATE ON public.workout_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_lift_estimate();

-- ── A full recheck for everyone whose scores moved ───────────────────────────
UPDATE players SET grades_checked_at = NULL
WHERE id IN (SELECT player_id FROM touched_players WHERE player_id IS NOT NULL);

-- ── Assertions. A rewrite that silently fails must not report success. ───────
DO $$
DECLARE v_left int; v_off int; v_dupes int; v_voided int;
BEGIN
  SELECT count(*) INTO v_left
  FROM results r JOIN session_events se ON se.id = r.event_id
  WHERE (se.event_name = 'Toe Lift' AND r.time_seconds IS NULL)
     OR (se.event_name = 'Tibialis Curl' AND r.difficulty_tier IS NULL);
  SELECT v_left + count(*) INTO v_left
  FROM workout_entries
  WHERE (event_slug = 'toe-lift' AND time_seconds IS NULL)
     OR (event_slug = 'tibialis-curl' AND difficulty_tier IS NULL);
  IF v_left > 0 THEN
    RAISE EXCEPTION 'one-rep max: % Toe Lift / Tibialis Curl rows survived the delete', v_left;
  END IF;

  -- Every re-encoded lift now carries its estimate, and none dropped below its load.
  SELECT count(*) INTO v_off
  FROM results r
  WHERE r.id IN (SELECT id FROM public.results_one_rep_max_preimage_20260928201510)
    AND (r.raw_score IS DISTINCT FROM round(round(r.weight_kg, 2) * 36 / (37 - least(r.reps, 10)), 1)
         OR r.raw_score < r.weight_kg);
  IF v_off > 0 THEN
    RAISE EXCEPTION 'one-rep max: % re-encoded results do not match the estimate', v_off;
  END IF;

  SELECT count(*) INTO v_off
  FROM workout_entries e
  WHERE e.id IN (SELECT id FROM public.workout_entries_one_rep_max_preimage_20260928201510)
    AND (e.raw_score IS DISTINCT FROM round(round(e.weight_kg, 2) * 36 / (37 - least(e.reps, 10)), 1)
         OR e.raw_score < e.weight_kg);
  IF v_off > 0 THEN
    RAISE EXCEPTION 'one-rep max: % re-encoded workout entries do not match the estimate', v_off;
  END IF;

  -- One placed row per player per event per session, the 20260828204652 invariant.
  SELECT count(*) INTO v_dupes FROM (
    SELECT session_id, event_id, player_id FROM results
    WHERE event_placement IS NOT NULL AND player_id IS NOT NULL
    GROUP BY 1, 2, 3 HAVING count(*) > 1) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'one-rep max: % player-events hold two placed rows after the replay', v_dupes;
  END IF;

  SELECT count(*) INTO v_voided
  FROM results r JOIN sessions ss ON ss.id = r.session_id
  WHERE ss.voided_at IS NOT NULL AND r.event_placement IS NOT NULL
    AND r.session_id IN (SELECT session_id FROM touched_sessions);
  IF v_voided > 0 THEN
    RAISE EXCEPTION 'one-rep max: % rows in voided games carry a placement', v_voided;
  END IF;
END $$;
