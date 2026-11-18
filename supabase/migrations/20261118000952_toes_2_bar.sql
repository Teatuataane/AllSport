-- Weighted Tuck becomes Toes 2 Bar, with a ladder (Tāne, 18 Nov 2026).
--
-- New slug toes-2-bar, input mode difficulty+reps, five levels:
--   D1 Lying Knee Tuck, D2 Hanging Tuck, D3 Hanging Leg Raise, D4 Toes 2 Bar,
--   D5 Weighted Toes 2 Bar (load and reps, an estimated one-rep max against
--   bodyweight, written by the app like Wrestler Pullover and Weighted GHD Situp).
--
-- The old weighted hanging tuck is the D2 movement with a load. Its rows (two
-- workout entries on 18 Nov 2026, no game results, no colours) move to D2
-- Hanging Tuck on their reps: the load has no place on that level, so it is
-- dropped from the row and kept in the pre-image. Planned workouts are repointed.
--
-- Guards: the new ladder joins enforce_relevelled_ladders, a new score on the
-- old slug is refused (an old bundle), and the lift trigger lets go of it, or
-- it would overwrite the weighted level's score with a bare 1RM.
--
-- ORDER: DEPLOY THE CODE FIRST, then apply this straight after. Until it runs,
-- a Toes 2 Bar entry is refused (event_domains does not know the slug yet).
-- AFTER: nothing to refresh; no game holds this event.

BEGIN;

-- Results would need the game-closed path; there are none. Stop if that changed.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM results r JOIN session_events se ON se.id = r.event_id
              WHERE se.event_slug = 'weighted-tuck' OR se.event_name = 'Weighted Tuck') THEN
    RAISE EXCEPTION 'toes 2 bar: a game result exists for Weighted Tuck; convert it before applying';
  END IF;
  IF EXISTS (SELECT 1 FROM grade_awards WHERE 'weighted-tuck' = ANY(events)) THEN
    RAISE EXCEPTION 'toes 2 bar: a colour cites weighted-tuck; repoint grade_awards.events first';
  END IF;
END $$;

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
  ('Toes 2 Bar', 1, 'toes-2-bar'),
  ('Turkish Getup', 1, 'turkish-get-up'),
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

-- ─── The guards, each redefined whole from its newest definition ─────────────
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

  IF TG_OP = 'INSERT' AND v_slug IN ('lunges', 'ab-wheel-rollout', 'pause-chin-up', 'pullover-and-press', 'skull-hang', 'hamstring-curl', 'plie-squat', 'wrist-stretch', 'reverse-wrist-stretch', 'breath-hold', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'clean-and-press',
                                      -- ADDED 20261118000952: Weighted Tuck became Toes 2 Bar (new slug).
                                      'weighted-tuck') THEN
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

  IF v_slug IN ('airsoft', 'american-football', 'animal-crawl', 'archery', 'australian-football', 'back-lever', 'badminton', 'balance-ball', 'baseball', 'basketball', 'bent-wrist-stretch', 'bocce', 'bowling', 'breakdancing', 'bridge', 'butterfly-pose', 'calf-raises', 'carrom', 'cheststand', 'chin-hang', 'clap-pushups', 'cobra-pose', 'cornhole', 'cricket', 'darts', 'deep-squat', 'disc-golf', 'diving', 'finger-push-up', 'flag', 'foot-juggling', 'football', 'forward-fold', 'front-split', 'full-bound-twist', 'ghd-situp', 'goal-kicking', 'golf', 'gymnastics', 'handball', 'hang', 'hockey', 'iron-cross', 'jump-rope', 'kubb', 'l-sit-hold', 'lacrosse', 'middle-split', 'needle-pose', 'netball', 'nordic-curl', 'pancake', 'planche', 'push-up-contest', 'rear-hand-clasp', 'repeat-high-jump', 'rope-climb', 'seiza', 'shoulder-dislocate', 'side-bend', 'skate', 'skipping-rope', 'slackline', 'squash', 'table-tennis', 'tennis', 'teqball', 'ti-rakau', 'touch-rugby', 'trampolining', 'ultimate-frisbee', 'volleyball', 'water-polo', 'wrestler-pullover', 'toes-2-bar')
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
         ('wrestler-pullover', 'Wall Assisted Neck Bridge', 0), ('wrestler-pullover', 'Elevated Assisted Wrestler Bridge', 1), ('wrestler-pullover', 'Assisted Wrestler Bridge', 2), ('wrestler-pullover', 'Wrestler Pullover', 3),
         -- ADDED 20261118000952.
         ('toes-2-bar', 'Lying Knee Tuck', 0), ('toes-2-bar', 'Hanging Tuck', 1), ('toes-2-bar', 'Hanging Leg Raise', 2), ('toes-2-bar', 'Toes 2 Bar', 3), ('toes-2-bar', 'Weighted Toes 2 Bar', 4)
       ) AS lv(slug, tier, idx)
       WHERE lv.slug = v_slug AND lv.tier = NEW.difficulty_tier
         AND floor(NEW.raw_score / 10000) = lv.idx) THEN
    RAISE EXCEPTION 'That level has changed: refresh the app and enter the score again'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

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
  -- CHANGED 20261118000952: Weighted Tuck leaves (it is Toes 2 Bar, with levels;
  -- its weighted level ranks on an estimate the app writes, like Wrestler Pullover).
  IF v_name IN ('1A Press', 'Deadlift', 'Pause Back Squat', 'Zercher Dead', 'Pause Bench', 'Turkish Getup', 'Arthur Lift', 'Pause Row', 'Pause Front Squat', 'Loaded Lunge', 'Steinborn Lift', 'Overhead Press', 'Kelly Snatch', '1A Snatch', 'Clean & Jerk', 'Snatch', 'Sandbag to Shoulder')
     OR v_slug IN ('one-arm-press', 'deadlift', 'pause-squat', 'zercher-deadlift', 'pause-bench', 'turkish-get-up', 'arthur-lift', 'pause-row', 'pause-front-squat', 'loaded-lunge', 'steinborn', 'overhead-press', 'kelly-snatch', 'one-arm-snatch', 'clean-and-jerk', 'snatch', 'sandbag-to-shoulder') THEN
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

