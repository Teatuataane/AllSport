-- ════════════════════════════════════════════════════════════════════════════
-- 20260921232726 — The bodyweight band of the day
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY
--   A strength standard is `ratio × the middle of the player's declared band`
--   (lib/grading.ts ratioThresholdsKg), and the player sets bodyweight_band
--   themselves on /profile. Declaring "Under 50kg" lowers every lift and
--   loaded-carry threshold at once.
--
--   Today a kaiwhakawā would notice when they release the colour. Auto-conferral
--   (docs/designs/auto-conferral-spec.md, decision 6) removes that moment, and
--   this is the worst hole it opens: a whole domain inflated from one dropdown,
--   without a single falsified score.
--
--   So the band is STAMPED ON THE ROW when the score is written and never
--   changes again. A lift is graded against the bodyweight of the day, and
--   changing your band today does not re-grade a lift from March.
--
-- WHAT
--   1. results.bodyweight_band and workout_entries.bodyweight_band, same CHECK
--      as players.bodyweight_band.
--   2. players.bodyweight_band_first: the FIRST band a player ever set, pinned.
--   3. A one-time backfill of the score rows from each player's current band.
--   4. Stamp triggers, created AFTER the backfill: stamp on INSERT, pin on
--      UPDATE. Never accepted from a client.
--
-- ROWS WRITTEN BEFORE A PLAYER HAD ANY BAND stay null, and the engine grades
-- them against bodyweight_band_first — the first band they ever set, which can
-- never change afterwards. That is what keeps the dashboard's promise ("pick a
-- 10kg range and they start counting") without reopening the hole: clearing a
-- band and setting a lighter one moves bodyweight_band, never the first.
--
-- NO TRIGGER HERE EVER WRITES A SCORE ROW AFTER THE MIGRATION ITSELF. An
-- earlier draft stamped a player's unstamped rows the moment they first set a
-- band. It ran under the player's own login, so guard_results_write refused
-- every row in a finished game and guard_workout_entries_write every old or
-- witnessed log, the whole band save rolled back, and nobody with a past game
-- could ever set a band. Found in the pre-landing review, before it shipped.
--
-- NOT redefining any existing guard (CLAUDE.md: a whole redefinition is how a
-- rule goes missing). These are separate triggers. They sort after the guards
-- by name and same-timing triggers fire in name order, so a rejected write is
-- never stamped.
--
-- DEPLOY ORDER: either way is safe. The engine reads the row's band, then the
-- first band, then the current one, so before this lands it behaves exactly as
-- it did, and after it lands unstamped rows keep working.
--
-- PRE-FLIGHT: the workout_entries backfill fires guard_workout_entries_write,
-- whose roster and Game-rung rules apply even to the migration's own writes.
-- An existing entry breaking either would roll this whole file back (safe, but
-- it would block the push). Check before pushing:
--   select count(*) from workout_entries e
--   where e.event_slug is not null
--     and not exists (select 1 from event_domains d where d.slug = e.event_slug);
--
-- __tests__/bodyweightBand.test.ts pins this file.

-- ── 1. The columns ──────────────────────────────────────────────────────────
-- Labels, never a number — the same trade players.bodyweight_band makes.
ALTER TABLE public.results         ADD COLUMN IF NOT EXISTS bodyweight_band text;
ALTER TABLE public.workout_entries ADD COLUMN IF NOT EXISTS bodyweight_band text;
ALTER TABLE public.players         ADD COLUMN IF NOT EXISTS bodyweight_band_first text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'results_bodyweight_band_check') THEN
    ALTER TABLE public.results ADD CONSTRAINT results_bodyweight_band_check CHECK (
      bodyweight_band IS NULL OR bodyweight_band IN (
        'Under 50kg', '50 to 60kg', '60 to 70kg', '70 to 80kg',
        '80 to 90kg', '90 to 100kg', '100 to 110kg', '110kg and over'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'workout_entries_bodyweight_band_check') THEN
    ALTER TABLE public.workout_entries ADD CONSTRAINT workout_entries_bodyweight_band_check CHECK (
      bodyweight_band IS NULL OR bodyweight_band IN (
        'Under 50kg', '50 to 60kg', '60 to 70kg', '70 to 80kg',
        '80 to 90kg', '90 to 100kg', '100 to 110kg', '110kg and over'
      )
    );
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'players_bodyweight_band_first_check') THEN
    ALTER TABLE public.players ADD CONSTRAINT players_bodyweight_band_first_check CHECK (
      bodyweight_band_first IS NULL OR bodyweight_band_first IN (
        'Under 50kg', '50 to 60kg', '60 to 70kg', '70 to 80kg',
        '80 to 90kg', '90 to 100kg', '100 to 110kg', '110kg and over'
      )
    );
  END IF;
END $$;

