-- 034_article_images_categories.sql
-- Adds featured image, category, and meta description columns to articles.
-- Adds the news-images Storage bucket with admin-write / public-read RLS.

ALTER TABLE articles
  ADD COLUMN IF NOT EXISTS featured_image_url text,
  ADD COLUMN IF NOT EXISTS featured_image_alt text,
  ADD COLUMN IF NOT EXISTS category text
    CHECK (category IN ('match_report', 'club_news', 'junior_section', 'announcement', 'general')),
  ADD COLUMN IF NOT EXISTS meta_description text;

-- Storage bucket for article images (featured + inline)
INSERT INTO storage.buckets (id, name, public)
VALUES ('news-images', 'news-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "public read news-images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'news-images');

CREATE POLICY "admin write news-images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'news-images' AND has_role(auth.uid(), 'admin'));

CREATE POLICY "admin delete news-images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'news-images' AND has_role(auth.uid(), 'admin'));
