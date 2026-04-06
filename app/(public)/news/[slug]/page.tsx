import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

export const revalidate = 60

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

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

/** Very simple markdown → HTML: paragraphs, bold, italic, headings */
function renderMarkdown(md: string): string {
  const escaped = md
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  const lines = escaped.split('\n')
  const html: string[] = []
  let inParagraph = false

  for (const raw of lines) {
    const line = raw.trimEnd()

    if (line.startsWith('### ')) {
      if (inParagraph) { html.push('</p>'); inParagraph = false }
      html.push(`<h3>${inline(line.slice(4))}</h3>`)
    } else if (line.startsWith('## ')) {
      if (inParagraph) { html.push('</p>'); inParagraph = false }
      html.push(`<h2>${inline(line.slice(3))}</h2>`)
    } else if (line.startsWith('# ')) {
      if (inParagraph) { html.push('</p>'); inParagraph = false }
      html.push(`<h1>${inline(line.slice(2))}</h1>`)
    } else if (line === '') {
      if (inParagraph) { html.push('</p>'); inParagraph = false }
    } else {
      if (!inParagraph) { html.push('<p>'); inParagraph = true }
      else html.push('<br />')
      html.push(inline(line))
    }
  }
  if (inParagraph) html.push('</p>')
  return html.join('')
}

function inline(s: string): string {
  return s
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/_(.+?)_/g, '<em>$1</em>')
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = await getArticle(slug)
  if (!article) notFound()

  const html = renderMarkdown(article.content)

  return (
    <>
      <style>{`
        .article-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }
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
            <div className="article-date">{formatDate(article.published_at)}</div>
            <div className="article-headline">{article.title}</div>
          </div>
        </div>

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
