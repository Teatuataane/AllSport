-- ════════════════════════════════════════════════════════════════════════════
-- 20260820000000 — close_expired_sessions(): end a game that ran out of time
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE BUG
-- A session is supposed to auto-lock when its 100 minutes are up. The only
-- thing that ever did this was a setInterval in app/scoring/[sessionId], which
-- on reaching zero ran:
--
--     supabase.from('sessions').update({ is_active: false, ended_at: ... })
--
-- `sessions_update_judge` is the ONLY UPDATE policy on sessions, so that
-- statement silently does nothing for every player. It updates zero rows,
-- returns no error, and nothing checks the result. In practice a session only
-- ever closed if a kaiwhakawā happened to have the live-session screen open at
-- the exact moment the clock hit zero. Worse, the client sets its own
-- `sessionEnded` state regardless, so the player is shown "Session Ended"
-- while the database still says the game is running.
--
-- WHAT IT COSTS WHEN IT FAILS
-- award_session_points only fires on the is_active true -> false transition, so
-- an un-closed session awards NOBODY any points: no placements, no session
-- points, no effort points, nothing toward a colour. The 2026-08-19 session sat
-- open overnight with 13 results across 2 players and zero placements. The
-- scores are recorded; they simply never became a result.
--
-- THE FIX
-- Move the decision server-side. This function derives expiry from
-- `started_at`, so the caller cannot choose the outcome — it can only ask the
-- database to check. That makes it safe to expose to any visitor, which is the
-- point: the session heals as soon as ANYONE opens the app, rather than
-- depending on a judge having one particular screen open at one particular
-- minute.
--
-- It is deliberately NOT restricted to kaiwhakawā. Restricting it would
-- reintroduce exactly the failure being fixed.
--
-- ended_at is set to the moment the game ACTUALLY ran out (started_at + 100
-- minutes), not now(). Closing a stale session the next morning should not
-- record it as having run for sixteen hours.
--
-- points_awarded_at is deliberately untouched. award_session_points fires on
-- the transition and carries its own atomic claim guard (20260713000000), so
-- double-calling is harmless. Leaving the column alone also preserves Void
-- semantics: a voided session is stamped BEFORE being closed, and the trigger's
-- WHEN clause skips anything already stamped, so this can never resurrect
-- points for a game that was deliberately voided.
--
-- 100 minutes is hardcoded because `sessions` has no duration column. (CLAUDE.md
-- lists `duration_minutes` and `max_participants`; neither exists in the live
-- schema, verified 2026-08-20.) If a real duration column is ever added, this
-- function and the client constant in app/scoring/[sessionId] are the two
-- places that need to agree.

CREATE OR REPLACE FUNCTION public.close_expired_sessions()
RETURNS TABLE (closed_session_id UUID)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE sessions s
     SET is_active = false,
         ended_at  = s.started_at + INTERVAL '100 minutes'
   WHERE s.is_active = true
     AND s.started_at IS NOT NULL
     AND NOW() >= s.started_at + INTERVAL '100 minutes'
  RETURNING s.id;
END;
$$;

REVOKE ALL ON FUNCTION public.close_expired_sessions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.close_expired_sessions() TO anon, authenticated;

COMMENT ON FUNCTION public.close_expired_sessions() IS
  'Closes any session whose 100 minutes have elapsed, firing award_session_points. '
  'Expiry is derived from started_at server-side, so the caller cannot influence '
  'the outcome — which is why it is callable by anyone. Called opportunistically '
  'on app load and by the live-session timer. Safe to call repeatedly.';

-- ── Backfill: close anything already stranded ───────────────────────────────
-- Runs once as part of this migration so existing stuck sessions (the
-- 2026-08-19 game among them) award their points immediately rather than
-- waiting for the next visitor. Same guarded path as every later call.
DO $$
DECLARE
  v_closed INT;
BEGIN
  SELECT COUNT(*) INTO v_closed FROM public.close_expired_sessions();
  RAISE NOTICE 'close_expired_sessions: closed % stranded session(s)', v_closed;
END;
$$;

-- ── Verification ────────────────────────────────────────────────────────────
-- Nothing should remain open past its 100 minutes:
--   SELECT id, session_date, started_at, is_active, points_awarded_at
--     FROM sessions
--    WHERE is_active AND started_at < NOW() - INTERVAL '100 minutes';
-- And a session closed this way should have placements written by the trigger:
--   SELECT COUNT(*) FILTER (WHERE placement IS NOT NULL), COUNT(*)
--     FROM results WHERE session_id = '<id>';
