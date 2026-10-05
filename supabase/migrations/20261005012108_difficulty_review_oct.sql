-- The 5 October 2026 difficulty review (Tāne)
--
-- The history half of the roster and ladder changes in EVENT_DIFFICULTY_REVIEW.md
-- (5 Oct 2026). The code half is lib/eventData.ts, compiled from that sheet.
-- What this file does, all in one transaction:
--
--   ROSTER (126 events, re-seeds event_domains IN FULL, which is the rule for
--   any migration that changes the roster; __tests__/sqlMirrors.test.ts reads the
--   newest seed):
--     REMOVED  Lunges (Anaerobic Endurance) and Shoulder Dislocate (Flexibility).
--              Every score is archived then deleted; their draws in
--              session_events are KEPT (a draw is history, not a score).
--     RENAMED  Repeat High Jump -> Repeat Vault, Chinup Contest -> Chinups,
--              Pushup Contest -> Pushups. SLUGS DO NOT MOVE, so workout entries,
--              plans and exemptions are untouched; only session_events.event_name
--              (which results and PRs group by) is swept. The ladders are
--              unchanged, so history carries over.
--     DOMAIN 6 Aerobic Endurance -> Endurance (session_events.domain_name).
--
--   LADDERS (same mode): 25 events renamed, reordered or lost rungs. A row on a
--   rung that survives (by name, or by an explicit rename such as Climbing's
--   'No Feet Rope Hang' -> 'No Feet Hang') moves to the rung's new index with
--   its within-rung term unchanged. A row on a removed rung is archived and
--   deleted: Tāne, review item 14, "remove historical scores that conflict".
--
--   MODES:
--     13 contests become plain win/draw/loss (sport): Arm Wrestling, Tug of
--       War, 100m Sprint, Tag, T-Race, Beach Flags, 200m Sprint, Rats &
--       Rabbits, Speed Chess, Capture the Flag, Kabaddi, Tae Kwon Do, Fencing.
--       A Game-rung row keeps its result (raw 0/1/2, no level), the shape
--       Wrestling has always had. Every drill row is archived.
--     Javelin and Shotput lose their implements: a row on the full javelin or
--       full-weight shot becomes its distance in cm; lighter implements are
--       archived.
--     Running, Cycling, Ski Erg, Row Erg, Scooting become an open distance +
--       time, ranked on the time Riegel predicts over 1000m. A 1000m row is
--       exactly that time; 250m and 500m rows are below the reference distance,
--       which the formula cannot extrapolate up to, so they are archived.
--     Animal Crawl keeps its crawls as levels with an open distance + time over
--       25m. 25m rows keep their time; a 100m Duck Walk becomes a Duck Walk
--       predicting its 25m time (Riegel, the same rounding as
--       predictedEffortSecs in lib/eventData.ts).
--     Sandbag Carry, Farmer Carry, Weighted Drag become an open load +
--       distance + time. Their rows are fractions of a bodyweight with no load
--       recorded, so they cannot be converted and are archived.
--     Tibialis Curl becomes any load + reps: each level was a load, so every
--       row converts exactly (Bodyweight = 0kg).
--
--   FUNCTIONS: guard_workout_entries_write and record_entry_match list the
--   pure contests by slug (they have no Game rung to name); the thirteen join
--   Wrestling. enforce_lift_estimate refuses a Tibialis Curl that still names a
--   level, the old-bundle shape, instead of one that does not.
--
--   Then placements are replayed for every closed, unvoided session touched,
--   and every touched player's grades watermark is cleared.
--
-- NOT MEASURED AGAINST PRODUCTION. This was written without database access,
-- so unlike earlier roster migrations no row counts are quoted here. Every
-- step is keyed on names and rungs, never on a count, and the closing
-- assertions fail the transaction if anything is left in an old shape. The
-- NOTICEs report what moved and what was archived: read them at apply time.
--
-- ⚠ DEPLOY THE CODE FIRST, THEN THIS STRAIGHT AFTER, WITH NO GAME OR WORKOUT
-- RUNNING. event_domains is the write gate for workouts (see 20260920220344):
-- in the gap the new bundle's rows for converted events are written in their
-- new shape and are left alone here (each step matches only the OLD shape), and
-- a Tibialis Curl from the new bundle is refused until this lands. Code first
-- also keeps renamed events resolvable: the new bundle knows both the old
-- session_events names (none of them, briefly) and the new ones after this.
-- HARD-REFRESH every kaiwhakawā device afterwards.
--
-- ⚠ APPLY IN ONE TRANSACTION (`supabase db push`). Every working table is TEMP
-- … ON COMMIT DROP, so there is no BEGIN/COMMIT here.
--
-- AFTER: run scripts/refresh-leaderboard-scores.ts --apply to republish
-- season colour totals; the code bumps GRADING_RULES_VERSION so everyone is
-- rechecked. No colour is withdrawn (an ordinary recheck never withdraws), and
-- results.is_pr is frozen as it was set.

-- ─── Working tables ──────────────────────────────────────────────────────────

