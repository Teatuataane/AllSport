-- Stamina roster (30 Sept 2026)
--
-- Re-seeds event_domains IN FULL, which CLAUDE.md requires of whichever
-- migration changes the roster. This file is now THE definition of the mirror,
-- and __tests__/sqlMirrors.test.ts reads the newest file carrying the seed.
-- The 128 rows are generated from lib/eventData.ts, never typed.
--
-- What changed, from Tāne's list of 30 Sept 2026:
--
--   DOMAIN 5     Anaerobic Endurance -> Stamina. Name only: number, colour and
--                order unchanged. event_domains stores no domain name, so only
--                session_events.domain_name is rewritten, and only on rows
--                that say 'Anaerobic Endurance' with domain_number 5, which is
--                every such row (the name has only ever been used for #5).
--   RENAMED (4)  L-Sit Hold -> Compression, Pushup Contest -> Pushups,
--                Wrist Stretch -> Internal Wrist Stretch, Reverse Wrist
--                Stretch -> External Wrist Stretch. SLUGS UNCHANGED.
--                session_events.event_name is repointed, because /prs,
--                lib/percentile.ts and My Events group history by NAME
--                (CLAUDE.md, August 2026).
--   RE-LEVELLED  Compression, Pushups, Calf Raises and both wrist stretches.
--   REMOVED (3)  Lunges, Ab Rollout (Stamina), Shoulder Dislocate
--                (Flexibility). Their results stay as orphan name strings,
--                the precedent for every removal. Their activity aliases go.
--   ADDED (3)    Back Extension, Hollow Hold (Stamina), Reverse Maltese
--                (Calisthenics). All holds.
--   GUARD        enforce_relevelled_ladders() refuses a write on the five
--                re-levelled events whose level is not on the new ladder, and
--                a new score on a removed event. See below.
--
-- ─── Colours and Season points resting on removed events ────────────────────
--
-- 12 conferred colours cite Ab Rollout or Shoulder Dislocate (checked
-- 2026-10-05; 11 on 2026-10-01). They stand: an ordinary recheck never
-- withdraws, and lib/autoConfer.ts citesRemovedEvent() stops a kaiwhakawā's
-- unrelated score deletion from re-judging them away (Tāne, 1 Oct 2026).
--
-- Season points DO move, accepted (Tāne, 1 Oct 2026): a removed event no
-- longer has standards, so past games that drew Ab Rollout (4 draws, 7 results)
-- or Shoulder Dislocate (5 draws, 3 results) score 0 for it once the board is
-- refreshed, and places in those games can shift by a point.
--
-- Domains: 14/13/12/12/13/12/15/13/12/12, still at least 12 in every one.
--
-- ─── History ─────────────────────────────────────────────────────────────────
--
-- A tiered raw_score is tierIdx * 10000 + the within-level term, so moving a
-- level moves the score. Two levels that were actually scored moved:
--
--   Compression  L-Sit        D5 -> L Sit         D4
--                V-Sit        D6 -> V Sit         D5
--   Pushups      Push Up      D3 -> Pushup        D4
--                1 Arm Pushup D4 -> 1 Arm Pushup  D5
--
-- plus two pure relabels at the same level (Elevated Knee Push Up -> Hands Up Knee Pushup, Knee Push Up -> Knee Pushup) and Tuck Hold, which
-- stays D3 under the same name, and Calf Raises' two two-leg levels (Two-Leg
-- Raise -> Calf Raise, Two-Leg Deficit -> Deficit Calf Raise, same band). Each
-- is the same movement under a new label, so it is repointed, not deleted.
--
-- A row is shifted only when its raw_score still sits in its OLD band. A row a
-- new bundle wrote between the deploy and this migration already carries the
-- new label and band (and '1 Arm Pushup' keeps its name, so the band is the
-- only thing telling old from new). Shifting within a level by a constant
-- keeps every player's order, so no placement changes from the shift alone.
--
-- Anything left on those five events whose level no longer exists (the
-- handstand pushups, the assisted tucks, every old wrist and calf level) is
-- archived then deleted, the Toe Lift precedent. Checked 2026-10-05: production
-- held NONE: Compression held 6 Tuck Hold + 3 L-Sit, Pushups 15 Push Up +
-- 3 Knee Push Up + 3 1 Arm Pushup, Calf Raises 2 Two-Leg Deficit (scored
-- 2 Oct, repointed above), and nobody had scored either wrist stretch. The
-- archive exists so a row written since cannot vanish.
--
-- DEPLOY ORDER: CODE FIRST, THEN THIS MIGRATION STRAIGHT AFTER, WITH NO GAME
-- OR WORKOUT RUNNING. event_domains is the WRITE GATE for workouts (see
-- 20260920220344): in the gap, a logged Back Extension, Hollow Hold or Reverse
-- Maltese is refused with 22023, and confer_grade refuses a colour citing one.
-- A failed save, never bad data. The session_events rename must also follow
-- the code: reversed, an old bundle cannot resolve 'Pushups' or 'Compression'
-- and the live screen loses the event's levels mid-game.
--
-- AFTER applying: hard-refresh every kaiwhakawā device, then run
-- scripts/refresh-leaderboard-scores.ts --apply so the Season board's colour
-- totals are recomputed on the new standards.

