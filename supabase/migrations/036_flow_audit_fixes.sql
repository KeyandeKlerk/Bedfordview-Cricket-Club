-- 036_flow_audit_fixes.sql
-- Fixes from the 2026-07-27 end-to-end flow audit.

-- ============================================================
-- FIX 1: has_role() — implement the documented hierarchy
-- (admin > coach > scorer > shop > player > member) with an explicit
-- rank instead of an ad-hoc OR-chain. The old version let 'admin'
-- and 'coach'/'scorer' satisfy required_role='player' but never let
-- 'shop' satisfy 'player', and never let 'coach'/'scorer' satisfy
-- 'shop' — contradicting the documented chain. Ranks below preserve
-- every existing behavior (admin-only checks still only match
-- literal admin) while fixing the shop/coach/scorer/player gaps.
-- ============================================================

CREATE OR REPLACE FUNCTION has_role(user_uuid uuid, required_role text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
      AND (CASE role
             WHEN 'admin'  THEN 5
             WHEN 'coach'  THEN 4
             WHEN 'scorer' THEN 3
             WHEN 'shop'   THEN 2
             WHEN 'player' THEN 1
             WHEN 'member' THEN 0
             ELSE -1
           END)
          >=
          (CASE required_role
             WHEN 'admin'  THEN 5
             WHEN 'coach'  THEN 4
             WHEN 'scorer' THEN 3
             WHEN 'shop'   THEN 2
             WHEN 'player' THEN 1
             WHEN 'member' THEN 0
             ELSE 999
           END)
  );
$$;


-- ============================================================
-- FIX 2: upsert_pending_membership() RPC — the checkout flow
-- (app/api/orders/route.ts) upserts a 'pending' membership row keyed
-- on a partial unique index (memberships_one_active_self /
-- memberships_one_active_per_player, both WHERE status = 'active').
-- supabase-js's .upsert({ onConflict: '...' }) cannot express the
-- WHERE predicate a partial index requires for ON CONFLICT
-- inference, so every such upsert fails outright with "there is no
-- unique or exclusion constraint matching the ON CONFLICT
-- specification". This function does the same upsert as plain SQL,
-- where the predicate can be written directly.
-- ============================================================

CREATE OR REPLACE FUNCTION upsert_pending_membership(
  p_user_id  uuid,
  p_player_id uuid,
  p_order_id uuid,
  p_tier     text
) RETURNS void
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF p_player_id IS NULL THEN
    INSERT INTO memberships (user_id, player_id, order_id, status, tier)
    VALUES (p_user_id, NULL, p_order_id, 'pending', p_tier)
    ON CONFLICT (user_id) WHERE player_id IS NULL AND status = 'active'
    DO UPDATE SET order_id = EXCLUDED.order_id, tier = EXCLUDED.tier;
  ELSE
    INSERT INTO memberships (user_id, player_id, order_id, status, tier)
    VALUES (p_user_id, p_player_id, p_order_id, 'pending', p_tier)
    ON CONFLICT (user_id, player_id) WHERE player_id IS NOT NULL AND status = 'active'
    DO UPDATE SET order_id = EXCLUDED.order_id, tier = EXCLUDED.tier;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION upsert_pending_membership(uuid, uuid, uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION upsert_pending_membership(uuid, uuid, uuid, text) TO service_role;


-- ============================================================
-- FIX 3: matches.season_id / matches.competition_id — CASCADE delete
-- means deleting a season or competition silently deletes every
-- match (and transitively innings/ball_events) in it. No current
-- admin UI exposes season/competition delete, but it is a live
-- landmine for any future UI addition or direct SQL cleanup.
-- Tighten to RESTRICT so such a delete fails loudly instead of
-- wiping historical match data.
-- ============================================================

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_season_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_season_id_fkey
  FOREIGN KEY (season_id) REFERENCES seasons(id) ON DELETE RESTRICT;

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_competition_id_fkey;
ALTER TABLE matches
  ADD CONSTRAINT matches_competition_id_fkey
  FOREIGN KEY (competition_id) REFERENCES competitions(id) ON DELETE RESTRICT;
