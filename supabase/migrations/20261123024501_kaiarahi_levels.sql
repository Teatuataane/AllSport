-- ─── Kaiārahi levels (multi-location games, PR 1 of the first release) ─────
-- MULTI_LOCATION_PLAN.md §2 "People", agreed with Tāne 23 Nov 2026.
--
-- Until now one switch, players.role = 'judge', gave a person every power in
-- the country. AllSport is about to hire staff and train community leaders, so
-- powers split three ways (display names are labels; the database stores):
--
--   head       Kaiwhakawā  head staff: everything, as a judge could before
--   staff      Kaimahi     paid staff: run the games they are running
--   community  Kaiako      weekend course: run the games they are running
--
-- Two rules carry the whole change:
--
--   1. is_judge() now means a current HEAD (a kaiarahi row, level 'head', not
--      suspended). Every power that is not about running a game (players'
--      private details, division and date of birth, exemptions, disputes,
--      colour admin, koha, partners, referrals, votes, the wellbeing report,
--      sites, weekly games, notices, voiding) stays behind it. Tāne, 23 Nov:
--      Kaimahi do not see players' contact details; voiding is Kaiwhakawā only;
--      exemptions stay Kaiwhakawā only ("no score is the same thing").
--
--   2. runs_session(id) is true for a head, or for an active Kaiārahi of any
--      level who is the session's judge_id. Only the rules about RUNNING a game
--      are widened to it: the session and its events, results and guests, the
--      session summary, matches, mixed contests, safe opponents, adds at a
--      game, and the weigh-in on the scoring screen.
--
-- Every existing judge becomes a head, so on the day this is applied nothing
-- changes for anyone. players.role stays (it is pinned and still read for
-- display until the app moves to the kaiarahi row) but no longer grants
-- anything: every policy and function that read role = 'judge' is redefined
-- here to read the kaiarahi row instead.
--
-- Function bodies below are the LIVE definitions (pg_get_functiondef, read 23
-- Nov 2026) with exact one-line changes, not reconstructions from older files.
--
-- Apply AFTER the app that reads kaiarahi is deployed (CLAUDE.md §12): the
-- current app reads players.role, which this leaves in place, so either order
-- is safe for the one existing judge; deploy first anyway.

BEGIN;

-- ── 1. The kaiarahi row ────────────────────────────────────────────────────
CREATE TABLE public.kaiarahi (
  player_id         uuid PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  level             text NOT NULL CHECK (level IN ('head', 'staff', 'community')),
  granted_at        timestamptz NOT NULL DEFAULT now(),
  granted_by        uuid REFERENCES public.players(id) ON DELETE SET NULL,
  -- How they qualified: 'hired', a course name and date, 'founder'.
  qualified_via     text CHECK (qualified_via IS NULL OR length(qualified_via) <= 120),
  -- Kaimahi and Kaiwhakawā: the expiry dates only, never the vetting result.
  -- Not enforced yet: funded games, which need them current, come in PR 2.
  vetting_expires   date,
  first_aid_expires date,
  suspended_at      timestamptz,
  suspended_reason  text CHECK (suspended_reason IS NULL OR length(suspended_reason) <= 280),
  CONSTRAINT kaiarahi_suspension_has_reason
    CHECK (suspended_at IS NULL OR length(btrim(coalesce(suspended_reason, ''))) > 0)
);

ALTER TABLE public.kaiarahi ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kaiarahi FROM anon;
GRANT SELECT ON public.kaiarahi TO authenticated;

-- Every write goes through the head-only functions in section 3.
CREATE POLICY kaiarahi_select_own ON public.kaiarahi
  FOR SELECT TO authenticated USING (player_id = auth.uid());

-- Every existing judge becomes a head: nothing changes on the day.
INSERT INTO public.kaiarahi (player_id, level, qualified_via)
SELECT id, 'head', 'founder' FROM public.players WHERE role = 'judge'
ON CONFLICT (player_id) DO NOTHING;

-- ── 2. Who holds what ──────────────────────────────────────────────────────
-- is_judge() keeps its name because about fifty policies and functions call it;
-- it now means a current head.
CREATE OR REPLACE FUNCTION public.is_judge()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM kaiarahi
    WHERE player_id = auth.uid() AND level = 'head' AND suspended_at IS NULL
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_head()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_judge();
$function$;

-- Any level, not suspended.
CREATE OR REPLACE FUNCTION public.is_kaiarahi()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM kaiarahi WHERE player_id = auth.uid() AND suspended_at IS NULL
  );
$function$;

-- A head, or the active Kaiārahi whose game it is. True after the game closes
-- too, so the one who ran it can still correct it (the Judge Summary tab);
-- voiding stays head-only (section 5).
CREATE OR REPLACE FUNCTION public.runs_session(p_session_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_judge()
    OR (public.is_kaiarahi() AND EXISTS (
      SELECT 1 FROM sessions s WHERE s.id = p_session_id AND s.judge_id = auth.uid()
    ))
  );
$function$;

