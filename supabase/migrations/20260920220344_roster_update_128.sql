-- Roster update: 128 events (Sept 2026)
--
-- Re-seeds event_domains IN FULL, which CLAUDE.md requires of whichever
-- migration changes the roster. This file is now THE definition of the mirror,
-- and __tests__/sqlMirrors.test.ts reads the newest file carrying the seed.
--
-- Generated from lib/eventData.ts. What changed, from Tāne's list of 21 Sept 2026:
--
--   ADDED (8)    Pullover & Press, Loaded Lunge (Maximal Strength);
--                Skull Hang (Calisthenics); Calf Raises (Anaerobic Endurance);
--                Plie Squat, Seiza, Wrist Stretch, Reverse Wrist Stretch
--                (Flexibility).
--   MOVED (1)    Climbing, Calisthenics -> Body Awareness. Slug stays
--                'rope-climb', so its 7 result rows stay attached and no
--                session_events.event_name sweep is needed. It also gained a
--                Game rung, which is a ladder change and not visible here.
--   RENAMED (3)  Weighted Carry -> Sandbag Carry, Wheelbarrow Push -> Farmer
--                Carry, Wheelbarrow Pull -> Weighted Drag. THE SLUGS MOVE TOO.
--
-- WHY NO session_events SWEEP FOR THE THREE CARRIES. Renaming an event normally
-- orphans its whole PR history (CLAUDE.md, August 2026). Verified against
-- production on 2026-09-21 before writing this: `results` holds ZERO rows for
-- all three names, so there is no history to carry over and nothing to orphan.
-- Weighted Carry's 15 historical rows from 12 players were archived and deleted
-- by 20260915040534 when its ladder changed from fixed weights to bodyweight
-- fractions; they live in results_grading_archive_20260915040534 and are NOT in
-- `results`. That archive can no longer be restored onto a live event of that
-- name, which is the one cost of this rename and is accepted.
--
-- DOMAINS ARE NO LONGER EVEN. Tāne accepted 14/12/12/12/13/12/16/13/12/12
-- rather than trim to twelve. The old assertion that every domain holds exactly
-- 12 is therefore REPLACED with one that every domain holds at least 12 — the
-- invariant that still matters is that no domain can be drained below the six
-- events a colour asks for.
--
-- Code-first or migration-first are both safe: event_domains feeds domain
-- rollup only, and every read of it is its own query.

BEGIN;

-- event_domains: the roster mirrored into SQL, 128 rows.
-- Per domain: 1: 14, 2: 12, 3: 12, 4: 12, 5: 13, 6: 12, 7: 16, 8: 13, 9: 12, 10: 12.
DELETE FROM event_domains;
INSERT INTO event_domains (event_name, domain_number, slug) VALUES
  ('1A Press', 1, 'one-arm-press'),
  ('Arthur Lift', 1, 'arthur-lift'),
  ('Clean & Press', 1, 'clean-and-press'),
  ('Deadlift', 1, 'deadlift'),
  ('Loaded Lunge', 1, 'loaded-lunge'),
  ('Pause Back Squat', 1, 'pause-squat'),
  ('Pause Bench', 1, 'pause-bench'),
  ('Pause Chinup', 1, 'pause-chin-up'),
  ('Pause Dips', 1, 'pause-dips'),
  ('Pause Front Squat', 1, 'pause-front-squat'),
  ('Pause Row', 1, 'pause-row'),
  ('Pullover & Press', 1, 'pullover-and-press'),
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
  ('L-Sit Hold', 2, 'l-sit-hold'),
  ('Planche', 2, 'planche'),
  ('Skull Hang', 2, 'skull-hang'),
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
  ('Calf Raises', 5, 'calf-raises'),
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
  ('Farmer Carry', 6, 'farmer-carry'),
  ('Row Erg', 6, 'row-erg'),
  ('Running', 6, 'running'),
  ('Sandbag Carry', 6, 'sandbag-carry'),
  ('Scooting', 6, 'scooting'),
  ('Ski Erg', 6, 'ski-erg'),
  ('Weighted Drag', 6, 'weighted-drag'),
  ('Bridge', 7, 'bridge'),
  ('Foot Behind Head Pose', 7, 'foot-behind-head'),
  ('Forward Fold', 7, 'forward-fold'),
  ('Forward Split', 7, 'front-split'),
  ('Full Bound Twist', 7, 'full-bound-twist'),
  ('Middle Split', 7, 'middle-split'),
  ('Needle Pose', 7, 'needle-pose'),
  ('Pancake', 7, 'pancake'),
  ('Plie Squat', 7, 'plie-squat'),
  ('Rear Hand Clasp', 7, 'rear-hand-clasp'),
  ('Reverse Wrist Stretch', 7, 'reverse-wrist-stretch'),
  ('Seiza', 7, 'seiza'),
  ('Shoulder Dislocate', 7, 'shoulder-dislocate'),
  ('Side Bend', 7, 'side-bend'),
  ('Standing Split', 7, 'standing-split'),
  ('Wrist Stretch', 7, 'wrist-stretch'),
  ('Balance Ball', 8, 'balance-ball'),
  ('Breakdancing', 8, 'breakdancing'),
  ('Climbing', 8, 'rope-climb'),
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
DECLARE
  v_events int;
  v_thin int;
