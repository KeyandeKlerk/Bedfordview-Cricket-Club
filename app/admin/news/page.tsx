'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Article = {
  id: string
  title: string
  slug: string
  published_at: string | null
  created_at: string
  match_id: string | null
}

export default function AdminNewsPage() {
  const [articles, setArticles] = useState<Article[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('articles')
      .select('id, title, slug, published_at, created_at, match_id')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setArticles(data ?? [])
        setLoading(false)
      })
  }, [])

  async function deleteArticle(id: string) {
    if (!confirm('Delete this article? This cannot be undone.')) return
    await supabase.from('articles').delete().eq('id', id)
    setArticles(a => a.filter(x => x.id !== id))
  }

  async function togglePublish(article: Article) {
    const now = new Date().toISOString()
    const newVal = article.published_at ? null : now
    await supabase.from('articles').update({ published_at: newVal }).eq('id', article.id)
    setArticles(a => a.map(x => x.id === article.id ? { ...x, published_at: newVal } : x))
  }

  return (
    <>
      <style>{`
        .news-admin { padding-top: calc(var(--nav-h) + 32px); padding-bottom: 80px; }
        .news-admin-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 28px; flex-wrap: wrap; gap: 12px;
        }
        .news-admin-title {
          font-family: 'Syne', sans-serif;
          font-size: 28px; font-weight: 800;
          color: #f0f8ff; letter-spacing: -0.02em;
        }
        .article-list { display: flex; flex-direction: column; gap: 12px; }
        .article-row {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.14);
          border-radius: 12px;
          padding: 14px 16px;
          display: flex; flex-direction: column; gap: 10px;
        }
        @media (min-width: 640px) {
          .article-row {
            flex-direction: row; align-items: center;
            padding: 16px 20px; gap: 16px;
          }
        }
        .article-row-info { flex: 1; min-width: 0; }
        .article-row-title {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 700;
          color: #e2eeff; letter-spacing: -0.01em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 100%;
        }
        .article-row-meta {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; color: rgba(147,197,253,0.45);
          margin-top: 4px;
        }
        .article-row-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .btn-sm {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          padding: 5px 12px; border-radius: 6px;
          border: 1px solid rgba(59,130,246,0.3);
          background: rgba(37,99,235,0.08);
          color: #60a5fa; cursor: pointer;
          transition: all 0.15s; text-decoration: none;
          display: inline-flex; align-items: center;
        }
        .btn-sm:hover { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.5); }
        .btn-sm-green { border-color: rgba(34,197,94,0.3); background: rgba(34,197,94,0.08); color: #4ade80; }
        .btn-sm-green:hover { background: rgba(34,197,94,0.18); border-color: rgba(34,197,94,0.5); }
        .btn-sm-red { border-color: rgba(239,68,68,0.3); background: rgba(239,68,68,0.08); color: #f87171; }
        .btn-sm-red:hover { background: rgba(239,68,68,0.18); border-color: rgba(239,68,68,0.5); }
        .badge-published {
          font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 4px;
          background: rgba(34,197,94,0.12); color: #4ade80;
          border: 1px solid rgba(34,197,94,0.2);
        }
        .badge-draft {
          font-size: 9px; font-weight: 700; letter-spacing: 0.12em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 4px;
          background: rgba(234,179,8,0.1); color: #fbbf24;
          border: 1px solid rgba(234,179,8,0.2);
        }
        .empty-state {
          text-align: center; padding: 60px 0;
          color: rgba(147,197,253,0.4);
          font-family: 'Outfit', sans-serif; font-size: 14px;
        }
      `}</style>

      <div className="news-admin">
        <div className="container">
          <div className="news-admin-header">
            <div className="news-admin-title">News & Match Reports</div>
            <Link href="/admin/news/new" className="btn btn-primary" style={{ fontSize: 13 }}>
              + New Article
            </Link>
          </div>

          {loading ? (
            <div className="empty-state">Loading…</div>
          ) : articles.length === 0 ? (
            <div className="empty-state">No articles yet. Create your first one.</div>
          ) : (
            <div className="article-list">
              {articles.map(a => (
                <div key={a.id} className="article-row">
                  <div className="article-row-info">
                    <div className="article-row-title">{a.title}</div>
                    <div className="article-row-meta">
                      <span className={a.published_at ? 'badge-published' : 'badge-draft'}>
                        {a.published_at ? 'Published' : 'Draft'}
                      </span>
                      &nbsp;·&nbsp;
                      {new Date(a.created_at).toLocaleDateString('en-ZA')}
                      {a.match_id && <>&nbsp;· Linked to match</>}
                    </div>
                  </div>
                  <div className="article-row-actions">
                    <Link href={`/admin/news/${a.id}`} className="btn-sm">Edit</Link>
                    <button
                      className={`btn-sm ${a.published_at ? 'btn-sm-red' : 'btn-sm-green'}`}
                      onClick={() => togglePublish(a)}
                    >
                      {a.published_at ? 'Unpublish' : 'Publish'}
                    </button>
                    {a.published_at && (
                      <Link href={`/news/${a.slug}`} className="btn-sm" target="_blank">View</Link>
                    )}
                    <button className="btn-sm btn-sm-red" onClick={() => deleteArticle(a.id)}>Delete</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
