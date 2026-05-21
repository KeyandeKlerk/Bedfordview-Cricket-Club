-- 028_club_config.sql
-- Per-deployment white-label branding configuration.

CREATE TABLE IF NOT EXISTS club_config (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name       text NOT NULL DEFAULT 'Cricket Club',
  club_short_name text NOT NULL DEFAULT 'CC',
  logo_url        text,
  favicon_url     text,
  primary_color   text NOT NULL DEFAULT '#2563eb',
  highlight_color text NOT NULL DEFAULT '#38bdf8',
  bg_color        text NOT NULL DEFAULT '#050c1a',
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Only one config row per deployment
CREATE UNIQUE INDEX IF NOT EXISTS club_config_singleton ON club_config ((true));

-- Seed with BCC defaults
INSERT INTO club_config (club_name, club_short_name, logo_url, primary_color, highlight_color, bg_color)
VALUES ('Bedfordview Cricket Club', 'BCC', '/img/bcc-logo.png', '#2563eb', '#38bdf8', '#050c1a')
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE club_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read club config (needed for public pages)
CREATE POLICY "club_config_public_read" ON club_config
  FOR SELECT USING (true);

-- Only admins can update
CREATE POLICY "club_config_admin_write" ON club_config
  FOR UPDATE USING (has_role(auth.uid(), 'admin'));

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION touch_club_config()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS trg_club_config_updated_at ON club_config;
CREATE TRIGGER trg_club_config_updated_at
  BEFORE UPDATE ON club_config
  FOR EACH ROW EXECUTE FUNCTION touch_club_config();
