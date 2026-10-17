-- ─── Swiss one-on-one contests (Scoring v2 step 5) ──────────────────────────
-- Tāne, 15 Oct 2026 (SCORING_V2_PLAN.md decisions 4, 13 and 14), redesigned
-- 18 Oct 2026: no Ready button and no queue. Players play their first match
-- against anyone; after that the scoring sheet suggests who to play next
-- (winners play winners), worked out in the browser from the matches already
-- recorded (lib/swiss.ts, suggestNext). Results are recorded exactly as
-- before (a results row plus record_match()).
--
-- The one thing the browser cannot work out is SAFETY, because it needs ages,
-- sexes and bodyweights, which never leave the database. So this migration
-- adds one function a player calls, contest_safe_opponents(), which says
-- which players in the game they may be paired with, by id only. The
-- opponent picker greys out everyone else, and the suggestions skip them.
--
-- Who may meet whom (mirrors canPair in lib/swiss.ts, pinned by
-- __tests__/swissMigration.test.ts):
--   · contact (Wrestling, Mas Wrestling, Arm Wrestling, Tae Kwon Do): the same
--     age group (U12, 12–15, 16+; an unknown age is 16+), bodyweights of the
--     last 30 days within 15% of the lighter, and the same sex class except
--     under 12 or where the kaiwhakawā allows mixed. No bodyweight, no match.
--   · age (Fencing, Tag): the same age group only.
--   · open (Speed Chess): anyone.
--
-- PRIVACY: contest_profile() and contest_can_pair() are internal and return
-- nothing to a client; contest_safe_opponents() returns ids of players
-- already in the game (who appear on its board by name anyway) and booleans.
--
-- DEPLOY ORDER: MIGRATION FIRST, then code. The new card calls
-- contest_safe_opponents() and hides itself without it; nothing old reads it.
-- ROLLBACK: DROP the six functions and session_events.contest_mixed.

BEGIN;

ALTER TABLE public.session_events
  ADD COLUMN IF NOT EXISTS contest_mixed boolean NOT NULL DEFAULT false;

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

-- The contest a session event runs, or no row when it is not a Swiss contest.
CREATE OR REPLACE FUNCTION public.contest_event(p_session_id uuid, p_event_name text)
RETURNS TABLE (level text, mixed boolean, day date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT contest_level(se.event_slug), se.contest_mixed, s.session_date
  FROM session_events se JOIN sessions s ON s.id = se.session_id
  WHERE se.session_id = p_session_id AND se.event_name = p_event_name
    AND contest_level(se.event_slug) IS NOT NULL
  LIMIT 1
$$;

-- ─── What a player calls ─────────────────────────────────────────────────────

-- Who in this game the player may meet in this contest. Returns NULL when the
-- event is not a Swiss contest, else
--   {level, mixed, needs_bodyweight, safe: [player ids]}
-- "In this game" means anyone with a result in it, in any event.
-- needs_bodyweight: a contact event, and the player has none from the last
-- 30 days, so nobody is safe until they enter one.
CREATE OR REPLACE FUNCTION public.contest_safe_opponents(p_session_id uuid, p_event_name text, p_player_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE ev record; me record;
BEGIN
  -- COALESCE: can_log_for(NULL) is NULL, and IF NOT NULL would let it through.
  IF NOT COALESCE(public.can_log_for(p_player_id) OR public.is_judge(), false) OR p_player_id IS NULL THEN
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
END $$;

-- ─── What a kaiwhakawā calls ─────────────────────────────────────────────────

-- Whether adults of different sexes may meet in a contact event this game.
CREATE OR REPLACE FUNCTION public.set_contest_mixed(p_session_id uuid, p_event_name text, p_mixed boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_judge() THEN RAISE EXCEPTION 'kaiwhakawā only' USING ERRCODE = '42501'; END IF;
  UPDATE session_events SET contest_mixed = p_mixed
    WHERE session_id = p_session_id AND event_name = p_event_name AND contest_level(event_slug) IS NOT NULL;
END $$;

-- Internal helpers: callable only inside the functions above.
REVOKE ALL ON FUNCTION public.contest_profile(uuid, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contest_can_pair(uuid, uuid, text, boolean, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.contest_event(uuid, text) FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.contest_safe_opponents(uuid, text, uuid),
  public.set_contest_mixed(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contest_safe_opponents(uuid, text, uuid),
  public.set_contest_mixed(uuid, text, boolean) TO authenticated;

DO $$
BEGIN
  IF has_function_privilege('authenticated', 'public.contest_profile(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'swiss: a player''s age, sex and bodyweight are callable';
  END IF;
  IF has_function_privilege('anon', 'public.contest_safe_opponents(uuid, text, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'swiss: anon can ask who is safe to meet';
  END IF;
END $$;

COMMIT;
