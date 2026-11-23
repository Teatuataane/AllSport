-- ─── Bookings: "Coming?" per game and date (multi-location PR 8) ────────────
-- MULTI_LOCATION_PLAN.md §2 "Players and bookings", step 8. Agreed with Tāne
-- 24 Nov 2026: in the app now, push and email (and the signed email links for
-- parents with no account) when that branch lands.
--
--   * A player (or their parent) answers Yes or Not this time for one date of
--     one game. Booking is never required: walk-ups still play.
--   * Players see COUNTS only ("6 coming, 3 not, 11 haven't said"), never names.
--   * The Kaiārahi running that date (the lead, the game's manager, or a
--     Kaiwhakawā) reads the names, to tick people off at the game.
--   * The old away dates (weekly_game_absences) become a No, and new ones are
--     written here instead.
--
-- Answers are written only through set_booking(), which checks the date is a
-- real date of that game and that it has not started yet.

-- ── 1. The table ─────────────────────────────────────────────────────────────
CREATE TABLE public.game_bookings (
  weekly_game_id uuid NOT NULL REFERENCES public.weekly_games(id) ON DELETE CASCADE,
  game_date      date NOT NULL,
  player_id      uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  answer         text NOT NULL CHECK (answer IN ('yes', 'no')),
  -- Who tapped it: the player, or their parent.
  answered_by    uuid REFERENCES public.players(id) ON DELETE SET NULL,
  answered_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (weekly_game_id, game_date, player_id)
);
CREATE INDEX game_bookings_player_idx ON public.game_bookings (player_id, game_date);

ALTER TABLE public.game_bookings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_bookings FROM anon, authenticated;
GRANT SELECT ON public.game_bookings TO authenticated;

-- Your own answers and your children's (can_log_for, which includes a
-- Kaiwhakawā), and every answer for a date you run.
CREATE POLICY game_bookings_read ON public.game_bookings FOR SELECT TO authenticated
  USING (
    public.can_log_for(player_id)
    OR (public.is_kaiarahi() AND (
      public.manages_game(weekly_game_id)
      OR COALESCE(public.rostered_lead(weekly_game_id, game_date) = auth.uid(), false)
    ))
  );
-- No write policy: set_booking() below is the only way in.