COMMENT ON COLUMN public.results.bodyweight_band IS
  'The band the player held when this score was written. Stamped by trigger, '
  'never accepted from a client, pinned forever: a lift is graded against the '
  'bodyweight of the day. Null for a guest, or a player with no band then — '
  'those grade against players.bodyweight_band_first.';
COMMENT ON COLUMN public.workout_entries.bodyweight_band IS
  'As results.bodyweight_band. Logged best efforts are graded against the same '
  'standards, so they need the same pin.';
COMMENT ON COLUMN public.players.bodyweight_band_first IS
  'The first band this player ever set. Pinned by trigger once set, so a score '
  'logged before any band always grades against the same band, however the '
  'current one changes. Not in players_public.';

-- ── 2. The first band, pinned ───────────────────────────────────────────────
-- Set by the first non-null band, then never again by a client — not the
-- player, not a kaiwhakawā, not a request sending the column. Server code can:
-- a migration or the SQL Editor (no login) to correct it, and account erasure,
-- which clears it (delete_my_account, redefined below). SECURITY INVOKER on
-- purpose, so current_user tells a client write from a definer function's; see
-- 20260921182106 for why auth.uid() alone cannot.
CREATE OR REPLACE FUNCTION public.pin_bodyweight_band_first()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW;                           -- trusted server code only
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.bodyweight_band_first := NEW.bodyweight_band;
  ELSE
    NEW.bodyweight_band_first := COALESCE(OLD.bodyweight_band_first, NEW.bodyweight_band);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pin_bodyweight_band_first ON public.players;
CREATE TRIGGER trg_pin_bodyweight_band_first
  BEFORE INSERT OR UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.pin_bodyweight_band_first();

-- ── 3. Backfill ─────────────────────────────────────────────────────────────
-- BEFORE the stamp triggers exist, on purpose: they pin an update to its old
-- value, which is null for every historical row, so created first they would
-- undo this. History has no record of what anyone weighed, so the current band
-- is the best available answer — an APPROXIMATION, applied once, here.
UPDATE players SET bodyweight_band_first = bodyweight_band
WHERE bodyweight_band IS NOT NULL AND bodyweight_band_first IS NULL;

UPDATE results r SET bodyweight_band = p.bodyweight_band
FROM players p
WHERE p.id = r.player_id
  AND p.bodyweight_band IS NOT NULL
  AND r.bodyweight_band IS NULL;

UPDATE workout_entries e SET bodyweight_band = p.bodyweight_band
FROM workouts w JOIN players p ON p.id = w.player_id
WHERE w.id = e.workout_id
  AND p.bodyweight_band IS NOT NULL
  AND e.bodyweight_band IS NULL;

-- ── 4. Stamping ─────────────────────────────────────────────────────────────
-- SECURITY DEFINER because it reads players, closed by RLS since
-- 20260813000003. Every legitimate writer (the player, their parent, a
-- kaiwhakawā) could read that row anyway; a definer stops the stamp depending
-- on which of them it happens to be. It only ever writes the row being stamped.
CREATE OR REPLACE FUNCTION public.stamp_results_band()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Pinned, null included: editing a score never re-dates the bodyweight it
  -- was lifted at, and a client cannot move it by sending a value of its own.
  IF TG_OP = 'UPDATE' THEN
    NEW.bodyweight_band := OLD.bodyweight_band;
    RETURN NEW;
  END IF;

  IF NEW.player_id IS NULL THEN
    NEW.bodyweight_band := NULL;          -- a guest has no profile to read
  ELSE
    SELECT p.bodyweight_band INTO NEW.bodyweight_band
    FROM players p WHERE p.id = NEW.player_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.stamp_workout_entry_band()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.bodyweight_band := OLD.bodyweight_band;
    RETURN NEW;
  END IF;

  SELECT p.bodyweight_band INTO NEW.bodyweight_band
  FROM workouts w JOIN players p ON p.id = w.player_id
  WHERE w.id = NEW.workout_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_results_band ON public.results;
CREATE TRIGGER trg_stamp_results_band
  BEFORE INSERT OR UPDATE ON public.results
  FOR EACH ROW EXECUTE FUNCTION public.stamp_results_band();

DROP TRIGGER IF EXISTS trg_stamp_workout_entry_band ON public.workout_entries;
CREATE TRIGGER trg_stamp_workout_entry_band
  BEFORE INSERT OR UPDATE ON public.workout_entries
  FOR EACH ROW EXECUTE FUNCTION public.stamp_workout_entry_band();

