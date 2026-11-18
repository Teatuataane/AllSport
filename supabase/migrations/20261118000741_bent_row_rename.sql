-- Pause Row -> Bent Row (18 Nov 2026, Tāne)
--
-- The one-second pause on the body is no longer required, so the name drops
-- it. A NAME change only: the slug stays 'pause-row', so results, workout
-- entries, plans, exemptions, aliases and grade_awards.events (all keyed on
-- the slug) are untouched, as with L-Sit in 20261005032653.
--
-- History is kept together on purpose. Every past lift was paused, which is
-- stricter than what is asked now, so an old best still stands as a Bent Row.
--
-- What keys on the NAME:
--   * session_events.event_name, which /prs, lib/percentile.ts and My Events
--     group history by: backfilled below.
--   * event_domains, the roster mirror: re-seeded IN FULL as for every roster
--     change (__tests__/sqlMirrors.test.ts reads the newest seed). Still 154.
--   * enforce_lift_estimate(), which finds a game result's lift by its draw's
--     NAME: redefined whole from 20261102211504 with 'Bent Row' in place of
--     'Pause Row' (__tests__/estimatedOneRm.test.ts pins the list to the
--     roster exactly). The browser sends the same estimate, so a draw an old
--     bundle makes in the gap still ranks right; the re-run renames it.
-- Nothing else names it: it is not a contest (matches, guard_workout_entries_
-- write and record_entry_match list contests only) and has no levels
-- (enforce_relevelled_ladders does not guard it).
--
-- ORDER: DEPLOY THE CODE FIRST, then this straight after. Run it again
-- afterwards if a draw was made by an old bundle in between: it is safe to
-- re-run (the backfill and the re-seed are idempotent).

BEGIN;

UPDATE session_events SET event_name = 'Bent Row', event_slug = 'pause-row'
 WHERE event_name = 'Pause Row' OR event_slug = 'pause-row';

-- ─── event_domains: the roster mirrored into SQL, 154 rows ───────────────────
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
  ('Bent Row', 1, 'pause-row'),
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

-- ─── enforce_lift_estimate: copied whole from 20261102211504 ────────────────
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
  -- CHANGED 20261118000741: Pause Row is now Bent Row.
  IF v_name IN ('1A Press', 'Deadlift', 'Pause Back Squat', 'Zercher Dead', 'Pause Bench', 'Turkish Getup', 'Arthur Lift', 'Bent Row', 'Pause Front Squat', 'Loaded Lunge', 'Steinborn Lift', 'Overhead Press', 'Weighted Tuck', 'Kelly Snatch', '1A Snatch', 'Clean & Jerk', 'Snatch', 'Sandbag to Shoulder')
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

-- ─── Assertions ──────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM event_domains) <> 154 THEN
    RAISE EXCEPTION 'bent row: event_domains holds % rows, expected 154', (SELECT count(*) FROM event_domains);
  END IF;
  IF (SELECT event_name FROM event_domains WHERE slug = 'pause-row') IS DISTINCT FROM 'Bent Row' THEN
    RAISE EXCEPTION 'bent row: event_domains does not name pause-row Bent Row';
  END IF;
  IF EXISTS (SELECT 1 FROM session_events WHERE event_name = 'Pause Row') THEN
    RAISE EXCEPTION 'bent row: a draw is still named Pause Row';
  END IF;
END $$;

COMMIT;
