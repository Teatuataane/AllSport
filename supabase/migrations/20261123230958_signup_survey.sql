-- ─── Sign-up and survey: who plays, for funders (multi-location PR 9) ───────
-- MULTI_LOCATION_PLAN.md §2 "Registration and survey", step 9. Agreed with
-- Tāne 24 Nov 2026:
--
--   * Ethnicity at sign-up, REQUIRED, the Stats NZ tick boxes; "Prefer not to
--     say" is an answer. Existing players are asked on HOME.
--   * Juniors: a parent ticks "Share my child's attendance with their school"
--     and "My child may do the wellbeing check-in". Until the second tick is
--     yes, a junior's check-in is HELD BACK (the insert policy below refuses).
--   * In the check-in: suburb (Canterbury list with an NZ Deprivation Index
--     decile, or "Somewhere else"), school (juniors; Canterbury schools from
--     the Ministry of Education list, "Other school" or "Not at school"),
--     disability (optional) and "Active before AllSport?" (asked once, never
--     overwritten). Suburb, school and disability are re-confirmed in the
--     first check-in of each NZ calendar year.
--   * Each check-in records the programme the player was in.
--
-- All of it is private: the player, their parent and a Kaiwhakawā read it;
-- never players_public, never a public payload. Writes go only through
-- save_private_profile() and set_junior_consent().
--
-- The lists themselves (nz_suburbs, nz_schools) are filled by the next
-- migration, generated from the published sources by
-- scripts/build-reference-lists.mjs.

-- ── 1. Reference lists: public, read only ────────────────────────────────────
CREATE TABLE public.nz_suburbs (
  -- The Stats NZ statistical area 2 code: what the Deprivation Index is
  -- published by. 'elsewhere' is the "Somewhere else" answer.
  id     text PRIMARY KEY,
  name   text NOT NULL,
  -- The district or city: Christchurch City, Selwyn District, ...
  area   text,
  -- NZ Deprivation Index decile, 1 least deprived to 10 most. Null for 'elsewhere'.
  nzdep  smallint CHECK (nzdep BETWEEN 1 AND 10)
);

CREATE TABLE public.nz_schools (
  -- The Ministry of Education institution number.
  id     integer PRIMARY KEY,
  name   text NOT NULL,
  -- Suburb or town, to tell two schools of one name apart.
  place  text,
  kind   text
);

ALTER TABLE public.nz_suburbs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.nz_schools ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nz_suburbs, public.nz_schools FROM anon, authenticated;
GRANT SELECT ON public.nz_suburbs, public.nz_schools TO anon, authenticated;
CREATE POLICY nz_suburbs_read ON public.nz_suburbs FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY nz_schools_read ON public.nz_schools FOR SELECT TO anon, authenticated USING (true);

INSERT INTO public.nz_suburbs (id, name, area, nzdep) VALUES ('elsewhere', 'Somewhere else', NULL, NULL);

-- ── 2. The private profile ───────────────────────────────────────────────────
CREATE TABLE public.player_profile_private (
  player_id        uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  -- Stats NZ level 1 style tick boxes, several allowed. Required at sign-up;
  -- {'prefer_not'} is an answer.
  ethnicity        text[] CHECK (ethnicity <@ ARRAY[
                     'nz_european', 'maori', 'samoan', 'cook_islands_maori', 'tongan',
                     'niuean', 'chinese', 'indian', 'other', 'prefer_not']::text[]
                     AND cardinality(ethnicity) > 0),
  suburb_id        text REFERENCES public.nz_suburbs(id),
  school_id        integer REFERENCES public.nz_schools(id),
  -- 'listed' (school_id says which), 'other' or 'none'. Juniors only.
  school_status    text CHECK (school_status IN ('listed', 'other', 'none')),
  -- Optional: 'yes', 'no' or 'prefer_not'.
  disability       text CHECK (disability IN ('yes', 'no', 'prefer_not')),
  -- Asked once and never overwritten (save_private_profile keeps the first).
  active_before    text CHECK (active_before IN ('yes', 'no')),
  -- The NZ year suburb, school and disability were last confirmed.
  confirmed_year   integer,
  -- Juniors: a parent's answers. Null = not asked yet.
  share_with_school boolean,
  survey_consent    boolean,
  consent_by        uuid REFERENCES public.players(id) ON DELETE SET NULL,
  consent_at        timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (school_status IS DISTINCT FROM 'listed' OR school_id IS NOT NULL)
);

ALTER TABLE public.player_profile_private ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_profile_private FROM anon, authenticated;
GRANT SELECT ON public.player_profile_private TO authenticated;
-- The player, their parent, a Kaiwhakawā (can_log_for). No write policy.
CREATE POLICY player_profile_private_read ON public.player_profile_private FOR SELECT TO authenticated
  USING (public.can_log_for(player_id));

