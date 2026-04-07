'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────────────────────

interface AvailabilityWindow {
  id: string
  season_id: string
  title: string
  window_start: string
  window_end: string
  deadline: string
  season: { name: string } | null
}

interface PlayerRecord {
  id: string
  first_name: string
  last_name: string
  batting_style: string | null
  bowling_style: string | null
}

interface AvailabilityResponse {
  id: string
  window_id: string
  player_id: string
  status: 'available' | 'unavailable' | 'tentative'
  note: string | null
  submitted_at: string
  player: PlayerRecord | null
}

interface ActivePlayer {
  id: string
  first_name: string
  last_name: string
}

interface Match {
  id: string
  match_date: string
  competition: { name: string; category: string } | null
  opponent: { canonical_name: string } | null
}

type AvailStatus = 'available' | 'unavailable' | 'tentative' | 'no_response'

interface PlayerRow {
  player: ActivePlayer
  response: AvailabilityResponse | null
  status: AvailStatus
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  return new Date(dt).toLocaleDateString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function formatMatchDate(d: string): string {
  return new Date(d).toLocaleDateString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function formatSubmitted(dt: string): string {
  return new Date(dt).toLocaleDateString('en-ZA', {
    day: 'numeric', month: 'short',
    hour: '2-digit', minute: '2-digit', hour12: false,
  })
}

function getInitials(p: ActivePlayer) {
  return ((p.first_name[0] ?? '') + (p.last_name[0] ?? '')).toUpperCase()
}

function isOpen(deadline: string): boolean {
  return new Date(deadline) > new Date()
}

const STATUS_ORDER: AvailStatus[] = ['available', 'tentative', 'no_response', 'unavailable']

const STATUS_META: Record<AvailStatus, { label: string; badgeClass: string; avatarColor: string }> = {
  available:    { label: 'Available',    badgeClass: 'badge-green',   avatarColor: 'rgba(34,197,94,0.15)' },
  tentative:    { label: 'Tentative',    badgeClass: 'badge-gold',    avatarColor: 'rgba(245,158,11,0.15)' },
  no_response:  { label: 'No response',  badgeClass: 'badge-muted',   avatarColor: 'rgba(59,130,246,0.07)' },
  unavailable:  { label: 'Unavailable',  badgeClass: 'badge-red',     avatarColor: 'rgba(239,68,68,0.1)' },
}

// ── Skeleton components ───────────────────────────────────────────────────────

function PlayerRowSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ width: 38, height: 38, borderRadius: 10, background: 'rgba(59,130,246,0.07)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 13, width: '38%', background: 'rgba(59,130,246,0.06)', borderRadius: 4 }} />
        <div style={{ height: 11, width: '55%', background: 'rgba(59,130,246,0.04)', borderRadius: 4 }} />
      </div>
      <div style={{ height: 22, width: 70, background: 'rgba(59,130,246,0.05)', borderRadius: 5 }} />
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function AvailabilityWindowDetailPage() {
  const params = useParams()
  const windowId = params.id as string

  const [window_, setWindow] = useState<AvailabilityWindow | null>(null)
  const [responses, setResponses] = useState<AvailabilityResponse[]>([])
  const [allPlayers, setAllPlayers] = useState<ActivePlayer[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [selections, setSelections] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!windowId) return
    async function load() {
      const [windowRes, responsesRes, playersRes, matchesRes] = await Promise.all([
        supabase
          .from('availability_windows')
          .select('*, season:seasons(name)')
          .eq('id', windowId)
          .single(),
        supabase
          .from('player_availability')
          .select('*, player:players(id, first_name, last_name, batting_style, bowling_style)')
          .eq('window_id', windowId)
          .order('submitted_at'),
        supabase
          .from('players')
          .select('id, first_name, last_name')
          .eq('is_active', true)
          .not('user_id', 'is', null),
        supabase
          .from('matches')
          .select('id, match_date, competition:competitions(name, category), opponent:opponents(canonical_name)')
          .eq('availability_window_id', windowId)
          .order('match_date'),
      ])

      if (windowRes.error) { setError(windowRes.error.message); setLoading(false); return }
      if (windowRes.data) setWindow(windowRes.data as AvailabilityWindow)
      if (responsesRes.data) setResponses(responsesRes.data as AvailabilityResponse[])
      if (playersRes.data) setAllPlayers(playersRes.data)
      if (matchesRes.data) setMatches(matchesRes.data as unknown as Match[])

      // For each match, check if any selections exist
      if (matchesRes.data && matchesRes.data.length > 0) {
        const matchIds = (matchesRes.data as unknown as Match[]).map((m) => m.id)
        const { data: selData } = await supabase
          .from('selections')
          .select('match_id')
          .in('match_id', matchIds)
        if (selData) {
          const selMap: Record<string, boolean> = {}
          selData.forEach((s: { match_id: string }) => { selMap[s.match_id] = true })
          setSelections(selMap)
        }
      }

      setLoading(false)
    }
    load()
  }, [windowId])

