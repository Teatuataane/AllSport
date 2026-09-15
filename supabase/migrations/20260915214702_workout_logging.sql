-- ════════════════════════════════════════════════════════════════════════════
-- 20260915214702 — Workout logging: any workout, fitted to an event, graded
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT
--   1. workouts — one logged session: a player, the day it was trained, and
--      who logged it. Backdated at most 7 days (decision 17).
--   2. workout_entries — what was done: the activity as typed, the event it is
--      fitted to (NULL = not fitted yet), the VOLUME (sets, holds, attempts,
--      games or metres) and an optional BEST EFFORT encoded exactly as
--      results.raw_score, which is what counts toward the standards.
--   3. activity_aliases — "road ride" is Cycling. Everyone reads, kaiwhakawā write.
--   4. fit_activity() — a kaiwhakawā adds an alias and every unfitted entry with
--      that activity, across the club, is fitted at once (decision 14).
--   5. delete_my_account() — also deletes the player's workouts.
--
-- PRIVACY (decision 16): a log shows where and when someone trains, tamariki
-- included, so it is readable only by the player, their parent and
-- kaiwhakawā. Nothing here is public, and no public surface reads it: the
-- leaderboard and Top % keep reading `results` only.
--
-- TRUST (decision 2): scores are self-reported, as game scores already are.
-- What the database pins is WHO logged a workout and whether it was
-- witnessed, because the release panel shows that to the kaiwhakawā. Those are
-- pinned by a trigger, never by grants (see CLAUDE.md: a table-level grant
-- overrides column REVOKEs).
--
-- Units are NOT stored. What one unit is lives in lib/unitSheet.ts, compiled
-- from a reviewed sheet, so the raw volume is stored and units are worked out
-- on read. Changing the sheet then needs no migration.
--
-- DEPLOY ORDER: either is safe. Every workout read is its own query and treats
-- a missing table (PGRST205) as "no workouts yet"; the log page says logging
-- is not live.

-- ── 0. Who may log for whom ─────────────────────────────────────────────────
-- Yourself, your children, or anyone if you are a kaiwhakawā (decision 15).
-- SECURITY DEFINER for the same reason as is_judge(): a policy that subqueries
-- players from another table is fine, but keeping the rule in ONE function
-- means the two tables below can never disagree about it.
CREATE OR REPLACE FUNCTION public.can_log_for(p_player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND (
    p_player_id = auth.uid()
    OR public.is_judge()
    OR EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND parent_id = auth.uid())
  )
$$;
REVOKE ALL ON FUNCTION public.can_log_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_log_for(uuid) TO authenticated;

-- ── 1. Workouts ─────────────────────────────────────────────────────────────
CREATE TABLE public.workouts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  logged_by    uuid NOT NULL REFERENCES public.players(id),
  -- The day trained, in NZ. Units count by this day, not the day logged.
  performed_on date NOT NULL,
  -- True when a kaiwhakawā logged it for someone else. Set by the trigger.
  witnessed    boolean NOT NULL DEFAULT false,
  notes        text CHECK (notes IS NULL OR length(notes) <= 500),
  created_at   timestamptz NOT NULL DEFAULT now(),
  -- Decision 17: up to 7 days back, never forward. created_at is pinned by the
  -- trigger, so an UPDATE cannot walk the date further back than that either.
  CONSTRAINT workouts_within_a_week CHECK (
    performed_on <= (created_at AT TIME ZONE 'Pacific/Auckland')::date
    AND performed_on >= (created_at AT TIME ZONE 'Pacific/Auckland')::date - 7
  )
);
CREATE INDEX workouts_player_idx ON public.workouts (player_id, performed_on DESC);

CREATE OR REPLACE FUNCTION public.guard_workouts_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    -- service_role has no auth.uid() and must say who logged it.
    NEW.logged_by  := COALESCE(auth.uid(), NEW.logged_by);
    -- Witnessed means a kaiwhakawā watched someone ELSE do it. A kaiwhakawā's
    -- own solo session is as self-reported as anyone's.
    NEW.witnessed  := auth.uid() IS NOT NULL AND public.is_judge() AND NEW.player_id <> auth.uid();
  ELSE
    NEW.id         := OLD.id;
    NEW.player_id  := OLD.player_id;
    NEW.logged_by  := OLD.logged_by;
    NEW.witnessed  := OLD.witnessed;
    NEW.created_at := OLD.created_at;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_workouts_write
  BEFORE INSERT OR UPDATE ON public.workouts
  FOR EACH ROW EXECUTE FUNCTION public.guard_workouts_write();

ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;
CREATE POLICY workouts_by_logger ON public.workouts FOR ALL
  USING (public.can_log_for(player_id))
  WITH CHECK (public.can_log_for(player_id));

