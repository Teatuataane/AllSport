-- ════════════════════════════════════════════════════════════════════════════
-- 20261012230318 — Colours are earned per calendar year (part A)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Tāne, 13 Oct 2026: a colour is earned for a calendar year, January to
-- December, NZ time. On 1 January every domain starts again on Mā; last year's
-- colours stay on record. Until now a colour was for life: grade_awards had no
-- year, and UNIQUE (player_id, domain_number, rung) meant a colour could only
-- ever be awarded once.
--
-- WHAT
--   1. grade_awards.season_year: the NZ year the colour belongs to. Backfilled
--      from conferred_at at Pacific/Auckland (every award so far is 2026), and
--      filled by a trigger when a write leaves it out, so the code live before
--      this deploy keeps working unchanged.
--   2. A unique index on (player_id, domain_number, rung, season_year): one of
--      each colour per domain PER YEAR. The new code upserts on it.
--   3. grade_withdrawals.season_year, the same way, so a notice says which
--      year's colour was taken back.
--   4. confer_grade(), redefined whole from 20260915051927. The ONLY changes
--      are marked CHANGED: the colour belongs to this NZ year, "refuses a
--      colour below one already held" looks at this year's awards only, and the
--      conflict target is the new key. Every guard is kept.
--   5. leaderboard_page(), redefined whole from 20260918021529. The ONLY
--      change: `grades` is grouped per year and carries season_year, so the
--      board can show this year and past years by tab.
--
-- WHAT IS DELIBERATELY KEPT: the old UNIQUE (player_id, domain_number, rung).
--   The recheck route before v0.35.0.0 upserts with
--   onConflict 'player_id,domain_number,rung', which needs a constraint on
--   exactly those columns, or every conferral fails. So this part is safe
--   against either version of the code. PART B
--   (20261012231444) drops it, and MUST be applied before 1 January 2027:
--   while it stands, nobody can earn in 2027 a colour they held in 2026.
--
-- DEPLOY ORDER: code first (v0.35.0.0), then this and part B together.
--   Between the deploy and the apply, the new route's upsert names the year
--   key, which does not exist yet, so a conferral fails with a 500 and the
--   watermark stays put: the next recheck after the apply confers it. Its
--   reads fall back on 42703 (no season_year yet) and keep working.
--
-- Additive, and re-runnable until part B is applied (its closing check then
-- reports the old key gone, which is part B's job). Rehearsed on 13 Oct 2026
-- in PGlite against a stub of these tables: backfill, both route upserts,
-- confer_grade's year scoping and idempotence, the payload, then part B and a
-- 2027 colour beside a 2026 one.

-- Pre-image count, for the closing assertion.
CREATE TEMP TABLE _yearly_colours_before AS
  SELECT (SELECT count(*) FROM public.grade_awards) AS awards,
         (SELECT count(*) FROM public.grade_withdrawals) AS withdrawals;

-- ── 1. The year of an award ─────────────────────────────────────────────────
ALTER TABLE public.grade_awards ADD COLUMN IF NOT EXISTS season_year int;

UPDATE public.grade_awards
SET season_year = extract(year FROM conferred_at AT TIME ZONE 'Pacific/Auckland')::int
WHERE season_year IS NULL;

-- A write that leaves the year out (the code live before this deploy, and
-- confer_grade below) gets the NZ year of its conferred_at. Not a column
-- DEFAULT: a default cannot read another column, and the withdrawal path puts
-- back a colour dated to the jump it replaces, which is the year it belongs to.
CREATE OR REPLACE FUNCTION public.grade_awards_season_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.season_year IS NULL THEN
    NEW.season_year := extract(year FROM COALESCE(NEW.conferred_at, now()) AT TIME ZONE 'Pacific/Auckland')::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grade_awards_season_year ON public.grade_awards;
CREATE TRIGGER grade_awards_season_year
  BEFORE INSERT ON public.grade_awards
  FOR EACH ROW EXECUTE FUNCTION public.grade_awards_season_year();

ALTER TABLE public.grade_awards ALTER COLUMN season_year SET NOT NULL;
ALTER TABLE public.grade_awards DROP CONSTRAINT IF EXISTS grade_awards_season_year_check;
ALTER TABLE public.grade_awards ADD CONSTRAINT grade_awards_season_year_check
  CHECK (season_year BETWEEN 2024 AND 2100);

COMMENT ON COLUMN public.grade_awards.season_year IS
  'The NZ calendar year this colour was earned for. Colours are per year '
  '(Tāne, 13 Oct 2026): on 1 January every domain starts on Mā again.';

-- ── 2. One of each colour per domain per year ───────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS grade_awards_player_domain_rung_year_key
  ON public.grade_awards (player_id, domain_number, rung, season_year);

-- ── 3. The year of a withdrawal ─────────────────────────────────────────────
ALTER TABLE public.grade_withdrawals ADD COLUMN IF NOT EXISTS season_year int;

UPDATE public.grade_withdrawals
SET season_year = extract(year FROM COALESCE(conferred_at, withdrawn_at) AT TIME ZONE 'Pacific/Auckland')::int
WHERE season_year IS NULL;

CREATE OR REPLACE FUNCTION public.grade_withdrawals_season_year()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.season_year IS NULL THEN
    NEW.season_year := extract(year FROM COALESCE(NEW.conferred_at, NEW.withdrawn_at, now()) AT TIME ZONE 'Pacific/Auckland')::int;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS grade_withdrawals_season_year ON public.grade_withdrawals;
CREATE TRIGGER grade_withdrawals_season_year
  BEFORE INSERT ON public.grade_withdrawals
  FOR EACH ROW EXECUTE FUNCTION public.grade_withdrawals_season_year();

ALTER TABLE public.grade_withdrawals ALTER COLUMN season_year SET NOT NULL;

-- ── 4. Conferring a colour, within the year ─────────────────────────────────
-- Redefined whole from 20260915051927_grading_schema.sql (never redefined
-- since). Unchanged except where marked CHANGED.
CREATE OR REPLACE FUNCTION public.confer_grade(
  p_player_id     uuid,
  p_domain_number int,
  p_rung          int,
  p_events        text[] DEFAULT '{}',
  p_session_id    uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_held  int;
  v_guest boolean;
  -- CHANGED 20261012230318: a colour belongs to this NZ year.
  v_year  int := extract(year FROM now() AT TIME ZONE 'Pacific/Auckland')::int;
BEGIN
  IF v_uid IS NULL OR NOT public.is_judge() THEN
    RAISE EXCEPTION 'confer_grade: only a kaiwhakawā can confer a colour' USING ERRCODE = '42501';
  END IF;
  IF p_domain_number IS NULL OR p_domain_number NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'confer_grade: domain must be 1 to 10' USING ERRCODE = '22023';
  END IF;
  IF p_rung IS NULL OR p_rung NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'confer_grade: colour must be 1 (Kiwikiwi) to 12 (Taniwha)' USING ERRCODE = '22023';
  END IF;

  SELECT is_guest INTO v_guest FROM players WHERE id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'confer_grade: unknown player %', p_player_id USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(v_guest, false) THEN
    RAISE EXCEPTION 'confer_grade: a guest cannot hold a colour' USING ERRCODE = '22023';
  END IF;

  -- CHANGED 20261012230318: only this year's awards are held. Last year's
  -- Kōwhai does not stop a kaiwhakawā releasing this year's Whero.
  SELECT max(rung) INTO v_held FROM grade_awards
  WHERE player_id = p_player_id AND domain_number = p_domain_number AND season_year = v_year;
  IF v_held IS NOT NULL AND v_held > p_rung THEN
    RAISE EXCEPTION 'confer_grade: that player already holds a higher colour in this domain'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_events, '{}')) AS e
    WHERE NOT EXISTS (SELECT 1 FROM event_domains d WHERE d.slug = e AND d.domain_number = p_domain_number)
  ) THEN
    RAISE EXCEPTION 'confer_grade: an event given as evidence is not in that domain' USING ERRCODE = '22023';
  END IF;

  -- CHANGED 20261012230318: season_year written, and the conflict target is
  -- the year key, so the same colour can be released again next year.
  INSERT INTO grade_awards (player_id, domain_number, rung, grade_name, session_id, events, conferred_by, season_year)
  VALUES (
    p_player_id, p_domain_number, p_rung,
    (ARRAY['Kiwikiwi', 'Whero', 'Karaka', 'Kōwhai', 'Kākāriki', 'Kahurangi',
           'Poroporo', 'Parahi', 'Hiriwa', 'Kōura', 'Uenuku', 'Taniwha'])[p_rung],
    p_session_id, COALESCE(p_events, '{}'), v_uid, v_year
  )
  ON CONFLICT (player_id, domain_number, rung, season_year) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM grade_awards
    WHERE player_id = p_player_id AND domain_number = p_domain_number AND rung = p_rung
      AND season_year = v_year;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) TO authenticated;

