-- The 12 Oct 2026 levels review (Tāne), and High Jump scored by levels.
--
-- New ladders, compiled from EVENT_DIFFICULTY_REVIEW.md into lib/eventData.ts:
--   Repeat Vault      Ankles, Knees, Hips, Belly Button, Ribs, Chest, Shoulder, Head
--   Calf Raises       + Single Leg Calf Raise at D3
--   Side Bend         Side-Split Lateral replaced by Top Hand to Foot, Pancake Side Bend
--   Plie Squat        Seated Demi, Demi, Demi Squat, Partial Crossed Plie, Crossed Plie Squat
--   Seiza             seven levels, Supported Kneel to Rainbow Seiza
--   GHD Situp         Crunch, Sit Up, GHD Situp (Dead Bug and the weighted level gone)
--   Clap Pushups      seven levels, Elevated Knee Clap to Behind-Back Clap
--   Forward Fold      Bent Leg Fold, Straight Leg, Hands to Legs, Elbows to Legs, then as before
--   Full Bound Twist  + Assisted Bound Twist at D3
--   Diving            Dive, 1m, 2m, 5m Dive, Game
--   Pushups           D1 renamed Elevated Knee Pushup (was Hands Up Knee Pushup)
--   High Jump         was a height in cm; now twelve levels, the bar against the
--                     body (2 Feet Hop to Neck), scored on successful jumps
--
-- What production held on these events (checked 12 Oct 2026, results and
-- workout entries): Repeat Vault 2 Ankle / 3 Knee / 6 Hip height, Calf Raises
-- 2 Deficit, Seiza 1 Hips to Heels + 1 Reclined Kneel, GHD Situp 5 GHD Situp,
-- Forward Fold 7 Standing · Bent Knees + 1 Standing · Straight + 2 Fingertips
-- to Floor, Full Bound Twist 2 Seated Twist, Plie Squat 1 Demi, Pushups on
-- Knee/Elevated/Pushup/1 Arm only, and High Jump 2 results in centimetres.
--
-- Rows move by MOVEMENT, not position: a level that is the same movement under
-- a new name or index is mapped (level_map). Forward Fold's old Standing · Bent
-- Knees is the new Bent Leg Fold (D3 to D1) and Standing · Straight the new
-- Straight Leg (D4 to D2). GHD Situp's GHD Situp and Seiza's Reclined Kneel move
-- down one level because a level below them went. A row moves only while its
-- raw_score still sits in its OLD band, so a row the new bundle already wrote
-- is left alone, and a shift within a level by a constant keeps every player's
-- order. The label is rebuilt as 20260930011149 did.
--
-- Anything left on these events whose level no longer exists is archived, then
-- deleted, then placements are replayed. That is the two High Jump results:
-- a height in centimetres cannot be put on a ladder measured against each
-- jumper's body. The archive keeps them.
--
-- enforce_relevelled_ladders is redefined LAST, whole, with every earlier rule
-- kept: the ten re-levelled events and High Jump join its list, and Calf Raises
-- and Pushups carry their new ladders. __tests__/staminaRoster.test.ts pins its
-- list to lib/eventData.ts.
--
-- Nothing else here: Swim's 200m reference is code only (no swim had been
-- scored), and the bodyweight-share standards on the weighted holds, reps and
-- carries are grading only (lib/standards.ts), stored scores are unchanged.
--
-- ORDER: after 20261012000618. DEPLOY THE CODE FIRST, then apply this straight
-- after, with no game or workout running. In the gap the new bundle reads an
-- old-band row on these events as the wrong level for display, and grading
-- ignores a row whose stored level is not the ladder's name at its band, so
-- nothing is conferred wrongly. AFTER applying: ask kaiwhakawā to hard-refresh,
-- then run scripts/refresh-leaderboard-scores.ts --apply (the standards changed).

BEGIN;

-- A draw with no slug is invisible to every step below, which find rows by slug.
UPDATE session_events se SET event_slug = ed.slug
  FROM event_domains ed
 WHERE se.event_slug IS NULL AND ed.event_name = se.event_name
   AND se.event_name IN ('Repeat Vault', 'Calf Raises', 'Side Bend', 'Plie Squat', 'Seiza', 'GHD Situp', 'Clap Pushups', 'Forward Fold', 'Full Bound Twist', 'Diving', 'Pushups', 'High Jump');

-- ─── The level map ───────────────────────────────────────────────────────────
-- 0-based indexes, as raw_score encodes them.
CREATE TEMP TABLE level_map (slug text, event_name text, old_tier text, new_tier text, old_idx int, new_idx int)
  ON COMMIT DROP;
