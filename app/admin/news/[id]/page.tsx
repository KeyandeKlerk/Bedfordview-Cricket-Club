'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

type Match = { id: string; match_date: string; opponent: { canonical_name: string } | null; status: string }

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export default function ArticleEditorPage() {
  const params = useParams()
  const router = useRouter()
  const isNew = params.id === 'new'

  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [content, setContent] = useState('')
  const [excerpt, setExcerpt] = useState('')
  const [matchId, setMatchId] = useState<string>('')
  const [publishedAt, setPublishedAt] = useState<string | null>(null)

  const [matches, setMatches] = useState<Match[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(!isNew)

  useEffect(() => {
    supabase
      .from('matches')
      .select('id, match_date, status, opponent:opponents(canonical_name)')
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
      .then(({ data }) => setMatches((data ?? []) as unknown as Match[]))
  }, [])

  useEffect(() => {
    if (isNew) return
    supabase
      .from('articles')
      .select('*')
      .eq('id', params.id as string)
      .single()
      .then(({ data }) => {
        if (data) {
          setTitle(data.title)
          setSlug(data.slug)
          setSlugEdited(true)
          setContent(data.content)
          setExcerpt(data.excerpt ?? '')
          setMatchId(data.match_id ?? '')
          setPublishedAt(data.published_at ?? null)
        }
        setLoading(false)
      })
  }, [params.id, isNew])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  const generateReport = useCallback(async () => {
    if (!matchId) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/match-report/${matchId}`, { method: 'POST' })
      const json = await res.json()
      if (json.report) {
        setContent(json.report)
        setSaveMsg('Report generated — review and edit before publishing.')
      } else {
        setSaveMsg('Could not generate report: ' + (json.error ?? 'Unknown error'))
      }
    } catch {
      setSaveMsg('Generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [matchId])

  const save = async (publish: boolean) => {
    setSaving(true)
    setSaveMsg('')
    const now = new Date().toISOString()
    const payload = {
      title: title.trim(),
      slug: slug.trim() || slugify(title.trim()),
      content,
      excerpt: excerpt.trim() || null,
      match_id: matchId || null,
      published_at: publish ? (publishedAt ?? now) : null,
      updated_at: now,
    }
    if (isNew) {
      const { data, error } = await supabase.from('articles').insert(payload).select('id').single()
      if (error) { setSaveMsg('Error: ' + error.message); setSaving(false); return }
      router.replace(`/admin/news/${data.id}`)
    } else {
      const { error } = await supabase.from('articles').update(payload).eq('id', params.id as string)
      if (error) { setSaveMsg('Error: ' + error.message); setSaving(false); return }
      setPublishedAt(publish ? (publishedAt ?? now) : null)
    }
    setSaveMsg(publish ? 'Published!' : 'Draft saved.')
    setSaving(false)
  }

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>

  return (
    <>
      <style>{`
        .article-editor { padding-top: calc(var(--nav-h) + 32px); padding-bottom: 80px; }
        .editor-header {
          display: flex; align-items: center; justify-content: space-between;
          margin-bottom: 28px; flex-wrap: wrap; gap: 12px;
        }
        .editor-title-h {
          font-family: 'Syne', sans-serif;
          font-size: 24px; font-weight: 800; color: #f0f8ff; letter-spacing: -0.02em;
        }
        .editor-actions { display: flex; gap: 10px; }
        .field { margin-bottom: 20px; }
        .field label {
          display: block;
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: rgba(147,197,253,0.5);
          margin-bottom: 7px;
        }
        .field input, .field select, .field textarea {
          width: 100%; box-sizing: border-box;
          background: rgba(10,22,40,0.6);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 8px;
          padding: 10px 14px;
          color: #e2eeff;
          font-family: 'Outfit', sans-serif; font-size: 14px;
          outline: none; transition: border-color 0.15s;
        }
        .field input:focus, .field select:focus, .field textarea:focus {
          border-color: rgba(59,130,246,0.5);
        }
        .field textarea { min-height: 360px; resize: vertical; font-size: 13px; line-height: 1.7; }
        .field select option { background: #050c1a; }
        .match-row {
          display: flex; gap: 10px; align-items: flex-end;
        }
        .match-row .field { flex: 1; margin-bottom: 0; }
        .generate-btn {
          flex-shrink: 0;
          font-family: 'Outfit', sans-serif;
          font-size: 12px; font-weight: 700;
          padding: 10px 16px; border-radius: 8px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.3);
          color: #38bdf8; cursor: pointer;
          transition: all 0.15s; white-space: nowrap;
        }
        .generate-btn:hover:not(:disabled) { background: rgba(56,189,248,0.2); }
        .generate-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .save-msg {
          font-family: 'Outfit', sans-serif; font-size: 12px;
          color: rgba(147,197,253,0.6); margin-top: 12px;
        }
        .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 600px) { .two-col { grid-template-columns: 1fr; } .match-row { flex-direction: column; } }
      `}</style>

      <div className="article-editor">
        <div className="container" style={{ maxWidth: 820 }}>
          <div className="editor-header">
            <div className="editor-title-h">{isNew ? 'New Article' : 'Edit Article'}</div>
            <div className="editor-actions">
              <button className="btn btn-outline" onClick={() => save(false)} disabled={saving}>
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
              <button className="btn btn-primary" onClick={() => save(true)} disabled={saving}>
                {publishedAt ? 'Update' : 'Publish'}
              </button>
            </div>
          </div>

          <div className="field">
            <label>Title</label>
            <input
              value={title}
              onChange={e => handleTitleChange(e.target.value)}
              placeholder="Article title…"
            />
          </div>

          <div className="two-col">
            <div className="field">
              <label>Slug</label>
              <input
                value={slug}
                onChange={e => { setSlug(e.target.value); setSlugEdited(true) }}
                placeholder="url-friendly-slug"
              />
            </div>
            <div className="field">
              <label>Excerpt (optional)</label>
              <input
                value={excerpt}
                onChange={e => setExcerpt(e.target.value)}
                placeholder="Short preview text…"
              />
            </div>
          </div>

          <div className="match-row">
            <div className="field">
              <label>Linked Match (optional)</label>
              <select value={matchId} onChange={e => setMatchId(e.target.value)}>
                <option value="">— No match linked —</option>
                {matches.map(m => (
                  <option key={m.id} value={m.id}>
                    {new Date(m.match_date).toLocaleDateString('en-ZA')} · BCC vs {m.opponent?.canonical_name ?? '?'}
                  </option>
                ))}
              </select>
            </div>
            <button
              className="generate-btn"
              disabled={!matchId || generating}
              onClick={generateReport}
            >
              {generating ? 'Generating…' : '⚡ Generate Report'}
            </button>
          </div>

          <div className="field" style={{ marginTop: 20 }}>
            <label>Content (Markdown)</label>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Write your article here… or click Generate Report above."
            />
          </div>

          {saveMsg && <div className="save-msg">{saveMsg}</div>}
        </div>
      </div>
    </>
  )
}
