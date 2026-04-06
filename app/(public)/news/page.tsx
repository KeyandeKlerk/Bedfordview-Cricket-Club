import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

async function getArticles() {
  const { data } = await supabase
    .from('articles')
    .select('id, title, slug, excerpt, published_at, match_id')
    .not('published_at', 'is', null)
    .lte('published_at', new Date().toISOString())
    .order('published_at', { ascending: false })
  return data ?? []
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default async function NewsPage() {
  const articles = await getArticles()

  return (
    <>
      <style>{`
        .news-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }
        .news-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid rgba(59,130,246,0.15);
          padding: 44px 0 36px;
          margin-bottom: 40px;
        }
        .news-hero-title {
          font-family: 'Syne', sans-serif;
          font-size: clamp(28px, 5vw, 48px);
          font-weight: 800; color: #f0f8ff;
          letter-spacing: -0.02em; margin-bottom: 10px;
        }
        .news-hero-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 15px; color: rgba(147,197,253,0.5);
        }
        .articles-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
          gap: 20px;
        }
        .article-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.14);
          border-radius: 14px;
          overflow: hidden;
          transition: border-color 0.2s, transform 0.2s;
          text-decoration: none;
          display: block;
        }
        .article-card:hover {
          border-color: rgba(59,130,246,0.35);
          transform: translateY(-2px);
        }
        .article-card-body { padding: 22px; }
        .article-card-date {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
          margin-bottom: 10px;
        }
        .article-card-title {
          font-family: 'Syne', sans-serif;
          font-size: 18px; font-weight: 800;
          color: #e2eeff; letter-spacing: -0.01em;
          margin-bottom: 10px; line-height: 1.3;
        }
        .article-card-excerpt {
          font-family: 'Outfit', sans-serif;
          font-size: 13px; color: rgba(147,197,253,0.55);
          line-height: 1.65;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .article-card-footer {
          padding: 14px 22px;
          border-top: 1px solid rgba(59,130,246,0.08);
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 700;
          color: #38bdf8; letter-spacing: 0.05em;
        }
        .empty-state {
          text-align: center; padding: 80px 0;
          color: rgba(147,197,253,0.4);
          font-family: 'Outfit', sans-serif; font-size: 15px;
        }
      `}</style>

      <div className="news-page">
        <div className="news-hero">
          <div className="container">
            <div className="news-hero-title">News &amp; Reports</div>
            <div className="news-hero-sub">Club updates, match reports and announcements</div>
          </div>
        </div>

        <div className="container">
          {articles.length === 0 ? (
            <div className="empty-state">No articles published yet.</div>
          ) : (
            <div className="articles-grid">
              {articles.map((a: any) => (
                <Link key={a.id} href={`/news/${a.slug}`} className="article-card">
                  <div className="article-card-body">
                    <div className="article-card-date">{formatDate(a.published_at)}</div>
                    <div className="article-card-title">{a.title}</div>
                    {a.excerpt && <div className="article-card-excerpt">{a.excerpt}</div>}
                  </div>
                  <div className="article-card-footer">Read more →</div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
