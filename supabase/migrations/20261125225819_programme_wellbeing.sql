-- ─── Wellbeing change over a programme (multi-location games step 14) ───────
-- v0.73.0.0. The funder report shows the change in wellbeing over a programme
-- (Tāne, 26 Nov 2026): for players with at least two check-ins stamped with
-- the programme (wellbeing_surveys.programme_id, set by trigger since
-- 20261123230958) inside the period, the average of each player's FIRST and
-- LATEST check-in, and the change.
--
-- Individual answers stay unreadable, as the privacy page promises. This
-- returns averages only, and nothing at all (respondents only, null averages)
-- when fewer than 5 players answered twice: the under-5 rule of every export.
-- Kaiwhakawā only.

CREATE OR REPLACE FUNCTION public.programme_wellbeing(p_programme_id uuid, p_from date, p_to date)
 RETURNS TABLE (
   respondents integer,
   who5_first numeric, who5_latest numeric,
   activity_first numeric, activity_latest numeric,
   belonging_first numeric, belonging_latest numeric
 )
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'wellbeing: Kaiwhakawā only' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH s AS (
    SELECT w.player_id,
      (w.who5_cheerful + w.who5_calm + w.who5_active + w.who5_rested + w.who5_interested) * 4.0 AS who5,
      w.activity_days::numeric AS ad, w.belonging::numeric AS bel,
      row_number() OVER (PARTITION BY w.player_id ORDER BY w.created_at, w.id) AS first_n,
      row_number() OVER (PARTITION BY w.player_id ORDER BY w.created_at DESC, w.id DESC) AS last_n,
      count(*) OVER (PARTITION BY w.player_id) AS n
    FROM wellbeing_surveys w
    WHERE w.programme_id = p_programme_id
      AND (w.created_at AT TIME ZONE 'Pacific/Auckland')::date BETWEEN p_from AND p_to
  ),
  pairs AS (
    SELECT f.player_id, f.who5 AS w1, l.who5 AS w2, f.ad AS a1, l.ad AS a2, f.bel AS b1, l.bel AS b2
    FROM s f JOIN s l ON l.player_id = f.player_id AND l.last_n = 1
    WHERE f.first_n = 1 AND f.n >= 2
  ),
  agg AS (SELECT count(*)::int AS c,
    avg(w1) AS w1, avg(w2) AS w2, avg(a1) AS a1, avg(a2) AS a2, avg(b1) AS b1, avg(b2) AS b2 FROM pairs)
  SELECT a.c,
    CASE WHEN a.c >= 5 THEN round(a.w1, 1) END, CASE WHEN a.c >= 5 THEN round(a.w2, 1) END,
    CASE WHEN a.c >= 5 THEN round(a.a1, 1) END, CASE WHEN a.c >= 5 THEN round(a.a2, 1) END,
    CASE WHEN a.c >= 5 THEN round(a.b1, 2) END, CASE WHEN a.c >= 5 THEN round(a.b2, 2) END
  FROM agg a;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.programme_wellbeing(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.programme_wellbeing(uuid, date, date) TO authenticated;

DO $$
BEGIN
  ASSERT NOT has_function_privilege('anon', 'public.programme_wellbeing(uuid, date, date)', 'EXECUTE');
END $$;
