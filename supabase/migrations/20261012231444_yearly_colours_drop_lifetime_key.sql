-- ════════════════════════════════════════════════════════════════════════════
-- 20261012231444 — Colours are earned per calendar year (part B)
-- ════════════════════════════════════════════════════════════════════════════
--
-- Drops the lifetime key, UNIQUE (player_id, domain_number, rung), so a colour
-- held in 2026 can be earned again in 2027. Part A (20261012230318) added the
-- year key that replaces it and kept this one only because the route live
-- before it upserted on these three columns.
--
-- DEPLOY ORDER: APPLY ONLY ONCE THE CODE THAT UPSERTS ON THE YEAR KEY IS LIVE
-- (v0.35.0.0, onConflict 'player_id,domain_number,rung,season_year'). Against
-- the older route every conferral would fail. Both parts ship in the same
-- change and are applied together after its deploy. Must be applied before
-- 1 January 2027: until it is, nobody can earn in 2027 a colour they held in
-- 2026 (the insert is refused by this key, and the route reports a 500).
--
-- The constraint was declared inline in 20260915051927 and so has a generated
-- name; it is found by its columns rather than assumed.

DO $$
DECLARE
  v_name text;
BEGIN
  FOR v_name IN
    SELECT c.conname FROM pg_constraint c
    WHERE c.conrelid = 'public.grade_awards'::regclass AND c.contype = 'u'
      AND (SELECT array_agg(a.attname::text ORDER BY a.attname)
           FROM unnest(c.conkey) k JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k)
          = ARRAY['domain_number', 'player_id', 'rung']
  LOOP
    EXECUTE format('ALTER TABLE public.grade_awards DROP CONSTRAINT %I', v_name);
  END LOOP;
END $$;

-- ── Closing checks — verify the objects, not the ledger ─────────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.grade_awards'::regclass AND contype = 'u' AND array_length(conkey, 1) = 3
  ) THEN
    RAISE EXCEPTION 'yearly colours B: the lifetime key is still there';
  END IF;
  -- The year key must stand in its place, or two rechecks racing could write
  -- the same colour twice.
  IF NOT EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = 'public.grade_awards'::regclass AND i.indisunique
      AND i.indexrelid = 'public.grade_awards_player_domain_rung_year_key'::regclass
  ) THEN
    RAISE EXCEPTION 'yearly colours B: the year key is missing; apply 20261012230318 first';
  END IF;
END $$;
