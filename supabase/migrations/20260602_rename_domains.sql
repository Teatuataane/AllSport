-- Migration: rename and renumber domains (idempotent version)
-- Domain names were already renamed in earlier partial runs.
-- Safe to re-run regardless of current intermediate state.

-- ─── 1. Ensure domain_name strings are correct (no-ops if already applied) ───

UPDATE session_events SET domain_name = 'Calisthenics'        WHERE domain_name = 'Relative Strength';
UPDATE session_events SET domain_name = 'Anaerobic Endurance' WHERE domain_name = 'Muscular Endurance';
UPDATE session_events SET domain_name = 'Flexibility'         WHERE domain_name = 'Flexibility & Mobility';
UPDATE session_events SET domain_name = 'Speed'               WHERE domain_name = 'Speed & Agility';
UPDATE session_events SET domain_name = 'Coordination'        WHERE domain_name = 'Co-ordination';

UPDATE event_vote_nominations SET domain_name = 'Calisthenics'        WHERE domain_name = 'Relative Strength';
UPDATE event_vote_nominations SET domain_name = 'Anaerobic Endurance' WHERE domain_name = 'Muscular Endurance';
UPDATE event_vote_nominations SET domain_name = 'Flexibility'         WHERE domain_name = 'Flexibility & Mobility';
UPDATE event_vote_nominations SET domain_name = 'Speed'               WHERE domain_name = 'Speed & Agility';
UPDATE event_vote_nominations SET domain_name = 'Coordination'        WHERE domain_name = 'Co-ordination';

-- ─── 2. Set domain_number from domain_name (idempotent source-of-truth) ──────

UPDATE session_events
SET domain_number = CASE domain_name
  WHEN 'Maximal Strength'    THEN 1
  WHEN 'Calisthenics'        THEN 2
  WHEN 'Power'               THEN 3
  WHEN 'Speed'               THEN 4
  WHEN 'Anaerobic Endurance' THEN 5
  WHEN 'Aerobic Endurance'   THEN 6
  WHEN 'Flexibility'         THEN 7
  WHEN 'Body Awareness'      THEN 8
  WHEN 'Coordination'        THEN 9
  WHEN 'Aim & Precision'     THEN 10
  ELSE domain_number
END;

UPDATE event_vote_nominations
SET domain_number = CASE domain_name
  WHEN 'Maximal Strength'    THEN 1
  WHEN 'Calisthenics'        THEN 2
  WHEN 'Power'               THEN 3
  WHEN 'Speed'               THEN 4
  WHEN 'Anaerobic Endurance' THEN 5
  WHEN 'Aerobic Endurance'   THEN 6
  WHEN 'Flexibility'         THEN 7
  WHEN 'Body Awareness'      THEN 8
  WHEN 'Coordination'        THEN 9
  WHEN 'Aim & Precision'     THEN 10
  ELSE domain_number
END;

-- ─── 3. Fix event_vote_responses ─────────────────────────────────────────────
-- Strategy:
--   a) Find players with any mismatch.
--   b) DELETE all their responses and capture the deleted rows via RETURNING.
--   c) Build the correct set from the deleted rows (joined to nominations),
--      deduplicating with DISTINCT ON in case partial runs left duplicates.
--   d) INSERT with gen_random_uuid() so we never reuse an old id that might
--      still exist in the table.

WITH affected AS (
  SELECT DISTINCT evr.vote_id, evr.player_id
  FROM event_vote_responses evr
  JOIN event_vote_nominations evn
    ON evr.vote_id = evn.vote_id AND evr.chosen_event = evn.event_name
  WHERE evr.domain_number != evn.domain_number
),
del AS (
  DELETE FROM event_vote_responses
  WHERE (vote_id, player_id) IN (SELECT vote_id, player_id FROM affected)
  RETURNING *
),
correct AS (
  SELECT DISTINCT ON (del.vote_id, del.player_id, evn.domain_number)
    del.created_at,
    del.vote_id,
    del.player_id,
    evn.domain_number AS correct_dn,
    del.chosen_event,
    del.is_final
  FROM del
  JOIN event_vote_nominations evn
    ON del.vote_id = evn.vote_id AND del.chosen_event = evn.event_name
  ORDER BY del.vote_id, del.player_id, evn.domain_number, del.is_final DESC, del.id DESC
)
INSERT INTO event_vote_responses (id, created_at, vote_id, player_id, domain_number, chosen_event, is_final)
SELECT gen_random_uuid(), created_at, vote_id, player_id, correct_dn, chosen_event, is_final
FROM correct;
