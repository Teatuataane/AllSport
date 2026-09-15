-- ════════════════════════════════════════════════════════════════════════════
-- 20260915051927 — The grading schema: bodyweight bands, exemptions, awards
-- ════════════════════════════════════════════════════════════════════════════
--
-- WHAT
--   1. players.bodyweight_band — the optional 10kg band strength and loaded
--      carries are graded against. A band, never a number. NOT added to
--      players_public: that view lists its columns explicitly and is untouched,
--      so the band is readable only by the player, their parent and kaiwhakawā,
--      exactly as /privacy says.
--   2. grade_exemptions — coach-confirmed events a player cannot do (decision
--      4). They leave both sides of the half-the-domain rule. The reason can be
--      medical, so it is private: own, parent, kaiwhakawā. Kaiwhakawā write.
--   3. grade_awards — one row per colour conferred in a domain (decisions 8
--      and 9). APPEND-ONLY: a colour is never taken back. Public read, as
--      /privacy says colours are; the only evidence kept is which events met
--      it, which the public results already show. The band behind a lift is
--      never stored here, so it cannot leak through an award.
--   4. confer_grade() — the only write path into grade_awards, kaiwhakawā only.
--   5. delete_my_account() — also clears the band and deletes exemptions.
--      Awards stay, the same as colours and placements: they are part of the
--      competition record, and the name on them is already scrubbed.
--
-- A DELIBERATE DEPARTURE FROM THE SPEC
-- The design record has the server recompute every grade before conferring it,
-- which means porting the whole engine, the head-to-head rating included, into
-- plpgsql. That is not done here. Decision 9 is "computed automatically,
-- released by a kaiwhakawā", so the kaiwhakawā is the authority, and a player
-- cannot confer a colour on themselves because only a kaiwhakawā can call
-- confer_grade(). Server recomputation needs a database to test against, and
-- is a follow-up. For the same reason there is no grade_standards mirror yet:
-- nothing on the server reads a standard.
--
-- DEPLOY ORDER: either is safe. The profile writes the band in its own update,
-- so a missing column fails only that write; every grading read is its own
-- query and treats a missing table as "nothing conferred yet".
--
-- NOT VERIFIED AGAINST A DATABASE when written: Docker was not running. Apply
-- from `main`, then verify the objects (see the closing checks).
--
-- __tests__/gradingSchema.test.ts pins this file against lib/grading.ts.

-- ── 1. The bodyweight band ──────────────────────────────────────────────────
ALTER TABLE public.players ADD COLUMN bodyweight_band text;
ALTER TABLE public.players ADD CONSTRAINT players_bodyweight_band_check CHECK (
  bodyweight_band IS NULL OR bodyweight_band IN (
    'Under 50kg', '50 to 60kg', '60 to 70kg', '70 to 80kg',
    '80 to 90kg', '90 to 100kg', '100 to 110kg', '110kg and over'
  )
);
COMMENT ON COLUMN public.players.bodyweight_band IS
  'Optional 10kg band. Strength and loaded-carry grades are a ratio of its '
  'middle. Never a number, never in players_public. Juniors are never asked.';

-- ── 2. Exemptions ───────────────────────────────────────────────────────────
CREATE TABLE public.grade_exemptions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  -- lib/eventData.ts slug. event_domains.slug is not unique, so no FK: the
  -- release panel only offers slugs from the roster.
  event_slug   text NOT NULL,
  reason       text,
  confirmed_by uuid NOT NULL REFERENCES public.players(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, event_slug)
);

ALTER TABLE public.grade_exemptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY grade_exemptions_select_own ON public.grade_exemptions
  FOR SELECT USING (player_id = auth.uid());
CREATE POLICY grade_exemptions_select_family ON public.grade_exemptions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = grade_exemptions.player_id AND parent_id = auth.uid())
  );
CREATE POLICY grade_exemptions_select_judge ON public.grade_exemptions
  FOR SELECT USING (public.is_judge());
-- A kaiwhakawā confirms an exemption in their own name.
CREATE POLICY grade_exemptions_insert_judge ON public.grade_exemptions
  FOR INSERT WITH CHECK (public.is_judge() AND confirmed_by = auth.uid());
CREATE POLICY grade_exemptions_delete_judge ON public.grade_exemptions
  FOR DELETE USING (public.is_judge());

