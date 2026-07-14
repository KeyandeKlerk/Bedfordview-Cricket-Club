import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { anonSupabase as supabase } from '@/lib/supabase/server'
import { sanitizeArticleHtml } from '@/lib/content/sanitize'
import { categoryLabel } from '@/lib/content/categories'

export const revalidate = 60

async function getArticle(slug: string) {
  const { data, error } = await supabase
    .from('articles')
    .select('*')
    .eq('slug', slug)
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .single()
  if (error) return null
  return data
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()

  const html = sanitizeArticleHtml(article.content)

  return (
    <>
      <style>{`
        .article-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; max-width: 100vw; overflow-x: hidden; }
        .article-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid rgba(59,130,246,0.15);
          padding: 44px 0 36px;
          margin-bottom: 40px;
        }
        .article-breadcrumb {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
          margin-bottom: 14px;
          display: flex; align-items: center; gap: 8px;
        }
        .article-breadcrumb a { color: #60a5fa; text-decoration: none; }
        .article-breadcrumb a:hover { color: #93c5fd; }
        .article-category-badge {
          display: inline-block; margin-bottom: 10px;
          font-size: 10px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 3px 9px; border-radius: 5px;
          background: rgba(56,189,248,0.12); color: #38bdf8;
          border: 1px solid rgba(56,189,248,0.25);
        }
        .article-featured-image { margin-bottom: 32px; overflow: hidden; border-radius: 12px; }
        .article-date {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
          margin-bottom: 12px;
        }
        .article-headline {
          font-family: 'Syne', sans-serif;
          font-size: clamp(26px, 4vw, 44px);
          font-weight: 800; color: #f0f8ff;
          letter-spacing: -0.02em; line-height: 1.15;
          margin-bottom: 12px;
        }
        .article-body {
          max-width: 680px;
          font-family: 'Outfit', sans-serif;
          font-size: 16px; line-height: 1.8;
          color: rgba(147,197,253,0.8);
        }
        .article-body p { margin: 0 0 1.4em 0; }
        .article-body h1, .article-body h2, .article-body h3 {
          font-family: 'Syne', sans-serif;
          color: #e2eeff; letter-spacing: -0.01em;
          margin: 1.8em 0 0.6em;
        }
        .article-body h2 { font-size: 22px; font-weight: 800; }
        .article-body h3 { font-size: 18px; font-weight: 700; }
        .article-body strong { color: #e2eeff; font-weight: 700; }
        .article-body em { color: #93c5fd; font-style: italic; }
        .article-body img.article-img { max-width: 100%; border-radius: 8px; }
        .article-body img.align-left { float: left; margin: 0 20px 12px 0; max-width: 45%; }
        .article-body img.align-right { float: right; margin: 0 0 12px 20px; max-width: 45%; }
        .article-body img.align-center { display: block; margin: 20px auto; }
        .article-body img.align-full { width: 100%; margin: 20px 0; }
        .article-match-link {
          display: inline-flex; align-items: center; gap: 8px;
          margin-top: 32px;
          padding: 10px 18px; border-radius: 8px;
          background: rgba(37,99,235,0.08);
          border: 1px solid rgba(59,130,246,0.25);
          color: #60a5fa;
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
          text-decoration: none; transition: all 0.15s;
        }
        .article-match-link:hover { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.45); }
        @media (max-width: 768px) {
          .article-body { font-size: 15px; }
          .article-hero { padding: 32px 0 28px; margin-bottom: 28px; }
        }
      `}</style>

      <div className="article-page">
        <div className="article-hero">
          <div className="container">
            <div className="article-breadcrumb">
              <Link href="/news">News</Link>
              <span>/</span>
              Article
            </div>
            {article.category && (
              <div className="article-category-badge">{categoryLabel(article.category)}</div>
            )}
            <div className="article-date">{formatDate(article.published_at)}</div>
            <div className="article-headline">{article.title}</div>
          </div>
        </div>

        {article.featured_image_url && (
          <div className="container">
            <div className="article-featured-image">
              <Image
                src={article.featured_image_url}
                alt={article.featured_image_alt ?? article.title}
                width={1200}
                height={420}
                style={{ width: '100%', height: 420, objectFit: 'cover', borderRadius: 12 }}
                priority
              />
            </div>
          </div>
        )}

        <div className="container">
          <div
            className="article-body"
            dangerouslySetInnerHTML={{ __html: html }}
          />
          {article.match_id && (
            <Link href={`/results/${article.match_id}`} className="article-match-link">
              View full scorecard →
            </Link>
          )}
        </div>
      </div>
    </>
  )
}
