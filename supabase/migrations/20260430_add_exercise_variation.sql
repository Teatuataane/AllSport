-- Add exercise_variation column to results
-- Required for dynamic-mode events (Planche, Flag, Front Lever, Back Lever, Iron Cross, Climbing)
-- which store the selected variation/tier option in this column.
-- Without it, any score submission for those events fails with a PostgREST column-not-found error.

ALTER TABLE results ADD COLUMN IF NOT EXISTS exercise_variation TEXT;
