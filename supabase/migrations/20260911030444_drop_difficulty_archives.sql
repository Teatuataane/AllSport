-- Drop the difficulty-rebuild archives, and fix the doubled Golf suffix
--
-- The three archive tables have served their purpose. Exported first, in full
-- and verified (row counts matched, every id present and unique), to a private
-- directory outside this repo — the repo is public and these rows are player
-- scores, so the export is deliberately NOT committed:
--
--   ~/allsport-backups/difficulty-rebuild-20260911/
--     results_difficulty_archive_20260910025855.json    52 rows, deleted scores
--     results_difficulty_preimage_20260910025855.json  931 rows, pre-encode state
--     results_leg_extension_archive_20260801.json       17 rows, Aug 2026
--
-- results_leg_extension_archive_20260801's stated condition is met: it was kept
-- "until the Leg Ext Hold call is settled", and Leg Ext Hold became weight+time
-- in v0.7.1.0.
--
-- These are dropped rather than left because anything in `public` is reachable
-- through PostgREST. Their RLS was correct (401 / 42501 to anon), but a table
-- nobody needs is a surface nobody is watching.

DROP TABLE IF EXISTS public.results_difficulty_archive_20260910025855;
DROP TABLE IF EXISTS public.results_difficulty_preimage_20260910025855;
DROP TABLE IF EXISTS public.results_leg_extension_archive_20260801;

-- The gained-ladder pass built a repaired Golf label by appending the OLD
-- score_label to the new rung name, so a round reads
--   "D4 Game (4 Holes) · 18 strokes (4 holes)"
-- with the suffix twice. Cosmetic, but it is what a player sees on /prs.
UPDATE public.results
SET score_label = replace(score_label, ' strokes (4 holes)', ' strokes')
WHERE score_label LIKE '%strokes (4 holes)%';

DO $$
DECLARE v_left int; v_dupes int;
BEGIN
  SELECT count(*) INTO v_left FROM information_schema.tables
   WHERE table_schema = 'public' AND table_name IN (
     'results_difficulty_archive_20260910025855',
     'results_difficulty_preimage_20260910025855',
     'results_leg_extension_archive_20260801');
  IF v_left > 0 THEN
    RAISE EXCEPTION 'drop archives: % archive table(s) still present', v_left;
  END IF;

  SELECT count(*) INTO v_dupes FROM public.results
   WHERE score_label LIKE '%strokes (4 holes)%';
  IF v_dupes > 0 THEN
    RAISE EXCEPTION 'drop archives: % Golf labels still carry the doubled suffix', v_dupes;
  END IF;
END $$;
