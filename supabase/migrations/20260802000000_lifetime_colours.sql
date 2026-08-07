-- ════════════════════════════════════════════════════════════════════════════
-- 20260802 — Lifetime Colours: 19-rung ladder, player_totals, colour_awards
-- ════════════════════════════════════════════════════════════════════════════
--
-- Colour points stop resetting each January and accumulate for as long as a
-- player plays. `rankings` is UNCHANGED and still drives the /leaderboard
-- ranking, which stays seasonal so there is an annual contest and a newcomer
-- can still climb the board.
--
-- DEPLOY ORDER: this migration FIRST, then the code. It is purely additive and
-- no deployed code reads the new tables, so running it early is invisible. The
-- new client code REQUIRES player_totals to exist, so shipping code first would
-- break the dashboard for every logged-in player. (This is the opposite of the
-- 20260801 roster update, which had to go code-first.)
--
-- Idempotent — safe to re-run.
--
--   Part 1 — colour_ladder (19 rungs)
--   Part 2 — player_totals + colour_awards
--   Part 3 — recompute_player_total() + award_colour_rungs()
--   Part 4 — claim_colour_award() RPC (the live kaiwhakawā alert)
--   Part 5 — award_session_points() extended
--   Part 6 — seed, adjustments, and timeline reconstruction
--   Part 7 — verification (read-only)

-- ── Part 1: the ladder ───────────────────────────────────────────────────────
-- MUST stay in sync with lib/colours.ts. That file is the source of truth for
-- names, colours and styling; this table exists so the trigger and the backfill
-- can join against thresholds without hard-coding them nineteen times.

CREATE TABLE IF NOT EXISTS public.colour_ladder (
  rung      INT  PRIMARY KEY CHECK (rung BETWEEN 1 AND 19),
  name      TEXT NOT NULL UNIQUE,
  threshold INT  NOT NULL UNIQUE CHECK (threshold >= 0)
);

INSERT INTO public.colour_ladder (rung, name, threshold) VALUES
  ( 1, 'Mā',                0),
  ( 2, 'Kiwikiwi',        500),
  ( 3, 'Whero',          1000),
  ( 4, 'Karaka',         2000),
  ( 5, 'Kōwhai',         3000),
  ( 6, 'Kākāriki',       4000),
  ( 7, 'Kahurangi',      5000),
  ( 8, 'Poroporo',       6000),
  ( 9, 'Uenuku',         8000),
  (10, 'Taniwha',       10000),
  (11, 'Taniwha Kiwikiwi',  20000),
  (12, 'Taniwha Whero',     30000),
  (13, 'Taniwha Karaka',    40000),
  (14, 'Taniwha Kōwhai',    50000),
  (15, 'Taniwha Kākāriki',  60000),
  (16, 'Taniwha Kahurangi', 70000),
  (17, 'Taniwha Poroporo',  80000),
  (18, 'Taniwha Uenuku',    90000),
  (19, 'Ngā Taniwha',      100000)
ON CONFLICT (rung) DO UPDATE
  SET name = EXCLUDED.name, threshold = EXCLUDED.threshold;

ALTER TABLE public.colour_ladder ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "colour_ladder_read" ON public.colour_ladder;
CREATE POLICY "colour_ladder_read" ON public.colour_ladder FOR SELECT USING (true);
-- Explicit, rather than relying on Supabase's default privileges for new
-- tables in public. The 20260801 archive table is the cautionary tale here.
GRANT SELECT ON public.colour_ladder TO anon, authenticated;

-- ── Part 2: lifetime totals + the award ledger ───────────────────────────────
-- player_totals is keyed on player_id ALONE. `rankings` is keyed
-- (player_id, season_year, division), so when a Junior turns 17 or a player
-- turns 40 the trigger inserts a brand new row starting at zero. Seasonal
-- points hid that because everything reset each January; a lifetime total keyed
-- the same way would silently halve on a birthday.

