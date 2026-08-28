-- ─── compute_event_placements ranked ROWS, not players ──────────────────────
-- BUG, present since 20260824220633 and live in every placement ever computed.
--
-- The ranking CTE ran RANK() over every result ROW, with no reduction to one
-- row per player. Scoring an event three times in a session — which is not an
-- edge case, it is how effort points are earned, and how sport events are
-- normally played — put a player in the field three times. Three consequences,
-- all silent:
--
--   1. `event_field_size` counted SUBMISSIONS, not people. That is the number
--      the WIN_MIN_FIELD >= 3 rule reads, so one player logging three rounds
--      could manufacture the qualifying field a win requires.
--   2. `event_placement` ranked a player against their own other rows, so
--      everyone below them was pushed down.
--   3. `player_event_wins` does COUNT(*) over rows with event_placement = 1,
--      so a single win counted once per row — inflating progress toward the
--      9-of-12 domain crown.
--
-- Measured against production before this migration was written:
--   1183 rows carried a placement
--    227 player-events were double-placed
--    328 winning rows vs 151 true wins        (wins inflated by 2.2x)
--    147 rows sat in a field that only reached 3 because of duplicates
--    153 placements change
--
-- THE CLIENT WAS ALREADY RIGHT. `provisionalWins` in lib/taniwhaAlerts.ts
-- takes the best score per (player, event) and counts distinct players for the
-- field, and its comment says it "must agree exactly with
-- compute_event_placements()". It never did. This makes the SQL match the
-- client, not the other way round — the client's reading is the one the sport
-- actually means.
--
-- FIX: reduce to ONE row per (event, player) — their best submission — before
-- ranking. That row carries the placement and the field size; a player's other
-- rows keep NULL, which the function's opening statement already sets.
--
-- Exactly one placed row per player per event per session is what makes
-- `player_event_wins` COUNT(*) correct (one win per session, still counting
-- repeats across DIFFERENT sessions, which is the intent), and what makes
-- /prs average placement an average over players rather than over submissions.
-- So neither the view nor any client query changes.
--
-- NO CROWN IS REVOKED. Crowns are append-only and never taken back, and
-- `player_taniwha` holds zero crowns — nobody has reached the 10,000 lifetime
-- points that open the first one. Correcting the counts now, before any crown
-- can be banked on inflated wins, is the only cheap moment this fix will ever
-- have. Domain win counts DO drop: the club's top player goes from three
-- domains at or past 9 wins to one.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.compute_event_placements(p_session_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows INT;
BEGIN
  UPDATE results
  SET event_placement = NULL, event_field_size = NULL
  WHERE session_id = p_session_id
    AND (event_placement IS NOT NULL OR event_field_size IS NOT NULL);

  WITH scored AS (
    SELECT r.id,
           r.event_id,
           r.player_id,
           r.raw_score,
           public.division_pool(p.division) AS pool
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = p_session_id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
      AND public.division_pool(p.division) IS NOT NULL
  ),
  best AS (
    -- One row per player per event: their best submission. A player who logs
    -- three rounds is one competitor, not three. `id` breaks a tie between two
    -- identical scores so the chosen row is deterministic and re-running this
    -- function cannot move the placement between rows.
    SELECT DISTINCT ON (event_id, player_id)
           id, event_id, pool, raw_score
    FROM scored
    ORDER BY event_id, player_id, raw_score DESC, id
  ),
  ranked AS (
    SELECT id,
           RANK()   OVER (PARTITION BY event_id, pool ORDER BY raw_score DESC) AS placement,
           COUNT(*) OVER (PARTITION BY event_id, pool)                         AS field_size
    FROM best
  )
  UPDATE results r
  SET event_placement  = k.placement,
      event_field_size = k.field_size
  FROM ranked k
  WHERE r.id = k.id;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$$;

REVOKE ALL ON FUNCTION public.compute_event_placements(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.compute_event_placements(UUID) FROM anon;
REVOKE ALL ON FUNCTION public.compute_event_placements(UUID) FROM authenticated;

-- ── Recompute every session ────────────────────────────────────────────────
-- Same discriminator as the original backfill in 20260824220633: a session
-- that closed normally has session_player_summary rows, or (pre 20260514)
-- points_earned on its results. A VOIDED session has neither, and must stay
-- unplaced. The function NULLs before it writes, so this is idempotent and
-- clears the old inflated values as it goes.

DO $$
DECLARE
  s        RECORD;
  v_rows   INT;
  v_total  INT := 0;
  v_count  INT := 0;
BEGIN
  FOR s IN
    SELECT ss.id
    FROM sessions ss
    WHERE ss.is_active = false
      AND ss.points_awarded_at IS NOT NULL
      AND (
        EXISTS (SELECT 1 FROM session_player_summary sps WHERE sps.session_id = ss.id)
        OR EXISTS (SELECT 1 FROM results r
                    WHERE r.session_id = ss.id AND r.points_earned IS NOT NULL)
      )
    ORDER BY ss.session_date
  LOOP
    v_rows  := public.compute_event_placements(s.id);
    v_total := v_total + v_rows;
    v_count := v_count + 1;
  END LOOP;

  RAISE NOTICE 'event placements recomputed: % rows across % sessions', v_total, v_count;
END $$;

-- The invariant this whole migration exists to establish: never more than one
-- placed row per player per event per session. If it does not hold afterwards,
-- the dedupe did not take and the numbers are still wrong.
DO $$
DECLARE v_bad INT;
BEGIN
  SELECT COUNT(*) INTO v_bad FROM (
    SELECT session_id, event_id, player_id
    FROM results
    WHERE player_id IS NOT NULL AND event_placement IS NOT NULL
    GROUP BY 1, 2, 3
    HAVING COUNT(*) > 1
  ) q;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'still % player-events with more than one placed row', v_bad;
  END IF;
END $$;

-- ── Verify, by querying the objects ────────────────────────────────────────
--   select count(*) from results
--    where player_id is not null and event_placement is not null
--    group by session_id, event_id, player_id having count(*) > 1;  -- expect 0 rows
--   select count(*) from results
--    where event_placement = 1 and event_field_size >= 3;            -- expect 151
