-- ─── Roster and cover (multi-location PR 7a) ─────────────────────────────────
-- MULTI_LOCATION_PLAN.md §2 "Roster and cover" and "Cancelling and moving",
-- agreed with Tāne 23 Nov 2026; split and alerts in the app (not push yet)
-- agreed 24 Nov 2026.
--
--   * Each game has a REGULAR Kaiārahi (weekly_games.regular_kaiarahi_id,
--     added by 20261123035106). A Kaiwhakawā sets it on any game; the creator
--     (or current regular) of a community game can hand it on.
--   * game_roster holds the exceptions for one date. No row: the regular
--     leads (for a community game with none, its creator). A lead row is
--     'cover_needed' (the rostered Kaiārahi asked for cover), 'covered' (the
--     first eligible Kaiārahi to claim it), or 'rostered' (a Kaiwhakawā put
--     someone on that date). rostered_lead(game, date) reads the answer.
--   * Who may lead: any current Kaiārahi for a community game; for a funded
--     game a Kaimahi or Kaiwhakawā whose vetting and first aid are current
--     (can_lead_game). A lapse blocks rostering, not playing.
--   * can_start_game() narrows to the rostered lead for today (a Kaiwhakawā
--     still starts any game). Until now any Kaimahi could start any funded
--     game; none exists yet, so nobody loses a game they run.
--   * The rostered lead manages the game's notices for that date, and the
--     regular manages the game (manages_game()).
--   * Cancelling or moving needs a REASON. A game cannot be cancelled for a
--     date once a session of it has started that day: void it instead.
--   * Writes to the roster go through the functions below only.
--
-- The 'second' role is for 7b (two adults, under-18 Kaiako, parent present);
-- the table allows it now so 7b adds no table.
--
-- Deploy order: code first. The app sends `reason` with a cancel or move and
-- retries without it while this column is missing; after this migration a
-- cancel or move without a reason is refused.

-- ── 1. Who may lead a game ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.can_lead_game(p_player_id uuid, p_game_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM weekly_games g
    JOIN kaiarahi k ON k.player_id = p_player_id AND k.suspended_at IS NULL
    WHERE g.id = p_game_id AND (
      g.kind = 'community'
      OR (k.level IN ('head', 'staff')
          AND k.vetting_expires >= (now() AT TIME ZONE 'Pacific/Auckland')::date
          AND k.first_aid_expires >= (now() AT TIME ZONE 'Pacific/Auckland')::date)
    )
  );
$function$;