BEGIN;

-- ─── session_events: the four renames and the domain name ───────────────────
-- The slug is set as well: one historical 'L-Sit Hold' draw carried a NULL
-- event_slug (10 of 680 rows did, checked 2026-09-30), and every step below
-- finds rows by slug. Setting it here is what makes the level shift, the
-- invariant and the guard see that draw.
UPDATE session_events SET event_name = 'Compression', event_slug = 'l-sit-hold'
 WHERE event_name = 'L-Sit Hold' OR event_slug = 'l-sit-hold';
UPDATE session_events SET event_name = 'Pushups', event_slug = 'push-up-contest'
 WHERE event_name = 'Pushup Contest' OR event_slug = 'push-up-contest';
UPDATE session_events SET event_name = 'Internal Wrist Stretch', event_slug = 'wrist-stretch'
 WHERE event_name = 'Wrist Stretch' OR event_slug = 'wrist-stretch';
UPDATE session_events SET event_name = 'External Wrist Stretch', event_slug = 'reverse-wrist-stretch'
 WHERE event_name = 'Reverse Wrist Stretch' OR event_slug = 'reverse-wrist-stretch';
-- Calf Raises was not renamed, but a draw with a NULL slug would be invisible
-- to the level shift below while the guard still finds it by name. None exists
-- today; this keeps the two in agreement if one ever does.
UPDATE session_events SET event_slug = 'calf-raises'
 WHERE event_name = 'Calf Raises' AND event_slug IS NULL;
UPDATE session_events SET domain_name = 'Stamina'
 WHERE domain_name = 'Anaerobic Endurance' AND domain_number = 5;

-- ─── The level map ───────────────────────────────────────────────────────────
-- 0-based indexes, as raw_score encodes them.
CREATE TEMP TABLE level_map (slug text, event_name text, old_tier text, new_tier text, old_idx int, new_idx int)
  ON COMMIT DROP;
INSERT INTO level_map VALUES
    ('l-sit-hold',      'Compression', 'Tuck Hold',             'Tuck Hold',                  2, 2),
    ('l-sit-hold',      'Compression', 'L-Sit',                 'L Sit',                      4, 3),
    ('l-sit-hold',      'Compression', 'V-Sit',                 'V Sit',                      5, 4),
    ('push-up-contest', 'Pushups',     'Elevated Knee Push Up', 'Hands Up Knee Pushup', 0, 0),
    ('push-up-contest', 'Pushups',     'Knee Push Up',          'Knee Pushup',                1, 1),
    ('push-up-contest', 'Pushups',     'Push Up',               'Pushup',                     2, 3),
    ('push-up-contest', 'Pushups',     '1 Arm Pushup',          '1 Arm Pushup',               3, 4),
    -- Calf Raises' two-leg levels are the same movements under new names. The
    -- single-leg ones have no equivalent (the new top level is on the toe tips),
    -- so any row on them is archived.
    ('calf-raises',     'Calf Raises', 'Two-Leg Raise',         'Calf Raise',                 0, 0),
    ('calf-raises',     'Calf Raises', 'Two-Leg Deficit',       'Deficit Calf Raise',         1, 1);

