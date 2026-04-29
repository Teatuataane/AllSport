-- AllSport v2 — Full database reset
-- Drops all existing tables and recreates a clean schema

-- ─── Drop everything (reverse dependency order) ────────────────────────────

DROP TABLE IF EXISTS bonus_sport_opponents CASCADE;
DROP TABLE IF EXISTS bonus_completions CASCADE;
DROP TABLE IF EXISTS results CASCADE;
DROP TABLE IF EXISTS rankings CASCADE;
DROP TABLE IF EXISTS session_events CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS players CASCADE;

DROP TRIGGER IF EXISTS on_session_end ON sessions;
DROP FUNCTION IF EXISTS award_session_points();
DROP FUNCTION IF EXISTS get_player_season_pr(uuid, text, int);

-- ─── players ───────────────────────────────────────────────────────────────

CREATE TABLE players (
  id               uuid PRIMARY KEY REFERENCES auth.users(id),
  created_at       timestamptz DEFAULT NOW(),
  full_name        text,
  email            text,
  phone            text,
  date_of_birth    date,
  division         text CHECK (division IN (
    'Youth','Juniors','Men''s','Women''s',
    'Masters Men','Masters Women',
    'Grandmasters Men','Grandmasters Women'
  )),
  username         text UNIQUE,
  role             text DEFAULT 'player' CHECK (role IN ('player','judge')),
  show_full_name   boolean DEFAULT true,
  show_username    boolean DEFAULT true,
  show_division    boolean DEFAULT true,
  show_location    boolean DEFAULT false,
  display_name     text,
  bodyweight_kg    numeric,
  parent_id        uuid REFERENCES auth.users(id),
  parent_name      text,
  parent_email     text,
  parent_phone     text,
  is_active        boolean DEFAULT true,
  city             text,
  region           text,
  country          text DEFAULT 'New Zealand'
);

-- ─── sessions ──────────────────────────────────────────────────────────────

CREATE TABLE sessions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz DEFAULT NOW(),
  session_date     date,
  start_time       time,
  started_at       timestamptz,
  ended_at         timestamptz,
  location         text DEFAULT '26 Carbine Place, Sockburn',
  is_active        boolean DEFAULT false,
  is_championship  boolean DEFAULT false,
  session_code     text UNIQUE,
  notes            text,
  points_awarded_at timestamptz,
  judge_id         uuid REFERENCES players(id)
);

-- ─── session_events ────────────────────────────────────────────────────────

CREATE TABLE session_events (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid REFERENCES sessions(id) ON DELETE CASCADE,
  domain_number int,
  domain_name   text,
  event_name    text,
  event_slug    text,
  input_mode    text,
  display_order int
);

-- ─── results ───────────────────────────────────────────────────────────────

CREATE TABLE results (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          timestamptz DEFAULT NOW(),
  player_id           uuid REFERENCES players(id),
  session_id          uuid REFERENCES sessions(id) ON DELETE CASCADE,
  event_id            uuid REFERENCES session_events(id),
  raw_score           numeric,
  adjusted_score      numeric,
  score_label         text,
  placement           int,
  placement_points    int,
  bonus_points_total  int DEFAULT 0,
  points_earned       int,
  difficulty_tier     text,
  disadvantage_type   text,
  disadvantage_option text,
  weight_kg           numeric,
  reps                int,
  time_seconds        numeric,
  distance_m          numeric,
  opponent_name       text,
  match_score         text,
  result_type         text,
  notes               text,
  player_name         text,
  UNIQUE (player_id, session_id, event_id)
);

-- ─── bonus_completions ─────────────────────────────────────────────────────

CREATE TABLE bonus_completions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at       timestamptz DEFAULT NOW(),
  player_id        uuid REFERENCES players(id),
  session_id       uuid REFERENCES sessions(id) ON DELETE CASCADE,
  event_id         uuid REFERENCES session_events(id),
  result_id        uuid REFERENCES results(id) ON DELETE CASCADE,
  tier             int CHECK (tier IN (1,2,3,4)),
  points_awarded   int DEFAULT 15,
  completion_data  jsonb
);