INSERT INTO level_map VALUES
    ('repeat-high-jump', 'Repeat Vault', 'Ankle height', 'Ankles', 0, 0),
    ('repeat-high-jump', 'Repeat Vault', 'Knee height', 'Knees', 1, 1),
    ('repeat-high-jump', 'Repeat Vault', 'Hip height', 'Hips', 2, 2),
    ('repeat-high-jump', 'Repeat Vault', 'Belly Button Height', 'Belly Button', 3, 3),
    ('repeat-high-jump', 'Repeat Vault', 'Rib Height', 'Ribs', 4, 4),
    ('repeat-high-jump', 'Repeat Vault', 'Shoulder height', 'Shoulder', 5, 6),
    ('calf-raises', 'Calf Raises', 'Toe Calf Raise', 'Toe Calf Raise', 2, 3),
    ('calf-raises', 'Calf Raises', 'Single Leg Toe Raise', 'SL Toe Calf Raise', 3, 4),
    ('seiza', 'Seiza', 'Hips to Heels', 'Seiza', 1, 1),
    ('seiza', 'Seiza', 'Reclined Kneel', 'Reclined Seiza', 3, 2),
    ('ghd-situp', 'GHD Situp', 'Crunch', 'Crunch', 1, 0),
    ('ghd-situp', 'GHD Situp', 'Sit Up', 'Sit Up', 2, 1),
    ('ghd-situp', 'GHD Situp', 'GHD Situp', 'GHD Situp', 3, 2),
    ('clap-pushups', 'Clap Pushups', 'Knee Clap', 'Knee Clap', 0, 1),
    ('clap-pushups', 'Clap Pushups', 'Clap', 'Clap Pushups', 1, 3),
    ('clap-pushups', 'Clap Pushups', 'Chest Slap', 'Chest Slap', 2, 4),
    ('clap-pushups', 'Clap Pushups', 'Double Clap', 'Double Clap', 3, 5),
    ('clap-pushups', 'Clap Pushups', 'Behind-Back Clap', 'Behind-Back Clap', 4, 6),
    ('forward-fold', 'Forward Fold', 'Standing · Bent Knees', 'Bent Leg Fold', 2, 0),
    ('forward-fold', 'Forward Fold', 'Standing · Straight', 'Straight Leg', 3, 1),
    ('full-bound-twist', 'Full Bound Twist', 'Bound Twist', 'Bound Twist', 2, 3),
    ('full-bound-twist', 'Full Bound Twist', 'Full Bound Twist', 'Full Bound Twist', 3, 4),
    ('push-up-contest', 'Pushups', 'Hands Up Knee Pushup', 'Elevated Knee Pushup', 0, 0);

