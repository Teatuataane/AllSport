-- ─── Programmes, funded and community games, one-offs, pins (multi-location PR 2)
-- MULTI_LOCATION_PLAN.md §2 "Games", agreed with Tāne 23 Nov 2026.
--
--   * A PROGRAMME is a funder's grant: name, funder, dates, the targets promised.
--     Only a Kaiwhakawā sees or writes one (targets are internal).
--   * A game is FUNDED (paid Kaiārahi, belongs to a programme, created by a
--     Kaiwhakawā only) or COMMUNITY (unpaid, any Kaiārahi creates it).
--   * A game is WEEKLY or ONE-OFF (one_off_date). A pop-up is a one-off community
--     game made on the spot from New Game. weekly_games keeps its name, so
--     every reader and the push branch keep working; it now holds every
--     scheduled game. A one-off still carries the weekday of its date in `dow`,
--     so the weekly helpers keep working on it.
--   * LISTED or unlisted (Find a game, later), TWO_ADULTS (enforced by the
--     roster PR), PAID_BLOCK_MINUTES (timesheets, later).
--   * Sites get a map pin (lat, lng), and any Kaiārahi may add one.
--   * EVERY SESSION BELONGS TO A GAME. The 82 sessions so far were all at
--     AllSport HQ: each is matched to the HQ weekly game on its weekday within
--     90 minutes of the start (lib/weeklyGames.ts matchWeeklyGame), and the rest
--     (tests and ad-hoc games) each get a past, inactive, unlisted one-off
--     community game at HQ. Then sessions.weekly_game_id is NOT NULL.
--   * Who may start a game: a Kaiwhakawā, any game; a Kaimahi, a funded game
--     (with vetting and first aid current) or a community game they created;
--     a Kaiako, a community game they created. The roster PR narrows funded
--     games to the rostered Kaiārahi.
--   * The creator of a community game may post its notices and see who
--     registered, as a Kaiwhakawā can for every game.
--   * Fixes sessions.judge_id, which had no delete rule: since
--     20261123024501 stamps it, a Kaiārahi who ran a game could not have
--     deleted their account. It is now ON DELETE SET NULL.
--
-- Deploy order: code first. The new New Game screen always sends a game; the
-- old one could send none, which this migration refuses from now on.

BEGIN;

-- ── 1. Programmes ─────────────────────────────────────────────────────────────
CREATE TABLE public.programmes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  funder      text NOT NULL CHECK (length(btrim(funder)) BETWEEN 1 AND 120),
  starts_on   date NOT NULL,
  ends_on     date NOT NULL,
  -- What the application promised, e.g. {"weekly_rangatahi": 30}. Free form
  -- until the reports PR fixes the measures.
  targets     jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes       text CHECK (notes IS NULL OR length(notes) <= 2000),
  created_by  uuid DEFAULT auth.uid() REFERENCES public.players(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT programmes_dates_in_order CHECK (ends_on >= starts_on)
);
ALTER TABLE public.programmes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.programmes FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.programmes TO authenticated;
CREATE POLICY programmes_head_read ON public.programmes FOR SELECT TO authenticated USING (public.is_judge());
CREATE POLICY programmes_head_insert ON public.programmes FOR INSERT TO authenticated WITH CHECK (public.is_judge());
CREATE POLICY programmes_head_update ON public.programmes FOR UPDATE TO authenticated
  USING (public.is_judge()) WITH CHECK (public.is_judge());

-- ── 2. Sites: a map pin, and who added it ────────────────────────────────────
ALTER TABLE public.sites
  ADD COLUMN lat double precision CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  ADD COLUMN lng double precision CHECK (lng IS NULL OR lng BETWEEN -180 AND 180),
  ADD COLUMN created_by uuid DEFAULT auth.uid() REFERENCES public.players(id) ON DELETE SET NULL,
  ADD CONSTRAINT sites_pin_both CHECK ((lat IS NULL) = (lng IS NULL));