REVOKE ALL ON public.workouts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workouts TO authenticated;

-- ── 2. Entries ──────────────────────────────────────────────────────────────
CREATE TABLE public.workout_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id        uuid NOT NULL REFERENCES public.workouts(id) ON DELETE CASCADE,
  -- As typed: "road ride". Kept after fitting, so the alias list can grow.
  activity          text NOT NULL CHECK (length(btrim(activity)) BETWEEN 1 AND 80),
  -- lib/eventData.ts slug; NULL = not fitted yet. Checked by the trigger
  -- against event_domains (slug is not unique there, so no FK).
  event_slug        text,
  -- VOLUME. Completions, or metres on a distance event (lib/units.ts).
  count             int CHECK (count IS NULL OR count BETWEEN 0 AND 1000),
  volume_distance_m numeric CHECK (volume_distance_m IS NULL OR volume_distance_m BETWEEN 0 AND 1000000),
  duration_seconds  int CHECK (duration_seconds IS NULL OR duration_seconds BETWEEN 0 AND 86400),
  -- BEST EFFORT, the same columns and encoding as results (lib/scoring.ts
  -- scoreColumns). Present means it counts toward the standards.
  raw_score          numeric,
  score_label        text,
  difficulty_tier    text,
  exercise_variation text,
  weight_kg          numeric,
  reps               int,
  time_seconds       numeric,
  distance_m         numeric,
  created_at         timestamptz NOT NULL DEFAULT now(),
  -- A score only means something against an event's ladder.
  CONSTRAINT workout_entries_score_needs_event CHECK (raw_score IS NULL OR event_slug IS NOT NULL)
);
CREATE INDEX workout_entries_workout_idx ON public.workout_entries (workout_id);
CREATE INDEX workout_entries_unfitted_idx ON public.workout_entries (lower(btrim(activity))) WHERE event_slug IS NULL;

CREATE OR REPLACE FUNCTION public.guard_workout_entries_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    NEW.id         := OLD.id;
    NEW.workout_id := OLD.workout_id;
    NEW.created_at := OLD.created_at;
  END IF;
  IF NEW.event_slug IS NOT NULL AND NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = NEW.event_slug) THEN
    RAISE EXCEPTION 'workout entry: % is not an event on the roster', NEW.event_slug USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_guard_workout_entries_write
  BEFORE INSERT OR UPDATE ON public.workout_entries
  FOR EACH ROW EXECUTE FUNCTION public.guard_workout_entries_write();

ALTER TABLE public.workout_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY workout_entries_by_logger ON public.workout_entries FOR ALL
  USING (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_entries.workout_id AND public.can_log_for(w.player_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM workouts w WHERE w.id = workout_entries.workout_id AND public.can_log_for(w.player_id)));

REVOKE ALL ON public.workout_entries FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_entries TO authenticated;