-- The new ladders, for telling a row that is already right from one that is lost.
CREATE TEMP TABLE new_levels (slug text, event_name text, tier text, idx int) ON COMMIT DROP;
INSERT INTO new_levels VALUES
    ('repeat-high-jump', 'Repeat Vault', 'Ankles', 0),
    ('repeat-high-jump', 'Repeat Vault', 'Knees', 1),
    ('repeat-high-jump', 'Repeat Vault', 'Hips', 2),
    ('repeat-high-jump', 'Repeat Vault', 'Belly Button', 3),
    ('repeat-high-jump', 'Repeat Vault', 'Ribs', 4),
    ('repeat-high-jump', 'Repeat Vault', 'Chest', 5),
    ('repeat-high-jump', 'Repeat Vault', 'Shoulder', 6),
    ('repeat-high-jump', 'Repeat Vault', 'Head', 7),
    ('calf-raises', 'Calf Raises', 'Calf Raise', 0),
    ('calf-raises', 'Calf Raises', 'Deficit Calf Raise', 1),
    ('calf-raises', 'Calf Raises', 'Single Leg Calf Raise', 2),
    ('calf-raises', 'Calf Raises', 'Toe Calf Raise', 3),
    ('calf-raises', 'Calf Raises', 'SL Toe Calf Raise', 4),
    ('side-bend', 'Side Bend', 'Standing Bend', 0),
    ('side-bend', 'Side Bend', 'Gate Pose', 1),
    ('side-bend', 'Side Bend', 'Seated Bend', 2),
    ('side-bend', 'Side Bend', 'Top Hand to Foot', 3),
    ('side-bend', 'Side Bend', 'Pancake Side Bend', 4),
    ('plie-squat', 'Plie Squat', 'Seated Demi', 0),
    ('plie-squat', 'Plie Squat', 'Demi', 1),
    ('plie-squat', 'Plie Squat', 'Demi Squat', 2),
    ('plie-squat', 'Plie Squat', 'Partial Crossed Plie', 3),
    ('plie-squat', 'Plie Squat', 'Crossed Plie Squat', 4),
    ('seiza', 'Seiza', 'Supported Kneel', 0),
    ('seiza', 'Seiza', 'Seiza', 1),
    ('seiza', 'Seiza', 'Reclined Seiza', 2),
    ('seiza', 'Seiza', 'Elbows to Floor', 3),
    ('seiza', 'Seiza', 'Shoulders to Floor', 4),
    ('seiza', 'Seiza', 'Seiza Bridge', 5),
    ('seiza', 'Seiza', 'Rainbow Seiza', 6),
    ('ghd-situp', 'GHD Situp', 'Crunch', 0),
    ('ghd-situp', 'GHD Situp', 'Sit Up', 1),
    ('ghd-situp', 'GHD Situp', 'GHD Situp', 2),
    ('clap-pushups', 'Clap Pushups', 'Elevated Knee Clap', 0),
    ('clap-pushups', 'Clap Pushups', 'Knee Clap', 1),
    ('clap-pushups', 'Clap Pushups', 'Elevated Clap', 2),
    ('clap-pushups', 'Clap Pushups', 'Clap Pushups', 3),
    ('clap-pushups', 'Clap Pushups', 'Chest Slap', 4),
    ('clap-pushups', 'Clap Pushups', 'Double Clap', 5),
    ('clap-pushups', 'Clap Pushups', 'Behind-Back Clap', 6),
    ('forward-fold', 'Forward Fold', 'Bent Leg Fold', 0),
    ('forward-fold', 'Forward Fold', 'Straight Leg', 1),
    ('forward-fold', 'Forward Fold', 'Hands to Legs', 2),
    ('forward-fold', 'Forward Fold', 'Elbows to Legs', 3),
    ('forward-fold', 'Forward Fold', 'Fingertips to Floor', 4),
    ('forward-fold', 'Forward Fold', 'Palms to Floor', 5),
    ('forward-fold', 'Forward Fold', 'Elbows to Toes', 6),
    ('forward-fold', 'Forward Fold', 'Head to Legs', 7),
    ('full-bound-twist', 'Full Bound Twist', 'Seated Twist', 0),
    ('full-bound-twist', 'Full Bound Twist', 'Half Lord', 1),
    ('full-bound-twist', 'Full Bound Twist', 'Assisted Bound Twist', 2),
    ('full-bound-twist', 'Full Bound Twist', 'Bound Twist', 3),
    ('full-bound-twist', 'Full Bound Twist', 'Full Bound Twist', 4),
    ('diving', 'Diving', 'Dive', 0),
    ('diving', 'Diving', '1m Dive', 1),
    ('diving', 'Diving', '2m Dive', 2),
    ('diving', 'Diving', '5m Dive', 3),
    ('diving', 'Diving', 'Game', 4),
    ('push-up-contest', 'Pushups', 'Elevated Knee Pushup', 0),
    ('push-up-contest', 'Pushups', 'Knee Pushup', 1),
    ('push-up-contest', 'Pushups', 'Elevated Pushup', 2),
    ('push-up-contest', 'Pushups', 'Pushup', 3),
    ('push-up-contest', 'Pushups', '1 Arm Pushup', 4),
    ('high-jump', 'High Jump', '2 Feet Hop', 0),
    ('high-jump', 'High Jump', '1 Foot Hop', 1),
    ('high-jump', 'High Jump', 'Ankles', 2),
    ('high-jump', 'High Jump', 'Shins', 3),
    ('high-jump', 'High Jump', 'Knees', 4),
    ('high-jump', 'High Jump', 'Thighs', 5),
    ('high-jump', 'High Jump', 'Hips', 6),
    ('high-jump', 'High Jump', 'Belly Button', 7),
    ('high-jump', 'High Jump', 'Ribs', 8),
    ('high-jump', 'High Jump', 'Chest', 9),
    ('high-jump', 'High Jump', 'Shoulder', 10),
    ('high-jump', 'High Jump', 'Neck', 11);

-- Every scored row on these events, with its event's slug.
CREATE TEMP TABLE levelled_rows ON COMMIT DROP AS
SELECT 'r'::text AS src, r.id, r.session_id, r.player_id, se.event_slug AS slug, r.difficulty_tier AS tier, r.raw_score
FROM results r JOIN session_events se ON se.id = r.event_id
WHERE se.event_slug IN (SELECT DISTINCT slug FROM new_levels) AND r.raw_score IS NOT NULL
UNION ALL
SELECT 'e', e.id, NULL, w.player_id, e.event_slug, e.difficulty_tier, e.raw_score
FROM workout_entries e JOIN workouts w ON w.id = e.workout_id
WHERE e.event_slug IN (SELECT DISTINCT slug FROM new_levels) AND e.raw_score IS NOT NULL;