-- No pin is guessed for AllSport HQ: a wrong pin would mislead "nearest" on
-- Find a game. A Kaiwhakawā pins it from the site, with "Use where I am".

DROP POLICY sites_judge_insert ON public.sites;
CREATE POLICY sites_kaiarahi_insert ON public.sites FOR INSERT TO authenticated
  WITH CHECK (public.is_kaiarahi() AND created_by = auth.uid());
DROP POLICY sites_judge_update ON public.sites;
CREATE POLICY sites_head_or_creator_update ON public.sites FOR UPDATE TO authenticated
  USING (public.is_judge() OR (public.is_kaiarahi() AND created_by = auth.uid()))
  WITH CHECK (public.is_judge() OR (public.is_kaiarahi() AND created_by = auth.uid()));

-- ── 3. Games: funded or community, weekly or one-off ─────────────────────────
ALTER TABLE public.weekly_games
  ADD COLUMN kind text NOT NULL DEFAULT 'community' CHECK (kind IN ('funded', 'community')),
  ADD COLUMN programme_id uuid REFERENCES public.programmes(id) ON DELETE RESTRICT,
  ADD COLUMN one_off_date date,
  ADD COLUMN listed boolean NOT NULL DEFAULT true,
  ADD COLUMN two_adults boolean NOT NULL DEFAULT false,
  ADD COLUMN paid_block_minutes smallint CHECK (paid_block_minutes IS NULL OR paid_block_minutes BETWEEN 30 AND 600),
  ADD COLUMN regular_kaiarahi_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN created_by uuid DEFAULT auth.uid() REFERENCES public.players(id) ON DELETE SET NULL,
  -- A funded game has a programme; a community game has neither a programme
  -- nor paid time.
  ADD CONSTRAINT weekly_games_funded_has_programme CHECK (
    (kind = 'funded' AND programme_id IS NOT NULL)
    OR (kind = 'community' AND programme_id IS NULL AND paid_block_minutes IS NULL)
  ),
  -- A one-off carries the weekday of its own date.
  ADD CONSTRAINT weekly_games_one_off_weekday CHECK (
    one_off_date IS NULL OR dow = extract(dow FROM one_off_date)::int
  );

-- The old key forbade two one-offs at one site at the same time on different
-- Saturdays. Weekly games keep it; one-offs are unique per date.
ALTER TABLE public.weekly_games DROP CONSTRAINT weekly_games_site_id_dow_start_time_key;
CREATE UNIQUE INDEX weekly_games_weekly_slot_key ON public.weekly_games (site_id, dow, start_time)
  WHERE one_off_date IS NULL;
CREATE UNIQUE INDEX weekly_games_one_off_slot_key ON public.weekly_games (site_id, one_off_date, start_time)
  WHERE one_off_date IS NOT NULL;

-- created_by is the caller, and only a Kaiwhakawā makes or changes a funded
-- game. INVOKER: tests current_user, so server code and this migration pass.
CREATE OR REPLACE FUNCTION public.guard_weekly_games_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user <> 'authenticated' THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  IF NOT public.is_judge() THEN
    IF NEW.kind = 'funded' OR (TG_OP = 'UPDATE' AND OLD.kind = 'funded') THEN
      RAISE EXCEPTION 'games: only a Kaiwhakawā makes or changes a funded game' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER weekly_games_guard
  BEFORE INSERT OR UPDATE ON public.weekly_games
  FOR EACH ROW EXECUTE FUNCTION public.guard_weekly_games_write();

DROP POLICY weekly_games_judge_insert ON public.weekly_games;
CREATE POLICY weekly_games_kaiarahi_insert ON public.weekly_games FOR INSERT TO authenticated
  WITH CHECK (public.is_judge() OR (public.is_kaiarahi() AND kind = 'community'));
