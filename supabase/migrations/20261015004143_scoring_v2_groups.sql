-- ─── Groups: schools, clubs and whānau (Scoring v2 step 4) ──────────────────
-- Tāne, 15 Oct 2026 (SCORING_V2_PLAN.md decisions 10 to 12):
--
--   10. A player may belong to ONE group of each kind (school, club, whānau).
--       The group's leader approves members; a leader (a teacher) can also
--       invite a class, and each invitation is accepted by the player or
--       their parent, so nobody is put on a board without saying yes.
--   11. The group board ranks by AVERAGE IMPROVEMENT PER ACTIVE MEMBER.
--       Improvement is the member's game colour score: the average of their
--       last three games this season (after their first) minus their first
--       game, in colours (a total of 120 is 12). Active = 3+ games this
--       season. Tāne chose game score over the exact overall on 15 Oct 2026:
--       the overall also rises just from trying more events, because unplayed
--       events count as Mā. The board shows active members and games beside
--       the rank; neither is counted in it.
--   12. The public board shows GROUPS ONLY, never a name. Inside a group,
--       members and the leader see names; an under-13 in a school group reads
--       "First L.". A leader gains NO access to bodyweights or wellbeing:
--       those tables are read through can_log_for() and RLS on their own
--       rows, neither of which this file touches.
--
-- Game colour totals are already public (player_game_colours, 20260928011813),
-- so the board needs no new published number; lib/groupBoard.ts mirrors the
-- rule and __tests__/groupBoard.test.ts pins the two together.
--
-- Writes go only through the SECURITY DEFINER functions below (no INSERT,
-- UPDATE or DELETE policy exists), each checking who is asking.
--
-- DEPLOY ORDER: MIGRATION FIRST, then code. The new /groups page reads these
-- objects and says "not live yet" without them; nothing old reads them.
-- ROLLBACK: DROP the functions, then group_members, then groups. Nothing else
-- references them.

BEGIN;

CREATE TABLE IF NOT EXISTS public.groups (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 2 AND 60),
  kind       text NOT NULL CHECK (kind IN ('school', 'club', 'whanau')),
  leader_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS groups_kind_name_key ON public.groups (kind, lower(btrim(name)));

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id   uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  -- Copied from the group so one-of-each-kind is a plain UNIQUE.
  kind       text NOT NULL CHECK (kind IN ('school', 'club', 'whanau')),
  -- pending: the player asked, the leader decides. invited: the leader asked,
  -- the player (or parent) decides. member: both agreed.
  status     text NOT NULL CHECK (status IN ('pending', 'invited', 'member')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, player_id),
  UNIQUE (player_id, kind)
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

-- Logged-in players can find a group to ask to join. No names live here.
DROP POLICY IF EXISTS groups_select_authenticated ON public.groups;
CREATE POLICY groups_select_authenticated ON public.groups FOR SELECT TO authenticated USING (true);

-- A membership row is seen by the player (or their parent), the group's
-- leader, and a kaiwhakawā. Other members see each other through
-- group_detail(), which applies the under-13 rule.
DROP POLICY IF EXISTS group_members_select ON public.group_members;
CREATE POLICY group_members_select ON public.group_members FOR SELECT TO authenticated USING (
  public.can_log_for(player_id)
  OR public.is_judge()
  OR EXISTS (SELECT 1 FROM public.groups g WHERE g.id = group_id AND g.leader_id = auth.uid())
);

REVOKE ALL ON public.groups, public.group_members FROM anon;
GRANT SELECT ON public.groups, public.group_members TO authenticated;