  // Build merged player rows: all active players + their response if any
  const playerRows: PlayerRow[] = allPlayers.map(player => {
    const response = responses.find(r => r.player_id === player.id) ?? null
    const status: AvailStatus = response ? response.status : 'no_response'
    return { player, response, status }
  })

  // Sort: available → tentative → no_response → unavailable
  const sortedRows = [...playerRows].sort((a, b) => {
    return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
  })

  // Summary counts
  const counts = {
    available:   playerRows.filter(r => r.status === 'available').length,
    unavailable: playerRows.filter(r => r.status === 'unavailable').length,
    tentative:   playerRows.filter(r => r.status === 'tentative').length,
    no_response: playerRows.filter(r => r.status === 'no_response').length,
  }

  if (!loading && !window_) {
    return (
      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh' }}>
        <div className="container" style={{ paddingTop: 48, textAlign: 'center', color: 'var(--muted)' }}>
          Window not found.{' '}
          <Link href="/admin/availability" style={{ color: 'var(--blue-mid)' }}>
            Back to windows
          </Link>
        </div>
      </div>
    )
  }

  const open = window_ ? isOpen(window_.deadline) : false

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        /* ── HERO ── */
        .avd-hero {
          position: relative;
          padding: 32px 0 28px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
        }
        .avd-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .avd-hero-inner {
          position: relative; z-index: 1;
        }
        .avd-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--muted); text-decoration: none;
          margin-bottom: 16px;
          transition: color 0.15s;
        }
        .avd-back:hover { color: var(--sky); }
        .avd-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 6px;
          display: flex; align-items: center; gap: 8px;
        }
        .avd-eyebrow::before {
          content: ''; display: inline-block;
          width: 18px; height: 1px; background: var(--sky);
        }
        .avd-title {
          font-family: var(--font-display);
          font-size: clamp(22px, 4vw, 36px);
          font-weight: 800; line-height: 1.05;
          color: var(--text); letter-spacing: -0.02em;
          margin-bottom: 10px;
        }
        .avd-hero-meta {
          display: flex; align-items: center; gap: 12px;
          flex-wrap: wrap; font-size: 13px; color: var(--muted);
        }
        .avd-hero-meta-sep { width: 3px; height: 3px; border-radius: 50%; background: rgba(147,197,253,0.3); }

        /* ── SUMMARY BAR ── */
        .avd-summary {
          display: flex; gap: 10px; flex-wrap: wrap;
          padding: 18px 0 20px;
          border-bottom: 1px solid var(--border);
          margin-bottom: 24px;
        }
        .avd-chip {
          display: flex; align-items: center; gap: 8px;
          padding: 10px 16px;
          border-radius: 10px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.04em;
          white-space: nowrap;
          min-height: 44px;
        }
        .avd-chip-count {
          font-size: 18px; font-weight: 800; line-height: 1;
        }
        .avd-chip-label { color: var(--muted); font-size: 11px; }
        .avd-chip.available { border-color: rgba(34,197,94,0.25); background: rgba(34,197,94,0.05); }
        .avd-chip.available .avd-chip-count { color: #86efac; }
        .avd-chip.unavailable { border-color: rgba(239,68,68,0.2); background: rgba(239,68,68,0.04); }
        .avd-chip.unavailable .avd-chip-count { color: #fca5a5; }
        .avd-chip.tentative { border-color: rgba(245,158,11,0.2); background: rgba(245,158,11,0.04); }
        .avd-chip.tentative .avd-chip-count { color: #fbbf24; }
        .avd-chip.no_response .avd-chip-count { color: var(--muted); }

        /* ── SECTION HEADERS ── */
        .avd-section-header {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 16px;
        }
        .avd-section-label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--muted); white-space: nowrap;
        }
        .avd-section-line { flex: 1; height: 1px; background: var(--border); }

        /* ── PLAYER LIST ── */
        .avd-player-list {
          background: rgba(255,255,255,0.015);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          margin-bottom: 36px;
        }
        .avd-player-row {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid rgba(59,130,246,0.07);
          transition: background 0.15s;
        }
        .avd-player-row:last-child { border-bottom: none; }
        .avd-player-row:hover { background: rgba(37,99,235,0.03); }
        .avd-avatar {
          width: 38px; height: 38px;
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display);
          font-size: 13px; font-weight: 800;
          color: #93c5fd;
          flex-shrink: 0;
          letter-spacing: 0.02em;
        }
        .avd-player-info { flex: 1; min-width: 0; }
        .avd-player-name {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .avd-player-sub {
          font-size: 11px; color: var(--muted);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          margin-top: 2px;
        }
        .avd-player-right {
          display: flex; flex-direction: column; align-items: flex-end;
          gap: 4px; flex-shrink: 0;
        }
        .avd-player-time {
          font-size: 10px; color: rgba(147,197,253,0.3);
          white-space: nowrap;
        }

        /* status badge green (reused from list page but scoped) */
        .badge-green {
          background: rgba(34,197,94,0.12);
          color: #86efac;
          border: 1px solid rgba(34,197,94,0.3);
        }

        /* ── MATCH CARDS ── */
        .avd-match-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 18px 14px;
          margin-bottom: 10px;
          transition: border-color 0.18s, background 0.18s;
          position: relative;
        }
        .avd-match-card:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(37,99,235,0.03);
        }
        .avd-match-card-header {
          display: flex; align-items: flex-start; justify-content: space-between;
          gap: 10px; margin-bottom: 8px; flex-wrap: wrap;
        }
        .avd-match-vs {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em;
        }
        .avd-match-meta {
          font-size: 12px; color: var(--muted); margin-bottom: 12px;
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .avd-match-sel-status {
          display: flex; align-items: center; gap: 6px;
          font-size: 12px; margin-bottom: 12px;
        }
        .avd-match-sel-dot {
          width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0;
        }
        .avd-match-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        /* ── EMPTY STATES ── */
        .avd-empty {
          text-align: center; padding: 36px 24px;
          color: rgba(147,197,253,0.35); font-size: 13px;
          border: 1px dashed rgba(59,130,246,0.14);
          border-radius: 12px; line-height: 1.8;
        }

        /* ── MOBILE ── */
        @media (max-width: 480px) {
          .avd-summary { gap: 8px; }
          .avd-chip { padding: 8px 12px; flex: 1; min-width: calc(50% - 4px); }
          .avd-player-row { padding: 11px 12px; gap: 10px; }
          .avd-avatar { width: 34px; height: 34px; font-size: 12px; }
          .avd-player-name { font-size: 13px; }
          .avd-player-sub { display: none; }
          .avd-match-actions { flex-direction: column; }
          .avd-match-actions a { justify-content: center; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="avd-hero">
        <div className="container">
          <div className="avd-hero-inner">
            <Link href="/admin/availability" className="avd-back">
              &larr; Availability Windows
            </Link>
            <div className="avd-eyebrow">Availability</div>
            {loading ? (
              <div style={{ height: 36, width: '55%', background: 'rgba(59,130,246,0.07)', borderRadius: 6, marginBottom: 10 }} />
            ) : window_ ? (
              <>
                <div className="avd-title">{window_.title}</div>
                <div className="avd-hero-meta">
                  <span>{formatDateRange(window_.window_start, window_.window_end)}</span>
                  <span className="avd-hero-meta-sep" />
                  <span>Deadline: {formatDeadline(window_.deadline)}</span>
                  <span className="avd-hero-meta-sep" />
                  {window_.season && (
                    <span className="badge badge-blue">{window_.season.name}</span>
                  )}
                  <span className={`badge ${open ? 'badge-green' : 'badge-muted'}`}>
                    {open ? 'Open' : 'Closed'}
                  </span>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 0 }}>

        {error && (
          <div style={{
            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.28)',
            color: '#fca5a5', padding: '12px 16px', borderRadius: 8,
            fontSize: 13, marginTop: 20, marginBottom: 0,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span>&#9888;</span> {error}
          </div>
        )}

        {/* ── SUMMARY BAR ── */}
        {loading ? (
          <div className="avd-summary" style={{ paddingTop: 18 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 44, flex: 1, minWidth: 90, background: 'rgba(59,130,246,0.05)', borderRadius: 10 }} />
            ))}
          </div>
        ) : (
          <div className="avd-summary" style={{ paddingTop: 18 }}>
            <div className="avd-chip available">
              <span className="avd-chip-count">{counts.available}</span>
              <span className="avd-chip-label">available</span>
            </div>
            <div className="avd-chip unavailable">
              <span className="avd-chip-count">{counts.unavailable}</span>
              <span className="avd-chip-label">unavailable</span>
            </div>
            <div className="avd-chip tentative">
              <span className="avd-chip-count">{counts.tentative}</span>
              <span className="avd-chip-label">tentative</span>
            </div>
            <div className="avd-chip no_response">
              <span className="avd-chip-count">{counts.no_response}</span>
              <span className="avd-chip-label">no response</span>
            </div>
          </div>
        )}

        {/* ── PLAYER RESPONSES ── */}
        <div className="avd-section-header">
          <span className="avd-section-label">Player Responses</span>
          <div className="avd-section-line" />
          {!loading && (
            <span className="badge badge-muted">{allPlayers.length}</span>
          )}
        </div>

        {loading ? (
          <div className="avd-player-list">
            {[1,2,3,4,5,6].map(i => <PlayerRowSkeleton key={i} />)}
          </div>
        ) : sortedRows.length === 0 ? (
          <div className="avd-empty" style={{ marginBottom: 36 }}>
            No active players found with linked accounts.
          </div>
        ) : (
          <div className="avd-player-list">
            {sortedRows.map(({ player, response, status }) => {
              const meta = STATUS_META[status]
              return (
                <div key={player.id} className="avd-player-row">
                  <div
                    className="avd-avatar"
                    style={{ background: meta.avatarColor }}
                    aria-hidden="true"
                  >
                    {getInitials(player)}
                  </div>
                  <div className="avd-player-info">
                    <div className="avd-player-name">
                      {player.first_name} {player.last_name}
                    </div>
                    {response?.note && (
                      <div className="avd-player-sub" title={response.note}>
                        &ldquo;{response.note}&rdquo;
                      </div>
                    )}
                  </div>
                  <div className="avd-player-right">
                    <span className={`badge ${meta.badgeClass}`}>
                      {meta.label}
                    </span>
                    {response && (
                      <span className="avd-player-time">
                        {formatSubmitted(response.submitted_at)}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── MATCHES SECTION ── */}
        <div className="avd-section-header">
          <span className="avd-section-label">Matches This Weekend</span>
          <div className="avd-section-line" />
          {!loading && (
            <span className="badge badge-muted">{matches.length}</span>
          )}
        </div>

        {loading ? (
          <>
            {[1,2].map(i => (
              <div key={i} style={{
                background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)',
                borderRadius: 12, padding: '16px 18px', marginBottom: 10,
              }}>
                <div style={{ height: 15, width: '48%', background: 'rgba(59,130,246,0.07)', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 12, width: '35%', background: 'rgba(59,130,246,0.05)', borderRadius: 4, marginBottom: 14 }} />
                <div style={{ height: 36, width: 120, background: 'rgba(59,130,246,0.06)', borderRadius: 8 }} />
              </div>
            ))}
          </>
        ) : matches.length === 0 ? (
          <div className="avd-empty">
            No matches are linked to this availability window.<br />
            <span style={{ fontSize: 12, display: 'block', marginTop: 6 }}>
              Set <code style={{ background: 'rgba(59,130,246,0.1)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>availability_window_id</code> on a match to link it here.
            </span>
          </div>
        ) : (
          matches.map(match => {
            const hasSelections = !!selections[match.id]
            const category = match.competition?.category
            return (
              <div key={match.id} className="avd-match-card">
                <div className="avd-match-card-header">
                  <div className="avd-match-vs">
                    BCC vs {match.opponent?.canonical_name ?? 'Unknown'}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
                    {category && (
                      <span className={`badge ${category === 'senior' ? 'badge-blue' : 'badge-gold'}`}>
                        {category.charAt(0).toUpperCase() + category.slice(1)}
                      </span>
                    )}
                    {match.competition?.name && (
                      <span className="badge badge-muted">{match.competition.name}</span>
                    )}
                  </div>
                </div>
                <div className="avd-match-meta">
                  <span>&#128197;</span>
                  {formatMatchDate(match.match_date)}
                </div>
                <div className="avd-match-sel-status">
                  <span
                    className="avd-match-sel-dot"
                    style={{
                      background: hasSelections ? '#22c55e' : 'rgba(147,197,253,0.25)',
                      boxShadow: hasSelections ? '0 0 6px rgba(34,197,94,0.6)' : 'none',
                    }}
                  />
                  {hasSelections ? (
                    <span style={{ color: '#86efac', fontSize: 12, fontWeight: 600 }}>XI selected</span>
                  ) : (
                    <span style={{ color: 'var(--muted)', fontSize: 12 }}>XI not selected yet</span>
                  )}
                </div>
                <div className="avd-match-actions">
                  <Link
                    href={`/admin/matches/${match.id}/select`}
                    className="btn btn-primary"
                    style={{ fontSize: 13, padding: '10px 18px', minHeight: 40 }}
                  >
                    Select XI &rarr;
                  </Link>
                  <Link
                    href={`/matches/${match.id}`}
                    className="btn btn-ghost"
                    style={{ fontSize: 13, padding: '10px 18px', minHeight: 40 }}
                  >
                    View Match
                  </Link>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