COMMENT ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) IS
  'Confers one colour in one domain for this NZ year. Kaiwhakawā only; the '
  'only write path into grade_awards besides the auto-conferral route. '
  'Idempotent; refuses a colour below one already held this year.';

-- ── 5. The board's conferred colours, per year ──────────────────────────────
-- Redefined whole from 20260918021529_retire_points_server.sql. Unchanged
-- except where marked CHANGED.
create or replace function public.leaderboard_page(p_season int)
returns jsonb
language plpgsql
volatile
security invoker
set search_path = public
as $fn$
declare
  v_payload jsonb;
begin
  -- Best effort, and deliberately so: see 20260827211610. A session that fails
  -- to close here is picked up by pg_cron within five minutes; a leaderboard
  -- that fails to render is visible to everyone immediately.
  begin
    perform public.close_expired_sessions();
  exception when others then
    raise warning 'leaderboard_page: close_expired_sessions failed (%), serving payload anyway', sqlerrm;
  end;

  with active as (
    select s.* from sessions s where s.is_active limit 1
  )
  select jsonb_build_object(
    -- Each player's highest CONFERRED colour in each domain, in each year.
    -- Public, like the awards themselves. The client derives the overall
    -- colour so the rule lives in one place, lib/grading.ts.
    -- CHANGED 20261012230318: per season_year, which the row carries.
    'grades', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',     g.player_id,
        'domain_number', g.domain_number,
        'rung',          g.rung,
        'season_year',   g.season_year
      ))
      from (
        select ga.player_id, ga.domain_number, ga.season_year, max(ga.rung) as rung
        from grade_awards ga
        group by ga.player_id, ga.domain_number, ga.season_year
      ) g
    ), '[]'::jsonb),
    'active_session', (
      select jsonb_build_object(
        'id',               a.id,
        'session_date',     a.session_date,
        'started_at',       a.started_at,
        'location',         a.location,
        'is_championship',  a.is_championship
      ) from active a
    ),
    -- Rows behind the active-session leader chip. Empty when nothing is live.
    'active_session_results', coalesce((
      select jsonb_agg(jsonb_build_object(
        'player_id',     r.player_id,
        'player_name',   r.player_name,
        'placement',     r.placement
      ))
      from results r
      where r.session_id = (select a.id from active a)
    ), '[]'::jsonb),
    'stats', public.stats_bundle()
  )
  into v_payload;

  return v_payload;