-- ─── Writes ──────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_group_leader(p_group_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    public.is_judge()
    OR EXISTS (SELECT 1 FROM groups WHERE id = p_group_id AND leader_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.create_group(p_name text, p_kind text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  -- A cap, not a rule anyone should meet: it stops a script filling the list.
  IF (SELECT count(*) FROM groups WHERE leader_id = auth.uid()) >= 10 THEN
    RAISE EXCEPTION 'you already lead 10 groups' USING ERRCODE = '22023';
  END IF;
  INSERT INTO groups (name, kind, leader_id) VALUES (btrim(p_name), p_kind, auth.uid()) RETURNING id INTO v_id;
  RETURN v_id;
END $$;

-- The player (or their parent) asks to join: pending until the leader says yes.
-- If the leader already invited them, asking accepts the invitation.
CREATE OR REPLACE FUNCTION public.request_group(p_group_id uuid, p_player_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind text; v_status text;
BEGIN
  IF NOT public.can_log_for(p_player_id) THEN RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501'; END IF;
  SELECT kind INTO v_kind FROM groups WHERE id = p_group_id;
  IF v_kind IS NULL THEN RAISE EXCEPTION 'no such group' USING ERRCODE = 'P0002'; END IF;
  SELECT status INTO v_status FROM group_members WHERE group_id = p_group_id AND player_id = p_player_id;
  IF v_status = 'invited' THEN
    UPDATE group_members SET status = 'member' WHERE group_id = p_group_id AND player_id = p_player_id;
    RETURN 'member';
  ELSIF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;
  -- UNIQUE (player_id, kind) refuses a second group of the same kind.
  INSERT INTO group_members (group_id, player_id, kind, status) VALUES (p_group_id, p_player_id, v_kind, 'pending');
  RETURN 'pending';
END $$;

-- The leader invites a player (a teacher adding a class). If the player had
-- already asked, inviting approves them.
CREATE OR REPLACE FUNCTION public.invite_to_group(p_group_id uuid, p_player_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_kind text; v_status text;
BEGIN
  IF NOT public.is_group_leader(p_group_id) THEN RAISE EXCEPTION 'not the leader' USING ERRCODE = '42501'; END IF;
  SELECT kind INTO v_kind FROM groups WHERE id = p_group_id;
  SELECT status INTO v_status FROM group_members WHERE group_id = p_group_id AND player_id = p_player_id;
  IF v_status = 'pending' THEN
    UPDATE group_members SET status = 'member' WHERE group_id = p_group_id AND player_id = p_player_id;
    RETURN 'member';
  ELSIF v_status IS NOT NULL THEN
    RETURN v_status;
  END IF;
  INSERT INTO group_members (group_id, player_id, kind, status) VALUES (p_group_id, p_player_id, v_kind, 'invited');
  RETURN 'invited';
END $$;

-- Say yes or no to the other side. The leader answers a request; the player
-- (or parent) answers an invitation. No removes the row.
CREATE OR REPLACE FUNCTION public.answer_group(p_group_id uuid, p_player_id uuid, p_accept boolean)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM group_members WHERE group_id = p_group_id AND player_id = p_player_id;
  IF v_status = 'pending' AND NOT public.is_group_leader(p_group_id) THEN
    RAISE EXCEPTION 'not the leader' USING ERRCODE = '42501';
  ELSIF v_status = 'invited' AND NOT public.can_log_for(p_player_id) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  ELSIF v_status IS NULL OR v_status = 'member' THEN
    RETURN v_status;
  END IF;
  IF p_accept THEN
    UPDATE group_members SET status = 'member' WHERE group_id = p_group_id AND player_id = p_player_id;
    RETURN 'member';
  END IF;
  DELETE FROM group_members WHERE group_id = p_group_id AND player_id = p_player_id;
  RETURN NULL;
END $$;

-- Leave (the player or parent) or remove (the leader). Always allowed to them.
CREATE OR REPLACE FUNCTION public.leave_group(p_group_id uuid, p_player_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.can_log_for(p_player_id) OR public.is_group_leader(p_group_id)) THEN
    RAISE EXCEPTION 'not allowed' USING ERRCODE = '42501';
  END IF;
  DELETE FROM group_members WHERE group_id = p_group_id AND player_id = p_player_id;
END $$;

-- The leader closes the group; its memberships go with it.
CREATE OR REPLACE FUNCTION public.delete_group(p_group_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.is_group_leader(p_group_id) THEN RAISE EXCEPTION 'not the leader' USING ERRCODE = '42501'; END IF;
  DELETE FROM groups WHERE id = p_group_id;
END $$;

-- ─── Reads ───────────────────────────────────────────────────────────────────

-- Each member's improvement in a season: their games in order, the first one,
-- and the average of the last three after it. Mirrors memberImprovement in
-- lib/groupBoard.ts. Same game filter as season_points: closed, not voided,
-- the player neither a guest nor inactive.
CREATE OR REPLACE FUNCTION public.group_member_progress(p_year int)
RETURNS TABLE (group_id uuid, player_id uuid, games int, improvement numeric)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH played AS (
    SELECT m.group_id, m.player_id, g.colour_total,
           ROW_NUMBER() OVER (PARTITION BY m.group_id, m.player_id ORDER BY s.started_at, s.id) AS n,
           COUNT(*) OVER (PARTITION BY m.group_id, m.player_id) AS total
    FROM group_members m
    JOIN player_game_colours g ON g.player_id = m.player_id
    JOIN sessions s ON s.id = g.session_id
    JOIN players p ON p.id = m.player_id
    WHERE m.status = 'member'
      AND s.is_active = false AND s.voided_at IS NULL
      AND EXTRACT(YEAR FROM s.session_date) = p_year
      AND p.is_active IS NOT FALSE AND p.is_guest IS NOT TRUE
  )
  SELECT group_id, player_id, MAX(total)::int AS games,
         CASE WHEN MAX(total) >= 3 THEN
           ROUND((AVG(colour_total) FILTER (WHERE n > 1 AND n > total - 3)
                  - MAX(colour_total) FILTER (WHERE n = 1)) / 10, 2)
         END AS improvement
  FROM played
  GROUP BY group_id, player_id
$$;
REVOKE ALL ON FUNCTION public.group_member_progress(int) FROM PUBLIC, anon, authenticated;

-- The public board: groups only, never a name. Ranked by average improvement
-- per active member; a group with no active member is listed unranked.
CREATE OR REPLACE FUNCTION public.group_board(p_year int)
RETURNS TABLE (group_id uuid, name text, kind text, active_members int, games int, improvement numeric, place int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH per AS (
    SELECT gr.id, gr.name, gr.kind,
           COUNT(pr.player_id) FILTER (WHERE pr.improvement IS NOT NULL)::int AS active_members,
           COALESCE(SUM(pr.games) FILTER (WHERE pr.improvement IS NOT NULL), 0)::int AS games,
           ROUND(AVG(pr.improvement), 2) AS improvement
    FROM groups gr
    LEFT JOIN public.group_member_progress(p_year) pr ON pr.group_id = gr.id
    GROUP BY gr.id, gr.name, gr.kind
  )
  SELECT id, name, kind, active_members, games, improvement,
         CASE WHEN improvement IS NOT NULL
              THEN (RANK() OVER (ORDER BY improvement DESC NULLS LAST))::int END AS place
  FROM per
  ORDER BY improvement DESC NULLS LAST, name
$$;
REVOKE ALL ON FUNCTION public.group_board(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.group_board(int) TO anon, authenticated;

-- Inside one group: its members with names, for the leader, a kaiwhakawā, or
-- anyone who is (or is the parent of) a member. An under-13 in a school group
-- reads "First L." to everyone but the leader and their own family. Requests
-- and invitations are shown to the leader only.
CREATE OR REPLACE FUNCTION public.group_detail(p_group_id uuid, p_year int)
RETURNS TABLE (player_id uuid, name text, status text, games int, improvement numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_leader boolean := public.is_group_leader(p_group_id);
        v_kind text;
BEGIN
  SELECT kind INTO v_kind FROM groups WHERE id = p_group_id;
  IF NOT v_leader AND NOT EXISTS (
    SELECT 1 FROM group_members m WHERE m.group_id = p_group_id AND m.status = 'member' AND public.can_log_for(m.player_id)
  ) THEN
    RAISE EXCEPTION 'not in this group' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT m.player_id,
         CASE
           WHEN v_kind = 'school' AND NOT v_leader AND NOT public.can_log_for(m.player_id)
                AND pl.date_of_birth IS NOT NULL AND date_part('year', age(pl.date_of_birth)) < 13
             THEN split_part(btrim(COALESCE(NULLIF(pl.full_name, ''), pp.display_name)), ' ', 1)
                  || COALESCE(' ' || NULLIF(left(split_part(btrim(COALESCE(NULLIF(pl.full_name, ''), '')), ' ', 2), 1), '') || '.', '')
           ELSE pp.display_name
         END,
         m.status,
         COALESCE(pr.games, 0),
         pr.improvement
  FROM group_members m
  JOIN players pl ON pl.id = m.player_id
  JOIN players_public pp ON pp.id = m.player_id
  LEFT JOIN public.group_member_progress(p_year) pr ON pr.group_id = m.group_id AND pr.player_id = m.player_id
  WHERE m.group_id = p_group_id AND (m.status = 'member' OR v_leader)
  ORDER BY pr.improvement DESC NULLS LAST, 2;
END $$;

REVOKE ALL ON FUNCTION public.is_group_leader(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_group(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.request_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.invite_to_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.answer_group(uuid, uuid, boolean) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.leave_group(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.group_detail(uuid, int) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.delete_group(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_group_leader(uuid), public.create_group(text, text), public.delete_group(uuid),
  public.request_group(uuid, uuid), public.invite_to_group(uuid, uuid),
  public.answer_group(uuid, uuid, boolean), public.leave_group(uuid, uuid),
  public.group_detail(uuid, int) TO authenticated;

DO $$
BEGIN
  IF NOT has_function_privilege('anon', 'public.group_board(int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'groups: the public board cannot be read';
  END IF;
  IF has_function_privilege('anon', 'public.group_detail(uuid, int)', 'EXECUTE') THEN
    RAISE EXCEPTION 'groups: names inside a group are exposed to anon';
  END IF;
  IF has_table_privilege('anon', 'public.group_members', 'SELECT') THEN
    RAISE EXCEPTION 'groups: memberships are exposed to anon';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public'
             AND tablename IN ('groups', 'group_members') AND cmd <> 'SELECT') THEN
    RAISE EXCEPTION 'groups: a write policy exists; writes go through the functions only';
  END IF;
END $$;

COMMIT;
