-- ─── Swiss one-on-one contests (Scoring v2 step 5) ──────────────────────────
-- Tāne, 15 Oct 2026 (SCORING_V2_PLAN.md decisions 4, 13 and 14). Each
-- one-on-one contest in a game runs as a Swiss tournament, paired on demand:
-- a player taps Ready, and contest_ready() pairs them with the best free
-- opponent who is waiting, or queues them. The app then says whom to find.
-- The result is recorded exactly as before (a results row plus
-- record_match()), so the rating, reconciliation and disputes are unchanged.
-- The game-day score (the performance rating) is computed in lib/swiss.ts.
--
-- Who pairs with whom (mirrors canPair and pickOpponent in lib/swiss.ts,
-- pinned by __tests__/swissMigration.test.ts):
--   · contact (Wrestling, Mas Wrestling, Arm Wrestling, Tae Kwon Do): the same
--     age group (U12, 12–15, 16+; an unknown age is 16+), bodyweights of the
--     last 30 days within 15% of the lighter, and the same sex class except
--     under 12 or where the kaiwhakawā allows mixed. No bodyweight, no pairing.
--   · age (Fencing, Tag): the same age group only.
--   · open (Speed Chess): anyone.
--   Never a rematch while anyone else is free, then the closest Swiss points
--   (the player's own recorded results today: win 1, draw ½), then the
--   longest wait. A kaiwhakawā can pair any two players by hand.
--
-- PRIVACY: ages, sexes and bodyweights are read inside SECURITY DEFINER
-- functions to decide a pairing and are never returned. An opponent is shown
-- by display name and icon, as players_public already shows them.
--
-- Stale state expires rather than being cleaned up: a queue entry older than
-- 10 minutes is not paired, and an open pairing older than 20 minutes no
-- longer holds a player.
--
-- DEPLOY ORDER: MIGRATION FIRST, then code. The new card calls these
-- functions and hides itself without them; nothing old reads them.
-- ROLLBACK: DROP the functions, the two tables, and the two session_events
-- columns.

BEGIN;

ALTER TABLE public.session_events
  ADD COLUMN IF NOT EXISTS contest_matches smallint NOT NULL DEFAULT 3 CHECK (contest_matches BETWEEN 1 AND 20),
  ADD COLUMN IF NOT EXISTS contest_mixed boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.contest_queue (
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  points     numeric NOT NULL DEFAULT 0,
  ready_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, event_name, player_id)
);

CREATE TABLE IF NOT EXISTS public.contest_pairings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  player_a   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  player_b   uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  -- The kaiwhakawā who paired them by hand; null when contest_ready() did.
  paired_by  uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at  timestamptz,
  CHECK (player_a <> player_b)
);
CREATE INDEX IF NOT EXISTS contest_pairings_contest_idx ON public.contest_pairings (session_id, event_name);

ALTER TABLE public.contest_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contest_pairings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS contest_queue_select ON public.contest_queue;
CREATE POLICY contest_queue_select ON public.contest_queue FOR SELECT TO authenticated
  USING (public.can_log_for(player_id) OR public.is_judge());
DROP POLICY IF EXISTS contest_pairings_select ON public.contest_pairings;
CREATE POLICY contest_pairings_select ON public.contest_pairings FOR SELECT TO authenticated
  USING (public.can_log_for(player_a) OR public.can_log_for(player_b) OR public.is_judge());

REVOKE ALL ON public.contest_queue, public.contest_pairings FROM anon;
GRANT SELECT ON public.contest_queue, public.contest_pairings TO authenticated;

-- ─── Rules ───────────────────────────────────────────────────────────────────