-- The new ladders, for telling a row that is already right from one that is lost.
CREATE TEMP TABLE new_levels (slug text, event_name text, tier text, idx int) ON COMMIT DROP;
INSERT INTO new_levels VALUES
    ('l-sit-hold', 'Compression', 'Curl Up', 0), ('l-sit-hold', 'Compression', 'V Up', 1),
    ('l-sit-hold', 'Compression', 'Tuck Hold', 2), ('l-sit-hold', 'Compression', 'L Sit', 3),
    ('l-sit-hold', 'Compression', 'V Sit', 4),
    ('push-up-contest', 'Pushups', 'Hands Up Knee Pushup', 0),
    ('push-up-contest', 'Pushups', 'Knee Pushup', 1),
    ('push-up-contest', 'Pushups', 'Elevated Pushup', 2),
    ('push-up-contest', 'Pushups', 'Pushup', 3),
    ('push-up-contest', 'Pushups', '1 Arm Pushup', 4),
    ('calf-raises', 'Calf Raises', 'Calf Raise', 0),
    ('calf-raises', 'Calf Raises', 'Deficit Calf Raise', 1),
    ('calf-raises', 'Calf Raises', 'Toe Calf Raise', 2),
    ('calf-raises', 'Calf Raises', 'Single Leg Toe Raise', 3),
    ('wrist-stretch', 'Internal Wrist Stretch', 'Hand Assisted', 0),
    ('wrist-stretch', 'Internal Wrist Stretch', 'Hand Forward', 1),
    ('wrist-stretch', 'Internal Wrist Stretch', 'Fingers Inwards', 2),
    ('wrist-stretch', 'Internal Wrist Stretch', 'Fingers Backwards', 3),
    ('wrist-stretch', 'Internal Wrist Stretch', 'Backwards Plank', 4),
    ('reverse-wrist-stretch', 'External Wrist Stretch', 'Hand Assisted', 0),
    ('reverse-wrist-stretch', 'External Wrist Stretch', 'Fingers Outwards', 1),
    ('reverse-wrist-stretch', 'External Wrist Stretch', 'Fingers Backwards', 2),
    ('reverse-wrist-stretch', 'External Wrist Stretch', 'Fingers Inwards', 3),
    ('reverse-wrist-stretch', 'External Wrist Stretch', 'Inwards Plank', 4);

-- Every scored row on the five re-levelled events, with its event's slug.
CREATE TEMP TABLE levelled_rows ON COMMIT DROP AS
SELECT 'r'::text AS src, r.id, r.session_id, r.player_id, se.event_slug AS slug, r.difficulty_tier AS tier, r.raw_score
FROM results r JOIN session_events se ON se.id = r.event_id
WHERE se.event_slug IN (SELECT DISTINCT slug FROM new_levels)
UNION ALL
SELECT 'e', e.id, NULL, w.player_id, e.event_slug, e.difficulty_tier, e.raw_score
FROM workout_entries e JOIN workouts w ON w.id = e.workout_id
WHERE e.event_slug IN (SELECT DISTINCT slug FROM new_levels) AND e.raw_score IS NOT NULL;

-- Rows to shift: an old label (or a kept label) still in its OLD band.
CREATE TEMP TABLE shifts ON COMMIT DROP AS
SELECT l.src, l.id, l.session_id, l.player_id, m.new_tier, m.new_idx, (m.new_idx - m.old_idx) * 10000 AS delta
FROM levelled_rows l
JOIN level_map m ON m.slug = l.slug AND m.old_tier = l.tier
WHERE floor(l.raw_score / 10000) = m.old_idx
  AND (m.new_idx <> m.old_idx OR m.new_tier <> m.old_tier);

