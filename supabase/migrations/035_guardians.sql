-- ============================================================
-- 035_guardians.sql
-- Guardian/dependent model: many-to-many link between an
-- auth.users guardian and one or more (typically junior)
-- players. A guardian can act on behalf of a linked player
-- only while that player is unclaimed (players.user_id IS NULL).
-- Once the player claims their own login, the guardian keeps
-- read-only visibility but write actions move to the player.
-- Also attributes orders/memberships to a specific player
-- (the beneficiary) distinct from the paying user_id.
-- ============================================================

-- ── STEP 1: player_guardians join table ───────────────────────────────────

CREATE TABLE IF NOT EXISTS player_guardians (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id        uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  relationship     text NOT NULL DEFAULT 'parent'
                     CHECK (relationship IN ('parent', 'guardian', 'other')),
  created_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid REFERENCES auth.users(id),

  UNIQUE (guardian_user_id, player_id)
);

CREATE INDEX IF NOT EXISTS idx_player_guardians_guardian ON player_guardians (guardian_user_id);
CREATE INDEX IF NOT EXISTS idx_player_guardians_player   ON player_guardians (player_id);


-- ── STEP 2: helper functions ───────────────────────────────────────────────
-- current_guardian_player_ids() — SELECT/visibility scope: the caller's own
--   linked player (if any) PLUS every player they are a guardian of,
--   regardless of whether that player has since claimed their own login.
--   Guardians retain permanent history visibility.
--
-- current_actable_player_ids() — WRITE scope: the caller's own linked
--   player PLUS guardian-linked players that are still UNCLAIMED
--   (user_id IS NULL). The moment a child's players.user_id is set (via
--   player_claims approval), that player drops out of every guardian's
--   actable set on the next query — no data migration required.

CREATE OR REPLACE FUNCTION current_guardian_player_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM players WHERE user_id = auth.uid()
  UNION
  SELECT player_id FROM player_guardians WHERE guardian_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION current_actable_player_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM players WHERE user_id = auth.uid()
  UNION
  SELECT pg.player_id
  FROM player_guardians pg
  JOIN players p ON p.id = pg.player_id
  WHERE pg.guardian_user_id = auth.uid()
    AND p.user_id IS NULL;
$$;

CREATE OR REPLACE FUNCTION is_guardian_of(p_player_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM player_guardians
    WHERE guardian_user_id = auth.uid() AND player_id = p_player_id
  );
$$;


-- ── STEP 3: RLS — player_guardians ────────────────────────────────────────

ALTER TABLE player_guardians ENABLE ROW LEVEL SECURITY;

-- A guardian can see their own links; admin can see all (support/audit).
CREATE POLICY pg_select ON player_guardians
  FOR SELECT USING (
    guardian_user_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
  );

-- Inserts/updates/deletes happen through service-role API routes only
-- (so age validation, dedupe, and child player-row creation stay atomic
-- and server-side) — admin gets a direct escape hatch for manual support.
CREATE POLICY pg_admin_all ON player_guardians
  FOR ALL USING (has_role(auth.uid(), 'admin'));


-- ── STEP 4: RLS — player_availability (guardian can act for a linked, ────
--            unclaimed child; existing self-only behaviour is unchanged
--            because current_actable_player_ids() always includes self)

DROP POLICY IF EXISTS pa_own_read ON player_availability;
CREATE POLICY pa_own_read ON player_availability
  FOR SELECT
  USING (
    player_id IN (SELECT current_guardian_player_ids())
    OR has_role(auth.uid(), 'coach')
  );

DROP POLICY IF EXISTS pa_own_insert ON player_availability;
CREATE POLICY pa_own_insert ON player_availability
  FOR INSERT WITH CHECK (
    player_id IN (SELECT current_actable_player_ids())
    AND (
      SELECT deadline
      FROM availability_windows
      WHERE id = window_id
    ) > now()
  );

DROP POLICY IF EXISTS pa_own_update ON player_availability;
CREATE POLICY pa_own_update ON player_availability
  FOR UPDATE
  USING (player_id IN (SELECT current_actable_player_ids()))
  WITH CHECK (
    player_id IN (SELECT current_actable_player_ids())
    AND (
      SELECT deadline
      FROM availability_windows
      WHERE id = window_id
    ) > now()
  );

-- Track who actually submitted (player vs. guardian) — surfaces
-- "submitted by mum/dad" in the UI.
ALTER TABLE player_availability
  ADD COLUMN IF NOT EXISTS submitted_by uuid REFERENCES auth.users(id);


-- ── STEP 5: RLS — selections (guardian can confirm/withdraw for a ────────
--            linked, unclaimed child)

DROP POLICY IF EXISTS sel_own_read ON selections;
CREATE POLICY sel_own_read ON selections
  FOR SELECT
  USING (
    player_id IN (SELECT current_guardian_player_ids())
    OR has_role(auth.uid(), 'coach')
  );

DROP POLICY IF EXISTS sel_player_confirm ON selections;
CREATE POLICY sel_player_confirm ON selections
  FOR UPDATE
  USING (player_id IN (SELECT current_actable_player_ids()))
  WITH CHECK (
    player_id IN (SELECT current_actable_player_ids())
    AND (confirmed_at IS NOT NULL OR status = 'withdrawn')
  );

ALTER TABLE selections
  ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES auth.users(id);


-- ── STEP 6: orders.player_id / memberships.player_id ──────────────────────
-- Nullable: NULL means "the account holder themselves" — every historic
-- row is preserved unchanged.

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES players(id) ON DELETE SET NULL;

ALTER TABLE memberships
  ADD COLUMN IF NOT EXISTS player_id uuid REFERENCES players(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_player_id      ON orders (player_id);
CREATE INDEX IF NOT EXISTS idx_memberships_player_id ON memberships (player_id);


-- ── STEP 7: fix memberships "one active" uniqueness for the new ──────────
--            player-scoped model
--
-- The existing partial unique index (013_identity_bridge.sql) is
-- `UNIQUE (user_id) WHERE status = 'active'` — it assumes one active
-- membership per ACCOUNT. With player_id, a guardian must be able to hold
-- one active membership for themselves AND one active membership per
-- linked child, all under the same user_id (the payer). A single compound
-- index `UNIQUE (user_id, player_id) WHERE status='active'` would NOT be
-- safe here: Postgres unique indexes treat NULL as distinct-from-NULL, so
-- it would silently stop deduplicating the "membership for myself" case
-- (player_id IS NULL) — two "self" memberships for the same user could
-- both be inserted without violating the index. Split into two partial
-- indexes instead.

DROP INDEX IF EXISTS memberships_one_active;

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_self
  ON memberships (user_id)
  WHERE status = 'active' AND player_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS memberships_one_active_per_player
  ON memberships (user_id, player_id)
  WHERE status = 'active' AND player_id IS NOT NULL;


-- ── STEP 8: additive SELECT policies so a player who later claims their ──
--            own login can see order/membership history a guardian
--            placed on their behalf while they were a minor (those rows
--            have user_id = guardian, so the existing "user_id =
--            auth.uid()" policies never match the now-adult player).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'orders' AND policyname = 'orders_player_select'
  ) THEN
    CREATE POLICY orders_player_select ON orders
      FOR SELECT USING (player_id = current_player_id());
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'memberships' AND policyname = 'memberships_player_select'
  ) THEN
    CREATE POLICY memberships_player_select ON memberships
      FOR SELECT USING (player_id = current_player_id());
  END IF;
END;
$$;