-- Same-mode ladders: every old rung, where it goes (NULL = archived).
-- Generated from lib/eventData.ts before and after the sheet was applied.
CREATE TEMP TABLE tier_map (
  event_name text, old_tier text, old_idx int, new_tier text, new_idx int
) ON COMMIT DROP;
INSERT INTO tier_map VALUES
  ('Iron Cross', '2 Feet Top Hold', 0, '2 Feet Top Hold', 0),
  ('Iron Cross', 'Straight Bar Top Hold', 1, 'Straight Bar Top Hold', 1),
  ('Iron Cross', 'Ring Top Hold', 2, 'Ring Top Hold', 2),
  ('Iron Cross', 'Elbow Supported Cross', 3, 'Elbow Iron Cross', 3),
  ('Iron Cross', 'Forearm Supported Iron Cross', 4, 'Forearm Iron Cross', 4),
  ('Iron Cross', 'Banded Iron Cross', 5, 'Banded Iron Cross', 5),
  ('Iron Cross', 'Iron Cross', 6, 'Iron Cross', 6),
  ('L-Sit Hold', '2 Feet Assisted Tuck', 0, '2 Feet Assisted Tuck', 0),
  ('L-Sit Hold', '1 Foot Assisted Tuck', 1, '1 Foot Assisted Tuck', 1),
  ('L-Sit Hold', 'Tuck Hold', 2, 'Tuck Hold', 2),
  ('L-Sit Hold', '1 Leg L-Sit', 3, '1 Leg L-Sit', 4),
  ('L-Sit Hold', 'L-Sit', 4, 'L-Sit', 5),
  ('L-Sit Hold', 'V-Sit', 5, 'V-Sit', 6),
  ('Finger Pushup', 'Elevated Knee', 0, 'Elevated Knee', 0),
  ('Finger Pushup', 'Knee Finger Pushup', 1, 'Knee Finger Pushup', 1),
  ('Finger Pushup', 'Finger Pushup', 2, 'Finger Pushup', 2),
  ('Finger Pushup', '4 Finger Pushup', 3, NULL, NULL),
  ('Finger Pushup', '3 Finger Pushup', 4, NULL, NULL),
  ('Finger Pushup', '2 Finger Pushup', 5, NULL, NULL),
  ('Finger Pushup', 'Thumb Pushup', 6, NULL, NULL),
  ('Middle Split', '2 Blocks', 0, '2 Blocks', 1),
  ('Middle Split', '1.5 Blocks', 1, '1.5 Blocks', 2),
  ('Middle Split', '1.25 Blocks', 2, NULL, NULL),
  ('Middle Split', '1 Block', 3, '1 Block', 3),
  ('Middle Split', '0.75 Blocks', 4, NULL, NULL),
  ('Middle Split', '0.5 Blocks', 5, '0.5 Blocks', 4),
  ('Middle Split', 'Middle Split', 6, 'Middle Split', 5),
  ('Pancake', 'Over 2 Blocks', 0, '3 Blocks', 0),
  ('Pancake', '2 Blocks', 1, '2 Blocks', 1),
  ('Pancake', '1.5 Blocks', 2, '1.5 Blocks', 2),
  ('Pancake', '1 Block', 3, '1 Block', 3),
  ('Pancake', '0.5 Blocks', 4, '0.5 Blocks', 4),
  ('Pancake', 'Elbows to Floor', 5, 'Elbows to Floor', 5),
  ('Pancake', 'Head to Floor', 6, 'Head to Floor', 6),
  ('Touch Rugby', 'Ball Passes', 0, 'Passes', 0),
  ('Touch Rugby', 'Partner Pass (2m)', 1, 'Pass (2m)', 1),
  ('Touch Rugby', 'Partner Pass (5m)', 2, 'Pass (5m)', 2),
  ('Touch Rugby', 'Moving Pass (5m)', 3, NULL, NULL),
  ('Touch Rugby', 'Game', 4, 'Game', 4),
  ('American Football', 'Ball Passes', 0, 'Passes', 0),
  ('American Football', 'Partner Pass (2m)', 1, 'Pass (2m)', 1),
  ('American Football', 'Partner Pass (5m)', 2, 'Pass (5m)', 2),
  ('American Football', 'Moving Pass (5m)', 3, NULL, NULL),
  ('American Football', 'Game', 4, 'Game', 5),
  ('Climbing', 'Leaning Rope Hold', 0, 'Assisted Hang', 0),
  ('Climbing', 'Assisted Rope Hang', 1, 'Hang', 1),
  ('Climbing', 'No Feet Rope Hang', 2, 'No Feet Hang', 2),
  ('Climbing', 'Feet Assisted Climb', 3, 'Feet Assisted Climb', 3),
  ('Climbing', 'No Feet Rope Climb', 4, 'No Feet Climb', 4),
  ('Climbing', 'L-Sit Rope Climb', 5, NULL, NULL),
  ('Climbing', 'Assisted Pegboard', 6, NULL, NULL),
  ('Climbing', 'Pegboard Climb', 7, NULL, NULL),
  ('Climbing', 'Game', 8, 'Game', 5),
  ('Breakdancing', 'Indian Step', 0, NULL, NULL),
  ('Breakdancing', 'Salsa Step', 1, NULL, NULL),
  ('Breakdancing', '6 Step', 2, NULL, NULL),
  ('Breakdancing', '3 Step', 3, NULL, NULL),
  ('Breakdancing', 'Baby Freeze', 4, NULL, NULL),
  ('Breakdancing', 'Pilot Freeze', 5, NULL, NULL),
  ('Breakdancing', 'Windmill', 6, NULL, NULL),
  ('Breakdancing', 'Game', 7, 'Game', 4),
  ('Trampolining', 'Basic Bounce', 0, 'Basic Bounce', 0),
  ('Trampolining', '180 Spin', 1, NULL, NULL),
  ('Trampolining', '360 Spin', 2, '360 Spin', 2),
  ('Trampolining', 'Forward Flip', 3, 'Forward Flip', 3),
  ('Trampolining', 'Back Flip', 4, 'Back Flip', 4),
  ('Trampolining', 'Front Flip 180', 5, NULL, NULL),
  ('Trampolining', 'Game', 6, 'Game', 5),
  ('Jump Rope', 'Basic Two-Foot Jump', 0, 'Basic Two-Foot Jump', 0),
  ('Jump Rope', 'Alternating Feet', 1, NULL, NULL),
  ('Jump Rope', 'Criss-Cross', 2, NULL, NULL),
  ('Jump Rope', 'Double Under', 3, NULL, NULL),
  ('Jump Rope', 'Single Dutch', 4, 'Single Dutch', 1),
  ('Jump Rope', 'Double Dutch', 5, 'Double Dutch', 2),
  ('Jump Rope', 'Game', 6, 'Game', 3),
  ('Gymnastics', 'Forward Roll', 0, 'Forward Roll', 0),
  ('Gymnastics', 'Backward Roll', 1, 'Backward Roll', 1),
  ('Gymnastics', 'Cartwheel', 2, 'Cartwheel', 2),
  ('Gymnastics', 'Roundoff', 3, NULL, NULL),
  ('Gymnastics', 'Handspring', 4, 'Handspring', 3),
  ('Gymnastics', 'One-Hand Cartwheel', 5, NULL, NULL),
  ('Gymnastics', 'Front Handspring', 6, NULL, NULL),
  ('Gymnastics', 'Game', 7, 'Game', 4),
  ('SKATE', '180 Pivot', 0, 'Board Tilts', 0),
  ('SKATE', '360 Pivot', 1, '360 Spin', 1),
  ('SKATE', 'Ollie', 2, 'Ollie', 2),
  ('SKATE', 'Pop Shove It', 3, 'Pop Shove It', 3),
  ('SKATE', 'Kickflip', 4, NULL, NULL),
  ('SKATE', 'Game', 5, 'Game', 4),
  ('Foot Juggling', '2 Bounce', 0, '2 Bounce', 0),
  ('Foot Juggling', '1 Bounce', 1, '1 Bounce', 1),
  ('Foot Juggling', '0 Bounce', 2, 'No Bounce', 2),
  ('Foot Juggling', 'Game', 3, 'Game', 3),
  ('Slackline', 'Single Leg Balance', 0, 'Single Leg Balance', 0),
  ('Slackline', 'Plank Walk', 1, NULL, NULL),
  ('Slackline', 'Beam Walk', 2, 'Beam', 1),
  ('Slackline', 'Slackline Walk', 3, 'Slackline', 2),
  ('Slackline', 'Slackline Bounce', 4, NULL, NULL),
  ('Slackline', 'Game', 5, 'Game', 3),
  ('Volleyball', 'Sets', 0, NULL, NULL),
  ('Volleyball', 'Digs', 1, NULL, NULL),
  ('Volleyball', 'Partner Digs (2m)', 2, NULL, NULL),
  ('Volleyball', 'Partner Digs (5m)', 3, NULL, NULL),
  ('Volleyball', 'Game', 4, 'Game', 4),
  ('Baseball', 'Pitch Ball', 0, NULL, NULL),
  ('Baseball', 'Bat Ball', 1, NULL, NULL),
  ('Baseball', 'Pitch & Bat (2m)', 2, NULL, NULL),
  ('Baseball', 'Pitch & Bat (5m)', 3, NULL, NULL),
  ('Baseball', 'Game', 4, 'Game', 5),
  ('Teqball', 'Juggles · 2 Bounce', 0, NULL, NULL),
  ('Teqball', 'Partner Pass', 1, NULL, NULL),
  ('Teqball', 'Partner Pass (2m)', 2, NULL, NULL),
  ('Teqball', 'Game', 3, 'Game', 3),
  ('Tennis', 'Vertical Juggles', 0, 'Vertical Juggles', 0),
  ('Tennis', 'Partner Hits (2m)', 1, 'Hits (2m)', 1),
  ('Tennis', 'Partner Hits (5m)', 2, 'Hits (5m)', 2),
  ('Tennis', 'Partner Hits (10m)', 3, 'Hits (10m)', 3),
  ('Tennis', 'Game', 4, 'Game', 4),
  ('Cricket', 'Bowl Ball', 0, NULL, NULL),
  ('Cricket', 'Bat Ball', 1, NULL, NULL),
  ('Cricket', 'Bowl & Bat (2m)', 2, NULL, NULL),
  ('Cricket', 'Bowl & Bat (5m)', 3, NULL, NULL),
  ('Cricket', 'Game', 4, 'Game', 5),
  ('Netball', 'Chest Pass', 0, NULL, NULL),
  ('Netball', 'Shot Under Hoop', 1, 'Shot Under Hoop', 0),
  ('Netball', 'Shot (2m)', 2, 'Shot (2m)', 1),
  ('Netball', 'Shot (5m)', 3, 'Shot (5m)', 2),
  ('Netball', 'Game', 4, 'Game', 3),
  ('Darts', 'Hit the Board', 0, 'Hit the Board', 0),
  ('Darts', 'Named Number', 1, 'Named Number', 1),
  ('Darts', 'Named Double', 2, NULL, NULL),
  ('Darts', 'Bullseye', 3, NULL, NULL),
  ('Darts', 'Game', 4, 'Game', 2),
  ('Disc Golf', 'Putt (2m)', 0, 'Putt (2m)', 0),
  ('Disc Golf', 'Putt (5m)', 1, 'Putt (5m)', 1),
  ('Disc Golf', 'Approach (20m)', 2, NULL, NULL),
  ('Disc Golf', 'Game (4 Holes)', 3, 'Game', 3),
  ('Golf', 'Putt (2m)', 0, 'Putt (2m)', 0),
  ('Golf', 'Putt (5m)', 1, 'Putt (5m)', 1),
  ('Golf', 'Chip (10m)', 2, 'Chip (10m)', 2),
  ('Golf', 'Game (4 Holes)', 3, 'Game', 3),
  ('Table Tennis', 'Vertical Juggles', 0, 'Vertical Juggles', 0),
  ('Table Tennis', 'Wall Juggles', 1, 'Wall Juggles', 1),
  ('Table Tennis', 'Partner Hits', 2, NULL, NULL),
  ('Table Tennis', 'Game', 3, 'Game', 2);