-- Rows with no level on the new ladder: archived, then deleted.
CREATE TEMP TABLE doomed ON COMMIT DROP AS
SELECT l.* FROM levelled_rows l
WHERE NOT EXISTS (SELECT 1 FROM level_map m WHERE m.slug = l.slug AND m.old_tier = l.tier
                    AND floor(l.raw_score / 10000) = m.old_idx)
  AND NOT EXISTS (SELECT 1 FROM new_levels n WHERE n.slug = l.slug AND n.tier = l.tier
                    AND floor(l.raw_score / 10000) = n.idx);

CREATE TABLE public.results_stamina_roster_preimage_20260930011149 AS
SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, now() AS captured_at
FROM results r WHERE r.id IN (SELECT id FROM shifts WHERE src = 'r');
ALTER TABLE public.results_stamina_roster_preimage_20260930011149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_stamina_roster_preimage_20260930011149 FROM anon, authenticated;

CREATE TABLE public.workout_entries_stamina_roster_preimage_20260930011149 AS
SELECT e.id, e.raw_score, e.difficulty_tier, e.score_label, now() AS captured_at
FROM workout_entries e WHERE e.id IN (SELECT id FROM shifts WHERE src = 'e');
ALTER TABLE public.workout_entries_stamina_roster_preimage_20260930011149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_stamina_roster_preimage_20260930011149 FROM anon, authenticated;

CREATE TABLE public.results_stamina_roster_archive_20260930011149 AS
SELECT r.*, se.event_name AS archived_event_name, now() AS archived_at
FROM results r JOIN session_events se ON se.id = r.event_id
WHERE r.id IN (SELECT id FROM doomed WHERE src = 'r');
ALTER TABLE public.results_stamina_roster_archive_20260930011149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_stamina_roster_archive_20260930011149 FROM anon, authenticated;

CREATE TABLE public.workout_entries_stamina_roster_archive_20260930011149 AS
SELECT e.*, now() AS archived_at
FROM workout_entries e WHERE e.id IN (SELECT id FROM doomed WHERE src = 'e');
ALTER TABLE public.workout_entries_stamina_roster_archive_20260930011149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.workout_entries_stamina_roster_archive_20260930011149 FROM anon, authenticated;

DO $$
DECLARE v_shift int; v_doomed int; v_cited int;
BEGIN
  SELECT count(*) INTO v_shift FROM shifts;
  SELECT count(*) INTO v_doomed FROM doomed;
  SELECT count(*) INTO v_cited FROM grade_awards
   WHERE events && ARRAY['lunges', 'ab-wheel-rollout', 'shoulder-dislocate',
                         'l-sit-hold', 'push-up-contest', 'calf-raises',
                         'wrist-stretch', 'reverse-wrist-stretch'];
  RAISE NOTICE 'stamina roster: % rows re-levelled, % archived; % conferred colours cite a removed or re-levelled event (they stand: a recheck never withdraws)',
    v_shift, v_doomed, v_cited;
END $$;

-- The label is rebuilt too, the way 20260910025855 did: 'D3 Push Up · 20 reps'
-- becomes 'D4 Pushup · 20 reps'. Game reports, /prs and the entry list show it.
UPDATE results r SET raw_score = r.raw_score + s.delta, difficulty_tier = s.new_tier,
       score_label = 'D' || (s.new_idx + 1) || ' ' || s.new_tier
         || CASE WHEN position(' · ' in r.score_label) > 0
                 THEN substring(r.score_label from position(' · ' in r.score_label)) ELSE '' END
  FROM shifts s WHERE s.src = 'r' AND s.id = r.id;
UPDATE workout_entries e SET raw_score = e.raw_score + s.delta, difficulty_tier = s.new_tier,
       score_label = 'D' || (s.new_idx + 1) || ' ' || s.new_tier
         || CASE WHEN position(' · ' in e.score_label) > 0
                 THEN substring(e.score_label from position(' · ' in e.score_label)) ELSE '' END
  FROM shifts s WHERE s.src = 'e' AND s.id = e.id;

