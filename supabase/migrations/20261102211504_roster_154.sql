-- The 154-event roster, one list for everyone (Tāne, 3 Nov 2026).
--
-- Roster: 13 events leave (their results stay, and colours citing them stay,
-- protectedAwards in lib/autoConfer.ts), 19 arrive, Hollow Hold becomes Dragon
-- Flag in Calisthenics, and Chinups, Pushups, Table Tennis and Windshield Wipers
-- move. Domain 8 becomes Control and domain 10 becomes Aim.
--
-- Ladders: 40-odd ladders changed. A row whose level survives (by name, or as
-- the same movement renamed) moves to the new band. A row whose level is gone
-- stays as it is: the grading engine ignores a stored level that is not the
-- ladder's name at its band, so it is history, and no colour already conferred
-- is taken back. Pre-images are kept behind RLS.
--
-- Scoring: Burpee Broad Jump becomes an open distance on 100m, Sandbag to
-- Shoulder an estimated 1RM, High Jump a height (no rows). Swim's reference goes
-- to 400m (no rows).
--
-- ORDER: DEPLOY THE CODE FIRST, then apply this straight after, with no game or
-- workout running. AFTER applying: ask kaiwhakawā to hard-refresh, then run
-- scripts/refresh-leaderboard-scores.ts --apply (game colour totals read the
-- standards, which moved).

BEGIN;

-- A draw with no slug is invisible to every step below.
UPDATE session_events se SET event_slug = ed.slug
  FROM event_domains ed
 WHERE se.event_slug IS NULL AND ed.event_name = se.event_name;

-- ─── event_domains: the roster mirrored into SQL, 154 rows ───────────────────
-- Per domain: 1: 17, 2: 15, 3: 16, 4: 13, 5: 16, 6: 16, 7: 18, 8: 15, 9: 14, 10: 14.
DELETE FROM event_domains;
INSERT INTO event_domains (event_name, domain_number, slug) VALUES
  ('1A Press', 1, 'one-arm-press'),
  ('Arthur Lift', 1, 'arthur-lift'),
  ('Deadlift', 1, 'deadlift'),
  ('Glute Thrust', 1, 'glute-thrust'),
  ('Loaded Lunge', 1, 'loaded-lunge'),
  ('Overhead Press', 1, 'overhead-press'),
  ('Pause Back Squat', 1, 'pause-squat'),
  ('Pause Bench', 1, 'pause-bench'),
  ('Pause Dips', 1, 'pause-dips'),
  ('Pause Front Squat', 1, 'pause-front-squat'),
  ('Pause Row', 1, 'pause-row'),
  ('Plate Hold', 1, 'plate-hold'),
  ('Steinborn Lift', 1, 'steinborn'),
  ('Turkish Getup', 1, 'turkish-get-up'),
  ('Weighted Tuck', 1, 'weighted-tuck'),
  ('Wrestler Pullover', 1, 'wrestler-pullover'),
  ('Zercher Dead', 1, 'zercher-deadlift'),
  ('1 Leg Squat', 2, '1-leg-squat'),
  ('Back Lever', 2, 'back-lever'),
  ('Chin Hang', 2, 'chin-hang'),
  ('Chinups', 2, 'chin-up-contest'),
  ('Dragon Flag', 2, 'hollow-hold'),
  ('Front Lever', 2, 'front-lever'),
  ('Handstand', 2, 'hand-walk'),
  ('Headstand', 2, 'headstand'),
  ('Human Flag', 2, 'flag'),
  ('Iron Cross', 2, 'iron-cross'),
  ('L-Sit', 2, 'l-sit-hold'),
  ('Nordic Curl', 2, 'nordic-curl'),
  ('Planche', 2, 'planche'),
  ('Pushups', 2, 'push-up-contest'),
  ('Reverse Maltese', 2, 'reverse-maltese'),
  ('1A Snatch', 3, 'one-arm-snatch'),
  ('Arm Wrestling', 3, 'arm-wrestling'),
  ('Clap Pushups', 3, 'clap-pushups'),
  ('Clean & Jerk', 3, 'clean-and-jerk'),
  ('Discus', 3, 'discus'),
  ('High Jump', 3, 'high-jump'),
  ('Javelin', 3, 'javelin-throw'),
  ('Kelly Snatch', 3, 'kelly-snatch'),
  ('Mas Wrestling', 3, 'mas-wrestling'),
  ('Shotput', 3, 'shot-put'),
  ('Snatch', 3, 'snatch'),
  ('Standing Broad Jump', 3, 'standing-broad-jump'),
  ('Triple Jump', 3, 'triple-jump'),
  ('Tug of War', 3, 'tug-of-war'),
  ('Vertical Jump', 3, 'vertical-jump'),
  ('Wrestling', 3, 'wrestling'),
  ('American Football', 4, 'american-football'),
  ('Australian Football', 4, 'australian-football'),
  ('Beach Flags', 4, 'beach-flags'),
  ('Capture the Flag', 4, 'capture-the-flag'),
  ('Hurdles', 4, 'hurdles'),
  ('Kabaddi', 4, 'kabaddi'),
  ('Leapfrog', 4, 'repeat-high-jump'),
  ('Rats & Rabbits', 4, 'rats-and-rabbits'),
  ('Speed Chess', 4, 'speed-chess'),
  ('Sprint Race', 4, 'sprint-race'),
  ('T-Race', 4, 't-race'),
  ('Tag', 4, 'tag'),
  ('Touch Rugby', 4, 'touch-rugby'),
  ('Back Extension', 5, 'back-extension'),
  ('Calf Raises', 5, 'calf-raises'),
  ('Finger Pushup', 5, 'finger-push-up'),
  ('GHD Situp', 5, 'ghd-situp'),
  ('Hang', 5, 'hang'),
  ('Leg Extension Hold', 5, 'leg-extension'),
  ('OH Tricep Extension', 5, 'overhead-tricep-extension'),
  ('Overhead Raise', 5, 'overhead-raise'),
  ('Sandbag to Shoulder', 5, 'sandbag-to-shoulder'),
  ('Skullcrusher', 5, 'skullcrusher'),
  ('Strict Curl', 5, 'strict-curl'),
  ('Tibialis Curl', 5, 'tibialis-curl'),
  ('Toe Lift', 5, 'toe-lift'),
  ('Wall Sit', 5, 'wall-sit'),
  ('Windshield Wipers', 5, 'windshield-wipers'),
  ('Wrist Extension', 5, 'wrist-extension'),
  ('Animal Crawl', 6, 'animal-crawl'),
  ('Bronco', 6, 'bronco'),
  ('Burpee Broad Jump', 6, 'burpee-broad-jump'),
  ('Cycling', 6, 'cycling'),
  ('Farmer Carry', 6, 'farmer-carry'),
  ('Obstacle Course', 6, 'obstacle-course'),
  ('Row Erg', 6, 'row-erg'),
  ('Running', 6, 'running'),
  ('Sandbag Carry', 6, 'sandbag-carry'),
  ('Scooting', 6, 'scooting'),
  ('Ski Erg', 6, 'ski-erg'),
  ('Skipping Rope', 6, 'skipping-rope'),
  ('Swim', 6, 'swim'),
  ('Underwater Swim', 6, 'underwater-swim'),
  ('Walking', 6, 'walking'),
  ('Weighted Drag', 6, 'weighted-drag'),
  ('Bent Wrist Stretch', 7, 'bent-wrist-stretch'),
  ('Bridge', 7, 'bridge'),
  ('Butterfly Pose', 7, 'butterfly-pose'),
  ('Cheststand', 7, 'cheststand'),
  ('Cobra Pose', 7, 'cobra-pose'),
  ('Deep Squat', 7, 'deep-squat'),
  ('Foot Behind Head Pose', 7, 'foot-behind-head'),
  ('Forward Fold', 7, 'forward-fold'),
  ('Forward Split', 7, 'front-split'),
  ('Full Bound Twist', 7, 'full-bound-twist'),
  ('Middle Split', 7, 'middle-split'),
  ('Needle Pose', 7, 'needle-pose'),
  ('Pancake', 7, 'pancake'),
  ('Rear Hand Clasp', 7, 'rear-hand-clasp'),
  ('Seiza', 7, 'seiza'),
  ('Shoulder Dislocate', 7, 'shoulder-dislocate'),
  ('Side Bend', 7, 'side-bend'),
  ('Standing Split', 7, 'standing-split'),
  ('Balance Ball', 8, 'balance-ball'),
  ('Breakdancing', 8, 'breakdancing'),
  ('Climbing', 8, 'rope-climb'),
  ('Diving', 8, 'diving'),
  ('Fencing', 8, 'fencing'),
  ('Foot Juggling', 8, 'foot-juggling'),
  ('Gymnastics', 8, 'gymnastics'),
  ('Juggling', 8, 'juggling'),
  ('Jump Rope', 8, 'jump-rope'),
  ('Poi', 8, 'poi'),
  ('SKATE', 8, 'skate'),
  ('Slackline', 8, 'slackline'),
  ('Tae Kwon Do', 8, 'tae-kwon-do'),
  ('Trampolining', 8, 'trampolining'),
  ('Tī Rākau', 8, 'ti-rakau'),
  ('Badminton', 9, 'badminton'),
  ('Baseball', 9, 'baseball'),
  ('Basketball', 9, 'basketball'),
  ('Cricket', 9, 'cricket'),
  ('Football', 9, 'football'),
  ('Hockey', 9, 'hockey'),
  ('Lacrosse', 9, 'lacrosse'),
  ('Squash', 9, 'squash'),
  ('Table Tennis', 9, 'table-tennis'),
  ('Tennis', 9, 'tennis'),
  ('Teqball', 9, 'teqball'),
  ('Ultimate Frisbee', 9, 'ultimate-frisbee'),
  ('Volleyball', 9, 'volleyball'),
  ('Water Polo', 9, 'water-polo'),
  ('Airsoft/Nerf', 10, 'airsoft'),
  ('Archery', 10, 'archery'),
  ('Bocce', 10, 'bocce'),
  ('Bowling', 10, 'bowling'),
  ('Carrom', 10, 'carrom'),
  ('Cornhole', 10, 'cornhole'),
  ('Darts', 10, 'darts'),
  ('Disc Golf', 10, 'disc-golf'),
  ('Dodgeball', 10, 'dodgeball'),
  ('Goal Kicking', 10, 'goal-kicking'),
  ('Golf', 10, 'golf'),
  ('Handball', 10, 'handball'),
  ('Kubb', 10, 'kubb'),
  ('Netball', 10, 'netball');