-- The thirteen contests that become plain win/draw/loss.
CREATE TEMP TABLE contest (event_name text PRIMARY KEY, slug text NOT NULL) ON COMMIT DROP;
INSERT INTO contest VALUES
  ('Arm Wrestling', 'arm-wrestling'),
  ('Tug of War', 'tug-of-war'),
  ('100m Sprint', '100m-sprint'),
  ('Tag', 'tag'),
  ('T-Race', 't-race'),
  ('Beach Flags', 'beach-flags'),
  ('200m Sprint', '200m-sprint'),
  ('Rats & Rabbits', 'rats-and-rabbits'),
  ('Speed Chess', 'speed-chess'),
  ('Capture the Flag', 'capture-the-flag'),
  ('Kabaddi', 'kabaddi'),
  ('Tae Kwon Do', 'tae-kwon-do'),
  ('Fencing', 'fencing');

-- Open distance + time over 1000m. The old 1000m rung was index 2 on all five.
CREATE TEMP TABLE effort (event_name text PRIMARY KEY, slug text NOT NULL) ON COMMIT DROP;
INSERT INTO effort VALUES
  ('Running', 'running'), ('Cycling', 'cycling'), ('Ski Erg', 'ski-erg'),
  ('Row Erg', 'row-erg'), ('Scooting', 'scooting');

-- Animal Crawl: old rung -> new rung, and the metres the old rung covered.
CREATE TEMP TABLE crawl_map (old_tier text, old_idx int, new_tier text, new_idx int, metres int) ON COMMIT DROP;
INSERT INTO crawl_map VALUES
  ('25m Crawl', 0, 'Crawl', 0, 25),
  ('25m Bear Crawl', 1, 'Bear Crawl', 1, 25),
  ('25m Lizard Crawl', 2, 'Lizard Crawl', 2, 25),
  ('25m Duck Walk', 3, 'Duck Walk', 3, 25),
  ('100m Duck Walk', 4, 'Duck Walk', 3, 100);

-- Tibialis Curl: each old level was a load.
CREATE TEMP TABLE tib_map (old_tier text, old_idx int, kg numeric) ON COMMIT DROP;
INSERT INTO tib_map VALUES
  ('Bodyweight', 0, 0), ('2.5kg', 1, 2.5), ('5kg', 2, 5), ('10kg', 3, 10), ('15kg', 4, 15), ('20kg', 5, 20);

