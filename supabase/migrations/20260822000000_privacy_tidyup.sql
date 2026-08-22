-- ════════════════════════════════════════════════════════════════════════════
-- 20260822 — Drop bodyweight_kg, and give players a way to erase themselves
-- ════════════════════════════════════════════════════════════════════════════
--
-- ⚠️  RENUMBERED FROM 20260821000000 — VERSION COLLISION.
--
-- It shipped as 20260821000000, the same version as 20260821000000_leaderboard_rpc.sql.
-- The CLI matches on the 14-digit version ALONE, so those two files were one
-- migration as far as it was concerned: whichever applied first claimed the row
-- in supabase_migrations and the other would be skipped in silence, with
-- `db push` reporting success either way.
--
-- What actually happened: the leaderboard RPC was pushed first and holds that
-- row, and THIS file's objects reached production by some other route (verified
-- 2026-08-22 — delete_my_account() exists). So the effects are live but the
-- migration has no row of its own, and the recorded history does not match the
-- files that produced it.
--
-- Renumbering this file rather than the other one is deliberate: prod's
-- 20260821000000 row corresponds to the leaderboard RPC's contents, so that file
-- has to keep the number for local and remote history to mean the same thing.
-- Under 20260822000000 this file shows as pending and applies cleanly, which is
-- safe precisely because it is idempotent — see below. Applying it is what puts
-- the row in the ledger.
--
-- Nothing here depends on the leaderboard RPC or vice versa: players_public does
-- not reference bodyweight_kg, and the RPC reads only id and division from it.
--
-- This is the SECOND version collision in two weeks (20260816000000 was the
-- first). Before adding a migration, check `ls supabase/migrations | tail` on an
-- up-to-date main, not just your own branch.
--
-- Two of the remaining findings from the August 2026 privacy audit.
--
-- 1. bodyweight_kg has been on `players` since the April 2026 rebuild and is
--    read and written by NOTHING — no page, no query, no trigger — and holds 0
--    rows. Collecting a body weight is a meaningful thing to do to people,
--    especially the tamariki in the Juniors division, and doing it by accident
--    is worse than doing it on purpose. Dropped.
--
-- 2. There was no way to leave. The privacy policy promises deletion on
--    request by email; this makes it self-serve and makes the promise precise.
--
-- ── Why erasure is ANONYMISATION, not DELETE ────────────────────────────────
-- A hard delete is not available and would not be right if it were:
--
--   · `players.id` REFERENCES auth.users(id) with no ON DELETE, and
--     `results.player_id` REFERENCES players(id) with no ON DELETE, so the row
--     cannot be removed while any result points at it.
--   · Removing the results too would change OTHER players' placements. A
--     placement is a rank within a field; deleting a competitor retroactively
--     promotes everyone who finished below them, in sessions that have already
--     been scored and whose points are already banked as lifetime colours —
--     and colours are never revoked (CLAUDE.md). One person leaving must not
--     rewrite somebody else's record.
--
-- So the competition record stays and every identifying attribute is destroyed.
-- This is exactly what /privacy already tells players: "Scores from sessions
-- you played stay in the leaderboard history, but we detach them from your name
-- and contact details."
--
-- Idempotent — safe to re-run.

-- ── 1. bodyweight_kg ────────────────────────────────────────────────────────
-- players_public never exposed it, so no view needs rebuilding.
ALTER TABLE public.players DROP COLUMN IF EXISTS bodyweight_kg;

-- ── 2. delete_my_account() ──────────────────────────────────────────────────
-- SECURITY DEFINER so it can write past the restrictive RLS on `players`, but
-- it derives the target from auth.uid() and NEVER takes it as an argument, so
-- there is no way to point it at somebody else. A parent may also erase a child
-- profile they created, matching players_select_child / players_update_child.
CREATE OR REPLACE FUNCTION public.delete_my_account(p_player_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID;
  v_names  TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  v_target := COALESCE(p_player_id, auth.uid());

  -- Yourself, or a child profile you are the parent of. Nothing else.
  IF v_target <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM players WHERE id = v_target AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'you can only erase your own account or a child profile you manage'
      USING ERRCODE = '42501';
  END IF;

  -- Health information goes entirely. WHO-5 answers are the most sensitive
  -- thing we hold, they are voluntary, and nothing outside the player's own
  -- dashboard reads a row: the kaiwhakawā report is an aggregate. Rows already
  -- folded into a published quarterly average cannot be traced back.
  DELETE FROM wellbeing_surveys WHERE player_id = v_target;

  -- Capture every name this player has been known by BEFORE scrubbing, so the
  -- free-text opponent_name copies can be found afterwards. There is no
  -- opponent_player_id column in production (it was drafted in the v2 schema
  -- and never shipped), so a string match is the only handle we have.
  SELECT ARRAY_REMOVE(ARRAY[
    NULLIF(display_name, ''), NULLIF(username, ''), NULLIF(full_name, '')
  ], NULL)
  INTO v_names
  FROM players WHERE id = v_target;

  -- Every identifying attribute. display_name is set rather than nulled so the
  -- leaderboard and past game reports still render a row instead of a blank —
  -- players_public coalesces display_name -> username -> full_name, and all
  -- three would otherwise be empty.
  UPDATE players SET
    full_name     = NULL,
    email         = NULL,
    phone         = NULL,
    date_of_birth = NULL,
    gender        = NULL,
    city          = NULL,
    region        = NULL,
    country       = NULL,
    parent_name   = NULL,
    parent_email  = NULL,
    parent_phone  = NULL,
    referral_code = NULL,
    username      = NULL,
    icon          = NULL,
    display_name  = 'Former player',
    show_full_name = FALSE,
    show_username  = FALSE,
    show_location  = FALSE,
    is_active     = FALSE
  WHERE id = v_target;

  -- The name a kaiwhakawā typed onto a score row is a second copy of it.
  UPDATE results SET player_name = 'Former player'
  WHERE player_id = v_target;

  -- Being named as somebody's opponent is their record of a match, but the
  -- string is this player's name. Scrub the copies; the matches themselves are
  -- untouched. Exact match only — a substring rule would rename the wrong
  -- people, and a name shared with another player is a limitation worth
  -- accepting over that.
  IF v_names IS NOT NULL AND array_length(v_names, 1) > 0 THEN
    UPDATE results SET opponent_name = 'Former player'
    WHERE opponent_name = ANY (v_names);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(UUID) TO authenticated;

COMMENT ON FUNCTION public.delete_my_account(UUID) IS
  'Erases the caller (or a child profile they manage): destroys every '
  'identifying attribute on players, deletes their wellbeing answers, and '
  'scrubs their name from result and opponent rows. Placements, points and '
  'colours are deliberately kept — removing them would change other players'' '
  'historical placings. Target comes from auth.uid(), never from the caller.';