DELETE FROM results WHERE id IN (SELECT id FROM doomed WHERE src = 'r');
DELETE FROM workout_entries WHERE id IN (SELECT id FROM doomed WHERE src = 'e');

-- Replay placements where a row moved or went. A shift keeps order, so this
-- only changes anything where a row was deleted; it is cheap and states the
-- invariant rather than relying on that argument.
DO $$
DECLARE s record;
BEGIN
  FOR s IN
    SELECT DISTINCT x.session_id FROM (
      SELECT session_id FROM shifts WHERE src = 'r'
      UNION SELECT session_id FROM doomed WHERE src = 'r') x
    JOIN sessions ss ON ss.id = x.session_id
    WHERE ss.is_active = false AND ss.voided_at IS NULL
  LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;


-- ─── A server guard for the re-levelled ladders ──────────────────────────────
-- The shift above runs once. A kaiwhakawā tab still on the old bundle could
-- then save 'Push Up' or 'L-Sit' in its OLD band, which the new app reads as a
-- different level (a Push Up as an Elevated Pushup), and nothing would move it
-- again. So every write on the five re-levelled events must name a level of
-- the new ladder and sit in that level's band, and a new score on a removed
-- event is refused outright: the same approach as enforce_lift_estimate
-- (20260928201510). Created AFTER the shift and the placement replay, so it
-- never sees a row mid-repair. Named 'zz' to fire after the guards and the
-- band stamps. ANY FUTURE CHANGE TO THESE FIVE LADDERS MUST REDEFINE THIS
-- FUNCTION IN A NEW MIGRATION; __tests__/staminaRoster.test.ts reads the newest
-- definition and pins its list to lib/eventData.ts.
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
           END
      INTO v_slug FROM session_events WHERE id = NEW.event_id;
  ELSE
    v_slug := NEW.event_slug;
  END IF;

  IF TG_OP = 'INSERT' AND v_slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate') THEN
    RAISE EXCEPTION 'That event is no longer on the roster, so it cannot be scored. Refresh the app'
      USING ERRCODE = '22023';
  END IF;


  IF v_slug IN ('l-sit-hold', 'push-up-contest', 'calf-raises', 'wrist-stretch', 'reverse-wrist-stretch')
     AND NEW.raw_score IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM (VALUES
         ('l-sit-hold', 'Curl Up', 0), ('l-sit-hold', 'V Up', 1), ('l-sit-hold', 'Tuck Hold', 2),
         ('l-sit-hold', 'L Sit', 3), ('l-sit-hold', 'V Sit', 4),
         ('push-up-contest', 'Hands Up Knee Pushup', 0), ('push-up-contest', 'Knee Pushup', 1),
         ('push-up-contest', 'Elevated Pushup', 2), ('push-up-contest', 'Pushup', 3),
         ('push-up-contest', '1 Arm Pushup', 4),
         ('calf-raises', 'Calf Raise', 0), ('calf-raises', 'Deficit Calf Raise', 1),
         ('calf-raises', 'Toe Calf Raise', 2), ('calf-raises', 'Single Leg Toe Raise', 3),
         ('wrist-stretch', 'Hand Assisted', 0), ('wrist-stretch', 'Hand Forward', 1),
         ('wrist-stretch', 'Fingers Inwards', 2), ('wrist-stretch', 'Fingers Backwards', 3),
         ('wrist-stretch', 'Backwards Plank', 4),
         ('reverse-wrist-stretch', 'Hand Assisted', 0), ('reverse-wrist-stretch', 'Fingers Outwards', 1),
         ('reverse-wrist-stretch', 'Fingers Backwards', 2), ('reverse-wrist-stretch', 'Fingers Inwards', 3),
         ('reverse-wrist-stretch', 'Inwards Plank', 4)
       ) AS lv(slug, tier, idx)
       WHERE lv.slug = v_slug AND lv.tier = NEW.difficulty_tier
         AND floor(NEW.raw_score / 10000) = lv.idx) THEN
    RAISE EXCEPTION 'That level has changed: refresh the app and enter the score again'
      USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_zz_relevelled_ladders_results ON public.results;
