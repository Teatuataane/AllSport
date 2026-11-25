-- ─── Timesheets (multi-location games step 12, v0.71.0.0) ───────────────────
-- MULTI_LOCATION_PLAN.md §2 "Pay". Agreed with Tāne, 24 to 25 Nov 2026:
--
--   · The app holds hours and approvals only. Rates, bank accounts and tax stay
--     in the payroll system.
--   · A funded game makes its lines WHEN IT STARTS: the lead (whoever started
--     it) and the second adult, each the game's fixed block. A game that never
--     starts makes no line ("paid only if they ran it").
--   · Only a Kaimahi or a Kaiwhakawā gets a line. A Kaiako who is the second
--     adult gets none (Tāne: "No line at all"); nor does a named helper.
--   · Fortnights, the first starting Monday 8 Feb 2027 (the first work day).
--   · A game where nobody scored is flagged; the Kaiwhakawā chooses Pay or
--     Don't pay. So is a game voided or deleted afterwards.
--   · A Kaimahi may query their own line with a note; the line is held out of
--     approval until the Kaiwhakawā settles it. A missing game is added by hand.
--   · The Kaiwhakawā approves the fortnight once it has ended; held lines wait.
--     The export (two CSVs, per Kaiārahi and per programme) is made in the
--     browser from the approved lines.
--
-- No write policy on timesheet_lines: the start trigger and the functions
-- below are the only way in. Apply AFTER the v0.71.0.0 code deploys.

-- ── 1. The fortnight ──────────────────────────────────────────────────────────
-- Mirrors periodStart in lib/timesheets.ts. Dates before the anchor fall in
-- fortnights counted back from it.
CREATE OR REPLACE FUNCTION public.pay_period_start(p_date date)
 RETURNS date
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT DATE '2027-02-08' + 14 * floor((p_date - DATE '2027-02-08') / 14.0)::int;
$function$;