CREATE TABLE IF NOT EXISTS public.player_totals (
  player_id         UUID PRIMARY KEY REFERENCES public.players(id) ON DELETE CASCADE,
  -- Recomputed from session history. Never incremented: see Part 3.
  earned_points     INT NOT NULL DEFAULT 0,
  -- Manual, survives every recompute. See Part 6.
  adjustment_points INT NOT NULL DEFAULT 0,
  lifetime_points   INT GENERATED ALWAYS AS (earned_points + adjustment_points) STORED,
  lifetime_sessions INT NOT NULL DEFAULT 0,
  highest_rung      INT NOT NULL DEFAULT 1,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Public read: the leaderboard shows every player's colour to logged-out
-- visitors, and `rankings` is already publicly readable at the same grain.
ALTER TABLE public.player_totals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "player_totals_read" ON public.player_totals;
CREATE POLICY "player_totals_read" ON public.player_totals FOR SELECT USING (true);
-- No INSERT/UPDATE/DELETE policy: writes go through SECURITY DEFINER functions.

GRANT SELECT ON public.player_totals TO anon, authenticated;

CREATE INDEX IF NOT EXISTS player_totals_points_idx
  ON public.player_totals (lifetime_points DESC);

-- Append-only. A colour, once earned, is never lost: a voided session or a
-- deleted score can lower lifetime_points, but the row stays and display reads
-- the highest rung ever awarded.
CREATE TABLE IF NOT EXISTS public.colour_awards (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id       UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  rung            INT  NOT NULL CHECK (rung BETWEEN 2 AND 19), -- Mā is the start, not an award
  colour_name     TEXT NOT NULL,        -- snapshot, survives a future rename
  points_at_award INT  NOT NULL,
  session_id      UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  awarded_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- Set by the kaiwhakawā's "Celebrated" tap. Until it is set (or the causing
  -- session closes) the player is not shown the colour — the coach releases it.
  celebrated_at   TIMESTAMPTZ,
  UNIQUE (player_id, rung)
);

ALTER TABLE public.colour_awards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "colour_awards_select_own" ON public.colour_awards;
CREATE POLICY "colour_awards_select_own" ON public.colour_awards
  FOR SELECT USING (player_id = auth.uid());

-- Parents can see their family members' colours (same pattern as the dashboard).
DROP POLICY IF EXISTS "colour_awards_select_family" ON public.colour_awards;
CREATE POLICY "colour_awards_select_family" ON public.colour_awards
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = colour_awards.player_id AND parent_id = auth.uid())
  );

DROP POLICY IF EXISTS "colour_awards_select_judge" ON public.colour_awards;
CREATE POLICY "colour_awards_select_judge" ON public.colour_awards
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = auth.uid() AND role = 'judge')
  );

-- No anon: a logged-out visitor sees colours on the leaderboard via
-- player_totals.highest_rung, never the per-award ledger.
GRANT SELECT ON public.colour_awards TO authenticated;

CREATE INDEX IF NOT EXISTS colour_awards_player_idx ON public.colour_awards (player_id, rung);
CREATE INDEX IF NOT EXISTS colour_awards_session_idx ON public.colour_awards (session_id);

-- ── Part 3: recompute + award helpers ────────────────────────────────────────
-- FULL RECOMPUTE, never `earned_points = earned_points + x`.
--
-- The ×2 double-award bug (20260713000000) was caused by exactly that kind of
-- incremental accumulation. Under seasonal points a bug like that self-heals
-- every January. Under lifetime points it is PERMANENT. Same discipline already
-- used by lib/rating.ts, which recomputes ratings from full history by design.

