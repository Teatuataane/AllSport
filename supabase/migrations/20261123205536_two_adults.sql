-- ─── Two adults and young Kaiako (multi-location PR 7b) ──────────────────────
-- MULTI_LOCATION_PLAN.md §2, agreed with Tāne 23 Nov 2026:
--
--   * TWO-ADULT RULE (weekly_games.two_adults, on for Burnside): the game
--     cannot start until a second adult is recorded for that date: a
--     Kaiārahi of any level, or a named helper from the host (a teacher) with
--     no account. Stored as the game_roster row with role 'second'.
--   * KAIAKO FROM AGE 16. A Kaiako under 18 can only start a game with an
--     adult (18 or over) recorded as the second: a Kaiārahi whose date of
--     birth says 18+, or a helper the Kaiārahi confirms is 18 or over.
--   * The parent-present rule for juniors is NOT enforced (Tāne, 24 Nov 2026:
--     "Let the juniors play, they will almost always just use their parents
--     phones"). The app reminds the Kaiako instead.
--
-- Both start rules are checked when the session is inserted, by a trigger that
-- sorts after session_zz_runner_guard (which stamps judge_id) and after
-- session_date_follows_started_at (which sets session_date). They apply to
-- every level: the second adult is a safety rule, not a permission.

-- ── 1. A helper's age is confirmed, not known ────────────────────────────────
ALTER TABLE public.game_roster
  ADD COLUMN helper_adult boolean NOT NULL DEFAULT false,
  -- A second is a Kaiārahi or a named helper, never both or neither.
  ADD CONSTRAINT game_roster_second_is_someone CHECK (
    role <> 'second' OR ((player_id IS NULL) <> (helper_name IS NULL))
  ),
  ADD CONSTRAINT game_roster_second_status CHECK (role <> 'second' OR status = 'rostered');

-- Age in whole years today (NZ). Null when the date of birth is unknown.
CREATE OR REPLACE FUNCTION public.age_today(p_player_id uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT date_part('year', age((now() AT TIME ZONE 'Pacific/Auckland')::date, p.date_of_birth))::int
  FROM players p WHERE p.id = p_player_id;
$function$;

-- Is the recorded second for this game and date an adult?
CREATE OR REPLACE FUNCTION public.second_is_adult(p_game_id uuid, p_date date)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT COALESCE((
    SELECT CASE WHEN r.player_id IS NOT NULL THEN COALESCE(public.age_today(r.player_id) >= 18, false)
                ELSE r.helper_adult END
    FROM game_roster r
    WHERE r.weekly_game_id = p_game_id AND r.game_date = p_date AND r.role = 'second'
  ), false);
$function$;

-- ── 2. Recording the second adult ────────────────────────────────────────────
-- The lead of that date, the game's manager, or a Kaiwhakawā. A Kaiārahi
-- second must be a current Kaiārahi; a helper needs a name.
CREATE OR REPLACE FUNCTION public.set_second_adult(
  p_game_id uuid, p_date date, p_player_id uuid, p_helper_name text, p_helper_adult boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_name text := NULLIF(btrim(p_helper_name), '');
BEGIN
  IF NOT (public.is_judge() OR public.manages_game(p_game_id)
          OR (public.is_kaiarahi() AND public.rostered_lead(p_game_id, p_date) = auth.uid())) THEN
    RAISE EXCEPTION 'roster: only the Kaiārahi running this game records its second adult' USING ERRCODE = '42501';
  END IF;
  IF p_date < (now() AT TIME ZONE 'Pacific/Auckland')::date THEN
    RAISE EXCEPTION 'roster: that date has passed' USING ERRCODE = '22023';
  END IF;
  IF (p_player_id IS NULL) = (v_name IS NULL) THEN
    RAISE EXCEPTION 'roster: name a Kaiārahi or a helper' USING ERRCODE = '22023';
  END IF;
  IF p_player_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM kaiarahi WHERE player_id = p_player_id AND suspended_at IS NULL
  ) THEN
    RAISE EXCEPTION 'roster: that person is not a Kaiārahi' USING ERRCODE = '22023';
  END IF;
  IF p_player_id IS NOT NULL AND p_player_id = public.rostered_lead(p_game_id, p_date) THEN
    RAISE EXCEPTION 'roster: the second adult cannot be the one running the game' USING ERRCODE = '22023';
  END IF;
  INSERT INTO game_roster (weekly_game_id, game_date, role, player_id, helper_name, helper_adult, status, created_by)
  VALUES (p_game_id, p_date, 'second', p_player_id, v_name, COALESCE(p_helper_adult, false) AND v_name IS NOT NULL,
          'rostered', auth.uid())
  ON CONFLICT (weekly_game_id, game_date, role) DO UPDATE
    SET player_id = EXCLUDED.player_id, helper_name = EXCLUDED.helper_name,
        helper_adult = EXCLUDED.helper_adult, updated_at = now();
END
$function$;

CREATE OR REPLACE FUNCTION public.clear_second_adult(p_game_id uuid, p_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.is_judge() OR public.manages_game(p_game_id)
          OR (public.is_kaiarahi() AND public.rostered_lead(p_game_id, p_date) = auth.uid())) THEN
    RAISE EXCEPTION 'roster: only the Kaiārahi running this game records its second adult' USING ERRCODE = '42501';
  END IF;
  DELETE FROM game_roster WHERE weekly_game_id = p_game_id AND game_date = p_date AND role = 'second';
END
$function$;

REVOKE EXECUTE ON FUNCTION public.age_today(uuid), public.second_is_adult(uuid, date),
  public.set_second_adult(uuid, date, uuid, text, boolean), public.clear_second_adult(uuid, date)
  FROM PUBLIC, anon;
-- age_today and second_is_adult are for the definer functions below only: a
-- player's age is private, and so is whether they are 18.
GRANT EXECUTE ON FUNCTION public.set_second_adult(uuid, date, uuid, text, boolean), public.clear_second_adult(uuid, date)
  TO authenticated;
REVOKE EXECUTE ON FUNCTION public.age_today(uuid), public.second_is_adult(uuid, date) FROM authenticated;

-- ── 3. Starting a game ───────────────────────────────────────────────────────
-- Why the CALLER may not start this game on this date yet, or null. Definer,
-- so it can read ages, but it only ever answers about auth.uid(): nobody learns
-- another person's age from it. New Game asks it first; the trigger enforces it.
CREATE OR REPLACE FUNCTION public.session_start_blocker(p_game_id uuid, p_date date)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_two   boolean;
  v_level text;
  v_age   integer;
BEGIN
  IF auth.uid() IS NULL OR p_game_id IS NULL THEN RETURN NULL; END IF;
  SELECT two_adults INTO v_two FROM weekly_games WHERE id = p_game_id;
  IF v_two AND NOT EXISTS (
    SELECT 1 FROM game_roster WHERE weekly_game_id = p_game_id AND game_date = p_date AND role = 'second'
  ) THEN
    RETURN 'two_adults';
  END IF;
  SELECT level INTO v_level FROM kaiarahi WHERE player_id = auth.uid() AND suspended_at IS NULL;
  IF v_level = 'community' THEN
    v_age := public.age_today(auth.uid());
    IF v_age IS NOT NULL AND v_age < 18 AND NOT public.second_is_adult(p_game_id, p_date) THEN
      RETURN 'young_kaiako';
    END IF;
  END IF;
  RETURN NULL;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.session_start_blocker(uuid, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.session_start_blocker(uuid, date) TO authenticated;

-- INVOKER, tests current_user: server code and migrations pass. The session's
-- runner is the caller (session_zz_runner_guard stamps judge_id = auth.uid()).
CREATE OR REPLACE FUNCTION public.guard_session_adults()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_why text;
BEGIN
  IF current_user <> 'authenticated' OR NEW.weekly_game_id IS NULL THEN RETURN NEW; END IF;
  v_why := public.session_start_blocker(NEW.weekly_game_id, NEW.session_date);
  IF v_why = 'two_adults' THEN
    RAISE EXCEPTION 'sessions: this game needs a second adult before it starts' USING ERRCODE = '23514';
  ELSIF v_why = 'young_kaiako' THEN
    RAISE EXCEPTION 'sessions: a Kaiako under 18 needs an adult (18 or over) as the second adult' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

-- 'session_zzz' sorts after 'session_zz_runner_guard', which stamps judge_id.
CREATE TRIGGER session_zzz_adults_guard
  BEFORE INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_adults();

-- ── 4. Kaiako from age 16 ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_kaiarahi_age()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  v_age integer;
BEGIN
  IF NEW.suspended_at IS NOT NULL THEN RETURN NEW; END IF;
  v_age := public.age_today(NEW.player_id);
  IF v_age IS NOT NULL AND v_age < 16 THEN
    RAISE EXCEPTION 'kaiarahi: a Kaiārahi must be 16 or over' USING ERRCODE = '23514';
  END IF;
  IF v_age IS NOT NULL AND v_age < 18 AND NEW.level <> 'community' THEN
    RAISE EXCEPTION 'kaiarahi: a Kaimahi or Kaiwhakawā must be 18 or over' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER kaiarahi_age_guard
  BEFORE INSERT OR UPDATE OF level, suspended_at ON public.kaiarahi
  FOR EACH ROW EXECUTE FUNCTION public.guard_kaiarahi_age();

-- ── 5. Check ─────────────────────────────────────────────────────────────────
DO $check$
BEGIN
  IF has_function_privilege('authenticated', 'public.age_today(uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.second_is_adult(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'two adults check: players can read anyone''s age';
  END IF;
  IF EXISTS (SELECT 1 FROM kaiarahi k WHERE k.suspended_at IS NULL AND public.age_today(k.player_id) < 16) THEN
    RAISE EXCEPTION 'two adults check: a current Kaiārahi is under 16';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'session_zzz_adults_guard') THEN
    RAISE EXCEPTION 'two adults check: start guard missing';
  END IF;
  RAISE NOTICE 'two adults: ready';
END
$check$;