-- Rows to shift: an old label still in its OLD band.
CREATE TEMP TABLE shifts ON COMMIT DROP AS
SELECT l.src, l.id, l.session_id, l.player_id, m.new_tier, m.new_idx, (m.new_idx - m.old_idx) * 10000 AS delta
FROM levelled_rows l
JOIN level_map m ON m.slug = l.slug AND m.old_tier = l.tier
WHERE floor(l.raw_score / 10000) = m.old_idx
  AND (m.new_idx <> m.old_idx OR m.new_tier <> m.old_tier);

-- Rows with no level on the new ladder (High Jump's old heights carry none).
CREATE TEMP TABLE doomed ON COMMIT DROP AS
SELECT l.* FROM levelled_rows l
WHERE NOT EXISTS (SELECT 1 FROM level_map m WHERE m.slug = l.slug AND m.old_tier = l.tier
                    AND floor(l.raw_score / 10000) = m.old_idx)
  AND NOT EXISTS (SELECT 1 FROM new_levels n WHERE n.slug = l.slug AND n.tier = l.tier
                    AND floor(l.raw_score / 10000) = n.idx);

CREATE TABLE public.results_levels_review_preimage_20261012004834 AS
SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, now() AS captured_at
FROM results r WHERE r.id IN (SELECT id FROM shifts WHERE src = 'r');
ALTER TABLE public.results_levels_review_preimage_20261012004834 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_levels_review_preimage_20261012004834 FROM anon, authenticated;

CREATE TABLE public.workout_entries_levels_review_preimage_20261012004834 AS
SELECT e.id, e.raw_score, e.difficulty_tier, e.score_label, now() AS captured_at
FROM workout_entries e WHERE e.id IN (SELECT id FROM shifts WHERE src = 'e');
ALTER TABLE public.workout_entries_levels_review_preimage_20261012004834 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_levels_review_preimage_20261012004834 FROM anon, authenticated;

CREATE TABLE public.results_levels_review_archive_20261012004834 AS
SELECT r.*, se.event_name AS archived_event_name, now() AS archived_at
FROM results r JOIN session_events se ON se.id = r.event_id
WHERE r.id IN (SELECT id FROM doomed WHERE src = 'r');
ALTER TABLE public.results_levels_review_archive_20261012004834 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_levels_review_archive_20261012004834 FROM anon, authenticated;

CREATE TABLE public.workout_entries_levels_review_archive_20261012004834 AS
SELECT e.*, now() AS archived_at
FROM workout_entries e WHERE e.id IN (SELECT id FROM doomed WHERE src = 'e');
ALTER TABLE public.workout_entries_levels_review_archive_20261012004834 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_levels_review_archive_20261012004834 FROM anon, authenticated;

DO $$
DECLARE v_shift int; v_doomed int; v_cited int;
BEGIN
  SELECT count(*) INTO v_shift FROM shifts;
  SELECT count(*) INTO v_doomed FROM doomed;
  SELECT count(*) INTO v_cited FROM grade_awards
   WHERE events && ARRAY['repeat-high-jump', 'calf-raises', 'side-bend', 'plie-squat', 'seiza', 'ghd-situp', 'clap-pushups', 'forward-fold', 'full-bound-twist', 'diving', 'push-up-contest', 'high-jump'];
  RAISE NOTICE 'levels review: % rows re-levelled, % archived; % conferred colours cite a re-levelled event (they stand: a recheck never withdraws)',
    v_shift, v_doomed, v_cited;
END $$;

UPDATE results r SET raw_score = r.raw_score + s.delta, difficulty_tier = s.new_tier,
       score_label = 'D' || (s.new_idx + 1) || ' ' || s.new_tier
         || CASE WHEN position(' · ' in r.score_label) > 0
                 THEN substring(r.score_label from position(' · ' in r.score_label)) ELSE '' END
  FROM shifts s WHERE s.src = 'r' AND s.id = r.id;
UPDATE workout_entries e SET raw_score = e.raw_score + s.delta, difficulty_tier = s.new_tier,
       score_label = 'D' || (s.new_idx + 1) || ' ' || s.new_tier
         || CASE WHEN position(' · ' in e.score_label) > 0
                 THEN substring(e.score_label from position(' · ' in e.score_label)) ELSE '' END
  FROM shifts s WHERE s.src = 'e' AND s.id = e.id;

DELETE FROM results WHERE id IN (SELECT id FROM doomed WHERE src = 'r');
DELETE FROM workout_entries WHERE id IN (SELECT id FROM doomed WHERE src = 'e');

-- Replay placements where a row moved or went. A shift keeps order, so this
-- only changes anything where a row was deleted.
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT DISTINCT x.session_id FROM (
      SELECT session_id FROM shifts WHERE src = 'r'
      UNION SELECT session_id FROM doomed WHERE src = 'r') x
    JOIN sessions ss ON ss.id = x.session_id
    WHERE ss.is_active = false AND ss.voided_at IS NULL
  LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;

-- ─── The guard, redefined whole (20261005012108) ─────────────────────────────
-- ADDED here: repeat-high-jump, side-bend, plie-squat, seiza, ghd-situp,
-- clap-pushups, forward-fold, full-bound-twist, diving and high-jump join the
-- list; calf-raises and push-up-contest carry their new ladders. An old-bundle
-- High Jump height (no level) is refused like any other unknown level.
CREATE OR REPLACE FUNCTION public.enforce_relevelled_ladders()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_slug text;
BEGIN
  -- On UPDATE only a change to the SCORE or the EVENT is checked. Placement
  -- writes at session close, band stamps and erasure's name rewrite must never
  -- be refused because of a row they did not change, or one bad row would stop
  -- a whole game from closing. Moving a row onto another event IS checked, or
  -- an old-format score could be repointed onto a re-levelled event unseen.
  -- (Separate IFs per table: a plpgsql expression naming NEW.event_id fails on
  -- workout_entries, which has no such column, even in a branch not taken.)
  IF TG_OP = 'UPDATE' AND NEW.raw_score IS NOT DISTINCT FROM OLD.raw_score
     AND NEW.difficulty_tier IS NOT DISTINCT FROM OLD.difficulty_tier THEN
    IF TG_TABLE_NAME = 'results' THEN
      IF NEW.event_id IS NOT DISTINCT FROM OLD.event_id THEN RETURN NEW; END IF;
    ELSIF NEW.event_slug IS NOT DISTINCT FROM OLD.event_slug THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_TABLE_NAME = 'results' THEN
    SELECT CASE
             WHEN event_slug IS NOT NULL THEN event_slug
             WHEN event_name IN ('L-Sit Hold', 'Compression') THEN 'l-sit-hold'
             WHEN event_name IN ('Pushup Contest', 'Pushups') THEN 'push-up-contest'
             WHEN event_name IN ('Wrist Stretch', 'Internal Wrist Stretch') THEN 'wrist-stretch'
             WHEN event_name IN ('Reverse Wrist Stretch', 'External Wrist Stretch') THEN 'reverse-wrist-stretch'
             WHEN event_name = 'Calf Raises' THEN 'calf-raises'
             WHEN event_name = 'Lunges' THEN 'lunges'
             WHEN event_name = 'Ab Rollout' THEN 'ab-wheel-rollout'
             WHEN event_name = 'Shoulder Dislocate' THEN 'shoulder-dislocate'
             -- ADDED 20261005012108: any other draw with no slug, by its name.
             ELSE (SELECT ed.slug FROM event_domains ed WHERE ed.event_name = session_events.event_name LIMIT 1)
           END
      INTO v_slug FROM session_events WHERE id = NEW.event_id;
  ELSE
    v_slug := NEW.event_slug;
  END IF;

  IF TG_OP = 'INSERT' AND v_slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate') THEN
    RAISE EXCEPTION 'That event is no longer on the roster, so it cannot be scored. Refresh the app'
      USING ERRCODE = '22023';
  END IF;


  -- ADDED 20261005012108: these events lost their levels on 5 Oct 2026, so any
  -- score that still names one comes from the old bundle and would decode as a
  -- number on the wrong scale (a Timed sprint as a result, a 1000m rung as a
  -- predicted time). The thirteen contests must also be a bare 0, 1 or 2.
  IF v_slug IN ('arm-wrestling', 'tug-of-war', '100m-sprint', 'tag', 't-race', 'beach-flags',
       '200m-sprint', 'rats-and-rabbits', 'speed-chess', 'capture-the-flag', 'kabaddi',
       'tae-kwon-do', 'fencing', 'javelin-throw', 'shot-put', 'running', 'cycling', 'ski-erg',
       'row-erg', 'scooting', 'sandbag-carry', 'farmer-carry', 'weighted-drag',
       'tibialis-curl')
     AND NEW.raw_score IS NOT NULL AND NEW.difficulty_tier IS NOT NULL THEN
    RAISE EXCEPTION 'That event no longer has levels: refresh the app and enter the score again'
      USING ERRCODE = '22023';
  END IF;
  IF v_slug IN ('arm-wrestling', 'tug-of-war', '100m-sprint', 'tag', 't-race', 'beach-flags',
       '200m-sprint', 'rats-and-rabbits', 'speed-chess', 'capture-the-flag', 'kabaddi',
       'tae-kwon-do', 'fencing')
     AND NEW.raw_score IS NOT NULL AND NEW.raw_score NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'That event is now a win, draw or loss: refresh the app and enter the result again'
      USING ERRCODE = '22023';
  END IF;

  IF v_slug IN ('l-sit-hold', 'push-up-contest', 'calf-raises', 'wrist-stretch',
       'reverse-wrist-stretch', 'iron-cross', 'finger-push-up', 'middle-split', 'pancake',
       'touch-rugby', 'american-football', 'rope-climb', 'breakdancing', 'trampolining',
       'jump-rope', 'gymnastics', 'skate', 'foot-juggling', 'slackline', 'volleyball', 'baseball',
       'teqball', 'tennis', 'cricket', 'netball', 'darts', 'disc-golf', 'golf', 'table-tennis',
       'animal-crawl', 'repeat-high-jump', 'side-bend', 'plie-squat', 'seiza', 'ghd-situp',
       'clap-pushups', 'forward-fold', 'full-bound-twist', 'diving', 'high-jump')
     AND NEW.raw_score IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM (VALUES
         ('l-sit-hold', 'Curl Up', 0), ('l-sit-hold', 'V Up', 1), ('l-sit-hold', 'Tuck Hold', 2), ('l-sit-hold', 'L Sit', 3), ('l-sit-hold', 'V Sit', 4),
         ('push-up-contest', 'Elevated Knee Pushup', 0), ('push-up-contest', 'Knee Pushup', 1), ('push-up-contest', 'Elevated Pushup', 2), ('push-up-contest', 'Pushup', 3), ('push-up-contest', '1 Arm Pushup', 4),
         ('calf-raises', 'Calf Raise', 0), ('calf-raises', 'Deficit Calf Raise', 1), ('calf-raises', 'Single Leg Calf Raise', 2), ('calf-raises', 'Toe Calf Raise', 3), ('calf-raises', 'SL Toe Calf Raise', 4),
         ('wrist-stretch', 'Hand Assisted', 0), ('wrist-stretch', 'Hand Forward', 1), ('wrist-stretch', 'Fingers Inwards', 2), ('wrist-stretch', 'Fingers Backwards', 3), ('wrist-stretch', 'Backwards Plank', 4),
         ('reverse-wrist-stretch', 'Hand Assisted', 0), ('reverse-wrist-stretch', 'Fingers Outwards', 1), ('reverse-wrist-stretch', 'Fingers Backwards', 2), ('reverse-wrist-stretch', 'Fingers Inwards', 3), ('reverse-wrist-stretch', 'Inwards Plank', 4),
         ('iron-cross', '2 Feet Top Hold', 0), ('iron-cross', 'Straight Bar Top Hold', 1), ('iron-cross', 'Ring Top Hold', 2), ('iron-cross', 'Elbow Iron Cross', 3), ('iron-cross', 'Forearm Iron Cross', 4), ('iron-cross', 'Banded Iron Cross', 5), ('iron-cross', 'Iron Cross', 6),
         ('finger-push-up', 'Elevated Knee', 0), ('finger-push-up', 'Knee Finger Pushup', 1), ('finger-push-up', 'Finger Pushup', 2), ('finger-push-up', '1 Arm Finger Pushup', 3),
         ('middle-split', '3 Blocks', 0), ('middle-split', '2 Blocks', 1), ('middle-split', '1.5 Blocks', 2), ('middle-split', '1 Block', 3), ('middle-split', '0.5 Blocks', 4), ('middle-split', 'Middle Split', 5),
         ('pancake', '3 Blocks', 0), ('pancake', '2 Blocks', 1), ('pancake', '1.5 Blocks', 2), ('pancake', '1 Block', 3), ('pancake', '0.5 Blocks', 4), ('pancake', 'Elbows to Floor', 5), ('pancake', 'Head to Floor', 6),
         ('touch-rugby', 'Passes', 0), ('touch-rugby', 'Pass (2m)', 1), ('touch-rugby', 'Pass (5m)', 2), ('touch-rugby', 'Pass (10m)', 3), ('touch-rugby', 'Game', 4),
         ('american-football', 'Passes', 0), ('american-football', 'Pass (2m)', 1), ('american-football', 'Pass (5m)', 2), ('american-football', 'Pass (10m)', 3), ('american-football', 'Pass (20m)', 4), ('american-football', 'Game', 5),
         ('rope-climb', 'Assisted Hang', 0), ('rope-climb', 'Hang', 1), ('rope-climb', 'No Feet Hang', 2), ('rope-climb', 'Feet Assisted Climb', 3), ('rope-climb', 'No Feet Climb', 4), ('rope-climb', 'Game', 5),
         ('breakdancing', 'Top Rock', 0), ('breakdancing', 'Footwork', 1), ('breakdancing', 'Top Rock + Footwork', 2), ('breakdancing', 'Top Rock + Footwork + Freeze', 3), ('breakdancing', 'Game', 4),
         ('trampolining', 'Basic Bounce', 0), ('trampolining', 'Bounce to Butt', 1), ('trampolining', '360 Spin', 2), ('trampolining', 'Forward Flip', 3), ('trampolining', 'Back Flip', 4), ('trampolining', 'Game', 5),
         ('jump-rope', 'Basic Two-Foot Jump', 0), ('jump-rope', 'Single Dutch', 1), ('jump-rope', 'Double Dutch', 2), ('jump-rope', 'Game', 3),
         ('gymnastics', 'Forward Roll', 0), ('gymnastics', 'Backward Roll', 1), ('gymnastics', 'Cartwheel', 2), ('gymnastics', 'Handspring', 3), ('gymnastics', 'Game', 4),
         ('skate', 'Board Tilts', 0), ('skate', '360 Spin', 1), ('skate', 'Ollie', 2), ('skate', 'Pop Shove It', 3), ('skate', 'Game', 4),
         ('foot-juggling', '2 Bounce', 0), ('foot-juggling', '1 Bounce', 1), ('foot-juggling', 'No Bounce', 2), ('foot-juggling', 'Game', 3),
         ('slackline', 'Single Leg Balance', 0), ('slackline', 'Beam', 1), ('slackline', 'Slackline', 2), ('slackline', 'Game', 3),
         ('volleyball', 'Dig Passes (2m)', 0), ('volleyball', 'Dig Passes (5m)', 1), ('volleyball', 'Partner Digs (10m)', 2), ('volleyball', 'Partner Digs (20m)', 3), ('volleyball', 'Game', 4),
         ('baseball', 'Bat & Catch', 0), ('baseball', 'Bat & Catch (2m)', 1), ('baseball', 'Bat & Catch (5m)', 2), ('baseball', 'Bat & Catch (10m)', 3), ('baseball', 'Bat & Catch (20m)', 4), ('baseball', 'Game', 5),
         ('teqball', 'Bounce Pass', 0), ('teqball', 'Bounce Pass (2m)', 1), ('teqball', 'Bounce Pass (5m)', 2), ('teqball', 'Game', 3),
         ('tennis', 'Vertical Juggles', 0), ('tennis', 'Hits (2m)', 1), ('tennis', 'Hits (5m)', 2), ('tennis', 'Hits (10m)', 3), ('tennis', 'Game', 4),
         ('cricket', 'Bat & Catch', 0), ('cricket', 'Bat & Catch (2m)', 1), ('cricket', 'Bat & Catch (5m)', 2), ('cricket', 'Bat & Catch (10m)', 3), ('cricket', 'Bat & Catch (20m)', 4), ('cricket', 'Game', 5),
         ('netball', 'Shot Under Hoop', 0), ('netball', 'Shot (2m)', 1), ('netball', 'Shot (5m)', 2), ('netball', 'Game', 3),
         ('darts', 'Hit the Board', 0), ('darts', 'Named Number', 1), ('darts', 'Game', 2),
         ('disc-golf', 'Putt (2m)', 0), ('disc-golf', 'Putt (5m)', 1), ('disc-golf', 'Putt (10m)', 2), ('disc-golf', 'Game', 3),
         ('golf', 'Putt (2m)', 0), ('golf', 'Putt (5m)', 1), ('golf', 'Chip (10m)', 2), ('golf', 'Game', 3),
         ('table-tennis', 'Vertical Juggles', 0), ('table-tennis', 'Wall Juggles', 1), ('table-tennis', 'Game', 2),
         ('animal-crawl', 'Crawl', 0), ('animal-crawl', 'Bear Crawl', 1), ('animal-crawl', 'Lizard Crawl', 2), ('animal-crawl', 'Duck Walk', 3),
         ('repeat-high-jump', 'Ankles', 0), ('repeat-high-jump', 'Knees', 1), ('repeat-high-jump', 'Hips', 2), ('repeat-high-jump', 'Belly Button', 3), ('repeat-high-jump', 'Ribs', 4), ('repeat-high-jump', 'Chest', 5), ('repeat-high-jump', 'Shoulder', 6), ('repeat-high-jump', 'Head', 7),
         ('side-bend', 'Standing Bend', 0), ('side-bend', 'Gate Pose', 1), ('side-bend', 'Seated Bend', 2), ('side-bend', 'Top Hand to Foot', 3), ('side-bend', 'Pancake Side Bend', 4),
         ('plie-squat', 'Seated Demi', 0), ('plie-squat', 'Demi', 1), ('plie-squat', 'Demi Squat', 2), ('plie-squat', 'Partial Crossed Plie', 3), ('plie-squat', 'Crossed Plie Squat', 4),
         ('seiza', 'Supported Kneel', 0), ('seiza', 'Seiza', 1), ('seiza', 'Reclined Seiza', 2), ('seiza', 'Elbows to Floor', 3), ('seiza', 'Shoulders to Floor', 4), ('seiza', 'Seiza Bridge', 5), ('seiza', 'Rainbow Seiza', 6),
         ('ghd-situp', 'Crunch', 0), ('ghd-situp', 'Sit Up', 1), ('ghd-situp', 'GHD Situp', 2),
         ('clap-pushups', 'Elevated Knee Clap', 0), ('clap-pushups', 'Knee Clap', 1), ('clap-pushups', 'Elevated Clap', 2), ('clap-pushups', 'Clap Pushups', 3), ('clap-pushups', 'Chest Slap', 4), ('clap-pushups', 'Double Clap', 5), ('clap-pushups', 'Behind-Back Clap', 6),
         ('forward-fold', 'Bent Leg Fold', 0), ('forward-fold', 'Straight Leg', 1), ('forward-fold', 'Hands to Legs', 2), ('forward-fold', 'Elbows to Legs', 3), ('forward-fold', 'Fingertips to Floor', 4), ('forward-fold', 'Palms to Floor', 5), ('forward-fold', 'Elbows to Toes', 6), ('forward-fold', 'Head to Legs', 7),
         ('full-bound-twist', 'Seated Twist', 0), ('full-bound-twist', 'Half Lord', 1), ('full-bound-twist', 'Assisted Bound Twist', 2), ('full-bound-twist', 'Bound Twist', 3), ('full-bound-twist', 'Full Bound Twist', 4),
         ('diving', 'Dive', 0), ('diving', '1m Dive', 1), ('diving', '2m Dive', 2), ('diving', '5m Dive', 3), ('diving', 'Game', 4),
         ('high-jump', '2 Feet Hop', 0), ('high-jump', '1 Foot Hop', 1), ('high-jump', 'Ankles', 2), ('high-jump', 'Shins', 3), ('high-jump', 'Knees', 4), ('high-jump', 'Thighs', 5), ('high-jump', 'Hips', 6), ('high-jump', 'Belly Button', 7), ('high-jump', 'Ribs', 8), ('high-jump', 'Chest', 9), ('high-jump', 'Shoulder', 10), ('high-jump', 'Neck', 11)
       ) AS lv(slug, tier, idx)
       WHERE lv.slug = v_slug AND lv.tier = NEW.difficulty_tier
         AND floor(NEW.raw_score / 10000) = lv.idx) THEN
    RAISE EXCEPTION 'That level has changed: refresh the app and enter the score again'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

