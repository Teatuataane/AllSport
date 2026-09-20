-- ════════════════════════════════════════════════════════════════════════════
-- 20260918023038 — Training load: how long and how hard, and more aliases
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT
--   1. workouts.duration_minutes — how long the whole workout took.
--   2. workouts.effort_rating — how hard it felt, 1 to 10 (session RPE, the
--      Foster CR-10 scale). Minutes × rating is session training load, a
--      measure that works for ANY activity, fitted to an event or not.
--      Weekly active minutes is also the number funders report against
--      (Sport NZ, Tū Manawa), which is why minutes live on the WORKOUT: the
--      per-entry duration_seconds only exists for distance and unfitted rows.
--   3. A much longer starting alias list, so the words people actually type
--      ("squats", "ping pong", "soccer") fit first time. Every slug is checked
--      against event_domains by the closing block, the same rule the first
--      seed follows.
--
-- Both columns are optional: a workout logged before this, or without them,
-- still counts toward units and standards exactly as before. Neither is
-- pinned by the trigger — they are the player's own description of their
-- session, and a witnessed workout is already closed to everyone but a
-- kaiwhakawā by guard_workouts_write().
--
-- DEPLOY ORDER: either is safe. The client reads the new columns in their own
-- query and treats 42703 (column missing) as "not live yet".

-- ── 1. How long, how hard ───────────────────────────────────────────────────
ALTER TABLE public.workouts
  ADD COLUMN IF NOT EXISTS duration_minutes int
    CONSTRAINT workouts_duration_minutes_range CHECK (duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440),
  ADD COLUMN IF NOT EXISTS effort_rating smallint
    CONSTRAINT workouts_effort_rating_range CHECK (effort_rating IS NULL OR effort_rating BETWEEN 1 AND 10);

