-- ════════════════════════════════════════════════════════════════════════════
-- 20260813000001 — Guard score writes (points tampering)
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE HOLE
-- `results_insert_own` permits `player_id = auth.uid()` with no constraint on
-- session state and no constraint on the numeric columns, `results_update_*`
-- lets a player rewrite their own rows, and there is no trigger on `results`.
-- So any authenticated player can:
--   1. write rows into ANY session, including ones long closed and ones they
--      never attended;
--   2. set `placement`, `placement_points`, `points_earned` directly;
--   3. set `effort_task_completions` to any integer;
--   4. insert guest rows (`player_id IS NULL`) under any `player_name`, which
--      shifts every other player's placement.
--
-- This is not cosmetic. award_session_points() recomputes placement FROM
-- raw_score at session close, and effort_level feeds it, so fabricated input
-- becomes real placement points and then PERMANENT lifetime colour points —
-- which by the August 2026 design decision are never revoked (CLAUDE.md:
-- "colour_awards is append-only", "a colour is never revoked").
--
-- WHAT THIS FIXES, AND WHAT IT HONESTLY DOES NOT
-- Fixed: writes are confined to an OPEN session; the server-authoritative
-- points columns become unwritable by players; effort credit is bounded; only
-- kaiwhakawā can create guest rows.
--
-- NOT fixed: `raw_score` itself. In this app the score IS player-submitted —
-- there is no server-side truth to validate it against, and reimplementing
-- per-mode scoring in SQL would only move the trust, not remove it. The real
-- control is the sport's own rule ("Result validity: must be filmed or
-- witnessed by a judge") plus the kaiwhakawā's edit/delete powers. What
-- changes is the blast radius: from "silently rewrite any score in any session
-- at any time" to "submit your own score, in a session that is open, in front
-- of a judge who can correct it".
--
-- `is_pr` is also left client-set. It feeds effort_level, but effort_level is
-- capped at 20 (=100 pts) by the award trigger, so the most a forged is_pr can
-- buy is a cap an honest player reaches anyway. Recomputing it server-side
-- would risk disagreeing with the client's season-vs-lifetime PR semantics, so
-- it is logged as residual rather than half-fixed here.
--
-- APP IMPACT: none for legitimate flows.
--   · Players submit only into the live session (the screen is the live session).
--   · Kaiwhakawā keep every power, including post-session edit/delete from the
--     Summary tab, because judges are exempt.
--   · award_session_points() does `UPDATE results` AFTER setting is_active =
--     false. It runs under the closing judge's JWT (auth.uid() = that judge, as
--     SECURITY DEFINER changes the role but not the JWT claims), or under
--     service_role with no JWT. Both are exempt, so closing a session still
--     writes placements normally.
-- Safe to apply before any code deploy.

-- ── 1. Only kaiwhakawā may create guest rows ────────────────────────────────
-- Recreated from 20260505000000 minus the bare `OR player_id IS NULL`, which
-- was what let any player inject fake competitors. Judges keep the ability:
-- their branch has no player_id condition at all, which is exactly how the
-- Kaiwhakawā tab already writes guests (CLAUDE.md: "Guests pass playerId:
-- null ... exactly how submitEntry already writes guest rows").
DROP POLICY IF EXISTS "results_insert_own" ON results;
CREATE POLICY "results_insert_own" ON results
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      player_id = auth.uid()
      OR EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
      OR public.is_judge()
    )
  );

-- ── 2. The guard ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_results_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_active   BOOLEAN;
  v_awarded_at  TIMESTAMPTZ;