-- ─── bonus_sport_opponents ─────────────────────────────────────────────────

CREATE TABLE bonus_sport_opponents (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonus_completion_id  uuid REFERENCES bonus_completions(id) ON DELETE CASCADE,
  opponent_player_id   uuid REFERENCES players(id),
  game_number          int,
  confirmed            boolean DEFAULT false
);

-- ─── rankings ──────────────────────────────────────────────────────────────

CREATE TABLE rankings (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  updated_at        timestamptz DEFAULT NOW(),
  player_id         uuid REFERENCES players(id),
  season_year       int,
  division          text,
  total_points      int DEFAULT 0,
  total_sessions    int DEFAULT 0,
  current_rank      int,
  average_placement numeric,
  UNIQUE (player_id, season_year, division)
);

-- ─── Row Level Security ────────────────────────────────────────────────────

ALTER TABLE players           ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE results           ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bonus_sport_opponents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rankings          ENABLE ROW LEVEL SECURITY;

-- players
CREATE POLICY "players_select_all"  ON players FOR SELECT  USING (true);
CREATE POLICY "players_insert_own"  ON players FOR INSERT  WITH CHECK (auth.uid() = id);
CREATE POLICY "players_update_own"  ON players FOR UPDATE  USING (auth.uid() = id);

-- sessions
CREATE POLICY "sessions_select_all"    ON sessions FOR SELECT  USING (true);
CREATE POLICY "sessions_insert_judge"  ON sessions FOR INSERT  WITH CHECK (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);
CREATE POLICY "sessions_update_judge"  ON sessions FOR UPDATE  USING (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);
CREATE POLICY "sessions_delete_judge"  ON sessions FOR DELETE  USING (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);

-- session_events
CREATE POLICY "session_events_select_all"   ON session_events FOR SELECT USING (true);
CREATE POLICY "session_events_insert_judge" ON session_events FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);
CREATE POLICY "session_events_delete_judge" ON session_events FOR DELETE USING (
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);

-- results
CREATE POLICY "results_select_all"       ON results FOR SELECT USING (true);
CREATE POLICY "results_insert_own"       ON results FOR INSERT WITH CHECK (
  auth.uid() IS NOT NULL AND (player_id = auth.uid() OR player_id IS NULL)
);
CREATE POLICY "results_update_judge_own" ON results FOR UPDATE USING (
  player_id = auth.uid() OR
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);
CREATE POLICY "results_delete_judge_own" ON results FOR DELETE USING (
  player_id = auth.uid() OR
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);

-- bonus_completions
CREATE POLICY "bonus_select_all"       ON bonus_completions FOR SELECT USING (true);
CREATE POLICY "bonus_insert_own"       ON bonus_completions FOR INSERT WITH CHECK (player_id = auth.uid());
CREATE POLICY "bonus_delete_own_judge" ON bonus_completions FOR DELETE USING (
  player_id = auth.uid() OR
  EXISTS (SELECT 1 FROM players WHERE id = auth.uid() AND role = 'judge')
);

-- bonus_sport_opponents
CREATE POLICY "bso_select_all"  ON bonus_sport_opponents FOR SELECT USING (true);
CREATE POLICY "bso_insert_own"  ON bonus_sport_opponents FOR INSERT WITH CHECK (true);

-- rankings
CREATE POLICY "rankings_select_all" ON rankings FOR SELECT USING (true);

-- ─── Realtime ──────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE session_events;
ALTER PUBLICATION supabase_realtime ADD TABLE results;
ALTER PUBLICATION supabase_realtime ADD TABLE bonus_completions;

-- ─── get_player_season_pr ──────────────────────────────────────────────────
-- Returns best raw_score for a player/event/year.
-- For time/sprint events (raw_score is negative), best = MIN (most negative = fastest).
-- For all others, best = MAX.

