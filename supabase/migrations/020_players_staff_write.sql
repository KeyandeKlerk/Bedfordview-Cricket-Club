-- ============================================================
-- 020_players_staff_write.sql
-- Allow all staff roles (admin, coach, scorer, shop) to write
-- player records. Previously restricted to admin only.
-- ============================================================

DROP POLICY IF EXISTS "admin_write_players" ON players;

-- has_role('scorer') covers admin + coach + scorer via hierarchy.
CREATE POLICY "staff_write_players" ON players
  FOR ALL
  USING (has_role(auth.uid(), 'scorer'));