-- ─── Aliases that pointed at a removed event ─────────────────────────────────
CREATE TABLE public.activity_aliases_preimage_20261102211504 AS
SELECT a.*, now() AS captured_at FROM activity_aliases a
 WHERE a.event_slug IN ('pause-chin-up', 'pullover-and-press', 'skull-hang', 'hamstring-curl', 'plie-squat', 'wrist-stretch', 'reverse-wrist-stretch', 'breath-hold', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'clean-and-press');
ALTER TABLE public.activity_aliases_preimage_20261102211504 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_aliases_preimage_20261102211504 FROM anon, authenticated;
UPDATE activity_aliases SET event_slug = 'sprint-race' WHERE alias IN ('sprint', 'sprints', 'sprinting', '100m', '200m');
DELETE FROM activity_aliases WHERE event_slug IN ('pause-chin-up', 'pullover-and-press', 'skull-hang', 'hamstring-curl', 'plie-squat', 'wrist-stretch', 'reverse-wrist-stretch', 'breath-hold', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'clean-and-press');

-- ─── The guards, each redefined whole from its newest definition ─────────────
-- ADDED here: the new ladders in enforce_relevelled_ladders, Sprint Race and
-- Hurdles as pure contests, the removed events refused. Shoulder Dislocate is
-- back on the roster so it leaves the refused list.
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
             WHEN event_name = 'Pause Chinup' THEN 'pause-chin-up'
             -- ADDED 20261005012108: any other draw with no slug, by its name.
             ELSE (SELECT ed.slug FROM event_domains ed WHERE ed.event_name = session_events.event_name LIMIT 1)
           END
      INTO v_slug FROM session_events WHERE id = NEW.event_id;
  ELSE
    v_slug := NEW.event_slug;
  END IF;

  IF TG_OP = 'INSERT' AND v_slug IN ('lunges', 'ab-wheel-rollout', 'pause-chin-up', 'pullover-and-press', 'skull-hang', 'hamstring-curl', 'plie-squat', 'wrist-stretch', 'reverse-wrist-stretch', 'breath-hold', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'clean-and-press') THEN
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
       'tibialis-curl', 'high-jump', 'sandbag-to-shoulder', 'burpee-broad-jump', 'sprint-race', 'hurdles')
     AND NEW.raw_score IS NOT NULL AND NEW.difficulty_tier IS NOT NULL THEN
    RAISE EXCEPTION 'That event no longer has levels: refresh the app and enter the score again'
      USING ERRCODE = '22023';
  END IF;
  IF v_slug IN ('arm-wrestling', 'tug-of-war', '100m-sprint', 'tag', 't-race', 'beach-flags',
       '200m-sprint', 'rats-and-rabbits', 'speed-chess', 'capture-the-flag', 'kabaddi',
       'tae-kwon-do', 'fencing', 'sprint-race', 'hurdles')
     AND NEW.raw_score IS NOT NULL AND NEW.raw_score NOT IN (0, 1, 2) THEN
    RAISE EXCEPTION 'That event is now a win, draw or loss: refresh the app and enter the result again'
      USING ERRCODE = '22023';
  END IF;

  IF v_slug IN ('airsoft', 'american-football', 'animal-crawl', 'archery', 'australian-football', 'back-lever', 'badminton', 'balance-ball', 'baseball', 'basketball', 'bent-wrist-stretch', 'bocce', 'bowling', 'breakdancing', 'bridge', 'butterfly-pose', 'calf-raises', 'carrom', 'cheststand', 'chin-hang', 'clap-pushups', 'cobra-pose', 'cornhole', 'cricket', 'darts', 'deep-squat', 'disc-golf', 'diving', 'finger-push-up', 'flag', 'foot-juggling', 'football', 'forward-fold', 'front-split', 'full-bound-twist', 'ghd-situp', 'goal-kicking', 'golf', 'gymnastics', 'handball', 'hang', 'hockey', 'iron-cross', 'jump-rope', 'kubb', 'l-sit-hold', 'lacrosse', 'middle-split', 'needle-pose', 'netball', 'nordic-curl', 'pancake', 'planche', 'push-up-contest', 'rear-hand-clasp', 'repeat-high-jump', 'rope-climb', 'seiza', 'shoulder-dislocate', 'side-bend', 'skate', 'skipping-rope', 'slackline', 'squash', 'table-tennis', 'tennis', 'teqball', 'ti-rakau', 'touch-rugby', 'trampolining', 'ultimate-frisbee', 'volleyball', 'water-polo', 'wrestler-pullover')
     AND NEW.raw_score IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM (VALUES
         ('airsoft', 'Shooting Drill', 0), ('airsoft', 'Game', 1),
         ('american-football', 'Passing Drill', 0), ('american-football', 'Game', 1),
         ('animal-crawl', 'Crawl', 0), ('animal-crawl', 'Bear Crawl', 1), ('animal-crawl', 'Lizard Crawl', 2), ('animal-crawl', 'Duck Walk', 3),
         ('archery', 'Shooting Drill', 0), ('archery', 'Game', 1),
         ('australian-football', 'Passing Drill', 0), ('australian-football', 'Game', 1),
         ('back-lever', 'Assisted Hang', 0), ('back-lever', 'Hang', 1), ('back-lever', 'Inverted Hang', 2), ('back-lever', 'German Hang', 3), ('back-lever', 'Tuck Back Lever', 4), ('back-lever', 'Back Lever', 5),
         ('badminton', 'Passing Drill', 0), ('badminton', 'Game', 1),
         ('balance-ball', 'Seated', 0), ('balance-ball', 'Kneeling', 1), ('balance-ball', 'Kneeling · No Hands', 2), ('balance-ball', 'Standing · With Hands', 3), ('balance-ball', 'Standing', 4), ('balance-ball', 'Game', 5),
         ('baseball', 'Bat and Catch Drill', 0), ('baseball', 'Game', 1),
         ('basketball', 'Dribbling Drill', 0), ('basketball', 'Game', 1),
         ('bent-wrist-stretch', 'Hand Assisted', 0), ('bent-wrist-stretch', 'Seated', 1), ('bent-wrist-stretch', 'Kneeling, Arms Straight', 2), ('bent-wrist-stretch', 'Knee Plank', 3), ('bent-wrist-stretch', 'Full Plank', 4), ('bent-wrist-stretch', '1 Arm Plank', 5),
         ('bocce', 'Shooting Drill', 0), ('bocce', 'Game', 1),
         ('bowling', 'Shooting Drill', 0), ('bowling', 'Game', 1),
         ('breakdancing', 'Top Rock + Footwork + Freeze', 0), ('breakdancing', 'Game', 1),
         ('bridge', 'Wall Assisted Bridge', 0), ('bridge', 'Headstand Bridge', 1), ('bridge', 'Bridge', 2), ('bridge', 'Straight Arm Bridge', 3), ('bridge', 'Rainbow Bridge', 4),
         ('butterfly-pose', 'High Butterfly', 0), ('butterfly-pose', 'Low Butterfly', 1), ('butterfly-pose', 'Elbows to Floor', 2), ('butterfly-pose', 'Head to Feet', 3), ('butterfly-pose', 'Chest to Floor', 4),
         ('calf-raises', 'Assisted Calf Raise', 0), ('calf-raises', 'Deficit Calf Raise', 1), ('calf-raises', 'Single Leg Calf Raise', 2), ('calf-raises', 'Toe Calf Raise', 3), ('calf-raises', 'SL Toe Calf Raise', 4),
         ('carrom', 'Shooting Drill', 0), ('carrom', 'Game', 1),
         ('cheststand', 'Puppy Pose', 0), ('cheststand', 'Puppy Pose, One Leg Up', 1), ('cheststand', 'Wall Supported Cheststand', 2), ('cheststand', 'Block Supported Cheststand', 3), ('cheststand', 'Cheststand', 4),
         ('chin-hang', 'Feet Assisted', 0), ('chin-hang', 'Banded Hang', 1), ('chin-hang', 'Two-Hand Chin Hang', 2), ('chin-hang', 'One-Hand Banded Chin Hang', 3), ('chin-hang', 'One-Hand Chin Hang', 4), ('chin-hang', 'Banded Hands-Free', 5), ('chin-hang', 'Chin Hang', 6),
         ('clap-pushups', 'Elevated Knee Clap', 0), ('clap-pushups', 'Knee Clap', 1), ('clap-pushups', 'Elevated Clap', 2), ('clap-pushups', 'Clap Pushups', 3), ('clap-pushups', 'Chest Slap', 4), ('clap-pushups', 'Double Clap', 5), ('clap-pushups', 'Behind-Back Clap', 6),
         ('cobra-pose', 'Sphinx Pose', 0), ('cobra-pose', 'Cobra Pose', 1), ('cobra-pose', 'Partial King Cobra Pose', 2), ('cobra-pose', 'King Cobra Pose', 3),
         ('cornhole', 'Shooting Drill', 0), ('cornhole', 'Game', 1),
         ('cricket', 'Bat and Catch Drill', 0), ('cricket', 'Game', 1),
         ('darts', 'Shooting Drill', 0), ('darts', 'Game', 1),
         ('deep-squat', 'Supported', 0), ('deep-squat', 'Heels Down', 1), ('deep-squat', 'Feet Together', 2), ('deep-squat', 'Overhead', 3), ('deep-squat', 'Feet Together Overhead', 4),
         ('disc-golf', 'Shooting Drill', 0), ('disc-golf', 'Game', 1),
         ('diving', 'Dive', 0), ('diving', '1m Dive', 1), ('diving', '2m Dive', 2), ('diving', 'Game', 3),
         ('finger-push-up', 'Elevated Knee', 0), ('finger-push-up', 'Knee Finger Pushup', 1), ('finger-push-up', 'Finger Pushup', 2), ('finger-push-up', '1 Arm Finger Pushup', 3),
         ('flag', 'Elevated Side Plank', 0), ('flag', 'Side Plank', 1), ('flag', '1 Leg Side Plank', 2), ('flag', 'Supported Flag', 3), ('flag', 'Tuck Flag', 4), ('flag', 'Full Flag', 5),
         ('foot-juggling', '2 Bounce', 0), ('foot-juggling', '1 Bounce', 1), ('foot-juggling', 'No Bounce', 2), ('foot-juggling', 'Game', 3),
         ('football', 'Passing Drill', 0), ('football', 'Game', 1),
         ('forward-fold', 'Bent Leg Fold', 0), ('forward-fold', 'Straight Leg', 1), ('forward-fold', 'Hands to Knees', 2), ('forward-fold', 'Hands to Feet', 3), ('forward-fold', 'Fingertips to Floor', 4), ('forward-fold', 'Palms to Floor', 5), ('forward-fold', 'Elbows to Toes', 6), ('forward-fold', 'Head to Legs', 7),
         ('front-split', '2 Blocks', 0), ('front-split', '1.5 Blocks', 1), ('front-split', '1 Block', 2), ('front-split', '0.5 Blocks', 3), ('front-split', 'Front Split', 4),
         ('full-bound-twist', 'Seated Twist', 0), ('full-bound-twist', 'Half Lord', 1), ('full-bound-twist', 'Semi Bound Twist', 2), ('full-bound-twist', 'Full Bound Twist', 3),
         ('ghd-situp', 'Crunch', 0), ('ghd-situp', 'Sit Up', 1), ('ghd-situp', 'GHD Situp', 2), ('ghd-situp', 'Weighted GHD Situp', 3),
         ('goal-kicking', 'Shooting Drill', 0), ('goal-kicking', 'Game', 1),
         ('golf', 'Shooting Drill', 0), ('golf', 'Game', 1),
         ('gymnastics', 'Forward Roll', 0), ('gymnastics', 'Back Roll', 1), ('gymnastics', 'Cartwheel', 2), ('gymnastics', 'Handspring', 3), ('gymnastics', 'Game', 4),
         ('handball', 'Shooting Drill', 0), ('handball', 'Game', 1),
         ('hang', 'Feet Assisted Hang', 0), ('hang', 'Two-Hand Hang', 1), ('hang', 'One-Arm Hang', 2),
         ('hockey', 'Passing Drill', 0), ('hockey', 'Game', 1),
         ('iron-cross', '2 Feet Top Hold', 0), ('iron-cross', 'Straight Bar Top Hold', 1), ('iron-cross', 'Ring Top Hold', 2), ('iron-cross', 'Elbow Iron Cross', 3), ('iron-cross', 'Forearm Iron Cross', 4), ('iron-cross', 'Banded Iron Cross', 5), ('iron-cross', 'Iron Cross', 6),
         ('jump-rope', 'Single Dutch', 0), ('jump-rope', 'Game', 1),
         ('kubb', 'Shooting Drill', 0), ('kubb', 'Game', 1),
         ('l-sit-hold', 'Curl Up', 0), ('l-sit-hold', 'V Up', 1), ('l-sit-hold', 'Tuck Hold', 2), ('l-sit-hold', 'L Sit', 3), ('l-sit-hold', 'V Sit', 4),
         ('lacrosse', 'Passing Drill', 0), ('lacrosse', 'Game', 1),
         ('middle-split', '3 Blocks', 0), ('middle-split', '2 Blocks', 1), ('middle-split', '1.5 Blocks', 2), ('middle-split', '1 Block', 3), ('middle-split', '0.5 Blocks', 4), ('middle-split', 'Middle Split', 5),
         ('needle-pose', 'Seated Quad Stretch', 0), ('needle-pose', 'Standing Quad Stretch', 1), ('needle-pose', 'Warrior Pose', 2), ('needle-pose', 'Wall Rear Split', 3), ('needle-pose', 'Band Assisted Needle', 4), ('needle-pose', 'Needle Pose', 5),
         ('netball', 'Shooting Drill', 0), ('netball', 'Game', 1),
         ('nordic-curl', 'Band Assisted', 0), ('nordic-curl', 'Isometric Hold', 1), ('nordic-curl', 'Half Nordic', 2), ('nordic-curl', 'Full Nordic', 3), ('nordic-curl', 'Arms Overhead', 4),
         ('pancake', '3 Blocks', 0), ('pancake', '2 Blocks', 1), ('pancake', '1.5 Blocks', 2), ('pancake', '1 Block', 3), ('pancake', '0.5 Blocks', 4), ('pancake', 'Elbows to Floor', 5), ('pancake', 'Head to Floor', 6),
         ('planche', 'Pseudo Planche Lean', 0), ('planche', 'Elevated Planche Lean', 1), ('planche', 'Paralette Hold', 2), ('planche', 'Tuck Planche', 3), ('planche', 'Banded Planche', 4), ('planche', 'Straddle Planche', 5), ('planche', 'Planche', 6),
         ('push-up-contest', 'Elevated Knee Pushup', 0), ('push-up-contest', 'Knee Pushup', 1), ('push-up-contest', 'Elevated Pushup', 2), ('push-up-contest', 'Pushup', 3), ('push-up-contest', '1 Arm Pushup', 4),
         ('rear-hand-clasp', 'Assisted Rear Clasp', 0), ('rear-hand-clasp', 'Finger Tips Touch', 1), ('rear-hand-clasp', 'Finger Clasp', 2), ('rear-hand-clasp', 'Palm Clasp', 3), ('rear-hand-clasp', 'Butterfly Clasp', 4),
         ('repeat-high-jump', '25cm', 0), ('repeat-high-jump', '50cm', 1), ('repeat-high-jump', '75cm', 2), ('repeat-high-jump', '100cm', 3), ('repeat-high-jump', '125cm', 4), ('repeat-high-jump', '150cm', 5), ('repeat-high-jump', '175cm', 6), ('repeat-high-jump', '200cm', 7),
         ('rope-climb', 'Climb Time Trial', 0), ('rope-climb', 'Game', 1),
         ('seiza', 'Supported Kneel', 0), ('seiza', 'Seiza', 1), ('seiza', 'Reclined Seiza', 2), ('seiza', 'Backbend Seiza', 3), ('seiza', 'Seiza Bridge', 4), ('seiza', 'Rainbow Seiza', 5),
         ('shoulder-dislocate', 'Band', 0), ('shoulder-dislocate', 'Stick, Very Wide (2× shoulder width)', 1), ('shoulder-dislocate', 'Stick, Wide (1.75×)', 2), ('shoulder-dislocate', 'Stick, Medium (1.5×)', 3), ('shoulder-dislocate', 'Stick, Narrow (1.25×)', 4),
         ('side-bend', 'Standing Bend', 0), ('side-bend', 'Gate Pose', 1), ('side-bend', 'Seated Bend', 2), ('side-bend', 'Half Straddle Side Bend', 3), ('side-bend', 'Pancake Side Bend', 4),
         ('skate', 'Board Tilts', 0), ('skate', '360 Spin', 1), ('skate', 'Ollie', 2), ('skate', 'Pop Shove It', 3), ('skate', 'Game', 4),
         ('skipping-rope', 'Two-Foot Skip', 0), ('skipping-rope', 'Double Unders', 1),
         ('slackline', 'Single Leg Balance', 0), ('slackline', 'Beam', 1), ('slackline', 'Slackline', 2), ('slackline', 'Game', 3),
         ('squash', 'Wall Drill', 0), ('squash', 'Game', 1),
         ('table-tennis', 'Wall Drill', 0), ('table-tennis', 'Game', 1),
         ('tennis', 'Wall Drill', 0), ('tennis', 'Game', 1),
         ('teqball', 'Passing Drill', 0), ('teqball', 'Game', 1),
         ('ti-rakau', 'Solo Pattern', 0), ('ti-rakau', 'Partner Toss', 1), ('ti-rakau', 'Partner Two Sticks', 2), ('ti-rakau', 'Four Square', 3), ('ti-rakau', 'Song Pattern', 4),
         ('touch-rugby', 'Passing Drill', 0), ('touch-rugby', 'Game', 1),
         ('trampolining', 'Bounce to Butt', 0), ('trampolining', 'Bounce to Back', 1), ('trampolining', 'Forward Flip', 2), ('trampolining', 'Back Flip', 3), ('trampolining', 'Game', 4),
         ('ultimate-frisbee', 'Passing Drill', 0), ('ultimate-frisbee', 'Game', 1),
         ('volleyball', 'Passing Drill', 0), ('volleyball', 'Game', 1),
         ('water-polo', 'Passing Drill', 0), ('water-polo', 'Game', 1),
         ('wrestler-pullover', 'Wall Assisted Neck Bridge', 0), ('wrestler-pullover', 'Elevated Assisted Wrestler Bridge', 1), ('wrestler-pullover', 'Assisted Wrestler Bridge', 2), ('wrestler-pullover', 'Wrestler Pullover', 3)
       ) AS lv(slug, tier, idx)
       WHERE lv.slug = v_slug AND lv.tier = NEW.difficulty_tier
         AND floor(NEW.raw_score / 10000) = lv.idx) THEN
    RAISE EXCEPTION 'That level has changed: refresh the app and enter the score again'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

