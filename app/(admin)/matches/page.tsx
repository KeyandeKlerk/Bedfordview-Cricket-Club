'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

interface Match {
  id: string
  match_date: string
  status: string
  our_team_side: string
  result_text: string | null
  opponent: { canonical_name: string } | null
  competition: { name: string; overs_per_innings: number } | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  upcoming: 'Upcoming',
  in_progress: 'Live',
  completed: 'Completed',
  abandoned: 'Abandoned',
  cancelled: 'Cancelled',
}

const STATUS_CLASS: Record<string, string> = {
  upcoming: 'badge-muted',
  in_progress: 'badge-red',
  completed: 'badge-blue',
  abandoned: 'badge-gold',
  cancelled: 'badge-muted',
}

const STATUS_ORDER = ['in_progress', 'upcoming', 'completed', 'abandoned', 'cancelled']

// Skeleton placeholder for loading state
function MatchSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '16px 18px',
      marginBottom: 8,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <div style={{ height: 14, width: '55%', background: 'rgba(59,130,246,0.07)', borderRadius: 4 }} />
      <div style={{ height: 12, width: '35%', background: 'rgba(59,130,246,0.05)', borderRadius: 4 }} />
      <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
        <div style={{ height: 34, width: 64, background: 'rgba(59,130,246,0.05)', borderRadius: 7 }} />
        <div style={{ height: 34, width: 56, background: 'rgba(59,130,246,0.05)', borderRadius: 7 }} />
        <div style={{ height: 34, width: 60, background: 'rgba(59,130,246,0.05)', borderRadius: 7 }} />
      </div>
    </div>
  )
}

