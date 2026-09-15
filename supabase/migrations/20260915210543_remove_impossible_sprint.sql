-- ════════════════════════════════════════════════════════════════════════════
-- 20260915210543 — Remove an impossible 100m result
-- ════════════════════════════════════════════════════════════════════════════
--
-- One 100m Sprint result, from the Selwyn Winter Jam (session e032cb24…,
-- 4 July 2026), is stored as 0.16 seconds. Tāne confirmed on 16 September 2026
-- that it is a mistake and asked for it to be removed. It sat 1st in its event
-- and pool, and under the new standards it would have graded as a sprint drill
-- colour nobody earned.
--
-- WHAT
--   1. Archives the row, with RLS on and grants revoked, then deletes it.
--   2. Replays compute_event_placements() for that session only, so the 100m
--      placing and the win pass to the true fastest in that pool.
--
-- DELIBERATELY NOT RECOMPUTED: the session's points and overall placings. They
-- were awarded on 7 July and name the Winter Jam champions on /schedule, and
-- the September history repair made the same call. player_totals reads
-- session_player_summary, which this does not touch, so lifetime points hold.
--
-- SAFE TO RUN AGAINST ANY STATE: if the row is already gone this only says so;
-- if its time has since been corrected to something real, it refuses to delete
-- a real result.
--
-- DEPLOY ORDER: either. No code depends on it.
--
-- NOT VERIFIED AGAINST A DATABASE when written: Docker was not running.
-- __tests__/dataFixes.test.ts pins this file.

CREATE TABLE public.results_impossible_archive_20260915210543 AS
SELECT r.*, now() AS archived_at
FROM public.results r
WHERE r.id = 'f786efa6-2b31-4335-a70b-480494fad71d'
  AND r.time_seconds < 1;
ALTER TABLE public.results_impossible_archive_20260915210543 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_impossible_archive_20260915210543 FROM anon, authenticated;

DO $$
DECLARE
  v_archived int;
  v_present  boolean;
BEGIN
  SELECT count(*) INTO v_archived FROM public.results_impossible_archive_20260915210543;
  SELECT EXISTS (SELECT 1 FROM public.results WHERE id = 'f786efa6-2b31-4335-a70b-480494fad71d')
    INTO v_present;

  IF v_archived = 0 AND v_present THEN
    RAISE EXCEPTION 'remove impossible sprint: the row no longer carries the impossible time, so it is a real result and is kept';
  END IF;
  IF v_archived = 0 THEN
    RAISE NOTICE 'remove impossible sprint: the row is already gone, nothing to do';
    RETURN;
  END IF;

  DELETE FROM public.results
  WHERE id = 'f786efa6-2b31-4335-a70b-480494fad71d' AND time_seconds < 1;

  PERFORM public.compute_event_placements('e032cb24-416d-48e9-9806-168c4d6fe46f');
END $$;

-- ── Closing checks — verify the data, not the ledger ────────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.results
    WHERE session_id = 'e032cb24-416d-48e9-9806-168c4d6fe46f' AND time_seconds < 1
  ) THEN
    RAISE EXCEPTION 'remove impossible sprint: that session still holds a time under one second';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.results_impossible_archive_20260915210543'::regclass) THEN
    RAISE EXCEPTION 'remove impossible sprint: RLS is not enabled on the archive';
  END IF;
  -- The placement invariant 20260828204652 established: one placed row per
  -- player per event per session.
  IF EXISTS (
    SELECT 1 FROM public.results
    WHERE session_id = 'e032cb24-416d-48e9-9806-168c4d6fe46f' AND event_placement IS NOT NULL
    GROUP BY event_id, player_id HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'remove impossible sprint: a player holds two placed rows in one event';
  END IF;
END $$;