CREATE OR REPLACE FUNCTION public.recompute_player_total(p_player UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_points   INT;
  v_sessions INT;
BEGIN
  WITH contrib AS (
    -- Truth source 1: session summaries (idempotent upserts, correct even
    -- through the double-fire era).
    SELECT sps.session_id,
           (sps.total_placement_points + sps.effort_points)::INT AS pts
    FROM session_player_summary sps
    WHERE sps.player_id = p_player

    UNION ALL

    -- Truth source 2: sessions closed before summaries existed (pre-20260514).
    -- points_earned repeats on every row for that player, so take MAX.
    SELECT r.session_id, MAX(r.points_earned)::INT
    FROM results r
    WHERE r.player_id = p_player
      AND r.points_earned IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM session_player_summary x
        WHERE x.session_id = r.session_id AND x.player_id = p_player
      )
    GROUP BY r.session_id
  )
  SELECT COALESCE(SUM(pts), 0), COUNT(*) INTO v_points, v_sessions FROM contrib;

  INSERT INTO player_totals (player_id, earned_points, lifetime_sessions, updated_at)
  VALUES (p_player, v_points, v_sessions, NOW())
  ON CONFLICT (player_id) DO UPDATE SET
    earned_points     = EXCLUDED.earned_points,
    lifetime_sessions = EXCLUDED.lifetime_sessions,
    updated_at        = NOW();
  -- adjustment_points is deliberately untouched.
END;
$$;