-- Throws: the one implement that survives, and its old index.
CREATE TEMP TABLE throw_map (event_name text PRIMARY KEY, slug text, keep_tier text, keep_idx int) ON COMMIT DROP;
INSERT INTO throw_map VALUES
  ('Javelin', 'javelin-throw', 'Long Javelin', 2),
  ('Shotput', 'shot-put', 'Full Weight', 2);

CREATE TEMP TABLE carry (event_name text PRIMARY KEY, slug text NOT NULL) ON COMMIT DROP;
INSERT INTO carry VALUES
  ('Sandbag Carry', 'sandbag-carry'), ('Farmer Carry', 'farmer-carry'), ('Weighted Drag', 'weighted-drag');

CREATE TEMP TABLE removed (event_name text PRIMARY KEY, slug text NOT NULL) ON COMMIT DROP;
INSERT INTO removed VALUES ('Lunges', 'lunges'), ('Shoulder Dislocate', 'shoulder-dislocate');

-- Every event whose rows this file may touch, by name and slug.
CREATE TEMP TABLE affected (event_name text PRIMARY KEY, slug text) ON COMMIT DROP;
INSERT INTO affected
SELECT DISTINCT tm.event_name, ed.slug FROM tier_map tm LEFT JOIN event_domains ed ON ed.event_name = tm.event_name
UNION SELECT event_name, slug FROM contest
UNION SELECT event_name, slug FROM effort
UNION SELECT event_name, slug FROM throw_map
UNION SELECT event_name, slug FROM carry
UNION SELECT event_name, slug FROM removed
UNION SELECT 'Animal Crawl', 'animal-crawl'
UNION SELECT 'Tibialis Curl', 'tibialis-curl';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM affected WHERE slug IS NULL) THEN
    RAISE EXCEPTION 'difficulty review: an affected event is not in event_domains, so its slug is unknown';
  END IF;
END $$;

-- ─── Functions first: the data steps below write rows these triggers check ──

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

  -- CHANGED 20261005012108: thirteen more pure contests (the races and the
  -- contests whose drill ladders were removed on 5 Oct 2026) join Wrestling in
  -- the list. They have no rung to name, so the slug is the only way to know.
  -- A game result is allowed on a workout linked to an official game (a swap: a
  -- real opponent, a kaiwhakawā in the room) and nowhere else. Logged at home it
  -- would still count a win with nobody on the other side, which is what
  -- 20260916211643 exists to stop. Game rungs are recognised by NAME because the
  -- database does not hold the ladders; __tests__/workoutEntriesIntegrity.test.ts
  -- fails if that ever stops being true.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('wrestling', '100m-sprint', '200m-sprint', 'arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'kabaddi', 'rats-and-rabbits', 'speed-chess', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war'))
     AND v_session IS NULL THEN
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
  v_uid     uuid := auth.uid();
  v_judge   boolean := public.is_judge();
  e         record;
  v_active  boolean;
  v_name    text;
  v_term    int;
  v_outcome text;
  v_opp     uuid[];
  v_mates   uuid[];
  v_match   uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: sign in to record a match' USING ERRCODE = '42501';
  END IF;

  SELECT en.id, en.raw_score, en.difficulty_tier, en.event_slug,
         w.player_id, w.session_id
    INTO e
  FROM workout_entries en
  JOIN workouts w ON w.id = en.workout_id
  WHERE en.id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_entry_match: unknown entry %', p_entry_id USING ERRCODE = 'P0002';
  END IF;

  -- Only a swap AT a game is rated. A personal game has no opponent the server
  -- can trust, which is the decision this whole migration rests on.
  IF e.session_id IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: only a game played at an official game is rated'
      USING ERRCODE = '22023';
  END IF;

  -- Same authority as writing the entry itself (can_log_for).
  IF NOT public.can_log_for(e.player_id) THEN
    RAISE EXCEPTION 'record_entry_match: that entry belongs to someone else' USING ERRCODE = '42501';
  END IF;

  IF NOT v_judge THEN
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
     AND (e.difficulty_tier ILIKE 'Game%' OR e.event_slug IN ('wrestling', '100m-sprint', '200m-sprint', 'arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'kabaddi', 'rats-and-rabbits', 'speed-chess', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war')) THEN
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

  INSERT INTO matches (workout_entry_id, session_id, event_name, outcome, recorded_by)
  VALUES (p_entry_id, e.session_id, v_name, v_outcome, v_uid)
  RETURNING id INTO v_match;

  INSERT INTO match_players (match_id, player_id, side)
  SELECT v_match, e.player_id, 'a'
  UNION ALL SELECT v_match, x, 'a' FROM unnest(v_mates) AS x
  UNION ALL SELECT v_match, x, 'b' FROM unnest(v_opp)   AS x;

  RETURN v_match;
END;
$$;

