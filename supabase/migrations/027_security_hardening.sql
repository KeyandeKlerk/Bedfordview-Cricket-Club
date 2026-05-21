-- 027_security_hardening.sql
-- Security hardening: RLS restrictions, column-level grants, trigger-based field protection,
-- SECURITY DEFINER search_path fixes, and safe stats refresh function.

-- ============================================================
-- FIX 1: memberships_insert — restrict to service_role only
-- The old policy used WITH CHECK (true) allowing unauthenticated
-- inserts. Only the on-order-paid edge function (service role)
-- should ever create memberships.
-- ============================================================

DROP POLICY IF EXISTS "memberships_insert" ON memberships;

CREATE POLICY "memberships_insert" ON memberships
  FOR INSERT WITH CHECK (auth.role() = 'service_role');


-- ============================================================
-- FIX 2: orders_insert — require authentication
-- The old policy used WITH CHECK (true) allowing anon inserts.
-- Orders must be tied to a logged-in user.
-- ============================================================

DROP POLICY IF EXISTS "orders_insert" ON orders;

CREATE POLICY "orders_insert" ON orders
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());


-- ============================================================
-- FIX 3: players column-level access — restrict PII from anon
-- The public_read_players policy with USING (true) exposed all
-- columns (email, phone, date_of_birth, user_id) to anonymous
-- users. Revoke broad anon SELECT and grant only safe columns.
-- ============================================================

REVOKE SELECT ON players FROM anon;

GRANT SELECT (id, first_name, last_name, batting_style, bowling_style,
              jersey_number, is_captain_club, is_vice_captain,
              is_active, joined_season_id) ON players TO anon;

-- Ensure authenticated users still get full column access.
GRANT SELECT ON players TO authenticated;


-- ============================================================
-- FIX 4: player_self_update — prevent protected column updates
-- via trigger. The player_self_update RLS policy (013) allows
-- players to UPDATE their own row but cannot restrict which
-- columns change at the policy level. A BEFORE UPDATE trigger
-- blocks reassignment of user_id, is_captain_club, and
-- is_vice_captain when the caller is the row's own user.
-- ============================================================

CREATE OR REPLACE FUNCTION prevent_player_protected_column_update()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
    RAISE EXCEPTION 'Cannot reassign user_id';
  END IF;
  IF OLD.is_captain_club IS DISTINCT FROM NEW.is_captain_club THEN
    RAISE EXCEPTION 'Cannot self-assign captain status';
  END IF;
  IF OLD.is_vice_captain IS DISTINCT FROM NEW.is_vice_captain THEN
    RAISE EXCEPTION 'Cannot self-assign vice-captain status';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_player_protected_columns ON players;

CREATE TRIGGER trg_player_protected_columns
  BEFORE UPDATE ON players
  FOR EACH ROW
  WHEN (auth.role() = 'authenticated' AND NEW.user_id = auth.uid())
  EXECUTE FUNCTION prevent_player_protected_column_update();


-- ============================================================
-- FIX 5: staff_write_players — split FOR ALL into specific ops
-- The old policy used FOR ALL which implicitly included DELETE,
-- letting scorers/coaches delete player records. Replace with
-- explicit INSERT and UPDATE only; DELETE remains admin-only
-- via the admin_write_players policy that preceded it (now
-- re-added below for explicit DELETE coverage).
-- ============================================================

DROP POLICY IF EXISTS "staff_write_players" ON players;

CREATE POLICY "staff_write_players_insert" ON players
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'scorer'));

CREATE POLICY "staff_write_players_update" ON players
  FOR UPDATE
  USING  (has_role(auth.uid(), 'scorer'))
  WITH CHECK (has_role(auth.uid(), 'scorer'));

-- Restore explicit admin-only DELETE (was previously covered by
-- FOR ALL in admin_write_players which 020 dropped).
DROP POLICY IF EXISTS "admin_delete_players" ON players;

CREATE POLICY "admin_delete_players" ON players
  FOR DELETE USING (has_role(auth.uid(), 'admin'));


-- ============================================================
-- FIX 6: selections column-level grants — prevent mass-assignment
-- Players should only be able to update confirmed_at, status,
-- and withdrawn_at. Revoke broad UPDATE from authenticated and
-- grant only those three columns; restore full access to
-- service_role so coach API routes (which use service role) work.
-- ============================================================