CREATE TRIGGER trg_zz_relevelled_ladders_results
  BEFORE INSERT OR UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.enforce_relevelled_ladders();

DROP TRIGGER IF EXISTS trg_zz_relevelled_ladders_entries ON public.workout_entries;
CREATE TRIGGER trg_zz_relevelled_ladders_entries
  BEFORE INSERT OR UPDATE ON public.workout_entries
  FOR EACH ROW EXECUTE FUNCTION public.enforce_relevelled_ladders();

-- Every player whose evidence moved, or sat on a removed event, is rechecked.
UPDATE players SET grades_checked_at = NULL
WHERE id IN (
  SELECT player_id FROM levelled_rows WHERE player_id IS NOT NULL
  UNION
  SELECT r.player_id FROM results r JOIN session_events se ON se.id = r.event_id
   WHERE r.player_id IS NOT NULL
     AND se.event_slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate'));

-- ─── Plans that name a removed event ─────────────────────────────────────────
-- guard_workouts_write refuses any change to planned_events that names a slug
-- missing from event_domains, so a plan still naming a removed event could
-- never be edited again. Checked 2026-09-30: ONE plan, a finished personal game
-- played that day, listed shoulder-dislocate with nothing scored on it. The
-- event is dropped from the plan, which is all the plan says about it. Done
-- BEFORE the re-seed below, while every remaining slug is still on the roster.
UPDATE workouts
   SET planned_events = array_remove(array_remove(array_remove(planned_events,
         'lunges'), 'ab-wheel-rollout'), 'shoulder-dislocate')
 WHERE planned_events && ARRAY['lunges', 'ab-wheel-rollout', 'shoulder-dislocate'];

-- event_domains: the roster mirrored into SQL, 128 rows.
-- Per domain: 1: 14, 2: 13, 3: 12, 4: 12, 5: 13, 6: 12, 7: 15, 8: 13, 9: 12, 10: 12.
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
  ('Compression', 2, 'l-sit-hold'),
  ('Front Lever', 2, 'front-lever'),
  ('Handstand', 2, 'hand-walk'),
  ('Headstand', 2, 'headstand'),
  ('Human Flag', 2, 'flag'),
  ('Iron Cross', 2, 'iron-cross'),
  ('Planche', 2, 'planche'),
  ('Reverse Maltese', 2, 'reverse-maltese'),
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
  ('Back Extension', 5, 'back-extension'),
  ('Calf Raises', 5, 'calf-raises'),
  ('Chinup Contest', 5, 'chin-up-contest'),
  ('Finger Pushup', 5, 'finger-push-up'),
  ('GHD Situp', 5, 'ghd-situp'),
  ('Hamstring Curl', 5, 'hamstring-curl'),
  ('Hollow Hold', 5, 'hollow-hold'),
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

-- ─── activity_aliases: aliases for the three removed events ─────────────────
-- An alias matching no event does nothing at all, silently (see
-- 20260920220344). Removed rather than repointed: a walking lunge is not a
-- Loaded Lunge, and nothing else on the roster is an ab wheel or a dislocate.
CREATE TABLE public.activity_aliases_archive_20260930011149 AS
SELECT a.*, now() AS archived_at FROM activity_aliases a
 WHERE a.event_slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate');
ALTER TABLE public.activity_aliases_archive_20260930011149 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.activity_aliases_archive_20260930011149 FROM anon, authenticated;

DELETE FROM activity_aliases WHERE event_slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate');

DO $$
DECLARE v int;
BEGIN
  SELECT count(*) INTO v FROM event_domains;
  IF v <> 128 THEN
    RAISE EXCEPTION 'roster mirror: event_domains holds % rows, expected 128', v;
  END IF;

  IF (SELECT count(DISTINCT domain_number) FROM event_domains) <> 10 THEN
    RAISE EXCEPTION 'roster mirror: expected exactly 10 domains';
  END IF;

  IF EXISTS (SELECT 1 FROM event_domains GROUP BY slug HAVING count(*) > 1) THEN
    RAISE EXCEPTION 'roster mirror: a slug is seeded twice';
  END IF;

  IF EXISTS (
    SELECT 1 FROM (VALUES (1,14),(2,13),(3,12),(4,12),(5,13),(6,12),(7,15),(8,13),(9,12),(10,12)) AS want(d, n)
     WHERE n <> (SELECT count(*) FROM event_domains WHERE domain_number = want.d)
  ) THEN
    RAISE EXCEPTION 'roster mirror: per-domain counts are not 14/13/12/12/13/12/15/13/12/12';
  END IF;

  IF EXISTS (SELECT 1 FROM event_domains WHERE slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate')) THEN
    RAISE EXCEPTION 'roster mirror: a removed event is still seeded';
  END IF;

  -- The entries guard re-checks event_slug against event_domains on every
  -- write, so a stored reference to a removed slug would become an entry nobody
  -- can edit. None existed on 2026-09-30; abort rather than guess if one does.
  IF EXISTS (SELECT 1 FROM workout_entries WHERE event_slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate'))
     OR EXISTS (SELECT 1 FROM workouts WHERE planned_events && ARRAY['lunges', 'ab-wheel-rollout', 'shoulder-dislocate'])
     OR EXISTS (SELECT 1 FROM grade_exemptions WHERE event_slug IN ('lunges', 'ab-wheel-rollout', 'shoulder-dislocate')) THEN
    RAISE EXCEPTION 'stamina roster: a workout, plan or exemption still stores a removed slug';
  END IF;

  IF EXISTS (SELECT 1 FROM session_events
              WHERE event_name IN ('L-Sit Hold', 'Pushup Contest', 'Wrist Stretch', 'Reverse Wrist Stretch')
                 OR domain_name = 'Anaerobic Endurance') THEN
    RAISE EXCEPTION 'stamina roster: a session_events row still carries an old name';
  END IF;

  -- The invariant this file exists for: every scored row on a re-levelled
  -- event names a level of its new ladder AND sits in that level's band.
  SELECT count(*) INTO v FROM (
    SELECT se.event_slug AS slug, r.difficulty_tier AS tier, r.raw_score
      FROM results r JOIN session_events se ON se.id = r.event_id
     WHERE se.event_slug IN (SELECT DISTINCT slug FROM new_levels)
    UNION ALL
    SELECT e.event_slug, e.difficulty_tier, e.raw_score FROM workout_entries e
     WHERE e.event_slug IN (SELECT DISTINCT slug FROM new_levels) AND e.raw_score IS NOT NULL
  ) x
  WHERE NOT EXISTS (SELECT 1 FROM new_levels n
                     WHERE n.slug = x.slug AND n.tier = x.tier AND floor(x.raw_score / 10000) = n.idx);
  IF v > 0 THEN
    RAISE EXCEPTION 'stamina roster: % rows on a re-levelled event do not sit on their new level', v;
  END IF;

  SELECT count(*) INTO v FROM (
    SELECT session_id, event_id, player_id FROM results
    WHERE event_placement IS NOT NULL AND player_id IS NOT NULL
    GROUP BY 1, 2, 3 HAVING count(*) > 1) d;
  IF v > 0 THEN
    RAISE EXCEPTION 'stamina roster: % player-events hold two placed rows after the replay', v;
  END IF;

  SELECT count(*) INTO v
    FROM activity_aliases a LEFT JOIN event_domains e ON e.slug = a.event_slug
   WHERE e.slug IS NULL;
  IF v > 0 THEN
    RAISE EXCEPTION 'activity_aliases: % alias(es) point at no event', v;
  END IF;
END $$;

COMMIT;