-- Running a game that is open right now (for the weigh-in, which names a
-- player, not a session).
CREATE OR REPLACE FUNCTION public.runs_open_session()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND public.is_kaiarahi() AND EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.judge_id = auth.uid() AND s.is_active AND s.voided_at IS NULL
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.is_head(), public.is_kaiarahi(),
  public.runs_session(uuid), public.runs_open_session() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_head(), public.is_kaiarahi(),
  public.runs_session(uuid), public.runs_open_session() TO authenticated;

-- ── 3. Granting, checks and suspending (heads only) ────────────────────────
CREATE OR REPLACE FUNCTION public.kaiarahi_list()
 RETURNS TABLE (player_id uuid, level text, granted_at timestamptz, qualified_via text,
                vetting_expires date, first_aid_expires date,
                suspended_at timestamptz, suspended_reason text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'kaiarahi_list: Kaiwhakawā only' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT k.player_id, k.level, k.granted_at, k.qualified_via, k.vetting_expires,
           k.first_aid_expires, k.suspended_at, k.suspended_reason
    FROM kaiarahi k ORDER BY k.level, k.granted_at;
END
$function$;

-- Refuses anything that would leave no active head: nobody could then grant
-- a level again without the service key.
CREATE OR REPLACE FUNCTION public.kaiarahi_heads_left(p_without uuid)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT count(*)::int FROM kaiarahi
  WHERE level = 'head' AND suspended_at IS NULL AND player_id <> p_without;
$function$;
REVOKE EXECUTE ON FUNCTION public.kaiarahi_heads_left(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.grant_kaiarahi(p_player_id uuid, p_level text, p_qualified_via text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'grant_kaiarahi: Kaiwhakawā only' USING ERRCODE = '42501';
  END IF;
  IF p_level NOT IN ('head', 'staff', 'community') THEN
    RAISE EXCEPTION 'grant_kaiarahi: unknown level %', p_level USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND NOT COALESCE(is_guest, false)) THEN
    RAISE EXCEPTION 'grant_kaiarahi: unknown player' USING ERRCODE = 'P0002';
  END IF;
  IF p_level <> 'head' AND public.kaiarahi_heads_left(p_player_id) = 0 THEN
    RAISE EXCEPTION 'grant_kaiarahi: that would leave no Kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  -- Granting again clears a suspension and keeps the check dates.
  INSERT INTO kaiarahi (player_id, level, granted_by, qualified_via)
  VALUES (p_player_id, p_level, auth.uid(), NULLIF(btrim(p_qualified_via), ''))
  ON CONFLICT (player_id) DO UPDATE
    SET level = EXCLUDED.level, granted_at = now(), granted_by = EXCLUDED.granted_by,
        qualified_via = COALESCE(EXCLUDED.qualified_via, kaiarahi.qualified_via),
        suspended_at = NULL, suspended_reason = NULL;
END
$function$;

CREATE OR REPLACE FUNCTION public.set_kaiarahi_checks(p_player_id uuid, p_vetting_expires date, p_first_aid_expires date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'set_kaiarahi_checks: Kaiwhakawā only' USING ERRCODE = '42501';
  END IF;
  UPDATE kaiarahi SET vetting_expires = p_vetting_expires, first_aid_expires = p_first_aid_expires
  WHERE player_id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'set_kaiarahi_checks: not a Kaiārahi' USING ERRCODE = 'P0002';
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.suspend_kaiarahi(p_player_id uuid, p_reason text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'suspend_kaiarahi: Kaiwhakawā only' USING ERRCODE = '42501';
  END IF;
  IF length(btrim(coalesce(p_reason, ''))) = 0 THEN
    RAISE EXCEPTION 'suspend_kaiarahi: a reason is needed' USING ERRCODE = '22023';
  END IF;
  IF public.kaiarahi_heads_left(p_player_id) = 0 THEN
    RAISE EXCEPTION 'suspend_kaiarahi: that would leave no Kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  UPDATE kaiarahi SET suspended_at = now(), suspended_reason = btrim(p_reason)
  WHERE player_id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'suspend_kaiarahi: not a Kaiārahi' USING ERRCODE = 'P0002';
  END IF;
END
$function$;

CREATE OR REPLACE FUNCTION public.remove_kaiarahi(p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'remove_kaiarahi: Kaiwhakawā only' USING ERRCODE = '42501';
  END IF;
  IF public.kaiarahi_heads_left(p_player_id) = 0 THEN
    RAISE EXCEPTION 'remove_kaiarahi: that would leave no Kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  DELETE FROM kaiarahi WHERE player_id = p_player_id;
END
$function$;

REVOKE EXECUTE ON FUNCTION public.kaiarahi_list(), public.grant_kaiarahi(uuid, text, text),
  public.set_kaiarahi_checks(uuid, date, date), public.suspend_kaiarahi(uuid, text),
  public.remove_kaiarahi(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.kaiarahi_list(), public.grant_kaiarahi(uuid, text, text),
  public.set_kaiarahi_checks(uuid, date, date), public.suspend_kaiarahi(uuid, text),
  public.remove_kaiarahi(uuid) TO authenticated;

-- ── 4. Sessions: who started it, and who may void it ───────────────────────
-- The app never set judge_id. From now on the server does: the one who starts
-- a game runs it. A head may name someone else.
CREATE OR REPLACE FUNCTION public.stamp_session_runner()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'authenticated' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.judge_id IS NULL OR NOT public.is_judge() THEN
        NEW.judge_id := auth.uid();
      END IF;
    ELSIF NOT public.is_judge() THEN
      -- Tāne, 23 Nov 2026: voiding is Kaiwhakawā only. mark_session_voided
      -- (session_void_recorded, which sorts first) has already stamped
      -- voided_at on a void by this point.
      IF NEW.voided_at IS DISTINCT FROM OLD.voided_at
         OR NEW.voided_by IS DISTINCT FROM OLD.voided_by THEN
        RAISE EXCEPTION 'sessions: only a Kaiwhakawā can void a game' USING ERRCODE = '42501';
      END IF;
      IF NEW.judge_id IS DISTINCT FROM OLD.judge_id THEN
        RAISE EXCEPTION 'sessions: only a Kaiwhakawā can hand a game to someone else' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

-- Named to sort after session_void_recorded (BEFORE triggers fire by name).
CREATE TRIGGER session_zz_runner_guard
  BEFORE INSERT OR UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.stamp_session_runner();

-- ── 5. Policies ────────────────────────────────────────────────────────────
-- Running a game: widened from "judge" to runs_session.
DROP POLICY sessions_insert_judge ON public.sessions;
CREATE POLICY sessions_insert_judge ON public.sessions
  FOR INSERT WITH CHECK (public.is_kaiarahi());

DROP POLICY sessions_update_judge ON public.sessions;
CREATE POLICY sessions_update_judge ON public.sessions
  FOR UPDATE USING (public.runs_session(id));

-- Deleting a game outright is more than voiding it: heads only.
DROP POLICY sessions_delete_judge ON public.sessions;
CREATE POLICY sessions_delete_judge ON public.sessions
  FOR DELETE USING (public.is_judge());

DROP POLICY session_events_insert_judge ON public.session_events;
CREATE POLICY session_events_insert_judge ON public.session_events
  FOR INSERT WITH CHECK (public.runs_session(session_id));

DROP POLICY session_events_delete_judge ON public.session_events;
CREATE POLICY session_events_delete_judge ON public.session_events
  FOR DELETE USING (public.runs_session(session_id));

DROP POLICY results_insert_own ON public.results;
CREATE POLICY results_insert_own ON public.results
  FOR INSERT WITH CHECK ((auth.uid() IS NOT NULL) AND ((player_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = results.player_id) AND (players.parent_id = auth.uid())))) OR public.runs_session(session_id)));

DROP POLICY results_update_judge_own ON public.results;
CREATE POLICY results_update_judge_own ON public.results
  FOR UPDATE USING ((player_id = auth.uid()) OR public.runs_session(session_id));

DROP POLICY results_delete_judge_own ON public.results;
CREATE POLICY results_delete_judge_own ON public.results
  FOR DELETE USING (public.runs_session(session_id) OR (((player_id = auth.uid()) OR (EXISTS ( SELECT 1
   FROM players
  WHERE ((players.id = results.player_id) AND (players.parent_id = auth.uid()))))) AND (EXISTS ( SELECT 1
   FROM sessions s
  WHERE ((s.id = results.session_id) AND (s.is_active = true) AND (s.points_awarded_at IS NULL))))));

DROP POLICY sps_select_judge ON public.session_player_summary;
CREATE POLICY sps_select_judge ON public.session_player_summary
  FOR SELECT USING (public.runs_session(session_id));

DROP POLICY judges_insert_guest ON public.players;
CREATE POLICY judges_insert_guest ON public.players
  FOR INSERT WITH CHECK ((is_guest = true) AND public.is_kaiarahi());

-- Adds at a game (a workout linked to the session) made by whoever runs it.
CREATE POLICY workouts_by_game_runner ON public.workouts
  FOR ALL USING (session_id IS NOT NULL AND public.runs_session(session_id))
  WITH CHECK (session_id IS NOT NULL AND public.runs_session(session_id));

CREATE POLICY workout_entries_by_game_runner ON public.workout_entries
  FOR ALL USING (EXISTS (SELECT 1 FROM workouts w
    WHERE w.id = workout_entries.workout_id AND w.session_id IS NOT NULL AND public.runs_session(w.session_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM workouts w
    WHERE w.id = workout_entries.workout_id AND w.session_id IS NOT NULL AND public.runs_session(w.session_id)));

-- Head-only powers that read players.role directly: same rule, now is_judge().
DROP POLICY colour_awards_select_judge ON public.colour_awards;
CREATE POLICY colour_awards_select_judge ON public.colour_awards
  FOR SELECT USING (public.is_judge());

DROP POLICY event_vote_nominations_insert_judges ON public.event_vote_nominations;
CREATE POLICY event_vote_nominations_insert_judges ON public.event_vote_nominations
  FOR INSERT WITH CHECK (public.is_judge());

DROP POLICY event_vote_responses_select ON public.event_vote_responses;
CREATE POLICY event_vote_responses_select ON public.event_vote_responses
  FOR SELECT USING ((player_id = auth.uid()) OR (is_final = true) OR public.is_judge());

DROP POLICY event_votes_insert_judges ON public.event_votes;
CREATE POLICY event_votes_insert_judges ON public.event_votes
  FOR INSERT WITH CHECK (public.is_judge());

DROP POLICY event_votes_update_judges ON public.event_votes;
CREATE POLICY event_votes_update_judges ON public.event_votes
  FOR UPDATE USING (public.is_judge());

DROP POLICY koha_donations_judge_all ON public.koha_donations;
CREATE POLICY koha_donations_judge_all ON public.koha_donations
  FOR ALL USING (public.is_judge());

DROP POLICY partners_judge_write ON public.partners;
CREATE POLICY partners_judge_write ON public.partners
  FOR ALL USING (public.is_judge());

DROP POLICY referrals_read_judge ON public.referrals;
CREATE POLICY referrals_read_judge ON public.referrals
  FOR SELECT USING (public.is_judge());

-- A head sees every Kaiārahi row.
CREATE POLICY kaiarahi_select_head ON public.kaiarahi
  FOR SELECT TO authenticated USING (public.is_judge());

-- ── 6. Functions (live definitions, one change each) ───────────────────────
CREATE OR REPLACE FUNCTION public.guard_results_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_is_active   BOOLEAN;
  v_awarded_at  TIMESTAMPTZ;
BEGIN
  -- service_role / server-side job. Every results write policy requires
  -- auth.uid() IS NOT NULL, so anon never reaches this.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- The server closing a session on a player's behalf. See part 8 for why this
  -- exists and why a client cannot set it. Without it, close_expired_sessions()
  -- aborts for every logged-in non-judge caller.
  IF current_setting('allsport.server_write', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Kaiwhakawā need post-session edit and delete (Judge Summary tab), and the
  -- award trigger runs under their JWT.
  -- CHANGED 20261123024501: whoever runs this game, not only a head.
  IF public.runs_session(NEW.session_id) THEN
    RETURN NEW;
  END IF;

  SELECT s.is_active, s.points_awarded_at
    INTO v_is_active, v_awarded_at
  FROM sessions s
  WHERE s.id = NEW.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'results: unknown session %', NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_is_active, false) IS NOT TRUE THEN
    RAISE EXCEPTION
      'results: session % has ended — ask a kaiwhakawā to make the change',
      NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  IF v_awarded_at IS NOT NULL THEN
    RAISE EXCEPTION 'results: points already awarded for session %', NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    NEW.placement          := OLD.placement;
    NEW.placement_points   := OLD.placement_points;
    NEW.points_earned      := OLD.points_earned;
    NEW.bonus_points_total := OLD.bonus_points_total;
    NEW.event_placement    := OLD.event_placement;   -- NEW
    NEW.event_field_size   := OLD.event_field_size;  -- NEW
    NEW.player_id          := OLD.player_id;
    NEW.session_id         := OLD.session_id;
  ELSE
    NEW.placement          := NULL;
    NEW.placement_points   := NULL;
    NEW.points_earned      := NULL;
    NEW.bonus_points_total := 0;
    NEW.event_placement    := NULL;  -- NEW
    NEW.event_field_size   := NULL;  -- NEW
  END IF;

  NEW.effort_task_completions :=
    LEAST(GREATEST(COALESCE(NEW.effort_task_completions, 0), 0), 20);

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.set_contest_mixed(p_session_id uuid, p_event_name text, p_mixed boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.runs_session(p_session_id) THEN RAISE EXCEPTION 'kaiwhakawā only' USING ERRCODE = '42501'; END IF;
  UPDATE session_events SET contest_mixed = p_mixed
    WHERE session_id = p_session_id AND event_name = p_event_name AND contest_level(event_slug) IS NOT NULL;
END $function$;

CREATE OR REPLACE FUNCTION public.contest_safe_opponents(p_session_id uuid, p_event_name text, p_player_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE ev record; me record;
BEGIN
  -- COALESCE: can_log_for(NULL) is NULL, and IF NOT NULL would let it through.
  IF NOT COALESCE(public.can_log_for(p_player_id) OR public.runs_session(p_session_id), false) OR p_player_id IS NULL THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO ev FROM contest_event(p_session_id, p_event_name);
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT * INTO me FROM contest_profile(p_player_id, ev.day);
  RETURN jsonb_build_object(
    'level', ev.level,
    'mixed', ev.mixed,
    'needs_bodyweight', ev.level = 'contact' AND me.kg IS NULL,
    'safe', COALESCE((
      SELECT jsonb_agg(who.player_id ORDER BY who.player_id)
      FROM (SELECT DISTINCT r.player_id FROM results r
            WHERE r.session_id = p_session_id AND r.player_id IS NOT NULL) who
      WHERE contest_can_pair(p_player_id, who.player_id, ev.level, ev.mixed, ev.day)
    ), '[]'::jsonb));
END $function$;

CREATE OR REPLACE FUNCTION public.record_match(p_result_id uuid, p_opponent_ids uuid[], p_teammate_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_judge    boolean := public.is_judge();
  r          record;
  v_active   boolean;
  v_awarded  timestamptz;
  v_outcome  text;
  v_opp      uuid[];
  v_mates    uuid[];
  v_match    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_match: sign in to record a match' USING ERRCODE = '42501';
  END IF;

  SELECT res.id, res.session_id, res.event_id, res.player_id, res.result_type
    INTO r
  FROM results res
  WHERE res.id = p_result_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_match: unknown result %', p_result_id USING ERRCODE = 'P0002';
  END IF;

  -- A guest has no stable identity, so a guest's result cannot anchor a match.
  IF r.player_id IS NULL THEN
    RAISE EXCEPTION 'record_match: a guest result cannot be recorded as a match'
      USING ERRCODE = '22023';
  END IF;

  -- CHANGED 20261123024501: whoever runs this game has a judge's authority here.
  v_judge := v_judge OR public.runs_session(r.session_id);

  -- Same authority as writing the result itself (results_insert_own).
  IF NOT (
    r.player_id = v_uid
    OR EXISTS (SELECT 1 FROM players WHERE id = r.player_id AND parent_id = v_uid)
    OR v_judge
  ) THEN
    RAISE EXCEPTION 'record_match: that result belongs to someone else'
      USING ERRCODE = '42501';
  END IF;

  -- Same window as guard_results_write: an open session, unless kaiwhakawā.
  IF NOT v_judge THEN
    SELECT s.is_active, s.points_awarded_at INTO v_active, v_awarded
    FROM sessions s
    WHERE s.id = r.session_id;

    IF COALESCE(v_active, false) IS NOT TRUE OR v_awarded IS NOT NULL THEN
      RAISE EXCEPTION 'record_match: the session has ended — ask a kaiwhakawā'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- The outcome comes from the score, never from the caller.
  v_outcome := CASE r.result_type
    WHEN 'win'  THEN 'a'
    WHEN 'loss' THEN 'b'
    WHEN 'draw' THEN 'draw'
  END;

  -- Distinct, non-null, and never the result's own player.
  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_opp
  FROM unnest(COALESCE(p_opponent_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> r.player_id;

  SELECT COALESCE(array_agg(DISTINCT x), '{}') INTO v_mates
  FROM unnest(COALESCE(p_teammate_ids, '{}')) AS x
  WHERE x IS NOT NULL AND x <> r.player_id;

  IF v_opp && v_mates THEN
    RAISE EXCEPTION 'record_match: a player cannot be on both sides'
      USING ERRCODE = '22023';
  END IF;

  -- The match mirrors the result, so whatever was recorded for it goes first.
  -- If anything below raises, this DELETE is rolled back with it.
  DELETE FROM matches WHERE result_id = p_result_id;

  IF v_outcome IS NULL OR cardinality(v_opp) = 0 THEN
    RETURN NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(v_opp || v_mates) AS x
    WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = x)
  ) THEN
    RAISE EXCEPTION 'record_match: an opponent is not a registered player'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO matches (result_id, session_id, event_id, outcome, recorded_by)
  VALUES (p_result_id, r.session_id, r.event_id, v_outcome, v_uid)
  RETURNING id INTO v_match;

  INSERT INTO match_players (match_id, player_id, side)
  SELECT v_match, r.player_id, 'a'
  UNION ALL SELECT v_match, x, 'a' FROM unnest(v_mates) AS x
  UNION ALL SELECT v_match, x, 'b' FROM unnest(v_opp)   AS x;

  RETURN v_match;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_bodyweight(p_player_id uuid, p_kg numeric, p_measured_on date DEFAULT NULL::date)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_day date;
  v_id  uuid;
BEGIN
  -- CHANGED 20261123024501: or a Kaiārahi running an open game (the weigh-in
  -- on the scoring screen). Write only: nothing here reads another's weight.
  IF NOT (public.can_log_for(p_player_id) OR public.runs_open_session()) THEN
    RAISE EXCEPTION 'record_bodyweight: not your player' USING ERRCODE = '42501';
  END IF;
  IF p_kg IS NULL OR p_kg < 20 OR p_kg > 400 THEN
    RAISE EXCEPTION 'record_bodyweight: % kg is outside 20-400', p_kg USING ERRCODE = '22023';
  END IF;

  v_day := (now() AT TIME ZONE 'Pacific/Auckland')::date;
  IF p_measured_on IS NOT NULL THEN
    IF NOT public.is_judge() THEN
      RAISE EXCEPTION 'record_bodyweight: only a kaiwhakawa may date a weigh-in'
        USING ERRCODE = '42501';
    END IF;
    IF p_measured_on > v_day THEN
      RAISE EXCEPTION 'record_bodyweight: cannot record a weight in the future'
        USING ERRCODE = '22023';
    END IF;
    v_day := p_measured_on;
  END IF;

  INSERT INTO public.player_bodyweights (player_id, measured_on, kg, recorded_by)
  VALUES (p_player_id, v_day, p_kg,
          CASE WHEN p_player_id = auth.uid() THEN NULL ELSE auth.uid() END)
  ON CONFLICT (player_id, measured_on)
    DO UPDATE SET kg = EXCLUDED.kg, recorded_by = EXCLUDED.recorded_by, created_at = now()
  RETURNING id INTO v_id;

  -- Deliberately does NOT touch players. Clearing grades_checked_at here would
  -- have worked, but __tests__/autoConferral.test.ts asserts that
  -- delete_my_account is the ONLY SECURITY DEFINER function that updates
  -- players — the invariant that keeps a definer function from becoming a way
  -- around guard_players_grading_identity, which is SECURITY INVOKER and
  -- exempts server code by current_user. Section 5 makes grades_need_recheck
  -- probe this table instead, which is the same signal without the write.
  RETURN v_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_workouts_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_bad    text;
  v_active boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_at := now();
    -- service_role has no auth.uid() and must say who logged it.
    NEW.logged_by  := COALESCE(auth.uid(), NEW.logged_by);
    -- Witnessed means a kaiwhakawā watched someone ELSE do it. A kaiwhakawā's
    -- own session, or their own child's, is as self-reported as anyone's.
    -- CHANGED 20261123024501: or whoever runs the game it is added at.
    NEW.witnessed  := auth.uid() IS NOT NULL
      AND (public.is_judge() OR (NEW.session_id IS NOT NULL AND public.runs_session(NEW.session_id)))
      AND NEW.player_id <> auth.uid()
      AND NOT EXISTS (SELECT 1 FROM players WHERE id = NEW.player_id AND parent_id = auth.uid());

    -- ADDED 20260920042215: a workout may only be attached to a game that is
    -- still being played. A kaiwhakawā is exempt, exactly as they are in
    -- guard_results_write (they score for other players, and after the fact).
    IF NEW.session_id IS NOT NULL AND auth.uid() IS NOT NULL AND NOT public.runs_session(NEW.session_id) THEN
      SELECT is_active INTO v_active FROM sessions WHERE id = NEW.session_id;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'workout: unknown game %', NEW.session_id USING ERRCODE = '42501';
      END IF;
      IF NOT v_active THEN
        RAISE EXCEPTION 'workout: that game has finished' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    IF OLD.witnessed AND auth.uid() IS NOT NULL AND NOT public.is_judge()
       AND NOT (OLD.session_id IS NOT NULL AND public.runs_session(OLD.session_id)) THEN
      RAISE EXCEPTION 'workout: a witnessed workout can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
    END IF;
    NEW.id         := OLD.id;
    NEW.player_id  := OLD.player_id;
    NEW.logged_by  := OLD.logged_by;
    NEW.witnessed  := OLD.witnessed;
    NEW.created_at := OLD.created_at;
    -- Pinned like player_id: a workout cannot be attached to a game, or moved
    -- to another, after the fact. That is what makes `game` evidence mean
    -- something.
    NEW.session_id := OLD.session_id;
  END IF;

  -- A plan only means something against the roster, the same rule
  -- workout_entries.event_slug follows. Checked only when it changes.
  IF TG_OP = 'INSERT' OR NEW.planned_events IS DISTINCT FROM OLD.planned_events THEN
    SELECT s INTO v_bad
      FROM unnest(COALESCE(NEW.planned_events, '{}')) AS s
     WHERE NOT EXISTS (SELECT 1 FROM event_domains WHERE slug = s)
     LIMIT 1;
    IF v_bad IS NOT NULL THEN
      RAISE EXCEPTION 'workout: % is not an event on the roster', v_bad USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_workouts_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'authenticated' AND OLD.witnessed AND NOT public.is_judge()
     AND NOT (OLD.session_id IS NOT NULL AND public.runs_session(OLD.session_id)) THEN
    RAISE EXCEPTION 'workout: a witnessed workout can only be deleted by a kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.guard_workout_entries_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  -- CHANGED 20261123024501: whoever runs the game an add belongs to, as a head.
  IF auth.uid() IS NOT NULL AND NOT public.is_judge()
     AND NOT (v_session IS NOT NULL AND public.runs_session(v_session))
     AND NOT v_fitting_only THEN
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

  -- CHANGED 20261026220347: also allowed in an OPEN training session (a
  -- witnessed workout, not finished, dated today in NZ), where the kaiwhakawā
  -- is in the room and may be the opponent. The window is the one a player may
  -- write to a training session at all, so a finished session cannot gain a win.
  -- CHANGED 20261102211504: the four sprints left the roster; Sprint Race and Hurdles join.
  -- CHANGED 20261005222950: Mas Wrestling, 400m Sprint, 800m Sprint and
  -- Obstacle Course (6 Oct 2026 roster) join the list.
  -- CHANGED 20261005012108: thirteen more pure contests (the races and the
  -- contests whose drill ladders were removed on 5 Oct 2026) join Wrestling in
  -- the list. They have no rung to name, so the slug is the only way to know.
  -- A game result is allowed on a workout linked to an official game (a swap: a
  -- real opponent, a kaiwhakawā in the room), in an open training session, and
  -- nowhere else. Logged at home it would still count a win with nobody on the
  -- other side, which is what 20260916211643 exists to stop. Game rungs are
  -- recognised by NAME because the database does not hold the ladders;
  -- __tests__/workoutEntriesIntegrity.test.ts fails if that ever stops being true.
  IF NEW.raw_score IS NOT NULL
     AND (NEW.difficulty_tier ILIKE 'Game%' OR NEW.event_slug IN ('arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'hurdles', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 'sprint-race', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war', 'wrestling'))
     AND v_session IS NULL
     AND NOT (
       COALESCE(v_witnessed, false)
       AND v_finished IS NULL
       AND v_performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
     ) THEN
    RAISE EXCEPTION 'workout entry: a game result is recorded at an official game, not logged' USING ERRCODE = '22023';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.claim_colour_award(p_player_id uuid, p_session_id uuid, p_rung integer)
 RETURNS TABLE(out_rung integer, out_colour_name text, out_points integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_participation    INT;
  v_pr_events        INT;
  v_task_completions INT;
  v_effort_level     INT;
  v_guaranteed       INT;
  v_lifetime         INT;
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'claim_colour_award: kaiwhakawā only';
  END IF;

  -- Guarantees a player_totals row exists and that lifetime is current.
  PERFORM recompute_player_total(p_player_id);

  SELECT COUNT(DISTINCT event_id) INTO v_participation
  FROM results WHERE session_id = p_session_id AND player_id = p_player_id AND raw_score IS NOT NULL;

  SELECT COUNT(DISTINCT event_id) INTO v_pr_events
  FROM results WHERE session_id = p_session_id AND player_id = p_player_id AND is_pr = true;

  SELECT COALESCE(SUM(effort_task_completions), 0) INTO v_task_completions
  FROM results WHERE session_id = p_session_id AND player_id = p_player_id;

  v_effort_level := LEAST(v_participation + v_pr_events + v_task_completions, 20);
  -- The guaranteed floor: minimum placement award + effort already banked.
  -- No placement ranking, so no other player's result can invalidate it.
  v_guaranteed   := 10 + v_effort_level * 5;

  SELECT COALESCE(t.lifetime_points, 0) INTO v_lifetime
  FROM player_totals t WHERE t.player_id = p_player_id;
  v_lifetime := COALESCE(v_lifetime, 0);

  RETURN QUERY
  WITH claimed AS (
    INSERT INTO colour_awards
      (player_id, rung, colour_name, points_at_award, session_id, celebrated_at)
    SELECT p_player_id, l.rung, l.name, v_lifetime + v_guaranteed, p_session_id, NOW()
    FROM colour_ladder l
    WHERE l.rung = p_rung
      AND l.threshold > 0
      AND l.threshold <= v_lifetime + v_guaranteed
    -- The session may already have closed and the trigger written the row.
    -- The tap still counts as the celebration.
    ON CONFLICT (player_id, rung) DO UPDATE
      SET celebrated_at = COALESCE(colour_awards.celebrated_at, NOW())
    RETURNING colour_awards.rung, colour_awards.colour_name, colour_awards.points_at_award
  )
  SELECT c.rung, c.colour_name, c.points_at_award FROM claimed c;

  UPDATE player_totals
  SET highest_rung = GREATEST(1, COALESCE(
        (SELECT MAX(a.rung) FROM colour_awards a WHERE a.player_id = p_player_id), 1)),
      updated_at = NOW()
  WHERE player_id = p_player_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_wellbeing_report()
 RETURNS TABLE(quarter text, cohort text, respondents bigint, who5_score numeric, activity_days numeric, fitness numeric, confidence numeric, enjoyment numeric, belonging numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'Kaiwhakawā only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      TO_CHAR(w.created_at, 'YYYY "Q"Q') AS q,
      CASE WHEN p.division IN ('Juniors', 'Youth') THEN 'rangatahi' ELSE 'adults' END AS c,
      (w.who5_cheerful + w.who5_calm + w.who5_active + w.who5_rested + w.who5_interested) * 4.0 AS who5,
      w.activity_days AS ad,
      w.fitness       AS fit,
      w.confidence    AS conf,
      w.enjoyment     AS enj,
      w.belonging     AS bel
    FROM wellbeing_surveys w
    JOIN players p ON p.id = w.player_id
  ),
  unioned AS (
    SELECT q, 'all'::TEXT AS cohort_name, who5, ad, fit, conf, enj, bel FROM base
    UNION ALL
    SELECT q, c AS cohort_name, who5, ad, fit, conf, enj, bel FROM base
  )
  SELECT
    u.q,
    u.cohort_name,
    COUNT(*),
    ROUND(AVG(u.who5), 1),
    ROUND(AVG(u.ad), 1),
    ROUND(AVG(u.fit), 2),
    ROUND(AVG(u.conf), 2),
    ROUND(AVG(u.enj), 2),
    ROUND(AVG(u.bel), 2)
  FROM unioned u
  GROUP BY u.q, u.cohort_name
  HAVING COUNT(*) >= 3
  ORDER BY u.q, u.cohort_name;
END;
$function$;

CREATE OR REPLACE FUNCTION public.record_entry_match(p_entry_id uuid, p_opponent_ids uuid[], p_teammate_ids uuid[] DEFAULT '{}'::uuid[])
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid      uuid := auth.uid();
  v_judge    boolean := public.is_judge();
  e          record;
  v_active   boolean;
  v_training boolean := false;
  v_name     text;
  v_term     int;
  v_outcome  text;
  v_opp      uuid[];
  v_mates    uuid[];
  v_match    uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'record_entry_match: sign in to record a match' USING ERRCODE = '42501';
  END IF;

  SELECT en.id, en.raw_score, en.difficulty_tier, en.event_slug,
         w.player_id, w.session_id, w.witnessed, w.finished_at, w.performed_on, w.logged_by
    INTO e
  FROM workout_entries en
  JOIN workouts w ON w.id = en.workout_id
  WHERE en.id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'record_entry_match: unknown entry %', p_entry_id USING ERRCODE = 'P0002';
  END IF;

  -- Same authority as writing the entry itself (can_log_for).
  IF NOT public.can_log_for(e.player_id) THEN
    RAISE EXCEPTION 'record_entry_match: that entry belongs to someone else' USING ERRCODE = '42501';
  END IF;

  IF e.session_id IS NULL THEN
    -- CHANGED 20261026220347: a training session (a witnessed workout the
    -- kaiwhakawā runs) may rate a game against that kaiwhakawā. A personal game
    -- still has no opponent the server can trust.
    IF NOT COALESCE(e.witnessed, false) THEN
      RAISE EXCEPTION 'record_entry_match: only a game played at an official game or against your kaiwhakawā in training is rated'
        USING ERRCODE = '22023';
    END IF;
    IF NOT v_judge AND NOT (
      e.finished_at IS NULL AND e.performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date
    ) THEN
      RAISE EXCEPTION 'record_entry_match: that training session has finished — ask your kaiwhakawā'
        USING ERRCODE = '42501';
    END IF;
    v_training := true;
  ELSIF NOT v_judge THEN
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
     AND (e.difficulty_tier ILIKE 'Game%' OR e.event_slug IN ('arm-wrestling', 'beach-flags', 'capture-the-flag', 'fencing', 'hurdles', 'kabaddi', 'mas-wrestling', 'obstacle-course', 'rats-and-rabbits', 'speed-chess', 'sprint-race', 't-race', 'tae-kwon-do', 'tag', 'tug-of-war', 'wrestling')) THEN
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

  -- In training the only opponent is the kaiwhakawā running the session, one
  -- on one, and they must still be a kaiwhakawā: anyone else named here would
  -- be a win over someone who never confirmed it.
  IF v_training AND cardinality(v_opp) > 0 AND (
       v_opp <> ARRAY[e.logged_by]
       OR cardinality(v_mates) > 0
       OR NOT EXISTS (SELECT 1 FROM kaiarahi k WHERE k.player_id = e.logged_by AND k.level = 'head')
     ) THEN
    RAISE EXCEPTION 'record_entry_match: in training you can only play the kaiwhakawā running the session'
      USING ERRCODE = '22023';
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

  -- A training game is confirmed by the kaiwhakawā who played and witnessed
  -- it; lib/matches.ts counts a confirmed match with no session as agreed.
  INSERT INTO matches (workout_entry_id, session_id, event_name, outcome, recorded_by, confirmed_by, confirmed_at)
  VALUES (p_entry_id, e.session_id, v_name, v_outcome, v_uid,
          CASE WHEN v_training THEN e.logged_by END,
          CASE WHEN v_training THEN now() END)
  RETURNING id INTO v_match;

  INSERT INTO match_players (match_id, player_id, side)
  SELECT v_match, e.player_id, 'a'
  UNION ALL SELECT v_match, x, 'a' FROM unnest(v_mates) AS x
  UNION ALL SELECT v_match, x, 'b' FROM unnest(v_opp)   AS x;

  RETURN v_match;
END;
$function$;

-- ── 7. Check ───────────────────────────────────────────────────────────────
DO $check$
DECLARE v_judges int; v_heads int; v_raw int;
BEGIN
  SELECT count(*) INTO v_judges FROM players WHERE role = 'judge';
  SELECT count(*) INTO v_heads FROM kaiarahi WHERE level = 'head' AND suspended_at IS NULL;
  IF v_heads < v_judges OR v_heads = 0 THEN
    RAISE EXCEPTION 'kaiarahi: % judges but % heads', v_judges, v_heads;
  END IF;
  -- Nothing may still grant a power from players.role.
  SELECT count(*) INTO v_raw FROM pg_policies
  WHERE schemaname = 'public' AND (coalesce(qual, '') || coalesce(with_check, '')) ~ 'role = ''judge''';
  IF v_raw > 0 THEN RAISE EXCEPTION 'kaiarahi: % policies still read players.role', v_raw; END IF;
  SELECT count(*) INTO v_raw FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prosrc ~ 'role = ''judge''';
  IF v_raw > 0 THEN RAISE EXCEPTION 'kaiarahi: % functions still read players.role', v_raw; END IF;
END
$check$;

COMMIT;
