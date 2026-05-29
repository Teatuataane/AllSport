-- Rename OHP → Clean & Press in session_events
UPDATE session_events
SET event_name = 'Clean & Press'
WHERE event_name = 'OHP';

-- Rename Reverse Hyper D2 tier: "Back Extension" → "Back Extension Hold" in results
-- Scoped to results linked to Reverse Hyper session events only
UPDATE results r
SET difficulty_tier = 'Back Extension Hold'
FROM session_events se
WHERE r.event_id = se.id
  AND se.event_name = 'Reverse Hyper'
  AND r.difficulty_tier = 'Back Extension';
