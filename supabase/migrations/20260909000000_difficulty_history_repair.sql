-- Difficulty levels: repair the history (Sept 2026)
--
-- Lands the reviewed ladders from EVENT_DIFFICULTY_REVIEW.md. Three things:
--   1. Repoints rung labels that were renamed rather than removed.
--   2. Repairs rows on events that GAINED a ladder — they carry no level and a
--      raw_score on the abandoned scale.
--   3. Archives then deletes every result whose level no longer exists.
--   4. Re-encodes the survivors onto their new level index.
--   5. Replays compute_event_placements() for the sessions that changed.
--
-- The event_domains reseed ships separately, in
-- 20260908221459_event_domains_animal_crawl.sql, so the roster mirror can land
-- with the code while this repair takes its own review.
--
-- ⚠ DEPLOY THE CODE FIRST, THEN THIS. Reversed, session_events holds levels the
-- deployed bundle does not know and live sessions lose their tier chips
-- mid-game. Code-first only degrades ranking until this lands.
--
-- ⚠ REWRITES DERIVED DATA. It ends with assertions so a partial apply cannot
-- report success.
--
-- ⚠ SCOPE NOTE: rows on events retired BEFORE this review (Reverse Hyper,
-- Walking, Backwards Walk, Duck Walk) are archived and deleted here rather than
-- left as harmless orphans, which is what the house rule has done until now.
-- That is deliberate: Tāne asked for every score that no longer lines up with a
-- level to go, and an orphan on a retired event lines up with nothing.
--
-- Every working table is TEMP … ON COMMIT DROP, so the whole file MUST run in
-- one transaction. BEGIN/COMMIT are explicit below rather than relying on the
-- CLI: applied unwrapped, tier_map would vanish the instant it committed, after
-- event_domains had already been re-seeded.
--
-- Animal Crawl REPLACES Duck Walk and is not a rename: a bear crawl is not a
-- duck walk, so there is deliberately no session_events.event_name sweep and
-- Duck Walk's rows are left to the archive. Same rule that kept OHP off
-- Clean & Press and Toe Squat off Lunges.

BEGIN;

