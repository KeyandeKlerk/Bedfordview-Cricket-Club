-- 033_is_demo.sql
-- Adds demo-mode flag to club_config.

ALTER TABLE club_config
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
