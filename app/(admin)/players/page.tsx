'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Player {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  batting_style: string | null
  bowling_style: string | null
  is_active: boolean
}

const BATTING_STYLES = [
  'Right-hand bat',
  'Left-hand bat',
]

const BOWLING_STYLES = [
  'Right-arm fast',
  'Right-arm fast-medium',
  'Right-arm medium',
  'Right-arm medium-fast',
  'Right-arm off break',
  'Right-arm leg break',
  'Left-arm fast',
  'Left-arm fast-medium',
  'Left-arm medium',
  'Left-arm orthodox',
  'Left-arm unorthodox',
]

function getInitials(p: Player) {
  return ((p.first_name[0] ?? '') + (p.last_name[0] ?? '')).toUpperCase()
}

function PlayerSkeleton() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '14px 0',
      borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.07)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 13, width: '40%', background: 'rgba(59,130,246,0.06)', borderRadius: 4 }} />
        <div style={{ height: 11, width: '60%', background: 'rgba(59,130,246,0.04)', borderRadius: 4 }} />
      </div>
      <div style={{ height: 22, width: 54, background: 'rgba(59,130,246,0.05)', borderRadius: 5 }} />
    </div>
  )
}

export default function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [editPlayer, setEditPlayer] = useState<Player | null | 'new'>(null)
  const [form, setForm] = useState<Partial<Player>>({})
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deactivateTarget, setDeactivateTarget] = useState<Player | null>(null)
  const [deactivating, setDeactivating] = useState(false)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)

  useEffect(() => {
    supabase.from('players').select('*').order('last_name').then(({ data }) => {
      if (data) setPlayers(data)
      setLoading(false)
    })
  }, [])

  function openNew() {
    setForm({ first_name: '', last_name: '', nickname: '', batting_style: '', bowling_style: '', is_active: true })
    setEditPlayer('new')
    setError(null)
  }

  function openEdit(player: Player) {
    setForm({ ...player })
    setEditPlayer(player)
    setError(null)
  }

  function closeModal() {
    setEditPlayer(null)
    setError(null)
  }

  async function handleSave() {
    if (!form.first_name?.trim() || !form.last_name?.trim()) {
      setError('First name and last name are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      if (editPlayer === 'new') {
        const { data, error } = await supabase
          .from('players')
          .insert({
            first_name: form.first_name?.trim(),
            last_name: form.last_name?.trim(),
            nickname: form.nickname?.trim() || null,
            batting_style: form.batting_style || null,
            bowling_style: form.bowling_style || null,
            is_active: true,
          })
          .select()
          .single()
        if (error) throw error
        setPlayers(prev => [...prev, data].sort((a, b) => a.last_name.localeCompare(b.last_name)))
      } else if (editPlayer) {
        const { error } = await supabase
          .from('players')
          .update({
            first_name: form.first_name?.trim(),
            last_name: form.last_name?.trim(),
            nickname: form.nickname?.trim() || null,
            batting_style: form.batting_style || null,
            bowling_style: form.bowling_style || null,
          })
          .eq('id', editPlayer.id)
        if (error) throw error
        setPlayers(prev =>
          prev.map(p => p.id === (editPlayer as Player).id ? { ...p, ...form } as Player : p)
        )
      }
      closeModal()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    const { error } = await supabase.from('players').update({ is_active: false }).eq('id', deactivateTarget.id)
    setDeactivating(false)
    if (!error) {
      setPlayers(prev => prev.map(p => p.id === deactivateTarget!.id ? { ...p, is_active: false } : p))
    }
    setDeactivateTarget(null)
  }

  const visiblePlayers = players.filter(p => {
    if (!showInactive && !p.is_active) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const fullName = `${p.first_name} ${p.last_name}`.toLowerCase()
      const nick = (p.nickname ?? '').toLowerCase()
      return fullName.includes(q) || nick.includes(q)
    }
    return true
  })

  const activePlayers = players.filter(p => p.is_active)
  const inactivePlayers = players.filter(p => !p.is_active)

  const isNew = editPlayer === 'new'

  return (
    <>
      <style>{`
        .ap-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }

        /* ── HERO ── */
        .ap-hero {
          position: relative; overflow: hidden;
          padding: 36px 0 32px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
        }
        .ap-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .ap-hero-inner {
          position: relative; z-index: 1;
          display: flex; align-items: flex-end;
          justify-content: space-between; gap: 16px; flex-wrap: wrap;
        }
        .ap-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .ap-eyebrow::before { content: ''; display: inline-block; width: 18px; height: 1px; background: var(--sky); }
        .ap-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 44px); font-weight: 800;
          color: var(--text); letter-spacing: -0.02em; line-height: 1.05;
        }

        /* ── CONTROLS ── */
        .ap-controls {
          display: flex; align-items: center; gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid var(--border);
        }
        .ap-search-wrap { position: relative; flex: 1; min-width: 180px; }
        .ap-search-icon {
          position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
          font-size: 14px; color: var(--muted); pointer-events: none;
        }
        .ap-search {
          width: 100%;
          background: rgba(10,22,40,0.8);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 9px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 14px;
          padding: 10px 14px 10px 36px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          min-height: 44px;
        }
        .ap-search:focus {
          border-color: rgba(96,165,250,0.45);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .ap-search::placeholder { color: rgba(147,197,253,0.28); }

        .ap-toggle {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 14px; border-radius: 9px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 44px; white-space: nowrap;
        }
        .ap-toggle:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .ap-toggle.active {
          border-color: rgba(59,130,246,0.45);
          background: rgba(37,99,235,0.12);
          color: #93c5fd;
        }

        /* ── STAT PILLS ── */
        .ap-stats {
          display: flex; gap: 8px; flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .ap-stat-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 7px;
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em;
          background: rgba(37,99,235,0.08);
          border: 1px solid rgba(59,130,246,0.16);
          color: var(--muted);
        }
        .ap-stat-pill strong {
          font-size: 14px; font-weight: 800;
          color: #60a5fa; font-family: var(--font-display);
        }

        /* ── PLAYER LIST ── */
        .ap-player-row {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 0;
          border-bottom: 1px solid var(--border);
          transition: background 0.12s;
        }
        .ap-player-row:last-child { border-bottom: none; }
        .ap-player-row.inactive { opacity: 0.5; }
        .ap-avatar {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, rgba(29,78,216,0.6) 0%, rgba(14,165,233,0.6) 100%);
          border: 1px solid rgba(59,130,246,0.25);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 13px; font-weight: 800;
          color: #93c5fd; flex-shrink: 0;
        }
        .ap-player-info { flex: 1; min-width: 0; }
        .ap-player-name {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em;
          margin-bottom: 3px;
        }
        .ap-player-nick { color: var(--muted); font-weight: 400; }
        .ap-player-meta {
          font-size: 11px; color: var(--muted);
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .ap-player-meta-sep { width: 2px; height: 2px; border-radius: 50%; background: currentColor; opacity: 0.4; }
        .ap-player-actions {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .ap-row-btn {
          display: inline-flex; align-items: center;
          padding: 8px 12px; border-radius: 7px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display); font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 36px; white-space: nowrap;
        }
        .ap-row-btn:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(37,99,235,0.07);
          color: var(--text);
        }
        .ap-row-btn.danger { color: rgba(252,165,165,0.6); border-color: rgba(239,68,68,0.14); }
        .ap-row-btn.danger:hover {
          background: rgba(239,68,68,0.09);
          border-color: rgba(239,68,68,0.3);
          color: #fca5a5;
        }

        /* ── EMPTY STATE ── */
        .ap-empty {
          text-align: center; padding: 40px 20px;
          color: rgba(147,197,253,0.35); font-size: 14px;
          border: 1px dashed rgba(59,130,246,0.14);
          border-radius: 12px; line-height: 1.8;
        }

        /* ── MODAL ── */
        .ap-modal-overlay {
          position: fixed; inset: 0; z-index: 900;
          background: rgba(5,12,26,0.88);
          display: flex; align-items: flex-end; justify-content: center;
          backdrop-filter: blur(4px);
        }
        @media (min-width: 600px) {
          .ap-modal-overlay { align-items: center; }
          .ap-modal { border-radius: 16px !important; max-width: 460px !important; }
        }
        .ap-modal {
          background: var(--panel);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 20px 20px 0 0;
          width: 100%; max-width: 100%;
          padding: 0;
          position: relative;
          max-height: 92vh;
          overflow-y: auto;
        }
        .ap-modal::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.45), transparent);
          border-radius: 20px 20px 0 0;
        }
        .ap-modal-handle {
          width: 36px; height: 4px; border-radius: 2px;
          background: rgba(59,130,246,0.2);
          margin: 14px auto 0;
        }
        .ap-modal-head {
          padding: 20px 24px 16px;
          border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
        }
        .ap-modal-title {
          font-family: var(--font-display);
          font-size: 18px; font-weight: 800;
          color: var(--text); letter-spacing: -0.01em;
        }
        .ap-modal-close {
          width: 36px; height: 36px; border-radius: 8px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          color: var(--muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; transition: all 0.15s;
        }
        .ap-modal-close:hover { background: rgba(255,255,255,0.08); color: var(--text); }
        .ap-modal-body { padding: 20px 24px 24px; }

        /* ── FORM ── */
        .ap-form-row {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 14px; margin-bottom: 14px;
        }
        .ap-field { margin-bottom: 14px; }
        .ap-label {
          display: block;
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.45);
          margin-bottom: 6px;
        }
        .ap-input, .ap-select {
          width: 100%;
          background: rgba(10,22,40,0.8);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 9px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 15px;
          padding: 12px 14px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
          min-height: 48px;
          -webkit-appearance: none;
        }
        .ap-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2360a5fa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; }
        .ap-input:focus, .ap-select:focus {
          border-color: rgba(96,165,250,0.45);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.1);
        }
        .ap-input::placeholder { color: rgba(147,197,253,0.25); }
        .ap-select option { background: var(--surface); }

        .ap-form-error {
          background: rgba(239,68,68,0.09);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5; border-radius: 8px;
          padding: 10px 14px; font-size: 13px;
          margin-bottom: 16px;
        }
        .ap-form-actions {
          display: flex; gap: 10px; padding-top: 4px;
        }
        .ap-btn-cancel {
          flex: 1; padding: 13px; border-radius: 10px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--muted); cursor: pointer;
          font-family: var(--font-display); font-size: 14px; font-weight: 700;
          transition: all 0.15s; min-height: 48px;
        }
        .ap-btn-cancel:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .ap-btn-save {
          flex: 2; padding: 13px; border-radius: 10px;
          background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
          border: none; color: #fff; cursor: pointer;
          font-family: var(--font-display); font-size: 14px; font-weight: 700;
          transition: opacity 0.15s; min-height: 48px;
          box-shadow: 0 4px 16px rgba(37,99,235,0.3);
        }
        .ap-btn-save:hover:not(:disabled) { opacity: 0.9; }
        .ap-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ── DEACTIVATE MODAL ── */
        .ap-deact-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(5,12,26,0.88);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; backdrop-filter: blur(4px);
        }
        .ap-deact-modal {
          background: var(--panel);
          border: 1px solid rgba(245,158,11,0.28);
          border-radius: 16px; padding: 28px 24px;
          max-width: 380px; width: 100%; position: relative;
        }
        .ap-deact-modal::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #f59e0b, transparent);
          border-radius: 16px 16px 0 0;
        }
        .ap-deact-title {
          font-family: var(--font-display);
          font-size: 17px; font-weight: 800;
          color: var(--text); margin-bottom: 8px;
        }
        .ap-deact-body {
          font-size: 13px; color: var(--muted);
          line-height: 1.6; margin-bottom: 20px;
        }
        .ap-deact-actions { display: flex; gap: 10px; }
        .ap-deact-cancel {
          flex: 1; padding: 12px; border-radius: 9px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--muted); cursor: pointer;
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          transition: all 0.15s; min-height: 44px;
        }
        .ap-deact-cancel:hover { color: var(--text); border-color: rgba(59,130,246,0.3); }
        .ap-deact-confirm {
          flex: 1; padding: 12px; border-radius: 9px;
          background: rgba(245,158,11,0.15);
          border: 1px solid rgba(245,158,11,0.35);
          color: #fbbf24; cursor: pointer;
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          transition: all 0.15s; min-height: 44px;
        }
        .ap-deact-confirm:hover:not(:disabled) {
          background: rgba(245,158,11,0.25);
          border-color: rgba(245,158,11,0.55);
        }
        .ap-deact-confirm:disabled { opacity: 0.5; cursor: not-allowed; }

        @media (max-width: 480px) {
          .ap-form-row { grid-template-columns: 1fr; }
          .ap-player-meta { display: none; }
        }
      `}</style>

      <div className="ap-page">

        {/* ── HERO ── */}
        <div className="ap-hero">
          <div className="container">
            <div className="ap-hero-inner">
              <div>
                <div className="ap-eyebrow">Admin</div>
                <div className="ap-title">Players</div>
              </div>
              <button className="btn btn-primary" onClick={openNew}>
                + Add Player
              </button>
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 24 }}>

          {/* ── STATS ── */}
          {!loading && (
            <div className="ap-stats">
              <div className="ap-stat-pill">
                <strong>{activePlayers.length}</strong>
                Active
              </div>
              {inactivePlayers.length > 0 && (
                <div className="ap-stat-pill">
                  <strong>{inactivePlayers.length}</strong>
                  Inactive
                </div>
              )}
              <div className="ap-stat-pill">
                <strong>{players.length}</strong>
                Total
              </div>
            </div>
          )}

          {/* ── CONTROLS ── */}
          <div className="ap-controls">
            <div className="ap-search-wrap">
              <span className="ap-search-icon">⌕</span>
              <input
                className="ap-search"
                type="search"
                placeholder="Search by name..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {inactivePlayers.length > 0 && (
              <button
                className={`ap-toggle${showInactive ? ' active' : ''}`}
                onClick={() => setShowInactive(v => !v)}
              >
                {showInactive ? 'Hide inactive' : 'Show inactive'}
              </button>
            )}
          </div>

          {/* ── PLAYER LIST ── */}
          {loading ? (
            <>
              <PlayerSkeleton />
              <PlayerSkeleton />
              <PlayerSkeleton />
              <PlayerSkeleton />
              <PlayerSkeleton />
            </>
          ) : visiblePlayers.length === 0 ? (
            <div className="ap-empty">
              {search ? (
                <>No players match &ldquo;{search}&rdquo;.</>
              ) : (
                <>No players yet. <button onClick={openNew} style={{ color: 'var(--blue-mid)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Add the first player →</button></>
              )}
            </div>
          ) : (
            visiblePlayers.map(p => (
              <div key={p.id} className={`ap-player-row${p.is_active ? '' : ' inactive'}`}>
                <div className="ap-avatar">{getInitials(p)}</div>
                <div className="ap-player-info">
                  <div className="ap-player-name">
                    {p.first_name} {p.last_name}
                    {p.nickname && (
                      <span className="ap-player-nick"> &ldquo;{p.nickname}&rdquo;</span>
                    )}
                  </div>
                  <div className="ap-player-meta">
                    {p.batting_style && <span>{p.batting_style}</span>}
                    {p.batting_style && p.bowling_style && <span className="ap-player-meta-sep" />}
                    {p.bowling_style && <span>{p.bowling_style}</span>}
                    {!p.batting_style && !p.bowling_style && (
                      <span style={{ opacity: 0.45 }}>No style set</span>
                    )}
                  </div>
                </div>
                <div className="ap-player-actions">
                  {!p.is_active && (
                    <span className="badge badge-muted" style={{ marginRight: 4 }}>Inactive</span>
                  )}
                  <button className="ap-row-btn" onClick={() => openEdit(p)}>
                    Edit
                  </button>
                  {p.is_active && (
                    <button
                      className="ap-row-btn danger"
                      onClick={() => setDeactivateTarget(p)}
                    >
                      Deactivate
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── EDIT / NEW PLAYER MODAL ── */}
      {editPlayer !== null && (
        <div
          className="ap-modal-overlay"
          onClick={e => { if (e.target === e.currentTarget) closeModal() }}
        >
          <div className="ap-modal">
            <div className="ap-modal-handle" />
            <div className="ap-modal-head">
              <div className="ap-modal-title">
                {isNew ? 'New Player' : `Edit ${(editPlayer as Player).first_name}`}
              </div>
              <button className="ap-modal-close" onClick={closeModal} aria-label="Close">
                ✕
              </button>
            </div>
            <div className="ap-modal-body">
              <div className="ap-form-row">
                <div className="ap-field">
                  <label className="ap-label">First Name *</label>
                  <input
                    className="ap-input"
                    placeholder="e.g. James"
                    value={form.first_name ?? ''}
                    onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))}
                    autoFocus={isNew}
                  />
                </div>
                <div className="ap-field">
                  <label className="ap-label">Last Name *</label>
                  <input
                    className="ap-input"
                    placeholder="e.g. Anderson"
                    value={form.last_name ?? ''}
                    onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))}
                  />
                </div>
              </div>

              <div className="ap-field">
                <label className="ap-label">Nickname</label>
                <input
                  className="ap-input"
                  placeholder="Optional"
                  value={form.nickname ?? ''}
                  onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))}
                />
              </div>

              <div className="ap-form-row">
                <div className="ap-field">
                  <label className="ap-label">Batting Style</label>
                  <select
                    className="ap-select"
                    value={form.batting_style ?? ''}
                    onChange={e => setForm(p => ({ ...p, batting_style: e.target.value }))}
                  >
                    <option value="">Not set</option>
                    {BATTING_STYLES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="ap-field">
                  <label className="ap-label">Bowling Style</label>
                  <select
                    className="ap-select"
                    value={form.bowling_style ?? ''}
                    onChange={e => setForm(p => ({ ...p, bowling_style: e.target.value }))}
                  >
                    <option value="">Not set</option>
                    {BOWLING_STYLES.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {error && <div className="ap-form-error">{error}</div>}

              <div className="ap-form-actions">
                <button className="ap-btn-cancel" onClick={closeModal}>
                  Cancel
                </button>
                <button
                  className="ap-btn-save"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : isNew ? 'Add Player' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DEACTIVATE CONFIRMATION MODAL ── */}
      {deactivateTarget && (
        <div
          className="ap-deact-overlay"
          onClick={e => { if (e.target === e.currentTarget) setDeactivateTarget(null) }}
        >
          <div className="ap-deact-modal">
            <div className="ap-deact-title">Deactivate player?</div>
            <div className="ap-deact-body">
              <strong style={{ color: 'var(--text)' }}>
                {deactivateTarget.first_name} {deactivateTarget.last_name}
              </strong>{' '}
              will be marked as inactive and will no longer appear in match selections.
              You can reactivate them via Edit at any time.
            </div>
            <div className="ap-deact-actions">
              <button className="ap-deact-cancel" onClick={() => setDeactivateTarget(null)}>
                Cancel
              </button>
              <button
                className="ap-deact-confirm"
                onClick={confirmDeactivate}
                disabled={deactivating}
              >
                {deactivating ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