BEGIN
  SELECT count(*) INTO v_events FROM event_domains;
  IF v_events <> 128 THEN
    RAISE EXCEPTION 'roster mirror: event_domains holds % rows, expected 128', v_events;
  END IF;

  SELECT count(*) INTO v_thin FROM (
    SELECT domain_number FROM event_domains GROUP BY domain_number HAVING count(*) < 12
  ) x;
  IF v_thin > 0 THEN
    RAISE EXCEPTION 'roster mirror: % domains hold fewer than 12 events', v_thin;
  END IF;

  IF (SELECT count(DISTINCT domain_number) FROM event_domains) <> 10 THEN
    RAISE EXCEPTION 'roster mirror: expected exactly 10 domains';
  END IF;

  IF EXISTS (SELECT 1 FROM event_domains WHERE slug IN ('weighted-carry', 'wheelbarrow-push', 'wheelbarrow-pull')) THEN
    RAISE EXCEPTION 'roster mirror: a retired carry slug is still seeded';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = 'rope-climb' AND domain_number = 8) THEN
    RAISE EXCEPTION 'roster mirror: Climbing did not land in Body Awareness';
  END IF;
END $$;

-- ─── activity_aliases: four aliases pointed at a slug that no longer exists ──
--
-- 20260918023038 seeded 'farmers walk', 'farmers carry', 'farmer carry' and
-- 'sandbag carry' onto 'weighted-carry'. AN ALIAS MATCHING NO EVENT DOES
-- NOTHING AT ALL — no error, no warning, fit_activity() just never fits it —
-- which is the exact failure mode that hid a wrong TIMED_EFFORT_SLUGS entry for
-- three months. __tests__/trainingLoad.test.ts is what caught this one.
--
-- They also now land better than they did: 'farmer carry' is a Farmer Carry and
-- 'sandbag carry' is a Sandbag Carry, where before both were the one generic
-- event. No alias is added, renamed or removed — only repointed.
UPDATE activity_aliases SET event_slug = 'farmer-carry'
 WHERE alias IN ('farmers walk', 'farmers carry', 'farmer carry');
UPDATE activity_aliases SET event_slug = 'sandbag-carry'
 WHERE alias = 'sandbag carry';

DO $$
DECLARE v_orphans int;
BEGIN
  SELECT count(*) INTO v_orphans
    FROM activity_aliases a
    LEFT JOIN event_domains e ON e.slug = a.event_slug
   WHERE e.slug IS NULL;
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'activity_aliases: % alias(es) point at no event', v_orphans;
  END IF;
END $$;

COMMIT;
