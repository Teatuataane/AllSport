-- One-Hand Banded level on Chin Hang and Skull Hang (Tāne, 18 Oct 2026).
--
-- The step from a two-hand hang to a one-hand hang was too large, so a level
-- with one hand AND band assistance now sits between them, at D4. Compiled
-- from EVENT_DIFFICULTY_REVIEW.md into lib/eventData.ts:
--   Chin Hang   Feet Assisted, Banded Hang, Two-Hand Chin Hang,
--               One-Hand Banded Chin Hang (NEW), One-Hand Chin Hang,
--               Banded Hands-Free, Chin Hang
--   Skull Hang  Feet Assisted, Banded Hang, Two-Hand Hang,
--               One-Hand Banded Hang (NEW), One-Hand Hang,
--               Banded Hands-Free, Free Hang
--
-- raw_score encodes the 0-based level index × 10000, so every stored row on
-- the old D4, D5 and D6 moves up one level (+10000), keeping its name and its
-- time. A shift by a constant keeps every player's order. A row moves only
-- while its raw_score still sits in its OLD band, so a row the new bundle
-- already wrote is left alone. The label is rebuilt as 20261012004834 did.
-- Nothing is deleted: every old level still exists.
--
-- The colour standards (lib/standards.ts) moved with their movements, so the
-- same hold earns the same colour before and after; the new level has no
-- colour of its own. Conferred colours are untouched.
--
-- enforce_relevelled_ladders is redefined LAST, whole, with every earlier rule
-- kept: chin-hang and skull-hang join its list with their new ladders.
-- __tests__/staminaRoster.test.ts pins its list to lib/eventData.ts.
--
-- ORDER: after 20261015004143. DEPLOY THE CODE FIRST, then apply this straight
-- after, with no game or workout running. In the gap the new bundle reads an
-- old-band row on these events as the level below it for display, and grading
-- ignores a row whose stored level is not the ladder's name at its band, so
-- nothing is conferred wrongly. AFTER applying: ask kaiwhakawā to hard-refresh,
-- then run scripts/refresh-leaderboard-scores.ts --apply (game colour totals
-- read the standards, which moved).

BEGIN;

-- A draw with no slug is invisible to every step below, which find rows by slug.
UPDATE session_events se SET event_slug = ed.slug
  FROM event_domains ed
 WHERE se.event_slug IS NULL AND ed.event_name = se.event_name
   AND se.event_name IN ('Chin Hang', 'Skull Hang');

-- ─── The level map ───────────────────────────────────────────────────────────
-- 0-based indexes, as raw_score encodes them.
CREATE TEMP TABLE level_map (slug text, event_name text, old_tier text, new_tier text, old_idx int, new_idx int)
  ON COMMIT DROP;
INSERT INTO level_map VALUES
    ('chin-hang', 'Chin Hang', 'One-Hand Chin Hang', 'One-Hand Chin Hang', 3, 4),
    ('chin-hang', 'Chin Hang', 'Banded Hands-Free', 'Banded Hands-Free', 4, 5),
    ('chin-hang', 'Chin Hang', 'Chin Hang', 'Chin Hang', 5, 6),
    ('skull-hang', 'Skull Hang', 'One-Hand Hang', 'One-Hand Hang', 3, 4),
    ('skull-hang', 'Skull Hang', 'Banded Hands-Free', 'Banded Hands-Free', 4, 5),
    ('skull-hang', 'Skull Hang', 'Free Hang', 'Free Hang', 5, 6);

-- The new ladders, for checking every row lands on one.
CREATE TEMP TABLE new_levels (slug text, event_name text, tier text, idx int) ON COMMIT DROP;
INSERT INTO new_levels VALUES
    ('chin-hang', 'Chin Hang', 'Feet Assisted', 0),
    ('chin-hang', 'Chin Hang', 'Banded Hang', 1),
    ('chin-hang', 'Chin Hang', 'Two-Hand Chin Hang', 2),
    ('chin-hang', 'Chin Hang', 'One-Hand Banded Chin Hang', 3),
    ('chin-hang', 'Chin Hang', 'One-Hand Chin Hang', 4),
    ('chin-hang', 'Chin Hang', 'Banded Hands-Free', 5),
    ('chin-hang', 'Chin Hang', 'Chin Hang', 6),
    ('skull-hang', 'Skull Hang', 'Feet Assisted', 0),
    ('skull-hang', 'Skull Hang', 'Banded Hang', 1),
    ('skull-hang', 'Skull Hang', 'Two-Hand Hang', 2),
    ('skull-hang', 'Skull Hang', 'One-Hand Banded Hang', 3),
    ('skull-hang', 'Skull Hang', 'One-Hand Hang', 4),
    ('skull-hang', 'Skull Hang', 'Banded Hands-Free', 5),
    ('skull-hang', 'Skull Hang', 'Free Hang', 6);

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
WHERE floor(l.raw_score / 10000) = m.old_idx;