-- ── 2. The roster ────────────────────────────────────────────────────────────
CREATE TABLE public.game_roster (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_game_id  uuid NOT NULL REFERENCES public.weekly_games(id) ON DELETE CASCADE,
  game_date       date NOT NULL,
  role            text NOT NULL DEFAULT 'lead' CHECK (role IN ('lead', 'second')),
  -- Who is (or was) rostered: for cover_needed, the one who asked.
  player_id       uuid REFERENCES public.players(id) ON DELETE SET NULL,
  -- A second adult with no account (a teacher), for 7b.
  helper_name     text CHECK (helper_name IS NULL OR length(btrim(helper_name)) BETWEEN 1 AND 80),
  status          text NOT NULL CHECK (status IN ('rostered', 'cover_needed', 'covered')),
  claimed_by      uuid REFERENCES public.players(id) ON DELETE SET NULL,
  claimed_at      timestamptz,
  note            text CHECK (note IS NULL OR length(note) <= 280),
  created_by      uuid DEFAULT auth.uid() REFERENCES public.players(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT game_roster_one_per_role UNIQUE (weekly_game_id, game_date, role),
  CONSTRAINT game_roster_covered_has_claimer CHECK ((status = 'covered') = (claimed_by IS NOT NULL))
);
CREATE INDEX game_roster_date_idx ON public.game_roster (game_date);
ALTER TABLE public.game_roster ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_roster FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.game_roster FROM authenticated;
-- Every Kaiārahi sees the roster, so covers can be offered and claimed.
CREATE POLICY game_roster_kaiarahi_read ON public.game_roster FOR SELECT TO authenticated
  USING (public.is_kaiarahi());

-- Who leads this game on this date. Null: nobody (cover needed, or no regular).
CREATE OR REPLACE FUNCTION public.rostered_lead(p_game_id uuid, p_date date)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN r.id IS NULL THEN COALESCE(g.regular_kaiarahi_id, CASE WHEN g.kind = 'community' THEN g.created_by END)
    WHEN r.status = 'covered' THEN r.claimed_by
    WHEN r.status = 'rostered' THEN r.player_id
    ELSE NULL
  END
  FROM weekly_games g
  LEFT JOIN game_roster r ON r.weekly_game_id = g.id AND r.game_date = p_date AND r.role = 'lead'
  WHERE g.id = p_game_id;
$function$;

-- ── 3. Roster writes ─────────────────────────────────────────────────────────
-- The regular Kaiārahi. A Kaiwhakawā on any game; on a community game also its
-- creator or current regular (handing it on). Null clears it.
CREATE OR REPLACE FUNCTION public.set_regular_kaiarahi(p_game_id uuid, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g weekly_games%ROWTYPE;
BEGIN
  SELECT * INTO g FROM weekly_games WHERE id = p_game_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'roster: no such game' USING ERRCODE = '22023'; END IF;
  IF NOT (public.is_judge() OR (public.is_kaiarahi() AND g.kind = 'community'
          AND auth.uid() IN (g.created_by, g.regular_kaiarahi_id))) THEN
    RAISE EXCEPTION 'roster: not yours to hand on' USING ERRCODE = '42501';
  END IF;
  IF p_player_id IS NOT NULL AND NOT public.can_lead_game(p_player_id, p_game_id) THEN
    RAISE EXCEPTION 'roster: that person cannot lead this game (a funded game needs a Kaimahi with current vetting and first aid)'
      USING ERRCODE = '22023';
  END IF;
  UPDATE weekly_games SET regular_kaiarahi_id = p_player_id WHERE id = p_game_id;
END
$function$;

-- The rostered lead (or a Kaiwhakawā) asks for cover for one date.
CREATE OR REPLACE FUNCTION public.request_cover(p_game_id uuid, p_date date, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_lead uuid;
BEGIN
  IF p_date < (now() AT TIME ZONE 'Pacific/Auckland')::date THEN
    RAISE EXCEPTION 'roster: that date has passed' USING ERRCODE = '22023';
  END IF;
  v_lead := public.rostered_lead(p_game_id, p_date);
  IF NOT (public.is_judge() OR (public.is_kaiarahi() AND v_lead = auth.uid())) THEN
    RAISE EXCEPTION 'roster: only the rostered Kaiārahi can ask for cover' USING ERRCODE = '42501';
  END IF;
  INSERT INTO game_roster (weekly_game_id, game_date, role, player_id, status, note, created_by)
  VALUES (p_game_id, p_date, 'lead', v_lead, 'cover_needed', NULLIF(btrim(p_note), ''), auth.uid())
  ON CONFLICT (weekly_game_id, game_date, role) DO UPDATE
    SET player_id = EXCLUDED.player_id, status = 'cover_needed', claimed_by = NULL, claimed_at = NULL,
        note = EXCLUDED.note, updated_at = now();
END
$function$;

-- The first eligible Kaiārahi to claim takes the slot. No approval.
CREATE OR REPLACE FUNCTION public.claim_cover(p_game_id uuid, p_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r game_roster%ROWTYPE;
BEGIN
  SELECT * INTO r FROM game_roster
   WHERE weekly_game_id = p_game_id AND game_date = p_date AND role = 'lead' FOR UPDATE;
  IF NOT FOUND OR r.status <> 'cover_needed' THEN
    RAISE EXCEPTION 'roster: no cover needed (someone may have claimed it)' USING ERRCODE = 'P0002';
  END IF;
  IF p_date < (now() AT TIME ZONE 'Pacific/Auckland')::date THEN
    RAISE EXCEPTION 'roster: that date has passed' USING ERRCODE = '22023';
  END IF;
  IF auth.uid() IS NULL OR NOT public.can_lead_game(auth.uid(), p_game_id) THEN
    RAISE EXCEPTION 'roster: you cannot lead this game (a funded game needs a Kaimahi with current vetting and first aid)'
      USING ERRCODE = '42501';
  END IF;
  UPDATE game_roster SET status = 'covered', claimed_by = auth.uid(), claimed_at = now(), updated_at = now()
   WHERE id = r.id;
END
$function$;

-- Undo for one date: the one who asked (or a Kaiwhakawā) withdraws a request
-- still open, which puts the regular back; the one who claimed a cover (or a
-- Kaiwhakawā) gives it back, which opens it again.
CREATE OR REPLACE FUNCTION public.release_cover(p_game_id uuid, p_date date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r game_roster%ROWTYPE;
BEGIN
  SELECT * INTO r FROM game_roster
   WHERE weekly_game_id = p_game_id AND game_date = p_date AND role = 'lead' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'roster: nothing to undo' USING ERRCODE = 'P0002'; END IF;
  IF r.status = 'cover_needed' AND (public.is_judge() OR r.player_id = auth.uid()) THEN
    DELETE FROM game_roster WHERE id = r.id;
  ELSIF r.status = 'covered' AND (public.is_judge() OR r.claimed_by = auth.uid()) THEN
    UPDATE game_roster SET status = 'cover_needed', claimed_by = NULL, claimed_at = NULL, updated_at = now()
     WHERE id = r.id;
  ELSIF r.status = 'rostered' AND public.is_judge() THEN
    DELETE FROM game_roster WHERE id = r.id;
  ELSE
    RAISE EXCEPTION 'roster: not yours to undo' USING ERRCODE = '42501';
  END IF;
END
$function$;

-- A Kaiwhakawā puts someone on one date (an unfilled cover, say).
CREATE OR REPLACE FUNCTION public.roster_lead(p_game_id uuid, p_date date, p_player_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'roster: only a Kaiwhakawā rosters a date' USING ERRCODE = '42501';
  END IF;
  IF NOT public.can_lead_game(p_player_id, p_game_id) THEN
    RAISE EXCEPTION 'roster: that person cannot lead this game (a funded game needs a Kaimahi with current vetting and first aid)'
      USING ERRCODE = '22023';
  END IF;
  INSERT INTO game_roster (weekly_game_id, game_date, role, player_id, status, created_by)
  VALUES (p_game_id, p_date, 'lead', p_player_id, 'rostered', auth.uid())
  ON CONFLICT (weekly_game_id, game_date, role) DO UPDATE
    SET player_id = EXCLUDED.player_id, status = 'rostered', claimed_by = NULL, claimed_at = NULL, updated_at = now();
END
$function$;

-- Names of the Kaiārahi a Kaiārahi may hand a game to or roster: player name
-- and level only, never contact details. For the pickers.
CREATE OR REPLACE FUNCTION public.kaiarahi_directory()
 RETURNS TABLE (player_id uuid, display_name text, level text, funded_ok boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT k.player_id, COALESCE(pp.display_name, pp.username, 'Kaiārahi'), k.level,
         (k.level IN ('head', 'staff')
          AND k.vetting_expires >= (now() AT TIME ZONE 'Pacific/Auckland')::date
          AND k.first_aid_expires >= (now() AT TIME ZONE 'Pacific/Auckland')::date)
  FROM kaiarahi k
  JOIN players_public pp ON pp.id = k.player_id
  WHERE k.suspended_at IS NULL AND public.is_kaiarahi()
  ORDER BY 2;
$function$;

-- ── 4. Starting and managing a game ──────────────────────────────────────────
-- A Kaiwhakawā starts any game; anyone else only the game they lead today.
CREATE OR REPLACE FUNCTION public.can_start_game(p_game_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT auth.uid() IS NOT NULL AND p_game_id IS NOT NULL AND (
    public.is_judge()
    -- COALESCE: with nobody rostered the comparison is NULL; say false.
    OR COALESCE(public.rostered_lead(p_game_id, (now() AT TIME ZONE 'Pacific/Auckland')::date) = auth.uid(), false)
       AND public.can_lead_game(auth.uid(), p_game_id)
  );
$function$;

-- A Kaiwhakawā, the creator of a community game, or the game's regular.
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
      WHERE g.id = p_game_id AND (
        (g.kind = 'community' AND g.created_by = auth.uid())
        OR g.regular_kaiarahi_id = auth.uid()
      )
    ))
  );
$function$;

REVOKE EXECUTE ON FUNCTION public.can_lead_game(uuid, uuid), public.rostered_lead(uuid, date),
  public.set_regular_kaiarahi(uuid, uuid), public.request_cover(uuid, date, text),
  public.claim_cover(uuid, date), public.release_cover(uuid, date), public.roster_lead(uuid, date, uuid),
  public.kaiarahi_directory(), public.can_start_game(uuid), public.manages_game(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_lead_game(uuid, uuid), public.rostered_lead(uuid, date),
  public.set_regular_kaiarahi(uuid, uuid), public.request_cover(uuid, date, text),
  public.claim_cover(uuid, date), public.release_cover(uuid, date), public.roster_lead(uuid, date, uuid),
  public.kaiarahi_directory(), public.can_start_game(uuid), public.manages_game(uuid)
  TO authenticated;

-- ── 5. Cancelling and moving: a reason, and only before it starts ────────────
ALTER TABLE public.game_notices
  ADD COLUMN reason text CHECK (reason IS NULL OR reason IN ('weather', 'no_kaiarahi', 'few_players', 'venue', 'other')),
  ADD CONSTRAINT game_notices_reason_needed CHECK (kind NOT IN ('cancelled', 'moved') OR reason IS NOT NULL),
  ADD CONSTRAINT game_notices_other_explained CHECK (reason IS DISTINCT FROM 'other' OR length(btrim(COALESCE(message, ''))) > 0);

-- The rostered lead for that date may post its notices too.
DROP POLICY game_notices_manager_insert ON public.game_notices;
CREATE POLICY game_notices_manager_insert ON public.game_notices FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid() AND (
    public.manages_game(weekly_game_id)
    OR (public.is_kaiarahi() AND public.rostered_lead(weekly_game_id, game_date) = auth.uid())
  ));

-- Once a session of the game has started that day it can only be voided.
CREATE OR REPLACE FUNCTION public.guard_game_notice_write()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.kind = 'cancelled' AND EXISTS (
    SELECT 1 FROM sessions s
    WHERE s.weekly_game_id = NEW.weekly_game_id AND s.session_date = NEW.game_date AND s.voided_at IS NULL
  ) THEN
    RAISE EXCEPTION 'notices: this game has started; void it instead of cancelling' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END
$function$;

CREATE TRIGGER game_notices_guard
  BEFORE INSERT ON public.game_notices
  FOR EACH ROW EXECUTE FUNCTION public.guard_game_notice_write();

-- ── 6. Check ─────────────────────────────────────────────────────────────────
DO $check$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.game_roster'::regclass) THEN
    RAISE EXCEPTION 'roster check: RLS is off on game_roster';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'game_roster' AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'roster check: game_roster has a write policy';
  END IF;
  IF has_function_privilege('anon', 'public.claim_cover(uuid, date)', 'EXECUTE') THEN
    RAISE EXCEPTION 'roster check: anon can claim covers';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname IN ('can_lead_game', 'rostered_lead', 'set_regular_kaiarahi', 'request_cover', 'claim_cover',
                        'release_cover', 'roster_lead', 'kaiarahi_directory', 'can_start_game', 'manages_game')
      AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) c WHERE c LIKE 'search_path=%')
  ) THEN
    RAISE EXCEPTION 'roster check: a definer function has no search_path';
  END IF;
  RAISE NOTICE 'roster: ready';
END
$check$;
