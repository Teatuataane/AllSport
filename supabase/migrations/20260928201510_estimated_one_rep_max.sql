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
--   2. ARCHIVES then DELETES every Toe Lift and Tibialis Curl score.
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
-- scored in the gap are re-encoded here with everything else.

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
   OR se.event_name IN ('Toe Lift', 'Tibialis Curl');

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
WHERE se.event_name IN ('Toe Lift', 'Tibialis Curl');
ALTER TABLE public.results_toe_tib_archive_20260928201510 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_toe_tib_archive_20260928201510 FROM anon, authenticated;

CREATE TABLE public.workout_entries_toe_tib_archive_20260928201510 AS
SELECT e.*, now() AS archived_at
FROM workout_entries e
WHERE e.event_slug IN ('toe-lift', 'tibialis-curl');
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
    WHERE ss.is_active = false
  LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;

-- ── Assertions. A rewrite that silently fails must not report success. ───────
DO $$
DECLARE v_left int; v_off int; v_dupes int;
BEGIN
  SELECT count(*) INTO v_left
  FROM results r JOIN session_events se ON se.id = r.event_id
  WHERE se.event_name IN ('Toe Lift', 'Tibialis Curl');
  SELECT v_left + count(*) INTO v_left
  FROM workout_entries WHERE event_slug IN ('toe-lift', 'tibialis-curl');
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

  -- One placed row per player per event per session, the 20260828204652 invariant.
  SELECT count(*) INTO v_dupes FROM (
    SELECT session_id, event_id, player_id FROM results
    WHERE event_placement IS NOT NULL AND player_id IS NOT NULL
    GROUP BY 1, 2, 3 HAVING count(*) > 1) d;
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'one-rep max: % player-events hold two placed rows after the replay', v_dupes;
  END IF;
END $$;
