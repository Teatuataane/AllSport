-- Grandmaster division spelling (v0.41.4.0)
--
-- The v2 schema (20260429000000) spelled the 60+ divisions 'Grandmasters Men'
-- and 'Grandmasters Women' in players_division_check, but everything that
-- writes or reads a division says 'Grandmaster Men' / 'Grandmaster Women':
-- the register form's calculateDivision, lib/rating.ts divisionPool, the
-- leaderboard and scoring screens, and compute_event_placements
-- (20260824220633). So nobody aged 60 or over could ever register: the
-- players insert failed with "violates check constraint
-- players_division_check" (reported 19 Oct 2026 on the register screen).
--
-- No row holds either spelling (checked live 19 Oct 2026), so this only swaps
-- the constraint to the spelling the app uses. 'Youth' stays allowed as the
-- legacy value lib/rating.ts still treats as Juniors.

ALTER TABLE public.players DROP CONSTRAINT IF EXISTS players_division_check;

ALTER TABLE public.players ADD CONSTRAINT players_division_check CHECK (division IN (
  'Youth', 'Juniors', 'Men''s', 'Women''s',
  'Masters Men', 'Masters Women',
  'Grandmaster Men', 'Grandmaster Women'
));