-- ── 3. Aliases ──────────────────────────────────────────────────────────────
CREATE TABLE public.activity_aliases (
  alias      text PRIMARY KEY CHECK (alias = lower(btrim(alias)) AND length(alias) BETWEEN 1 AND 80),
  event_slug text NOT NULL,
  created_by uuid REFERENCES public.players(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.activity_aliases ENABLE ROW LEVEL SECURITY;
CREATE POLICY activity_aliases_read ON public.activity_aliases FOR SELECT USING (true);
-- No write policy: fit_activity() is the only write path.
REVOKE ALL ON public.activity_aliases FROM anon, authenticated;
GRANT SELECT ON public.activity_aliases TO authenticated;

-- A starting list. Event names already match on their own (the log form
-- searches the roster too), so these are only the words people actually type.
-- Every slug is checked against event_domains by the closing block.
INSERT INTO public.activity_aliases (alias, event_slug) VALUES
  ('bike', 'cycling'), ('bike ride', 'cycling'), ('ride', 'cycling'), ('road ride', 'cycling'),
  ('cycle', 'cycling'), ('spin', 'cycling'), ('spin class', 'cycling'), ('mountain bike', 'cycling'),
  ('mtb', 'cycling'), ('bike erg', 'cycling'), ('wattbike', 'cycling'),
  ('run', 'running'), ('jog', 'running'), ('jogging', 'running'), ('parkrun', 'running'),
  ('trail run', 'running'), ('treadmill', 'running'), ('road run', 'running'),
  ('row', 'row-erg'), ('rowing', 'row-erg'), ('rower', 'row-erg'), ('erg', 'row-erg'), ('concept2', 'row-erg'),
  ('skierg', 'ski-erg'),
  ('deadlifts', 'deadlift'),
  ('chin ups', 'chin-up-contest'), ('chinups', 'chin-up-contest'), ('pull ups', 'chin-up-contest'), ('pullups', 'chin-up-contest'),
  ('push ups', 'push-up-contest'), ('pushups', 'push-up-contest'), ('press ups', 'push-up-contest'),
  ('lunge', 'lunges'), ('walking lunges', 'lunges'),
  ('wall sits', 'wall-sit'),
  ('skipping', 'jump-rope'), ('skip rope', 'jump-rope')
ON CONFLICT (alias) DO NOTHING;

-- ── 4. Fitting an activity ──────────────────────────────────────────────────
-- Returns how many entries it fitted. Re-pointing an alias moves only entries
-- that are still unfitted: an entry already fitted, by alias or by the player
-- choosing an event, is left where it is.
CREATE OR REPLACE FUNCTION public.fit_activity(p_activity text, p_event_slug text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_alias text := lower(btrim(COALESCE(p_activity, '')));
  v_n     int;
BEGIN
  IF auth.uid() IS NULL OR NOT public.is_judge() THEN
    RAISE EXCEPTION 'fit_activity: only a kaiwhakawā can fit an activity' USING ERRCODE = '42501';
  END IF;
  IF v_alias = '' OR length(v_alias) > 80 THEN
    RAISE EXCEPTION 'fit_activity: activity must be 1 to 80 characters' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = p_event_slug) THEN
    RAISE EXCEPTION 'fit_activity: % is not an event on the roster', p_event_slug USING ERRCODE = '22023';
  END IF;

  INSERT INTO activity_aliases (alias, event_slug, created_by)
  VALUES (v_alias, p_event_slug, auth.uid())
  ON CONFLICT (alias) DO UPDATE
    SET event_slug = EXCLUDED.event_slug, created_by = EXCLUDED.created_by, created_at = now();

  UPDATE workout_entries SET event_slug = p_event_slug
  WHERE event_slug IS NULL AND lower(btrim(activity)) = v_alias;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;

REVOKE ALL ON FUNCTION public.fit_activity(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fit_activity(text, text) TO authenticated;

-- ── 5. Erasure also deletes workouts ────────────────────────────────────────
-- Redefined whole, from 20260915051927_grading_schema.sql, with one addition
-- marked below. Everything else is unchanged.
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

-- ── 6. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['workouts', 'workout_entries', 'activity_aliases'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = ('public.' || t)::regclass) THEN
      RAISE EXCEPTION 'workout logging: RLS is not enabled on %', t;
    END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM activity_aliases a WHERE NOT EXISTS (SELECT 1 FROM event_domains d WHERE d.slug = a.event_slug)) THEN
    RAISE EXCEPTION 'workout logging: an alias points at an event that is not on the roster';
  END IF;
  IF (SELECT count(*) FROM pg_proc
      WHERE proname IN ('can_log_for', 'guard_workouts_write', 'guard_workout_entries_write', 'fit_activity')
        AND prosecdef AND 'search_path=public' = ANY (proconfig)) <> 4 THEN
    RAISE EXCEPTION 'workout logging: a function is missing, not SECURITY DEFINER, or has no pinned search_path';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'delete_my_account' AND prosrc LIKE '%DELETE FROM workouts%') THEN
    RAISE EXCEPTION 'workout logging: delete_my_account does not delete workouts';
  END IF;
END $$;
