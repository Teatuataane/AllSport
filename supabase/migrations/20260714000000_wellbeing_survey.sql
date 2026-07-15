-- ════════════════════════════════════════════════════════════════════════════
-- 20260714 — Wellbeing survey (quarterly, validated instruments)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Run ONCE in the Supabase SQL Editor (idempotent — safe to re-run).
--
-- Instruments (10 items, ~90 seconds):
--  · WHO-5 Wellbeing Index — 5 items, 0–5 each ("at no time" … "all of the
--    time", last two weeks). Standard score = raw sum × 4 → 0–100.
--  · HBSC physical activity item — days in the last 7 with ≥60 min activity.
--  · Single-item self-rated fitness — 1 (poor) … 5 (excellent).
--  · 3 sport-context items (confidence / enjoyment / belonging, Voice-of-
--    Rangatahi style) — 1 (strongly disagree) … 5 (strongly agree).
--
-- Privacy: players (and parents, for family-member profiles) write and read
-- their own rows. Kaiwhakawā see ONLY aggregates, via the SECURITY DEFINER
-- RPC below — no judge policy on the raw table.

CREATE TABLE IF NOT EXISTS wellbeing_surveys (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  player_id   UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,

  -- WHO-5 (0–5 each)
  who5_cheerful   INT NOT NULL CHECK (who5_cheerful   BETWEEN 0 AND 5),
  who5_calm       INT NOT NULL CHECK (who5_calm       BETWEEN 0 AND 5),
  who5_active     INT NOT NULL CHECK (who5_active     BETWEEN 0 AND 5),
  who5_rested     INT NOT NULL CHECK (who5_rested     BETWEEN 0 AND 5),
  who5_interested INT NOT NULL CHECK (who5_interested BETWEEN 0 AND 5),

  -- Activity + fitness
  activity_days INT NOT NULL CHECK (activity_days BETWEEN 0 AND 7),
  fitness       INT NOT NULL CHECK (fitness BETWEEN 1 AND 5),

  -- Sport-context items (1–5 agree scale)
  confidence INT NOT NULL CHECK (confidence BETWEEN 1 AND 5),
  enjoyment  INT NOT NULL CHECK (enjoyment  BETWEEN 1 AND 5),
  belonging  INT NOT NULL CHECK (belonging  BETWEEN 1 AND 5)
);

CREATE INDEX IF NOT EXISTS idx_wellbeing_player ON wellbeing_surveys (player_id, created_at DESC);

ALTER TABLE wellbeing_surveys ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wellbeing_insert_own ON wellbeing_surveys;
CREATE POLICY wellbeing_insert_own ON wellbeing_surveys
  FOR INSERT WITH CHECK (
    auth.uid() = player_id
    OR EXISTS (SELECT 1 FROM players p WHERE p.id = player_id AND p.parent_id = auth.uid())
  );

DROP POLICY IF EXISTS wellbeing_select_own ON wellbeing_surveys;
CREATE POLICY wellbeing_select_own ON wellbeing_surveys
  FOR SELECT USING (
    auth.uid() = player_id
    OR EXISTS (SELECT 1 FROM players p WHERE p.id = player_id AND p.parent_id = auth.uid())
  );

-- ── Aggregate report for kaiwhakawā (no row-level access) ────────────────────
-- One row per quarter per cohort ('all' and 'rangatahi' = Juniors division).
-- Suppresses quarters with fewer than 3 respondents in a cohort so individual
-- answers can't be inferred.

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