REVOKE ALL ON FUNCTION public.record_entry_match(uuid, uuid[], uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_entry_match(uuid, uuid[], uuid[]) TO authenticated;

-- ─── Pre-images, before anything is rewritten ────────────────────────────────
-- Every scored row of every affected event, so the whole file is reversible
-- without arithmetic. The archives below hold the deleted rows in full.
-- Deliberately NOT `IF NOT EXISTS`: a table already there means a partial apply.
CREATE TABLE public.results_difficulty_preimage_20261005012108 AS
SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, r.result_type,
       r.weight_kg, r.reps, r.time_seconds, r.distance_m, se.event_name, now() AS captured_at
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE se.event_name IN (SELECT event_name FROM affected);
ALTER TABLE public.results_difficulty_preimage_20261005012108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_difficulty_preimage_20261005012108 FROM anon, authenticated;

CREATE TABLE public.workout_entries_difficulty_preimage_20261005012108 AS
SELECT e.id, e.raw_score, e.difficulty_tier, e.score_label,
       e.weight_kg, e.reps, e.time_seconds, e.distance_m, e.event_slug, now() AS captured_at
FROM workout_entries e
WHERE e.event_slug IN (SELECT slug FROM affected);
ALTER TABLE public.workout_entries_difficulty_preimage_20261005012108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_difficulty_preimage_20261005012108 FROM anon, authenticated;

-- Sessions and players whose standings move, captured before any delete.
CREATE TEMP TABLE touched_sessions ON COMMIT DROP AS
SELECT DISTINCT r.session_id FROM results r
WHERE r.id IN (SELECT id FROM public.results_difficulty_preimage_20261005012108)
  AND r.session_id IS NOT NULL;

CREATE TEMP TABLE touched_players ON COMMIT DROP AS
SELECT DISTINCT r.player_id FROM results r
WHERE r.id IN (SELECT id FROM public.results_difficulty_preimage_20261005012108) AND r.player_id IS NOT NULL
UNION
SELECT DISTINCT w.player_id FROM workout_entries e
JOIN workouts w ON w.id = e.workout_id
WHERE e.id IN (SELECT id FROM public.workout_entries_difficulty_preimage_20261005012108);

-- ─── Rows that cannot survive ────────────────────────────────────────────────
-- ONE definition per table, so the archive and the delete cannot disagree.
-- Each clause names the OLD shape, so a row the new bundle wrote in the gap
-- (code first) is never caught.
CREATE TEMP TABLE doomed_results ON COMMIT DROP AS
SELECT r.id FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE
  -- a removed event
  se.event_name IN (SELECT event_name FROM removed)
  -- a removed rung on a ladder that otherwise survives
  OR EXISTS (SELECT 1 FROM tier_map tm WHERE tm.event_name = se.event_name
             AND tm.old_tier = r.difficulty_tier AND tm.new_tier IS NULL)
  -- a contest drill (anything with a level other than the Game)
  OR (se.event_name IN (SELECT event_name FROM contest)
      AND r.difficulty_tier IS NOT NULL AND r.difficulty_tier <> 'Game')
  -- a throw with a lighter implement
  OR EXISTS (SELECT 1 FROM throw_map t WHERE t.event_name = se.event_name
             AND r.difficulty_tier IS NOT NULL AND r.difficulty_tier <> t.keep_tier)
  -- a distance effort shorter than the 1000m reference
  OR (se.event_name IN (SELECT event_name FROM effort)
      AND r.difficulty_tier IS NOT NULL AND r.difficulty_tier <> '1000m')
  -- a carry on a fraction of bodyweight, with no load recorded
  OR (se.event_name IN (SELECT event_name FROM carry) AND r.difficulty_tier IS NOT NULL);

CREATE TEMP TABLE doomed_entries ON COMMIT DROP AS
SELECT e.id FROM workout_entries e
WHERE e.event_slug IN (SELECT slug FROM removed)
  OR EXISTS (SELECT 1 FROM tier_map tm JOIN affected a ON a.event_name = tm.event_name
             WHERE a.slug = e.event_slug AND tm.old_tier = e.difficulty_tier AND tm.new_tier IS NULL)
  OR (e.event_slug IN (SELECT slug FROM contest)
      AND e.difficulty_tier IS NOT NULL AND e.difficulty_tier <> 'Game')
  OR EXISTS (SELECT 1 FROM throw_map t WHERE t.slug = e.event_slug
             AND e.difficulty_tier IS NOT NULL AND e.difficulty_tier <> t.keep_tier)
  OR (e.event_slug IN (SELECT slug FROM effort)
      AND e.difficulty_tier IS NOT NULL AND e.difficulty_tier <> '1000m')
  OR (e.event_slug IN (SELECT slug FROM carry) AND e.difficulty_tier IS NOT NULL);

-- CREATE TABLE … AS does not inherit RLS: on, with no policies, grants revoked.
CREATE TABLE public.results_difficulty_archive_20261005012108 AS
SELECT r.*, se.event_name AS archived_event_name, now() AS archived_at
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE r.id IN (SELECT id FROM doomed_results);
ALTER TABLE public.results_difficulty_archive_20261005012108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_difficulty_archive_20261005012108 FROM anon, authenticated;

CREATE TABLE public.workout_entries_difficulty_archive_20261005012108 AS
SELECT e.*, now() AS archived_at
FROM workout_entries e
WHERE e.id IN (SELECT id FROM doomed_entries);
ALTER TABLE public.workout_entries_difficulty_archive_20261005012108 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_difficulty_archive_20261005012108 FROM anon, authenticated;

-- A deleted result takes its match with it (matches.result_id ON DELETE
-- CASCADE). Only Game rows carry matches, and no Game row is doomed here.
DELETE FROM results WHERE id IN (SELECT id FROM doomed_results);
DELETE FROM workout_entries WHERE id IN (SELECT id FROM doomed_entries);

-- ─── 1. Same-mode ladders: surviving rungs to their new index ───────────────
-- The within-rung term (reps, seconds, a result) is unchanged; only the band
-- moves. The label keeps everything after its first ' · ' and gets the new
-- "D<n> <rung>" in front, the shape lib/scoring.ts writes.
UPDATE results r SET
  raw_score = r.raw_score - tm.old_idx * 10000 + tm.new_idx * 10000,
  difficulty_tier = tm.new_tier,
  score_label = CASE WHEN r.score_label ~ '^D[0-9]+ ' AND position(' · ' in r.score_label) > 0
    THEN 'D' || (tm.new_idx + 1) || ' ' || tm.new_tier || substr(r.score_label, position(' · ' in r.score_label))
    ELSE r.score_label END
FROM session_events se, tier_map tm
WHERE se.id = r.event_id AND tm.event_name = se.event_name
  AND tm.old_tier = r.difficulty_tier AND tm.new_tier IS NOT NULL
  AND (tm.new_idx <> tm.old_idx OR tm.new_tier <> tm.old_tier)
  AND r.raw_score IS NOT NULL
  AND floor(r.raw_score / 10000) = tm.old_idx;

UPDATE workout_entries e SET
  raw_score = e.raw_score - tm.old_idx * 10000 + tm.new_idx * 10000,
  difficulty_tier = tm.new_tier,
  score_label = CASE WHEN e.score_label ~ '^D[0-9]+ ' AND position(' · ' in e.score_label) > 0
    THEN 'D' || (tm.new_idx + 1) || ' ' || tm.new_tier || substr(e.score_label, position(' · ' in e.score_label))
    ELSE e.score_label END
FROM tier_map tm, affected a
WHERE a.event_name = tm.event_name AND a.slug = e.event_slug
  AND tm.old_tier = e.difficulty_tier AND tm.new_tier IS NOT NULL
  AND (tm.new_idx <> tm.old_idx OR tm.new_tier <> tm.old_tier)
  AND e.raw_score IS NOT NULL
  AND floor(e.raw_score / 10000) = tm.old_idx;

-- ─── 2. Contests: a Game row keeps its result, without a level ──────────────
-- Plain `sport` scores raw_score 0/1/2 (lib/scoring.ts), the shape Wrestling
-- has. The term is the result on every Game rung, raced ladders included
-- (20260915040534 never inverted it).
UPDATE results r SET
  raw_score = LEAST(GREATEST(r.raw_score - floor(r.raw_score / 10000) * 10000, 0), 2),
  difficulty_tier = NULL,
  score_label = CASE WHEN r.score_label ~ '^D[0-9]+ Game · '
    THEN substr(r.score_label, position(' · ' in r.score_label) + 3) ELSE r.score_label END,
  result_type = COALESCE(r.result_type,
    CASE (r.raw_score - floor(r.raw_score / 10000) * 10000) WHEN 2 THEN 'win' WHEN 1 THEN 'draw' ELSE 'loss' END)
FROM session_events se
WHERE se.id = r.event_id AND se.event_name IN (SELECT event_name FROM contest)
  AND r.difficulty_tier = 'Game' AND r.raw_score IS NOT NULL;

UPDATE workout_entries e SET
  raw_score = LEAST(GREATEST(e.raw_score - floor(e.raw_score / 10000) * 10000, 0), 2),
  difficulty_tier = NULL,
  score_label = CASE WHEN e.score_label ~ '^D[0-9]+ Game · '
    THEN substr(e.score_label, position(' · ' in e.score_label) + 3) ELSE e.score_label END
WHERE e.event_slug IN (SELECT slug FROM contest)
  AND e.difficulty_tier = 'Game' AND e.raw_score IS NOT NULL;

-- ─── 3. Throws: the full implement becomes a plain distance, in cm ──────────
-- difficulty+distance stored metres × 10 in the band; `distance` stores cm.
UPDATE results r SET
  distance_m = (r.raw_score - t.keep_idx * 10000) / 10.0,
  raw_score = round((r.raw_score - t.keep_idx * 10000) * 10),
  difficulty_tier = NULL,
  score_label = trim_scale(round((r.raw_score - t.keep_idx * 10000) / 10.0, 1))::text || 'm'
FROM session_events se, throw_map t
WHERE se.id = r.event_id AND se.event_name = t.event_name
  AND r.difficulty_tier = t.keep_tier AND r.raw_score IS NOT NULL;

UPDATE workout_entries e SET
  distance_m = (e.raw_score - t.keep_idx * 10000) / 10.0,
  raw_score = round((e.raw_score - t.keep_idx * 10000) * 10),
  difficulty_tier = NULL,
  score_label = trim_scale(round((e.raw_score - t.keep_idx * 10000) / 10.0, 1))::text || 'm'
FROM throw_map t
WHERE e.event_slug = t.slug AND e.difficulty_tier = t.keep_tier AND e.raw_score IS NOT NULL;

-- ─── 4. Distance efforts: a 1000m row IS its predicted 1000m time ───────────
-- Old: 2 * 10000 + (10000 - secs). New: 10000 - secs, no level.
UPDATE results r SET
  raw_score = r.raw_score - 20000,
  difficulty_tier = NULL,
  distance_m = 1000,
  time_seconds = COALESCE(r.time_seconds, 30000 - r.raw_score),
  score_label = '1km · ' || floor((30000 - r.raw_score) / 60)::int || ':'
    || lpad(((30000 - r.raw_score) - floor((30000 - r.raw_score) / 60) * 60)::int::text, 2, '0')
FROM session_events se
WHERE se.id = r.event_id AND se.event_name IN (SELECT event_name FROM effort)
  AND r.difficulty_tier = '1000m' AND r.raw_score BETWEEN 20001 AND 29999;

UPDATE workout_entries e SET
  raw_score = e.raw_score - 20000,
  difficulty_tier = NULL,
  distance_m = 1000,
  time_seconds = COALESCE(e.time_seconds, 30000 - e.raw_score),
  score_label = '1km · ' || floor((30000 - e.raw_score) / 60)::int || ':'
    || lpad(((30000 - e.raw_score) - floor((30000 - e.raw_score) / 60) * 60)::int::text, 2, '0')
WHERE e.event_slug IN (SELECT slug FROM effort)
  AND e.difficulty_tier = '1000m' AND e.raw_score BETWEEN 20001 AND 29999;

-- ─── 5. Animal Crawl: crawl styles stay levels, the 25m time ranks ──────────
-- secs is the time actually done; predicted is Riegel over 25m, rounded half
-- up exactly as predictedEffortSecs() does for a positive number.
CREATE TEMP TABLE crawl_calc ON COMMIT DROP AS
SELECT x.*, CASE WHEN x.metres = 25 THEN x.secs
                 ELSE round(x.secs * power(25.0 / x.metres, 1.06))::int END AS predicted
FROM (
  SELECT r.id, 'r' AS src, m.new_tier, m.new_idx, m.metres,
         (m.old_idx * 10000 + 10000 - r.raw_score)::int AS secs
  FROM results r
  JOIN session_events se ON se.id = r.event_id AND se.event_name = 'Animal Crawl'
  JOIN crawl_map m ON m.old_tier = r.difficulty_tier
  WHERE r.raw_score IS NOT NULL AND floor(r.raw_score / 10000) = m.old_idx
  UNION ALL
  SELECT e.id, 'e', m.new_tier, m.new_idx, m.metres,
         (m.old_idx * 10000 + 10000 - e.raw_score)::int
  FROM workout_entries e
  JOIN crawl_map m ON m.old_tier = e.difficulty_tier
  WHERE e.event_slug = 'animal-crawl' AND e.raw_score IS NOT NULL AND floor(e.raw_score / 10000) = m.old_idx
) x;

-- "D4 Duck Walk · 100m · 2:00 · est. 25m 0:28", as computeScoreVals writes it.
CREATE OR REPLACE FUNCTION pg_temp.mmss(s int) RETURNS text LANGUAGE sql IMMUTABLE AS
$f$ SELECT floor(s / 60)::int || ':' || lpad((s % 60)::text, 2, '0') $f$;

UPDATE results r SET
  raw_score = c.new_idx * 10000 + 10000 - c.predicted,
  difficulty_tier = c.new_tier,
  distance_m = c.metres,
  time_seconds = COALESCE(r.time_seconds, c.secs),
  score_label = 'D' || (c.new_idx + 1) || ' ' || c.new_tier || ' · ' || c.metres || 'm · ' || pg_temp.mmss(c.secs)
    || CASE WHEN c.metres = 25 THEN '' ELSE ' · est. 25m ' || pg_temp.mmss(c.predicted) END
FROM crawl_calc c
WHERE c.src = 'r' AND c.id = r.id AND c.predicted BETWEEN 1 AND 9999;

UPDATE workout_entries e SET
  raw_score = c.new_idx * 10000 + 10000 - c.predicted,
  difficulty_tier = c.new_tier,
  distance_m = c.metres,
  time_seconds = COALESCE(e.time_seconds, c.secs),
  score_label = 'D' || (c.new_idx + 1) || ' ' || c.new_tier || ' · ' || c.metres || 'm · ' || pg_temp.mmss(c.secs)
    || CASE WHEN c.metres = 25 THEN '' ELSE ' · est. 25m ' || pg_temp.mmss(c.predicted) END
FROM crawl_calc c
WHERE c.src = 'e' AND c.id = e.id AND c.predicted BETWEEN 1 AND 9999;

-- ─── 6. Tibialis Curl: the level was the load ────────────────────────────────
-- weight+reps: round(kg × 100) × 10000 + reps, as lib/scoring.ts encodes it.
UPDATE results r SET
  raw_score = round(m.kg * 100) * 10000 + (r.raw_score - m.old_idx * 10000),
  weight_kg = m.kg,
  reps = (r.raw_score - m.old_idx * 10000)::int,
  difficulty_tier = NULL,
  score_label = CASE WHEN m.kg > 0 THEN trim_scale(m.kg)::text || 'kg' ELSE 'Bodyweight' END
    || ' × ' || (r.raw_score - m.old_idx * 10000)::int || ' rep'
    || CASE WHEN (r.raw_score - m.old_idx * 10000) = 1 THEN '' ELSE 's' END
FROM session_events se, tib_map m
WHERE se.id = r.event_id AND se.event_name = 'Tibialis Curl'
  AND r.difficulty_tier = m.old_tier AND r.raw_score IS NOT NULL
  AND floor(r.raw_score / 10000) = m.old_idx;

UPDATE workout_entries e SET
  raw_score = round(m.kg * 100) * 10000 + (e.raw_score - m.old_idx * 10000),
  weight_kg = m.kg,
  reps = (e.raw_score - m.old_idx * 10000)::int,
  difficulty_tier = NULL,
  score_label = CASE WHEN m.kg > 0 THEN trim_scale(m.kg)::text || 'kg' ELSE 'Bodyweight' END
    || ' × ' || (e.raw_score - m.old_idx * 10000)::int || ' rep'
    || CASE WHEN (e.raw_score - m.old_idx * 10000) = 1 THEN '' ELSE 's' END
FROM tib_map m
WHERE e.event_slug = 'tibialis-curl'
  AND e.difficulty_tier = m.old_tier AND e.raw_score IS NOT NULL
  AND floor(e.raw_score / 10000) = m.old_idx;

-- ─── 7. session_events: names, modes, the domain ─────────────────────────────
-- Results and PRs group by session_events.event_name (CLAUDE.md §9), so a
-- rename is swept here. The slugs do not change.
UPDATE session_events SET event_name = 'Repeat Vault' WHERE event_name = 'Repeat High Jump';
UPDATE session_events SET event_name = 'Chinups' WHERE event_name = 'Chinup Contest';
UPDATE session_events SET event_name = 'Pushups' WHERE event_name = 'Pushup Contest';
UPDATE session_events SET domain_name = 'Endurance' WHERE domain_name = 'Aerobic Endurance';

-- input_mode is the fallback when a name cannot be resolved; keep it true.
UPDATE session_events SET input_mode = 'sport' WHERE event_name IN (SELECT event_name FROM contest);
UPDATE session_events SET input_mode = 'distance' WHERE event_name IN (SELECT event_name FROM throw_map);
UPDATE session_events SET input_mode = 'distance+time' WHERE event_name IN (SELECT event_name FROM effort) OR event_name = 'Animal Crawl';
UPDATE session_events SET input_mode = 'weight+distance+time' WHERE event_name IN (SELECT event_name FROM carry);
UPDATE session_events SET input_mode = 'weight+reps' WHERE event_name = 'Tibialis Curl';

-- ─── 8. event_domains: the roster mirrored into SQL, 126 rows ───────────────
-- Per domain: 1: 14, 2: 12, 3: 12, 4: 12, 5: 12, 6: 12, 7: 15, 8: 13, 9: 12, 10: 12.
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
  ('Repeat Vault', 4, 'repeat-high-jump'),
  ('Speed Chess', 4, 'speed-chess'),
  ('T-Race', 4, 't-race'),
  ('Tag', 4, 'tag'),
  ('Touch Rugby', 4, 'touch-rugby'),
  ('Ab Rollout', 5, 'ab-wheel-rollout'),
  ('Calf Raises', 5, 'calf-raises'),
  ('Chinups', 5, 'chin-up-contest'),
  ('Finger Pushup', 5, 'finger-push-up'),
  ('GHD Situp', 5, 'ghd-situp'),
  ('Hamstring Curl', 5, 'hamstring-curl'),
  ('Leg Ext Hold', 5, 'leg-extension'),
  ('Pushups', 5, 'push-up-contest'),
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

-- ─── 9. Everything else that stores a slug ───────────────────────────────────
-- An alias matching no event does nothing at all (20260920220344), so the two
-- removed events' aliases are repointed or dropped. A bodyweight lunge is a
-- rung of 1 Leg Squat; a shoulder dislocate has no event left. Named alias by
-- alias, as seeded by 20260915214702 and 20260918023038, so
-- __tests__/trainingLoad.test.ts can replay them; the orphan assertion at the
-- end refuses the whole file if any other alias still points at either slug.
UPDATE activity_aliases SET event_slug = '1-leg-squat' WHERE alias IN ('lunge', 'walking lunges');
DELETE FROM activity_aliases WHERE alias IN ('shoulder dislocates', 'dislocates');

UPDATE workouts SET planned_events = array_remove(array_remove(planned_events, 'lunges'), 'shoulder-dislocate')
WHERE planned_events && ARRAY['lunges', 'shoulder-dislocate'];

DELETE FROM grade_exemptions WHERE event_slug IN (SELECT slug FROM removed);

-- ─── 10. Replay event placements for closed sessions ─────────────────────────
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT t.session_id FROM touched_sessions t
    JOIN sessions ss ON ss.id = t.session_id
    -- A voided game must stay unplaced (as in 20260928201510).
    WHERE ss.is_active = false AND ss.voided_at IS NULL
  LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;

-- A full recheck for everyone whose scores moved. The code's
-- GRADING_RULES_VERSION bump fires at deploy, BEFORE this lands.
UPDATE players SET grades_checked_at = NULL
WHERE id IN (SELECT player_id FROM touched_players WHERE player_id IS NOT NULL);

-- ─── Assertions. A rewrite that silently fails must not report success. ─────
DO $$
DECLARE
  v_n int;
  v_res_archived int;
  v_ent_archived int;
  v_cited int;
BEGIN
  IF (SELECT count(*) FROM event_domains) <> 126 THEN
    RAISE EXCEPTION 'difficulty review: event_domains holds % rows, expected 126', (SELECT count(*) FROM event_domains);
  END IF;
  IF EXISTS (SELECT 1 FROM event_domains GROUP BY slug HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'difficulty review: a slug is seeded twice';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES (1,14),(2,12),(3,12),(4,12),(5,12),(6,12),(7,15),(8,13),(9,12),(10,12)) AS want(d, n)
     WHERE n <> (SELECT count(*) FROM event_domains WHERE domain_number = want.d)
  ) THEN
    RAISE EXCEPTION 'difficulty review: per-domain counts are not 14/12/12/12/12/12/15/13/12/12';
  END IF;

  -- Nothing may still store a removed slug or a retired name.
  IF EXISTS (SELECT 1 FROM results r JOIN session_events se ON se.id = r.event_id
              WHERE se.event_name IN (SELECT event_name FROM removed))
     OR EXISTS (SELECT 1 FROM workout_entries WHERE event_slug IN (SELECT slug FROM removed))
     OR EXISTS (SELECT 1 FROM workouts WHERE planned_events && ARRAY['lunges', 'shoulder-dislocate'])
     OR EXISTS (SELECT 1 FROM grade_exemptions WHERE event_slug IN (SELECT slug FROM removed)) THEN
    RAISE EXCEPTION 'difficulty review: a score, plan or exemption still names a removed event';
  END IF;
  IF EXISTS (SELECT 1 FROM session_events
              WHERE event_name IN ('Repeat High Jump', 'Chinup Contest', 'Pushup Contest')
                 OR domain_name = 'Aerobic Endurance') THEN
    RAISE EXCEPTION 'difficulty review: a session_events row still carries a retired name';
  END IF;
  IF EXISTS (SELECT 1 FROM activity_aliases a LEFT JOIN event_domains e ON e.slug = a.event_slug WHERE e.slug IS NULL) THEN
    RAISE EXCEPTION 'difficulty review: an alias points at no event';
  END IF;

  -- No row may still sit on a rung that no longer exists, in either table.
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
  JOIN tier_map tm ON tm.event_name = se.event_name AND tm.old_tier = r.difficulty_tier
  WHERE r.raw_score IS NOT NULL AND (tm.new_tier IS NULL
     OR (tm.old_tier <> tm.new_tier AND NOT EXISTS (
          SELECT 1 FROM tier_map t2 WHERE t2.event_name = tm.event_name AND t2.new_tier = r.difficulty_tier)));
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % results still on a retired rung', v_n; END IF;

  -- Every remaining row on a remapped ladder decodes to its own rung.
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
  JOIN (SELECT DISTINCT event_name, new_tier, new_idx FROM tier_map WHERE new_tier IS NOT NULL) n
    ON n.event_name = se.event_name AND n.new_tier = r.difficulty_tier
  WHERE r.raw_score IS NOT NULL AND floor(r.raw_score / 10000) <> n.new_idx;
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % results decode to the wrong rung', v_n; END IF;
  SELECT count(*) INTO v_n FROM workout_entries e
  JOIN affected a ON a.slug = e.event_slug
  JOIN (SELECT DISTINCT event_name, new_tier, new_idx FROM tier_map WHERE new_tier IS NOT NULL) n
    ON n.event_name = a.event_name AND n.new_tier = e.difficulty_tier
  WHERE e.raw_score IS NOT NULL AND floor(e.raw_score / 10000) <> n.new_idx;
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % workout entries decode to the wrong rung', v_n; END IF;

  -- Every contest row is a bare result.
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
  WHERE se.event_name IN (SELECT event_name FROM contest) AND r.raw_score IS NOT NULL
    AND (r.difficulty_tier IS NOT NULL OR r.raw_score NOT IN (0, 1, 2));
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % contest results are not a bare win/draw/loss', v_n; END IF;
  SELECT count(*) INTO v_n FROM workout_entries e
  WHERE e.event_slug IN (SELECT slug FROM contest) AND e.raw_score IS NOT NULL
    AND (e.difficulty_tier IS NOT NULL OR e.raw_score NOT IN (0, 1, 2));
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % contest entries are not a bare win/draw/loss', v_n; END IF;

  -- No level left on a mode that has none.
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
  WHERE r.raw_score IS NOT NULL AND r.difficulty_tier IS NOT NULL
    AND (se.event_name IN (SELECT event_name FROM throw_map) OR se.event_name IN (SELECT event_name FROM effort)
         OR se.event_name IN (SELECT event_name FROM carry) OR se.event_name = 'Tibialis Curl');
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % results still carry a level on an event with none', v_n; END IF;
  SELECT count(*) INTO v_n FROM workout_entries e
  WHERE e.raw_score IS NOT NULL AND e.difficulty_tier IS NOT NULL
    AND (e.event_slug IN (SELECT slug FROM throw_map) OR e.event_slug IN (SELECT slug FROM effort)
         OR e.event_slug IN (SELECT slug FROM carry) OR e.event_slug = 'tibialis-curl');
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % workout entries still carry a level on an event with none', v_n; END IF;

  -- Animal Crawl rows are on the four crawls, each a 25m time inside its band.
  SELECT count(*) INTO v_n FROM results r JOIN session_events se ON se.id = r.event_id
  WHERE se.event_name = 'Animal Crawl' AND r.raw_score IS NOT NULL
    AND (r.difficulty_tier NOT IN ('Crawl', 'Bear Crawl', 'Lizard Crawl', 'Duck Walk')
         OR r.difficulty_tier IS NULL OR r.raw_score < 0 OR r.raw_score >= 40000);
  IF v_n > 0 THEN RAISE EXCEPTION 'difficulty review: % Animal Crawl results are not on a crawl', v_n; END IF;

  SELECT count(*) INTO v_res_archived FROM public.results_difficulty_archive_20261005012108;
  SELECT count(*) INTO v_ent_archived FROM public.workout_entries_difficulty_archive_20261005012108;
  SELECT count(*) INTO v_cited FROM grade_awards WHERE events && ARRAY['lunges', 'shoulder-dislocate'];
  RAISE NOTICE 'difficulty review: % results and % workout entries archived; % rows pre-imaged; % conferred colours cite a removed event (they stand)',
    v_res_archived, v_ent_archived,
    (SELECT count(*) FROM public.results_difficulty_preimage_20261005012108)
      + (SELECT count(*) FROM public.workout_entries_difficulty_preimage_20261005012108),
    v_cited;
END $$;