-- Surviving (event, level) pairs with their new 0-based index.
CREATE TEMP TABLE tier_map (
  new_idx int, event_name text, tier_name text, mode text,
  faster_wins boolean, scoring text
) ON COMMIT DROP;
INSERT INTO tier_map VALUES
  (0, 'Pause Dips', 'Assisted · 2 Feet', 'difficulty+reps', false, NULL),
  (1, 'Pause Dips', 'Dip Top Hold', 'difficulty+reps', false, NULL),
  (2, 'Pause Dips', 'Dip Negatives', 'difficulty+reps', false, NULL),
  (3, 'Pause Dips', 'Straight Bar Dips', 'difficulty+reps', false, NULL),
  (4, 'Pause Dips', 'Rings Turned Out Dip', 'difficulty+reps', false, NULL),
  (5, 'Pause Dips', 'Weighted RTO Dip', 'difficulty+reps', false, 'weight'),
  (0, 'Pause Chinup', 'High Ring Row', 'difficulty+reps', false, NULL),
  (1, 'Pause Chinup', 'Low Ring Row', 'difficulty+reps', false, NULL),
  (2, 'Pause Chinup', 'Chinup Negative', 'difficulty+reps', false, NULL),
  (3, 'Pause Chinup', 'Banded Chinup', 'difficulty+reps', false, NULL),
  (4, 'Pause Chinup', 'Chinup', 'difficulty+reps', false, NULL),
  (5, 'Pause Chinup', 'Weighted Chinup', 'difficulty+reps', false, 'weight'),
  (0, '1 Leg Squat', 'Assisted Lunge', 'difficulty+reps', false, NULL),
  (1, '1 Leg Squat', 'Lunge', 'difficulty+reps', false, NULL),
  (2, '1 Leg Squat', 'Bulgarian Split Squat', 'difficulty+reps', false, NULL),
  (3, '1 Leg Squat', 'Shrimp Squat', 'difficulty+reps', false, NULL),
  (4, '1 Leg Squat', 'Pistol Squat', 'difficulty+reps', false, NULL),
  (5, '1 Leg Squat', 'Dragon Squat', 'difficulty+reps', false, NULL),
  (0, 'Human Flag', 'Elevated Side Plank', 'difficulty+time', false, NULL),
  (1, 'Human Flag', 'Side Plank', 'difficulty+time', false, NULL),
  (2, 'Human Flag', '1 Leg Side Plank', 'difficulty+time', false, NULL),
  (3, 'Human Flag', 'Assisted Flag', 'difficulty+time', false, NULL),
  (4, 'Human Flag', 'Tuck Flag', 'difficulty+time', false, NULL),
  (5, 'Human Flag', 'Full Flag', 'difficulty+time', false, NULL),
  (0, 'Windshield Wipers', 'Tuck Floor Wiper', 'difficulty+reps', false, NULL),
  (1, 'Windshield Wipers', 'Floor Wipers', 'difficulty+reps', false, NULL),
  (2, 'Windshield Wipers', 'Hanging Tuck Circles', 'difficulty+reps', false, NULL),
  (3, 'Windshield Wipers', 'Hanging Circles', 'difficulty+reps', false, NULL),
  (4, 'Windshield Wipers', 'Windshield Wipers', 'difficulty+reps', false, NULL),
  (0, 'Planche', 'Pseudo Planche Lean', 'difficulty+time', false, NULL),
  (1, 'Planche', 'Elevated Pseudo Lean', 'difficulty+time', false, NULL),
  (2, 'Planche', 'Banded Tuck Planche', 'difficulty+time', false, NULL),
  (3, 'Planche', 'Tuck Planche', 'difficulty+time', false, NULL),
  (4, 'Planche', 'Banded Planche', 'difficulty+time', false, NULL),
  (5, 'Planche', 'Straddle Planche', 'difficulty+time', false, NULL),
  (6, 'Planche', 'Full Planche', 'difficulty+time', false, NULL),
  (0, 'Back Lever', 'Assisted Hang', 'difficulty+time', false, NULL),
  (1, 'Back Lever', 'Hang', 'difficulty+time', false, NULL),
  (2, 'Back Lever', 'Inverted Hang', 'difficulty+time', false, NULL),
  (3, 'Back Lever', 'German Hang', 'difficulty+time', false, NULL),
  (4, 'Back Lever', 'Tuck Back Lever', 'difficulty+time', false, NULL),
  (5, 'Back Lever', 'Banded Back Lever', 'difficulty+time', false, NULL),
  (6, 'Back Lever', 'Back Lever', 'difficulty+time', false, NULL),
  (0, 'Iron Cross', '2 Feet Top Hold', 'difficulty+time', false, NULL),
  (1, 'Iron Cross', 'Straight Bar Top Hold', 'difficulty+time', false, NULL),
  (2, 'Iron Cross', 'Ring Top Hold', 'difficulty+time', false, NULL),
  (3, 'Iron Cross', 'Elbow Supported Cross', 'difficulty+time', false, NULL),
  (4, 'Iron Cross', 'Forearm Supported Iron Cross', 'difficulty+time', false, NULL),
  (5, 'Iron Cross', 'Banded Iron Cross', 'difficulty+time', false, NULL),
  (6, 'Iron Cross', 'Iron Cross', 'difficulty+time', false, NULL),
  (0, 'Front Lever', 'Assisted Hang', 'difficulty+time', false, NULL),
  (1, 'Front Lever', 'Hang', 'difficulty+time', false, NULL),
  (2, 'Front Lever', 'Inverted Hang', 'difficulty+time', false, NULL),
  (3, 'Front Lever', 'Tuck Lever Negative', 'difficulty+time', false, NULL),
  (4, 'Front Lever', 'Tuck Front Lever', 'difficulty+time', false, NULL),
  (5, 'Front Lever', 'Banded Front Lever', 'difficulty+time', false, NULL),
  (6, 'Front Lever', 'Front Lever', 'difficulty+time', false, NULL),
  (0, 'Chin Hang', 'Feet Assisted', 'difficulty+time', false, NULL),
  (1, 'Chin Hang', 'Banded Hang', 'difficulty+time', false, NULL),
  (2, 'Chin Hang', 'Two-Hand Chin Hang', 'difficulty+time', false, NULL),
  (3, 'Chin Hang', 'One-Hand Chin Hang', 'difficulty+time', false, NULL),
  (4, 'Chin Hang', 'Banded Hands-Free', 'difficulty+time', false, NULL),
  (5, 'Chin Hang', 'Chin Hang', 'difficulty+time', false, NULL),
  (0, 'Climbing', 'Leaning Rope Hold', 'difficulty+time', true, NULL),
  (1, 'Climbing', 'Assisted Rope Hang', 'difficulty+time', true, NULL),
  (2, 'Climbing', 'No Feet Rope Hang', 'difficulty+time', true, NULL),
  (3, 'Climbing', 'Feet Assisted Climb', 'difficulty+time', true, NULL),
  (4, 'Climbing', 'No Feet Rope Climb', 'difficulty+time', true, NULL),
  (5, 'Climbing', 'L-Sit Rope Climb', 'difficulty+time', true, NULL),
  (6, 'Climbing', 'Assisted Pegboard', 'difficulty+time', true, NULL),
  (7, 'Climbing', 'Pegboard Climb', 'difficulty+time', true, NULL),
  (0, 'Handstand', 'Pushup Hold', 'difficulty+time', false, NULL),
  (1, 'Handstand', 'Elevated Pushup Hold', 'difficulty+time', false, NULL),
  (2, 'Handstand', 'Wall Handstand', 'difficulty+time', false, NULL),
  (3, 'Handstand', 'Freestanding', 'difficulty+time', false, NULL),
  (4, 'Handstand', '1 Arm Handstand', 'difficulty+time', false, NULL),
  (0, 'Headstand', 'Wall Head Plank', 'difficulty+time', false, NULL),
  (1, 'Headstand', 'Feet-Supported Tripod', 'difficulty+time', false, NULL),
  (2, 'Headstand', 'Tripod Headstand', 'difficulty+time', false, NULL),
  (3, 'Headstand', 'Forearm Headstand', 'difficulty+time', false, NULL),
  (4, 'Headstand', 'Wall Assisted', 'difficulty+time', false, NULL),
  (5, 'Headstand', 'Freestanding', 'difficulty+time', false, NULL),
  (0, 'L-Sit Hold', '2 Feet Assisted Tuck', 'difficulty+time', false, NULL),
  (1, 'L-Sit Hold', '1 Foot Assisted Tuck', 'difficulty+time', false, NULL),
  (2, 'L-Sit Hold', 'Tuck Hold', 'difficulty+time', false, NULL),
  (3, 'L-Sit Hold', '1 Leg L-Sit', 'difficulty+time', false, NULL),
  (4, 'L-Sit Hold', 'L-Sit', 'difficulty+time', false, NULL),
  (5, 'L-Sit Hold', 'V-Sit', 'difficulty+time', false, NULL),
  (0, 'Chinup Contest', 'High Ring Row', 'difficulty+reps', false, NULL),
  (1, 'Chinup Contest', 'Low Ring Row', 'difficulty+reps', false, NULL),
  (2, 'Chinup Contest', 'Elevated Ring Row', 'difficulty+reps', false, NULL),
  (3, 'Chinup Contest', 'Banded Chinup', 'difficulty+reps', false, NULL),
  (4, 'Chinup Contest', 'Chin Up', 'difficulty+reps', false, NULL),
  (5, 'Chinup Contest', 'Muscle Up', 'difficulty+reps', false, NULL),
  (0, 'Pushup Contest', 'Elevated Knee Push Up', 'difficulty+reps', false, NULL),
  (1, 'Pushup Contest', 'Knee Push Up', 'difficulty+reps', false, NULL),
  (2, 'Pushup Contest', 'Push Up', 'difficulty+reps', false, NULL),
  (3, 'Pushup Contest', '1 Arm Pushup', 'difficulty+reps', false, NULL),
  (4, 'Pushup Contest', 'Handstand Pushup', 'difficulty+reps', false, NULL),
  (5, 'Pushup Contest', 'Deficit Handstand', 'difficulty+reps', false, NULL),
  (0, 'Finger Pushup', 'Elevated Knee', 'difficulty+reps', false, NULL),
  (1, 'Finger Pushup', 'Knee Finger Pushup', 'difficulty+reps', false, NULL),
  (2, 'Finger Pushup', 'Finger Pushup', 'difficulty+reps', false, NULL),
  (3, 'Finger Pushup', '4 Finger Pushup', 'difficulty+reps', false, NULL),
  (4, 'Finger Pushup', '3 Finger Pushup', 'difficulty+reps', false, NULL),
  (5, 'Finger Pushup', '2 Finger Pushup', 'difficulty+reps', false, NULL),
  (6, 'Finger Pushup', 'Thumb Pushup', 'difficulty+reps', false, NULL),
  (0, 'GHD Situp', 'Dead Bug', 'difficulty+reps', false, NULL),
  (1, 'GHD Situp', 'Crunch', 'difficulty+reps', false, NULL),
  (2, 'GHD Situp', 'Sit Up', 'difficulty+reps', false, NULL),
  (3, 'GHD Situp', 'GHD Situp', 'difficulty+reps', false, NULL),
  (4, 'GHD Situp', 'Weighted GHD Situp', 'difficulty+reps', false, 'weight'),
  (0, 'Ab Rollout', 'Elevated Hold', 'difficulty+reps', false, NULL),
  (1, 'Ab Rollout', 'Kneeling Rollout', 'difficulty+reps', false, NULL),
  (2, 'Ab Rollout', 'Elevated Kneeling', 'difficulty+reps', false, NULL),
  (3, 'Ab Rollout', 'Banded Rollout', 'difficulty+reps', false, NULL),
  (4, 'Ab Rollout', 'Full Rollout', 'difficulty+reps', false, NULL),
  (0, 'Hamstring Curl', 'Glute Thrust', 'difficulty+reps', false, NULL),
  (1, 'Hamstring Curl', 'Ball Glute Thrust', 'difficulty+reps', false, NULL),
  (2, 'Hamstring Curl', 'Floor Slider Curl', 'difficulty+reps', false, NULL),
  (3, 'Hamstring Curl', 'Banded Nordic Curl', 'difficulty+reps', false, NULL),
  (4, 'Hamstring Curl', 'Nordic Curl', 'difficulty+reps', false, NULL),
  (0, 'Sandbag to Shoulder', '5kg', 'difficulty+reps', false, NULL),
  (1, 'Sandbag to Shoulder', '10kg', 'difficulty+reps', false, NULL),
  (2, 'Sandbag to Shoulder', '25kg', 'difficulty+reps', false, NULL),
  (3, 'Sandbag to Shoulder', '50kg', 'difficulty+reps', false, NULL),
  (4, 'Sandbag to Shoulder', '80kg', 'difficulty+reps', false, NULL),
  (5, 'Sandbag to Shoulder', '100kg', 'difficulty+reps', false, NULL),
  (0, 'Lunges', 'Assisted Elevated', 'difficulty+reps', false, NULL),
  (1, 'Lunges', 'Elevated Lunge', 'difficulty+reps', false, NULL),
  (2, 'Lunges', 'Lunge', 'difficulty+reps', false, NULL),
  (3, 'Lunges', 'Jumping Switch Lunges', 'difficulty+reps', false, NULL),
  (4, 'Lunges', 'Jumping Bulgarian', 'difficulty+reps', false, NULL),
  (0, 'Rear Hand Clasp', 'Towel-Assisted', 'difficulty+time', false, NULL),
  (1, 'Rear Hand Clasp', 'Block Assisted', 'difficulty+time', false, NULL),
  (2, 'Rear Hand Clasp', 'Half Block Assisted', 'difficulty+time', false, NULL),
  (3, 'Rear Hand Clasp', 'Finger Tips Touch', 'difficulty+time', false, NULL),
  (4, 'Rear Hand Clasp', 'Finger Clasp', 'difficulty+time', false, NULL),
  (5, 'Rear Hand Clasp', 'Palm Clasp', 'difficulty+time', false, NULL),
  (6, 'Rear Hand Clasp', 'Butterfly Clasp', 'difficulty+time', false, NULL),
  (0, 'Bridge', 'Glute Bridge', 'difficulty+time', false, NULL),
  (1, 'Bridge', 'Wall Assisted Bridge', 'difficulty+time', false, NULL),
  (2, 'Bridge', 'Headstand Bridge', 'difficulty+time', false, NULL),
  (3, 'Bridge', 'Bridge', 'difficulty+time', false, NULL),
  (4, 'Bridge', 'Straight Arm Bridge', 'difficulty+time', false, NULL),
  (5, 'Bridge', 'Rainbow Bridge', 'difficulty+time', false, NULL),
  (0, 'Forward Fold', 'Elevated Seated', 'difficulty+time', false, NULL),
  (1, 'Forward Fold', 'Standing Fold', 'difficulty+time', false, NULL),
  (2, 'Forward Fold', 'Standing · Bent Knees', 'difficulty+time', false, NULL),
  (3, 'Forward Fold', 'Standing · Straight', 'difficulty+time', false, NULL),
  (4, 'Forward Fold', 'Fingertips to Floor', 'difficulty+time', false, NULL),
  (5, 'Forward Fold', 'Palms to Floor', 'difficulty+time', false, NULL),
  (6, 'Forward Fold', 'Elbows to Toes', 'difficulty+time', false, NULL),
  (7, 'Forward Fold', 'Head to Legs', 'difficulty+time', false, NULL),
  (0, 'Needle Pose', 'Seated Quad Stretch', 'difficulty+time', false, NULL),
  (1, 'Needle Pose', 'Standing Quad Stretch', 'difficulty+time', false, NULL),
  (2, 'Needle Pose', '2 Hands to Back Foot', 'difficulty+time', false, NULL),
  (3, 'Needle Pose', '1 Foot, 1 Knee', 'difficulty+time', false, NULL),
  (4, 'Needle Pose', '2 Knee', 'difficulty+time', false, NULL),
  (5, 'Needle Pose', 'Full Needle Pose', 'difficulty+time', false, NULL),
  (0, 'Forward Split', '2 Blocks', 'difficulty+time', false, NULL),
  (1, 'Forward Split', '1.5 Blocks', 'difficulty+time', false, NULL),
  (2, 'Forward Split', '1 Block', 'difficulty+time', false, NULL),
  (3, 'Forward Split', '0.5 Blocks', 'difficulty+time', false, NULL),
  (4, 'Forward Split', 'Front Split', 'difficulty+time', false, NULL),
  (5, 'Forward Split', 'Over Split', 'difficulty+time', false, NULL),
  (0, 'Middle Split', '2 Blocks', 'difficulty+time', false, NULL),
  (1, 'Middle Split', '1.5 Blocks', 'difficulty+time', false, NULL),
  (2, 'Middle Split', '1.25 Blocks', 'difficulty+time', false, NULL),
  (3, 'Middle Split', '1 Block', 'difficulty+time', false, NULL),
  (4, 'Middle Split', '0.75 Blocks', 'difficulty+time', false, NULL),
  (5, 'Middle Split', '0.5 Blocks', 'difficulty+time', false, NULL),
  (6, 'Middle Split', 'Middle Split', 'difficulty+time', false, NULL),
  (0, 'Standing Split', 'Ankle Height', 'difficulty+time', false, NULL),
  (1, 'Standing Split', 'Knee Height', 'difficulty+time', false, NULL),
  (2, 'Standing Split', 'Hip Height', 'difficulty+time', false, NULL),
  (3, 'Standing Split', 'Rib Height', 'difficulty+time', false, NULL),
  (4, 'Standing Split', 'Shoulder Height', 'difficulty+time', false, NULL),
  (5, 'Standing Split', 'Head Height', 'difficulty+time', false, NULL),
  (6, 'Standing Split', 'Standing Split', 'difficulty+time', false, NULL),
  (0, 'Foot Behind Head Pose', 'Assisted Pidgeon Pose', 'difficulty+time', false, NULL),
  (1, 'Foot Behind Head Pose', '90/90 Pose', 'difficulty+time', false, NULL),
  (2, 'Foot Behind Head Pose', 'Pidgeon Pose', 'difficulty+time', false, NULL),
  (3, 'Foot Behind Head Pose', 'Elevated Pidgeon Pose', 'difficulty+time', false, NULL),
  (4, 'Foot Behind Head Pose', 'Foot to Head Pose', 'difficulty+time', false, NULL),
  (5, 'Foot Behind Head Pose', 'Foot Behind Head Pose', 'difficulty+time', false, NULL),
  (6, 'Foot Behind Head Pose', 'Both Feet Behind Head', 'difficulty+time', false, NULL),
  (0, 'Pancake', 'Over 2 Blocks', 'difficulty+time', false, NULL),
  (1, 'Pancake', '2 Blocks', 'difficulty+time', false, NULL),
  (2, 'Pancake', '1.5 Blocks', 'difficulty+time', false, NULL),
  (3, 'Pancake', '1 Block', 'difficulty+time', false, NULL),
  (4, 'Pancake', '0.5 Blocks', 'difficulty+time', false, NULL),
  (5, 'Pancake', 'Elbows to Floor', 'difficulty+time', false, NULL),
  (6, 'Pancake', 'Head to Floor', 'difficulty+time', false, NULL),
  (0, 'Side Bend', 'Standing Bend', 'difficulty+time', false, NULL),
  (1, 'Side Bend', 'Gate Pose', 'difficulty+time', false, NULL),
  (2, 'Side Bend', 'Seated Bend', 'difficulty+time', false, NULL),
  (3, 'Side Bend', 'Side-Split Lateral', 'difficulty+time', false, NULL),
  (0, 'Full Bound Twist', 'Seated Twist', 'difficulty+time', false, NULL),
  (1, 'Full Bound Twist', 'Half Lord', 'difficulty+time', false, NULL),
  (2, 'Full Bound Twist', 'Bound Twist', 'difficulty+time', false, NULL),
  (3, 'Full Bound Twist', 'Full Bound Twist', 'difficulty+time', false, NULL),
  (0, 'Javelin', 'Stick', 'difficulty+distance', false, NULL),
  (1, 'Javelin', 'Short Javelin', 'difficulty+distance', false, NULL),
  (2, 'Javelin', 'Long Javelin', 'difficulty+distance', false, NULL),
  (0, 'Shotput', 'Tennis Ball', 'difficulty+distance', false, NULL),
  (1, 'Shotput', 'Half Weight', 'difficulty+distance', false, NULL),
  (2, 'Shotput', 'Full Weight', 'difficulty+distance', false, NULL),
  (0, 'Australian Football', 'Drop Kick', 'difficulty+reps', false, NULL),
  (1, 'Australian Football', 'Drop Kick (5m)', 'difficulty+reps', false, NULL),
  (2, 'Australian Football', 'Drop Kick (10m)', 'difficulty+reps', false, NULL),
  (3, 'Australian Football', 'Drop Kick (20m)', 'difficulty+reps', false, NULL),
  (4, 'Australian Football', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Burpee Broad Jump', '25m', 'difficulty+time', true, NULL),
  (1, 'Burpee Broad Jump', '50m', 'difficulty+time', true, NULL),
  (2, 'Burpee Broad Jump', '100m', 'difficulty+time', true, NULL),
  (3, 'Burpee Broad Jump', '200m', 'difficulty+time', true, NULL),
  (0, 'Running', '250m', 'difficulty+time', true, NULL),
  (1, 'Running', '500m', 'difficulty+time', true, NULL),
  (2, 'Running', '1000m', 'difficulty+time', true, NULL),
  (0, 'Cycling', '250m', 'difficulty+time', true, NULL),
  (1, 'Cycling', '500m', 'difficulty+time', true, NULL),
  (2, 'Cycling', '1000m', 'difficulty+time', true, NULL),
  (0, 'Ski Erg', '250m', 'difficulty+time', true, NULL),
  (1, 'Ski Erg', '500m', 'difficulty+time', true, NULL),
  (2, 'Ski Erg', '1000m', 'difficulty+time', true, NULL),
  (0, 'Row Erg', '250m', 'difficulty+time', true, NULL),
  (1, 'Row Erg', '500m', 'difficulty+time', true, NULL),
  (2, 'Row Erg', '1000m', 'difficulty+time', true, NULL),
  (0, 'Weighted Carry', '5kg — 200m', 'difficulty+time', true, NULL),
  (1, 'Weighted Carry', '10kg — 200m', 'difficulty+time', true, NULL),
  (2, 'Weighted Carry', '25kg — 200m', 'difficulty+time', true, NULL),
  (3, 'Weighted Carry', '50kg — 200m', 'difficulty+time', true, NULL),
  (4, 'Weighted Carry', '80kg — 200m', 'difficulty+time', true, NULL),
  (5, 'Weighted Carry', '100kg — 200m', 'difficulty+time', true, NULL),
  (0, 'Animal Crawl', '25m Crawl', 'difficulty+time', true, NULL),
  (1, 'Animal Crawl', '25m Bear Crawl', 'difficulty+time', true, NULL),
  (2, 'Animal Crawl', '25m Lizard Crawl', 'difficulty+time', true, NULL),
  (3, 'Animal Crawl', '25m Duck Walk', 'difficulty+time', true, NULL),
  (4, 'Animal Crawl', '100m Duck Walk', 'difficulty+time', true, NULL),
  (0, 'Bronco', '1 Lap', 'difficulty+time', true, NULL),
  (1, 'Bronco', '2 Laps', 'difficulty+time', true, NULL),
  (2, 'Bronco', '3 Laps', 'difficulty+time', true, NULL),
  (3, 'Bronco', '4 Laps', 'difficulty+time', true, NULL),
  (4, 'Bronco', '5 Laps', 'difficulty+time', true, NULL),
  (0, 'Scooting', '250m', 'difficulty+time', true, NULL),
  (1, 'Scooting', '500m', 'difficulty+time', true, NULL),
  (2, 'Scooting', '1000m', 'difficulty+time', true, NULL),
  (0, 'Wheelbarrow Push', '5kg — 200m', 'difficulty+time', true, NULL),
  (1, 'Wheelbarrow Push', '10kg — 200m', 'difficulty+time', true, NULL),
  (2, 'Wheelbarrow Push', '25kg — 200m', 'difficulty+time', true, NULL),
  (3, 'Wheelbarrow Push', '50kg — 200m', 'difficulty+time', true, NULL),
  (4, 'Wheelbarrow Push', '80kg — 200m', 'difficulty+time', true, NULL),
  (5, 'Wheelbarrow Push', '100kg — 200m', 'difficulty+time', true, NULL),
  (6, 'Wheelbarrow Push', '200kg — 200m', 'difficulty+time', true, NULL),
  (0, 'Wheelbarrow Pull', '5kg — 200m', 'difficulty+time', true, NULL),
  (1, 'Wheelbarrow Pull', '10kg — 200m', 'difficulty+time', true, NULL),
  (2, 'Wheelbarrow Pull', '25kg — 200m', 'difficulty+time', true, NULL),
  (3, 'Wheelbarrow Pull', '50kg — 200m', 'difficulty+time', true, NULL),
  (4, 'Wheelbarrow Pull', '80kg — 200m', 'difficulty+time', true, NULL),
  (5, 'Wheelbarrow Pull', '100kg — 200m', 'difficulty+time', true, NULL),
  (6, 'Wheelbarrow Pull', '200kg — 200m', 'difficulty+time', true, NULL),
  (0, '100m Sprint', 'Walking', 'difficulty+time', true, NULL),
  (1, '100m Sprint', 'Timed', 'difficulty+time', true, NULL),
  (2, '100m Sprint', 'Game', 'difficulty+time', true, 'sport'),
  (0, 'T-Race', 'Walking', 'difficulty+time', true, NULL),
  (1, 'T-Race', 'Timed', 'difficulty+time', true, NULL),
  (2, 'T-Race', 'Game', 'difficulty+time', true, 'sport'),
  (0, '200m Sprint', 'Walking', 'difficulty+time', true, NULL),
  (1, '200m Sprint', 'Timed', 'difficulty+time', true, NULL),
  (2, '200m Sprint', 'Game', 'difficulty+time', true, 'sport'),
  (0, 'Touch Rugby', 'Ball Passes', 'difficulty+reps', false, NULL),
  (1, 'Touch Rugby', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (2, 'Touch Rugby', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (3, 'Touch Rugby', 'Moving Pass (5m)', 'difficulty+reps', false, NULL),
  (4, 'Touch Rugby', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Repeat High Jump', 'Ankle height', 'difficulty+time', true, NULL),
  (1, 'Repeat High Jump', 'Knee height', 'difficulty+time', true, NULL),
  (2, 'Repeat High Jump', 'Hip height', 'difficulty+time', true, NULL),
  (3, 'Repeat High Jump', 'Belly Button Height', 'difficulty+time', true, NULL),
  (4, 'Repeat High Jump', 'Rib Height', 'difficulty+time', true, NULL),
  (5, 'Repeat High Jump', 'Shoulder height', 'difficulty+time', true, NULL),
  (0, 'American Football', 'Ball Passes', 'difficulty+reps', false, NULL),
  (1, 'American Football', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (2, 'American Football', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (3, 'American Football', 'Moving Pass (5m)', 'difficulty+reps', false, NULL),
  (4, 'American Football', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Breakdancing', 'Indian Step', 'difficulty+time', false, NULL),
  (1, 'Breakdancing', 'Salsa Step', 'difficulty+time', false, NULL),
  (2, 'Breakdancing', '6 Step', 'difficulty+time', false, NULL),
  (3, 'Breakdancing', '3 Step', 'difficulty+time', false, NULL),
  (4, 'Breakdancing', 'Baby Freeze', 'difficulty+time', false, NULL),
  (5, 'Breakdancing', 'Pilot Freeze', 'difficulty+time', false, NULL),
  (6, 'Breakdancing', 'Windmill', 'difficulty+time', false, NULL),
  (7, 'Breakdancing', 'Game', 'difficulty+time', false, 'sport'),
  (0, 'Trampolining', 'Basic Bounce', 'difficulty+reps', false, NULL),
  (1, 'Trampolining', '180 Spin', 'difficulty+reps', false, NULL),
  (2, 'Trampolining', '360 Spin', 'difficulty+reps', false, NULL),
  (3, 'Trampolining', 'Forward Flip', 'difficulty+reps', false, NULL),
  (4, 'Trampolining', 'Back Flip', 'difficulty+reps', false, NULL),
  (5, 'Trampolining', 'Front Flip 180', 'difficulty+reps', false, NULL),
  (6, 'Trampolining', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Jump Rope', 'Basic Two-Foot Jump', 'difficulty+reps', false, NULL),
  (1, 'Jump Rope', 'Alternating Feet', 'difficulty+reps', false, NULL),
  (2, 'Jump Rope', 'Criss-Cross', 'difficulty+reps', false, NULL),
  (3, 'Jump Rope', 'Double Under', 'difficulty+reps', false, NULL),
  (4, 'Jump Rope', 'Single Dutch', 'difficulty+reps', false, NULL),
  (5, 'Jump Rope', 'Double Dutch', 'difficulty+reps', false, NULL),
  (6, 'Jump Rope', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Gymnastics', 'Forward Roll', 'difficulty+reps', false, NULL),
  (1, 'Gymnastics', 'Backward Roll', 'difficulty+reps', false, NULL),
  (2, 'Gymnastics', 'Cartwheel', 'difficulty+reps', false, NULL),
  (3, 'Gymnastics', 'Roundoff', 'difficulty+reps', false, NULL),
  (4, 'Gymnastics', 'Handspring', 'difficulty+reps', false, NULL),
  (5, 'Gymnastics', 'One-Hand Cartwheel', 'difficulty+reps', false, NULL),
  (6, 'Gymnastics', 'Front Handspring', 'difficulty+reps', false, NULL),
  (7, 'Gymnastics', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Balance Ball', 'Seated', 'difficulty+time', false, NULL),
  (1, 'Balance Ball', 'Kneeling', 'difficulty+time', false, NULL),
  (2, 'Balance Ball', 'Kneeling · No Hands', 'difficulty+time', false, NULL),
  (3, 'Balance Ball', '1 Leg · No Hands', 'difficulty+time', false, NULL),
  (4, 'Balance Ball', 'Standing', 'difficulty+time', false, NULL),
  (5, 'Balance Ball', 'Game', 'difficulty+time', false, 'sport'),
  (0, 'SKATE', '180 Pivot', 'difficulty+reps', false, NULL),
  (1, 'SKATE', '360 Pivot', 'difficulty+reps', false, NULL),
  (2, 'SKATE', 'Ollie', 'difficulty+reps', false, NULL),
  (3, 'SKATE', 'Pop Shove It', 'difficulty+reps', false, NULL),
  (4, 'SKATE', 'Kickflip', 'difficulty+reps', false, NULL),
  (5, 'SKATE', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Juggling', '2 Ball (both hands)', 'difficulty+time', false, NULL),
  (1, 'Juggling', '2 Ball (one hand)', 'difficulty+time', false, NULL),
  (2, 'Juggling', '3 Ball', 'difficulty+time', false, NULL),
  (3, 'Juggling', 'Game', 'difficulty+time', false, 'sport'),
  (0, 'Foot Juggling', '2 Bounce', 'difficulty+reps', false, NULL),
  (1, 'Foot Juggling', '1 Bounce', 'difficulty+reps', false, NULL),
  (2, 'Foot Juggling', '0 Bounce', 'difficulty+reps', false, NULL),
  (3, 'Foot Juggling', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Slackline', 'Single Leg Balance', 'difficulty+time', false, NULL),
  (1, 'Slackline', 'Plank Walk', 'difficulty+time', false, NULL),
  (2, 'Slackline', 'Beam Walk', 'difficulty+time', false, NULL),
  (3, 'Slackline', 'Slackline Walk', 'difficulty+time', false, NULL),
  (4, 'Slackline', 'Slackline Bounce', 'difficulty+time', false, NULL),
  (5, 'Slackline', 'Game', 'difficulty+time', false, 'sport'),
  (0, 'Volleyball', 'Sets', 'difficulty+reps', false, NULL),
  (1, 'Volleyball', 'Digs', 'difficulty+reps', false, NULL),
  (2, 'Volleyball', 'Partner Digs (2m)', 'difficulty+reps', false, NULL),
  (3, 'Volleyball', 'Partner Digs (5m)', 'difficulty+reps', false, NULL),
  (4, 'Volleyball', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Baseball', 'Pitch Ball', 'difficulty+reps', false, NULL),
  (1, 'Baseball', 'Bat Ball', 'difficulty+reps', false, NULL),
  (2, 'Baseball', 'Pitch & Bat (2m)', 'difficulty+reps', false, NULL),
  (3, 'Baseball', 'Pitch & Bat (5m)', 'difficulty+reps', false, NULL),
  (4, 'Baseball', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Teqball', 'Juggles · 2 Bounce', 'difficulty+reps', false, NULL),
  (1, 'Teqball', 'Partner Pass', 'difficulty+reps', false, NULL),
  (2, 'Teqball', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (3, 'Teqball', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Tennis', 'Vertical Juggles', 'difficulty+reps', false, NULL),
  (1, 'Tennis', 'Partner Hits (2m)', 'difficulty+reps', false, NULL),
  (2, 'Tennis', 'Partner Hits (5m)', 'difficulty+reps', false, NULL),
  (3, 'Tennis', 'Partner Hits (10m)', 'difficulty+reps', false, NULL),
  (4, 'Tennis', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Cricket', 'Bowl Ball', 'difficulty+reps', false, NULL),
  (1, 'Cricket', 'Bat Ball', 'difficulty+reps', false, NULL),
  (2, 'Cricket', 'Bowl & Bat (2m)', 'difficulty+reps', false, NULL),
  (3, 'Cricket', 'Bowl & Bat (5m)', 'difficulty+reps', false, NULL),
  (4, 'Cricket', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Badminton', 'Vertical Juggles', 'difficulty+reps', false, NULL),
  (1, 'Badminton', 'Partner Hits (2m)', 'difficulty+reps', false, NULL),
  (2, 'Badminton', 'Partner Hits (5m)', 'difficulty+reps', false, NULL),
  (3, 'Badminton', 'Partner Hits (10m)', 'difficulty+reps', false, NULL),
  (4, 'Badminton', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Basketball', 'Bounce Ball', 'difficulty+reps', false, NULL),
  (1, 'Basketball', '2 Ball Bounce', 'difficulty+reps', false, NULL),
  (2, 'Basketball', '2 Ball Side to Side', 'difficulty+reps', false, NULL),
  (3, 'Basketball', '2 Ball Back & Forth', 'difficulty+reps', false, NULL),
  (4, 'Basketball', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Football', 'Partner Pass', 'difficulty+reps', false, NULL),
  (1, 'Football', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (2, 'Football', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (3, 'Football', 'Partner Pass (10m)', 'difficulty+reps', false, NULL),
  (4, 'Football', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Hockey', 'Partner Pass', 'difficulty+reps', false, NULL),
  (1, 'Hockey', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (2, 'Hockey', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (3, 'Hockey', 'Partner Pass (10m)', 'difficulty+reps', false, NULL),
  (4, 'Hockey', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Squash', 'Partner Pass', 'difficulty+reps', false, NULL),
  (1, 'Squash', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (2, 'Squash', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (3, 'Squash', 'Partner Pass (10m)', 'difficulty+reps', false, NULL),
  (4, 'Squash', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Lacrosse', 'Partner Pass', 'difficulty+reps', false, NULL),
  (1, 'Lacrosse', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (2, 'Lacrosse', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (3, 'Lacrosse', 'Partner Pass (10m)', 'difficulty+reps', false, NULL),
  (4, 'Lacrosse', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Ultimate Frisbee', 'Partner Pass', 'difficulty+reps', false, NULL),
  (1, 'Ultimate Frisbee', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (2, 'Ultimate Frisbee', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (3, 'Ultimate Frisbee', 'Partner Pass (10m)', 'difficulty+reps', false, NULL),
  (4, 'Ultimate Frisbee', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Netball', 'Chest Pass', 'difficulty+reps', false, NULL),
  (1, 'Netball', 'Shot Under Hoop', 'difficulty+reps', false, NULL),
  (2, 'Netball', 'Shot (2m)', 'difficulty+reps', false, NULL),
  (3, 'Netball', 'Shot (5m)', 'difficulty+reps', false, NULL),
  (4, 'Netball', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Bocce', 'Bowl Ball', 'difficulty+reps', false, NULL),
  (1, 'Bocce', 'Within 5m of Jack', 'difficulty+reps', false, NULL),
  (2, 'Bocce', 'Within 1m of Jack', 'difficulty+reps', false, NULL),
  (3, 'Bocce', 'Hit the Jack', 'difficulty+reps', false, NULL),
  (4, 'Bocce', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Dodgeball', 'Throw Ball', 'difficulty+reps', false, NULL),
  (1, 'Dodgeball', 'Throw & Catch (1m)', 'difficulty+reps', false, NULL),
  (2, 'Dodgeball', 'Throw & Catch (5m)', 'difficulty+reps', false, NULL),
  (3, 'Dodgeball', 'Throw & Catch (10m)', 'difficulty+reps', false, NULL),
  (4, 'Dodgeball', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Carrom', 'Strike a Piece', 'difficulty+reps', false, NULL),
  (1, 'Carrom', 'Pocket a Piece', 'difficulty+reps', false, NULL),
  (2, 'Carrom', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Archery', 'Hit the Target (5m)', 'difficulty+reps', false, NULL),
  (1, 'Archery', 'Hit the Target (10m)', 'difficulty+reps', false, NULL),
  (2, 'Archery', 'Hit the Gold (10m)', 'difficulty+reps', false, NULL),
  (3, 'Archery', 'Hit the Gold (20m)', 'difficulty+reps', false, NULL),
  (4, 'Archery', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Bowling', 'Partner Bowl', 'difficulty+reps', false, NULL),
  (1, 'Bowling', 'Partner Bowl (5m)', 'difficulty+reps', false, NULL),
  (2, 'Bowling', 'Partner Bowl (10m)', 'difficulty+reps', false, NULL),
  (3, 'Bowling', 'Partner Bowl (20m)', 'difficulty+reps', false, NULL),
  (4, 'Bowling', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Darts', 'Hit the Board', 'difficulty+reps', false, NULL),
  (1, 'Darts', 'Named Number', 'difficulty+reps', false, NULL),
  (2, 'Darts', 'Named Double', 'difficulty+reps', false, NULL),
  (3, 'Darts', 'Bullseye', 'difficulty+reps', false, NULL),
  (4, 'Darts', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Disc Golf', 'Putt (2m)', 'difficulty+reps', false, NULL),
  (1, 'Disc Golf', 'Putt (5m)', 'difficulty+reps', false, NULL),
  (2, 'Disc Golf', 'Approach (20m)', 'difficulty+reps', false, NULL),
  (3, 'Disc Golf', 'Game (4 Holes)', 'difficulty+reps', false, 'sport'),
  (0, 'Golf', 'Putt (2m)', 'difficulty+reps', false, NULL),
  (1, 'Golf', 'Putt (5m)', 'difficulty+reps', false, NULL),
  (2, 'Golf', 'Chip (10m)', 'difficulty+reps', false, NULL),
  (3, 'Golf', 'Game (4 Holes)', 'difficulty+reps', false, 'sport'),
  (0, 'Handball', 'Partner Pass (2m)', 'difficulty+reps', false, NULL),
  (1, 'Handball', 'Partner Pass (5m)', 'difficulty+reps', false, NULL),
  (2, 'Handball', 'Past a Keeper', 'difficulty+reps', false, NULL),
  (3, 'Handball', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Table Tennis', 'Vertical Juggles', 'difficulty+reps', false, NULL),
  (1, 'Table Tennis', 'Wall Juggles', 'difficulty+reps', false, NULL),
  (2, 'Table Tennis', 'Partner Hits', 'difficulty+reps', false, NULL),
  (3, 'Table Tennis', 'Game', 'difficulty+reps', false, 'sport'),
  (0, 'Kubb', 'Throw Baton', 'difficulty+reps', false, NULL),
  (1, 'Kubb', 'Hit Kubb (2m)', 'difficulty+reps', false, NULL),
  (2, 'Kubb', 'Hit Kubb (5m)', 'difficulty+reps', false, NULL),
  (3, 'Kubb', 'Hit Kubb (10m)', 'difficulty+reps', false, NULL),
  (4, 'Kubb', 'Game', 'difficulty+reps', false, 'sport');

-- Pre-image FIRST, before anything below rewrites a row. Captured here and
-- not later: the repair passes overwrite raw_score and difficulty_tier in
-- place, so a snapshot taken after them is not a pre-image at all. Covers
-- every row any later statement can touch — those already carrying a level,
-- and those on an event that is gaining one.
CREATE TABLE public.results_difficulty_preimage_20260908 AS
SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, r.result_type,
       r.time_seconds, r.distance_m, se.event_name, now() AS captured_at
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE EXISTS (SELECT 1 FROM tier_map m WHERE m.event_name = se.event_name)
   OR r.difficulty_tier IS NOT NULL;
ALTER TABLE public.results_difficulty_preimage_20260908 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_difficulty_preimage_20260908 FROM anon, authenticated;

-- Rung renames: same movement, new label. Applied BEFORE anything keys on
-- difficulty_tier, so a renamed rung's history survives instead of being
-- archived as an orphan.
CREATE TEMP TABLE rung_rename (event_name text, old_name text, new_name text) ON COMMIT DROP;
INSERT INTO rung_rename VALUES
  ('Ab Rollout', 'Kneeling Ab Rollout', 'Kneeling Rollout'),
  ('Ab Rollout', 'Elevated Kneeling Ab Rollout', 'Elevated Kneeling'),
  ('Balance Ball', '1 Leg Standing (no hands)', '1 Leg · No Hands'),
  ('Balance Ball', 'Kneeling (no hands)', 'Kneeling · No Hands'),
  ('Chin Hang', 'Two-Hand Hang', 'Two-Hand Chin Hang'),
  ('Chin Hang', 'Assisted Chin Hang (1 Foot)', 'Feet Assisted'),
  ('Climbing', 'Assisted Rope Climb', 'Feet Assisted Climb'),
  ('Forward Fold', 'Standing Forward Fold (knees bent)', 'Standing · Bent Knees'),
  ('Forward Fold', 'Standing Forward Fold (finger-tips to floor)', 'Fingertips to Floor'),
  ('Forward Split', 'Assisted Front Split (1 Block)', '1 Block'),
  ('Forward Split', 'Assisted Front Split (1.5 Blocks)', '1.5 Blocks'),
  ('Forward Split', 'Front Split (1.5 Blocks)', '1.5 Blocks'),
  ('Headstand', 'Wall Headstand (No hands, wall support)', 'Wall Assisted'),
  ('Headstand', 'Wall Headstand', 'Wall Assisted'),
  ('Headstand', 'Freestanding Headstand', 'Freestanding'),
  ('Iron Cross', 'Ring Top Position Hold', 'Ring Top Hold'),
  ('L-Sit Hold', 'Tuck Hold (both knees to chest)', 'Tuck Hold'),
  ('L-Sit Hold', 'Full L Sit', 'L-Sit'),
  ('L-Sit Hold', 'Full L-Sit (legs fully horizontal, Knees locked)', 'L-Sit'),
  ('Middle Split', 'Assisted Middle Split (1.5 Blocks)', '1.5 Blocks'),
  ('Middle Split', 'Assisted Middle Split (2 Blocks)', '2 Blocks'),
  ('Pancake', 'Elevated Pancake (More than 2 blocks)', 'Over 2 Blocks'),
  ('Pancake', 'Elevated Pancake (1.5 blocks)', '1.5 Blocks'),
  ('Pancake', 'Elevated Pancake (2 blocks)', '2 Blocks'),
  ('Planche', 'Elevated Pseudo Planche Lean', 'Elevated Pseudo Lean'),
  ('Rear Hand Clasp', 'Towel-Assisted (hands hold opposite ends of towel)', 'Towel-Assisted'),
  ('Standing Split', 'Standing Split (Hip height, knee locked)', 'Hip Height'),
  ('Standing Split', 'Standing Leg Lift (Hip height)', 'Hip Height'),
  ('Standing Split', 'Lift · Hip Height', 'Hip Height'),
  ('Standing Split', 'Hip · Knee Locked', 'Hip Height'),
  ('Standing Split', 'Above Hip · Assisted', 'Rib Height');
UPDATE results r SET difficulty_tier = m.new_name
FROM session_events se, rung_rename m
WHERE se.id = r.event_id AND se.event_name = m.event_name
  AND r.difficulty_tier = m.old_name;

-- Events that gained a ladder. Their rows carry difficulty_tier NULL and a
-- raw_score on the abandoned scale, so they are invisible to anything keyed
-- on difficulty_tier. Each lands on a named rung with its real value kept.
-- new_idx leads for the same reason tier_map's does: see the note there.
CREATE TEMP TABLE gained (new_idx int, event_name text, rung text, old_mode text) ON COMMIT DROP;
INSERT INTO gained VALUES
  (2, 'Javelin', 'Long Javelin', 'distance'),
  (2, 'Shotput', 'Full Weight', 'distance'),
  (4, 'Australian Football', 'Game', 'sport'),
  (1, '100m Sprint', 'Timed', 'sprint'),
  (2, 'T-Race', 'Game', 'sport'),
  (1, '200m Sprint', 'Timed', 'sprint'),
  (4, 'Touch Rugby', 'Game', 'sport'),
  (4, 'American Football', 'Game', 'sport'),
  (3, 'Slackline', 'Slackline Walk', 'hold'),
  (4, 'Volleyball', 'Game', 'sport'),
  (4, 'Baseball', 'Game', 'sport'),
  (3, 'Teqball', 'Game', 'sport'),
  (4, 'Tennis', 'Game', 'sport'),
  (4, 'Cricket', 'Game', 'sport'),
  (4, 'Badminton', 'Game', 'sport'),
  (4, 'Basketball', 'Game', 'sport'),
  (4, 'Football', 'Game', 'sport'),
  (4, 'Hockey', 'Game', 'sport'),
  (4, 'Squash', 'Game', 'sport'),
  (4, 'Lacrosse', 'Game', 'sport'),
  (4, 'Ultimate Frisbee', 'Game', 'sport'),
  (4, 'Netball', 'Game', 'sport'),
  (4, 'Bocce', 'Game', 'sport'),
  (4, 'Dodgeball', 'Game', 'sport'),
  (2, 'Carrom', 'Game', 'sport'),
  (4, 'Archery', 'Game', 'sport'),
  (4, 'Bowling', 'Game', 'sport'),
  (4, 'Darts', 'Game', 'sport'),
  (3, 'Disc Golf', 'Game (4 Holes)', 'score'),
  (3, 'Golf', 'Game (4 Holes)', 'score'),
  (3, 'Handball', 'Game', 'sport'),
  (3, 'Table Tennis', 'Game', 'sport'),
  (4, 'Kubb', 'Game', 'sport');

-- Every row repaired here is recorded so the doomed sweep and the re-encode
-- below cannot touch it a second time: it already carries a final score.
CREATE TEMP TABLE gained_ids (id uuid PRIMARY KEY) ON COMMIT DROP;

-- was `sport`: Australian Football, T-Race, Touch Rugby, American Football, Volleyball, Baseball, Teqball, Tennis, Cricket, Badminton, Basketball, Football, Hockey, Squash, Lacrosse, Ultimate Frisbee, Netball, Bocce, Dodgeball, Carrom, Archery, Bowling, Darts, Handball, Table Tennis, Kubb
WITH upd AS (
  UPDATE results r SET
    difficulty_tier = g.rung,
    raw_score = g.new_idx * 10000 + (GREATEST(LEAST(r.raw_score, 2), 0)),
    result_type = COALESCE(r.result_type, CASE r.raw_score WHEN 2 THEN 'win' WHEN 1 THEN 'draw' ELSE 'loss' END)
  FROM session_events se, gained g
  WHERE se.id = r.event_id AND se.event_name = g.event_name
    AND g.old_mode = 'sport' AND r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL AND r.raw_score BETWEEN 0 AND 2
  RETURNING r.id
)
INSERT INTO gained_ids SELECT id FROM upd ON CONFLICT DO NOTHING;

-- was `score`: Disc Golf, Golf
WITH upd AS (
  UPDATE results r SET
    difficulty_tier = g.rung,
    raw_score = g.new_idx * 10000 + (g2.term),
    match_score = COALESCE(r.match_score, ABS(r.raw_score)::text || ' strokes'),
    result_type = COALESCE(r.result_type, CASE g2.term WHEN 2 THEN 'win' WHEN 1 THEN 'draw' ELSE 'loss' END)
  FROM session_events se, gained g, (
    SELECT rr.id,
      CASE WHEN COUNT(*) OVER (PARTITION BY rr.event_id) = 1 THEN 0
           WHEN RANK() OVER (PARTITION BY rr.event_id ORDER BY ABS(rr.raw_score)) > 1 THEN 0
           WHEN COUNT(*) OVER (PARTITION BY rr.event_id, ABS(rr.raw_score)) > 1 THEN 1
           ELSE 2 END AS term
    FROM results rr JOIN session_events sse ON sse.id = rr.event_id
    JOIN gained gg ON gg.event_name = sse.event_name AND gg.old_mode = 'score'
    WHERE rr.difficulty_tier IS NULL AND rr.raw_score IS NOT NULL
  ) g2
  WHERE se.id = r.event_id AND se.event_name = g.event_name AND g2.id = r.id
    AND g.old_mode = 'score' AND r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL 
  RETURNING r.id
)
INSERT INTO gained_ids SELECT id FROM upd ON CONFLICT DO NOTHING;

-- was `sprint`: 100m Sprint, 200m Sprint
WITH upd AS (
  UPDATE results r SET
    difficulty_tier = g.rung,
    raw_score = g.new_idx * 10000 + (10000 - GREATEST(LEAST(ABS(r.raw_score) / 100.0, 9999), 0.01)),
    time_seconds = COALESCE(r.time_seconds, ABS(r.raw_score) / 100.0)
  FROM session_events se, gained g
  WHERE se.id = r.event_id AND se.event_name = g.event_name
    AND g.old_mode = 'sprint' AND r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL 
  RETURNING r.id
)
INSERT INTO gained_ids SELECT id FROM upd ON CONFLICT DO NOTHING;

-- was `distance`: Javelin, Shotput
WITH upd AS (
  UPDATE results r SET
    difficulty_tier = g.rung,
    raw_score = g.new_idx * 10000 + (LEAST(ROUND(ABS(r.raw_score) / 10.0), 9999)),
    distance_m = COALESCE(r.distance_m, ABS(r.raw_score) / 100.0)
  FROM session_events se, gained g
  WHERE se.id = r.event_id AND se.event_name = g.event_name
    AND g.old_mode = 'distance' AND r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL 
  RETURNING r.id
)
INSERT INTO gained_ids SELECT id FROM upd ON CONFLICT DO NOTHING;

-- was `hold`: Slackline
WITH upd AS (
  UPDATE results r SET
    difficulty_tier = g.rung,
    raw_score = g.new_idx * 10000 + (GREATEST(LEAST(ROUND(ABS(r.raw_score)), 9999), 1)),
    time_seconds = COALESCE(r.time_seconds, ABS(r.raw_score))
  FROM session_events se, gained g
  WHERE se.id = r.event_id AND se.event_name = g.event_name
    AND g.old_mode = 'hold' AND r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL 
  RETURNING r.id
)
INSERT INTO gained_ids SELECT id FROM upd ON CONFLICT DO NOTHING;

-- ── Sessions whose derived data will need recomputing ────────────────────────
-- Captured BEFORE anything is deleted: once a row is gone its session_id is too.
CREATE TEMP TABLE touched_sessions (session_id uuid PRIMARY KEY) ON COMMIT DROP;
-- Same discriminator as 20260828204652: closed, points actually awarded, and
-- carrying a summary or awarded points. A voided session has neither and must
-- stay unplaced.
INSERT INTO touched_sessions
SELECT DISTINCT r.session_id
FROM results r
JOIN sessions s ON s.id = r.session_id
WHERE r.session_id IS NOT NULL
  AND s.is_active = false
  AND s.points_awarded_at IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM session_player_summary sp WHERE sp.session_id = s.id)
    OR EXISTS (SELECT 1 FROM results r2 WHERE r2.session_id = s.id AND COALESCE(r2.points_earned, 0) > 0)
  )
ON CONFLICT DO NOTHING;

-- ── Rows that cannot survive the rebuild ─────────────────────────────────────
-- ONE definition, so the archive and the delete cannot disagree. A row is
-- doomed if its level name is gone from the ladder (AFTER renames are applied),
-- or it has no source value to rebuild its score from. Rows already repaired by
-- the gained-ladder pass carry a final score and are excluded outright.
CREATE TEMP TABLE doomed ON COMMIT DROP AS
SELECT r.id
FROM results r
JOIN session_events se ON se.id = r.event_id
LEFT JOIN tier_map m
  ON m.event_name = se.event_name AND m.tier_name = r.difficulty_tier
WHERE r.difficulty_tier IS NOT NULL
  AND r.id NOT IN (SELECT id FROM gained_ids)
  AND (
    m.tier_name IS NULL
    OR NOT (
      (m.scoring = 'weight'           AND COALESCE(r.weight_kg, 0) > 0) OR
      (m.scoring = 'sport'            AND r.raw_score IS NOT NULL) OR
      (m.scoring IS NULL AND m.mode = 'difficulty+time'     AND ROUND(COALESCE(r.time_seconds, 0)) > 0) OR
      (m.scoring IS NULL AND m.mode = 'difficulty+reps'     AND COALESCE(r.reps, 0) > 0) OR
      (m.scoring IS NULL AND m.mode = 'difficulty+distance' AND COALESCE(r.distance_m, 0) > 0)
    )
  );

-- CREATE TABLE … AS SELECT does NOT inherit RLS, and anything in public is
-- reachable through PostgREST, so RLS is enabled explicitly with no policies:
-- denies all API access while service_role keeps BYPASSRLS for a restore.
-- Deliberately NOT `IF NOT EXISTS`: a pre-existing table means a prior partial
-- apply, and silently skipping the archive while still running the DELETE would
-- destroy rows with no pre-image.
CREATE TABLE public.results_difficulty_archive_20260908 AS
SELECT r.*, se.event_name AS archived_event_name, now() AS archived_at
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE r.id IN (SELECT id FROM doomed);

ALTER TABLE public.results_difficulty_archive_20260908 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_difficulty_archive_20260908 FROM anon, authenticated;

DELETE FROM results WHERE id IN (SELECT id FROM doomed);

-- ── Re-encode the survivors onto their new index ─────────────────────────────
-- Rebuilt from the SOURCE columns (time_seconds, reps, weight_kg, distance_m),
-- never from the old raw_score's remainder. That repairs the June 2026 re-encode
-- at the same time: 20260629000000 used numeric division where it needed floor,
-- so `(raw/10000)*10000` evaluated back to `raw` and every row it touched was
-- pushed a level up with its seconds zeroed. Those remainders are worthless; the
-- source columns are intact.
UPDATE results r
SET score_label = CASE
      WHEN r.score_label ~ '^D[0-9]+ '
        THEN regexp_replace(r.score_label, '^D[0-9]+ [^·]*', 'D' || (m.new_idx + 1) || ' ' || m.tier_name || ' ')
      ELSE r.score_label
    END,
    raw_score = CASE
      WHEN m.scoring = 'weight'
        THEN m.new_idx * 10000 + LEAST(ROUND(COALESCE(r.weight_kg, 0) * 100), 9999)
      WHEN m.mode = 'difficulty+distance'
        THEN m.new_idx * 10000 + LEAST(ROUND(r.distance_m * 10), 9999)
      WHEN m.mode = 'difficulty+time' AND m.faster_wins
        THEN m.new_idx * 10000 + (10000 - GREATEST(LEAST(ROUND(r.time_seconds), 9999), 1))
      WHEN m.mode = 'difficulty+time'
        THEN m.new_idx * 10000 + GREATEST(LEAST(ROUND(r.time_seconds), 9999), 1)
      ELSE m.new_idx * 10000 + LEAST(COALESCE(r.reps, 0), 9999)
    END
FROM session_events se, tier_map m
WHERE se.id = r.event_id
  AND m.event_name = se.event_name
  AND m.tier_name  = r.difficulty_tier
  AND r.difficulty_tier IS NOT NULL
  AND r.id NOT IN (SELECT id FROM gained_ids)
  -- A `sport` rung's score is the result itself and was written by the
  -- gained-ladder pass; nothing else may rewrite it.
  AND m.scoring IS DISTINCT FROM 'sport';

-- ── Recompute the derived data those scores feed ─────────────────────────────
-- results.event_placement / event_field_size are written only by
-- compute_event_placements(), which fires on the sessions is_active true->false
-- transition. Deleting and re-encoding rows without replaying it would leave
-- every affected session ranked on scores that no longer exist, and
-- player_event_wins counts crowns off those placements. Same replay
-- 20260828204652 does after it rewrites results.
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT session_id FROM touched_sessions LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;

-- ── Assertions. A rewrite that silently fails must not report success. ───────
DO $$
DECLARE
  v_orphans   int;
  v_events    int;
  v_domains   int;
  v_mismatch  int;
  v_archived  int;
  v_untiered  int;
BEGIN
  SELECT count(*) INTO v_orphans
  FROM results r
  JOIN session_events se ON se.id = r.event_id
  WHERE r.difficulty_tier IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM tier_map m
                    WHERE m.event_name = se.event_name AND m.tier_name = r.difficulty_tier);
  IF v_orphans > 0 THEN
    RAISE EXCEPTION 'difficulty rebuild: % rows still carry a level that no longer exists', v_orphans;
  END IF;

  -- The class this migration was rewritten to catch: a row on a TIERED event
  -- that still has no level, and so decodes to whatever its old scale meant.
  SELECT count(*) INTO v_untiered
  FROM results r
  JOIN session_events se ON se.id = r.event_id
  JOIN event_domains ed ON ed.event_name = se.event_name
  WHERE r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL
    AND EXISTS (SELECT 1 FROM tier_map m WHERE m.event_name = se.event_name);
  IF v_untiered > 0 THEN
    RAISE EXCEPTION 'difficulty rebuild: % rows on tiered events still carry no level', v_untiered;
  END IF;

  SELECT count(*) INTO v_archived FROM public.results_difficulty_archive_20260908;
  RAISE NOTICE 'difficulty rebuild: archived % rows', v_archived;

  SELECT count(*) INTO v_events FROM event_domains;
  IF v_events <> 120 THEN
    RAISE EXCEPTION 'difficulty rebuild: event_domains holds % rows, expected 120', v_events;
  END IF;

  SELECT count(*) INTO v_domains FROM (
    SELECT domain_number FROM event_domains
    GROUP BY domain_number HAVING count(*) <> 12
  ) x;
  IF v_domains > 0 THEN
    RAISE EXCEPTION 'difficulty rebuild: % domains do not hold exactly 12 events', v_domains;
  END IF;

  -- Every surviving tiered row must decode to its own level.
  SELECT count(*) INTO v_mismatch
  FROM results r
  JOIN session_events se ON se.id = r.event_id
  JOIN tier_map m ON m.event_name = se.event_name AND m.tier_name = r.difficulty_tier
  WHERE r.difficulty_tier IS NOT NULL
    AND r.raw_score IS NOT NULL
    AND floor(r.raw_score / 10000) <> m.new_idx;
  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'difficulty rebuild: % rows decode to the wrong level', v_mismatch;
  END IF;
END $$;

COMMIT;
