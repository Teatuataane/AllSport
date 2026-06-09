-- Historic points adjustment — run in Supabase SQL Editor
-- Salvador Gomez +800, Rodrigo Gomez +1500, Zeke Stokes +1500 (season 2025)

UPDATE rankings
SET total_points = total_points + 800, updated_at = NOW()
WHERE player_id = (SELECT id FROM players WHERE full_name ILIKE '%Salvador%' LIMIT 1)
  AND season_year = 2025;

UPDATE rankings
SET total_points = total_points + 1500, updated_at = NOW()
WHERE player_id = (SELECT id FROM players WHERE full_name ILIKE '%Rodrigo%' LIMIT 1)
  AND season_year = 2025;

UPDATE rankings
SET total_points = total_points + 1500, updated_at = NOW()
WHERE player_id = (SELECT id FROM players WHERE full_name ILIKE '%Zeke%' LIMIT 1)
  AND season_year = 2025;

-- Verify: check affected rows
SELECT p.full_name, r.total_points, r.season_year
FROM rankings r
JOIN players p ON p.id = r.player_id
WHERE r.season_year = 2025
  AND p.full_name ILIKE ANY(ARRAY['%Salvador%','%Rodrigo%','%Zeke%'])
ORDER BY r.total_points DESC;