BEGIN
  -- service_role / server-side job. Every results write policy requires
  -- auth.uid() IS NOT NULL, so anon never reaches this.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Kaiwhakawā need post-session edit and delete (Judge Summary tab), and the
  -- award trigger runs under their JWT.
  IF public.is_judge() THEN
    RETURN NEW;
  END IF;

  -- ── The session must still be open ────────────────────────────────────────
  SELECT s.is_active, s.points_awarded_at
    INTO v_is_active, v_awarded_at
  FROM sessions s
  WHERE s.id = NEW.session_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'results: unknown session %', NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  IF COALESCE(v_is_active, false) IS NOT TRUE THEN
    RAISE EXCEPTION
      'results: session % has ended — ask a kaiwhakawā to make the change',
      NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  -- Belt and braces: a voided session is closed by stamping points_awarded_at
  -- first, so this also blocks writes into a session mid-void.
  IF v_awarded_at IS NOT NULL THEN
    RAISE EXCEPTION 'results: points already awarded for session %', NEW.session_id
      USING ERRCODE = '42501';
  END IF;

  -- ── Server-authoritative columns are not the player's to set ─────────────
  -- Preserved on UPDATE rather than nulled, so a player editing their own score
  -- mid-session can never blank a value the award trigger wrote.
  -- Column list verified against production, NOT against CLAUDE.md's schema
  -- section, which still lists `score`, `rank_in_session` and `adjusted_score`.
  -- None of those three exist on `results` any more (the v2 rebuild in
  -- 20260429000000 dropped them). Assigning a non-existent field here would
  -- raise "record new has no field ..." at runtime and break EVERY score
  -- submission, so keep this list in step with the live table.
  IF TG_OP = 'UPDATE' THEN
    NEW.placement          := OLD.placement;
    NEW.placement_points   := OLD.placement_points;
    NEW.points_earned      := OLD.points_earned;
    NEW.bonus_points_total := OLD.bonus_points_total;
    -- Reassigning a row to another player, or orphaning it into a guest row,
    -- would launder a score. The UPDATE policy's reused USING clause already
    -- blocks this; stated here so it survives a future WITH CHECK being added.
    NEW.player_id          := OLD.player_id;
    NEW.session_id         := OLD.session_id;
  ELSE
    NEW.placement          := NULL;
    NEW.placement_points   := NULL;
    NEW.points_earned      := NULL;
    NEW.bonus_points_total := 0;
  END IF;

  -- ── Bound effort credit ──────────────────────────────────────────────────
  -- The award trigger caps effort_level at 20 across the whole session, so this
  -- only stops a single absurd row (e.g. 10^9) from overflowing the sum before
  -- the cap is applied.
  NEW.effort_task_completions :=
    LEAST(GREATEST(COALESCE(NEW.effort_task_completions, 0), 0), 20);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_results_write ON results;
CREATE TRIGGER trg_guard_results_write
  BEFORE INSERT OR UPDATE ON results
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_results_write();

-- ── 3. Deletes ──────────────────────────────────────────────────────────────
-- A player deleting their own score from a CLOSED session would silently
-- re-rank everyone else, so scope self-delete to open sessions. Judges keep
-- unrestricted delete (the Summary tab relies on it post-session).
DROP POLICY IF EXISTS "results_delete_judge_own" ON results;
CREATE POLICY "results_delete_judge_own" ON results
  FOR DELETE USING (
    public.is_judge()
    OR (
      (
        player_id = auth.uid()
        OR EXISTS (SELECT 1 FROM players WHERE id = player_id AND parent_id = auth.uid())
      )
      AND EXISTS (
        SELECT 1 FROM sessions s
        WHERE s.id = session_id
          AND s.is_active = true
          AND s.points_awarded_at IS NULL
      )
    )
  );

-- Historical duplicate from 20260424000000 that granted the same UPDATE reach
-- under a different name. Left in place it would keep a second, unguarded path
-- open, since permissive policies are OR'd.
DROP POLICY IF EXISTS "Players can update own results" ON results;

-- ── Verification ────────────────────────────────────────────────────────────
-- As a non-judge player, against a CLOSED session id, each must fail 42501:
--   insert into results (player_id, session_id, event_id, raw_score)
--     values (auth.uid(), '<closed-session>', '<event>', 999999);
--   delete from results where id = '<own row in closed session>';
-- Against the OPEN session, this must succeed but leave points_earned NULL:
--   insert into results (player_id, session_id, event_id, raw_score, points_earned)
--     values (auth.uid(), '<open-session>', '<event>', 100, 9999)
--   returning points_earned;   -- expect NULL, not 9999
