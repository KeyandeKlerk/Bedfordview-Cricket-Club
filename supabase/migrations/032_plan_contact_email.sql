-- 032_plan_contact_email.sql
-- Adds SaaS plan tier and contact email to club_config.

ALTER TABLE club_config
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'club'
    CONSTRAINT club_config_plan_check CHECK (plan IN ('club', 'pro')),
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
