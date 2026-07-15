-- ════════════════════════════════════════════════════════════════════════════
-- 20260713b — Breath Hold ranks longer-as-better; Duck Walk all-walk tiers
-- ════════════════════════════════════════════════════════════════════════════
--
-- Run ONCE in the Supabase SQL Editor, AFTER 20260713_fix_double_award.sql.
-- Both re-encodes are one-time transforms — do NOT run twice.
--
--  1. BREATH HOLD — was `time` mode (raw_score = −seconds, faster ranked
--     better), so a longer hold LOST. Now `hold` mode in the app
--     (raw_score = +seconds). Flip existing rows from negative to positive.
--  2. DUCK WALK — tiers redesigned to walks only (10m/25m/50m/100m/200m) and
--     the event joined the faster-wins set. Old walk rows re-encode to their
--     new tier index with the inverted within-tier term
--     (raw = tierIdx*10000 + (10000 − secs)). Old hold rows ('Squat Hold',
--     'OH Squat Hold') have no equivalent tier and are left untouched — they
--     keep their stored labels in history and rank below walk scores.

-- ── 1. Breath Hold: negative → positive seconds ──────────────────────────────

UPDATE results r
SET raw_score = -r.raw_score
FROM session_events se
WHERE r.event_id = se.id
  AND se.event_name = 'Breath Hold'
  AND r.raw_score IS NOT NULL
  AND r.raw_score < 0;

-- ── 2. Duck Walk: re-encode old walk tiers to the new ladder ─────────────────
-- Old ladder: D1 Squat Hold, D2 OH Squat Hold, D3 25m, D4 50m, D5 100m
--             (raw = oldIdx*10000 + secs, longer ranked better — wrong for walks)
-- New ladder: D1 10m, D2 25m, D3 50m, D4 100m, D5 200m
--             (raw = newIdx*10000 + (10000 − secs), faster wins)

UPDATE results r
SET raw_score = (CASE r.difficulty_tier
                   WHEN '25m Duck Walk'  THEN 1
                   WHEN '50m Duck Walk'  THEN 2
                   WHEN '100m Duck Walk' THEN 3
                 END) * 10000
                + (10000 - MOD(r.raw_score::INT, 10000))
FROM session_events se
WHERE r.event_id = se.id
  AND se.event_name = 'Duck Walk'
  AND r.raw_score IS NOT NULL
  -- guard against double-run: only rows still at their OLD tier index qualify;
  -- after re-encoding each tier sits one index lower, so this matches nothing.
  AND FLOOR(r.raw_score / 10000.0)::INT = (CASE r.difficulty_tier
        WHEN '25m Duck Walk'  THEN 2
        WHEN '50m Duck Walk'  THEN 3
        WHEN '100m Duck Walk' THEN 4
      END);
