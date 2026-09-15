-- Pure contests gain a drill ladder; loaded carries go to bodyweight (Sept 2026)
--
-- The history half of `feat(events): drills for the pure contests, bodyweight
-- carries`, which the grading review settled. Two things:
--
--   1. Ten pure contests were plain `sport` and now top a drill ladder with a
--      Game rung. Their rows carry difficulty_tier NULL and a bare 0/1/2, so
--      anything keyed on difficulty_tier cannot see them, and sportTermOf()
--      reads them as nothing. Each lands on its Game rung with its result kept:
--      raw = game_idx * 10000 + (win 2 / draw 1 / loss 0). The term is NOT
--      inverted on the five raced ladders, or a loss would beat a win.
--   2. Weighted Carry, Wheelbarrow Push and Wheelbarrow Pull moved from fixed
--      kilos to fractions of bodyweight. A fixed-weight carry cannot be
--      converted without the carrier's bodyweight, which was never held, so
--      Tāne chose to ARCHIVE those rows rather than keep them ungraded.
--
-- Measured against production before writing, 2026-09-15:
--   Game repoint: Tag 11, Rats & Rabbits 5, Kabaddi 2, Beach Flags 28,
--     Arm Wrestling 4, Speed Chess 15, Fencing 24, Tae Kwon Do 11 = 100 rows,
--     every one with a result_type. Capture the Flag and Tug of War have none.
--   Archive: Weighted Carry 15 (25kg x6, 50kg x9). Wheelbarrows have none.
--   Wrestling (21 rows) is untouched: it stays plain `sport`.
--
-- ⚠ DEPLOY THE CODE FIRST, THEN THIS. Reversed, session_events holds Game rungs
-- the deployed bundle does not know. Code-first only hides these 100 results
-- from W/D/L displays until this lands.
--
-- ⚠ APPLY WITH `supabase db push` FROM MAIN. Every working table is TEMP …
-- ON COMMIT DROP and the CLI runs the file in one transaction, so there is no
-- BEGIN/COMMIT here: an explicit one would end that transaction before the
-- ledger row is written.
--
-- ⚠ REWRITES DERIVED DATA and ends with assertions, so a partial apply cannot
-- report success. event_domains is NOT re-seeded: the roster did not change.

-- The Game rung's 0-based index on each new ladder. Pinned against
-- lib/eventData.ts by __tests__/gradingLadders.test.ts, so the two cannot drift.
CREATE TEMP TABLE contest_game (event_name text PRIMARY KEY, game_idx int NOT NULL) ON COMMIT DROP;
INSERT INTO contest_game VALUES
  ('Arm Wrestling', 4),
  ('Tug of War', 4),
  ('Tag', 1),
  ('Beach Flags', 1),
  ('Rats & Rabbits', 1),
  ('Speed Chess', 3),
  ('Capture the Flag', 1),
  ('Kabaddi', 1),
  ('Tae Kwon Do', 3),
  ('Fencing', 3);

-- The new bodyweight ladder. Any row carrying another level is a fixed-weight
-- carry and goes to the archive.
CREATE TEMP TABLE carry_rungs (event_name text, tier_name text) ON COMMIT DROP;
INSERT INTO carry_rungs
SELECT e, t
FROM unnest(ARRAY['Weighted Carry', 'Wheelbarrow Push', 'Wheelbarrow Pull']) AS e,
     unnest(ARRAY['¼ BW — 200m', '½ BW — 200m', '¾ BW — 200m', 'Bodyweight — 200m']) AS t;

-- Pre-image of every row this file rewrites, so the repoint is reversible
-- without arithmetic. The archive below is the pre-image for deleted rows.
-- Deliberately NOT `IF NOT EXISTS`: a pre-existing table means a prior partial
-- apply.
CREATE TABLE public.results_grading_preimage_20260915040534 AS
SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, r.result_type,
       se.event_name, now() AS captured_at
FROM results r
JOIN session_events se ON se.id = r.event_id
JOIN contest_game g ON g.event_name = se.event_name
WHERE r.difficulty_tier IS NULL;
ALTER TABLE public.results_grading_preimage_20260915040534 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_grading_preimage_20260915040534 FROM anon, authenticated;