CREATE TABLE public.results_hang_levels_preimage_20261017234440 AS
SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, now() AS captured_at
FROM results r WHERE r.id IN (SELECT id FROM shifts WHERE src = 'r');
ALTER TABLE public.results_hang_levels_preimage_20261017234440 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_hang_levels_preimage_20261017234440 FROM anon, authenticated;

CREATE TABLE public.workout_entries_hang_levels_preimage_20261017234440 AS
SELECT e.id, e.raw_score, e.difficulty_tier, e.score_label, now() AS captured_at
FROM workout_entries e WHERE e.id IN (SELECT id FROM shifts WHERE src = 'e');
ALTER TABLE public.workout_entries_hang_levels_preimage_20261017234440 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_hang_levels_preimage_20261017234440 FROM anon, authenticated;

DO $$
DECLARE v_shift int;
BEGIN
  SELECT count(*) INTO v_shift FROM shifts;
  RAISE NOTICE 'hang levels: % rows moved up one level', v_shift;
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

-- Replay placements where a row moved. A shift keeps order, so this should
-- change nothing; it is here so a game's stored placements match its scores.
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT DISTINCT x.session_id FROM shifts x
    JOIN sessions ss ON ss.id = x.session_id
    WHERE x.src = 'r' AND ss.is_active = false AND ss.voided_at IS NULL
  LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;

-- ─── The guard, redefined whole (20261012004834) ─────────────────────────────
-- ADDED here: chin-hang and skull-hang join the list with their new ladders.
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
       'clap-pushups', 'forward-fold', 'full-bound-twist', 'diving', 'high-jump',
       'chin-hang', 'skull-hang')
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
         ('high-jump', '2 Feet Hop', 0), ('high-jump', '1 Foot Hop', 1), ('high-jump', 'Ankles', 2), ('high-jump', 'Shins', 3), ('high-jump', 'Knees', 4), ('high-jump', 'Thighs', 5), ('high-jump', 'Hips', 6), ('high-jump', 'Belly Button', 7), ('high-jump', 'Ribs', 8), ('high-jump', 'Chest', 9), ('high-jump', 'Shoulder', 10), ('high-jump', 'Neck', 11),
         ('chin-hang', 'Feet Assisted', 0), ('chin-hang', 'Banded Hang', 1), ('chin-hang', 'Two-Hand Chin Hang', 2), ('chin-hang', 'One-Hand Banded Chin Hang', 3), ('chin-hang', 'One-Hand Chin Hang', 4), ('chin-hang', 'Banded Hands-Free', 5), ('chin-hang', 'Chin Hang', 6),
         ('skull-hang', 'Feet Assisted', 0), ('skull-hang', 'Banded Hang', 1), ('skull-hang', 'Two-Hand Hang', 2), ('skull-hang', 'One-Hand Banded Hang', 3), ('skull-hang', 'One-Hand Hang', 4), ('skull-hang', 'Banded Hands-Free', 5), ('skull-hang', 'Free Hang', 6)
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
  IF v_n > 0 THEN RAISE EXCEPTION 'hang levels: % results are not on a level of their new ladder', v_n; END IF;
  SELECT count(*) INTO v_n FROM workout_entries e
  WHERE e.event_slug IN (SELECT DISTINCT slug FROM new_levels) AND e.raw_score IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM new_levels n WHERE n.slug = e.event_slug AND n.tier = e.difficulty_tier
                      AND floor(e.raw_score / 10000) = n.idx);
  IF v_n > 0 THEN RAISE EXCEPTION 'hang levels: % workout entries are not on a level of their new ladder', v_n; END IF;
END $$;

COMMIT;
