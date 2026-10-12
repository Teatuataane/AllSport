-- Reverse Wrist Ext: slug reverse-wrist-extension -> wrist-extension (12 Oct 2026, Tāne)
--
-- The event keeps its name, 'Reverse Wrist Ext', and its ladder; only the slug
-- changes, to match its icon file (public/event-icons/wrist-extension.png).
-- The event went live on 6 Oct 2026, so players may already hold results,
-- workout entries and colours under the old slug. Every table that stores a
-- slug is repointed here: session_events, workout_entries, grade_exemptions,
-- grade_awards.events and workouts.planned_events, and the
-- event_domains mirror is re-seeded IN FULL (__tests__/sqlMirrors.test.ts reads
-- the newest seed). session_events.event_name is untouched: the name did not
-- change, so My Events and records keep their history.
--
-- No activity alias points at this event (none is seeded for it), so
-- activity_aliases is only checked, below. No function or trigger body names
-- this slug (it is not a pure contest and not on the lift list), so no function
-- is redefined.
--
-- ORDER: DEPLOY THE CODE FIRST, then apply this straight after. Until it runs,
-- the new bundle cannot resolve rows still stored under the old slug (they are
-- ignored by grading, never withdrawn), and a new workout entry for this one
-- event is refused by guard_workout_entries_write because 'wrist-extension' is
-- not yet in event_domains. After it runs, ask kaiwhakawā to hard-refresh.

BEGIN;

-- event_domains: the roster mirrored into SQL, 144 rows.
-- Per domain: 1: 16, 2: 13, 3: 15, 4: 15, 5: 14, 6: 15, 7: 15, 8: 14, 9: 13, 10: 14.
DELETE FROM event_domains;
INSERT INTO event_domains (event_name, domain_number, slug) VALUES
  ('1A Press', 1, 'one-arm-press'),
  ('Arthur Lift', 1, 'arthur-lift'),
  ('Clean & Press', 1, 'clean-and-press'),
  ('Deadlift', 1, 'deadlift'),
  ('Glute Thrust', 1, 'glute-thrust'),
  ('Loaded Lunge', 1, 'loaded-lunge'),
  ('Pause Back Squat', 1, 'pause-squat'),
  ('Pause Bench', 1, 'pause-bench'),
  ('Pause Chinup', 1, 'pause-chin-up'),
  ('Pause Dips', 1, 'pause-dips'),
  ('Pause Front Squat', 1, 'pause-front-squat'),
  ('Pause Row', 1, 'pause-row'),
  ('Pullover & Press', 1, 'pullover-and-press'),
  ('Steinborn', 1, 'steinborn'),
  ('Turkish Getup', 1, 'turkish-get-up'),
  ('Zercher Dead', 1, 'zercher-deadlift'),
  ('1 Leg Squat', 2, '1-leg-squat'),
  ('Back Lever', 2, 'back-lever'),
  ('Chin Hang', 2, 'chin-hang'),
  ('Front Lever', 2, 'front-lever'),
  ('Handstand', 2, 'hand-walk'),
  ('Headstand', 2, 'headstand'),
  ('Human Flag', 2, 'flag'),
  ('Iron Cross', 2, 'iron-cross'),
  ('L-Sit', 2, 'l-sit-hold'),
  ('Planche', 2, 'planche'),
  ('Reverse Maltese', 2, 'reverse-maltese'),
  ('Skull Hang', 2, 'skull-hang'),
  ('Windshield Wipers', 2, 'windshield-wipers'),
  ('1A Snatch', 3, 'one-arm-snatch'),
  ('Arm Wrestling', 3, 'arm-wrestling'),
  ('Clap Pushups', 3, 'clap-pushups'),
  ('Clean & Jerk', 3, 'clean-and-jerk'),
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
  ('100m Sprint', 4, '100m-sprint'),
  ('200m Sprint', 4, '200m-sprint'),
  ('400m Sprint', 4, '400m-sprint'),
  ('800m Sprint', 4, '800m-sprint'),
  ('American Football', 4, 'american-football'),
  ('Australian Football', 4, 'australian-football'),
  ('Beach Flags', 4, 'beach-flags'),
  ('Capture the Flag', 4, 'capture-the-flag'),
  ('Kabaddi', 4, 'kabaddi'),
  ('Rats & Rabbits', 4, 'rats-and-rabbits'),
  ('Repeat Vault', 4, 'repeat-high-jump'),
  ('Speed Chess', 4, 'speed-chess'),
  ('T-Race', 4, 't-race'),
  ('Tag', 4, 'tag'),
  ('Touch Rugby', 4, 'touch-rugby'),
  ('Back Extension', 5, 'back-extension'),
  ('Calf Raises', 5, 'calf-raises'),
  ('Chinups', 5, 'chin-up-contest'),
  ('Finger Pushup', 5, 'finger-push-up'),
  ('GHD Situp', 5, 'ghd-situp'),
  ('Hamstring Curl', 5, 'hamstring-curl'),
  ('Hollow Hold', 5, 'hollow-hold'),
  ('Leg Ext Hold', 5, 'leg-extension'),
  ('Pushups', 5, 'push-up-contest'),
  ('Reverse Wrist Ext', 5, 'wrist-extension'),
  ('Sandbag to Shoulder', 5, 'sandbag-to-shoulder'),
  ('Tibialis Curl', 5, 'tibialis-curl'),
  ('Toe Lift', 5, 'toe-lift'),
  ('Wall Sit', 5, 'wall-sit'),
  ('Animal Crawl', 6, 'animal-crawl'),
  ('Breath Hold', 6, 'breath-hold'),
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
  ('Swim', 6, 'swim'),
  ('Walking', 6, 'walking'),
  ('Weighted Drag', 6, 'weighted-drag'),
  ('Bridge', 7, 'bridge'),
  ('External Wrist Stretch', 7, 'reverse-wrist-stretch'),
  ('Foot Behind Head Pose', 7, 'foot-behind-head'),
  ('Forward Fold', 7, 'forward-fold'),
  ('Forward Split', 7, 'front-split'),
  ('Full Bound Twist', 7, 'full-bound-twist'),
  ('Internal Wrist Stretch', 7, 'wrist-stretch'),
  ('Middle Split', 7, 'middle-split'),
  ('Needle Pose', 7, 'needle-pose'),
  ('Pancake', 7, 'pancake'),
  ('Plie Squat', 7, 'plie-squat'),
  ('Rear Hand Clasp', 7, 'rear-hand-clasp'),
  ('Seiza', 7, 'seiza'),
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
  ('Water Polo', 9, 'water-polo'),
  ('Airsoft', 10, 'airsoft'),
  ('Archery', 10, 'archery'),
  ('Bocce', 10, 'bocce'),
  ('Bowling', 10, 'bowling'),
  ('Carrom', 10, 'carrom'),
  ('Cornhole', 10, 'cornhole'),
  ('Darts', 10, 'darts'),
  ('Disc Golf', 10, 'disc-golf'),
  ('Dodgeball', 10, 'dodgeball'),
  ('Golf', 10, 'golf'),
  ('Handball', 10, 'handball'),
  ('Kubb', 10, 'kubb'),
  ('Netball', 10, 'netball'),
  ('Table Tennis', 10, 'table-tennis');