-- ── 2. Aliases ──────────────────────────────────────────────────────────────
-- Only words that genuinely train the event they point at. Deliberately NOT
-- aliased: overhead press (it is not Clean & Press, the OHP rule), calf raise
-- (not Toe Lift), burpees (not Burpee Broad Jump), sit ups (not GHD Situp),
-- "tramp" (a hike in Aotearoa, not a trampoline), and anything that belongs to
-- a domain the roster does not have yet: swimming, surfing, bouldering,
-- martial arts beyond Tae Kwon Do, yoga, walking. Those stay unfitted until
-- the log-only domains exist.
INSERT INTO public.activity_aliases (alias, event_slug) VALUES
  -- Maximal Strength
  ('dl', 'deadlift'), ('conventional deadlift', 'deadlift'), ('sumo deadlift', 'deadlift'),
  ('trap bar deadlift', 'deadlift'), ('hex bar deadlift', 'deadlift'),
  ('clean and press', 'clean-and-press'),
  ('squat', 'pause-squat'), ('squats', 'pause-squat'), ('back squat', 'pause-squat'), ('back squats', 'pause-squat'),
  ('front squat', 'pause-front-squat'), ('front squats', 'pause-front-squat'),
  ('bench', 'pause-bench'), ('bench press', 'pause-bench'),
  ('barbell row', 'pause-row'), ('barbell rows', 'pause-row'), ('bent over row', 'pause-row'), ('pendlay row', 'pause-row'),
  ('dips', 'pause-dips'), ('dip', 'pause-dips'), ('weighted dips', 'pause-dips'),
  ('weighted chin ups', 'pause-chin-up'), ('weighted pull ups', 'pause-chin-up'),
  ('zercher', 'zercher-deadlift'), ('zercher deadlift', 'zercher-deadlift'),
  ('turkish get up', 'turkish-get-up'), ('turkish get ups', 'turkish-get-up'), ('tgu', 'turkish-get-up'), ('get ups', 'turkish-get-up'),
  ('one arm press', 'one-arm-press'), ('single arm press', 'one-arm-press'), ('1 arm press', 'one-arm-press'),
  -- Calisthenics
  ('pistol squat', '1-leg-squat'), ('pistol squats', '1-leg-squat'), ('pistols', '1-leg-squat'), ('single leg squat', '1-leg-squat'),
  ('handstands', 'hand-walk'), ('handstand practice', 'hand-walk'),
  ('l sit', 'l-sit-hold'), ('l-sit', 'l-sit-hold'), ('lsit', 'l-sit-hold'),
  ('rope climb', 'rope-climb'), ('rope climbing', 'rope-climb'),
  ('headstands', 'headstand'),
  -- Power
  ('clean and jerk', 'clean-and-jerk'), ('c&j', 'clean-and-jerk'),
  ('kettlebell snatch', 'one-arm-snatch'), ('kb snatch', 'one-arm-snatch'), ('dumbbell snatch', 'one-arm-snatch'), ('db snatch', 'one-arm-snatch'),
  ('broad jump', 'standing-broad-jump'), ('broad jumps', 'standing-broad-jump'), ('standing long jump', 'standing-broad-jump'),
  ('shot put', 'shot-put'),
  ('afl', 'australian-football'), ('aussie rules', 'australian-football'),
  ('arm wrestle', 'arm-wrestling'),
  -- Speed
  ('sprint', '100m-sprint'), ('sprints', '100m-sprint'), ('sprinting', '100m-sprint'), ('100m', '100m-sprint'),
  ('200m', '200m-sprint'),
  ('touch', 'touch-rugby'), ('touch footy', 'touch-rugby'), ('touch football', 'touch-rugby'),
  ('gridiron', 'american-football'), ('nfl', 'american-football'), ('flag football', 'american-football'),
  -- Anaerobic Endurance
  ('chin-ups', 'chin-up-contest'), ('pull-ups', 'chin-up-contest'), ('chin up', 'chin-up-contest'), ('pull up', 'chin-up-contest'),
  ('push-ups', 'push-up-contest'), ('push up', 'push-up-contest'), ('press-ups', 'push-up-contest'),
  ('ghd sit ups', 'ghd-situp'), ('ghd situps', 'ghd-situp'),
  ('ab wheel', 'ab-wheel-rollout'), ('ab rollouts', 'ab-wheel-rollout'), ('rollouts', 'ab-wheel-rollout'),
  ('hamstring curls', 'hamstring-curl'), ('ham curls', 'hamstring-curl'), ('leg curls', 'hamstring-curl'),
  ('leg extension', 'leg-extension'), ('leg extensions', 'leg-extension'),
  ('tib curls', 'tibialis-curl'), ('tib raises', 'tibialis-curl'), ('tibialis raises', 'tibialis-curl'),
  ('finger push ups', 'finger-push-up'), ('fingertip push ups', 'finger-push-up'),
  ('sandbag over shoulder', 'sandbag-to-shoulder'), ('sandbag over bar', 'sandbag-to-shoulder'),
  -- Aerobic Endurance
  ('5k', 'running'), ('10k', 'running'), ('half marathon', 'running'), ('marathon', 'running'), ('run club', 'running'),
  ('rowing machine', 'row-erg'), ('indoor row', 'row-erg'), ('indoor rowing', 'row-erg'),
  ('ski-erg', 'ski-erg'),
  ('stationary bike', 'cycling'), ('exercise bike', 'cycling'), ('peloton', 'cycling'), ('zwift', 'cycling'), ('commute', 'cycling'),
  ('bear crawl', 'animal-crawl'), ('bear crawls', 'animal-crawl'), ('crawling', 'animal-crawl'), ('duck walk', 'animal-crawl'),
  ('farmers walk', 'weighted-carry'), ('farmers carry', 'weighted-carry'), ('farmer carry', 'weighted-carry'), ('sandbag carry', 'weighted-carry'),
  ('breath holds', 'breath-hold'), ('static apnea', 'breath-hold'),
  -- Flexibility
  ('splits', 'front-split'), ('front splits', 'front-split'), ('front split', 'front-split'),
  ('middle splits', 'middle-split'), ('side splits', 'middle-split'), ('straddle split', 'middle-split'),
  ('bridges', 'bridge'), ('backbend', 'bridge'), ('wheel pose', 'bridge'),
  ('toe touch', 'forward-fold'), ('pike stretch', 'forward-fold'),
  ('pancake stretch', 'pancake'),
  ('shoulder dislocates', 'shoulder-dislocate'), ('dislocates', 'shoulder-dislocate'),
  -- Body Awareness
  ('taekwondo', 'tae-kwon-do'), ('tkd', 'tae-kwon-do'),
  ('breakdance', 'breakdancing'), ('breaking', 'breakdancing'), ('bboying', 'breakdancing'),
  ('trampoline', 'trampolining'),
  ('jumprope', 'jump-rope'), ('double unders', 'jump-rope'),
  ('skateboarding', 'skate'), ('skateboard', 'skate'),
  ('juggle', 'juggling'),
  ('keepy uppies', 'foot-juggling'), ('keepie uppies', 'foot-juggling'), ('kick ups', 'foot-juggling'),
  ('slacklining', 'slackline'),
  -- Coordination
  ('soccer', 'football'), ('futsal', 'football'),
  ('hoops', 'basketball'), ('bball', 'basketball'),
  ('ultimate', 'ultimate-frisbee'), ('frisbee', 'ultimate-frisbee'),
  ('field hockey', 'hockey'),
  ('beach volleyball', 'volleyball'),
  -- Aim & Precision
  ('ping pong', 'table-tennis'),
  ('ten pin', 'bowling'), ('tenpin', 'bowling'), ('ten pin bowling', 'bowling'),
  ('frisbee golf', 'disc-golf'), ('frolf', 'disc-golf'),
  ('petanque', 'bocce'),
  ('dodge ball', 'dodgeball')
ON CONFLICT (alias) DO NOTHING;

-- ── 3. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
BEGIN
  IF (SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workouts'
        AND column_name IN ('duration_minutes', 'effort_rating')) <> 2 THEN
    RAISE EXCEPTION 'training load: a workouts column is missing';
  END IF;
  IF (SELECT count(*) FROM pg_constraint
      WHERE conname IN ('workouts_duration_minutes_range', 'workouts_effort_rating_range')) <> 2 THEN
    RAISE EXCEPTION 'training load: a range CHECK is missing';
  END IF;
  IF EXISTS (SELECT 1 FROM activity_aliases a WHERE NOT EXISTS (SELECT 1 FROM event_domains d WHERE d.slug = a.event_slug)) THEN
    RAISE EXCEPTION 'training load: an alias points at an event that is not on the roster';
  END IF;
  IF (SELECT count(*) FROM activity_aliases) < 150 THEN
    RAISE EXCEPTION 'training load: the alias seed did not land';
  END IF;
END $$;
