'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import ArticleEditor from '@/components/admin/ArticleEditor'
import { sanitizeArticleHtml } from '@/lib/content/sanitize'
import { resizeImageFile } from '@/lib/images/resize'
import { uploadNewsImage } from '@/lib/supabase/storage'
import { ARTICLE_CATEGORIES } from '@/lib/content/categories'
import ArticlePreviewModal from '@/components/admin/ArticlePreviewModal'

type Match = { id: string; match_date: string; opponent: { canonical_name: string } | null; status: string }

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// Formats a Date into the `YYYY-MM-DDTHH:mm` string a `datetime-local` input
// expects, in the browser's local timezone (not UTC).
function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Converts plain text (paragraphs separated by blank lines, as produced by
// lib/cricket/reportGenerator.ts) into simple paragraph HTML so it survives
// being loaded into the Tiptap-based ArticleEditor, which parses its `value`
// prop as HTML. Without this, bare text collapses into one run-on paragraph.
export function reportTextToHtml(text: string): string {
  return text
    .split(/\n\n+/)
    .filter(p => p.trim())
    .map(p => `<p>${p.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`)
    .join('')
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
  const [featuredImageUrl, setFeaturedImageUrl] = useState<string | null>(null)
  const [featuredImageAlt, setFeaturedImageAlt] = useState('')
  const [uploadingFeatured, setUploadingFeatured] = useState(false)
  const [category, setCategory] = useState('general')
  const [metaDescription, setMetaDescription] = useState('')
  const [scheduleAt, setScheduleAt] = useState('')
  const [showScheduler, setShowScheduler] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  const [matches, setMatches] = useState<Match[]>([])
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [loading, setLoading] = useState(!isNew)
  const [userId, setUserId] = useState<string>('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? ''))
  }, [])

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
          setFeaturedImageUrl(data.featured_image_url ?? null)
          setFeaturedImageAlt(data.featured_image_alt ?? '')
          setCategory(data.category ?? 'general')
          setMetaDescription(data.meta_description ?? '')
        }
        setLoading(false)
      })
  }, [params.id, isNew])

  const handleTitleChange = (v: string) => {
    setTitle(v)
    if (!slugEdited) setSlug(slugify(v))
  }

  const onPickFeaturedImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !userId) return
    setUploadingFeatured(true)
    try {
      const blob = await resizeImageFile(file)
      const { url, error } = await uploadNewsImage(supabase, blob, userId, 'jpg')
      if (error || !url) { setSaveMsg(`Featured image upload failed: ${error}`); return }
      setFeaturedImageUrl(url)
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : 'Featured image processing failed.')
    } finally {
      setUploadingFeatured(false)
    }
  }

  const generateReport = useCallback(async () => {
    if (!matchId) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/match-report/${matchId}`, { method: 'POST' })
      const json = await res.json()
      if (json.report) {
        setContent(reportTextToHtml(json.report))
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

  const save = async (mode: 'draft' | 'publish' | 'schedule') => {
    setSaving(true)
    setSaveMsg('')
    // Defense-in-depth: the "Confirm Schedule" button's disabled state is computed
    // at render time and can go stale if the popover sits open past the chosen
    // time with no re-render. Re-check right before writing to the DB.
    if (mode === 'schedule' && !(scheduleAt && new Date(scheduleAt) > new Date())) {
      setSaveMsg('That time has already passed — pick a new time and try again.')
      setSaving(false)
      return
    }
    const now = new Date().toISOString()
    const nextPublishedAt =
      mode === 'draft' ? null :
      mode === 'publish' ? now :
      scheduleAt ? new Date(scheduleAt).toISOString() : null
    const payload = {
      title: title.trim(),
      slug: slug.trim() || slugify(title.trim()),
      content: sanitizeArticleHtml(content),
      excerpt: excerpt.trim() || null,
      match_id: matchId || null,
      featured_image_url: featuredImageUrl,
      featured_image_alt: featuredImageAlt.trim() || null,
      category,
      meta_description: metaDescription.trim() || null,
      published_at: nextPublishedAt,
      updated_at: now,
    }
    if (isNew) {
      const { data, error } = await supabase.from('articles').insert(payload).select('id').single()
      if (error) { setSaveMsg('Error: ' + error.message); setSaving(false); return }
      router.replace(`/admin/news/${data.id}`)
    } else {
      const { error } = await supabase.from('articles').update(payload).eq('id', params.id as string)
      if (error) { setSaveMsg('Error: ' + error.message); setSaving(false); return }
      setPublishedAt(nextPublishedAt)
    }
    setSaveMsg(mode === 'draft' ? 'Draft saved.' : mode === 'publish' ? 'Published!' : 'Scheduled!')
    setSaving(false)
    setShowScheduler(false)
    if (mode === 'schedule') setScheduleAt('')
  }

  const isScheduleInPast = !!scheduleAt && new Date(scheduleAt) <= new Date()

  if (loading) return <div style={{ padding: 80, textAlign: 'center', color: 'var(--muted)' }}>Loading…</div>

  return (
    <>
      <style>{`
        .article-editor { padding-top: calc(var(--nav-h) + 32px); padding-bottom: 80px; max-width: 100vw; overflow-x: hidden; }
        .editor-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          margin-bottom: 28px; flex-wrap: wrap; gap: 12px;
        }
        .editor-title-h {
          font-family: 'Syne', sans-serif;
          font-size: 24px; font-weight: 800; color: #f0f8ff; letter-spacing: -0.02em;
          min-width: 0; flex: 1;
        }
        .editor-actions { display: flex; gap: 10px; flex-shrink: 0; flex-wrap: wrap; }
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
              <button className="btn btn-outline" onClick={() => save('draft')} disabled={saving || uploadingFeatured}>
                {saving ? 'Saving…' : uploadingFeatured ? 'Uploading image…' : 'Save Draft'}
              </button>
              <button className="btn btn-outline" onClick={() => setShowPreview(true)} disabled={saving || uploadingFeatured}>
                Preview
              </button>
              <button
                className="btn btn-outline"
                onClick={() => {
                  const next = !showScheduler
                  setShowScheduler(next)
                  if (!next) setScheduleAt('')
                }}
                disabled={saving || uploadingFeatured}
              >
                Schedule…
              </button>
              <button className="btn btn-primary" onClick={() => save('publish')} disabled={saving || uploadingFeatured}>
                {saving ? 'Saving…' : uploadingFeatured ? 'Uploading image…' : (publishedAt ? 'Update & Publish Now' : 'Publish Now')}
              </button>
            </div>
          </div>

          {showScheduler && (
            <div className="field" style={{ maxWidth: 320 }}>
              <label>Publish at</label>
              <input
                type="datetime-local"
                value={scheduleAt}
                min={toDatetimeLocalValue(new Date())}
                onChange={e => setScheduleAt(e.target.value)}
              />
              {isScheduleInPast && (
                <div className="save-msg" style={{ color: '#f87171', marginTop: 6 }}>
                  Pick a time in the future.
                </div>
              )}
              <button
                className="btn btn-primary"
                style={{ marginTop: 10 }}
                disabled={!scheduleAt || saving || uploadingFeatured || isScheduleInPast}
                onClick={() => save('schedule')}
              >
                Confirm Schedule
              </button>
            </div>
          )}

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

          <div className="two-col" style={{ marginTop: 20 }}>
            <div className="field">
              <label>Category</label>
              <select value={category} onChange={e => setCategory(e.target.value)}>
                {ARTICLE_CATEGORIES.map(c => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Meta Description ({metaDescription.length}/155)</label>
              <input
                value={metaDescription}
                onChange={e => setMetaDescription(e.target.value.slice(0, 155))}
                placeholder="Short summary for search engines & link previews…"
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

          <div className="field">
            <label>Featured Image (optional)</label>
            {featuredImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={featuredImageUrl} alt={featuredImageAlt} style={{ maxWidth: 320, borderRadius: 8, marginBottom: 10, display: 'block' }} />
            )}
            <input type="file" accept="image/*" onChange={onPickFeaturedImage} disabled={uploadingFeatured} />
            {uploadingFeatured && <div className="save-msg">Uploading…</div>}
            {featuredImageUrl && (
              <input
                style={{ marginTop: 10 }}
                value={featuredImageAlt}
                onChange={e => setFeaturedImageAlt(e.target.value)}
                placeholder="Alt text (for accessibility & SEO)"
              />
            )}
          </div>

          <div className="field" style={{ marginTop: 20 }}>
            <label>Content</label>
            {userId && <ArticleEditor value={content} onChange={setContent} userId={userId} />}
          </div>

          {saveMsg && <div className="save-msg">{saveMsg}</div>}
        </div>
      </div>

      {showPreview && (
        <ArticlePreviewModal
          title={title}
          category={category}
          featuredImageUrl={featuredImageUrl}
          featuredImageAlt={featuredImageAlt}
          content={content}
          matchId={matchId}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
