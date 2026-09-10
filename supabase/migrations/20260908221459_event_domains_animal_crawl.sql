-- Roster mirror: Animal Crawl replaces Duck Walk (Sept 2026)
--
-- Re-seeds event_domains IN FULL, which CLAUDE.md requires of whichever
-- migration changes the roster — this file is now THE definition of the mirror,
-- and __tests__/taniwha.test.ts reads the newest file carrying the seed.
--
-- Animal Crawl REPLACES Duck Walk and is not a rename: a bear crawl is not a
-- duck walk, so there is deliberately no session_events.event_name sweep. Duck
-- Walk's own rows are dealt with by the data-repair migration that follows this
-- one; nothing here touches `results`.
--
-- Code-first or migration-first are both safe. event_domains only feeds domain
-- crowns, a crown needs 10,000 lifetime points, and nobody has crown room — the
-- same reasoning 20260828192753 recorded for the Lunges swap.

BEGIN;

-- event_domains: the roster mirrored into SQL, 120 rows.
-- Generated from lib/eventData.ts by scripts/gen-difficulty-migration.mjs.
-- THIS FILE IS NOW THE DEFINITION of the mirror (the newest file carrying
-- the seed), which is what __tests__/taniwha.test.ts reads.
DELETE FROM event_domains;
INSERT INTO event_domains (event_name, domain_number, slug) VALUES
  ('1A Press', 1, 'one-arm-press'),
  ('Arthur Lift', 1, 'arthur-lift'),
  ('Clean & Press', 1, 'clean-and-press'),
  ('Deadlift', 1, 'deadlift'),
  ('Pause Back Squat', 1, 'pause-squat'),
  ('Pause Bench', 1, 'pause-bench'),
  ('Pause Chinup', 1, 'pause-chin-up'),
  ('Pause Dips', 1, 'pause-dips'),
  ('Pause Front Squat', 1, 'pause-front-squat'),
  ('Pause Row', 1, 'pause-row'),
  ('Turkish Getup', 1, 'turkish-get-up'),
  ('Zercher Dead', 1, 'zercher-deadlift'),
  ('1 Leg Squat', 2, '1-leg-squat'),
  ('Back Lever', 2, 'back-lever'),
  ('Chin Hang', 2, 'chin-hang'),
  ('Climbing', 2, 'rope-climb'),
  ('Front Lever', 2, 'front-lever'),
  ('Handstand', 2, 'hand-walk'),
  ('Headstand', 2, 'headstand'),
  ('Human Flag', 2, 'flag'),
  ('Iron Cross', 2, 'iron-cross'),
  ('L-Sit Hold', 2, 'l-sit-hold'),
  ('Planche', 2, 'planche'),
  ('Windshield Wipers', 2, 'windshield-wipers'),
  ('1A Snatch', 3, 'one-arm-snatch'),
  ('Arm Wrestling', 3, 'arm-wrestling'),
  ('Australian Football', 3, 'australian-football'),
  ('Clean & Jerk', 3, 'clean-and-jerk'),
  ('High Jump', 3, 'high-jump'),
  ('Javelin', 3, 'javelin-throw'),
  ('Kelly Snatch', 3, 'kelly-snatch'),
  ('Shotput', 3, 'shot-put'),
  ('Snatch', 3, 'snatch'),
  ('Standing Broad Jump', 3, 'standing-broad-jump'),
  ('Tug of War', 3, 'tug-of-war'),
  ('Vertical Jump', 3, 'vertical-jump'),
  ('100m Sprint', 4, '100m-sprint'),
  ('200m Sprint', 4, '200m-sprint'),
  ('American Football', 4, 'american-football'),
  ('Beach Flags', 4, 'beach-flags'),
  ('Capture the Flag', 4, 'capture-the-flag'),
  ('Kabaddi', 4, 'kabaddi'),
  ('Rats & Rabbits', 4, 'rats-and-rabbits'),
  ('Repeat High Jump', 4, 'repeat-high-jump'),
  ('Speed Chess', 4, 'speed-chess'),
  ('T-Race', 4, 't-race'),
  ('Tag', 4, 'tag'),
  ('Touch Rugby', 4, 'touch-rugby'),
  ('Ab Rollout', 5, 'ab-wheel-rollout'),
  ('Chinup Contest', 5, 'chin-up-contest'),
  ('Finger Pushup', 5, 'finger-push-up'),
  ('GHD Situp', 5, 'ghd-situp'),
  ('Hamstring Curl', 5, 'hamstring-curl'),
  ('Leg Ext Hold', 5, 'leg-extension'),
  ('Lunges', 5, 'lunges'),
  ('Pushup Contest', 5, 'push-up-contest'),
  ('Sandbag to Shoulder', 5, 'sandbag-to-shoulder'),
  ('Tibialis Curl', 5, 'tibialis-curl'),
  ('Toe Lift', 5, 'toe-lift'),
  ('Wall Sit', 5, 'wall-sit'),
  ('Animal Crawl', 6, 'animal-crawl'),
  ('Breath Hold', 6, 'breath-hold'),
  ('Bronco', 6, 'bronco'),
  ('Burpee Broad Jump', 6, 'burpee-broad-jump'),
  ('Cycling', 6, 'cycling'),
  ('Row Erg', 6, 'row-erg'),
  ('Running', 6, 'running'),
  ('Scooting', 6, 'scooting'),
  ('Ski Erg', 6, 'ski-erg'),
  ('Weighted Carry', 6, 'weighted-carry'),
  ('Wheelbarrow Pull', 6, 'wheelbarrow-pull'),
  ('Wheelbarrow Push', 6, 'wheelbarrow-push'),
  ('Bridge', 7, 'bridge'),
  ('Foot Behind Head Pose', 7, 'foot-behind-head'),
  ('Forward Fold', 7, 'forward-fold'),
  ('Forward Split', 7, 'front-split'),
  ('Full Bound Twist', 7, 'full-bound-twist'),
  ('Middle Split', 7, 'middle-split'),
  ('Needle Pose', 7, 'needle-pose'),
  ('Pancake', 7, 'pancake'),
  ('Rear Hand Clasp', 7, 'rear-hand-clasp'),
  ('Shoulder Dislocate', 7, 'shoulder-dislocate'),
  ('Side Bend', 7, 'side-bend'),
  ('Standing Split', 7, 'standing-split'),
  ('Balance Ball', 8, 'balance-ball'),
  ('Breakdancing', 8, 'breakdancing'),
  ('Fencing', 8, 'fencing'),
  ('Foot Juggling', 8, 'foot-juggling'),
  ('Gymnastics', 8, 'gymnastics'),
  ('Juggling', 8, 'juggling'),
  ('Jump Rope', 8, 'jump-rope'),
  ('SKATE', 8, 'skate'),
  ('Slackline', 8, 'slackline'),
  ('Tae Kwon Do', 8, 'tae-kwon-do'),
  ('Trampolining', 8, 'trampolining'),
  ('Wrestling', 8, 'wrestling'),
  ('Badminton', 9, 'badminton'),
  ('Baseball', 9, 'baseball'),
  ('Basketball', 9, 'basketball'),
  ('Cricket', 9, 'cricket'),
  ('Football', 9, 'football'),
  ('Hockey', 9, 'hockey'),
  ('Lacrosse', 9, 'lacrosse'),
  ('Squash', 9, 'squash'),
  ('Tennis', 9, 'tennis'),
  ('Teqball', 9, 'teqball'),
  ('Ultimate Frisbee', 9, 'ultimate-frisbee'),
  ('Volleyball', 9, 'volleyball'),
  ('Archery', 10, 'archery'),
  ('Bocce', 10, 'bocce'),
  ('Bowling', 10, 'bowling'),
  ('Carrom', 10, 'carrom'),
  ('Darts', 10, 'darts'),
  ('Disc Golf', 10, 'disc-golf'),
  ('Dodgeball', 10, 'dodgeball'),
  ('Golf', 10, 'golf'),
  ('Handball', 10, 'handball'),
  ('Kubb', 10, 'kubb'),
  ('Netball', 10, 'netball'),
  ('Table Tennis', 10, 'table-tennis');

DO $$
DECLARE v_events int; v_domains int;
BEGIN
  SELECT count(*) INTO v_events FROM event_domains;
  IF v_events <> 120 THEN
    RAISE EXCEPTION 'roster mirror: event_domains holds % rows, expected 120', v_events;
  END IF;

  SELECT count(*) INTO v_domains FROM (
    SELECT domain_number FROM event_domains GROUP BY domain_number HAVING count(*) <> 12
  ) x;
  IF v_domains > 0 THEN
    RAISE EXCEPTION 'roster mirror: % domains do not hold exactly 12 events', v_domains;
  END IF;

  IF EXISTS (SELECT 1 FROM event_domains WHERE slug = 'duck-walk') THEN
    RAISE EXCEPTION 'roster mirror: duck-walk is still seeded';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = 'animal-crawl') THEN
    RAISE EXCEPTION 'roster mirror: animal-crawl was not seeded';
  END IF;
END $$;

COMMIT;
