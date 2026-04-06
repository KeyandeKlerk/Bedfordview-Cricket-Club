-- 011_competition_category.sql
--
-- Adds category (senior/junior) to competitions so each league/cup
-- is explicitly tagged. The new match form uses this to auto-set
-- matches.team_id without exposing the teams table to the user.

ALTER TABLE competitions
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'senior'
    CHECK (category IN ('senior', 'junior'));

-- Backfill: competitions whose names contain 'junior' or 'u1' (under-X) are junior.
UPDATE competitions
SET category = 'junior'
WHERE LOWER(name) SIMILAR TO '%(junior|under|u1[0-9])%';
