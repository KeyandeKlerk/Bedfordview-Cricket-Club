'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface Season {
  id: string
  name: string
  is_active: boolean
}

interface AvailabilityWindow {
  id: string
  season_id: string
  title: string
  window_start: string
  window_end: string
  deadline: string
  created_at: string
  season: { name: string } | null
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start)
  const e = new Date(end)
  const sDay = s.toLocaleDateString('en-ZA', { day: 'numeric' })
  const eDay = e.toLocaleDateString('en-ZA', { day: 'numeric' })
  const sMon = s.toLocaleDateString('en-ZA', { month: 'short' })
  const eMon = e.toLocaleDateString('en-ZA', { month: 'short' })
  if (sMon === eMon) return `${sDay}–${eDay} ${sMon}`
  return `${sDay} ${sMon} – ${eDay} ${eMon}`
}

function formatDeadline(dt: string): string {
  const d = new Date(dt)
  return d.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function isOpen(deadline: string): boolean {
  return new Date(deadline) > new Date()
}

function WindowSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 10,
    }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ height: 15, width: '50%', background: 'rgba(59,130,246,0.07)', borderRadius: 4 }} />
        <div style={{ height: 12, width: '35%', background: 'rgba(59,130,246,0.05)', borderRadius: 4 }} />
        <div style={{ height: 12, width: '45%', background: 'rgba(59,130,246,0.04)', borderRadius: 4 }} />
        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <div style={{ height: 36, width: 130, background: 'rgba(59,130,246,0.06)', borderRadius: 8 }} />
          <div style={{ height: 36, width: 100, background: 'rgba(59,130,246,0.04)', borderRadius: 8 }} />
        </div>
      </div>
    </div>
  )
}

const EMPTY_FORM = {
  title: '',
  season_id: '',
  window_start: '',
  window_end: '',
  deadline: '',
}

