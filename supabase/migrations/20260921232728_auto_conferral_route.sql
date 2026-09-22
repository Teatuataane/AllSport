-- ════════════════════════════════════════════════════════════════════════════
-- 20260921232728 — What the auto-conferral route needs
-- ════════════════════════════════════════════════════════════════════════════
--
-- Step 3 of docs/designs/auto-conferral-spec.md. A colour confers itself: a
-- server route re-runs lib/grading.ts — the SAME module the browser runs —
-- against the player's own data and writes the award.
--
-- WHAT
--   1. players.grades_checked_at — the watermark decision 3 reads.
--   2. grade_awards.conferred_by becomes NULLABLE. Null means the server
--      conferred it; a uuid means a kaiwhakawā did, exactly as today.
--   3. grades_need_recheck(player) — the cheap "has anything happened?" probe,
--      one round trip, so the usual page open costs one small query.
--   4. A trigger clearing the watermark when a player's band, division, date of
--      birth or gender changes, since none of those leaves a row to find.
--
-- WHAT IS DELIBERATELY NOT HERE
--   No conferring function for the route. It writes grade_awards directly with
--   the service key, because it IS the server: it has just re-derived the
--   colour from the player's own rows. A plpgsql function that re-checked what
--   the route computed would be a second copy of the rules in a second
--   language — the thing this whole design exists to avoid. The table's own
--   UNIQUE (player_id, domain_number, rung) still makes a double write
--   harmless, and the CHECKs still bound the domain and the rung.
--
--   confer_grade() IS NOT TOUCHED. The kaiwhakawā path keeps every guard it
--   has. CLAUDE.md: a whole redefinition is how a rule goes missing.
--
-- DEPLOY ORDER: migration EITHER side of the code. The route treats a missing
-- function (PGRST202) or column (42703) as "recheck anyway", so before this
-- lands it simply does the full work every time; nothing breaks and nothing is
-- wrongly skipped. The route is also inert until SUPABASE_SERVICE_ROLE_KEY is
-- set, and answers 503 rather than failing the page.
--
-- __tests__/autoConferral.test.ts pins this file.

-- ── 1. The watermark ────────────────────────────────────────────────────────
ALTER TABLE public.players ADD COLUMN IF NOT EXISTS grades_checked_at timestamptz;

COMMENT ON COLUMN public.players.grades_checked_at IS
  'When the auto-conferral route last re-derived this player''s colours. Read '
  'by grades_need_recheck() and written by the route with the service key. NOT '
  'pinned: a player can PATCH their own, which only suppresses their own '
  'ordinary rechecks; the session-end and kaiwhakawā paths force a full run. '
  'Null means never checked, which always forces a full run.';

-- ── 2. A colour can be conferred by nobody ──────────────────────────────────
-- Null = the server conferred it automatically. Kept as a column rather than a
-- separate flag so "who released this" stays one question with one answer.
ALTER TABLE public.grade_awards ALTER COLUMN conferred_by DROP NOT NULL;

COMMENT ON COLUMN public.grade_awards.conferred_by IS
  'The kaiwhakawā who released this colour, or NULL when the server conferred '
  'it automatically (docs/designs/auto-conferral-spec.md).';

-- Awards are no longer append-only: deleting the evidence behind a colour
-- removes the colour (spec decision 5). Said here because the table comment is
-- where the next person looks.
COMMENT ON TABLE public.grade_awards IS
  'One row per colour conferred in a domain. NOT append-only since the '
  'auto-conferral rebuild: a kaiwhakawā deleting a bad workout entry re-judges '
  'that one domain and removes what the remaining evidence no longer supports. '
  'An ordinary recheck only ever confers, so a revised standards sheet never '
  'demotes anyone on its own. A deletion re-judges against TODAY''s standards.';

