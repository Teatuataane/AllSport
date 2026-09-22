-- ════════════════════════════════════════════════════════════════════════════
-- 20260920234713 — A record of colours taken back
-- ════════════════════════════════════════════════════════════════════════════
--
-- Step 5 of docs/designs/auto-conferral-spec.md. Decision 5: evidence can drop
-- a colour. A kaiwhakawā deletes a bad workout entry from the audit panel, the
-- route recomputes that domain, and any award the evidence no longer supports
-- is deleted from grade_awards.
--
-- WHY A SEPARATE TABLE, NOT A FLAG ON grade_awards
--   · A withdrawal must be TOLD to the player "plainly and quietly" (spec
--     decision 7). Once the award row is gone there is nothing left to drive
--     that notice from. This is what the notice reads.
--   · A flag would collide with UNIQUE (player_id, domain_number, rung): a
--     player who genuinely re-earns the colour later could not be given it
--     without un-withdrawing, and the route's ON CONFLICT DO NOTHING would
--     silently refuse it.
--   · It is the audit trail: "why was this colour taken back?" has an answer.
--
-- PRIVATE, unlike grade_awards. An award is public because colours are; a
-- withdrawal says "a score you logged did not stand up", which is between the
-- player, their parent and the kaiwhakawā.
--
-- Written only by the route, with the service key. No write policy exists and
-- writes are revoked, for the same reason as grade_awards: a policy added in a
-- hurry later should not be able to open writes by itself.
--
-- No ON DELETE, matching grade_awards and results: a player is anonymised on
-- erasure, never deleted, so delete_my_account needs no change — and it is
-- deliberately NOT redefined here (CLAUDE.md: a whole redefinition is how a
-- rule goes missing).
--
-- DEPLOY ORDER: either. The route treats a missing table (PGRST205) as "the
-- withdrawal still happened, it just could not be logged", and the player-side
-- read treats it as "nothing withdrawn".

CREATE TABLE IF NOT EXISTS public.grade_withdrawals (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id      uuid NOT NULL REFERENCES public.players(id),
  domain_number  int  NOT NULL CHECK (domain_number BETWEEN 1 AND 10),
  rung           int  NOT NULL CHECK (rung BETWEEN 1 AND 12),
  -- Snapshotted from the award, so the notice names what they actually held.
  grade_name     text NOT NULL,
  conferred_at   timestamptz,
  -- The kaiwhakawā whose deletion caused it.
  withdrawn_by   uuid REFERENCES public.players(id),
  withdrawn_at   timestamptz NOT NULL DEFAULT now(),
  reason         text
);

CREATE INDEX IF NOT EXISTS grade_withdrawals_player_idx
  ON public.grade_withdrawals (player_id, withdrawn_at DESC);

ALTER TABLE public.grade_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS grade_withdrawals_select_own ON public.grade_withdrawals;
CREATE POLICY grade_withdrawals_select_own ON public.grade_withdrawals
  FOR SELECT USING (player_id = auth.uid());

DROP POLICY IF EXISTS grade_withdrawals_select_family ON public.grade_withdrawals;
CREATE POLICY grade_withdrawals_select_family ON public.grade_withdrawals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.players WHERE id = grade_withdrawals.player_id AND parent_id = auth.uid())
  );

DROP POLICY IF EXISTS grade_withdrawals_select_judge ON public.grade_withdrawals;
CREATE POLICY grade_withdrawals_select_judge ON public.grade_withdrawals
  FOR SELECT USING (public.is_judge());

REVOKE ALL ON public.grade_withdrawals FROM anon, authenticated;
GRANT SELECT ON public.grade_withdrawals TO authenticated;

COMMENT ON TABLE public.grade_withdrawals IS
  'Colours taken back because the evidence behind them was deleted by a '
  'kaiwhakawā. Private: own, parent, kaiwhakawā. Written only by the '
  'auto-conferral route. Drives the player''s notice and is the audit trail.';

DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = 'public.grade_withdrawals'::regclass) THEN
    RAISE EXCEPTION 'grade_withdrawals: RLS is not enabled';
  END IF;
  IF has_table_privilege('anon', 'public.grade_withdrawals', 'SELECT') THEN
    RAISE EXCEPTION 'grade_withdrawals: anon can read it';
  END IF;
  IF has_table_privilege('authenticated', 'public.grade_withdrawals', 'INSERT') THEN
    RAISE EXCEPTION 'grade_withdrawals: a client can write it';
  END IF;
END $$;