CREATE OR REPLACE FUNCTION get_player_season_pr(
  p_player_id  uuid,
  p_event_slug text,
  p_season_year int
) RETURNS numeric AS $$
DECLARE v_best numeric;
BEGIN
  SELECT
    CASE
      WHEN se.input_mode IN ('time', 'sprint') THEN MIN(r.raw_score)
      ELSE MAX(r.raw_score)
    END
  INTO v_best
  FROM results r
  JOIN session_events se ON r.event_id = se.id
  JOIN sessions s ON r.session_id = s.id
  WHERE r.player_id = p_player_id
    AND se.event_slug = p_event_slug
    AND EXTRACT(YEAR FROM s.session_date) = p_season_year;
  RETURN v_best;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── award_session_points ──────────────────────────────────────────────────
-- Fires after sessions.is_active is set false.
-- Ranks players per event, calculates placement_points, updates rankings.

CREATE OR REPLACE FUNCTION award_session_points()
RETURNS TRIGGER AS $$
DECLARE
  v_event_id     uuid;
  v_player_ids   uuid[];
  v_player_id    uuid;
  v_player_count int;
  v_gap          int;
  v_total_pts    int;
  v_division     text;
  v_year         int;
BEGIN
  -- Void protection: skip if points already awarded
  IF NEW.points_awarded_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Only fire when is_active transitions to false
  IF NOT (OLD.is_active = true AND NEW.is_active = false) THEN
    RETURN NEW;
  END IF;

  v_year := EXTRACT(YEAR FROM COALESCE(NEW.session_date, CURRENT_DATE))::int;

  -- All player_ids who joined this session (have at least one result row)
  SELECT ARRAY_AGG(DISTINCT r.player_id)
  INTO v_player_ids
  FROM results r
  WHERE r.session_id = NEW.id AND r.player_id IS NOT NULL;

  v_player_count := COALESCE(ARRAY_LENGTH(v_player_ids, 1), 0);

  IF v_player_count = 0 THEN
    UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;
    RETURN NEW;
  END IF;

  v_gap := GREATEST(100 / v_player_count, 10);

  -- For each event in this session
  FOR v_event_id IN SELECT id FROM session_events WHERE session_id = NEW.id LOOP
    -- Rank players who submitted scores, using RANK() for ties
    UPDATE results r
    SET
      placement       = sub.rank,
      placement_points = GREATEST(100 - (sub.rank - 1) * v_gap, 10),
      points_earned   = GREATEST(100 - (sub.rank - 1) * v_gap, 10)
                        + COALESCE(r.bonus_points_total, 0)
    FROM (
      SELECT
        id,
        RANK() OVER (ORDER BY raw_score DESC) AS rank
      FROM results
      WHERE session_id = NEW.id
        AND event_id = v_event_id
        AND player_id IS NOT NULL
    ) sub
    WHERE r.id = sub.id;
  END LOOP;

  -- Upsert rankings for each player who joined
  FOREACH v_player_id IN ARRAY v_player_ids LOOP
    SELECT COALESCE(SUM(points_earned), 0)
    INTO v_total_pts
    FROM results
    WHERE session_id = NEW.id AND player_id = v_player_id;

    SELECT division INTO v_division FROM players WHERE id = v_player_id;

    INSERT INTO rankings (player_id, season_year, division, total_points, total_sessions, updated_at)
    VALUES (v_player_id, v_year, v_division, v_total_pts, 1, NOW())
    ON CONFLICT (player_id, season_year, division) DO UPDATE SET
      total_points    = rankings.total_points + EXCLUDED.total_points,
      total_sessions  = rankings.total_sessions + 1,
      updated_at      = NOW();
  END LOOP;

  -- Mark session as points awarded
  UPDATE sessions SET points_awarded_at = NOW() WHERE id = NEW.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_session_end
  AFTER UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION award_session_points();
