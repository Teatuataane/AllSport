-- ─── Switching back to Te Taniwha o te Whānau ───────────────────────────────
-- BUG: leaving Whānau was a one-way door.
--
-- `choose_taniwha(p_domain_number INT)` rejected anything outside 1..10, and
-- Whānau is the one taniwha with no domain — `player_taniwha.domain_number` is
-- NULL for it, pinned by the table's own CHECK constraint. So the RPC had no
-- expressible argument that meant "Whānau", and TaniwhaPicker did not list it
-- either. A player who switched to a domain taniwha could never go back, and
-- their Whānau row sat there part-built with no way to resume it — which is
-- precisely the case the design says switching must support: "parts do NOT
-- transfer: they stay on the taniwha they were placed on and are resumed if
-- that taniwha is chosen again" (plan decision 10).
--
-- FIX: NULL now means Whānau. The signature is unchanged, so PostgREST resolves
-- the same function and the existing call site keeps working untouched.
--
-- The crowned-already guard had to move off domain_number to do this: `WHERE
-- domain_number = NULL` is never true, so a crowned Whānau would have slipped
-- straight past a domain-number check and been re-chosen. It matches on the
-- slug now, which is the column that actually identifies a taniwha.
--
-- Everything else is deliberately unchanged: still refused mid-session so a
-- crown condition cannot move under a kaiwhakawā about to announce it, still
-- only ever moves `is_building`, still never moves a part.
--
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.choose_taniwha(p_domain_number INT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player UUID := auth.uid();
  v_slug   TEXT;
BEGIN
  IF v_player IS NULL THEN
    RAISE EXCEPTION 'choose_taniwha: not signed in' USING ERRCODE = '42501';
  END IF;

  -- NULL is Whānau. It is the only taniwha without a domain, so there is no
  -- other value that could mean it.
  IF p_domain_number IS NULL THEN
    v_slug := 'whanau';
  ELSIF p_domain_number < 1 OR p_domain_number > 10 THEN
    RAISE EXCEPTION 'choose_taniwha: domain % is not 1..10 (or NULL for whanau)',
      p_domain_number USING ERRCODE = '22023';
  ELSE
    SELECT slug INTO v_slug FROM (
      VALUES (1,'kaha'), (2,'kaha-tinana'), (3,'hiko'), (4,'tere'), (5,'manawanui'),
             (6,'manawaroa'), (7,'ngawari'), (8,'mataara'), (9,'ruruku'), (10,'tika')
    ) AS m(n, slug) WHERE m.n = p_domain_number;
  END IF;

  IF EXISTS (
    SELECT 1 FROM results r JOIN sessions s ON s.id = r.session_id
     WHERE r.player_id = v_player AND s.is_active
  ) THEN
    RAISE EXCEPTION
      'choose_taniwha: not while a session is live — finish the game first'
      USING ERRCODE = '55006';
  END IF;

  -- On the SLUG, not the domain number. A crowned taniwha is finished and
  -- cannot be built again; matching on domain_number would have let a crowned
  -- Whānau through, because NULL = NULL is never true.
  IF EXISTS (
    SELECT 1 FROM player_taniwha
     WHERE player_id = v_player AND taniwha_slug = v_slug
       AND crowned_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'choose_taniwha: that taniwha is already crowned'
      USING ERRCODE = '23505';
  END IF;

  UPDATE player_taniwha SET is_building = false, updated_at = NOW()
   WHERE player_id = v_player AND is_building;

  INSERT INTO player_taniwha (player_id, taniwha_slug, domain_number, is_building)
  VALUES (v_player, v_slug, p_domain_number, true)
  ON CONFLICT (player_id, taniwha_slug)
  DO UPDATE SET is_building = true, updated_at = NOW();

  -- Any banked budget lands immediately on the newly chosen taniwha.
  PERFORM public.sync_player_taniwha(v_player);
END;
$$;

REVOKE ALL ON FUNCTION public.choose_taniwha(INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.choose_taniwha(INT) TO authenticated;

-- ── Verify, as a signed-in player, by calling it ────────────────────────────
--   select choose_taniwha(4);      -- a domain: success
--   select choose_taniwha(null);   -- back to whanau: success (this is the fix)
--   select taniwha_slug, is_building, body_parts from player_taniwha
--    where player_id = auth.uid() order by is_building desc;
--                                  -- expect exactly one is_building = true,
--                                  -- and the domain row's body_parts intact
--   select choose_taniwha(0);      -- expect 22023
--   select choose_taniwha(11);     -- expect 22023