-- ─── Assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE v_n int;
BEGIN
  -- Every scored row on these events sits on a level of its new ladder, in its band.
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
  WHERE se.event_slug IN (SELECT DISTINCT slug FROM new_levels) AND r.raw_score IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM new_levels n WHERE n.slug = se.event_slug AND n.tier = r.difficulty_tier
                      AND floor(r.raw_score / 10000) = n.idx);
  IF v_n > 0 THEN RAISE EXCEPTION 'levels review: % results are not on a level of their new ladder', v_n; END IF;
  SELECT count(*) INTO v_n FROM workout_entries e
  WHERE e.event_slug IN (SELECT DISTINCT slug FROM new_levels) AND e.raw_score IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM new_levels n WHERE n.slug = e.event_slug AND n.tier = e.difficulty_tier
                      AND floor(e.raw_score / 10000) = n.idx);
  IF v_n > 0 THEN RAISE EXCEPTION 'levels review: % workout entries are not on a level of their new ladder', v_n; END IF;
  -- Every row moved or archived is accounted for.
  IF (SELECT count(*) FROM public.results_levels_review_archive_20261012004834)
     <> (SELECT count(*) FROM doomed WHERE src = 'r') THEN
    RAISE EXCEPTION 'levels review: the results archive does not match the rows removed';
  END IF;
END $$;

COMMIT;