-- Repoint every stored slug. AFTER the re-seed on purpose: guard_workouts_write
-- and guard_workout_entries_write check planned_events / event_slug against
-- event_domains, so the new slug has to be on the roster before a row can name it.
UPDATE session_events   SET event_slug = 'wrist-extension' WHERE event_slug = 'reverse-wrist-extension';
UPDATE workout_entries  SET event_slug = 'wrist-extension' WHERE event_slug = 'reverse-wrist-extension';
UPDATE grade_exemptions SET event_slug = 'wrist-extension' WHERE event_slug = 'reverse-wrist-extension';
UPDATE grade_awards     SET events = array_replace(events, 'reverse-wrist-extension', 'wrist-extension')
 WHERE 'reverse-wrist-extension' = ANY (events);
UPDATE workouts         SET planned_events = array_replace(planned_events, 'reverse-wrist-extension', 'wrist-extension')
 WHERE 'reverse-wrist-extension' = ANY (planned_events);

DO $$
BEGIN
  IF (SELECT count(*) FROM event_domains) <> 144 THEN
    RAISE EXCEPTION 'wrist-extension slug: event_domains holds % rows, expected 144', (SELECT count(*) FROM event_domains);
  END IF;
  IF EXISTS (SELECT 1 FROM event_domains GROUP BY slug HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'wrist-extension slug: a slug is seeded twice';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = 'wrist-extension' AND event_name = 'Reverse Wrist Ext' AND domain_number = 5) THEN
    RAISE EXCEPTION 'wrist-extension slug: Reverse Wrist Ext is not seeded under wrist-extension in Stamina';
  END IF;
  IF EXISTS (SELECT 1 FROM event_domains WHERE slug = 'reverse-wrist-extension') THEN
    RAISE EXCEPTION 'wrist-extension slug: the old slug is still seeded';
  END IF;
  IF EXISTS (SELECT 1 FROM session_events WHERE event_slug = 'reverse-wrist-extension')
     OR EXISTS (SELECT 1 FROM workout_entries WHERE event_slug = 'reverse-wrist-extension')
     OR EXISTS (SELECT 1 FROM activity_aliases a LEFT JOIN event_domains e ON e.slug = a.event_slug WHERE e.slug IS NULL)
     OR EXISTS (SELECT 1 FROM grade_exemptions WHERE event_slug = 'reverse-wrist-extension')
     OR EXISTS (SELECT 1 FROM grade_awards WHERE 'reverse-wrist-extension' = ANY (events))
     OR EXISTS (SELECT 1 FROM workouts WHERE 'reverse-wrist-extension' = ANY (planned_events)) THEN
    RAISE EXCEPTION 'wrist-extension slug: a row still carries the old slug';
  END IF;
END $$;

COMMIT;
