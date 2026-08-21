-- ════════════════════════════════════════════════════════════════════════════
-- 20260813000000 — Block kaiwhakawā self-promotion (privilege escalation)
-- ════════════════════════════════════════════════════════════════════════════
--
-- THE HOLE
-- `players_update_own` is `FOR UPDATE USING (auth.uid() = id)` with no column
-- restriction, and the only constraint on the column is
-- `CHECK (role IN ('player','judge'))` — which permits exactly the value that
-- matters. RLS is ROW-level, so no policy can stop a player rewriting *which
-- columns* of their own row they change:
--
--     PATCH /rest/v1/players?id=eq.<own-uid>   {"role":"judge"}
--
-- That one request grants: edit/delete any player's scores, create/end/void
-- sessions, read every koha donation, read get_vote_details() with voter names
-- attached, read the wellbeing report, and call claim_colour_award().
--
-- `players_insert_own` is `WITH CHECK (id = auth.uid())` with the same gap, so
-- a brand-new registration can simply POST role='judge' from the start.
--
-- THE FIX
-- A BEFORE INSERT OR UPDATE trigger. Chosen over column-level grants
-- (`REVOKE UPDATE ON players; GRANT UPDATE (col, col, …)`) deliberately:
--   · a table-level UPDATE grant overrides column-level REVOKEs in Postgres,
--     so the grant approach means enumerating every legitimately-writable
--     column, and
--   · any column added later would silently become unwritable, breaking
--     registration or /profile at some unrelated future date.
-- The trigger fails closed on the columns that matter and stays correct as the
-- schema grows. Column grants remain a valid belt-and-braces addition later.
--
-- APP IMPACT: none. No client code writes `role`, `parent_id` or `is_guest` on
-- an UPDATE — judges are assigned by hand in SQL (see CLAUDE.md "User Roles"),
-- and family members are created by INSERT, not by reparenting an existing row.
-- Safe to apply before any code deploy.

-- ── Judge test that cannot recurse ──────────────────────────────────────────
-- SECURITY DEFINER so it runs as the owner and bypasses RLS on `players`.
-- This matters in 20260813000003, where a SELECT policy ON players needs to ask
-- "is the caller a judge?" — asking that with a plain subquery would re-enter
-- the same policy and raise "infinite recursion detected in policy".
CREATE OR REPLACE FUNCTION public.is_judge()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge'
  );
$$;

REVOKE ALL ON FUNCTION public.is_judge() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_judge() TO authenticated, anon;

COMMENT ON FUNCTION public.is_judge() IS
  'True if the current JWT belongs to a kaiwhakawā. SECURITY DEFINER so it can '
  'be called from inside an RLS policy on players without infinite recursion.';

-- ── The guard ───────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.guard_players_privileged_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- No JWT means service_role or a server-side job. RLS already denies anon
  -- every write path on players (every INSERT/UPDATE policy keys off
  -- auth.uid()), so this branch is only ever reached by trusted server code.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- A kaiwhakawā is already trusted with these columns. Note they still cannot
  -- reach another player's row: there is no judge UPDATE policy on players, so
  -- their writes are confined to their own row and their own children.
  IF public.is_judge() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Forced rather than rejected: registration legitimately POSTs a whole
    -- profile, and silently pinning role keeps a normal signup working while
    -- making `"role":"judge"` in the payload a no-op.
    NEW.role := 'player';
    NEW.is_guest := false;
    RETURN NEW;
  END IF;

  -- UPDATE: an attempt to move any of these is a tamper attempt, not a typo,
  -- so it fails loudly and lands in the Postgres log.
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION
      'players.role cannot be changed by a player (attempted % -> %)',
      COALESCE(OLD.role, 'null'), COALESCE(NEW.role, 'null')
      USING ERRCODE = '42501';
  END IF;

  IF NEW.is_guest IS DISTINCT FROM OLD.is_guest THEN
    RAISE EXCEPTION 'players.is_guest cannot be changed by a player'
      USING ERRCODE = '42501';
  END IF;

  -- Reparenting is how an account would be handed to someone else's family
  -- tree, which carries write access to it via players_update_child.
  IF NEW.parent_id IS DISTINCT FROM OLD.parent_id THEN
    RAISE EXCEPTION 'players.parent_id cannot be changed by a player'
      USING ERRCODE = '42501';
  END IF;

  -- id is already pinned by the USING clause being reused as the UPDATE check
  -- (Postgres reuses USING when WITH CHECK is omitted), but state it anyway so
  -- the invariant survives someone later adding an explicit WITH CHECK.
  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'players.id cannot be changed' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_guard_players_privileged_columns ON players;
CREATE TRIGGER trg_guard_players_privileged_columns
  BEFORE INSERT OR UPDATE ON players
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_players_privileged_columns();

-- ── Verification ────────────────────────────────────────────────────────────
-- As a non-judge player, this must now fail with 42501:
--   update players set role = 'judge' where id = auth.uid();
-- Confirm exactly one judge remains:
--   select role, count(*) from players group by role;
