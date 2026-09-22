-- ════════════════════════════════════════════════════════════════════════════
-- 20260921182106 — The attributes a colour is graded on cannot be self-edited
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHY
--   The grading engine reads three things off a player's own row: division
--   (Masters and Grandmaster shift the ladder one and two colours), date of
--   birth (juniors' age bands) and gender (which ladder a junior is graded on).
--   `players_update_own` lets a player UPDATE any column of their own row, and
--   guard_players_privileged_columns pins only role, is_guest, parent_id and id.
--
--   So a player could PATCH their row to division "Grandmaster Women", ask the
--   auto-conferral route to recheck them, and have the server write colours
--   two rungs up on another ladder with the service key. An ordinary recheck
--   never takes a colour back, so they would keep them after changing back.
--   Before auto-conferral a kaiwhakawā saw each release and knew who was who;
--   after it nobody looks. Found in the pre-landing review.
--
--   /privacy already promises this: "Ask a kaiwhakawā to correct anything else,
--   including your division." Nothing in the app edits these three after
--   registration. Only the database did not enforce it.
--
-- WHAT
--   A separate BEFORE UPDATE trigger on players refusing a change to division,
--   date_of_birth, gender or is_active unless a kaiwhakawā or trusted server
--   code makes it. is_active is here because the auto-conferral route refuses
--   an inactive (erased) profile, and that refusal is only as good as the flag.
--   INSERT is untouched: registration and adding a family member still set them.
--
-- "TRUSTED SERVER CODE" IS current_user, NOT auth.uid(). delete_my_account()
-- nulls date_of_birth and gender while auth.uid() is still the player, so a
-- guard keyed on auth.uid() alone rolled back every self-service erasure — the
-- right /privacy promises. It was caught in the second review cycle. A write
-- straight from a client runs as `authenticated`; a write from inside a
-- SECURITY DEFINER function runs as that function's owner. So this function is
-- deliberately SECURITY INVOKER, or current_user would always be its owner.
-- delete_my_account is the ONLY definer function that updates players, and
-- __tests__/autoConferral.test.ts fails the day another one appears.
--
-- A kaiwhakawā has no UPDATE policy on another player's row, so moving a
-- player between divisions as they age is done from the SQL Editor (no login),
-- which this guard lets through.
--
-- NOT redefining guard_players_privileged_columns (CLAUDE.md: a whole
-- redefinition is how a rule goes missing). Raises, rather than silently
-- pinning, to match how that guard treats role: a UI that ever tried to edit
-- these should fail loudly, not appear to succeed.
--
-- DEPLOY ORDER: either. Nothing in the app sends these columns on an update.
--
-- __tests__/autoConferral.test.ts pins this file.

CREATE OR REPLACE FUNCTION public.guard_players_grading_identity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  -- No login (a migration, the SQL Editor, the service key), or inside a
  -- SECURITY DEFINER function (account erasure), or a kaiwhakawā's own row.
  IF auth.uid() IS NULL
     OR current_user NOT IN ('authenticated', 'anon')
     OR public.is_judge() THEN
    RETURN NEW;
  END IF;

  IF NEW.division IS DISTINCT FROM OLD.division THEN
    RAISE EXCEPTION 'players.division can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  IF NEW.date_of_birth IS DISTINCT FROM OLD.date_of_birth THEN
    RAISE EXCEPTION 'players.date_of_birth can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  IF NEW.gender IS DISTINCT FROM OLD.gender THEN
    RAISE EXCEPTION 'players.gender can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  -- The live route never confers on an inactive (erased or retired) profile.
  -- A player able to switch themselves back on would undo that in one request.
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'players.is_active can only be changed by a kaiwhakawā' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_players_grading_identity() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_guard_players_grading_identity ON public.players;
CREATE TRIGGER trg_guard_players_grading_identity
  BEFORE UPDATE ON public.players
  FOR EACH ROW EXECUTE FUNCTION public.guard_players_grading_identity();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'players' AND t.tgname = 'trg_guard_players_grading_identity' AND NOT t.tgisinternal
  ) THEN
    RAISE EXCEPTION 'players grading-identity guard is missing';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'guard_players_grading_identity'
      AND NOT p.prosecdef AND p.proconfig @> ARRAY['search_path=public']
  ) THEN
    RAISE EXCEPTION 'guard_players_grading_identity must be SECURITY INVOKER (it reads current_user) with a pinned search_path';
  END IF;
END $$;