-- ─── Rows ────────────────────────────────────────────────────────────────────
CREATE TABLE public.workout_entries_toes_2_bar_preimage_20261118000952 AS
SELECT e.id, e.activity, e.event_slug, e.raw_score, e.difficulty_tier, e.score_label, e.weight_kg, e.reps, now() AS captured_at
  FROM workout_entries e WHERE e.event_slug = 'weighted-tuck';
ALTER TABLE public.workout_entries_toes_2_bar_preimage_20261118000952 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_toes_2_bar_preimage_20261118000952 FROM anon, authenticated;

-- Witnessed and more than a week old: the entries guard would refuse the move.
ALTER TABLE workout_entries DISABLE TRIGGER trg_guard_workout_entries_write;

-- A scored row becomes D2 Hanging Tuck on its reps; an unscored one keeps no score.
UPDATE workout_entries e
   SET event_slug = 'toes-2-bar', activity = 'Toes 2 Bar', weight_kg = NULL,
       difficulty_tier = CASE WHEN e.raw_score IS NOT NULL THEN 'Hanging Tuck' END,
       raw_score = CASE WHEN e.raw_score IS NOT NULL THEN 10000 + least(greatest(coalesce(e.reps, 1), 1), 9999) END,
       score_label = CASE WHEN e.raw_score IS NOT NULL
                          THEN 'D2 Hanging Tuck · ' || greatest(coalesce(e.reps, 1), 1) || ' reps'
                          ELSE e.score_label END
 WHERE e.event_slug = 'weighted-tuck';

ALTER TABLE workout_entries ENABLE TRIGGER trg_guard_workout_entries_write;

UPDATE workouts SET planned_events = array_replace(planned_events, 'weighted-tuck', 'toes-2-bar')
 WHERE 'weighted-tuck' = ANY(planned_events);
UPDATE session_events SET event_name = 'Toes 2 Bar', event_slug = 'toes-2-bar', input_mode = 'difficulty+reps'
 WHERE event_slug = 'weighted-tuck' OR event_name = 'Weighted Tuck';

-- Words people type in a log, so they fit the event (none pointed at the old slug).
INSERT INTO activity_aliases (alias, event_slug) VALUES
  ('toes to bar', 'toes-2-bar'), ('toes-to-bar', 'toes-2-bar'), ('t2b', 'toes-2-bar'), ('ttb', 'toes-2-bar'),
  ('weighted tuck', 'toes-2-bar'), ('hanging tuck', 'toes-2-bar'), ('hanging knee raise', 'toes-2-bar'),
  ('hanging knee raises', 'toes-2-bar'), ('hanging leg raise', 'toes-2-bar'), ('hanging leg raises', 'toes-2-bar')
ON CONFLICT (alias) DO NOTHING;

-- ─── Assertions ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM event_domains) <> 154 THEN
    RAISE EXCEPTION 'toes 2 bar: event_domains holds % rows, expected 154', (SELECT count(*) FROM event_domains);
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES (1,17), (2,15), (3,16), (4,13), (5,16), (6,16), (7,18), (8,15), (9,14), (10,14)) AS want(d, n)
     WHERE n <> (SELECT count(*) FROM event_domains WHERE domain_number = want.d)
  ) THEN
    RAISE EXCEPTION 'toes 2 bar: a domain has the wrong number of events';
  END IF;
  IF EXISTS (SELECT 1 FROM workout_entries WHERE event_slug = 'weighted-tuck')
     OR EXISTS (SELECT 1 FROM workouts WHERE 'weighted-tuck' = ANY(planned_events))
     OR EXISTS (SELECT 1 FROM session_events WHERE event_slug = 'weighted-tuck' OR event_name = 'Weighted Tuck')
     OR EXISTS (SELECT 1 FROM activity_aliases a LEFT JOIN event_domains d ON d.slug = a.event_slug WHERE d.slug IS NULL) THEN
    RAISE EXCEPTION 'toes 2 bar: weighted-tuck is still referenced';
  END IF;
  IF EXISTS (SELECT 1 FROM workout_entries WHERE event_slug = 'toes-2-bar' AND raw_score IS NOT NULL
              AND (difficulty_tier IS NULL OR floor(raw_score / 10000) <> 1 OR weight_kg IS NOT NULL)
              AND id IN (SELECT id FROM public.workout_entries_toes_2_bar_preimage_20261118000952)) THEN
    RAISE EXCEPTION 'toes 2 bar: a moved entry is not on D2 Hanging Tuck';
  END IF;
END $$;

COMMIT;
