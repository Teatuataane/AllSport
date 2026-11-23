-- ─── Find a game (multi-location PR 10) ─────────────────────────────────────
-- MULTI_LOCATION_PLAN.md §2 "Find a game", step 10. Agreed with Tāne 24 Nov
-- 2026:
--
--   * A public page (/schedule, called Find a game) lists every listed game:
--     site, map, day and time, the status of its next date.
--   * Signed-in players also see the Kaiārahi leading that date and how many
--     are coming (counts come from booking_counts, 20261123214052). A
--     logged-out visitor sees neither.
--   * Unlisted games never appear. Until now `anon` could read every weekly
--     game and every notice through the API, unlisted school games included;
--     from here a logged-out visitor reads listed games only.
--   * Community games made by a Kaiako are public straight away.

-- ── 1. A logged-out visitor reads listed games only ──────────────────────────
-- Signed-in reads are unchanged here: HOME shows a player their unlisted
-- games and the walk-up offer reads a game by id. Narrowing those is in
-- TODOS.md ("Unlisted games: signed-in reads").
DROP POLICY IF EXISTS weekly_games_read ON public.weekly_games;
CREATE POLICY weekly_games_read ON public.weekly_games FOR SELECT TO authenticated USING (true);
CREATE POLICY weekly_games_read_listed ON public.weekly_games FOR SELECT TO anon USING (listed);

DROP POLICY IF EXISTS game_notices_read ON public.game_notices;
CREATE POLICY game_notices_read ON public.game_notices FOR SELECT TO authenticated USING (true);
CREATE POLICY game_notices_read_listed ON public.game_notices FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.weekly_games g WHERE g.id = weekly_game_id AND g.listed));

-- ── 2. Who leads each date, for signed-in players ───────────────────────────
-- One call for the whole page: the Kaiārahi leading each (game, date) asked,
-- by rostered_lead() (the roster row, else the regular, else a community
-- game's creator). Null when cover is still needed. Listed games only, unless
-- the caller is a Kaiārahi or registered to it (as booking_counts). Ids only:
-- the page reads the name and avatar from players_public. At most 50 pairs.
CREATE OR REPLACE FUNCTION public.game_leads(p_game_ids uuid[], p_dates date[])
 RETURNS TABLE (weekly_game_id uuid, game_date date, lead_id uuid)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF coalesce(array_length(p_game_ids, 1), 0) > 50
     OR coalesce(array_length(p_game_ids, 1), 0) <> coalesce(array_length(p_dates, 1), 0) THEN
    RAISE EXCEPTION 'find a game: up to 50 games and dates, in pairs' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT q.g, q.d, public.rostered_lead(q.g, q.d)
  FROM unnest(p_game_ids, p_dates) AS q(g, d)
  JOIN weekly_games w ON w.id = q.g AND w.is_active
  WHERE w.listed
     OR public.is_kaiarahi()
     OR EXISTS (SELECT 1 FROM weekly_game_members m
       WHERE m.weekly_game_id = q.g AND m.left_at IS NULL
         AND (m.player_id = auth.uid()
              OR EXISTS (SELECT 1 FROM players p WHERE p.id = m.player_id AND p.parent_id = auth.uid())));
END
$function$;

REVOKE EXECUTE ON FUNCTION public.game_leads(uuid[], date[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.game_leads(uuid[], date[]) TO authenticated;

-- ── 3. Check ─────────────────────────────────────────────────────────────────
DO $check$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename IN ('weekly_games', 'game_notices')
             AND cmd = 'SELECT' AND 'anon' = ANY (roles) AND qual = 'true') THEN
    RAISE EXCEPTION 'find a game check: anon still reads every game';
  END IF;
  IF has_function_privilege('anon', 'public.game_leads(uuid[], date[])', 'EXECUTE') THEN
    RAISE EXCEPTION 'find a game check: anon can read leads';
  END IF;
  RAISE NOTICE 'find a game: ready';
END
$check$;