-- ── 2. Answering ─────────────────────────────────────────────────────────────
-- p_answer 'yes' or 'no'; null takes the answer back.
CREATE OR REPLACE FUNCTION public.set_booking(p_game_id uuid, p_date date, p_player_id uuid, p_answer text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g weekly_games%ROWTYPE;
BEGIN
  -- The player, or their parent. Not a Kaiwhakawā on someone's behalf: an
  -- answer is the player's word.
  IF auth.uid() IS NULL OR NOT (
    p_player_id = auth.uid()
    OR EXISTS (SELECT 1 FROM players WHERE id = p_player_id AND parent_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'bookings: you can answer only for yourself or your children' USING ERRCODE = '42501';
  END IF;
  IF p_answer IS NOT NULL AND p_answer NOT IN ('yes', 'no') THEN
    RAISE EXCEPTION 'bookings: answer yes or no' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO g FROM weekly_games WHERE id = p_game_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'bookings: no such game' USING ERRCODE = '22023';
  END IF;
  -- A real date of this game: the one-off's date, or the weekly game's day.
  IF (g.one_off_date IS NOT NULL AND p_date <> g.one_off_date)
     OR (g.one_off_date IS NULL AND extract(dow FROM p_date)::int <> g.dow) THEN
    RAISE EXCEPTION 'bookings: the game is not on that date' USING ERRCODE = '22023';
  END IF;
  IF ((p_date + g.start_time) AT TIME ZONE 'Pacific/Auckland') <= now() THEN
    RAISE EXCEPTION 'bookings: that game has started' USING ERRCODE = '22023';
  END IF;
  IF p_answer IS NULL THEN
    DELETE FROM game_bookings
    WHERE weekly_game_id = p_game_id AND game_date = p_date AND player_id = p_player_id;
  ELSE
    INSERT INTO game_bookings (weekly_game_id, game_date, player_id, answer, answered_by)
    VALUES (p_game_id, p_date, p_player_id, p_answer, auth.uid())
    ON CONFLICT (weekly_game_id, game_date, player_id) DO UPDATE
      SET answer = EXCLUDED.answer, answered_by = EXCLUDED.answered_by, answered_at = now();
  END IF;
END
$function$;

-- ── 3. Counts, never names ───────────────────────────────────────────────────
-- For each (game, date) asked: Yes answers, No answers, and players registered
-- to the game who have not answered. An unlisted game (a school game) only for
-- a Kaiārahi or someone in a household registered to it. At most 50 pairs.
CREATE OR REPLACE FUNCTION public.booking_counts(p_game_ids uuid[], p_dates date[])
 RETURNS TABLE (weekly_game_id uuid, game_date date, coming integer, not_coming integer, unanswered integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF coalesce(array_length(p_game_ids, 1), 0) > 50
     OR coalesce(array_length(p_game_ids, 1), 0) <> coalesce(array_length(p_dates, 1), 0) THEN
    RAISE EXCEPTION 'bookings: up to 50 games and dates, in pairs' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT q.g, q.d,
    (SELECT count(*) FROM game_bookings b
      WHERE b.weekly_game_id = q.g AND b.game_date = q.d AND b.answer = 'yes')::int,
    (SELECT count(*) FROM game_bookings b
      WHERE b.weekly_game_id = q.g AND b.game_date = q.d AND b.answer = 'no')::int,
    (SELECT count(*) FROM weekly_game_members m
      WHERE m.weekly_game_id = q.g AND m.left_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM game_bookings b
          WHERE b.weekly_game_id = q.g AND b.game_date = q.d AND b.player_id = m.player_id))::int
  FROM unnest(p_game_ids, p_dates) AS q(g, d)
  JOIN weekly_games w ON w.id = q.g
  WHERE w.listed
     OR public.is_kaiarahi()
     OR EXISTS (SELECT 1 FROM weekly_game_members m
       WHERE m.weekly_game_id = q.g AND m.left_at IS NULL
         AND (m.player_id = auth.uid()
              OR EXISTS (SELECT 1 FROM players p WHERE p.id = m.player_id AND p.parent_id = auth.uid())));
END
$function$;

REVOKE EXECUTE ON FUNCTION public.set_booking(uuid, date, uuid, text), public.booking_counts(uuid[], date[])
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_booking(uuid, date, uuid, text), public.booking_counts(uuid[], date[])
  TO authenticated;

-- ── 4. Away dates become a No ────────────────────────────────────────────────
INSERT INTO public.game_bookings (weekly_game_id, game_date, player_id, answer, answered_by, answered_at)
SELECT a.weekly_game_id, a.game_date, a.player_id, 'no', a.player_id, a.created_at
FROM public.weekly_game_absences a
WHERE a.game_date >= (now() AT TIME ZONE 'Pacific/Auckland')::date
ON CONFLICT DO NOTHING;

-- Nothing writes away dates any more; an old open tab that tries is told it
-- did not save rather than writing somewhere nobody reads.
REVOKE INSERT ON public.weekly_game_absences FROM authenticated;

-- ── 5. Check ─────────────────────────────────────────────────────────────────
DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.game_bookings'::regclass) THEN
    RAISE EXCEPTION 'bookings check: RLS is off';
  END IF;
  IF has_table_privilege('authenticated', 'public.game_bookings', 'INSERT')
     OR has_table_privilege('anon', 'public.game_bookings', 'SELECT') THEN
    RAISE EXCEPTION 'bookings check: writes or anon reads are open';
  END IF;
  IF has_function_privilege('anon', 'public.booking_counts(uuid[], date[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'bookings check: anon can read counts';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.weekly_game_absences a
    WHERE a.game_date >= (now() AT TIME ZONE 'Pacific/Auckland')::date
      AND NOT EXISTS (SELECT 1 FROM public.game_bookings b
        WHERE b.weekly_game_id = a.weekly_game_id AND b.game_date = a.game_date AND b.player_id = a.player_id)
  ) THEN
    RAISE EXCEPTION 'bookings check: an away date was not copied';
  END IF;
  RAISE NOTICE 'bookings: ready';
END
$check$;
