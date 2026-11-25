-- ─── Former players: what erasure keeps, and the sign-in it now removes ──────
-- Multi-location games step 15 (v0.74.0.0). Tāne, 26 Nov 2026.
--
-- Erasure already kept attendance: delete_my_account blanks the players row
-- and leaves its results under "Former player", because removing them would
-- change where other players finished. What it lost was the reach detail the
-- funder reports count by (birth date, sex, ethnicity, suburb), so an erased
-- player turned into "Unknown". And it never removed the Supabase sign-in, so
-- the email stayed in auth.users under the same id, while /privacy says the
-- details are destroyed for good.
--
-- Now, before anything is wiped:
--   · former_player_games: the age BAND they were in on the day of each game
--     they played (5-11, 12-17, …), so past reports do not shift;
--   · former_players: sex, Stats NZ level 1 ethnic groups (total response) and
--     the deprivation QUINTILE of their suburb. Never the suburb, the specific
--     ethnicity ticks, the birth date or any wellbeing answer.
-- Both are read by a Kaiwhakawā only, never written by a client.
--
-- Erasing your own account now also:
--   · erases every child profile you manage (they have no sign-in of their own,
--     so nobody could reach them afterwards);
--   · deletes your sign-in (auth.users), which takes the email with it;
--   · keeps your event-vote answers counting, with no player attached, and a
--     koha donation's amount, with no donor attached.
-- Erasing a child profile alone is unchanged, apart from keeping its bands.

-- ── 1. What stays ────────────────────────────────────────────────────────────
CREATE TABLE public.former_players (
  player_id     uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  sex           text CHECK (sex IN ('Female', 'Male', 'Other')),
  ethnic_groups text[] NOT NULL,
  quintile      smallint CHECK (quintile BETWEEN 1 AND 5)
);

CREATE TABLE public.former_player_games (
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  age_band   text NOT NULL CHECK (age_band IN ('5-11', '12-17', '18-24', '25-44', '45-64', '65+', 'Unknown')),
  PRIMARY KEY (player_id, session_id)
);

ALTER TABLE public.former_players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.former_player_games ENABLE ROW LEVEL SECURITY;
CREATE POLICY former_players_head ON public.former_players FOR SELECT TO authenticated USING (public.is_judge());
CREATE POLICY former_player_games_head ON public.former_player_games FOR SELECT TO authenticated USING (public.is_judge());
REVOKE ALL ON public.former_players, public.former_player_games FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.former_players, public.former_player_games FROM authenticated;

-- ── 2. The bands (mirrors of lib/successMeasures.ts, pinned by a test) ───────
-- ageBand(): under 5 or no birth date is Unknown.
CREATE OR REPLACE FUNCTION public.former_age_band(p_age int)
 RETURNS text
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $$
  SELECT CASE
    WHEN p_age IS NULL OR p_age < 5 THEN 'Unknown'
    WHEN p_age <= 11 THEN '5-11'
    WHEN p_age <= 17 THEN '12-17'
    WHEN p_age <= 24 THEN '18-24'
    WHEN p_age <= 44 THEN '25-44'
    WHEN p_age <= 64 THEN '45-64'
    ELSE '65+'
  END
$$;

-- ethnicGroups(): level 1 groups in ETHNIC_GROUPS order; nothing ticked is
-- Not stated; a tick we do not know is Other.
CREATE OR REPLACE FUNCTION public.former_ethnic_groups(p_ticked text[])
 RETURNS text[]
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $$
  WITH g AS (
    SELECT DISTINCT CASE t
      WHEN 'nz_european' THEN 'European'
      WHEN 'maori' THEN 'Māori'
      WHEN 'samoan' THEN 'Pacific'
      WHEN 'cook_islands_maori' THEN 'Pacific'
      WHEN 'tongan' THEN 'Pacific'
      WHEN 'niuean' THEN 'Pacific'
      WHEN 'chinese' THEN 'Asian'
      WHEN 'indian' THEN 'Asian'
      WHEN 'other' THEN 'Other'
      WHEN 'prefer_not' THEN 'Not stated'
      ELSE 'Other'
    END AS grp
    FROM unnest(coalesce(p_ticked, '{}'::text[])) t
  )
  SELECT coalesce(
    (SELECT array_agg(o ORDER BY n) FROM unnest(ARRAY['European', 'Māori', 'Pacific', 'Asian', 'Other', 'Not stated'])
       WITH ORDINALITY u(o, n) WHERE o IN (SELECT grp FROM g)),
    ARRAY['Not stated'])
$$;