-- How closely a contest pairs, by slug. Mirrors SWISS_CONTESTS in lib/swiss.ts.
CREATE OR REPLACE FUNCTION public.contest_level(p_slug text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT CASE p_slug
    WHEN 'wrestling' THEN 'contact'
    WHEN 'mas-wrestling' THEN 'contact'
    WHEN 'arm-wrestling' THEN 'contact'
    WHEN 'tae-kwon-do' THEN 'contact'
    WHEN 'fencing' THEN 'age'
    WHEN 'tag' THEN 'age'
    WHEN 'speed-chess' THEN 'open'
  END
$$;

-- What pairing needs to know about a player on a day. Never returned to a client.
CREATE OR REPLACE FUNCTION public.contest_profile(p_player_id uuid, p_day date)
RETURNS TABLE (age_group text, sex_class text, kg numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    CASE
      WHEN p.date_of_birth IS NULL THEN '16+'
      WHEN date_part('year', age(p_day, p.date_of_birth)) < 12 THEN 'U12'
      WHEN date_part('year', age(p_day, p.date_of_birth)) < 16 THEN '12-15'
      ELSE '16+'
    END,
    CASE
      WHEN COALESCE(p.division, '') ~ 'Women' THEN 'F'
      WHEN COALESCE(p.division, '') ~ 'Men' THEN 'M'
      WHEN COALESCE(p.gender, '') ~* '^f' THEN 'F'
      ELSE 'M'
    END,
    (SELECT b.kg FROM player_bodyweights b
      WHERE b.player_id = p.id AND b.measured_on <= p_day AND b.measured_on > p_day - 30
      ORDER BY b.measured_on DESC LIMIT 1)
  FROM players p WHERE p.id = p_player_id
$$;

CREATE OR REPLACE FUNCTION public.contest_can_pair(p_a uuid, p_b uuid, p_level text, p_mixed boolean, p_day date)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE a record; b record;
BEGIN
  IF p_a = p_b THEN RETURN false; END IF;
  IF p_level = 'open' THEN RETURN true; END IF;
  SELECT * INTO a FROM contest_profile(p_a, p_day);
  SELECT * INTO b FROM contest_profile(p_b, p_day);
  IF a.age_group IS DISTINCT FROM b.age_group THEN RETURN false; END IF;
  IF p_level = 'age' THEN RETURN true; END IF;
  IF a.kg IS NULL OR b.kg IS NULL THEN RETURN false; END IF;
  IF GREATEST(a.kg, b.kg) > LEAST(a.kg, b.kg) * 1.15 THEN RETURN false; END IF;
  RETURN a.age_group = 'U12' OR p_mixed OR a.sex_class = b.sex_class;
END $$;

-- A player's Swiss points in one contest of one game, from their own results.
CREATE OR REPLACE FUNCTION public.contest_points(p_session_id uuid, p_event_name text, p_player_id uuid)
RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(SUM(r.raw_score) / 2.0, 0)
  FROM results r JOIN session_events se ON se.id = r.event_id
  WHERE r.session_id = p_session_id AND se.event_name = p_event_name
    AND r.player_id = p_player_id AND r.raw_score IN (0, 1, 2)
$$;

-- The player's open pairing in a contest, with the opponent as players see them.
CREATE OR REPLACE FUNCTION public.contest_open_pairing(p_session_id uuid, p_event_name text, p_player_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', c.id,
    'opponent_id', o.id,
    'opponent_name', o.display_name,
    'opponent_icon', o.icon,
    'by_judge', c.paired_by IS NOT NULL)
  FROM contest_pairings c
  JOIN players_public o ON o.id = CASE WHEN c.player_a = p_player_id THEN c.player_b ELSE c.player_a END
  WHERE c.session_id = p_session_id AND c.event_name = p_event_name
    AND p_player_id IN (c.player_a, c.player_b)
    AND c.closed_at IS NULL AND c.created_at > now() - interval '20 minutes'
  ORDER BY c.created_at DESC LIMIT 1
$$;

-- The contest a session event runs, or an error if it is not a Swiss contest
-- in an open game.
CREATE OR REPLACE FUNCTION public.contest_event(p_session_id uuid, p_event_name text)
RETURNS TABLE (level text, matches int, mixed boolean, day date)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT contest_level(se.event_slug), se.contest_matches::int, se.contest_mixed, s.session_date
  FROM session_events se JOIN sessions s ON s.id = se.session_id
  WHERE se.session_id = p_session_id AND se.event_name = p_event_name
    AND contest_level(se.event_slug) IS NOT NULL AND s.is_active
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'not a contest in an open game' USING ERRCODE = '22023'; END IF;
END $$;

-- ─── What a player calls ─────────────────────────────────────────────────────

-- Ready for a match: paired now, or queued. Returns
--   {status: 'paired', pairing: {...}}           an opponent to find
--   {status: 'waiting', waiting, none_eligible}  queued; none_eligible means
--                                                nobody in this game can be
--                                                paired with them (take a bye)
--   {status: 'needs_bodyweight'}                 a contact event needs one
CREATE OR REPLACE FUNCTION public.contest_ready(p_session_id uuid, p_event_name text, p_player_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  ev record; me record; v_open jsonb; my_points numeric; met uuid[]; pick uuid; v_id uuid;
  n_waiting int; any_eligible boolean;
BEGIN
  IF NOT public.can_log_for(p_player_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT * INTO ev FROM contest_event(p_session_id, p_event_name);
  -- One pairing at a time per contest, so two players are never handed the same opponent.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text || '|' || p_event_name, 0));

  v_open := contest_open_pairing(p_session_id, p_event_name, p_player_id);
  IF v_open IS NOT NULL THEN RETURN jsonb_build_object('status', 'paired', 'pairing', v_open); END IF;

  SELECT * INTO me FROM contest_profile(p_player_id, ev.day);
  IF ev.level = 'contact' AND me.kg IS NULL THEN RETURN jsonb_build_object('status', 'needs_bodyweight'); END IF;

  my_points := contest_points(p_session_id, p_event_name, p_player_id);
  SELECT COALESCE(array_agg(CASE WHEN c.player_a = p_player_id THEN c.player_b ELSE c.player_a END), '{}')
    INTO met FROM contest_pairings c
    WHERE c.session_id = p_session_id AND c.event_name = p_event_name AND p_player_id IN (c.player_a, c.player_b);

  SELECT q.player_id INTO pick FROM contest_queue q
  WHERE q.session_id = p_session_id AND q.event_name = p_event_name AND q.player_id <> p_player_id
    AND q.ready_at > now() - interval '10 minutes'
    AND contest_open_pairing(p_session_id, p_event_name, q.player_id) IS NULL
    AND contest_can_pair(p_player_id, q.player_id, ev.level, ev.mixed, ev.day)
  ORDER BY (q.player_id = ANY (met)), abs(q.points - my_points), q.ready_at
  LIMIT 1;

  IF pick IS NOT NULL THEN
    DELETE FROM contest_queue WHERE session_id = p_session_id AND event_name = p_event_name AND player_id IN (p_player_id, pick);
    INSERT INTO contest_pairings (session_id, event_name, player_a, player_b)
      VALUES (p_session_id, p_event_name, pick, p_player_id) RETURNING id INTO v_id;
    RETURN jsonb_build_object('status', 'paired', 'pairing', contest_open_pairing(p_session_id, p_event_name, p_player_id));
  END IF;

  INSERT INTO contest_queue (session_id, event_name, player_id, points)
    VALUES (p_session_id, p_event_name, p_player_id, my_points)
    ON CONFLICT (session_id, event_name, player_id) DO UPDATE SET points = EXCLUDED.points, ready_at =
      CASE WHEN contest_queue.ready_at > now() - interval '10 minutes' THEN contest_queue.ready_at ELSE now() END;

  SELECT count(*) INTO n_waiting FROM contest_queue q
  WHERE q.session_id = p_session_id AND q.event_name = p_event_name AND q.ready_at > now() - interval '10 minutes';

  -- Anyone in this game (a result in it, or waiting) who could be paired with them.
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT r.player_id FROM results r WHERE r.session_id = p_session_id AND r.player_id IS NOT NULL
      UNION SELECT q.player_id FROM contest_queue q WHERE q.session_id = p_session_id
    ) who
    WHERE who.player_id <> p_player_id AND contest_can_pair(p_player_id, who.player_id, ev.level, ev.mixed, ev.day)
  ) INTO any_eligible;

  RETURN jsonb_build_object('status', 'waiting', 'waiting', n_waiting, 'none_eligible', NOT any_eligible);
