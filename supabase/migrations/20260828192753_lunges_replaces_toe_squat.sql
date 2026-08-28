-- ─── Lunges replaces Toe Squat ──────────────────────────────────────────────
-- Roster change, August 2026. Toe Squat leaves Anaerobic Endurance and Lunges
-- takes its place, so the domain still holds exactly twelve events.
--
-- LUNGES IS NOT A RENAME. It gets its own slug (`lunges`), and no
-- `session_events.event_name` sweep accompanies this file. A squat on your toes
-- and a lunge are different movements, so repointing Toe Squat's history would
-- credit a PR to a lift nobody performed — the same rule that kept OHP off
-- Clean & Press and Cornhole off Bocce. Historical Toe Squat rows stay as
-- orphan name strings, exactly as the nine events removed in August did.
--
-- Consequence worth stating out loud: Toe Squat wins stop counting toward the
-- Anaerobic Endurance crown, because the crown asks for 9 of the domain's
-- CURRENT twelve and Toe Squat is no longer one of them.
--
-- VERIFIED against production as anon on 2026-08-29, rather than assumed:
--   player_event_wins?event_name=eq.Toe Squat  ->  []
-- Zero Toe Squat wins have ever been recorded, so this demotes nobody and
-- costs no one a crown. (Everyone is also still under 10,000 lifetime points,
-- so no crown room exists yet either.) If that query ever returns rows on a
-- future roster change, the answer is different — check it, do not assume.
--
-- ── Why the whole roster, and not a two-line delta ──────────────────────────
-- `event_domains` is the roster mirrored into SQL, and the server reads it to
-- decide which domain a win belongs to. A delta would leave the current mirror
-- spread across every migration that ever touched it, with no single file
-- answering "what are the 120 events?". So this DELETEs and re-seeds in full and
-- becomes THE definition, the same way 20260816000000 became the single
-- definition of players_public.
--
-- `__tests__/taniwha.test.ts` reads the NEWEST migration carrying this seed and
-- fails if it drifts from lib/eventData.ts. Any future roster change writes
-- another full re-seed rather than editing this one. The rows below were
-- GENERATED from EVENTS, not typed, and diffed against the previous seed to
-- confirm the only change is the Toe Squat/Lunges swap.
--
-- Safe to re-run. Atomic without an explicit BEGIN: the CLI runs each
-- migration inside its own transaction, which is why no other migration in
-- this repo opens one. An explicit COMMIT here would close the CLI's
-- transaction early and put its ledger write outside it.

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
  ('Breath Hold', 6, 'breath-hold'),
  ('Bronco', 6, 'bronco'),
  ('Burpee Broad Jump', 6, 'burpee-broad-jump'),
  ('Cycling', 6, 'cycling'),
  ('Duck Walk', 6, 'duck-walk'),
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
  ('Table Tennis', 10, 'table-tennis')
;

-- Twelve per domain, 120 in total. If this fails the roster is wrong, not the
-- constraint.
DO $$
DECLARE v_total INT; v_bad INT;
BEGIN
  SELECT COUNT(*) INTO v_total FROM event_domains;
  IF v_total <> 120 THEN
    RAISE EXCEPTION 'event_domains holds % rows, expected 120', v_total;
  END IF;

  SELECT COUNT(*) INTO v_bad FROM (
    SELECT domain_number FROM event_domains
     GROUP BY domain_number HAVING COUNT(*) <> 12
  ) q;
  IF v_bad > 0 THEN
    RAISE EXCEPTION '% domain(s) do not hold exactly 12 events', v_bad;
  END IF;
END $$;

-- ── Verify, by querying the objects rather than the ledger ──────────────────
--   select count(*) from event_domains;                          -- expect 120
--   select * from event_domains where event_name = 'Lunges';     -- expect 1 row, domain 5
--   select * from event_domains where event_name = 'Toe Squat';  -- expect 0 rows
--   select domain_number, count(*) from event_domains
--    group by 1 order by 1;                                      -- expect 12 each