REVOKE UPDATE ON selections FROM authenticated;

GRANT UPDATE (confirmed_at, status, withdrawn_at) ON selections TO authenticated;

GRANT UPDATE ON selections TO service_role;


-- ============================================================
-- FIX 7: Add SET search_path = public to all SECURITY DEFINER
-- functions. Without this, a malicious user could create objects
-- in a schema earlier in the search_path to intercept calls.
-- Re-create each function with identical bodies but with the
-- search_path pinned to public.
-- ============================================================

-- 7a: has_role() — final version from 013_identity_bridge.sql
-- (007_shop.sql re-created it as sql; 013 is the authoritative body)
CREATE OR REPLACE FUNCTION has_role(user_uuid uuid, required_role text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = user_uuid
      AND (
        role = required_role
        OR role = 'admin'
        OR (required_role = 'scorer'  AND role IN ('admin', 'coach'))
        OR (required_role = 'player'  AND role IN ('admin', 'coach', 'scorer', 'player'))
        OR (required_role = 'coach'   AND role IN ('admin', 'coach'))
        OR (required_role = 'shop'    AND role IN ('admin', 'shop'))
      )
  );
$$;

-- 7b: current_player_id() — from 013_identity_bridge.sql
CREATE OR REPLACE FUNCTION current_player_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM players WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 7c: acquire_scoring_lock() — from 005_lock_rpc.sql
CREATE OR REPLACE FUNCTION acquire_scoring_lock(
  p_match_id   text,
  p_session_id text,
  p_user_id    text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_expiry  timestamptz := now() - interval '2 minutes';
  v_updated int;
BEGIN
  UPDATE matches
  SET
    scorer_session_id = p_session_id,
    scorer_locked_at  = now(),
    scorer_user_id    = p_user_id::uuid
  WHERE id = p_match_id::uuid
    AND (
      scorer_session_id IS NULL
      OR scorer_session_id = p_session_id
      OR scorer_locked_at < v_expiry
    );

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated > 0;
END;
$$;

-- 7d: update_match_overs() — from 024_update_match_overs_fn.sql
CREATE OR REPLACE FUNCTION update_match_overs(p_match_id uuid, p_new_overs int)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT has_role(auth.uid(), 'scorer') THEN
    RAISE EXCEPTION 'Unauthorized: scorer role required';
  END IF;
  IF p_new_overs < 1 THEN
    RAISE EXCEPTION 'overs_per_innings must be at least 1';
  END IF;
  UPDATE matches SET overs_per_innings = p_new_overs WHERE id = p_match_id;
END;
$$;

-- 7e: set_attended_flag() — from 016_attended_flag.sql
CREATE OR REPLACE FUNCTION set_attended_flag()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE match_players
  SET attended = true
  WHERE id IN (NEW.batter_id, NEW.non_striker_id, NEW.bowler_id)
    AND attended = false;
  RETURN NEW;
END;
$$;


-- ============================================================
-- FIX 8: Safe stats refresh function to replace exec_sql RPC
-- The refresh-stats edge function calls exec_sql(sql) which
-- allows arbitrary SQL execution. Replace with a named function
-- that only does the allowed operations. The season/career stats
-- views are regular (non-materialized) views as of migration 006,
-- so there is nothing to REFRESH MATERIALIZED VIEW on them.
-- This function exists as a safe, permission-controlled entry
-- point; the edge function can be updated to call it instead.
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_stats_views()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  -- season_batting_stats, season_bowling_stats, career_batting_stats,
  -- career_bowling_stats are regular VIEWs (converted from materialized
  -- in 006_enhanced_stats_and_fielding.sql) — no REFRESH needed.
  -- This function is a safe, restricted replacement for exec_sql RPC
  -- and is intentionally a no-op until any future materialized views
  -- are added. Add REFRESH MATERIALIZED VIEW CONCURRENTLY statements
  -- here when needed.
  SELECT 1;
$$;

-- Restrict execution to service_role only (edge functions use service key).
REVOKE EXECUTE ON FUNCTION refresh_stats_views() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION refresh_stats_views() TO service_role;
