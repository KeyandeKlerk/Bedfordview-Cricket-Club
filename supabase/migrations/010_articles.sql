-- 010_articles.sql
-- Adds articles (news/match reports) table with RLS.

CREATE TABLE IF NOT EXISTS articles (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title        text NOT NULL,
  slug         text NOT NULL UNIQUE,
  content      text NOT NULL DEFAULT '',
  excerpt      text,
  author_id    uuid REFERENCES auth.users(id),
  match_id     uuid REFERENCES matches(id),
  published_at timestamptz,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_articles_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW EXECUTE FUNCTION update_articles_updated_at();

-- RLS
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "public reads published articles" ON articles
  FOR SELECT USING (published_at IS NOT NULL AND published_at <= now());

CREATE POLICY "admin full access to articles" ON articles
  FOR ALL USING (has_role(auth.uid(), 'admin'));
