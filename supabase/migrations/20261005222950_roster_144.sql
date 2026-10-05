-- The 6 October 2026 roster: 144 events (Tāne)
--
-- Tāne's event list of 6 Oct 2026, compared against the app and settled the
-- same day. The code half is lib/eventData.ts and the two review sheets.
--
--   ADDED (16):
--     Maximal Strength  Steinborn (a lift: estimated 1RM), Glute Thrust (load,
--                       then longest hold, like Leg Ext Hold)
--     Stamina           Reverse Wrist Ext (load, then reps, like Tibialis Curl)
--     Power             Clap Pushups (levels + reps), Triple Jump (distance),
--                       Mas Wrestling (win/draw/loss)
--     Speed             400m Sprint, 800m Sprint (win/draw/loss, time kept)
--     Endurance         Obstacle Course (win/draw/loss, time kept), Swim (open
--                       distance + time over 100m), Walking (over 1000m)
--     Body Awareness    Diving, Poi (levels topped by a Game rung)
--     Coordination      Water Polo (passing ladder + Game)
--     Aim & Precision   Cornhole, Airsoft (levels + Game)
--
--   MOVED (2), slugs unchanged, so their results move with them:
--     Wrestling            Body Awareness -> Power
--     Australian Football  Power -> Speed
--   The grading engine reads an event's domain from the CURRENT roster, so
--   Wrestling's results (21 on 6 Oct 2026) now count toward Power. Checked
--   against production that day: no grade_awards row cites wrestling,
--   australian-football, triple-jump or cornhole, so this moves nobody's
--   conferred colour; the assertions below keep it so. Past draws keep the
--   domain they filled in their own game (session_events.domain_number is the
--   game's slot, not the event's home), as Climbing's did when it moved.
--
--   THREE SLUGS COME BACK, each checked against production on 6 Oct 2026:
--     triple-jump  7 results (May to July 2026), distance in cm, the same
--                  encoding as now: they count again with no change.
--     walking      4 draws, NO result and no workout entry. The old Walking was
--                  a timed-effort ladder; the new one is an open distance +
--                  time, and 'walking' leaves TIMED_EFFORT_SLUGS. With no stored
--                  score under the slug, nothing was ever encoded the old way.
--     cornhole     4 results, all plain win/draw/loss (raw 0, 1 or 2, no level)
--                  from 5 May 2026. The new Cornhole is a ladder topped by a
--                  Game rung at index 3, so those rows move onto it: raw 30000 +
--                  result, difficulty_tier 'Game'. Every row moves by the same
--                  amount, so the order inside each game, and its placements,
--                  are unchanged. The pre-image is archived first.
--
--   FUNCTIONS (redefined whole from 20261005012108, one change each):
--     enforce_lift_estimate         Steinborn joins the lifts.
--     guard_workout_entries_write   the four new pure contests join the list of
--     record_entry_match            slugs that are game results with no rung.
--   enforce_relevelled_ladders needs no change: no new event is re-levelled.
--
-- ORDER: AFTER 20261005012108 and 20261005032653, which were NOT yet applied
-- on 6 Oct 2026 (production's newest was 20260930222237). Its timestamp sorts
-- after both, so one `supabase db push` applies the three in order. Never apply
-- this alone: its functions are redefined from 20261005012108's, and its seed
-- assumes that file's renames (Repeat Vault, Chinups, L-Sit).
--
-- DEPLOY THE CODE FIRST, THEN THIS. event_domains is the write gate for
-- workout entries, so until this runs a new event can be drawn at a game but
-- not added on top of one or logged. The old bundle never offers a new event.
-- HARD-REFRESH every kaiwhakawā device afterwards.
--
-- AFTER: the code bumps GRADING_RULES_VERSION, so everyone is rechecked
-- (Wrestling's move and Triple Jump's return change what the same evidence
-- earns). No colour is withdrawn by an ordinary recheck. Then run
-- scripts/refresh-leaderboard-scores.ts --apply.

BEGIN;

-- ─── Cornhole's four old games move onto its Game rung ───────────────────────

CREATE TABLE IF NOT EXISTS results_archive_20261006_cornhole AS
SELECT r.* FROM results r JOIN session_events se ON se.id = r.event_id
 WHERE se.event_slug = 'cornhole';
ALTER TABLE results_archive_20261006_cornhole ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE n int;
BEGIN
  IF EXISTS (
    SELECT 1 FROM results r JOIN session_events se ON se.id = r.event_id
     WHERE se.event_slug = 'cornhole'
       AND NOT (r.difficulty_tier IS NULL AND r.raw_score IN (0, 1, 2))
       AND NOT (r.difficulty_tier = 'Game' AND r.raw_score IN (30000, 30001, 30002))
  ) THEN
    RAISE EXCEPTION 'roster 144: a Cornhole result is neither an old game (0/1/2) nor a Game-rung row';
  END IF;
  UPDATE results r SET raw_score = 30000 + r.raw_score, difficulty_tier = 'Game'
    FROM session_events se
   WHERE se.id = r.event_id AND se.event_slug = 'cornhole'
     AND r.difficulty_tier IS NULL AND r.raw_score IN (0, 1, 2);
  GET DIAGNOSTICS n = ROW_COUNT;
  RAISE NOTICE 'roster 144: % Cornhole result(s) moved onto the Game rung', n;
END $$;

-- ─── Functions ───────────────────────────────────────────────────────────────

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
  IF v_name IN (
      '1A Press', 'Deadlift', 'Clean & Press', 'Pause Back Squat', 'Zercher Dead',
      'Pause Bench', 'Turkish Getup', 'Arthur Lift', 'Pause Row', 'Pause Front Squat',
      'Pullover & Press', 'Loaded Lunge', 'Kelly Snatch', '1A Snatch',
      'Clean & Jerk', 'Snatch', 'Steinborn')
     OR v_slug IN (
      'one-arm-press', 'deadlift', 'clean-and-press', 'pause-squat', 'zercher-deadlift',
      'pause-bench', 'turkish-get-up', 'arthur-lift', 'pause-row', 'pause-front-squat',
      'pullover-and-press', 'loaded-lunge', 'kelly-snatch', 'one-arm-snatch',
      'clean-and-jerk', 'snatch', 'steinborn') THEN
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

  -- CHANGED 20261005222950: Mas Wrestling, 400m Sprint, 800m Sprint and
  -- Obstacle Course (6 Oct 2026 roster) join the list.
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
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('wrestling', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war'))
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
     AND (e.difficulty_tier ILIKE 'Game%' OR e.event_slug IN ('wrestling', '100m-sprint', '200m-sprint', '400m-sprint', '800m-sprint', 'arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war')) THEN
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

-- ─── event_domains: the roster mirrored into SQL, 144 rows ─────────────────────
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
  ('Reverse Wrist Ext', 5, 'reverse-wrist-extension'),
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

DO $$
BEGIN
  IF (SELECT count(*) FROM event_domains) <> 144 THEN
    RAISE EXCEPTION 'roster 144: event_domains holds % rows, expected 144', (SELECT count(*) FROM event_domains);
  END IF;
  IF EXISTS (SELECT 1 FROM event_domains GROUP BY slug HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'roster 144: a slug is seeded twice';
  END IF;
  IF EXISTS (
    SELECT 1 FROM (VALUES (1,16),(2,13),(3,15),(4,15),(5,14),(6,15),(7,15),(8,14),(9,13),(10,14)) AS want(d, n)
     WHERE n <> (SELECT count(*) FROM event_domains WHERE domain_number = want.d)
  ) THEN
    RAISE EXCEPTION 'roster 144: per-domain counts are not 16/13/15/15/14/15/15/14/13/14';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = 'wrestling' AND domain_number = 3)
     OR NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = 'australian-football' AND domain_number = 4) THEN
    RAISE EXCEPTION 'roster 144: Wrestling is not in Power, or Australian Football is not in Speed';
  END IF;
  -- The moves change what a domain colour rests on. None rested on either
  -- event on 6 Oct 2026; if one does by the time this runs, stop and ask Tāne.
  IF EXISTS (SELECT 1 FROM grade_awards WHERE domain_number = 8 AND 'wrestling' = ANY(events))
     OR EXISTS (SELECT 1 FROM grade_awards WHERE domain_number = 3 AND 'australian-football' = ANY(events)) THEN
    RAISE EXCEPTION 'roster 144: a colour cites Wrestling in Body Awareness or Australian Football in Power';
  END IF;
  IF EXISTS (
    SELECT 1 FROM results r JOIN session_events se ON se.id = r.event_id
     WHERE se.event_slug = 'cornhole' AND r.raw_score < 30000
  ) THEN
    RAISE EXCEPTION 'roster 144: a Cornhole result is still in the old win/draw/loss shape';
  END IF;
  IF EXISTS (SELECT 1 FROM activity_aliases a LEFT JOIN event_domains e ON e.slug = a.event_slug WHERE e.slug IS NULL) THEN
    RAISE EXCEPTION 'roster 144: an alias points at no event';
  END IF;
END $$;

COMMIT;
