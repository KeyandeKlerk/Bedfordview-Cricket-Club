'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

// ── Types ──────────────────────────────────────────────────────────────────

interface Competition {
  id: string
  name: string
  category: string | null
}

interface Opponent {
  canonical_name: string
}

interface Match {
  id: string
  match_date: string
  availability_window_id: string | null
  competition: Competition | null
  opponent: Opponent | null
}

interface Player {
  id: string
  first_name: string
  last_name: string
  batting_style: string | null
  bowling_style: string | null
  date_of_birth: string | null
  // merged from availability
  avail_status: 'available' | 'tentative' | 'unavailable' | 'no_response'
  avail_note: string | null
  // selection state
  selected: boolean
  position: number | null
  override_reason: string | null
}

interface RawSelection {
  id: string
  player_id: string
  position: number | null
  role: string
  status: string
}

const AVAIL_ORDER: Record<string, number> = {
  available: 0,
  tentative: 1,
  no_response: 2,
  unavailable: 3,
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  })
}

function styleInfo(p: Player): string {
  const parts: string[] = []
  if (p.batting_style) parts.push(p.batting_style)
  if (p.bowling_style) parts.push(p.bowling_style)
  return parts.join(' · ')
}

// ── Subcomponents ─────────────────────────────────────────────────────────

function PlayerRowSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '12px 16px', borderBottom: '1px solid var(--border)',
      minHeight: 56,
    }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(59,130,246,0.07)', flexShrink: 0 }} />
      <div style={{ flex: 1 }}>
        <div style={{ height: 13, width: '50%', background: 'rgba(59,130,246,0.07)', borderRadius: 4, marginBottom: 6 }} />
        <div style={{ height: 10, width: '30%', background: 'rgba(59,130,246,0.04)', borderRadius: 4 }} />
      </div>
      <div style={{ height: 22, width: 72, background: 'rgba(59,130,246,0.05)', borderRadius: 20 }} />
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function SelectXIPage() {
  const params = useParams()
  const router = useRouter()
  const matchId = params.id as string

  const [match, setMatch] = useState<Match | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [announcing, setAnnouncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)

  // Override modal
  const [overrideTarget, setOverrideTarget] = useState<Player | null>(null)
  const [overrideReason, setOverrideReason] = useState('')
  const [overrideError, setOverrideError] = useState('')

  // ── Load data ──────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      setLoading(true)

      // 1. Load match
      const { data: matchData, error: matchErr } = await supabase
        .from('matches')
        .select('id, match_date, availability_window_id, competition:competitions(id, name, category), opponent:opponents(canonical_name)')
        .eq('id', matchId)
        .single()

      if (matchErr || !matchData) {
        setError('Match not found.')
        setLoading(false)
        return
      }
      const m = matchData as unknown as Match
      setMatch(m)

      // 2. Load players, availability, existing selections in parallel
      const [playersRes, selectionsRes, availRes] = await Promise.all([
        supabase.from('players').select('id, first_name, last_name, batting_style, bowling_style, date_of_birth').eq('is_active', true).order('last_name'),
        supabase.from('selections').select('id, player_id, position, role, status').eq('match_id', matchId),
        m.availability_window_id
          ? supabase.from('player_availability').select('player_id, status, note').eq('window_id', m.availability_window_id)
          : Promise.resolve({ data: [] }),
      ])

      const rawPlayers: any[] = playersRes?.data ?? []
      const rawSelections: RawSelection[] = selectionsRes?.data ?? []
      const rawAvail: any[] = availRes?.data ?? []

      const availMap = new Map<string, { status: string; note: string | null }>()
      for (const a of rawAvail) availMap.set(a.player_id, { status: a.status, note: a.note })

      const selMap = new Map<string, RawSelection>()
      for (const s of rawSelections) selMap.set(s.player_id, s)

      const merged: Player[] = rawPlayers.map((p: any) => {
        const avail = availMap.get(p.id)
        const sel = selMap.get(p.id)
        return {
          ...p,
          avail_status: (avail?.status as Player['avail_status']) ?? 'no_response',
          avail_note: avail?.note ?? null,
          selected: !!sel,
          position: sel?.position ?? null,
          override_reason: null,
        }
      })

      // Sort: selected (by position) first, then by availability, then name
      merged.sort((a, b) => {
        if (a.selected !== b.selected) return a.selected ? -1 : 1
        const ao = AVAIL_ORDER[a.avail_status] ?? 2
        const bo = AVAIL_ORDER[b.avail_status] ?? 2
        if (ao !== bo) return ao - bo
        return a.last_name.localeCompare(b.last_name)
      })

      setPlayers(merged)
      setLoading(false)
    }
    load()
  }, [matchId])

  // ── Selection logic ────────────────────────────────────────────────────

  const selectedPlayers = players.filter(p => p.selected).sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
  const selectedCount = selectedPlayers.length

  function togglePlayer(player: Player) {
    if (player.avail_status === 'unavailable' && !player.selected) {
      setOverrideTarget(player)
      setOverrideReason('')
      setOverrideError('')
      return
    }
    selectPlayer(player)
  }

  function selectPlayer(player: Player, overrideReasonText?: string) {
    setPlayers(prev => {
      const isSelected = player.selected
      if (isSelected) {
        // Deselect — remove position, re-number remaining
        const updated = prev.map(p =>
          p.id === player.id
            ? { ...p, selected: false, position: null, override_reason: null }
            : p
        )
        const selectedSorted = updated
          .filter(p => p.selected)
          .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
          .map((p, i) => ({ ...p, position: i + 1 }))
        const selIds = new Set(selectedSorted.map(p => p.id))
        return updated.map(p => (selIds.has(p.id) ? selectedSorted.find(s => s.id === p.id)! : p))
      } else {
        if (selectedCount >= 11) return prev // can't exceed 11
        const nextPos = selectedCount + 1
        return prev.map(p =>
          p.id === player.id
            ? { ...p, selected: true, position: nextPos, override_reason: overrideReasonText ?? null }
            : p
        )
      }
    })
  }

  function confirmOverride() {
    if (!overrideReason.trim()) {
      setOverrideError('Please provide a reason for the override.')
      return
    }
    if (!overrideTarget) return
    selectPlayer(overrideTarget, overrideReason.trim())
    setOverrideTarget(null)
    setOverrideReason('')
  }

  // ── Reorder ────────────────────────────────────────────────────────────

  function movePosition(playerId: string, dir: -1 | 1) {
    setPlayers(prev => {
      const sorted = prev
        .filter(p => p.selected)
        .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))

      const idx = sorted.findIndex(p => p.id === playerId)
      const swapIdx = idx + dir
      if (swapIdx < 0 || swapIdx >= sorted.length) return prev

      const newSorted = [...sorted]
      ;[newSorted[idx], newSorted[swapIdx]] = [newSorted[swapIdx], newSorted[idx]]
      const renumbered = newSorted.map((p, i) => ({ ...p, position: i + 1 }))

      const selIds = new Set(renumbered.map(p => p.id))
      return prev.map(p => (selIds.has(p.id) ? renumbered.find(s => s.id === p.id)! : p))
    })
  }

  // ── Save selection ─────────────────────────────────────────────────────

  const saveSelection = useCallback(async () => {
    if (saving) return
    setSaving(true)
    setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not authenticated.'); setSaving(false); return }

    const upserts = players
      .filter(p => p.selected)
      .map(p => ({
        match_id: matchId,
        player_id: p.id,
        position: p.position,
        role: 'player',
        status: 'selected',
        selected_by: user.id,
        override_reason: p.override_reason ?? null,
      }))

    const { error: upsertErr } = await supabase
      .from('selections')
      .upsert(upserts, { onConflict: 'match_id,player_id' })

    setSaving(false)
    if (upsertErr) { setError(upsertErr.message); return }
    showToast('Selection saved')
  }, [players, matchId, saving])

  // ── Announce ───────────────────────────────────────────────────────────

  async function announceSelection() {
    setAnnouncing(true)
    setError(null)

    await saveSelection()

    try {
      const res = await fetch('/api/on-selection-announced', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ match_id: matchId }),
      })
      if (!res.ok) throw new Error('Announce failed')
      showToast('Selection announced!')
    } catch {
      setError('Failed to announce. Selection was saved — try announcing again.')
    }
    setAnnouncing(false)
  }

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 3000)
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const category = match?.competition?.category?.toUpperCase() ?? null
  const backHref = match?.availability_window_id
    ? `/admin/availability/${match.availability_window_id}`
    : '/admin/matches'

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 100 }}>
      <style>{`
        .sx-hero {
          position: relative;
          padding: 28px 0 24px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
        }
        .sx-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 60% 50%, rgba(37,99,235,0.09) 0%, transparent 65%);
          pointer-events: none;
        }
        .sx-back {
          display: inline-flex; align-items: center; gap: 6px;
          font-family: var(--font-display); font-size: 11px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: var(--muted); text-decoration: none;
          margin-bottom: 14px;
          transition: color 0.15s;
        }
        .sx-back:hover { color: var(--text); }
        .sx-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 6px;
          display: flex; align-items: center; gap: 8px;
        }
        .sx-eyebrow::before {
          content: '';
          display: inline-block; width: 18px; height: 1px; background: var(--sky);
        }
        .sx-title {
          font-family: var(--font-display);
          font-size: clamp(24px, 5vw, 40px); font-weight: 800;
          line-height: 1.05; letter-spacing: -0.02em; color: var(--text);
        }
        .sx-subtitle {
          font-size: 14px; color: var(--muted); margin-top: 6px;
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }

        /* ── PLAYER LIST ── */
        .sx-section-label {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--muted); padding: 14px 16px 10px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; gap: 10px;
        }
        .sx-section-line { flex: 1; height: 1px; background: var(--border); }

        .sx-player-row {
          display: flex; align-items: center; gap: 12px;
          padding: 0 16px; min-height: 56px;
          border-bottom: 1px solid rgba(59,130,246,0.07);
          cursor: pointer; transition: background 0.12s;
          -webkit-tap-highlight-color: transparent;
          user-select: none;
          position: relative;
        }
        .sx-player-row:hover { background: rgba(37,99,235,0.05); }
        .sx-player-row:active { background: rgba(37,99,235,0.1); }
        .sx-player-row.selected { background: rgba(37,99,235,0.07); }
        .sx-player-row.unavailable { opacity: 0.75; }

        .sx-pos-badge {
          flex-shrink: 0;
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 13px; font-weight: 800;
          border: 2px solid rgba(59,130,246,0.25);
          color: var(--muted); background: transparent;
          transition: all 0.15s;
        }
        .sx-pos-badge.filled {
          background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
          border-color: transparent;
          color: #fff;
          box-shadow: 0 2px 8px rgba(37,99,235,0.4);
        }

        .sx-player-name {
          font-family: var(--font-display); font-size: 14px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em; line-height: 1.2;
        }
        .sx-player-style {
          font-size: 11px; color: var(--muted); margin-top: 2px;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }

        .sx-avail-pill {
          flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 4px;
          padding: 3px 9px; border-radius: 20px;
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase; white-space: nowrap;
        }
        .sx-avail-available {
          background: rgba(34,197,94,0.1); color: #4ade80;
          border: 1px solid rgba(34,197,94,0.25);
        }
        .sx-avail-tentative {
          background: rgba(245,158,11,0.1); color: #fbbf24;
          border: 1px solid rgba(245,158,11,0.25);
        }
        .sx-avail-unavailable {
          background: rgba(239,68,68,0.1); color: #f87171;
          border: 1px solid rgba(239,68,68,0.25);
        }
        .sx-avail-no_response {
          background: rgba(59,130,246,0.06); color: rgba(147,197,253,0.5);
          border: 1px solid rgba(59,130,246,0.12);
        }

        /* ── REORDER SECTION ── */
        .sx-reorder-card {
          background: rgba(37,99,235,0.05);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 12px; margin: 0 0 16px;
          overflow: hidden;
        }
        .sx-reorder-header {
          padding: 12px 16px 10px;
          border-bottom: 1px solid rgba(59,130,246,0.1);
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase; color: var(--sky);
        }
        .sx-reorder-row {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 16px;
          border-bottom: 1px solid rgba(59,130,246,0.06);
        }
        .sx-reorder-row:last-child { border-bottom: none; }
        .sx-reorder-pos {
          flex-shrink: 0; width: 24px;
          font-family: var(--font-display); font-size: 12px; font-weight: 800;
          color: var(--sky); text-align: center;
        }
        .sx-reorder-name {
          flex: 1; font-family: var(--font-display); font-size: 13px; font-weight: 700;
          color: var(--text);
        }
        .sx-reorder-btns { display: flex; gap: 4px; }
        .sx-reorder-btn {
          width: 32px; height: 32px; border-radius: 8px;
          background: rgba(59,130,246,0.08);
          border: 1px solid rgba(59,130,246,0.15);
          color: var(--muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 14px; transition: all 0.12s;
          padding: 0;
        }
        .sx-reorder-btn:hover:not(:disabled) {
          background: rgba(59,130,246,0.18);
          border-color: rgba(96,165,250,0.35);
          color: var(--text);
        }
        .sx-reorder-btn:disabled { opacity: 0.25; cursor: default; }

        /* ── STICKY FOOTER ── */
        .sx-footer {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 50;
          background: rgba(5,12,26,0.95);
          border-top: 1px solid var(--border);
          backdrop-filter: blur(12px);
          padding: 12px 16px;
          display: flex; align-items: center; gap: 10px;
        }
        .sx-footer-count {
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          color: var(--muted); white-space: nowrap; flex-shrink: 0;
        }
        .sx-footer-count strong { color: var(--sky); }
        .sx-footer-actions { display: flex; gap: 8px; flex: 1; justify-content: flex-end; }
        .sx-save-btn {
          padding: 10px 18px; border-radius: 8px;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.3);
          color: #93c5fd; cursor: pointer;
          font-family: var(--font-display); font-size: 12px; font-weight: 700;
          transition: all 0.15s; min-height: 44px; white-space: nowrap;
        }
        .sx-save-btn:hover:not(:disabled) {
          background: rgba(37,99,235,0.2);
          border-color: rgba(96,165,250,0.45);
        }
        .sx-save-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .sx-announce-btn {
          padding: 10px 18px; border-radius: 8px;
          background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
          border: none; color: #fff; cursor: pointer;
          font-family: var(--font-display); font-size: 12px; font-weight: 700;
          box-shadow: 0 4px 14px rgba(37,99,235,0.3);
          transition: all 0.15s; min-height: 44px; white-space: nowrap;
        }
        .sx-announce-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .sx-announce-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }

        /* ── OVERRIDE MODAL ── */
        .sx-modal-overlay {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(5,12,26,0.88);
          display: flex; align-items: flex-end; justify-content: center;
          padding: 0;
          backdrop-filter: blur(4px);
        }
        @media (min-width: 480px) {
          .sx-modal-overlay { align-items: center; padding: 20px; }
        }
        .sx-modal {
          background: var(--panel);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 20px 20px 0 0;
          padding: 28px 24px 32px;
          width: 100%; max-width: 440px;
          position: relative;
        }
        @media (min-width: 480px) {
          .sx-modal { border-radius: 16px; }
        }
        .sx-modal::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #f59e0b, transparent);
          border-radius: 20px 20px 0 0;
        }
        @media (min-width: 480px) { .sx-modal::before { border-radius: 16px 16px 0 0; } }
        .sx-modal-title {
          font-family: var(--font-display); font-size: 17px; font-weight: 800;
          color: var(--text); margin-bottom: 6px; letter-spacing: -0.01em;
        }
        .sx-modal-body { font-size: 13px; color: var(--muted); line-height: 1.6; margin-bottom: 18px; }
        .sx-modal-warning {
          display: flex; align-items: flex-start; gap: 8px;
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.2);
          border-radius: 8px; padding: 10px 12px;
          font-size: 12px; color: #fbbf24; line-height: 1.5; margin-bottom: 18px;
        }
        .sx-modal-field { margin-bottom: 16px; }
        .sx-modal-err { font-size: 12px; color: #f87171; margin-top: 5px; }
        .sx-modal-actions { display: flex; gap: 10px; }
        .sx-modal-cancel {
          flex: 1; padding: 12px; border-radius: 9px;
          border: 1px solid var(--border); background: rgba(255,255,255,0.02);
          color: var(--muted); cursor: pointer;
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          min-height: 48px; transition: all 0.15s;
        }
        .sx-modal-cancel:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .sx-modal-override {
          flex: 1; padding: 12px; border-radius: 9px;
          background: rgba(245,158,11,0.15);
          border: 1px solid rgba(245,158,11,0.35);
          color: #fbbf24; cursor: pointer;
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          min-height: 48px; transition: all 0.15s;
        }
        .sx-modal-override:hover { background: rgba(245,158,11,0.25); }

        /* ── ERROR BANNER ── */
        .sx-error {
          background: rgba(239,68,68,0.09); border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5; padding: 11px 14px; border-radius: 8px;
          font-size: 13px; margin-bottom: 14px;
          display: flex; align-items: center; gap: 8px;
        }

        /* ── TOAST ── */
        .sx-toast {
          position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
          z-index: 300;
          background: rgba(34,197,94,0.15); border: 1px solid rgba(34,197,94,0.3);
          color: #4ade80; padding: 10px 20px; border-radius: 24px;
          font-family: var(--font-display); font-size: 12px; font-weight: 700;
          letter-spacing: 0.06em; white-space: nowrap;
          box-shadow: 0 4px 24px rgba(0,0,0,0.4);
          animation: sx-toast-in 0.2s ease;
        }
        @keyframes sx-toast-in {
          from { opacity: 0; transform: translateX(-50%) translateY(8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }

        @media (min-width: 768px) {
          .sx-player-row { padding: 0 20px; }
          .sx-footer { padding: 14px 24px; }
          .sx-footer-count { font-size: 14px; }
        }
      `}</style>

      {/* ── HERO ── */}
      <div className="sx-hero">
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <Link href={backHref} className="sx-back">
            ← {match?.availability_window_id ? 'Availability' : 'Matches'}
          </Link>
          <div className="sx-eyebrow">Team Selection</div>
          <div className="sx-title">Select XI</div>
          {match && (
            <div className="sx-subtitle">
              BCC vs {match.opponent?.canonical_name ?? '—'}
              {category && (
                <span className={`badge ${category === 'JUNIOR' ? 'badge-gold' : 'badge-blue'}`}>
                  {category}
                </span>
              )}
              <span style={{ opacity: 0.5 }}>·</span>
              {formatDate(match.match_date)}
            </div>
          )}
        </div>
      </div>

      <div className="container" style={{ paddingTop: 20 }}>
        {error && (
          <div className="sx-error">
            <span>⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* ── REORDER SECTION (visible once 11 selected) ── */}
        {!loading && selectedCount === 11 && (
          <div style={{ marginBottom: 20 }}>
            <div className="sx-reorder-card">
              <div className="sx-reorder-header">Batting Order</div>
              {selectedPlayers.map((p, i) => (
                <div className="sx-reorder-row" key={p.id}>
                  <div className="sx-reorder-pos">{p.position}</div>
                  <div className="sx-reorder-name">{p.first_name} {p.last_name}</div>
                  <div className="sx-reorder-btns">
                    <button
                      className="sx-reorder-btn"
                      onClick={() => movePosition(p.id, -1)}
                      disabled={i === 0}
                      aria-label="Move up"
                    >▲</button>
                    <button
                      className="sx-reorder-btn"
                      onClick={() => movePosition(p.id, 1)}
                      disabled={i === selectedPlayers.length - 1}
                      aria-label="Move down"
                    >▼</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PLAYER LIST ── */}
        <div className="card" style={{ overflow: 'hidden', marginBottom: 0 }}>
          <div className="sx-section-label">
            Squad
            <div className="sx-section-line" />
            <span style={{ color: selectedCount === 11 ? 'var(--green)' : 'var(--sky)', fontWeight: 800 }}>
              {selectedCount}/11
            </span>
          </div>

          {loading ? (
            Array.from({ length: 8 }).map((_, i) => <PlayerRowSkeleton key={i} />)
          ) : players.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--muted)', fontSize: 14 }}>
              No active players found.
            </div>
          ) : (
            players.map(player => {
              const canAdd = !player.selected && selectedCount < 11
              const isClickable = player.selected || canAdd || player.avail_status === 'unavailable'
              return (
                <div
                  key={player.id}
                  className={`sx-player-row${player.selected ? ' selected' : ''}${player.avail_status === 'unavailable' ? ' unavailable' : ''}`}
                  onClick={() => isClickable && togglePlayer(player)}
                  role="button"
                  aria-pressed={player.selected}
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); isClickable && togglePlayer(player) } }}
                  style={{ cursor: isClickable ? 'pointer' : 'default' }}
                >
                  <div className={`sx-pos-badge${player.selected ? ' filled' : ''}`}>
                    {player.selected ? player.position : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="sx-player-name">{player.first_name} {player.last_name}</div>
                    {styleInfo(player) && (
                      <div className="sx-player-style">{styleInfo(player)}</div>
                    )}
                  </div>
                  <span className={`sx-avail-pill sx-avail-${player.avail_status}`}>
                    {player.avail_status === 'available' && '✓ Available'}
                    {player.avail_status === 'tentative' && '? Tentative'}
                    {player.avail_status === 'unavailable' && '✗ Unavailable'}
                    {player.avail_status === 'no_response' && '— No response'}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ── STICKY FOOTER ── */}
      <div className="sx-footer">
        <div className="sx-footer-count">
          <strong>{selectedCount}</strong> / 11 selected
        </div>
        <div className="sx-footer-actions">
          <button
            className="sx-save-btn"
            onClick={saveSelection}
            disabled={saving || selectedCount === 0}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            className="sx-announce-btn"
            onClick={announceSelection}
            disabled={selectedCount < 11 || announcing || saving}
          >
            {announcing ? 'Announcing…' : 'Announce →'}
          </button>
        </div>
      </div>

      {/* ── OVERRIDE MODAL ── */}
      {overrideTarget && (
        <div
          className="sx-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) setOverrideTarget(null) }}
        >
          <div className="sx-modal" role="dialog" aria-modal="true" aria-label="Override unavailable player">
            <div className="sx-modal-title">Player is unavailable</div>
            <div className="sx-modal-body">
              <strong style={{ color: 'var(--text)' }}>
                {overrideTarget.first_name} {overrideTarget.last_name}
              </strong>{' '}
              has marked themselves as unavailable
              {overrideTarget.avail_note && (
                <span style={{ fontStyle: 'italic' }}> — "{overrideTarget.avail_note}"</span>
              )}.
            </div>
            <div className="sx-modal-warning">
              <span>⚠</span>
              <span>You are overriding their availability response. Please provide a reason.</span>
            </div>
            <div className="sx-modal-field">
              <label htmlFor="override-reason">Reason for override</label>
              <input
                id="override-reason"
                className="input"
                value={overrideReason}
                onChange={e => { setOverrideReason(e.target.value); setOverrideError('') }}
                placeholder="e.g. Player contacted coach directly"
                autoFocus
              />
              {overrideError && <div className="sx-modal-err">{overrideError}</div>}
            </div>
            <div className="sx-modal-actions">
              <button className="sx-modal-cancel" onClick={() => setOverrideTarget(null)}>
                Cancel
              </button>
              <button className="sx-modal-override" onClick={confirmOverride}>
                Override & Select
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── TOAST ── */}
      {toastMsg && <div className="sx-toast">{toastMsg}</div>}
    </div>
  )
}