END $$;

-- Where a player stands in a contest, polled while they wait.
CREATE OR REPLACE FUNCTION public.contest_state(p_session_id uuid, p_event_name text, p_player_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ev record; v_open jsonb; queued boolean; n_waiting int; played int;
BEGIN
  IF NOT public.can_log_for(p_player_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT se.contest_matches::int AS matches INTO ev FROM session_events se
    WHERE se.session_id = p_session_id AND se.event_name = p_event_name AND contest_level(se.event_slug) IS NOT NULL LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  SELECT count(*) INTO played FROM results r JOIN session_events se ON se.id = r.event_id
    WHERE r.session_id = p_session_id AND se.event_name = p_event_name AND r.player_id = p_player_id;
  v_open := contest_open_pairing(p_session_id, p_event_name, p_player_id);
  SELECT EXISTS (SELECT 1 FROM contest_queue q WHERE q.session_id = p_session_id AND q.event_name = p_event_name
    AND q.player_id = p_player_id AND q.ready_at > now() - interval '10 minutes') INTO queued;
  SELECT count(*) INTO n_waiting FROM contest_queue q
    WHERE q.session_id = p_session_id AND q.event_name = p_event_name AND q.ready_at > now() - interval '10 minutes';
  RETURN jsonb_build_object(
    'status', CASE WHEN v_open IS NOT NULL THEN 'paired' WHEN queued THEN 'waiting' ELSE 'idle' END,
    'pairing', v_open, 'waiting', n_waiting, 'matches', ev.matches, 'played', played);
END $$;

-- Stop waiting.
CREATE OR REPLACE FUNCTION public.contest_leave(p_session_id uuid, p_event_name text, p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.can_log_for(p_player_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  DELETE FROM contest_queue WHERE session_id = p_session_id AND event_name = p_event_name AND player_id = p_player_id;
END $$;

-- The match is played (or called off): either player, or a kaiwhakawā.
CREATE OR REPLACE FUNCTION public.contest_close(p_pairing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record;
BEGIN
  SELECT * INTO c FROM contest_pairings WHERE id = p_pairing_id;
  IF NOT FOUND THEN RETURN; END IF;
  IF NOT (public.can_log_for(c.player_a) OR public.can_log_for(c.player_b)) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  UPDATE contest_pairings SET closed_at = now() WHERE id = p_pairing_id AND closed_at IS NULL;
END $$;

-- ─── What a kaiwhakawā calls ─────────────────────────────────────────────────

-- Pair any two players by hand, safety rules or not.
CREATE OR REPLACE FUNCTION public.contest_pair(p_session_id uuid, p_event_name text, p_a uuid, p_b uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF NOT public.is_judge() THEN RAISE EXCEPTION 'kaiwhakawā only' USING ERRCODE = '42501'; END IF;
  PERFORM contest_event(p_session_id, p_event_name);
  PERFORM pg_advisory_xact_lock(hashtextextended(p_session_id::text || '|' || p_event_name, 0));
  UPDATE contest_pairings SET closed_at = now()
    WHERE session_id = p_session_id AND event_name = p_event_name AND closed_at IS NULL
      AND (player_a IN (p_a, p_b) OR player_b IN (p_a, p_b));
  DELETE FROM contest_queue WHERE session_id = p_session_id AND event_name = p_event_name AND player_id IN (p_a, p_b);
  INSERT INTO contest_pairings (session_id, event_name, player_a, player_b, paired_by)
    VALUES (p_session_id, p_event_name, p_a, p_b, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- Who is waiting and who is paired in a contest, for the kaiwhakawā.
CREATE OR REPLACE FUNCTION public.contest_board(p_session_id uuid, p_event_name text)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_judge() THEN RAISE EXCEPTION 'kaiwhakawā only' USING ERRCODE = '42501'; END IF;
  RETURN jsonb_build_object(
    'waiting', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', q.player_id, 'name', p.display_name, 'points', q.points) ORDER BY q.ready_at)
      FROM contest_queue q JOIN players_public p ON p.id = q.player_id
      WHERE q.session_id = p_session_id AND q.event_name = p_event_name AND q.ready_at > now() - interval '10 minutes'), '[]'::jsonb),
    'paired', COALESCE((SELECT jsonb_agg(jsonb_build_object('id', c.id, 'a', pa.display_name, 'b', pb.display_name) ORDER BY c.created_at)
      FROM contest_pairings c JOIN players_public pa ON pa.id = c.player_a JOIN players_public pb ON pb.id = c.player_b
      WHERE c.session_id = p_session_id AND c.event_name = p_event_name AND c.closed_at IS NULL
        AND c.created_at > now() - interval '20 minutes'), '[]'::jsonb),
    'matches', (SELECT se.contest_matches FROM session_events se WHERE se.session_id = p_session_id AND se.event_name = p_event_name LIMIT 1),
    'mixed', (SELECT se.contest_mixed FROM session_events se WHERE se.session_id = p_session_id AND se.event_name = p_event_name LIMIT 1));
END $$;

-- Matches each player plays in a contest this game (default 3), and whether
-- adults of different sexes may be paired on a contact event.
CREATE OR REPLACE FUNCTION public.set_contest_rules(p_session_id uuid, p_event_name text, p_matches int, p_mixed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_judge() THEN RAISE EXCEPTION 'kaiwhakawā only' USING ERRCODE = '42501'; END IF;
  UPDATE session_events SET contest_matches = p_matches, contest_mixed = p_mixed
    WHERE session_id = p_session_id AND event_name = p_event_name AND contest_level(event_slug) IS NOT NULL;
END $$;

-- Internal helpers: callable only inside the functions above.
REVOKE ALL ON FUNCTION public.contest_profile(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contest_can_pair(uuid, uuid, text, boolean, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contest_points(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contest_open_pairing(uuid, text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contest_event(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.contest_ready(uuid, text, uuid), public.contest_state(uuid, text, uuid),
  public.contest_leave(uuid, text, uuid), public.contest_close(uuid), public.contest_pair(uuid, text, uuid, uuid),
  public.contest_board(uuid, text), public.set_contest_rules(uuid, text, int, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contest_ready(uuid, text, uuid), public.contest_state(uuid, text, uuid),
  public.contest_leave(uuid, text, uuid), public.contest_close(uuid), public.contest_pair(uuid, text, uuid, uuid),
  public.contest_board(uuid, text), public.set_contest_rules(uuid, text, int, boolean) TO authenticated;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.contest_profile(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'swiss: a player''s age, sex and bodyweight are callable';
  END IF;
  IF has_table_privilege('anon', 'public.contest_queue', 'SELECT') THEN
    RAISE EXCEPTION 'swiss: the queue is exposed to anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
             AND tablename IN ('contest_queue', 'contest_pairings') AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'swiss: a write policy exists; writes go through the functions only';
  END IF;
END $$;

COMMIT;
