-- ─── Weekly games: sites, registration and same-day notices (v0.53.0.0) ─────
--
-- AllSport runs at more than one site from 2027. A player registers ONCE to a
-- weekly game (a site, a weekday and a start time, e.g. "Saturday 9:00am at
-- AllSport HQ") and from then on hears about every game in that slot: rained
-- out, moved to the other end of the park, a note from the kaiwhakawā. They do
-- not register for each date (Tāne, 18 Nov 2026).
--
-- Decisions this encodes (Tāne, 18 Nov 2026):
--   * Registering is never required to play. Walk-ups are welcome; the game
--     screen offers them the weekly game after they have joined the game.
--   * No cap and no waitlist.
--   * Phase 1 shows notices inside the app (HOME). Web push and email follow in
--     phase 2 and will read the same game_notices rows, so nothing here changes.
--
-- Shape:
--   sites                 where games are played (public)
--   weekly_games          the recurring slot players register to (public)
--   weekly_game_members   who registered; leaving stamps left_at and keeps the
--                         row, so "who signed up, when, and how long they
--                         stayed" survives for the multi-site numbers
--   weekly_game_absences  "can't make it this week" for one date (optional)
--   game_notices          what the kaiwhakawā said about one date of one
--                         weekly game (public: a rain call is not private)
--   sessions.weekly_game_id  which weekly game a live game is, so the game
--                         screen can offer it to a walk-up and attendance can
--                         later be counted against registrations
--
-- There are no dated "fixture" rows. A date's status is worked out from its
-- notices (lib/weeklyGames.ts: the newest 'cancelled' or 'on' wins), which
-- needs no pg_cron job and no write on the Nano compute until something
-- actually changes.
--
-- Deploy order: code first, then this migration. Every reader treats a missing
-- table (PGRST205 / 42P01) or column (42703) as "not live yet", and the new
-- game screen only sends weekly_game_id when it has loaded weekly games, which
-- it cannot do before this runs.

BEGIN;

-- ── sites ────────────────────────────────────────────────────────────────────
CREATE TABLE public.sites (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 80),
  address    text CHECK (address IS NULL OR length(address) <= 200),
  -- https only: it is rendered as a link on HOME.
  map_url    text CHECK (map_url IS NULL OR (map_url ~ '^https://' AND length(map_url) <= 500)),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── weekly_games ─────────────────────────────────────────────────────────────
CREATE TABLE public.weekly_games (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id    uuid NOT NULL REFERENCES public.sites(id) ON DELETE RESTRICT,
  -- 0 = Sunday … 6 = Saturday, NZ wall clock (JavaScript's getDay order).
  dow        smallint NOT NULL CHECK (dow BETWEEN 0 AND 6),
  start_time time NOT NULL,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (site_id, dow, start_time)
);

-- ── weekly_game_members ──────────────────────────────────────────────────────
CREATE TABLE public.weekly_game_members (
  weekly_game_id uuid NOT NULL REFERENCES public.weekly_games(id) ON DELETE CASCADE,
  player_id      uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  joined_at      timestamptz NOT NULL DEFAULT now(),
  -- 'home' = the HOME card; 'game' = offered on the game screen as a walk-up.
  joined_via     text NOT NULL DEFAULT 'home' CHECK (joined_via IN ('home', 'game')),
  -- Null while registered. Leaving sets it; joining again clears it.
  left_at        timestamptz,
  PRIMARY KEY (weekly_game_id, player_id)
);
CREATE INDEX weekly_game_members_player_idx ON public.weekly_game_members (player_id);

-- ── weekly_game_absences ─────────────────────────────────────────────────────
CREATE TABLE public.weekly_game_absences (
  weekly_game_id uuid NOT NULL REFERENCES public.weekly_games(id) ON DELETE CASCADE,
  player_id      uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  game_date      date NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (weekly_game_id, player_id, game_date)
);
CREATE INDEX weekly_game_absences_date_idx ON public.weekly_game_absences (weekly_game_id, game_date);

-- ── game_notices ─────────────────────────────────────────────────────────────
CREATE TABLE public.game_notices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  weekly_game_id uuid NOT NULL REFERENCES public.weekly_games(id) ON DELETE CASCADE,
  game_date      date NOT NULL,
  -- cancelled: the game is off that day   on: back on after a cancellation
  -- moved:     where it is that day        message: anything else
  kind           text NOT NULL CHECK (kind IN ('cancelled', 'on', 'moved', 'message')),
  message        text CHECK (message IS NULL OR length(message) <= 280),
  created_by     uuid DEFAULT auth.uid() REFERENCES public.players(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- A move or a message is nothing without words.
  CONSTRAINT game_notices_text_needed CHECK (
    kind IN ('cancelled', 'on') OR length(btrim(coalesce(message, ''))) > 0
  )
);
CREATE INDEX game_notices_game_date_idx ON public.game_notices (weekly_game_id, game_date);

-- ── sessions.weekly_game_id ──────────────────────────────────────────────────
ALTER TABLE public.sessions
  ADD COLUMN weekly_game_id uuid REFERENCES public.weekly_games(id) ON DELETE SET NULL;

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE public.sites                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_games         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_game_members  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_game_absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_notices         ENABLE ROW LEVEL SECURITY;

-- Grants are explicit so anon can read the timetable and never write.
REVOKE ALL ON public.sites, public.weekly_games, public.weekly_game_members,
              public.weekly_game_absences, public.game_notices FROM anon, authenticated;
GRANT SELECT ON public.sites, public.weekly_games, public.game_notices TO anon, authenticated;
GRANT INSERT, UPDATE ON public.sites, public.weekly_games TO authenticated;
GRANT INSERT, DELETE ON public.game_notices TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.weekly_game_members TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.weekly_game_absences TO authenticated;

-- Sites and weekly games: anyone reads; only a kaiwhakawā writes. Nothing is
-- deleted (is_active retires one), so past registrations keep their slot.
CREATE POLICY sites_read ON public.sites FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY sites_judge_insert ON public.sites FOR INSERT TO authenticated WITH CHECK (public.is_judge());
CREATE POLICY sites_judge_update ON public.sites FOR UPDATE TO authenticated
  USING (public.is_judge()) WITH CHECK (public.is_judge());

CREATE POLICY weekly_games_read ON public.weekly_games FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY weekly_games_judge_insert ON public.weekly_games FOR INSERT TO authenticated WITH CHECK (public.is_judge());
CREATE POLICY weekly_games_judge_update ON public.weekly_games FOR UPDATE TO authenticated
  USING (public.is_judge()) WITH CHECK (public.is_judge());

-- Members: a player (or their parent) manages their own registration; a
-- kaiwhakawā reads every list (can_log_for already includes is_judge()). Who
-- else is registered is not shown to players.
CREATE POLICY weekly_game_members_read ON public.weekly_game_members FOR SELECT TO authenticated
  USING (public.can_log_for(player_id));
CREATE POLICY weekly_game_members_insert ON public.weekly_game_members FOR INSERT TO authenticated
  WITH CHECK (public.can_log_for(player_id));
CREATE POLICY weekly_game_members_update ON public.weekly_game_members FOR UPDATE TO authenticated
  USING (public.can_log_for(player_id)) WITH CHECK (public.can_log_for(player_id));

-- Absences: own (or a child's), and only for today or later in NZ.
CREATE POLICY weekly_game_absences_read ON public.weekly_game_absences FOR SELECT TO authenticated
  USING (public.can_log_for(player_id));
CREATE POLICY weekly_game_absences_insert ON public.weekly_game_absences FOR INSERT TO authenticated
  WITH CHECK (
    public.can_log_for(player_id)
    AND game_date >= (now() AT TIME ZONE 'Pacific/Auckland')::date
  );
CREATE POLICY weekly_game_absences_delete ON public.weekly_game_absences FOR DELETE TO authenticated
  USING (public.can_log_for(player_id));

-- Notices: anyone reads; a kaiwhakawā writes them under their own name and
-- may take one back.
CREATE POLICY game_notices_read ON public.game_notices FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY game_notices_judge_insert ON public.game_notices FOR INSERT TO authenticated
  WITH CHECK (public.is_judge() AND created_by = auth.uid());
CREATE POLICY game_notices_judge_delete ON public.game_notices FOR DELETE TO authenticated
  USING (public.is_judge());

-- ── Seed: today's one site and its three games ───────────────────────────────
-- The same times lib/schedule.ts has carried in code.
WITH hq AS (
  INSERT INTO public.sites (name, address)
  VALUES ('AllSport HQ', '26 Carbine Place, Sockburn')
  RETURNING id
)
INSERT INTO public.weekly_games (site_id, dow, start_time)
SELECT hq.id, s.dow, s.start_time
FROM hq, (VALUES (2, time '16:30'), (4, time '16:30'), (6, time '09:00')) AS s(dow, start_time);

DO $$
BEGIN
  IF (SELECT count(*) FROM public.weekly_games) <> 3 THEN
    RAISE EXCEPTION 'weekly_games seed: expected 3 games';
  END IF;
END $$;

COMMIT;