-- ── Sessions whose derived data will need recomputing ────────────────────────
-- Captured BEFORE anything is deleted: once a row is gone its session_id is too.
-- Same discriminator as 20260828204652 and the September repair: closed, points
-- actually awarded, and carrying a summary or awarded points. A voided session
-- has neither and must stay unplaced.
CREATE TEMP TABLE touched_sessions (session_id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO touched_sessions
SELECT DISTINCT r.session_id
FROM results r
JOIN sessions s ON s.id = r.session_id
JOIN session_events se ON se.id = r.event_id
WHERE r.session_id IS NOT NULL
  AND (se.event_name IN (SELECT event_name FROM contest_game)
       OR se.event_name IN (SELECT event_name FROM carry_rungs))
  AND s.is_active = false
  AND s.points_awarded_at IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM session_player_summary sp WHERE sp.session_id = s.id)
    OR EXISTS (SELECT 1 FROM results r2 WHERE r2.session_id = s.id AND r2.points_earned IS NOT NULL)
  )
ON CONFLICT DO NOTHING;

-- ── 1. Pure contests: each result onto its Game rung ─────────────────────────
-- Same shape as the September repair's `was sport` pass, including the label,
-- which 5f777df matched to what the app writes.
CREATE TEMP TABLE repointed (id uuid PRIMARY KEY) ON COMMIT DROP;
WITH upd AS (
  UPDATE results r SET
    difficulty_tier = 'Game',
    raw_score = g.game_idx * 10000 + GREATEST(LEAST(r.raw_score, 2), 0),
    score_label = 'D' || (g.game_idx + 1) || ' Game · ' ||
      COALESCE(NULLIF(r.score_label, ''), ''),
    result_type = COALESCE(r.result_type,
      CASE r.raw_score WHEN 2 THEN 'win' WHEN 1 THEN 'draw' ELSE 'loss' END)
  FROM session_events se, contest_game g
  WHERE se.id = r.event_id AND se.event_name = g.event_name
    AND r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL AND r.raw_score BETWEEN 0 AND 2
  RETURNING r.id
)
INSERT INTO repointed SELECT id FROM upd;

-- ── Rows that cannot survive ─────────────────────────────────────────────────
-- ONE definition, so the archive and the delete cannot disagree:
--   (a) a carry on a fixed-weight level (every carry row carries a level, but a
--       NULL one is caught too, since it decodes to nothing on this ladder);
--   (b) a pure-contest row the repoint could not take: a score outside 0..2 is
--       not a result. None exist today; this keeps the closing assertion from
--       aborting on one that appears before the push.
CREATE TEMP TABLE doomed ON COMMIT DROP AS
SELECT r.id
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE (
    se.event_name IN (SELECT event_name FROM carry_rungs)
    AND r.raw_score IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM carry_rungs c
                    WHERE c.event_name = se.event_name AND c.tier_name = r.difficulty_tier)
  ) OR (
    se.event_name IN (SELECT event_name FROM contest_game)
    AND r.difficulty_tier IS NULL
    AND r.raw_score IS NOT NULL
  );

-- CREATE TABLE … AS SELECT does NOT inherit RLS, and anything in public is
-- reachable through PostgREST, so RLS is enabled explicitly with no policies:
-- denies all API access while service_role keeps BYPASSRLS for a restore.
CREATE TABLE public.results_grading_archive_20260915040534 AS
SELECT r.*, se.event_name AS archived_event_name, now() AS archived_at
FROM results r
JOIN session_events se ON se.id = r.event_id
WHERE r.id IN (SELECT id FROM doomed);
ALTER TABLE public.results_grading_archive_20260915040534 ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.results_grading_archive_20260915040534 FROM anon, authenticated;

CREATE TEMP TABLE affected_players (player_id uuid PRIMARY KEY) ON COMMIT DROP;
INSERT INTO affected_players
SELECT DISTINCT r.player_id FROM results r
WHERE r.id IN (SELECT id FROM doomed) AND r.player_id IS NOT NULL
ON CONFLICT DO NOTHING;