REVOKE ALL ON public.grade_exemptions FROM anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.grade_exemptions TO authenticated;

-- ── 3. Awards ───────────────────────────────────────────────────────────────
CREATE TABLE public.grade_awards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- No ON DELETE, matching results.player_id: a player is anonymised on
  -- erasure, never deleted, so the record stays whole.
  player_id     uuid NOT NULL REFERENCES public.players(id),
  domain_number int  NOT NULL CHECK (domain_number BETWEEN 1 AND 10),
  rung          int  NOT NULL CHECK (rung BETWEEN 1 AND 12),
  -- Snapshotted, so a later rename never rewrites what was conferred.
  grade_name    text NOT NULL,
  session_id    uuid REFERENCES public.sessions(id) ON DELETE SET NULL,
  -- The event slugs that met the colour when it was conferred.
  events        text[] NOT NULL DEFAULT '{}',
  conferred_by  uuid NOT NULL REFERENCES public.players(id),
  conferred_at  timestamptz NOT NULL DEFAULT now(),
  -- Makes a repeated release idempotent.
  UNIQUE (player_id, domain_number, rung)
);

CREATE INDEX grade_awards_player_idx ON public.grade_awards (player_id, domain_number);

ALTER TABLE public.grade_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY grade_awards_select_all ON public.grade_awards FOR SELECT USING (true);

-- No write policy, and the grants revoked too: a policy added in a hurry later
-- should not be able to open writes by itself. confer_grade() is the only way.
REVOKE ALL ON public.grade_awards FROM anon, authenticated;
GRANT SELECT ON public.grade_awards TO anon, authenticated;

-- ── 4. Conferring a colour ──────────────────────────────────────────────────
-- Returns the award's id. Conferring the same colour twice returns the first
-- award rather than failing, so a double tap is harmless. A colour below one
-- already held in that domain is refused: there is nothing to release.
CREATE OR REPLACE FUNCTION public.confer_grade(
  p_player_id     uuid,
  p_domain_number int,
  p_rung          int,
  p_events        text[] DEFAULT '{}',
  p_session_id    uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_id    uuid;
  v_held  int;
  v_guest boolean;
BEGIN
  IF v_uid IS NULL OR NOT public.is_judge() THEN
    RAISE EXCEPTION 'confer_grade: only a kaiwhakawā can confer a colour' USING ERRCODE = '42501';
  END IF;
  IF p_domain_number IS NULL OR p_domain_number NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'confer_grade: domain must be 1 to 10' USING ERRCODE = '22023';
  END IF;
  IF p_rung IS NULL OR p_rung NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'confer_grade: colour must be 1 (Kiwikiwi) to 12 (Taniwha)' USING ERRCODE = '22023';
  END IF;

  SELECT is_guest INTO v_guest FROM players WHERE id = p_player_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'confer_grade: unknown player %', p_player_id USING ERRCODE = 'P0002';
  END IF;
  IF COALESCE(v_guest, false) THEN
    RAISE EXCEPTION 'confer_grade: a guest cannot hold a colour' USING ERRCODE = '22023';
  END IF;

  SELECT max(rung) INTO v_held FROM grade_awards
  WHERE player_id = p_player_id AND domain_number = p_domain_number;
  IF v_held IS NOT NULL AND v_held > p_rung THEN
    RAISE EXCEPTION 'confer_grade: that player already holds a higher colour in this domain'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM unnest(COALESCE(p_events, '{}')) AS e
    WHERE NOT EXISTS (SELECT 1 FROM event_domains d WHERE d.slug = e AND d.domain_number = p_domain_number)
  ) THEN
    RAISE EXCEPTION 'confer_grade: an event given as evidence is not in that domain' USING ERRCODE = '22023';
  END IF;

  INSERT INTO grade_awards (player_id, domain_number, rung, grade_name, session_id, events, conferred_by)
  VALUES (
    p_player_id, p_domain_number, p_rung,
    (ARRAY['Kiwikiwi', 'Whero', 'Karaka', 'Kōwhai', 'Kākāriki', 'Kahurangi',
           'Poroporo', 'Parahi', 'Hiriwa', 'Kōura', 'Uenuku', 'Taniwha'])[p_rung],
    p_session_id, COALESCE(p_events, '{}'), v_uid
  )
  ON CONFLICT (player_id, domain_number, rung) DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    SELECT id INTO v_id FROM grade_awards
    WHERE player_id = p_player_id AND domain_number = p_domain_number AND rung = p_rung;
  END IF;
  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) TO authenticated;

