-- Remove disadvantage system and adjusted_score from results.
-- The disadvantage feature (self-declared small/large, score multipliers) has been removed.
-- Players now compete within their own division only; no cross-division handicapping needed.
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New query)

ALTER TABLE results DROP COLUMN IF EXISTS adjusted_score;
ALTER TABLE results DROP COLUMN IF EXISTS disadvantage_type;
ALTER TABLE results DROP COLUMN IF EXISTS disadvantage_option;