end;
$fn$;

-- Unchanged from 20260918021529, restated because the function was recreated.
revoke all on function public.leaderboard_page(int) from public;
grant execute on function public.leaderboard_page(int) to anon, authenticated;

-- ── 6. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
DECLARE
  v_before _yearly_colours_before%ROWTYPE;
BEGIN
  SELECT * INTO v_before FROM _yearly_colours_before;
  IF (SELECT count(*) FROM grade_awards) <> v_before.awards THEN
    RAISE EXCEPTION 'yearly colours: the number of awards changed';
  END IF;
  IF (SELECT count(*) FROM grade_withdrawals) <> v_before.withdrawals THEN
    RAISE EXCEPTION 'yearly colours: the number of withdrawals changed';
  END IF;
  IF EXISTS (SELECT 1 FROM grade_awards WHERE season_year IS NULL)
     OR EXISTS (SELECT 1 FROM grade_withdrawals WHERE season_year IS NULL) THEN
    RAISE EXCEPTION 'yearly colours: a row has no year';
  END IF;
  IF to_regclass('public.grade_awards_player_domain_rung_year_key') IS NULL THEN
    RAISE EXCEPTION 'yearly colours: the year key index is missing';
  END IF;
  -- Part A keeps the old key: the live route upserts on it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.grade_awards'::regclass AND contype = 'u'
      AND array_length(conkey, 1) = 3
  ) THEN
    RAISE EXCEPTION 'yearly colours: the old unique key is gone too early; the live route upserts on it';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'confer_grade' AND prosecdef AND 'search_path=public' = ANY (proconfig)
      AND prosrc LIKE '%season_year = v_year%'
  ) THEN
    RAISE EXCEPTION 'yearly colours: confer_grade is not year-scoped, not SECURITY DEFINER, or has no pinned search_path';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'leaderboard_page' AND prosrc LIKE '%ga.season_year%') THEN
    RAISE EXCEPTION 'yearly colours: leaderboard_page does not group by year';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'grade_awards_season_year' AND NOT tgisinternal) THEN
    RAISE EXCEPTION 'yearly colours: the award year trigger is missing';
  END IF;
END $$;

DROP TABLE _yearly_colours_before;
