-- ============================================================
-- 013_identity_bridge.sql
-- Unified identity: link players to auth.users
-- Also fixes memberships UNIQUE bug and extends role types
-- ============================================================

-- ── STEP 1: Add identity columns to players ───────────────────────────────────
-- user_id is nullable — existing historic players without accounts stay valid.
-- The unique index enforces one account per player once linked.

ALTER TABLE players
  ADD COLUMN IF NOT EXISTS user_id           uuid UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS email             text,
  ADD COLUMN IF NOT EXISTS phone             text,
  ADD COLUMN IF NOT EXISTS jersey_number     int,
  ADD COLUMN IF NOT EXISTS is_captain_club   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_vice_captain   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS date_of_birth     date,
  ADD COLUMN IF NOT EXISTS joined_season_id  uuid REFERENCES seasons(id);


-- ── STEP 2: Fix memberships UNIQUE constraint ─────────────────────────────────
-- Old: UNIQUE (user_id) blocks a player from ever buying a second year's membership.
-- New: partial unique — only one ACTIVE membership per user at a time.
-- Multiple rows are allowed; historical/expired rows are preserved.

ALTER TABLE memberships DROP CONSTRAINT IF EXISTS memberships_user_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active
  ON memberships (user_id) WHERE status = 'active';


-- ── STEP 3: Extend role types ─────────────────────────────────────────────────
-- Add 'player' and 'coach' roles.
-- 'player'  — registered member who can submit availability, confirm selection
-- 'coach'   — can create availability windows, select XI, view all availability

ALTER TABLE user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE user_roles ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('scorer', 'admin', 'shop', 'player', 'coach'));


-- ── STEP 4: Replace has_role() with role hierarchy ────────────────────────────
-- Hierarchy: admin > coach > scorer > player
-- admin    can do anything
-- coach    can do everything a scorer can + team selection + availability management
-- scorer   can score matches (ball_events INSERT/DELETE)
-- player   can submit availability and confirm selections

CREATE OR REPLACE FUNCTION has_role(user_uuid uuid, required_role text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER AS $$
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


-- ── STEP 5: Add current_player_id() helper ────────────────────────────────────
-- Returns the players.id for the currently authenticated user.
-- Used in RLS policies for player_availability and selections.

CREATE OR REPLACE FUNCTION current_player_id()
RETURNS uuid LANGUAGE sql SECURITY DEFINER AS $$
  SELECT id FROM players WHERE user_id = auth.uid() LIMIT 1;
$$;


-- ── STEP 6: RLS — players self-update ─────────────────────────────────────────
-- Players can update their own profile fields (nickname, phone, email, etc.)
-- user_id reassignment and is_captain_club changes are blocked at the API layer,
-- not here (RLS cannot compare old vs new values in UPDATE WITH CHECK).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'players' AND policyname = 'player_self_update'
  ) THEN
    CREATE POLICY player_self_update ON players
      FOR UPDATE
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END;
$$;
