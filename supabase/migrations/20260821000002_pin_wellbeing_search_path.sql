-- ════════════════════════════════════════════════════════════════════════════
-- 20260821000002 — pin search_path on get_wellbeing_report()
-- ════════════════════════════════════════════════════════════════════════════
--
-- The last SECURITY DEFINER function in the schema without a pinned
-- search_path. claim_colour_award, get_vote_results, get_vote_details,
-- get_player_top_event, close_expired_sessions and is_judge all have one, and
-- search_players_by_username stopped being SECURITY DEFINER altogether in
-- v0.5.8.0. This closes the set.
--
-- LOW RISK, AND WORTH SAYING SO PLAINLY. A definer function with a mutable
-- search_path is the classic Postgres escalation shape: an attacker who can
-- create an object in a schema earlier in the path hijacks an unqualified
-- reference and runs it as the owner. Neither precondition holds here. The
-- function raises unless the caller is a kaiwhakawā, so it is not reachable
-- without an account let alone anonymously, and `authenticated` has no CREATE
-- on any schema in the path on Supabase.
--
-- RENUMBERED from 20260821000000: main landed 20260821000000_privacy_tidyup.sql
-- with the same timestamp while this branch was open. Git does not flag that
-- as a conflict (different filenames), but the Supabase CLI keys
-- schema_migrations on the numeric prefix alone, so two files sharing one
-- version is a collision it cannot represent.
--
-- It is fixed anyway because the mitigation is one line, and because the next
-- definer function somebody writes will be copied from an existing one. Better
-- that every example in the tree is correct.
--
-- Body is otherwise IDENTICAL to 20260714000000 — copied verbatim, not
-- retyped. The only changes are the added SET and the comment marking it. The
-- aggregation, the HAVING COUNT(*) >= 3 suppression that stops a quarter with
-- fewer than three respondents being individually identifiable, and the
-- judge-only guard are all unchanged.

CREATE OR REPLACE FUNCTION get_wellbeing_report()
RETURNS TABLE (
  quarter        TEXT,
  cohort         TEXT,
  respondents    BIGINT,
  who5_score     NUMERIC,  -- 0–100
  activity_days  NUMERIC,  -- 0–7
  fitness        NUMERIC,  -- 1–5
  confidence     NUMERIC,  -- 1–5
  enjoyment      NUMERIC,  -- 1–5
  belonging      NUMERIC   -- 1–5
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- ← the only functional change in this migration
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge') THEN
    RAISE EXCEPTION 'Kaiwhakawā only';
  END IF;

  RETURN QUERY
  WITH base AS (
    SELECT
      TO_CHAR(w.created_at, 'YYYY "Q"Q') AS q,
      CASE WHEN p.division IN ('Juniors', 'Youth') THEN 'rangatahi' ELSE 'adults' END AS c,
      (w.who5_cheerful + w.who5_calm + w.who5_active + w.who5_rested + w.who5_interested) * 4.0 AS who5,
      w.activity_days AS ad,
      w.fitness       AS fit,
      w.confidence    AS conf,
      w.enjoyment     AS enj,
      w.belonging     AS bel
    FROM wellbeing_surveys w
    JOIN players p ON p.id = w.player_id
  ),
  unioned AS (
    SELECT q, 'all'::TEXT AS cohort_name, who5, ad, fit, conf, enj, bel FROM base
    UNION ALL
    SELECT q, c AS cohort_name, who5, ad, fit, conf, enj, bel FROM base
  )
  SELECT
    u.q,
    u.cohort_name,
    COUNT(*),
    ROUND(AVG(u.who5), 1),
    ROUND(AVG(u.ad), 1),
    ROUND(AVG(u.fit), 2),
    ROUND(AVG(u.conf), 2),
    ROUND(AVG(u.enj), 2),
    ROUND(AVG(u.bel), 2)
  FROM unioned u
  GROUP BY u.q, u.cohort_name
  HAVING COUNT(*) >= 3
  ORDER BY u.q, u.cohort_name;
END;
$$;

-- ── Verification ────────────────────────────────────────────────────────────
-- Every SECURITY DEFINER function in public should now report a pinned path:
--   SELECT p.proname, p.prosecdef, p.proconfig
--     FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--    WHERE n.nspname = 'public' AND p.prosecdef
--    ORDER BY p.proname;
-- proconfig should read {search_path=public} for each. A NULL proconfig on a
-- prosecdef row is the gap this migration closes.