export default function AvailabilityWindowsPage() {
  const [windows, setWindows] = useState<AvailabilityWindow[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [windowsRes, seasonsRes] = await Promise.all([
        supabase
          .from('availability_windows')
          .select('*, season:seasons(name)')
          .order('window_start', { ascending: false }),
        supabase
          .from('seasons')
          .select('id, name, is_active')
          .order('start_date', { ascending: false }),
      ])
      if (windowsRes.data) setWindows(windowsRes.data as AvailabilityWindow[])
      if (seasonsRes.data) {
        setSeasons(seasonsRes.data)
        // Pre-select active season in the form
        const active = seasonsRes.data.find(s => s.is_active)
        if (active) setForm(f => ({ ...f, season_id: active.id }))
      }
      setLoading(false)
    }
    load()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    if (!form.title.trim() || !form.season_id || !form.window_start || !form.window_end || !form.deadline) {
      setFormError('All fields are required.')
      return
    }
    if (new Date(form.window_end) < new Date(form.window_start)) {
      setFormError('End date must be on or after start date.')
      return
    }
    if (new Date(form.deadline) > new Date(form.window_end + 'T23:59:59')) {
      setFormError('Deadline must be before the end of the window.')
      return
    }
    setSaving(true)
    const { data, error } = await supabase
      .from('availability_windows')
      .insert({
        title: form.title.trim(),
        season_id: form.season_id,
        window_start: form.window_start,
        window_end: form.window_end,
        deadline: form.deadline,
      })
      .select('*, season:seasons(name)')
      .single()
    setSaving(false)
    if (error) { setFormError(error.message); return }
    setWindows(prev => [data as AvailabilityWindow, ...prev])
    setForm(f => ({ ...EMPTY_FORM, season_id: f.season_id }))
    setShowForm(false)
  }

  const now = new Date()
  const activeWindows = windows.filter(w => new Date(w.deadline) > now)
  const pastWindows   = windows.filter(w => new Date(w.deadline) <= now)

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        /* ── HERO ── */
        .av-hero {
          position: relative;
          padding: 36px 0 32px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
        }
        .av-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .av-hero-inner {
          position: relative; z-index: 1;
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .av-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .av-eyebrow::before {
          content: '';
          display: inline-block;
          width: 18px; height: 1px; background: var(--sky);
        }
        .av-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 44px);
          font-weight: 800; line-height: 1.05;
          color: var(--text); letter-spacing: -0.02em;
        }

        /* ── CREATE FORM PANEL ── */
        .av-form-panel {
          background: rgba(6,15,34,0.95);
          border: 1px solid rgba(59,130,246,0.22);
          border-radius: 14px;
          padding: 24px 20px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .av-form-panel::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, var(--blue), var(--sky), transparent);
        }
        .av-form-title {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 800;
          letter-spacing: 0.04em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 18px;
        }
        .av-form-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          margin-bottom: 16px;
        }
        @media (min-width: 600px) {
          .av-form-grid { grid-template-columns: 1fr 1fr; }
          .av-form-title-field { grid-column: 1 / -1; }
        }
        .av-form-actions {
          display: flex; gap: 10px; flex-wrap: wrap;
        }
        .av-form-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.28);
          color: #fca5a5;
          padding: 10px 14px; border-radius: 8px;
          font-size: 13px; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }

        /* ── GROUP HEADER ── */
        .av-group-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 12px; margin-top: 24px;
        }
        .av-group-header:first-child { margin-top: 0; }
        .av-group-label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--muted); white-space: nowrap;
        }
        .av-group-line { flex: 1; height: 1px; background: var(--border); }

        /* ── WINDOW CARD ── */
        .av-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px 18px 14px;
          margin-bottom: 10px;
          transition: border-color 0.18s, background 0.18s;
          position: relative;
        }
        .av-card.open {
          border-color: rgba(34,197,94,0.2);
          background: rgba(34,197,94,0.02);
        }
        .av-card.open::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, rgba(34,197,94,0.5), rgba(56,189,248,0.3), transparent);
          border-radius: 12px 12px 0 0;
        }
        .av-card:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(37,99,235,0.03);
        }
        .av-card-header {
          display: flex; align-items: flex-start;
          justify-content: space-between; gap: 12px;
          margin-bottom: 10px; flex-wrap: wrap;
        }
        .av-card-title {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em;
          line-height: 1.2;
        }
        .av-card-badges {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          flex-shrink: 0;
        }
        .av-card-meta {
          display: flex; flex-direction: column; gap: 5px;
          font-size: 13px; color: var(--muted); margin-bottom: 14px;
        }
        .av-card-meta-row {
          display: flex; align-items: center; gap: 8px;
        }
        .av-card-meta-icon {
          font-size: 12px; opacity: 0.6; flex-shrink: 0;
          width: 16px; text-align: center;
        }
        .av-card-actions {
          display: flex; gap: 8px; flex-wrap: wrap;
        }

        /* status badges */
        .badge-green {
          background: rgba(34,197,94,0.12);
          color: #86efac;
          border: 1px solid rgba(34,197,94,0.3);
        }

        /* ── EMPTY STATE ── */
        .av-empty {
          text-align: center; padding: 48px 24px;
          color: rgba(147,197,253,0.35); font-size: 14px;
          border: 1px dashed rgba(59,130,246,0.14);
          border-radius: 12px; line-height: 1.8;
        }

        /* ── ERROR BANNER ── */
        .av-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.28);
          color: #fca5a5;
          padding: 12px 16px; border-radius: 8px;
          font-size: 13px; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }

        /* ── MOBILE ── */
        @media (max-width: 480px) {
          .av-card-title { font-size: 15px; }
          .av-card-actions { flex-direction: column; }
          .av-card-actions a, .av-card-actions button { justify-content: center; }
          .av-form-actions { flex-direction: column; }
          .av-form-actions .btn { justify-content: center; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="av-hero">
        <div className="container">
          <div className="av-hero-inner">
            <div>
              <div className="av-eyebrow">Admin</div>
              <div className="av-title">Availability Windows</div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { setShowForm(s => !s); setFormError(null) }}
            >
              {showForm ? '✕ Cancel' : '+ New Window'}
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 28 }}>

        {error && (
          <div className="av-error">
            <span>&#9888;</span>
            {error}
          </div>
        )}

        {/* ── CREATE FORM ── */}
        {showForm && (
          <div className="av-form-panel">
            <div className="av-form-title">New Availability Window</div>
            {formError && (
              <div className="av-form-error">
                <span>&#9888;</span>
                {formError}
              </div>
            )}
            <form onSubmit={handleCreate} noValidate>
              <div className="av-form-grid">
                <div className="field av-form-title-field">
                  <label htmlFor="av-title">Title</label>
                  <input
                    id="av-title"
                    className="input"
                    type="text"
                    placeholder="e.g. Weekend 12–13 Apr"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="av-season">Season</label>
                  <select
                    id="av-season"
                    className="input select"
                    value={form.season_id}
                    onChange={e => setForm(f => ({ ...f, season_id: e.target.value }))}
                    required
                  >
                    <option value="">Select season…</option>
                    {seasons.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name}{s.is_active ? ' (active)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="av-start">Window Start</label>
                  <input
                    id="av-start"
                    className="input"
                    type="date"
                    value={form.window_start}
                    onChange={e => setForm(f => ({ ...f, window_start: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="av-end">Window End</label>
                  <input
                    id="av-end"
                    className="input"
                    type="date"
                    value={form.window_end}
                    onChange={e => setForm(f => ({ ...f, window_end: e.target.value }))}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="av-deadline">Response Deadline</label>
                  <input
                    id="av-deadline"
                    className="input"
                    type="datetime-local"
                    value={form.deadline}
                    onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))}
                    required
                  />
                </div>
              </div>
              <div className="av-form-actions">
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={saving}
                >
                  {saving ? 'Saving…' : 'Create Window'}
                </button>
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => { setShowForm(false); setFormError(null) }}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── WINDOW LIST ── */}
        {loading ? (
          <>
            <WindowSkeleton />
            <WindowSkeleton />
            <WindowSkeleton />
          </>
        ) : windows.length === 0 ? (
          <div className="av-empty">
            No availability windows yet.<br />
            <button
              onClick={() => setShowForm(true)}
              style={{ color: 'var(--blue-mid)', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit' }}
            >
              Create your first window &rarr;
            </button>
          </div>
        ) : (
          <>
            {activeWindows.length > 0 && (
              <>
                <div className="av-group-header">
                  <span className="av-group-label">Open</span>
                  <div className="av-group-line" />
                  <span className="badge badge-green">{activeWindows.length}</span>
                </div>
                {activeWindows.map(w => (
                  <WindowCard key={w.id} window={w} />
                ))}
              </>
            )}
            {pastWindows.length > 0 && (
              <>
                <div className="av-group-header" style={{ marginTop: activeWindows.length > 0 ? 28 : 0 }}>
                  <span className="av-group-label">Closed</span>
                  <div className="av-group-line" />
                  <span className="badge badge-muted">{pastWindows.length}</span>
                </div>
                {pastWindows.map(w => (
                  <WindowCard key={w.id} window={w} />
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function WindowCard({ window: w }: { window: AvailabilityWindow }) {
  const open = isOpen(w.deadline)
  return (
    <div className={`av-card${open ? ' open' : ''}`}>
      <div className="av-card-header">
        <div className="av-card-title">{w.title}</div>
        <div className="av-card-badges">
          {w.season && (
            <span className="badge badge-blue">{w.season.name}</span>
          )}
          <span className={`badge ${open ? 'badge-green' : 'badge-muted'}`}>
            {open ? 'Open' : 'Closed'}
          </span>
        </div>
      </div>
      <div className="av-card-meta">
        <div className="av-card-meta-row">
          <span className="av-card-meta-icon">&#128197;</span>
          <span>{formatDateRange(w.window_start, w.window_end)}</span>
        </div>
        <div className="av-card-meta-row">
          <span className="av-card-meta-icon">&#9201;</span>
          <span style={{ color: open ? 'rgba(147,197,253,0.75)' : 'rgba(147,197,253,0.4)' }}>
            {open ? 'Closes' : 'Closed'} {formatDeadline(w.deadline)}
          </span>
        </div>
      </div>
      <div className="av-card-actions">
        <Link
          href={`/admin/availability/${w.id}`}
          className="btn btn-primary"
          style={{ fontSize: 13, padding: '10px 18px', minHeight: 40 }}
        >
          View Responses &rarr;
        </Link>
        <Link
          href={`/admin/availability/${w.id}`}
          className="btn btn-ghost"
          style={{ fontSize: 13, padding: '10px 18px', minHeight: 40 }}
        >
          Select XI &rarr;
        </Link>
      </div>
    </div>
  )
}
