-- ============================================================
-- 018_fix_selection_rls.sql
-- Fix: allow players to withdraw from a match even before
-- they have confirmed (sel_player_confirm policy was requiring
-- confirmed_at IS NOT NULL in the new row, blocking withdraw
-- for unconfirmed selections).
-- ============================================================

DROP POLICY IF EXISTS sel_player_confirm ON selections;

CREATE POLICY sel_player_confirm ON selections
  FOR UPDATE
  USING (player_id = current_player_id())
  WITH CHECK (
    player_id = current_player_id()
    AND (confirmed_at IS NOT NULL OR status = 'withdrawn')
  );
