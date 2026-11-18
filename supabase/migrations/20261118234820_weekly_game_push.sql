-- ─── Weekly games phase 2: notices by web push, email as the fallback ───────
--
-- Phase 1 (20261118010039) shows a kaiwhakawā's notice on HOME. This sends it:
-- to every phone a registered player has turned notices on for, and by email
-- to a registered player with no such phone (Tāne, 18 Nov 2026: web push plus
-- email). A child has no login, so a child's notice goes to their parent's
-- phones and email.
--
-- The service key is NOT used. app/api/notices/send/route.ts runs under the
-- kaiwhakawā's own login and reads recipients through notice_recipients(),
-- which refuses anyone but a kaiwhakawā. A kaiwhakawā can already read every
-- player row (and so every email) under RLS, so this widens nothing; it only
-- adds the push subscriptions, which are useless without the server's private
-- VAPID key.
--
-- Shape:
--   push_subscriptions    one row per browser that turned notices on, keyed by
--                         its endpoint. Written only through
--                         save_push_subscription(), so a phone that changes
--                         hands moves to the new login instead of tripping RLS.
--   game_notices.sent_at / push_count / email_count
--                         what the send did, for the kaiwhakawā's panel.
--
-- Deploy order: either. The new code treats a missing function as "sending not
-- live" and the notice still saves and shows on HOME.

BEGIN;

CREATE TABLE public.push_subscriptions (
  endpoint   text PRIMARY KEY CHECK (endpoint ~ '^https://' AND length(endpoint) <= 1000),
  player_id  uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  p256dh     text NOT NULL CHECK (length(p256dh) <= 200),
  auth       text NOT NULL CHECK (length(auth) <= 100),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX push_subscriptions_player_idx ON public.push_subscriptions (player_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
GRANT SELECT, DELETE ON public.push_subscriptions TO authenticated;
-- A player sees and removes only their own devices. No INSERT/UPDATE grant:
-- writes go through save_push_subscription().
CREATE POLICY push_subscriptions_own_read ON public.push_subscriptions FOR SELECT TO authenticated
  USING (player_id = auth.uid());
CREATE POLICY push_subscriptions_own_delete ON public.push_subscriptions FOR DELETE TO authenticated
  USING (player_id = auth.uid());

ALTER TABLE public.game_notices
  ADD COLUMN sent_at     timestamptz,
  ADD COLUMN push_count  integer,
  ADD COLUMN email_count integer;

-- ── save_push_subscription ───────────────────────────────────────────────────
-- This browser's subscription, for the caller. An endpoint already held by
-- another login (a shared family phone) moves to the caller: the browser that
-- just subscribed is the one signed in now.
CREATE OR REPLACE FUNCTION public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501';
  END IF;
  INSERT INTO push_subscriptions (endpoint, player_id, p256dh, auth)
  VALUES (p_endpoint, auth.uid(), p_p256dh, p_auth)
  ON CONFLICT (endpoint) DO UPDATE
    SET player_id = excluded.player_id, p256dh = excluded.p256dh,
        auth = excluded.auth, created_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_push_subscription(text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_push_subscription(text, text, text) TO authenticated;

-- ── notice_recipients ────────────────────────────────────────────────────────
-- Everything the send route needs for one notice, kaiwhakawā only:
--   notice   the notice, its weekly game, site and date
--   accounts one row per login to reach (a child's parent stands in for the
--            child), with that login's email, for players registered to the
--            weekly game who have not said they will miss that date
--   push     every push subscription of those logins
CREATE OR REPLACE FUNCTION public.notice_recipients(p_notice_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n record;
  result jsonb;
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'kaiwhakawā only' USING ERRCODE = '42501';
  END IF;

  SELECT gn.id, gn.kind, gn.message, gn.game_date, wg.id AS weekly_game_id,
         wg.dow, wg.start_time, s.name AS site_name
    INTO n
    FROM game_notices gn
    JOIN weekly_games wg ON wg.id = gn.weekly_game_id
    JOIN sites s ON s.id = wg.site_id
   WHERE gn.id = p_notice_id;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  WITH members AS (
    SELECT m.player_id
      FROM weekly_game_members m
     WHERE m.weekly_game_id = n.weekly_game_id
       AND m.left_at IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM weekly_game_absences a
          WHERE a.weekly_game_id = m.weekly_game_id
            AND a.player_id = m.player_id
            AND a.game_date = n.game_date)
  ), accounts AS (
    -- A child (parent_id set) is reached through the parent's login.
    SELECT DISTINCT coalesce(p.parent_id, p.id) AS account_id
      FROM members mm JOIN players p ON p.id = mm.player_id
  )
  SELECT jsonb_build_object(
    'notice', jsonb_build_object(
      'id', n.id, 'kind', n.kind, 'message', n.message, 'game_date', n.game_date,
      'dow', n.dow, 'start_time', n.start_time, 'site_name', n.site_name),
    'accounts', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', a.account_id, 'email', nullif(btrim(p.email), '')))
        FROM accounts a JOIN players p ON p.id = a.account_id), '[]'::jsonb),
    'push', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
               'account_id', ps.player_id, 'endpoint', ps.endpoint,
               'p256dh', ps.p256dh, 'auth', ps.auth))
        FROM push_subscriptions ps
       WHERE ps.player_id IN (SELECT account_id FROM accounts)), '[]'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.notice_recipients(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notice_recipients(uuid) TO authenticated;

-- ── record_notice_sent ───────────────────────────────────────────────────────
-- What the send did; also drops the subscriptions the push service said are
-- gone (404/410), so the next send does not try them. Kaiwhakawā only.
CREATE OR REPLACE FUNCTION public.record_notice_sent(
  p_notice_id uuid, p_push_count integer, p_email_count integer, p_gone_endpoints text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_judge() THEN
    RAISE EXCEPTION 'kaiwhakawā only' USING ERRCODE = '42501';
  END IF;
  UPDATE game_notices
     SET sent_at = now(),
         push_count = greatest(p_push_count, 0),
         email_count = greatest(p_email_count, 0)
   WHERE id = p_notice_id;
  IF p_gone_endpoints IS NOT NULL AND cardinality(p_gone_endpoints) > 0 THEN
    DELETE FROM push_subscriptions WHERE endpoint = ANY (p_gone_endpoints);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.record_notice_sent(uuid, integer, integer, text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_notice_sent(uuid, integer, integer, text[]) TO authenticated;

COMMIT;