DROP POLICY weekly_games_judge_update ON public.weekly_games;
CREATE POLICY weekly_games_head_or_creator_update ON public.weekly_games FOR UPDATE TO authenticated
  USING (public.is_judge() OR (public.is_kaiarahi() AND kind = 'community' AND created_by = auth.uid()))
  WITH CHECK (public.is_judge() OR (public.is_kaiarahi() AND kind = 'community' AND created_by = auth.uid()));

-- Who manages a game's notices and sees who registered: a Kaiwhakawā, or the
-- creator of a community game. The roster PR adds the rostered Kaiārahi.
CREATE OR REPLACE FUNCTION public.manages_game(p_game_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_judge()
    OR (public.is_kaiarahi() AND EXISTS (
      SELECT 1 FROM weekly_games g
      WHERE g.id = p_game_id AND g.kind = 'community' AND g.created_by = auth.uid()
    ))
  );
$function$;

-- May the caller start a session of this game?
CREATE OR REPLACE FUNCTION public.can_start_game(p_game_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND p_game_id IS NOT NULL AND (
    public.is_judge()
    OR EXISTS (
      SELECT 1 FROM weekly_games g
      JOIN kaiarahi k ON k.player_id = auth.uid() AND k.suspended_at IS NULL
      WHERE g.id = p_game_id AND (
        (g.kind = 'community' AND g.created_by = auth.uid())
        OR (g.kind = 'funded' AND k.level = 'staff'
            AND k.vetting_expires >= (now() AT TIME ZONE 'Pacific/Auckland')::date
            AND k.first_aid_expires >= (now() AT TIME ZONE 'Pacific/Auckland')::date)
      )
    )
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.manages_game(uuid), public.can_start_game(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manages_game(uuid), public.can_start_game(uuid) TO authenticated;

DROP POLICY game_notices_judge_insert ON public.game_notices;
CREATE POLICY game_notices_manager_insert ON public.game_notices FOR INSERT TO authenticated
  WITH CHECK (public.manages_game(weekly_game_id) AND created_by = auth.uid());
DROP POLICY game_notices_judge_delete ON public.game_notices;
CREATE POLICY game_notices_manager_delete ON public.game_notices FOR DELETE TO authenticated
  USING (public.manages_game(weekly_game_id));

CREATE POLICY weekly_game_members_manager_read ON public.weekly_game_members FOR SELECT TO authenticated
  USING (public.manages_game(weekly_game_id));
CREATE POLICY weekly_game_absences_manager_read ON public.weekly_game_absences FOR SELECT TO authenticated
  USING (public.manages_game(weekly_game_id));

-- ── 4. Every session belongs to a game ───────────────────────────────────────
CREATE TABLE public.sessions_game_backfill_20261123 (
  session_id      uuid PRIMARY KEY,
  weekly_game_id  uuid NOT NULL,
  matched         text NOT NULL CHECK (matched IN ('weekly', 'one-off'))
);
ALTER TABLE public.sessions_game_backfill_20261123 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sessions_game_backfill_20261123 FROM anon, authenticated;

DO $backfill$
DECLARE
  v_hq    uuid;
  v_judge uuid;
  s       record;
  v_game  uuid;
  v_local timestamp;
BEGIN
  SELECT id INTO v_hq FROM sites WHERE name = 'AllSport HQ' ORDER BY created_at LIMIT 1;
  IF v_hq IS NULL THEN RAISE EXCEPTION 'backfill: no AllSport HQ site'; END IF;
  SELECT player_id INTO v_judge FROM kaiarahi WHERE level = 'head' ORDER BY granted_at LIMIT 1;

  FOR s IN SELECT id, started_at FROM sessions WHERE weekly_game_id IS NULL ORDER BY started_at LOOP
    v_local := s.started_at AT TIME ZONE 'Pacific/Auckland';
    -- The HQ weekly game on that weekday nearest the start, within 90 minutes.
    SELECT g.id INTO v_game
    FROM weekly_games g
    WHERE g.site_id = v_hq AND g.one_off_date IS NULL
      AND g.dow = extract(dow FROM v_local)::int
      AND abs(extract(epoch FROM (v_local::time - g.start_time)) / 60) <= 90
    ORDER BY abs(extract(epoch FROM (v_local::time - g.start_time)))
    LIMIT 1;

    IF v_game IS NOT NULL THEN
      INSERT INTO sessions_game_backfill_20261123 VALUES (s.id, v_game, 'weekly');
    ELSE
      -- Its own past one-off at HQ: inactive and unlisted, so it never shows as
      -- an upcoming game. Reuses one already made for the same minute.
      SELECT g.id INTO v_game FROM weekly_games g
      WHERE g.site_id = v_hq AND g.one_off_date = v_local::date
        AND g.start_time = date_trunc('minute', v_local)::time;
      IF v_game IS NULL THEN
        INSERT INTO weekly_games (site_id, dow, start_time, one_off_date, is_active, listed, kind, created_by)
        VALUES (v_hq, extract(dow FROM v_local)::int, date_trunc('minute', v_local)::time,
                v_local::date, false, false, 'community', v_judge)
        RETURNING id INTO v_game;
      END IF;
      INSERT INTO sessions_game_backfill_20261123 VALUES (s.id, v_game, 'one-off');
    END IF;
  END LOOP;
END
$backfill$;

-- The award and placement triggers fire on is_active changes only; this
-- touches weekly_game_id alone.
UPDATE public.sessions s SET weekly_game_id = b.weekly_game_id
FROM public.sessions_game_backfill_20261123 b
WHERE b.session_id = s.id AND s.weekly_game_id IS NULL;

ALTER TABLE public.sessions DROP CONSTRAINT sessions_weekly_game_id_fkey;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_weekly_game_id_fkey FOREIGN KEY (weekly_game_id)
    REFERENCES public.weekly_games(id) ON DELETE RESTRICT,
  ALTER COLUMN weekly_game_id SET NOT NULL;

ALTER TABLE public.sessions DROP CONSTRAINT sessions_judge_id_fkey;
ALTER TABLE public.sessions
  ADD CONSTRAINT sessions_judge_id_fkey FOREIGN KEY (judge_id)
    REFERENCES public.players(id) ON DELETE SET NULL;

-- Starting a game: any Kaiārahi, but only a game they may start.
DROP POLICY sessions_insert_judge ON public.sessions;
CREATE POLICY sessions_insert_judge ON public.sessions
  FOR INSERT WITH CHECK (public.is_kaiarahi() AND public.can_start_game(weekly_game_id));

-- A non-head may not move a game they run onto another game.
CREATE OR REPLACE FUNCTION public.guard_session_game()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF current_user = 'authenticated' AND NOT public.is_judge()
     AND NEW.weekly_game_id IS DISTINCT FROM OLD.weekly_game_id THEN
    RAISE EXCEPTION 'sessions: only a Kaiwhakawā can move a game to another game' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END
$function$;
CREATE TRIGGER session_zz_game_guard
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.guard_session_game();

-- ── 5. Check ─────────────────────────────────────────────────────────────────
DO $check$
DECLARE v_null int; v_back int; v_weekly int;
BEGIN
  SELECT count(*) INTO v_null FROM sessions WHERE weekly_game_id IS NULL;
  IF v_null > 0 THEN RAISE EXCEPTION 'games: % sessions without a game', v_null; END IF;
  SELECT count(*), count(*) FILTER (WHERE matched = 'weekly') INTO v_back, v_weekly
  FROM sessions_game_backfill_20261123;
  RAISE NOTICE 'games: % sessions back-filled, % to a weekly game', v_back, v_weekly;
  IF EXISTS (SELECT 1 FROM weekly_games WHERE kind = 'funded') THEN
    RAISE EXCEPTION 'games: no game should be funded yet';
  END IF;
END
$check$;

COMMIT;