-- Writes a colour_awards row for every rung the player's CURRENT lifetime total
-- has reached and that has no row yet. Idempotent via the unique constraint.
CREATE OR REPLACE FUNCTION public.award_colour_rungs(p_player UUID, p_session UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO colour_awards (player_id, rung, colour_name, points_at_award, session_id)
  SELECT p_player, l.rung, l.name, t.lifetime_points, p_session
  FROM player_totals t
  JOIN colour_ladder l ON l.threshold > 0 AND l.threshold <= t.lifetime_points
  WHERE t.player_id = p_player
  ON CONFLICT (player_id, rung) DO NOTHING;

  UPDATE player_totals
  SET highest_rung = GREATEST(1, COALESCE(
        (SELECT MAX(rung) FROM colour_awards WHERE player_id = p_player), 1)),
      updated_at = NOW()
  WHERE player_id = p_player;
END;
$$;

-- ── Part 4: the live kaiwhakawā alert ────────────────────────────────────────
-- Points are only written when a session CLOSES, so an alert built on stored
-- data fires after everyone has packed up. This lets the coach claim the colour
-- while the player is still standing in front of them.
--
-- CONSERVATIVE by construction: it counts only what the player is GUARANTEED to
-- bank — the minimum placement award (10) plus effort already earned — and uses
-- NO placement ranking at all, so another player finishing strongly can never
-- invalidate a claim. Mirrors hasEarnedDuringSession() in lib/colours.ts.

-- The kaiwhakawā taps "Celebrated" on ONE colour chip, so the rung is passed in
-- and validated rather than the function sweeping every rung the player holds
-- (which would return their whole history on every tap). Returns zero rows if
-- the crossing is not yet guaranteed, so the client can say "not yet".

CREATE OR REPLACE FUNCTION public.claim_colour_award(
  p_player_id  UUID,
  p_session_id UUID,
  p_rung       INT
)
RETURNS TABLE (out_rung INT, out_colour_name TEXT, out_points INT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_participation    INT;
  v_pr_events        INT;
  v_task_completions INT;
  v_effort_level     INT;
  v_guaranteed       INT;
  v_lifetime         INT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge') THEN
    RAISE EXCEPTION 'claim_colour_award: kaiwhakawā only';
  END IF;

  -- Guarantees a player_totals row exists and that lifetime is current.
  PERFORM recompute_player_total(p_player_id);

  SELECT COUNT(DISTINCT event_id) INTO v_participation
  FROM results WHERE session_id = p_session_id AND player_id = p_player_id AND raw_score IS NOT NULL;

  SELECT COUNT(DISTINCT event_id) INTO v_pr_events
  FROM results WHERE session_id = p_session_id AND player_id = p_player_id AND is_pr = true;

  SELECT COALESCE(SUM(effort_task_completions), 0) INTO v_task_completions
  FROM results WHERE session_id = p_session_id AND player_id = p_player_id;

  v_effort_level := LEAST(v_participation + v_pr_events + v_task_completions, 20);
  -- The guaranteed floor: minimum placement award + effort already banked.
  -- No placement ranking, so no other player's result can invalidate it.
  v_guaranteed   := 10 + v_effort_level * 5;

  SELECT COALESCE(t.lifetime_points, 0) INTO v_lifetime
  FROM player_totals t WHERE t.player_id = p_player_id;
  v_lifetime := COALESCE(v_lifetime, 0);

  RETURN QUERY
  WITH claimed AS (
    INSERT INTO colour_awards
      (player_id, rung, colour_name, points_at_award, session_id, celebrated_at)
    SELECT p_player_id, l.rung, l.name, v_lifetime + v_guaranteed, p_session_id, NOW()
    FROM colour_ladder l
    WHERE l.rung = p_rung
      AND l.threshold > 0
      AND l.threshold <= v_lifetime + v_guaranteed
    -- The session may already have closed and the trigger written the row.
    -- The tap still counts as the celebration.
    ON CONFLICT (player_id, rung) DO UPDATE
      SET celebrated_at = COALESCE(colour_awards.celebrated_at, NOW())
    RETURNING colour_awards.rung, colour_awards.colour_name, colour_awards.points_at_award
  )
  SELECT c.rung, c.colour_name, c.points_at_award FROM claimed c;

  UPDATE player_totals
  SET highest_rung = GREATEST(1, COALESCE(
        (SELECT MAX(a.rung) FROM colour_awards a WHERE a.player_id = p_player_id), 1)),
      updated_at = NOW()
  WHERE player_id = p_player_id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_colour_award(UUID, UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.claim_colour_award(UUID, UUID, INT) FROM anon;
GRANT EXECUTE ON FUNCTION public.claim_colour_award(UUID, UUID, INT) TO authenticated;

-- ── Part 5: award_session_points, extended ───────────────────────────────────
-- Identical to 20260713000000 except:
--   * the `player_totals` CTE is renamed `player_event_totals` (it now collides
--     with the new table name and reading it was already confusing),
--   * two PERFORMs at the end of the per-player loop.
-- The atomic claim guard is unchanged.

CREATE OR REPLACE FUNCTION award_session_points()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  div_rec            RECORD;
  rec                RECORD;
  v_div_player_count INT;
  v_gap              NUMERIC;
  v_season_year      INT;
  v_placement_points NUMERIC;
  v_effort_level     INT;
  v_effort_pts       INT;
  v_total_points     NUMERIC;
  v_participation    INT;
  v_pr_events        INT;
  v_task_completions INT;
BEGIN
  -- Atomic claim: exactly one execution may pass this point per session.
  UPDATE sessions
  SET points_awarded_at = NOW()
  WHERE id = NEW.id AND points_awarded_at IS NULL;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM results
    WHERE session_id = NEW.id AND player_id IS NOT NULL AND raw_score IS NOT NULL
  ) THEN
    RETURN NEW;
  END IF;

  v_season_year := EXTRACT(YEAR FROM NOW())::INT;

  -- ── Step 1: per-division placement across ALL session events ───────────────
  WITH scored_players AS (
    SELECT DISTINCT r.player_id, p.division
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
  ),
  div_size AS (
    SELECT division, COUNT(*) AS n
    FROM scored_players
    GROUP BY division
  ),
  sess_events AS (
    SELECT id AS event_id
    FROM session_events
    WHERE session_id = NEW.id
  ),
  best_per_event AS (
    SELECT DISTINCT ON (r.player_id, r.event_id)
      r.player_id, r.event_id, r.raw_score
    FROM results r
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
    ORDER BY r.player_id, r.event_id, r.raw_score DESC
  ),
  grid AS (
    SELECT sp.player_id, sp.division, e.event_id, b.raw_score
    FROM scored_players sp
    CROSS JOIN sess_events e
    LEFT JOIN best_per_event b
      ON b.player_id = sp.player_id AND b.event_id = e.event_id
  ),
  event_div_ranks AS (
    SELECT
      g.player_id,
      g.division,
      g.event_id,
      CASE
        WHEN g.raw_score IS NULL THEN ds.n  -- missed event = last in division
        ELSE RANK() OVER (
          PARTITION BY g.event_id, g.division
          ORDER BY g.raw_score DESC NULLS LAST
        )
      END AS event_rank
    FROM grid g
    JOIN div_size ds ON ds.division = g.division
  ),
  player_event_totals AS (
    SELECT player_id, division, SUM(event_rank) AS total_placement
    FROM event_div_ranks
    GROUP BY player_id, division
  ),
  division_ranks AS (
    SELECT
      player_id,
      RANK() OVER (PARTITION BY division ORDER BY total_placement ASC) AS division_rank
    FROM player_event_totals
  )
  UPDATE results r
  SET placement = dr.division_rank
  FROM division_ranks dr
  WHERE r.player_id = dr.player_id
    AND r.session_id = NEW.id;

  -- ── Step 2: award placement + effort points per player per division ─────────
  FOR div_rec IN
    SELECT DISTINCT p.division
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
  LOOP
    SELECT COUNT(DISTINCT r.player_id) INTO v_div_player_count
    FROM results r
    JOIN players p ON p.id = r.player_id
    WHERE r.session_id = NEW.id
      AND r.player_id IS NOT NULL
      AND r.raw_score IS NOT NULL
      AND p.division = div_rec.division;

    IF v_div_player_count = 0 THEN CONTINUE; END IF;

    v_gap := 100.0 / v_div_player_count;

    FOR rec IN
      SELECT DISTINCT ON (r.player_id)
        r.player_id,
        r.placement,
        p.division
      FROM results r
      JOIN players p ON p.id = r.player_id
      WHERE r.session_id = NEW.id
        AND r.player_id IS NOT NULL
        AND r.placement IS NOT NULL
        AND p.division = div_rec.division
      ORDER BY r.player_id, r.placement ASC
    LOOP
      v_placement_points := GREATEST(100.0 - (v_gap * (rec.placement - 1)), 10.0);

      SELECT COUNT(DISTINCT event_id) INTO v_participation
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id
        AND raw_score IS NOT NULL;

      SELECT COUNT(DISTINCT event_id) INTO v_pr_events
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id
        AND is_pr = true;

      SELECT COALESCE(SUM(effort_task_completions), 0) INTO v_task_completions
      FROM results
      WHERE session_id = NEW.id
        AND player_id = rec.player_id;

      v_effort_level := LEAST(v_participation + v_pr_events + v_task_completions, 20);
      v_effort_pts   := v_effort_level * 5;

      v_total_points := ROUND(v_placement_points + v_effort_pts);

      UPDATE results
      SET points_earned = v_total_points
      WHERE session_id = NEW.id AND player_id = rec.player_id;

      INSERT INTO rankings (
        player_id, season_year, division,
        total_points, placement_points, effort_points,
        total_sessions, current_rank
      )
      VALUES (
        rec.player_id, v_season_year, rec.division,
        v_total_points, ROUND(v_placement_points), v_effort_pts,
        1, 0
      )
      ON CONFLICT (player_id, season_year, division) DO UPDATE SET
        total_points     = rankings.total_points     + EXCLUDED.total_points,
        placement_points = rankings.placement_points + EXCLUDED.placement_points,
        effort_points    = rankings.effort_points    + EXCLUDED.effort_points,
        total_sessions   = rankings.total_sessions   + 1,
        updated_at       = NOW();

      INSERT INTO session_player_summary (
        session_id, player_id, overall_placement,
        total_placement_points, effort_points, effort_level
      )
      VALUES (
        NEW.id, rec.player_id, rec.placement,
        ROUND(v_placement_points), v_effort_pts, v_effort_level
      )
      ON CONFLICT (session_id, player_id) DO UPDATE SET
        overall_placement      = EXCLUDED.overall_placement,
        total_placement_points = EXCLUDED.total_placement_points,
        effort_points          = EXCLUDED.effort_points,
        effort_level           = EXCLUDED.effort_level;

      -- ── NEW: lifetime colours ───────────────────────────────────────────────
      -- Runs after the summary upsert so the recompute sees this session.
      -- Rows the kaiwhakawā already claimed mid-session are no-ops here.
      PERFORM recompute_player_total(rec.player_id);
      PERFORM award_colour_rungs(rec.player_id, NEW.id);

    END LOOP;
  END LOOP;

  PERFORM refresh_rankings_rank(v_season_year);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auto_award_points ON sessions;
CREATE TRIGGER auto_award_points
  AFTER UPDATE ON sessions
  FOR EACH ROW
  WHEN (OLD.is_active = true AND NEW.is_active = false AND NEW.points_awarded_at IS NULL)
  EXECUTE FUNCTION award_session_points();

-- ── Part 6: seed, adjustments, timeline reconstruction ───────────────────────

-- 6a. A row for every player, with earned_points recomputed from history.
INSERT INTO public.player_totals (player_id)
SELECT id FROM public.players
ON CONFLICT (player_id) DO NOTHING;

DO $$
DECLARE p RECORD;
BEGIN
  FOR p IN SELECT id FROM players LOOP
    PERFORM recompute_player_total(p.id);
  END LOOP;
END;
$$;

-- 6b. Historic points that were never actually applied.
--
-- 20260610000000_historic_points.sql is a no-op twice over: it UPDATEs
-- season_year = 2025 rankings rows that have never existed in prod, and it
-- matches Zeke on full_name ILIKE '%Zeke%' when that player's full_name is
-- NULL (he is in the DB with display_name 'Zebe'). So 3,800 points of intended
-- recognition never landed.
--
-- These MUST live in adjustment_points, not in the total: earned_points is
-- recomputed, so anything added to it is silently wiped the next time that
-- player finishes a session. Assignment (not increment) keeps this re-runnable.

UPDATE public.player_totals SET adjustment_points = 800, updated_at = NOW()
WHERE player_id = (SELECT id FROM public.players WHERE full_name ILIKE '%Salvador%' LIMIT 1);

UPDATE public.player_totals SET adjustment_points = 1500, updated_at = NOW()
WHERE player_id = (SELECT id FROM public.players WHERE full_name ILIKE '%Rodrigo%' LIMIT 1);

UPDATE public.player_totals SET adjustment_points = 1500, updated_at = NOW()
WHERE player_id = (SELECT id FROM public.players WHERE display_name = 'Zebe' LIMIT 1);

-- 6c. Rungs already cleared by the adjustment alone, before any logged session.
-- Rodrigo starts on 1,500, so he was Whero before his first AllSport session in
-- this database. Runs BEFORE the replay so these keep the 2025 date rather than
-- being attributed to the first 2026 session.
INSERT INTO public.colour_awards
  (player_id, rung, colour_name, points_at_award, session_id, awarded_at, celebrated_at)
SELECT t.player_id, l.rung, l.name, t.adjustment_points, NULL,
       TIMESTAMPTZ '2025-12-31 00:00:00+13', TIMESTAMPTZ '2025-12-31 00:00:00+13'
FROM public.player_totals t
JOIN public.colour_ladder l ON l.threshold > 0 AND l.threshold <= t.adjustment_points
ON CONFLICT (player_id, rung) DO NOTHING;

-- 6d. Reconstruct the real crossing dates by replaying each player's sessions
-- in date order. Gives the colour timeline genuine history from day one:
-- "Whero, earned 3 July 2026 at the Selwyn Winter Jam".
WITH contrib AS (
  SELECT sps.player_id, sps.session_id, s.session_date,
         (sps.total_placement_points + sps.effort_points)::INT AS pts
  FROM session_player_summary sps
  JOIN sessions s ON s.id = sps.session_id

  UNION ALL

  SELECT r.player_id, r.session_id, s.session_date, MAX(r.points_earned)::INT
  FROM results r
  JOIN sessions s ON s.id = r.session_id
  WHERE r.player_id IS NOT NULL
    AND r.points_earned IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM session_player_summary x
      WHERE x.session_id = r.session_id AND x.player_id = r.player_id
    )
  GROUP BY r.player_id, r.session_id, s.session_date
),
running AS (
  SELECT c.player_id, c.session_id, c.session_date,
         COALESCE(t.adjustment_points, 0)
           + SUM(c.pts) OVER (PARTITION BY c.player_id
                              ORDER BY c.session_date, c.session_id
                              ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cum
  FROM contrib c
  LEFT JOIN player_totals t ON t.player_id = c.player_id
),
first_cross AS (
  SELECT DISTINCT ON (r.player_id, l.rung)
    r.player_id, l.rung, l.name, r.session_id, r.session_date, r.cum
  FROM running r
  JOIN colour_ladder l ON l.threshold > 0 AND l.threshold <= r.cum
  ORDER BY r.player_id, l.rung, r.session_date, r.session_id
)
INSERT INTO public.colour_awards
  (player_id, rung, colour_name, points_at_award, session_id, awarded_at, celebrated_at)
SELECT fc.player_id, fc.rung, fc.name, fc.cum, fc.session_id,
       fc.session_date::TIMESTAMPTZ, fc.session_date::TIMESTAMPTZ
FROM first_cross fc
JOIN public.players p ON p.id = fc.player_id   -- skip any orphaned player_id
ON CONFLICT (player_id, rung) DO NOTHING;

-- Backfilled rows are marked celebrated so launch day does not fire twenty
-- stale alerts at the kaiwhakawā (handled inline above via celebrated_at).

-- 6e. Denormalised highest_rung.
UPDATE public.player_totals t
SET highest_rung = GREATEST(1, COALESCE(
      (SELECT MAX(a.rung) FROM public.colour_awards a WHERE a.player_id = t.player_id), 1)),
    updated_at = NOW();

-- ── Part 7: verification (read-only) ─────────────────────────────────────────

-- Every player has a total.
SELECT count(*) AS players_without_totals
FROM public.players p
LEFT JOIN public.player_totals t ON t.player_id = p.id
WHERE t.player_id IS NULL;

-- Lifetime should equal the 2026 seasonal total today (only one season exists
-- in prod), plus any adjustment.
SELECT p.display_name,
       r.total_points AS season_2026,
       t.earned_points,
       t.adjustment_points,
       t.lifetime_points,
       t.lifetime_sessions,
       t.highest_rung,
       l.name AS colour
FROM public.player_totals t
JOIN public.players p ON p.id = t.player_id
LEFT JOIN public.rankings r ON r.player_id = t.player_id AND r.season_year = 2026
JOIN public.colour_ladder l ON l.rung = t.highest_rung
ORDER BY t.lifetime_points DESC;

-- Nobody holds a rung without every rung below it.
SELECT player_id, count(*) AS awards, max(rung) AS top
FROM public.colour_awards
GROUP BY player_id
HAVING count(*) <> max(rung) - 1;

-- The reconstructed timeline.
SELECT p.display_name, a.colour_name, a.awarded_at::DATE, s.location
FROM public.colour_awards a
JOIN public.players p ON p.id = a.player_id
LEFT JOIN public.sessions s ON s.id = a.session_id
ORDER BY p.display_name, a.rung;