COMMENT ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) IS
  'Confers one colour in one domain. Kaiwhakawā only; the only write path into '
  'grade_awards. Idempotent; refuses a colour below one already held.';

-- ── 5. Erasure also clears the band and exemptions ──────────────────────────
-- Redefined whole, from 20260822000000_privacy_tidyup.sql, with two additions
-- marked below. Everything else is unchanged.
CREATE OR REPLACE FUNCTION public.delete_my_account(p_player_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target UUID;
  v_names  TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;

  v_target := COALESCE(p_player_id, auth.uid());

  -- Yourself, or a child profile you are the parent of. Nothing else.
  IF v_target <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM players WHERE id = v_target AND parent_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'you can only erase your own account or a child profile you manage'
      USING ERRCODE = '42501';
  END IF;

  -- Health information goes entirely. WHO-5 answers are the most sensitive
  -- thing we hold, they are voluntary, and nothing outside the player's own
  -- dashboard reads a row: the kaiwhakawā report is an aggregate. Rows already
  -- folded into a published quarterly average cannot be traced back.
  DELETE FROM wellbeing_surveys WHERE player_id = v_target;

  -- ADDED 20260915051927: an exemption's reason can be medical, so it goes
  -- with the rest of the health information.
  DELETE FROM grade_exemptions WHERE player_id = v_target;

  -- Capture every name this player has been known by BEFORE scrubbing, so the
  -- free-text opponent_name copies can be found afterwards.
  SELECT ARRAY_REMOVE(ARRAY[
    NULLIF(display_name, ''), NULLIF(username, ''), NULLIF(full_name, '')
  ], NULL)
  INTO v_names
  FROM players WHERE id = v_target;

  -- Every identifying attribute. display_name is set rather than nulled so the
  -- leaderboard and past game reports still render a row instead of a blank.
  UPDATE players SET
    full_name       = NULL,
    email           = NULL,
    phone           = NULL,
    date_of_birth   = NULL,
    gender          = NULL,
    city            = NULL,
    region          = NULL,
    country         = NULL,
    parent_name     = NULL,
    parent_email    = NULL,
    parent_phone    = NULL,
    referral_code   = NULL,
    username        = NULL,
    icon            = NULL,
    -- ADDED 20260915051927.
    bodyweight_band = NULL,
    display_name    = 'Former player',
    show_full_name  = FALSE,
    show_username   = FALSE,
    show_location   = FALSE,
    is_active       = FALSE
  WHERE id = v_target;

  -- The name a kaiwhakawā typed onto a score row is a second copy of it.
  UPDATE results SET player_name = 'Former player'
  WHERE player_id = v_target;

  -- Being named as somebody's opponent is their record of a match, but the
  -- string is this player's name. Scrub the copies; exact match only.
  IF v_names IS NOT NULL AND array_length(v_names, 1) > 0 THEN
    UPDATE results SET opponent_name = 'Former player'
    WHERE opponent_name = ANY (v_names);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_my_account(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_my_account(UUID) TO authenticated;

-- ── 6. Closing checks — verify the objects, not the ledger ──────────────────
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.grade_awards'::regclass) THEN
    RAISE EXCEPTION 'grading schema: RLS is not enabled on grade_awards';
  END IF;
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.grade_exemptions'::regclass) THEN
    RAISE EXCEPTION 'grading schema: RLS is not enabled on grade_exemptions';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname = 'confer_grade' AND prosecdef AND 'search_path=public' = ANY (proconfig)
  ) THEN
    RAISE EXCEPTION 'grading schema: confer_grade is missing, not SECURITY DEFINER, or has no pinned search_path';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'delete_my_account' AND prosrc LIKE '%bodyweight_band%'
  ) THEN
    RAISE EXCEPTION 'grading schema: delete_my_account does not clear the bodyweight band';
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'players_public' AND column_name = 'bodyweight_band'
  ) THEN
    RAISE EXCEPTION 'grading schema: players_public exposes the bodyweight band';
  END IF;
END $$;