-- ── 5. Erasure clears the first band ────────────────────────────────────────
-- Redefined WHOLE from 20260915214702_workout_logging.sql, the latest
-- definition, with ONE line added and marked. bodyweight_band_first is a
-- bodyweight attribute, and /privacy promises erasure removes bodyweight.
-- __tests__/bodyweightBand.test.ts fails if this body differs from the previous
-- one by anything other than that line.
--
-- It runs its UPDATE as the function's owner, not as `authenticated`, which is
-- what lets it past pin_bodyweight_band_first and the grading-identity guard
-- (20260921182106), both of which trust server code by current_user.
CREATE OR REPLACE FUNCTION public.delete_my_account(p_player_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID;
  v_names  TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  v_target := COALESCE(p_player_id, auth.uid());

  -- Yourself, or a child profile you are the parent of. Nothing else.
  IF v_target <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM players WHERE id = v_target AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'you can only erase your own account or a child profile you manage'
      USING ERRCODE = '42501';
  END IF;

  -- Health information goes entirely. WHO-5 answers are the most sensitive
  -- thing we hold, they are voluntary, and nothing outside the player's own
  -- dashboard reads a row: the kaiwhakawā report is an aggregate. Rows already
  -- folded into a published quarterly average cannot be traced back.
  DELETE FROM wellbeing_surveys WHERE player_id = v_target;

  -- ADDED 20260915051927: an exemption's reason can be medical, so it goes
  -- with the rest of the health information.
  DELETE FROM grade_exemptions WHERE player_id = v_target;

  -- ADDED 20260915214702: a training log records where and when someone
  -- trained, and unlike a game result it is not part of anyone else's
  -- competition record. The entries go with it (ON DELETE CASCADE).
  DELETE FROM workouts WHERE player_id = v_target;

  -- Capture every name this player has been known by BEFORE scrubbing, so the
  -- free-text opponent_name copies can be found afterwards.
  SELECT ARRAY_REMOVE(ARRAY[
    NULLIF(display_name, ''), NULLIF(username, ''), NULLIF(full_name, '')
  ], NULL)
  INTO v_names
  FROM players WHERE id = v_target;

  -- Every identifying attribute. display_name is set rather than nulled so the
  -- leaderboard and past game reports still render a row instead of a blank.
  UPDATE players SET
    full_name       = NULL,
    email           = NULL,
    phone           = NULL,
    date_of_birth   = NULL,
    gender          = NULL,
    city            = NULL,
    region          = NULL,
    country         = NULL,
    parent_name     = NULL,
    parent_email    = NULL,
    parent_phone    = NULL,
    referral_code   = NULL,
    username        = NULL,
    icon            = NULL,
    -- ADDED 20260915051927.
    bodyweight_band = NULL,
    -- ADDED 20260921232726: the first band is a bodyweight attribute too.
    bodyweight_band_first = NULL,
    display_name    = 'Former player',
    show_full_name  = FALSE,
    show_username   = FALSE,
    show_location   = FALSE,
    is_active       = FALSE
  WHERE id = v_target;

  -- The name a kaiwhakawā typed onto a score row is a second copy of it.
  UPDATE results SET player_name = 'Former player'
  WHERE player_id = v_target;

  -- Being named as somebody's opponent is their record of a match, but the
  -- string is this player's name. Scrub the copies; exact match only.
  IF v_names IS NOT NULL AND array_length(v_names, 1) > 0 THEN
    UPDATE results SET opponent_name = 'Former player'
    WHERE opponent_name = ANY (v_names);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(UUID) TO authenticated;

-- ── 6. Assertions ───────────────────────────────────────────────────────────
-- A migration that rewrites derived data asserts its own invariant, so a
-- backfill that silently fails to take cannot report success (CLAUDE.md).
DO $$
DECLARE
  v_missing int;
  v_stamped int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM results r JOIN players p ON p.id = r.player_id
  WHERE p.bodyweight_band IS NOT NULL AND r.bodyweight_band IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'band backfill: % result rows of banded players still unstamped', v_missing;
  END IF;

  SELECT count(*) INTO v_missing
  FROM workout_entries e
  JOIN workouts w ON w.id = e.workout_id
  JOIN players p ON p.id = w.player_id
  WHERE p.bodyweight_band IS NOT NULL AND e.bodyweight_band IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'band backfill: % workout entries of banded players still unstamped', v_missing;
  END IF;

  SELECT count(*) INTO v_missing
  FROM players WHERE bodyweight_band IS NOT NULL AND bodyweight_band_first IS NULL;
  IF v_missing > 0 THEN
    RAISE EXCEPTION 'band backfill: % banded players have no first band', v_missing;
  END IF;

  IF position('bodyweight_band_first = NULL' in (
       SELECT prosrc FROM pg_proc WHERE proname = 'delete_my_account')) = 0 THEN
    RAISE EXCEPTION 'band: account erasure does not clear the first band';
  END IF;

  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'stamp_bands_on_first_set') THEN
    RAISE EXCEPTION 'band: a trigger that rewrites score rows on a band change must not exist';
  END IF;

  SELECT count(*) INTO v_stamped FROM results WHERE bodyweight_band IS NOT NULL;
  RAISE NOTICE 'band of the day: % result rows stamped', v_stamped;
  SELECT count(*) INTO v_stamped FROM workout_entries WHERE bodyweight_band IS NOT NULL;
  RAISE NOTICE 'band of the day: % workout entries stamped', v_stamped;
END $$;