DELETE FROM results WHERE id IN (SELECT id FROM doomed);

-- ── Recompute the derived data those rows feed ───────────────────────────────
-- event_placement / event_field_size are written only by
-- compute_event_placements(), and player_event_wins counts off them. A repointed
-- row keeps its order within its event (every row on a contest moved by the same
-- offset), but a deleted carry changes its field, so replay every touched
-- session rather than reason about which ones moved.
DO $$
DECLARE s record;
BEGIN
  FOR s IN SELECT session_id FROM touched_sessions LOOP
    PERFORM public.compute_event_placements(s.session_id);
  END LOOP;
END $$;

-- A lifetime total must be RECOMPUTED, never left to drift (CLAUDE.md), and
-- sync_player_taniwha never reduces body_parts, so a total that falls without
-- a rebuild breaks the budget invariant permanently.
DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT player_id FROM affected_players LOOP
    PERFORM public.recompute_player_total(p.player_id);
  END LOOP;
END $$;

-- ── Assertions. A rewrite that silently fails must not report success. ───────
DO $$
DECLARE
  v_untiered  int;
  v_wrong_idx int;
  v_old_carry int;
  v_archived  int;
  v_repointed int;
BEGIN
  -- The class this file exists to close: a row on a now-tiered contest with no
  -- level, which decodes to whatever the old scale meant.
  SELECT count(*) INTO v_untiered
  FROM results r
  JOIN session_events se ON se.id = r.event_id
  JOIN contest_game g ON g.event_name = se.event_name
  WHERE r.difficulty_tier IS NULL AND r.raw_score IS NOT NULL;
  IF v_untiered > 0 THEN
    RAISE EXCEPTION 'pure contest ladders: % rows on tiered contests still carry no level', v_untiered;
  END IF;

  -- Every Game row must decode to its own rung and a real result.
  SELECT count(*) INTO v_wrong_idx
  FROM results r
  JOIN session_events se ON se.id = r.event_id
  JOIN contest_game g ON g.event_name = se.event_name
  WHERE r.difficulty_tier = 'Game'
    AND (floor(r.raw_score / 10000) <> g.game_idx OR r.raw_score % 10000 NOT IN (0, 1, 2));
  IF v_wrong_idx > 0 THEN
    RAISE EXCEPTION 'pure contest ladders: % Game rows decode to the wrong rung or result', v_wrong_idx;
  END IF;

  SELECT count(*) INTO v_old_carry
  FROM results r
  JOIN session_events se ON se.id = r.event_id
  WHERE se.event_name IN (SELECT event_name FROM carry_rungs)
    AND r.raw_score IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM carry_rungs c
                    WHERE c.event_name = se.event_name AND c.tier_name = r.difficulty_tier);
  IF v_old_carry > 0 THEN
    RAISE EXCEPTION 'pure contest ladders: % carry rows still sit on a fixed-weight level', v_old_carry;
  END IF;

  SELECT count(*) INTO v_repointed FROM repointed;
  SELECT count(*) INTO v_archived FROM public.results_grading_archive_20260915040534;
  RAISE NOTICE 'pure contest ladders: % rows moved onto a Game rung, % rows archived',
    v_repointed, v_archived;
END $$;

-- The taniwha budget invariant, which deleting scored rows can break by
-- lowering a lifetime total. Guarded rather than assumed.
DO $$
DECLARE v_breaches int;
BEGIN
  IF to_regclass('public.player_taniwha') IS NULL THEN RETURN; END IF;
  SELECT count(*) INTO v_breaches FROM (
    SELECT pt.player_id
    FROM public.player_taniwha pt
    JOIN public.player_totals t ON t.player_id = pt.player_id
    GROUP BY pt.player_id, t.lifetime_points
    HAVING SUM(pt.body_parts) > public.taniwha_body_budget(t.lifetime_points)
  ) x;
  IF v_breaches > 0 THEN
    RAISE EXCEPTION
      'pure contest ladders: % players now hold more taniwha pieces than their lifetime points allow', v_breaches;
  END IF;
END $$;
