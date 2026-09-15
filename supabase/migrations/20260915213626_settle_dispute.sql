-- ════════════════════════════════════════════════════════════════════════════
-- 20260915213626 — A kaiwhakawā settles a disputed game
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY
-- When both players record the same game and their results contradict (both
-- claim the win, say), lib/matches.ts marks the game DISPUTED, and a disputed
-- game counts for nothing: not toward the ten-game minimum, not in the rating.
-- That was approved in review with the words "a disputed game waits for a
-- kaiwhakawā". Nothing let a kaiwhakawā act on it. This does.
--
-- WHAT SETTLING IS (decided with Tāne, 2026-09-16)
-- The kaiwhakawā marks the record that is RIGHT. That stamps `confirmed_by` and
-- `confirmed_at` on it, the columns 20260914020739 reserved for this, and clears
-- them on the other record. lib/matches.ts then treats the pair as SETTLED and
-- rates the game on the confirmed record.
--   · Nobody's score changes. Correcting the wrong result would half fix it:
--     after a session closes, placements and points are not recomputed.
--   · There is no third outcome. A kaiwhakawā picks one of the two records or
--     leaves the game disputed, where it counts for nothing. A true draw against
--     two claimed wins therefore stays disputed.
--   · `p_true` NULL reopens a settled game.
--   · An edit by either player wipes the stamp, because record_match() replaces
--     its row, and the game is judged afresh. Stored agreement would go stale
--     on an edit; a stamp that dies with the row it was on cannot.
--
-- WHO MAY CALL IT
-- Kaiwhakawā only, checked with public.is_judge(), the same gate as
-- confer_grade(). No table grant changes: `matches` stays read-only to every
-- client role, and this function is its only UPDATE.
--
-- DEPLOY ORDER: either is safe. Code first, the Settle buttons report that the
-- function is missing (PGRST202) and nothing else changes. Migration first, the
-- function simply waits for a caller. Additive: no data is rewritten.

CREATE OR REPLACE FUNCTION public.settle_dispute(
  p_match_a uuid,
  p_match_b uuid,
  p_true    uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_uid uuid := auth.uid();
  v_a   public.matches%ROWTYPE;
  v_b   public.matches%ROWTYPE;
BEGIN
  IF v_uid IS NULL OR NOT public.is_judge() THEN
    RAISE EXCEPTION 'settle_dispute: only a kaiwhakawā can settle a game' USING ERRCODE = '42501';
  END IF;
  IF p_match_a IS NULL OR p_match_b IS NULL OR p_match_a = p_match_b THEN
    RAISE EXCEPTION 'settle_dispute: give the two records of one game' USING ERRCODE = '22023';
  END IF;
  IF p_true IS NOT NULL AND p_true <> p_match_a AND p_true <> p_match_b THEN
    RAISE EXCEPTION 'settle_dispute: the record marked right must be one of the two' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_a FROM public.matches WHERE id = p_match_a FOR UPDATE;
  SELECT * INTO v_b FROM public.matches WHERE id = p_match_b FOR UPDATE;
  IF v_a.id IS NULL OR v_b.id IS NULL THEN
    RAISE EXCEPTION 'settle_dispute: a record no longer exists; a player may have edited or deleted the score'
      USING ERRCODE = 'P0002';
  END IF;
  IF v_a.session_id <> v_b.session_id OR v_a.event_id <> v_b.event_id THEN
    RAISE EXCEPTION 'settle_dispute: those records are from different games' USING ERRCODE = '22023';
  END IF;

  -- The same game seen from both sides: each record's own side holds someone
  -- the other record names as an opponent. Mirrors isReciprocal() in lib/matches.ts.
  IF NOT EXISTS (
       SELECT 1 FROM public.match_players x
       JOIN public.match_players y ON y.player_id = x.player_id
       WHERE x.match_id = p_match_a AND x.side = 'a' AND y.match_id = p_match_b AND y.side = 'b')
  OR NOT EXISTS (
       SELECT 1 FROM public.match_players x
       JOIN public.match_players y ON y.player_id = x.player_id
       WHERE x.match_id = p_match_b AND x.side = 'a' AND y.match_id = p_match_a AND y.side = 'b') THEN
    RAISE EXCEPTION 'settle_dispute: those records are not the two sides of one game' USING ERRCODE = '22023';
  END IF;

  -- Mirrors agrees() in lib/matches.ts: a win against a loss, or a draw against
  -- a draw. A pair that agrees has nothing to settle.
  IF (v_a.outcome = 'a'    AND v_b.outcome = 'b')
  OR (v_a.outcome = 'b'    AND v_b.outcome = 'a')
  OR (v_a.outcome = 'draw' AND v_b.outcome = 'draw') THEN
    RAISE EXCEPTION 'settle_dispute: those records agree, so there is nothing to settle' USING ERRCODE = '22023';
  END IF;

  UPDATE public.matches
     SET confirmed_by = CASE WHEN id = p_true THEN v_uid END,
         confirmed_at = CASE WHEN id = p_true THEN now() END
   WHERE id IN (p_match_a, p_match_b);
END
$fn$;

REVOKE ALL ON FUNCTION public.settle_dispute(uuid, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.settle_dispute(uuid, uuid, uuid) TO authenticated;

COMMENT ON FUNCTION public.settle_dispute(uuid, uuid, uuid) IS
  'Kaiwhakawā only. Marks one record of a disputed game as right (p_true), or '
  'reopens it (p_true NULL), via matches.confirmed_by/confirmed_at. Scores are untouched.';

-- ── Check the objects, not the ledger ───────────────────────────────────────
DO $check$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'settle_dispute' AND prosecdef AND 'search_path=public' = ANY (proconfig)
  ) THEN
    RAISE EXCEPTION 'settle dispute: settle_dispute is missing, not SECURITY DEFINER, or has no pinned search_path';
  END IF;
  IF has_function_privilege('anon', 'public.settle_dispute(uuid, uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'settle dispute: anon can execute settle_dispute';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.settle_dispute(uuid, uuid, uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'settle dispute: authenticated cannot execute settle_dispute';
  END IF;
  IF has_table_privilege('authenticated', 'public.matches', 'UPDATE') THEN
    RAISE EXCEPTION 'settle dispute: clients can update matches directly';
  END IF;
END
$check$;
