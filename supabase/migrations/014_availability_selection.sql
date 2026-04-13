-- ============================================================
-- 014_availability_selection.sql
-- Availability windows, player availability responses, and
-- team selections. Feeds ScorerShell roster pre-population.
-- ============================================================

-- ── STEP 1: availability_windows ─────────────────────────────────────────────
-- One window per weekend (or any time span). NOT category-scoped —
-- all active players respond to the same window regardless of team.
-- Category filtering happens at selection time via competitions.category.

CREATE TABLE IF NOT EXISTS availability_windows (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id    uuid NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  title        text NOT NULL,              -- e.g. "Weekend 12–13 Apr"
  window_start date NOT NULL,
  window_end   date NOT NULL,
  deadline     timestamptz NOT NULL,       -- players must respond before this
  created_by   uuid NOT NULL REFERENCES auth.users(id),
  created_at   timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT aw_dates_valid CHECK (window_end >= window_start),
  CONSTRAINT aw_deadline_before_end CHECK (deadline <= (window_end::timestamptz + interval '23:59:59'))
);


-- ── STEP 2: player_availability ──────────────────────────────────────────────
-- One row per (player, window). Players can update until deadline.
-- Late submissions blocked by RLS WITH CHECK (see policies below).

CREATE TABLE IF NOT EXISTS player_availability (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  window_id    uuid NOT NULL REFERENCES availability_windows(id) ON DELETE CASCADE,
  player_id    uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  status       text NOT NULL CHECK (status IN ('available', 'unavailable', 'tentative')),
  note         text,                       -- optional free-text reason
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),

  UNIQUE (window_id, player_id)
);

-- Auto-update updated_at on change
CREATE OR REPLACE FUNCTION touch_player_availability()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_player_availability
  BEFORE UPDATE ON player_availability
  FOR EACH ROW EXECUTE FUNCTION touch_player_availability();


-- ── STEP 3: selections ────────────────────────────────────────────────────────
-- One row per (match, player). Coach selects XI for each specific match.
-- Player pool for a match is filtered by competitions.category at query time.
-- override_reason is required when selecting a player marked 'unavailable'.

CREATE TABLE IF NOT EXISTS selections (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id        uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  player_id       uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  position        int CHECK (position BETWEEN 1 AND 15),  -- 11 starters + reserves
  role            text NOT NULL DEFAULT 'player'
                    CHECK (role IN ('player', 'reserve', '12th_man')),
  status          text NOT NULL DEFAULT 'selected'
                    CHECK (status IN ('selected', 'withdrawn', 'did_not_play')),
  override_reason text,   -- must be set when selecting an unavailable player
  selected_by     uuid NOT NULL REFERENCES auth.users(id),
  notified_at     timestamptz,   -- when on-selection-announced edge fn ran
  confirmed_at    timestamptz,   -- when player tapped "Confirm"
  withdrawn_at    timestamptz,   -- when status changed to 'withdrawn'
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (match_id, player_id)
);


-- ── STEP 4: Link matches to their availability window ────────────────────────
-- A window can cover multiple matches (senior + junior on same weekend).
-- Each match links to the window its availability polling came from.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS availability_window_id uuid REFERENCES availability_windows(id);


-- ── STEP 5: Idempotent unique index on match_players (player per match) ───────
-- Required for ON CONFLICT DO NOTHING in ScorerShell when pre-populating
-- match_players from selections. Prevents double-insert on retry.

CREATE UNIQUE INDEX IF NOT EXISTS match_players_unique_player
  ON match_players (match_id, player_id)
  WHERE player_id IS NOT NULL;


-- ── STEP 6: RLS — availability_windows ────────────────────────────────────────

ALTER TABLE availability_windows ENABLE ROW LEVEL SECURITY;

-- Anyone can read windows (fixture pages can show open windows)
CREATE POLICY aw_public_read ON availability_windows
  FOR SELECT USING (true);

-- Coach and admin can create windows
CREATE POLICY aw_coach_insert ON availability_windows
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));

-- Coach and admin can update their own windows
CREATE POLICY aw_coach_update ON availability_windows
  FOR UPDATE USING (has_role(auth.uid(), 'coach'));

-- Only admin can delete windows
CREATE POLICY aw_admin_delete ON availability_windows
  FOR DELETE USING (has_role(auth.uid(), 'admin'));


-- ── STEP 7: RLS — player_availability ────────────────────────────────────────

ALTER TABLE player_availability ENABLE ROW LEVEL SECURITY;

-- Players see their own submissions; coaches/admins see all
CREATE POLICY pa_own_read ON player_availability
  FOR SELECT
  USING (
    player_id = current_player_id()
    OR has_role(auth.uid(), 'coach')
  );

-- Players can only submit for themselves, and only before the deadline
CREATE POLICY pa_own_insert ON player_availability
  FOR INSERT WITH CHECK (
    player_id = current_player_id()
    AND (
      SELECT deadline
      FROM availability_windows
      WHERE id = window_id
    ) > now()
  );

-- Players can update their own response, still before deadline
CREATE POLICY pa_own_update ON player_availability
  FOR UPDATE
  USING (player_id = current_player_id())
  WITH CHECK (
    player_id = current_player_id()
    AND (
      SELECT deadline
      FROM availability_windows
      WHERE id = window_id
    ) > now()
  );

-- Admin can read/write/delete anything (for support scenarios)
CREATE POLICY pa_admin_all ON player_availability
  FOR ALL USING (has_role(auth.uid(), 'admin'));


-- ── STEP 8: RLS — selections ──────────────────────────────────────────────────

ALTER TABLE selections ENABLE ROW LEVEL SECURITY;

-- Players see their own selection; coaches see all selections
CREATE POLICY sel_own_read ON selections
  FOR SELECT
  USING (
    player_id = current_player_id()
    OR has_role(auth.uid(), 'coach')
  );

-- Only coaches/admins can create selections
CREATE POLICY sel_coach_insert ON selections
  FOR INSERT WITH CHECK (has_role(auth.uid(), 'coach'));

-- Coaches can update any selection (status changes, position reordering)
CREATE POLICY sel_coach_update ON selections
  FOR UPDATE USING (has_role(auth.uid(), 'coach'));

-- Players can update only their own row:
--   • to set confirmed_at (confirm attendance)
--   • to set status = 'withdrawn' (withdraw from match)
CREATE POLICY sel_player_confirm ON selections
  FOR UPDATE
  USING (player_id = current_player_id())
  WITH CHECK (
    player_id = current_player_id()
    AND (confirmed_at IS NOT NULL OR status = 'withdrawn')
  );

-- Only admin can delete selections
CREATE POLICY sel_admin_delete ON selections
  FOR DELETE USING (has_role(auth.uid(), 'admin'));