-- ── 3. The cheap probe ──────────────────────────────────────────────────────
-- One round trip, answering "is there any point doing the full work?".
--
-- It leans towards true: a false positive costs one wasted recompute, a false
-- negative withholds a colour someone earned.
--
-- WHAT IT CANNOT SEE: an EDIT. results and workout_entries have no updated_at,
-- so raising an existing score, or fitting an old unfitted entry, leaves no
-- trace here. Such a colour is not lost, only late: the session-end screen and
-- the kaiwhakawā panel both recheck with force, which skips this probe, and
-- the next game anywhere marks the player dirty again.
--
-- SECURITY DEFINER so RLS cannot turn "you may not see that row" into "nothing
-- has changed" — which would be exactly that false negative. It checks
-- can_log_for() FIRST, so it can still only answer about a player the caller is
-- allowed to act for, and cannot be used to probe anyone else's activity.
CREATE OR REPLACE FUNCTION public.grades_need_recheck(p_player_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_since timestamptz;
BEGIN
  IF NOT public.can_log_for(p_player_id) THEN
    RAISE EXCEPTION 'grades_need_recheck: not your player' USING ERRCODE = '42501';
  END IF;

  SELECT grades_checked_at INTO v_since FROM players WHERE id = p_player_id;
  IF NOT FOUND OR v_since IS NULL THEN
    RETURN true;                      -- never checked
  END IF;

  -- The player's own evidence.
  IF EXISTS (SELECT 1 FROM results WHERE player_id = p_player_id AND created_at > v_since) THEN RETURN true; END IF;
  IF EXISTS (
    SELECT 1 FROM workout_entries e JOIN workouts w ON w.id = e.workout_id
    WHERE w.player_id = p_player_id AND e.created_at > v_since
  ) THEN RETURN true; END IF;
  IF EXISTS (SELECT 1 FROM grade_exemptions WHERE player_id = p_player_id AND created_at > v_since) THEN RETURN true; END IF;

  -- Matches are NOT scoped to the player, on purpose: a head-to-head rating is
  -- replayed over every match, so another player's game can move this player's
  -- rating through a shared opponent.
  IF EXISTS (
    SELECT 1 FROM matches WHERE created_at > v_since OR confirmed_at > v_since
  ) THEN RETURN true; END IF;
  -- Sessions ARE scoped: a game closing or being voided only changes which of
  -- THIS player's results count, and only if they played in it. Unscoped,
  -- every game anyone finished sent every player through a full recompute.
  -- Driven from the player's results so it rides results_player_created_idx
  -- and the sessions primary key, not a scan of every session's results.
  IF EXISTS (
    SELECT 1 FROM results r JOIN sessions s ON s.id = r.session_id
    WHERE r.player_id = p_player_id
      -- points_awarded_at is stamped NOW() when the close is processed, so it
      -- catches a game that closed after a recheck had already read it as
      -- still in progress. ended_at alone cannot: a game that runs out is
      -- given ended_at = started_at + 100 minutes, earlier than that recheck's
      -- watermark, and the game just played would be masked.
      AND (s.ended_at > v_since OR s.voided_at > v_since OR s.points_awarded_at > v_since)
  ) THEN RETURN true; END IF;

  RETURN false;
END;
$$;

REVOKE ALL ON FUNCTION public.grades_need_recheck(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.grades_need_recheck(uuid) TO authenticated, service_role;

COMMENT ON FUNCTION public.grades_need_recheck(uuid) IS
  'True when anything has happened since players.grades_checked_at that could '
  'change this player''s colours. Conservative: uncertain always returns true.';

-- The probe asks "any result of mine newer than X?" on almost every HOME and
-- COLOURS open. The only index on results.player_id was partial (wins only),
-- so without this it scanned the table each time.
CREATE INDEX IF NOT EXISTS results_player_created_idx ON public.results (player_id, created_at);

-- ── 4. A change to what the grade is computed FROM marks the player dirty ──
-- Setting a first bodyweight band makes every lift gradeable, and a kaiwhakawā
-- moving a division shifts every ladder, but neither leaves a new result or
-- entry for the probe to find. Clearing the watermark here makes the next
-- recheck do the full run. It writes only the row being updated.
CREATE OR REPLACE FUNCTION public.reset_grades_watermark()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.bodyweight_band IS DISTINCT FROM OLD.bodyweight_band
     OR NEW.division IS DISTINCT FROM OLD.division
     OR NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth
     OR NEW.gender IS DISTINCT FROM OLD.gender
     OR NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    NEW.grades_checked_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reset_grades_watermark ON public.players;
CREATE TRIGGER trg_reset_grades_watermark
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.reset_grades_watermark();

-- ── 5. Assertions ───────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'grades_need_recheck'
      AND p.prosecdef AND p.proconfig @> ARRAY['search_path=public']
  ) THEN
    RAISE EXCEPTION 'grades_need_recheck is missing, not SECURITY DEFINER, or has no pinned search_path';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'grade_awards'
      AND column_name = 'conferred_by' AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'grade_awards.conferred_by is still NOT NULL: the server cannot confer';
  END IF;
END $$;
