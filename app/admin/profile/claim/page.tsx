'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface Player {
  id: string
  first_name: string
  last_name: string
  batting_style: string | null
  bowling_style: string | null
  is_active: boolean
}

export default function ClaimProfilePage() {
  const router = useRouter()
  const [search, setSearch]       = useState('')
  const [players, setPlayers]     = useState<Player[]>([])
  const [filtered, setFiltered]   = useState<Player[]>([])
  const [selected, setSelected]   = useState<Player | null>(null)
  const [loading, setLoading]     = useState(true)
  const [saving, setSaving]       = useState(false)
  const [done, setDone]           = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [alreadyLinked, setAlreadyLinked] = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUser(user)

      // Check if this user already has a linked player record
      const { data: existing } = await supabase
        .from('players')
        .select('id, first_name, last_name')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existing) { setAlreadyLinked(true); setLoading(false); return }

      // Fetch all unclaimed active players
      const { data } = await supabase
        .from('players')
        .select('id, first_name, last_name, batting_style, bowling_style, is_active')
        .is('user_id', null)
        .eq('is_active', true)
        .order('last_name')

      setPlayers(data ?? [])
      setFiltered(data ?? [])
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      q
        ? players.filter(p =>
            `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
          )
        : players
    )
  }, [search, players])

  async function handleClaim() {
    if (!selected || !currentUser) return
    setSaving(true); setError(null)

    const { error } = await supabase
      .from('players')
      .update({ user_id: currentUser.id, email: currentUser.email })
      .eq('id', selected.id)
      .is('user_id', null) // safety: only update if still unclaimed

    setSaving(false)
    if (error) { setError(error.message); return }
    setDone(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  return (
    <>
      <style>{`
        .claim-wrap { min-height: 100vh; padding: var(--nav-h, 64px) 0 60px; }
        .claim-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid var(--border);
          padding: 40px 0 36px;
          margin-bottom: 32px;
        }
        .claim-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase; color: var(--sky);
          margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
        }
        .claim-eyebrow::before { content:''; display:inline-block; width:20px; height:1px; background:var(--sky); }
        .claim-title {
          font-family: var(--font-display); font-size: clamp(26px,4vw,40px);
          font-weight: 800; color: #f0f8ff; letter-spacing: -0.02em; margin: 0 0 10px;
        }
        .claim-sub { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 520px; }
        .claim-body { max-width: 560px; margin: 0 auto; padding: 0 20px; }
        .player-card {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 10px;
          border: 1px solid var(--border); background: rgba(255,255,255,0.02);
          cursor: pointer; transition: border-color 0.15s, background 0.15s;
          margin-bottom: 8px;
        }
        .player-card:hover { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.05); }
        .player-card.selected { border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .player-avatar {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #fff;
        }
        .player-name { font-weight: 600; font-size: 15px; color: var(--text); }
        .player-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .confirm-panel {
          margin-top: 24px; padding: 20px; border-radius: 12px;
          background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.3);
        }
        .confirm-label { font-size: 13px; color: var(--muted); margin-bottom: 14px; }
        .confirm-name { font-family: var(--font-display); font-size: 22px; font-weight: 800; color: #93c5fd; margin-bottom: 4px; }
        .done-card {
          padding: 32px; text-align: center; border-radius: 14px;
          background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3);
        }
        .done-icon { font-size: 48px; margin-bottom: 16px; }
        .done-title { font-family: var(--font-display); font-size: 24px; font-weight: 800; color: #86efac; margin-bottom: 8px; }
        .done-sub { font-size: 14px; color: var(--muted); }
        .linked-card {
          padding: 28px; text-align: center; border-radius: 14px;
          background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.3);
        }
        .empty-state { padding: 40px 0; text-align: center; color: var(--muted); font-size: 14px; }
      `}</style>

      <div className="claim-wrap">
        <div className="claim-hero">
          <div className="container">
            <div className="claim-eyebrow">Profile</div>
            <h1 className="claim-title">Claim Your Player Profile</h1>
            <p className="claim-sub">
              Link your account to your existing player record to unlock your personal stats dashboard and availability features.
            </p>
          </div>
        </div>

        <div className="claim-body">
          {alreadyLinked ? (
            <div className="linked-card">
              <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#93c5fd', marginBottom: 8 }}>
                Profile Already Linked
              </div>
              <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20 }}>
                Your account is already connected to a player record.
              </div>
              <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </button>
            </div>
          ) : done ? (
            <div className="done-card">
              <div className="done-icon">🎉</div>
              <div className="done-title">Profile Claimed!</div>
              <div className="done-sub" style={{ marginBottom: 24 }}>
                You are now linked to <strong style={{ color: '#86efac' }}>{selected?.first_name} {selected?.last_name}</strong>. Your stats and history are now visible on your dashboard.
              </div>
              <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>
                View My Dashboard →
              </button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Search for your name below. If your record doesn&apos;t appear, ask an admin to add you to the player list first.
              </p>

              <input
                className="input"
                placeholder="Search by name…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ marginBottom: 16, width: '100%' }}
                autoFocus
              />

              {filtered.length === 0 ? (
                <div className="empty-state">
                  {search ? `No unclaimed players matching "${search}"` : 'No unclaimed players found.'}
                </div>
              ) : (
                <div>
                  {filtered.map(p => {
                    const isSelected = selected?.id === p.id
                    const initials = `${p.first_name[0]}${p.last_name[0]}`.toUpperCase()
                    const meta = [p.batting_style, p.bowling_style].filter(Boolean).join(' · ')
                    return (
                      <div
                        key={p.id}
                        className={`player-card${isSelected ? ' selected' : ''}`}
                        onClick={() => setSelected(isSelected ? null : p)}
                      >
                        <div className="player-avatar">{initials}</div>
                        <div style={{ flex: 1 }}>
                          <div className="player-name">{p.first_name} {p.last_name}</div>
                          {meta && <div className="player-meta">{meta}</div>}
                        </div>
                        {isSelected && (
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {selected && (
                <div className="confirm-panel">
                  <div className="confirm-label">You are claiming:</div>
                  <div className="confirm-name">{selected.first_name} {selected.last_name}</div>
                  {(selected.batting_style || selected.bowling_style) && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16 }}>
                      {[selected.batting_style, selected.bowling_style].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  {error && <p style={{ color: 'var(--red, #ef4444)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={handleClaim}
                      style={{ flex: 1, justifyContent: 'center', padding: '12px 0' }}
                    >
                      {saving ? 'Claiming…' : 'Confirm — This Is Me'}
                    </button>
                    <button
                      className="btn btn-ghost"
                      onClick={() => setSelected(null)}
                      style={{ padding: '12px 16px' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}
