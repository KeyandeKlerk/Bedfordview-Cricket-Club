-- 009_cleanup.sql
-- Removes legacy/unused tables and columns identified by codebase audit.

-- ── Drop legacy deliveries table (replaced entirely by ball_events) ───────────
DROP TABLE IF EXISTS deliveries CASCADE;

-- ── Drop unused columns ───────────────────────────────────────────────────────
ALTER TABLE match_players DROP COLUMN IF EXISTS is_active;
ALTER TABLE grounds        DROP COLUMN IF EXISTS capacity;

-- ── Backfill matches.team_id before constraining ─────────────────────────────
-- Assigns any unassigned matches to the first active senior team.
-- This is safe to re-run (WHERE team_id IS NULL is a no-op if already filled).
UPDATE matches
SET team_id = (
  SELECT id FROM teams
  WHERE is_active = true
    AND (category = 'senior' OR category IS NULL)
  ORDER BY created_at
  LIMIT 1
)
WHERE team_id IS NULL;