-- Overhead Press, Weighted Tuck and Sandbag to Shoulder join the lifts; Clean &
-- Press and Pullover & Press leave.
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

  -- CHANGED 20261005222950: Steinborn joins the lifts (6 Oct 2026 roster).
  IF v_name IN ('1A Press', 'Deadlift', 'Pause Back Squat', 'Zercher Dead', 'Pause Bench', 'Turkish Getup', 'Arthur Lift', 'Pause Row', 'Pause Front Squat', 'Loaded Lunge', 'Steinborn Lift', 'Overhead Press', 'Weighted Tuck', 'Kelly Snatch', '1A Snatch', 'Clean & Jerk', 'Snatch', 'Sandbag to Shoulder')
     OR v_slug IN ('one-arm-press', 'deadlift', 'pause-squat', 'zercher-deadlift', 'pause-bench', 'turkish-get-up', 'arthur-lift', 'pause-row', 'pause-front-squat', 'loaded-lunge', 'steinborn', 'overhead-press', 'weighted-tuck', 'kelly-snatch', 'one-arm-snatch', 'clean-and-jerk', 'snatch', 'sandbag-to-shoulder') THEN
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
  -- CHANGED 20261005012108: Tibialis Curl lost its load levels again (5 Oct
  -- 2026): any load and reps, heavier wins. A row that still names a level
  -- comes from a bundle older than that, so it is refused the same way.
  ELSIF (v_name = 'Tibialis Curl' OR v_slug = 'tibialis-curl') AND NEW.difficulty_tier IS NOT NULL THEN
    RAISE EXCEPTION 'Tibialis Curl is now any load and reps: refresh the app and enter it again'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.guard_workout_entries_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_witnessed    boolean;
  v_performed_on date;
  v_session      uuid;
  v_active       boolean;
  v_player       uuid;
  v_finished     timestamptz;
  v_fitting_only boolean := false;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.id         := OLD.id;
    NEW.workout_id := OLD.workout_id;
    NEW.created_at := OLD.created_at;
    -- Choosing the event for an entry that was not fitted yet, and nothing
    -- else. Always allowed: the not-fitted list exists so old logs can count
    -- once they are fitted (decision 14).
    v_fitting_only := OLD.event_slug IS NULL AND NEW.event_slug IS NOT NULL
      AND NEW.activity IS NOT DISTINCT FROM OLD.activity
      AND NEW.duration_seconds IS NOT DISTINCT FROM OLD.duration_seconds
      AND NEW.raw_score IS NOT DISTINCT FROM OLD.raw_score;
  END IF;

  SELECT witnessed, performed_on, session_id, player_id, finished_at
    INTO v_witnessed, v_performed_on, v_session, v_player, v_finished
    FROM workouts WHERE id = NEW.workout_id;

  IF auth.uid() IS NOT NULL AND NOT public.is_judge() AND NOT v_fitting_only THEN
    -- A witnessed workout is the kaiwhakawā's record: a player adding or
    -- changing an entry under it would inherit the witnessed label.
    -- CHANGED 20260930222237: except while it is an OPEN training session the
    -- kaiwhakawā is running. Then the player (or their parent) plays in it, and
    -- what they enter is witnessed because the kaiwhakawā is in the room. The
    -- window is the same one isOpen() in lib/personalGame.ts uses.
    IF v_witnessed THEN
      IF NOT (
        v_finished IS NULL
        AND v_performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
        AND public.can_log_for(v_player)
      ) THEN
        RAISE EXCEPTION 'workout entry: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
      END IF;
    END IF;

    IF v_session IS NOT NULL THEN
      -- An entry made AT a game counts as `game` evidence, so it may only be
      -- written while that game is open — the same window guard_results_write
      -- gives an official score.
      SELECT is_active INTO v_active FROM sessions WHERE id = v_session;
      IF NOT COALESCE(v_active, false) THEN
        RAISE EXCEPTION 'workout entry: that game has finished' USING ERRCODE = '42501';
      END IF;
    ELSE
      -- Decision 17 applies to every write, not only to creating the workout:
      -- otherwise a new best effort could be slipped into a months-old log.
      IF v_performed_on < (now() AT TIME ZONE 'Pacific/Auckland')::date - 7 THEN
        RAISE EXCEPTION 'workout entry: that workout is more than 7 days old' USING ERRCODE = '22023';
      END IF;
    END IF;
  END IF;

  IF NEW.event_slug IS NOT NULL AND NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = NEW.event_slug) THEN
    RAISE EXCEPTION 'workout entry: % is not an event on the roster', NEW.event_slug USING ERRCODE = '22023';
  END IF;

  -- CHANGED 20261026220347: also allowed in an OPEN training session (a
  -- witnessed workout, not finished, dated today in NZ), where the kaiwhakawā
  -- is in the room and may be the opponent. The window is the one a player may
  -- write to a training session at all, so a finished session cannot gain a win.
  -- CHANGED 20261102211504: the four sprints left the roster; Sprint Race and Hurdles join.
  -- CHANGED 20261005222950: Mas Wrestling, 400m Sprint, 800m Sprint and
  -- Obstacle Course (6 Oct 2026 roster) join the list.
  -- CHANGED 20261005012108: thirteen more pure contests (the races and the
  -- contests whose drill ladders were removed on 5 Oct 2026) join Wrestling in
  -- the list. They have no rung to name, so the slug is the only way to know.
  -- A game result is allowed on a workout linked to an official game (a swap: a
  -- real opponent, a kaiwhakawā in the room), in an open training session, and
  -- nowhere else. Logged at home it would still count a win with nobody on the
  -- other side, which is what 20260916211643 exists to stop. Game rungs are
  -- recognised by NAME because the database does not hold the ladders;
  -- __tests__/workoutEntriesIntegrity.test.ts fails if that ever stops being true.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'hurdles', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 'sprint-race', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war', 'wrestling'))
     AND v_session IS NULL
     AND NOT (
       COALESCE(v_witnessed, false)
       AND v_finished IS NULL
       AND v_performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
     ) THEN
    RAISE EXCEPTION 'workout entry: a game result is recorded at an official game, not logged' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.record_entry_match(
  p_entry_id     uuid,
  p_opponent_ids uuid[],
  p_teammate_ids uuid[] DEFAULT '{}'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid      uuid := auth.uid();
  v_judge    boolean := public.is_judge();
  e          record;
  v_active   boolean;
  v_training boolean := false;
  v_name     text;
  v_term     int;
  v_outcome  text;
  v_opp      uuid[];
  v_mates    uuid[];
  v_match    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: sign in to record a match' USING ERRCODE = '42501';
  END IF;

  SELECT en.id, en.raw_score, en.difficulty_tier, en.event_slug,
         w.player_id, w.session_id, w.witnessed, w.finished_at, w.performed_on, w.logged_by
    INTO e
  FROM workout_entries en
  JOIN workouts w ON w.id = en.workout_id
  WHERE en.id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_entry_match: unknown entry %', p_entry_id USING ERRCODE = 'P0002';
  END IF;

  -- Same authority as writing the entry itself (can_log_for).
  IF NOT public.can_log_for(e.player_id) THEN
    RAISE EXCEPTION 'record_entry_match: that entry belongs to someone else' USING ERRCODE = '42501';
  END IF;

  IF e.session_id IS NULL THEN
    -- CHANGED 20261026220347: a training session (a witnessed workout the
    -- kaiwhakawā runs) may rate a game against that kaiwhakawā. A personal game
    -- still has no opponent the server can trust.
    IF NOT COALESCE(e.witnessed, false) THEN
      RAISE EXCEPTION 'record_entry_match: only a game played at an official game or against your kaiwhakawā in training is rated'
        USING ERRCODE = '22023';
    END IF;
    IF NOT v_judge AND NOT (
      e.finished_at IS NULL AND e.performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
    ) THEN
      RAISE EXCEPTION 'record_entry_match: that training session has finished — ask your kaiwhakawā'
        USING ERRCODE = '42501';
    END IF;
    v_training := true;
  ELSIF NOT v_judge THEN
    SELECT is_active INTO v_active FROM sessions WHERE id = e.session_id;
    IF NOT COALESCE(v_active, false) THEN
      RAISE EXCEPTION 'record_entry_match: that game has finished — ask a kaiwhakawā'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  SELECT event_name INTO v_name FROM event_domains WHERE slug = e.event_slug;
  IF v_name IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: % is not an event on the roster', e.event_slug
      USING ERRCODE = '22023';
  END IF;

  -- The outcome comes from the SCORE, never from the caller: a Game rung
  -- encodes win/draw/loss as the within-tier term (lib/scoring.ts).
  IF e.raw_score IS NOT NULL
     AND (e.difficulty_tier ILIKE 'Game%' OR e.event_slug IN ('arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'hurdles', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 'sprint-race', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war', 'wrestling')) THEN
    v_term := (e.raw_score::int) % 10000;
    v_outcome := CASE v_term WHEN 2 THEN 'a' WHEN 1 THEN 'draw' WHEN 0 THEN 'b' END;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_opp
  FROM unnest(COALESCE(p_opponent_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> e.player_id;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_mates
  FROM unnest(COALESCE(p_teammate_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> e.player_id;

  IF v_opp && v_mates THEN
    RAISE EXCEPTION 'record_entry_match: a player cannot be on both sides' USING ERRCODE = '22023';
  END IF;

  -- In training the only opponent is the kaiwhakawā running the session, one
  -- on one, and they must still be a kaiwhakawā: anyone else named here would
  -- be a win over someone who never confirmed it.
  IF v_training AND cardinality(v_opp) > 0 AND (
       v_opp <> ARRAY[e.logged_by]
       OR cardinality(v_mates) > 0
       OR NOT EXISTS (SELECT 1 FROM players p WHERE p.id = e.logged_by AND p.role = 'judge')
     ) THEN
    RAISE EXCEPTION 'record_entry_match: in training you can only play the kaiwhakawā running the session'
      USING ERRCODE = '22023';
  END IF;

  -- The match mirrors the entry, so whatever was recorded for it goes first.
  DELETE FROM matches WHERE workout_entry_id = p_entry_id;

  IF v_outcome IS NULL OR cardinality(v_opp) = 0 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_opp || v_mates) AS x
    WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = x)
  ) THEN
    RAISE EXCEPTION 'record_entry_match: an opponent is not a registered player'
      USING ERRCODE = '22023';
  END IF;

  -- A training game is confirmed by the kaiwhakawā who played and witnessed
  -- it; lib/matches.ts counts a confirmed match with no session as agreed.
  INSERT INTO matches (workout_entry_id, session_id, event_name, outcome, recorded_by, confirmed_by, confirmed_at)
  VALUES (p_entry_id, e.session_id, v_name, v_outcome, v_uid,
          CASE WHEN v_training THEN e.logged_by END,
          CASE WHEN v_training THEN now() END)
  RETURNING id INTO v_match;

  INSERT INTO match_players (match_id, player_id, side)
  SELECT v_match, e.player_id, 'a'
  UNION ALL SELECT v_match, x, 'a' FROM unnest(v_mates) AS x
  UNION ALL SELECT v_match, x, 'b' FROM unnest(v_opp)   AS x;

  RETURN v_match;
END;
$$;

-- ─── Levels that moved ───────────────────────────────────────────────────────
-- 0-based indexes, as raw_score encodes them.
CREATE TEMP TABLE level_map (slug text, old_tier text, new_tier text, old_idx int, new_idx int) ON COMMIT DROP;
INSERT INTO level_map VALUES
  ('flag', 'Assisted Flag', 'Supported Flag', 3, 3),
  ('planche', 'Elevated Pseudo Lean', 'Elevated Planche Lean', 1, 1),
  ('planche', 'Banded Tuck Planche', 'Paralette Hold', 2, 2),
  ('planche', 'Full Planche', 'Planche', 6, 6),
  ('back-lever', 'Back Lever', 'Back Lever', 6, 5),
  ('touch-rugby', 'Game', 'Game', 4, 1),
  ('repeat-high-jump', 'Ankles', '25cm', 0, 0),
  ('repeat-high-jump', 'Knees', '50cm', 1, 1),
  ('repeat-high-jump', 'Hips', '75cm', 2, 2),
  ('repeat-high-jump', 'Belly Button', '100cm', 3, 3),
  ('repeat-high-jump', 'Ribs', '125cm', 4, 4),
  ('repeat-high-jump', 'Chest', '150cm', 5, 5),
  ('repeat-high-jump', 'Shoulder', '175cm', 6, 6),
  ('repeat-high-jump', 'Head', '200cm', 7, 7),
  ('american-football', 'Game', 'Game', 5, 1),
  ('australian-football', 'Game', 'Game', 4, 1),
  ('calf-raises', 'Calf Raise', 'Assisted Calf Raise', 0, 0),
  ('rear-hand-clasp', 'Towel-Assisted', 'Assisted Rear Clasp', 0, 0),
  ('rear-hand-clasp', 'Block Assisted', 'Assisted Rear Clasp', 1, 0),
  ('rear-hand-clasp', 'Half Block Assisted', 'Assisted Rear Clasp', 2, 0),
  ('rear-hand-clasp', 'Finger Tips Touch', 'Finger Tips Touch', 3, 1),
  ('rear-hand-clasp', 'Finger Clasp', 'Finger Clasp', 4, 2),
  ('rear-hand-clasp', 'Palm Clasp', 'Palm Clasp', 5, 3),
  ('rear-hand-clasp', 'Butterfly Clasp', 'Butterfly Clasp', 6, 4),
  ('bridge', 'Wall Assisted Bridge', 'Wall Assisted Bridge', 1, 0),
  ('bridge', 'Headstand Bridge', 'Headstand Bridge', 2, 1),
  ('bridge', 'Bridge', 'Bridge', 3, 2),
  ('bridge', 'Straight Arm Bridge', 'Straight Arm Bridge', 4, 3),
  ('bridge', 'Rainbow Bridge', 'Rainbow Bridge', 5, 4),
  ('forward-fold', 'Hands to Legs', 'Hands to Knees', 2, 2),
  ('forward-fold', 'Elbows to Legs', 'Hands to Feet', 3, 3),
  ('needle-pose', 'Full Needle Pose', 'Needle Pose', 5, 5),
  ('side-bend', 'Top Hand to Foot', 'Half Straddle Side Bend', 3, 3),
  ('full-bound-twist', 'Assisted Bound Twist', 'Semi Bound Twist', 2, 2),
  ('full-bound-twist', 'Full Bound Twist', 'Full Bound Twist', 4, 3),
  ('seiza', 'Elbows to Floor', 'Backbend Seiza', 3, 3),
  ('seiza', 'Shoulders to Floor', 'Backbend Seiza', 4, 3),
  ('seiza', 'Seiza Bridge', 'Seiza Bridge', 5, 4),
  ('seiza', 'Rainbow Seiza', 'Rainbow Seiza', 6, 5),
  ('rope-climb', 'Game', 'Game', 5, 1),
  ('breakdancing', 'Top Rock + Footwork + Freeze', 'Top Rock + Footwork + Freeze', 3, 0),
  ('breakdancing', 'Game', 'Game', 4, 1),
  ('trampolining', 'Bounce to Butt', 'Bounce to Butt', 1, 0),
  ('trampolining', 'Forward Flip', 'Forward Flip', 3, 2),
  ('trampolining', 'Back Flip', 'Back Flip', 4, 3),
  ('trampolining', 'Game', 'Game', 5, 4),
  ('jump-rope', 'Single Dutch', 'Single Dutch', 1, 0),
  ('jump-rope', 'Game', 'Game', 3, 1),
  ('gymnastics', 'Backward Roll', 'Back Roll', 1, 1),
  ('diving', 'Game', 'Game', 4, 3),
  ('volleyball', 'Game', 'Game', 4, 1),
  ('baseball', 'Game', 'Game', 5, 1),
  ('teqball', 'Game', 'Game', 3, 1),
  ('tennis', 'Game', 'Game', 4, 1),
  ('cricket', 'Game', 'Game', 5, 1),
  ('badminton', 'Game', 'Game', 4, 1),
  ('basketball', 'Game', 'Game', 4, 1),
  ('football', 'Game', 'Game', 4, 1),
  ('hockey', 'Game', 'Game', 4, 1),
  ('squash', 'Game', 'Game', 4, 1),
  ('lacrosse', 'Game', 'Game', 4, 1),
  ('ultimate-frisbee', 'Game', 'Game', 4, 1),
  ('water-polo', 'Game', 'Game', 4, 1),
  ('table-tennis', 'Game', 'Game', 2, 1),
  ('netball', 'Game', 'Game', 3, 1),
  ('bocce', 'Game', 'Game', 4, 1),
  ('carrom', 'Game', 'Game', 2, 1),
  ('archery', 'Game', 'Game', 4, 1),
  ('bowling', 'Game', 'Game', 4, 1),
  ('darts', 'Game', 'Game', 2, 1),
  ('disc-golf', 'Game', 'Game', 3, 1),
  ('golf', 'Game', 'Game', 3, 1),
  ('handball', 'Game', 'Game', 3, 1),
  ('kubb', 'Game', 'Game', 4, 1),
  ('cornhole', 'Game', 'Game', 3, 1),
  ('airsoft', 'Game', 'Game', 3, 1);

CREATE TEMP TABLE shifts ON COMMIT DROP AS
SELECT 'r'::text AS src, r.id, r.session_id, m.new_tier, m.new_idx, (m.new_idx - m.old_idx) * 10000 AS delta
  FROM results r JOIN session_events se ON se.id = r.event_id
  JOIN level_map m ON m.slug = se.event_slug AND m.old_tier = r.difficulty_tier
 WHERE r.raw_score IS NOT NULL AND floor(r.raw_score / 10000) = m.old_idx
UNION ALL
SELECT 'e', e.id, NULL, m.new_tier, m.new_idx, (m.new_idx - m.old_idx) * 10000
  FROM workout_entries e
  JOIN level_map m ON m.slug = e.event_slug AND m.old_tier = e.difficulty_tier
 WHERE e.raw_score IS NOT NULL AND floor(e.raw_score / 10000) = m.old_idx;

CREATE TABLE public.results_roster_154_preimage_20261102211504 AS
SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, r.weight_kg, r.distance_m, now() AS captured_at
  FROM results r JOIN session_events se ON se.id = r.event_id
 WHERE r.id IN (SELECT id FROM shifts WHERE src = 'r')
    OR se.event_slug IN ('sandbag-to-shoulder', 'burpee-broad-jump');
ALTER TABLE public.results_roster_154_preimage_20261102211504 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_roster_154_preimage_20261102211504 FROM anon, authenticated;

CREATE TABLE public.workout_entries_roster_154_preimage_20261102211504 AS
SELECT e.id, e.raw_score, e.difficulty_tier, e.score_label, e.weight_kg, e.distance_m, now() AS captured_at
  FROM workout_entries e
 WHERE e.id IN (SELECT id FROM shifts WHERE src = 'e')
    OR e.event_slug IN ('sandbag-to-shoulder', 'burpee-broad-jump');
ALTER TABLE public.workout_entries_roster_154_preimage_20261102211504 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_roster_154_preimage_20261102211504 FROM anon, authenticated;

-- A Game row on a finished training session or an old log is being moved, not
-- written: the entries guard would refuse it, so it stands aside for this.
ALTER TABLE workout_entries DISABLE TRIGGER trg_guard_workout_entries_write;

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

ALTER TABLE workout_entries ENABLE TRIGGER trg_guard_workout_entries_write;

-- ─── Events whose scoring changed ────────────────────────────────────────────
-- Burpee Broad Jump: the old 100m level is now the open distance, the same time.
UPDATE results r SET raw_score = 10000 - r.time_seconds, difficulty_tier = NULL, distance_m = 100,
       score_label = '100m · ' || substring(r.score_label from position(' · ' in r.score_label) + 3)
  FROM session_events se
 WHERE se.id = r.event_id AND se.event_slug = 'burpee-broad-jump' AND r.difficulty_tier = '100m' AND r.time_seconds > 0;
-- Sandbag to Shoulder: the level named the load. The lift trigger writes the 1RM.
UPDATE results r SET weight_kg = replace(r.difficulty_tier, 'kg', '')::numeric, difficulty_tier = NULL,
       raw_score = replace(r.difficulty_tier, 'kg', '')::numeric,
       score_label = replace(r.difficulty_tier, 'kg', '') || 'kg × ' || r.reps || ' reps'
  FROM session_events se
 WHERE se.id = r.event_id AND se.event_slug = 'sandbag-to-shoulder' AND r.difficulty_tier LIKE '%kg';
UPDATE session_events SET input_mode = 'distance+time' WHERE event_slug = 'burpee-broad-jump';
UPDATE session_events SET input_mode = 'strength' WHERE event_slug = 'sandbag-to-shoulder';
UPDATE session_events SET input_mode = 'distance' WHERE event_slug = 'high-jump';

-- ─── Names ───────────────────────────────────────────────────────────────────
-- Results and records group by session_events.event_name. Past games keep the
-- domain slot they filled.
UPDATE session_events SET event_name = 'Dragon Flag' WHERE event_name = 'Hollow Hold';
UPDATE session_events SET event_name = 'Steinborn Lift' WHERE event_name = 'Steinborn';
UPDATE session_events SET event_name = 'Leapfrog' WHERE event_name = 'Repeat Vault';
UPDATE session_events SET event_name = 'Leg Extension Hold' WHERE event_name = 'Leg Ext Hold';
UPDATE session_events SET event_name = 'Wrist Extension' WHERE event_name = 'Reverse Wrist Ext';
UPDATE session_events SET event_name = 'Airsoft/Nerf' WHERE event_name = 'Airsoft';
UPDATE matches SET event_name = 'Dragon Flag' WHERE event_name = 'Hollow Hold';
UPDATE matches SET event_name = 'Airsoft/Nerf' WHERE event_name = 'Airsoft';
UPDATE session_events SET domain_name = 'Control' WHERE domain_number = 8;
UPDATE session_events SET domain_name = 'Aim' WHERE domain_number = 10;

-- Placements where a row moved: a merged level can change the order.
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

-- ─── Assertions ──────────────────────────────────────────────────────────────
DO $$
DECLARE v_n int;
BEGIN
  IF (SELECT count(*) FROM event_domains) <> 154 THEN
    RAISE EXCEPTION 'roster 154: event_domains holds % rows, expected 154', (SELECT count(*) FROM event_domains);
  END IF;
  IF EXISTS (SELECT 1 FROM event_domains GROUP BY slug HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'roster 154: a slug appears twice in event_domains';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES (1,17), (2,15), (3,16), (4,13), (5,16), (6,16), (7,18), (8,15), (9,14), (10,14)) AS want(d, n)
     WHERE n <> (SELECT count(*) FROM event_domains WHERE domain_number = want.d)
  ) THEN
    RAISE EXCEPTION 'roster 154: a domain has the wrong number of events';
  END IF;
  IF EXISTS (SELECT 1 FROM activity_aliases a LEFT JOIN event_domains e ON e.slug = a.event_slug WHERE e.slug IS NULL) THEN
    RAISE EXCEPTION 'roster 154: an alias points at an event not on the roster';
  END IF;
  IF EXISTS (SELECT 1 FROM session_events WHERE event_name IN ('Hollow Hold', 'Steinborn', 'Repeat Vault', 'Leg Ext Hold', 'Reverse Wrist Ext', 'Airsoft')
             OR (domain_number = 8 AND domain_name <> 'Control') OR (domain_number = 10 AND domain_name <> 'Aim')) THEN
    RAISE EXCEPTION 'roster 154: an old name remains in session_events';
  END IF;
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
   WHERE se.event_slug = 'burpee-broad-jump' AND r.difficulty_tier IS NOT NULL;
  IF v_n > 0 THEN RAISE EXCEPTION 'roster 154: % Burpee Broad Jump rows still name a level', v_n; END IF;
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
   WHERE se.event_slug = 'sandbag-to-shoulder' AND (r.difficulty_tier IS NOT NULL OR r.weight_kg IS NULL);
  IF v_n > 0 THEN RAISE EXCEPTION 'roster 154: % Sandbag to Shoulder rows were not converted', v_n; END IF;
END $$;

COMMIT;
