-- 029_scoring_mode.sql
-- Adds scoring_mode to matches (per-match) and club_config (deployment default).
-- 'club' = standard scoring UI only.
-- 'professional' = post-ball annotation panel (wagon wheel, pitch map, shot type, etc.).

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS scoring_mode TEXT NOT NULL DEFAULT 'club'
    CHECK (scoring_mode IN ('club', 'professional'));

ALTER TABLE club_config
  ADD COLUMN IF NOT EXISTS default_scoring_mode TEXT NOT NULL DEFAULT 'club'
    CHECK (default_scoring_mode IN ('club', 'professional'));

-- No new RLS policies needed:
--   matches: existing scorer_update_matches and admin_write_matches cover updates.
--   club_config: existing club_config_public_read / club_config_admin_write cover
--                both the new column and the original columns.