export default function AdminMatchesPage() {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    supabase
      .from('matches')
      .select('*, opponent:opponents(canonical_name), competition:competitions(name, overs_per_innings)')
      .order('match_date', { ascending: false })
      .then(({ data }) => {
        if (data) setMatches(data as Match[])
        setLoading(false)
      })
  }, [])

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    setError(null)
    const { error } = await supabase.from('matches').delete().eq('id', deleteTarget.id)
    setDeleting(false)
    if (error) { setError(error.message); setDeleteTarget(null); return }
    setMatches(prev => prev.filter(m => m.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const filteredMatches = filter === 'all'
    ? matches
    : matches.filter(m => m.status === filter)

  // Group matches by status for the "all" view
  const grouped = STATUS_ORDER.reduce<Record<string, Match[]>>((acc, s) => {
    const items = filteredMatches.filter(m => m.status === s)
    if (items.length > 0) acc[s] = items
    return acc
  }, {})

  const statusCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = matches.filter(m => m.status === s).length
    return acc
  }, {})

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        .am-hero {
          position: relative;
          padding: 36px 0 32px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
        }
        .am-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .am-hero-inner {
          position: relative; z-index: 1;
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .am-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .am-eyebrow::before {
          content: '';
          display: inline-block;
          width: 18px; height: 1px; background: var(--sky);
        }
        .am-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 44px);
          font-weight: 800; line-height: 1.05;
          color: var(--text); letter-spacing: -0.02em;
        }

        /* ── FILTER TABS ── */
        .am-filters {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .am-filter-btn {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 8px 14px; border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.06em;
          cursor: pointer; transition: all 0.15s;
          min-height: 36px;
        }
        .am-filter-btn:hover {
          border-color: rgba(59,130,246,0.3);
          color: var(--text);
          background: rgba(37,99,235,0.06);
        }
        .am-filter-btn.active {
          border-color: rgba(59,130,246,0.5);
          background: rgba(37,99,235,0.14);
          color: #93c5fd;
        }
        .am-filter-count {
          display: inline-flex; align-items: center; justify-content: center;
          width: 18px; height: 18px; border-radius: 50%;
          background: rgba(59,130,246,0.2);
          font-size: 9px; font-weight: 800; color: #60a5fa;
        }

        /* ── MATCH CARD ── */
        .am-match-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 12px;
          margin-bottom: 8px;
          overflow: hidden;
          transition: border-color 0.18s, background 0.18s;
          position: relative;
        }
        .am-match-card.live {
          border-color: rgba(239,68,68,0.3);
          background: rgba(239,68,68,0.03);
        }
        .am-match-card.live::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #ef4444, #f97316, transparent);
        }
        .am-match-card:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(37,99,235,0.04);
        }
        .am-card-main {
          padding: 14px 16px 10px;
          display: flex; align-items: flex-start; gap: 12px;
        }
        .am-card-date-block {
          flex-shrink: 0;
          text-align: center;
          padding: 8px 12px; border-radius: 8px;
          background: rgba(37,99,235,0.1);
          border: 1px solid rgba(59,130,246,0.18);
          min-width: 52px;
        }
        .am-card-day {
          font-family: var(--font-display);
          font-size: 20px; font-weight: 800; line-height: 1;
          color: #93c5fd;
        }
        .am-card-month {
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--muted); margin-top: 2px;
        }
        .am-card-info { flex: 1; min-width: 0; }
        .am-card-vs {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em;
          margin-bottom: 5px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .am-card-meta {
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
          font-size: 12px; color: var(--muted);
        }
        .am-card-meta-sep { width: 2px; height: 2px; border-radius: 50%; background: currentColor; opacity: 0.4; }
        .am-card-status { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

        /* ── CARD ACTIONS ── */
        .am-card-actions {
          display: flex;
          gap: 6px;
          padding: 0 16px 14px;
          flex-wrap: wrap;
        }
        .am-action-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 14px; border-radius: 8px;
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.03em;
          cursor: pointer; transition: all 0.15s;
          text-decoration: none;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          min-height: 36px;
        }
        .am-action-btn:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(37,99,235,0.08);
          color: var(--text);
        }
        .am-action-btn.score {
          background: rgba(37,99,235,0.14);
          border-color: rgba(59,130,246,0.35);
          color: #93c5fd;
        }
        .am-action-btn.score:hover {
          background: rgba(37,99,235,0.25);
          border-color: rgba(96,165,250,0.5);
        }
        .am-action-btn.danger {
          color: rgba(252,165,165,0.7);
          border-color: rgba(239,68,68,0.15);
        }
        .am-action-btn.danger:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
          color: #fca5a5;
        }

        /* ── GROUP HEADER ── */
        .am-group-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 10px;
          margin-top: 20px;
        }
        .am-group-header:first-child { margin-top: 0; }
        .am-group-label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--muted); white-space: nowrap;
        }
        .am-group-line { flex: 1; height: 1px; background: var(--border); }

        /* ── EMPTY STATE ── */
        .am-empty {
          text-align: center; padding: 48px 24px;
          color: rgba(147,197,253,0.35); font-size: 14px;
          border: 1px dashed rgba(59,130,246,0.14);
          border-radius: 12px; line-height: 1.8;
        }
        .am-empty-icon {
          font-size: 32px; margin-bottom: 12px; display: block; opacity: 0.4;
        }

        /* ── ERROR BANNER ── */
        .am-error {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.28);
          color: #fca5a5;
          padding: 12px 16px; border-radius: 8px;
          font-size: 13px; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }

        /* ── DELETE MODAL ── */
        .am-modal-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(5,12,26,0.85);
          display: flex; align-items: center; justify-content: center;
          padding: 20px;
          backdrop-filter: blur(4px);
        }
        .am-modal {
          background: var(--panel);
          border: 1px solid rgba(239,68,68,0.3);
          border-radius: 16px;
          padding: 28px 24px;
          max-width: 400px; width: 100%;
          position: relative;
        }
        .am-modal::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #ef4444, transparent);
          border-radius: 16px 16px 0 0;
        }
        .am-modal-icon {
          font-size: 28px; margin-bottom: 14px; display: block;
        }
        .am-modal-title {
          font-family: var(--font-display);
          font-size: 18px; font-weight: 800;
          color: var(--text); margin-bottom: 8px;
          letter-spacing: -0.01em;
        }
        .am-modal-body {
          font-size: 13px; color: var(--muted);
          line-height: 1.6; margin-bottom: 8px;
        }
        .am-modal-warning {
          font-size: 12px; color: rgba(252,165,165,0.7);
          background: rgba(239,68,68,0.07);
          border: 1px solid rgba(239,68,68,0.18);
          border-radius: 7px; padding: 9px 12px;
          margin-bottom: 22px; line-height: 1.5;
        }
        .am-modal-actions { display: flex; gap: 10px; }
        .am-modal-cancel {
          flex: 1; padding: 12px; border-radius: 9px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--muted); cursor: pointer;
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          transition: all 0.15s; min-height: 44px;
        }
        .am-modal-cancel:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .am-modal-confirm {
          flex: 1; padding: 12px; border-radius: 9px;
          background: rgba(239,68,68,0.15);
          border: 1px solid rgba(239,68,68,0.35);
          color: #fca5a5; cursor: pointer;
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          transition: all 0.15s; min-height: 44px;
        }
        .am-modal-confirm:hover:not(:disabled) {
          background: rgba(239,68,68,0.25);
          border-color: rgba(239,68,68,0.55);
          color: #fff;
        }
        .am-modal-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

        .am-home-badge {
          display: inline-flex; align-items: center;
          padding: 1px 7px; border-radius: 4px;
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
        }
        .am-home-badge.home {
          background: rgba(37,99,235,0.15);
          border: 1px solid rgba(59,130,246,0.22);
          color: #60a5fa;
        }
        .am-home-badge.away {
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          color: var(--muted);
        }
        .am-mobile-date { display: none; font-size: 11px; color: var(--muted); }
        @media (max-width: 480px) {
          .am-card-date-block { display: none; }
          .am-mobile-date { display: inline; }
          .am-card-vs { font-size: 14px; }
          .am-filter-btn { padding: 7px 10px; font-size: 10px; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="am-hero">
        <div className="container">
          <div className="am-hero-inner">
            <div>
              <div className="am-eyebrow">Admin</div>
              <div className="am-title">Matches</div>
            </div>
            <Link href="/admin/matches/new" className="btn btn-primary">
              + New Match
            </Link>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 24 }}>

        {error && (
          <div className="am-error">
            <span>⚠</span>
            {error}
          </div>
        )}

        {/* ── FILTER TABS ── */}
        <div className="am-filters">
          <button
            className={`am-filter-btn${filter === 'all' ? ' active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All
            <span className="am-filter-count">{matches.length}</span>
          </button>
          {STATUS_ORDER.map(s => {
            const count = statusCounts[s] ?? 0
            if (count === 0) return null
            return (
              <button
                key={s}
                className={`am-filter-btn${filter === s ? ' active' : ''}`}
                onClick={() => setFilter(s)}
              >
                {STATUS_LABEL[s]}
                <span className="am-filter-count">{count}</span>
              </button>
            )
          })}
        </div>

        {/* ── MATCH LIST ── */}
        {loading ? (
          <>
            <MatchSkeleton />
            <MatchSkeleton />
            <MatchSkeleton />
          </>
        ) : filteredMatches.length === 0 ? (
          <div className="am-empty">
            <span className="am-empty-icon">🏏</span>
            {filter === 'all' ? (
              <>No matches recorded yet.<br />
                <Link href="/admin/matches/new" style={{ color: 'var(--blue-mid)', fontWeight: 600 }}>
                  Create your first fixture →
                </Link>
              </>
            ) : (
              <>No {STATUS_LABEL[filter]?.toLowerCase()} matches.</>
            )}
          </div>
        ) : filter !== 'all' ? (
          /* Flat list when filtering by a single status */
          filteredMatches.map(m => <MatchCard key={m.id} m={m} onDelete={setDeleteTarget} />)
        ) : (
          /* Grouped list when showing all */
          Object.entries(grouped).map(([status, items]) => (
            <div key={status}>
              <div className="am-group-header">
                <span className="am-group-label">{STATUS_LABEL[status]}</span>
                <div className="am-group-line" />
                <span className={`badge ${STATUS_CLASS[status]}`}>{items.length}</span>
              </div>
              {items.map(m => <MatchCard key={m.id} m={m} onDelete={setDeleteTarget} />)}
            </div>
          ))
        )}
      </div>

      {/* ── DELETE MODAL ── */}
      {deleteTarget && (
        <div className="am-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setDeleteTarget(null) }}>
          <div className="am-modal">
            <span className="am-modal-icon">🗑</span>
            <div className="am-modal-title">Delete match?</div>
            <div className="am-modal-body">
              You are about to delete the match against{' '}
              <strong style={{ color: 'var(--text)' }}>
                {deleteTarget.opponent?.canonical_name ?? 'Unknown'}
              </strong>{' '}
              on {formatDate(deleteTarget.match_date)}.
            </div>
            <div className="am-modal-warning">
              This will permanently remove all innings, ball events, and scoring data. This cannot be undone.
            </div>
            <div className="am-modal-actions">
              <button className="am-modal-cancel" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                className="am-modal-confirm"
                onClick={confirmDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting...' : 'Yes, delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MatchCard({ m, onDelete }: { m: Match; onDelete: (m: Match) => void }) {
  const label = m.opponent?.canonical_name ?? 'Unknown'
  const date = new Date(m.match_date)
  const day = date.toLocaleDateString('en-ZA', { day: 'numeric' })
  const month = date.toLocaleDateString('en-ZA', { month: 'short' })
  const isLive = m.status === 'in_progress'
  const isScoreable = m.status === 'upcoming' || m.status === 'in_progress'

  return (
    <div className={`am-match-card${isLive ? ' live' : ''}`}>
      <div className="am-card-main">
        <div className="am-card-date-block">
          <div className="am-card-day">{day}</div>
          <div className="am-card-month">{month}</div>
        </div>
        <div className="am-card-info">
          <div className="am-card-vs">BCC vs {label}</div>
          <div className="am-card-meta">
            <span className="am-mobile-date">{formatDate(m.match_date)}</span>
            <span className={`am-home-badge ${m.our_team_side === 'home' ? 'home' : 'away'}`}>
              {m.our_team_side === 'home' ? 'Home' : 'Away'}
            </span>
            <span className="am-card-meta-sep" />
            {m.competition?.name ?? 'Friendly'}
            {m.competition?.overs_per_innings && (
              <>
                <span className="am-card-meta-sep" />
                {m.competition.overs_per_innings} overs
              </>
            )}
            {m.result_text && (
              <>
                <span className="am-card-meta-sep" />
                <span style={{ color: 'var(--sky)', fontWeight: 600 }}>{m.result_text}</span>
              </>
            )}
          </div>
        </div>
        <div className="am-card-status">
          {isLive && (
            <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 8px rgba(239,68,68,0.8)', animation: 'blink 1.2s ease-in-out infinite' }} />
          )}
          <span className={`badge ${STATUS_CLASS[m.status] ?? 'badge-muted'}`}>
            {STATUS_LABEL[m.status] ?? m.status}
          </span>
        </div>
      </div>

      <div className="am-card-actions">
        {isScoreable && (
          <Link href={`/admin/matches/${m.id}/score`} className="am-action-btn score">
            {isLive ? '● Score' : 'Score'}
          </Link>
        )}
        <Link href={`/matches/${m.id}`} className="am-action-btn">
          View
        </Link>
        <button
          className="am-action-btn danger"
          onClick={() => onDelete(m)}
          style={{ marginLeft: 'auto' }}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
