-- ════════════════════════════════════════════════════════════════════════════
-- 20260820000002 — run close_expired_sessions() on a schedule (pg_cron)
-- ════════════════════════════════════════════════════════════════════════════
--
-- 20260820000000 made the close correct: any visitor loading the dashboard,
-- the leaderboard, or the live session heals a game whose 100 minutes have
-- elapsed. That covers the realistic case, because during a session everyone
-- has the app open, and afterwards someone opens it soon enough.
--
-- What it does NOT cover is nobody opening the app at all. The 2026-08-19 game
-- sat unscored overnight precisely because the last person closed their phone
-- before the clock ran out. A session should not need a witness to end.
--
-- So: the same function, on a five-minute schedule. A game that runs out at
-- 18:54 is closed by 18:59 whether or not anyone is looking, and its points are
-- awarded then rather than whenever someone next visits.
--
-- Five minutes rather than one because this is a safety net, not the primary
-- path. When anyone has the app open the client-side call closes the session
-- within a second of the clock hitting zero; cron only matters when nobody
-- does. A no-op UPDATE every five minutes is free; every minute would be too,
-- but there is nothing to buy with it.
--
-- ── WHY THIS WHOLE MIGRATION IS WRAPPED IN EXCEPTION HANDLERS ───────────────
-- `CREATE EXTENSION pg_cron` needs privileges that a hosted Postgres may not
-- grant, and the extension may not be present on the instance at all. An
-- unguarded failure here would abort `supabase db push` — and the migrations
-- that matter (20260820000000, ...0001) sort BEFORE this one, so they would
-- have applied and this would leave the schema half-migrated for no gain.
--
-- This migration is therefore BEST-EFFORT BY DESIGN. If pg_cron is unavailable
-- it raises a NOTICE and succeeds, and the app is exactly as correct as it was
-- without it — just reliant on a visitor rather than a timer. Check the push
-- output for the notice to know which of the two you got.
--
-- To confirm afterwards:
--   SELECT jobid, schedule, command, active FROM cron.job
--    WHERE jobname = 'close-expired-sessions';
-- To remove:
--   SELECT cron.unschedule('close-expired-sessions');

DO $$
BEGIN
  -- ── 1. Is pg_cron even offered by this instance? ──────────────────────────
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE
      'pg_cron is not available on this instance. Skipping the schedule. '
      'Sessions still close whenever anyone opens the app (20260820000000); '
      'they just will not close unattended.';
    RETURN;
  END IF;

  -- ── 2. Enable it, tolerating a refusal ────────────────────────────────────
  BEGIN
    EXECUTE 'CREATE EXTENSION IF NOT EXISTS pg_cron';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE
      'pg_cron is available but could not be enabled (% %). Skipping the '
      'schedule; the client-triggered close is unaffected. Enable it from the '
      'Supabase dashboard (Database > Extensions) and re-run this migration.',
      SQLSTATE, SQLERRM;
    RETURN;
  END;

  -- ── 3. Schedule the job ───────────────────────────────────────────────────
  -- cron.schedule(name, schedule, command) upserts by name on pg_cron 1.4+, so
  -- re-running this migration replaces the job rather than stacking duplicates.
  -- EXECUTE rather than PERFORM because the cron schema may have come into
  -- existence moments ago, in this same block.
  BEGIN
    EXECUTE $cron$
      SELECT cron.schedule(
        'close-expired-sessions',
        '*/5 * * * *',
        $job$SELECT public.close_expired_sessions();$job$
      )
    $cron$;
    RAISE NOTICE 'Scheduled close-expired-sessions every 5 minutes.';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE
      'pg_cron is enabled but the job could not be scheduled (% %). Sessions '
      'still close whenever anyone opens the app.', SQLSTATE, SQLERRM;
  END;
END;
$$;