-- ── 2. The lines ──────────────────────────────────────────────────────────────
CREATE TABLE public.timesheet_lines (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       uuid NOT NULL REFERENCES public.players(id) ON DELETE RESTRICT,
  -- Null for a line added by hand, or when the game was deleted afterwards.
  session_id      uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  weekly_game_id  uuid REFERENCES public.weekly_games(id) ON DELETE SET NULL,
  programme_id    uuid REFERENCES public.programmes(id) ON DELETE RESTRICT,
  game_date       date NOT NULL,
  period_start    date GENERATED ALWAYS AS (public.pay_period_start(game_date)) STORED,
  role            text NOT NULL CHECK (role IN ('lead', 'second')),
  minutes         smallint NOT NULL CHECK (minutes BETWEEN 0 AND 600),
  source          text NOT NULL CHECK (source IN ('start', 'manual')),
  -- The Kaiwhakawā's choice on a flagged or queried line.
  decision        text CHECK (decision IS NULL OR decision IN ('pay', 'no_pay')),
  query_note      text CHECK (query_note IS NULL OR length(btrim(query_note)) BETWEEN 1 AND 280),
  query_at        timestamptz,
  answer          text CHECK (answer IS NULL OR length(answer) <= 280),
  settled_at      timestamptz,
  settled_by      uuid REFERENCES public.players(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  approved_by     uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_by      uuid REFERENCES public.players(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT timesheet_lines_query_has_time CHECK ((query_note IS NULL) = (query_at IS NULL)),
  CONSTRAINT timesheet_lines_one_per_game UNIQUE (session_id, player_id)
);
CREATE INDEX timesheet_lines_period_idx ON public.timesheet_lines (period_start);
CREATE INDEX timesheet_lines_player_idx ON public.timesheet_lines (player_id, period_start);

ALTER TABLE public.timesheet_lines ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.timesheet_lines FROM anon, authenticated;
GRANT SELECT ON public.timesheet_lines TO authenticated;
CREATE POLICY timesheet_lines_read ON public.timesheet_lines FOR SELECT TO authenticated
  USING (player_id = auth.uid() OR public.is_judge());

-- Whether a Kaimahi or a Kaiwhakawā (current, not suspended): the paid levels.
CREATE OR REPLACE FUNCTION public.is_paid_kaiarahi(p_player_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM kaiarahi k
    WHERE k.player_id = p_player_id AND k.level IN ('head', 'staff') AND k.suspended_at IS NULL
  );
$function$;
REVOKE EXECUTE ON FUNCTION public.is_paid_kaiarahi(uuid) FROM PUBLIC, anon, authenticated;

-- ── 3. Lines made when a funded game starts ──────────────────────────────────
-- AFTER INSERT, so judge_id (session_zz_runner_guard) and session_date are set
-- and the start rules (session_zzz_adults_guard) have already passed.
CREATE OR REPLACE FUNCTION public.make_timesheet_lines()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g weekly_games%ROWTYPE;
  v_second uuid;
BEGIN
  IF NEW.weekly_game_id IS NULL THEN RETURN NEW; END IF;
  SELECT * INTO g FROM weekly_games WHERE id = NEW.weekly_game_id;
  IF NOT FOUND OR g.kind <> 'funded' OR g.paid_block_minutes IS NULL THEN RETURN NEW; END IF;

  IF NEW.judge_id IS NOT NULL AND public.is_paid_kaiarahi(NEW.judge_id) THEN
    INSERT INTO timesheet_lines (player_id, session_id, weekly_game_id, programme_id, game_date, role, minutes, source)
    VALUES (NEW.judge_id, NEW.id, g.id, g.programme_id, NEW.session_date, 'lead', g.paid_block_minutes, 'start')
    ON CONFLICT (session_id, player_id) DO NOTHING;
  END IF;

  SELECT r.player_id INTO v_second FROM game_roster r
  WHERE r.weekly_game_id = g.id AND r.game_date = NEW.session_date AND r.role = 'second';
  IF v_second IS NOT NULL AND v_second IS DISTINCT FROM NEW.judge_id AND public.is_paid_kaiarahi(v_second) THEN
    INSERT INTO timesheet_lines (player_id, session_id, weekly_game_id, programme_id, game_date, role, minutes, source)
    VALUES (v_second, NEW.id, g.id, g.programme_id, NEW.session_date, 'second', g.paid_block_minutes, 'start')
    ON CONFLICT (session_id, player_id) DO NOTHING;
  END IF;
  RETURN NEW;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.make_timesheet_lines() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER session_timesheet_lines
  AFTER INSERT ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.make_timesheet_lines();

-- ── 4. Why a line is held ─────────────────────────────────────────────────────
-- Mirrors heldReason in lib/timesheets.ts. Null when the line can be approved.
--   'query'      the Kaimahi queried it and it is not settled
--   'no_game'    the game was deleted afterwards
--   'voided'     the game was voided
--   'no_players' nobody scored
-- The last three apply to lines made at the start, until the Kaiwhakawā decides.
CREATE OR REPLACE FUNCTION public.timesheet_held_reason(p_line_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN l.query_at IS NOT NULL AND (l.settled_at IS NULL OR l.settled_at < l.query_at) THEN 'query'
    WHEN l.decision IS NOT NULL OR l.source <> 'start' THEN NULL
    WHEN l.session_id IS NULL THEN 'no_game'
    WHEN s.voided_at IS NOT NULL THEN 'voided'
    WHEN NOT EXISTS (SELECT 1 FROM results r WHERE r.session_id = l.session_id) THEN 'no_players'
  END
  FROM timesheet_lines l
  LEFT JOIN sessions s ON s.id = l.session_id
  WHERE l.id = p_line_id;
$function$;
REVOKE EXECUTE ON FUNCTION public.timesheet_held_reason(uuid) FROM PUBLIC, anon, authenticated;

-- ── 5. Reading a fortnight ────────────────────────────────────────────────────
-- A Kaiwhakawā reads every line; anyone else their own. Names, the game's site,
-- the programme, players who scored, and the held reason in one call.
CREATE OR REPLACE FUNCTION public.timesheet_period(p_start date)
 RETURNS TABLE (
   id uuid, player_id uuid, name text, weekly_game_id uuid, site_name text,
   programme_id uuid, programme_name text, game_date date, role text, minutes smallint,
   source text, players integer, held text, decision text, query_note text, query_at timestamptz,
   answer text, settled_at timestamptz, approved_at timestamptz
 )
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT l.id, l.player_id,
    CASE WHEN public.is_judge() THEN COALESCE(NULLIF(btrim(p.full_name), ''), p.display_name, p.username)
         ELSE COALESCE(p.display_name, p.username) END,
    l.weekly_game_id, st.name, l.programme_id, pr.name, l.game_date, l.role, l.minutes,
    l.source,
    (SELECT count(DISTINCT r.player_id)::int FROM results r WHERE l.session_id IS NOT NULL AND r.session_id = l.session_id),
    CASE WHEN l.approved_at IS NULL THEN public.timesheet_held_reason(l.id) END,
    l.decision, l.query_note, l.query_at, l.answer, l.settled_at, l.approved_at
  FROM timesheet_lines l
  JOIN players p ON p.id = l.player_id
  LEFT JOIN weekly_games g ON g.id = l.weekly_game_id
  LEFT JOIN sites st ON st.id = g.site_id
  LEFT JOIN programmes pr ON pr.id = l.programme_id
  WHERE l.period_start = public.pay_period_start(p_start)
    AND auth.uid() IS NOT NULL
    AND (public.is_judge() OR l.player_id = auth.uid())
  ORDER BY l.game_date, l.player_id;
$function$;
REVOKE EXECUTE ON FUNCTION public.timesheet_period(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.timesheet_period(date) TO authenticated;

-- ── 6. A Kaimahi queries their own line ──────────────────────────────────────
-- Before approval only. A new query reopens a settled line.
CREATE OR REPLACE FUNCTION public.query_timesheet_line(p_line_id uuid, p_note text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l timesheet_lines%ROWTYPE;
BEGIN
  SELECT * INTO l FROM timesheet_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND OR l.player_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'timesheets: not your line' USING ERRCODE = '42501';
  END IF;
  IF l.approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'timesheets: this fortnight is approved; ask the Kaiwhakawā' USING ERRCODE = '23514';
  END IF;
  IF p_note IS NULL OR length(btrim(p_note)) NOT BETWEEN 1 AND 280 THEN
    RAISE EXCEPTION 'timesheets: write a short note (up to 280 characters)' USING ERRCODE = '22023';
  END IF;
  UPDATE timesheet_lines SET query_note = btrim(p_note), query_at = now() WHERE id = p_line_id;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.query_timesheet_line(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.query_timesheet_line(uuid, text) TO authenticated;

-- ── 7. The Kaiwhakawā settles a line ─────────────────────────────────────────
-- Pay or Don't pay, optionally a corrected number of minutes and an answer.
CREATE OR REPLACE FUNCTION public.settle_timesheet_line(p_line_id uuid, p_pay boolean, p_minutes integer DEFAULT NULL, p_answer text DEFAULT NULL)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  l timesheet_lines%ROWTYPE;
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'timesheets: only a Kaiwhakawā can settle a line' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO l FROM timesheet_lines WHERE id = p_line_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'timesheets: no such line' USING ERRCODE = '22023'; END IF;
  IF l.approved_at IS NOT NULL THEN
    RAISE EXCEPTION 'timesheets: this line is already approved' USING ERRCODE = '23514';
  END IF;
  IF p_pay IS NULL THEN RAISE EXCEPTION 'timesheets: choose Pay or Don''t pay' USING ERRCODE = '22023'; END IF;
  IF p_minutes IS NOT NULL AND p_minutes NOT BETWEEN 0 AND 600 THEN
    RAISE EXCEPTION 'timesheets: minutes must be 0 to 600' USING ERRCODE = '22023';
  END IF;
  UPDATE timesheet_lines SET
    decision   = CASE WHEN p_pay THEN 'pay' ELSE 'no_pay' END,
    minutes    = COALESCE(p_minutes, minutes),
    answer     = NULLIF(btrim(coalesce(p_answer, '')), ''),
    settled_at = now(),
    settled_by = auth.uid()
  WHERE id = p_line_id;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.settle_timesheet_line(uuid, boolean, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_timesheet_line(uuid, boolean, integer, text) TO authenticated;

-- ── 8. The Kaiwhakawā adds a missing line ────────────────────────────────────
-- For a funded game; the person must be a Kaimahi or a Kaiwhakawā.
CREATE OR REPLACE FUNCTION public.add_timesheet_line(
  p_player_id uuid, p_game_id uuid, p_date date, p_role text, p_minutes integer DEFAULT NULL, p_note text DEFAULT NULL
)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  g weekly_games%ROWTYPE;
  v_id uuid;
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'timesheets: only a Kaiwhakawā can add a line' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO g FROM weekly_games WHERE id = p_game_id;
  IF NOT FOUND OR g.kind <> 'funded' THEN
    RAISE EXCEPTION 'timesheets: only a funded game has timesheet lines' USING ERRCODE = '22023';
  END IF;
  IF NOT public.is_paid_kaiarahi(p_player_id) THEN
    RAISE EXCEPTION 'timesheets: only a Kaimahi or a Kaiwhakawā is paid' USING ERRCODE = '22023';
  END IF;
  IF p_role IS NULL OR p_role NOT IN ('lead', 'second') THEN
    RAISE EXCEPTION 'timesheets: role is lead or second' USING ERRCODE = '22023';
  END IF;
  IF p_date IS NULL OR p_date > (now() AT TIME ZONE 'Pacific/Auckland')::date THEN
    RAISE EXCEPTION 'timesheets: the date must be today or earlier' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(p_minutes, g.paid_block_minutes) IS NULL OR COALESCE(p_minutes, g.paid_block_minutes) NOT BETWEEN 0 AND 600 THEN
    RAISE EXCEPTION 'timesheets: minutes must be 0 to 600' USING ERRCODE = '22023';
  END IF;
  INSERT INTO timesheet_lines (player_id, weekly_game_id, programme_id, game_date, role, minutes, source, decision, answer, settled_at, settled_by, created_by)
  VALUES (p_player_id, g.id, g.programme_id, p_date, p_role, COALESCE(p_minutes, g.paid_block_minutes), 'manual',
          'pay', NULLIF(btrim(coalesce(p_note, '')), ''), now(), auth.uid(), auth.uid())
  RETURNING id INTO v_id;
  RETURN v_id;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.add_timesheet_line(uuid, uuid, date, text, integer, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_timesheet_line(uuid, uuid, date, text, integer, text) TO authenticated;

-- ── 9. The Kaiwhakawā approves a fortnight ───────────────────────────────────
-- Once it has ended. Approves every line not held; held lines wait, and can be
-- approved by running it again once settled. Returns how many were approved.
CREATE OR REPLACE FUNCTION public.approve_timesheet_period(p_start date)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_start date := public.pay_period_start(p_start);
  v_count integer;
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'timesheets: only a Kaiwhakawā can approve' USING ERRCODE = '42501';
  END IF;
  IF v_start + 14 > (now() AT TIME ZONE 'Pacific/Auckland')::date THEN
    RAISE EXCEPTION 'timesheets: this fortnight has not ended yet' USING ERRCODE = '23514';
  END IF;
  UPDATE timesheet_lines l SET approved_at = now(), approved_by = auth.uid()
  WHERE l.period_start = v_start AND l.approved_at IS NULL
    AND public.timesheet_held_reason(l.id) IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END
$function$;
REVOKE EXECUTE ON FUNCTION public.approve_timesheet_period(date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.approve_timesheet_period(date) TO authenticated;

-- ── 10. Checks ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  ASSERT public.pay_period_start(DATE '2027-02-08') = DATE '2027-02-08';
  ASSERT public.pay_period_start(DATE '2027-02-21') = DATE '2027-02-08';
  ASSERT public.pay_period_start(DATE '2027-02-22') = DATE '2027-02-22';
  ASSERT public.pay_period_start(DATE '2027-02-07') = DATE '2027-01-25';
  ASSERT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.timesheet_lines'::regclass);
  ASSERT NOT has_table_privilege('authenticated', 'public.timesheet_lines', 'INSERT');
  ASSERT NOT has_table_privilege('authenticated', 'public.timesheet_lines', 'UPDATE');
  ASSERT NOT has_function_privilege('anon', 'public.timesheet_period(date)', 'EXECUTE');
  ASSERT NOT has_function_privilege('authenticated', 'public.is_paid_kaiarahi(uuid)', 'EXECUTE');
END $$;