REVOKE ALL ON FUNCTION public.former_age_band(int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.former_ethnic_groups(text[]) FROM PUBLIC, anon, authenticated;

-- ── 3. Links to the sign-in that must survive its deletion ───────────────────
-- A vote answer still counts, a donation's amount stays, and a vote or
-- donation someone recorded stays; each loses only the person.
ALTER TABLE public.event_vote_responses ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE public.event_vote_responses DROP CONSTRAINT event_vote_responses_player_id_fkey,
  ADD CONSTRAINT event_vote_responses_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.event_votes DROP CONSTRAINT event_votes_created_by_fkey,
  ADD CONSTRAINT event_votes_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.koha_donations ALTER COLUMN player_id DROP NOT NULL;
ALTER TABLE public.koha_donations DROP CONSTRAINT koha_donations_player_id_fkey,
  ADD CONSTRAINT koha_donations_player_id_fkey FOREIGN KEY (player_id) REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.koha_donations DROP CONSTRAINT koha_donations_recorded_by_fkey,
  ADD CONSTRAINT koha_donations_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;
-- players.parent_id pointed at auth.users, so a parent's sign-in could not go
-- while any child row named it. It now points at the parent's PLAYERS row,
-- which erasure keeps (as "Former player"), so an erased family stays a family
-- of erased rows. Every parent is a player (its id is the sign-in's id), which
-- the constraint checks as it is added. guard_players_privileged_columns
-- refuses any change to parent_id from a player's call, so erasure must not
-- (and does not) rewrite it.
ALTER TABLE public.players DROP CONSTRAINT players_parent_id_fkey,
  ADD CONSTRAINT players_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.players(id);

-- ── 4. Erasure ───────────────────────────────────────────────────────────────
-- Redefined whole from its live definition (20261123230958). Every earlier
-- step is kept; the body now runs once per target (the children first, then
-- you), and the ADDED 20261125231115 lines are new.
CREATE OR REPLACE FUNCTION public.delete_my_account(p_player_id uuid DEFAULT NULL::uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_self    BOOLEAN;
  v_targets UUID[];
  v_target  UUID;
  v_names   TEXT[];
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

  -- ADDED 20261125231115: erasing yourself erases the children you manage
  -- first. They have no sign-in of their own; once yours is gone nobody could
  -- reach them (Tāne, 26 Nov 2026).
  v_self := v_target = auth.uid();
  v_targets := CASE WHEN v_self
    THEN ARRAY(SELECT id FROM players WHERE parent_id = auth.uid() ORDER BY id) || v_target
    ELSE ARRAY[v_target] END;

  FOREACH v_target IN ARRAY v_targets LOOP
  -- ADDED 20261125231115: keep only the bands, before anything is wiped. The
  -- age band on the day of each game played, so past reports do not shift.
  -- ON CONFLICT: a second erasure must not overwrite them with Unknown.
  INSERT INTO former_players (player_id, sex, ethnic_groups, quintile)
  SELECT p.id,
         CASE WHEN p.gender IN ('Female', 'Male', 'Other') THEN p.gender END,
         former_ethnic_groups(pp.ethnicity),
         CASE WHEN s.nzdep BETWEEN 1 AND 10 THEN ceil(s.nzdep / 2.0)::smallint END
  FROM players p
  LEFT JOIN player_profile_private pp ON pp.player_id = p.id
  LEFT JOIN nz_suburbs s ON s.id = pp.suburb_id
  WHERE p.id = v_target
  ON CONFLICT (player_id) DO NOTHING;

  INSERT INTO former_player_games (player_id, session_id, age_band)
  SELECT DISTINCT r.player_id, r.session_id,
         former_age_band(date_part('year', age(se.session_date, p.date_of_birth))::int)
  FROM results r
  JOIN sessions se ON se.id = r.session_id
  JOIN players p ON p.id = r.player_id
  WHERE r.player_id = v_target
  ON CONFLICT (player_id, session_id) DO NOTHING;

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
  END LOOP;

  -- ADDED 20261125231115: your sign-in goes too, and the email with it. The
  -- children's parent_id now points at your (erased) players row, not at the
  -- sign-in; vote answers and koha keep their numbers with no person (ON
  -- DELETE SET NULL above). A child erased on its own has no sign-in.
  IF v_self THEN
    DELETE FROM auth.users WHERE id = auth.uid();
  END IF;
END;
$function$;
REVOKE ALL ON FUNCTION public.delete_my_account(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(uuid) TO authenticated;

-- ── 5. Check ─────────────────────────────────────────────────────────────────
DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.former_players'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.former_player_games'::regclass) THEN
    RAISE EXCEPTION 'former players check: RLS is off';
  END IF;
  IF has_table_privilege('anon', 'public.former_players', 'SELECT')
     OR has_table_privilege('authenticated', 'public.former_players', 'INSERT')
     OR has_table_privilege('authenticated', 'public.former_player_games', 'INSERT') THEN
    RAISE EXCEPTION 'former players check: the tables are open';
  END IF;
  IF has_function_privilege('authenticated', 'public.former_ethnic_groups(text[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'former players check: a band helper is callable';
  END IF;
  IF public.former_ethnic_groups(ARRAY['tongan', 'maori', 'samoan']) <> ARRAY['Māori', 'Pacific']
     OR public.former_ethnic_groups(NULL) <> ARRAY['Not stated']
     OR public.former_age_band(12) <> '12-17' OR public.former_age_band(NULL) <> 'Unknown' THEN
    RAISE EXCEPTION 'former players check: the bands are wrong';
  END IF;
  IF position('auth.users' IN pg_get_functiondef('public.delete_my_account(uuid)'::regprocedure)) = 0
     OR position('former_player_games' IN pg_get_functiondef('public.delete_my_account(uuid)'::regprocedure)) = 0 THEN
    RAISE EXCEPTION 'former players check: erasure keeps the sign-in or loses the bands';
  END IF;
  IF (SELECT confrelid FROM pg_constraint WHERE conname = 'players_parent_id_fkey') <> 'public.players'::regclass THEN
    RAISE EXCEPTION 'former players check: parent_id still points at the sign-in';
  END IF;
  RAISE NOTICE 'former players: ready';
END
$check$;