-- ── 3. Writing it ────────────────────────────────────────────────────────────
-- p is a JSON object; only the keys present change:
--   ethnicity (array), suburb_id, school_status, school_id, disability,
--   active_before, confirm (true stamps this NZ year).
-- active_before is kept once set. The player or their parent only.
CREATE OR REPLACE FUNCTION public.save_private_profile(p_player_id uuid, p jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_eth text[];
  v_year int := extract(year FROM (now() AT TIME ZONE 'Pacific/Auckland'))::int;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    p_player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND parent_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'profile: only for yourself or your children' USING ERRCODE = '42501';
  END IF;
  IF p IS NULL OR jsonb_typeof(p) <> 'object' THEN
    RAISE EXCEPTION 'profile: answers missing' USING ERRCODE = '22023';
  END IF;
  IF p ? 'ethnicity' THEN
    IF jsonb_typeof(p->'ethnicity') <> 'array' THEN
      RAISE EXCEPTION 'profile: ethnicity is a list' USING ERRCODE = '22023';
    END IF;
    SELECT array_agg(DISTINCT x ORDER BY x) INTO v_eth FROM jsonb_array_elements_text(p->'ethnicity') x;
    IF v_eth IS NULL THEN
      RAISE EXCEPTION 'profile: pick at least one, or Prefer not to say' USING ERRCODE = '22023';
    END IF;
    -- "Prefer not to say" stands alone.
    IF 'prefer_not' = ANY (v_eth) THEN v_eth := ARRAY['prefer_not']; END IF;
  END IF;

  INSERT INTO player_profile_private (player_id) VALUES (p_player_id) ON CONFLICT DO NOTHING;

  UPDATE player_profile_private SET
    ethnicity     = CASE WHEN p ? 'ethnicity' THEN v_eth ELSE ethnicity END,
    suburb_id     = CASE WHEN p ? 'suburb_id' THEN p->>'suburb_id' ELSE suburb_id END,
    school_status = CASE WHEN p ? 'school_status' THEN p->>'school_status' ELSE school_status END,
    school_id     = CASE
                      WHEN p ? 'school_status' AND p->>'school_status' IS DISTINCT FROM 'listed' THEN NULL
                      WHEN p ? 'school_id' THEN (p->>'school_id')::int
                      ELSE school_id END,
    disability    = CASE WHEN p ? 'disability' THEN p->>'disability' ELSE disability END,
    -- Asked once, ever: the first answer stays.
    active_before = COALESCE(active_before, p->>'active_before'),
    confirmed_year = CASE WHEN COALESCE((p->>'confirm')::boolean, false) THEN v_year ELSE confirmed_year END,
    updated_at    = now()
  WHERE player_id = p_player_id;
END
$function$;

-- A junior's parent answers both consent questions. A junior with no linked
-- parent ticks them with a parent beside them (the screen says so); that is
-- the player's own account, so it is allowed for themselves too.
CREATE OR REPLACE FUNCTION public.set_junior_consent(p_player_id uuid, p_share_with_school boolean, p_survey boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    p_player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND parent_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'consent: only for yourself or your children' USING ERRCODE = '42501';
  END IF;
  IF p_share_with_school IS NULL OR p_survey IS NULL THEN
    RAISE EXCEPTION 'consent: answer both' USING ERRCODE = '22023';
  END IF;
  INSERT INTO player_profile_private (player_id, share_with_school, survey_consent, consent_by, consent_at)
  VALUES (p_player_id, p_share_with_school, p_survey, auth.uid(), now())
  ON CONFLICT (player_id) DO UPDATE SET
    share_with_school = EXCLUDED.share_with_school,
    survey_consent    = EXCLUDED.survey_consent,
    consent_by        = EXCLUDED.consent_by,
    consent_at        = EXCLUDED.consent_at,
    updated_at        = now();
END
$function$;

REVOKE EXECUTE ON FUNCTION public.save_private_profile(uuid, jsonb), public.set_junior_consent(uuid, boolean, boolean)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_private_profile(uuid, jsonb), public.set_junior_consent(uuid, boolean, boolean)
  TO authenticated;

-- ── 4. Juniors' check-ins wait for a parent's yes ────────────────────────────
-- A junior is anyone turning 16 or under this NZ year (the Juniors rule), or in
-- the Juniors division when there is no date of birth.
CREATE OR REPLACE FUNCTION public.survey_allowed(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT NOT EXISTS (
      SELECT 1 FROM players p
      WHERE p.id = p_player_id
        AND CASE WHEN p.date_of_birth IS NOT NULL
              THEN extract(year FROM (now() AT TIME ZONE 'Pacific/Auckland')) - extract(year FROM p.date_of_birth) <= 16
              ELSE p.division = 'Juniors' END
    )
    OR COALESCE((SELECT survey_consent FROM player_profile_private WHERE player_id = p_player_id), false)
$function$;
REVOKE EXECUTE ON FUNCTION public.survey_allowed(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.survey_allowed(uuid) TO authenticated;

DROP POLICY IF EXISTS wellbeing_insert_own ON public.wellbeing_surveys;
CREATE POLICY wellbeing_insert_own ON public.wellbeing_surveys
  FOR INSERT WITH CHECK (
    (auth.uid() = player_id
     OR EXISTS (SELECT 1 FROM players p WHERE p.id = player_id AND p.parent_id = auth.uid()))
    AND public.survey_allowed(player_id)
  );

-- ── 5. The programme on each check-in ────────────────────────────────────────
-- Set by the server, never by the client: the programme of the funded game the
-- player last played in the last 120 days, else of a game they are registered
-- to, else none.
ALTER TABLE public.wellbeing_surveys
  ADD COLUMN programme_id uuid REFERENCES public.programmes(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION public.stamp_survey_programme()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  NEW.programme_id := COALESCE(
    (SELECT w.programme_id
       FROM session_player_summary s
       JOIN sessions se ON se.id = s.session_id
       JOIN weekly_games w ON w.id = se.weekly_game_id
      WHERE s.player_id = NEW.player_id AND w.programme_id IS NOT NULL
        AND se.voided_at IS NULL AND se.started_at > now() - interval '120 days'
      ORDER BY se.started_at DESC LIMIT 1),
    (SELECT w.programme_id
       FROM weekly_game_members m
       JOIN weekly_games w ON w.id = m.weekly_game_id
      WHERE m.player_id = NEW.player_id AND m.left_at IS NULL
        AND w.programme_id IS NOT NULL AND w.is_active
      ORDER BY m.joined_at DESC LIMIT 1)
  );
  RETURN NEW;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.stamp_survey_programme() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER wellbeing_surveys_programme
  BEFORE INSERT OR UPDATE OF programme_id ON public.wellbeing_surveys
  FOR EACH ROW EXECUTE FUNCTION public.stamp_survey_programme();

-- ── 6. Erasure takes the private profile ─────────────────────────────────────
-- Redefined from the live definition (20260922213125) with one delete added,
-- and the results updates let past the finished-game guard (see below).
-- Erasure ANONYMISES the players row, so the ON DELETE CASCADE above never
-- fires. Keeping ethnicity and deprivation band unlinked after erasure is the
-- second release (plan step 15); until then they go with the rest.
CREATE OR REPLACE FUNCTION public.delete_my_account(p_player_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- ADDED 20261123230958: ethnicity, suburb, school, disability and consent.
  DELETE FROM player_profile_private WHERE player_id = v_target;

  -- ADDED 20260915051927: an exemption's reason can be medical, so it goes
  -- with the rest of the health information.
  DELETE FROM grade_exemptions WHERE player_id = v_target;

  -- ADDED 20260915214702: a training log records where and when someone
  -- trained, and unlike a game result it is not part of anyone else's
  -- competition record. The entries go with it (ON DELETE CASCADE).
  DELETE FROM workouts WHERE player_id = v_target;

  -- ADDED 20260922213125: dated bodyweights are health information and /privacy
  -- promises they go with the account. The table's ON DELETE CASCADE never
  -- fires here, because erasure ANONYMISES the players row rather than deleting
  -- it, so the delete has to be explicit.
  DELETE FROM player_bodyweights WHERE player_id = v_target;

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

  -- ADDED 20261123230958: these two updates touch results in finished games,
  -- which guard_results_write refuses to a player ("session has ended"), so
  -- until now erasure failed for anyone who had played (found in this
  -- migration's rehearsal, 24 Nov 2026). The same transaction-local flag
  -- close_expired_sessions uses (20260824220633): unreachable from the API,
  -- and switched off again straight after.
  PERFORM set_config('allsport.server_write', 'on', true);

  -- The name a kaiwhakawā typed onto a score row is a second copy of it.
  UPDATE results SET player_name = 'Former player'
  WHERE player_id = v_target;

  -- Being named as somebody's opponent is their record of a match, but the
  -- string is this player's name. Scrub the copies; exact match only.
  IF v_names IS NOT NULL AND array_length(v_names, 1) > 0 THEN
    UPDATE results SET opponent_name = 'Former player'
    WHERE opponent_name = ANY (v_names);
  END IF;

  PERFORM set_config('allsport.server_write', 'off', true);
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_my_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(uuid) TO authenticated;

-- ── 7. Check ─────────────────────────────────────────────────────────────────
DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.player_profile_private'::regclass) THEN
    RAISE EXCEPTION 'signup survey check: RLS is off';
  END IF;
  IF has_table_privilege('authenticated', 'public.player_profile_private', 'INSERT')
     OR has_table_privilege('authenticated', 'public.player_profile_private', 'UPDATE')
     OR has_table_privilege('anon', 'public.player_profile_private', 'SELECT') THEN
    RAISE EXCEPTION 'signup survey check: the private profile is open';
  END IF;
  IF has_function_privilege('anon', 'public.save_private_profile(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'signup survey check: anon can write a profile';
  END IF;
  IF position('player_profile_private' IN pg_get_functiondef('public.delete_my_account(uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'signup survey check: erasure keeps the profile';
  END IF;
  RAISE NOTICE 'signup survey: ready';
END
$check$;
