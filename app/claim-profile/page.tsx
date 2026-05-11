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
}

interface PendingClaim {
  id: string
  player_id: string
  status: string
  created_at: string
  player: { first_name: string; last_name: string } | null
}

export default function ClaimProfilePage() {
  const router = useRouter()
  const [players, setPlayers]       = useState<Player[]>([])
  const [filtered, setFiltered]     = useState<Player[]>([])
  const [selected, setSelected]     = useState<Player | null>(null)
  const [search, setSearch]         = useState('')
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [alreadyLinked, setAlreadyLinked] = useState(false)
  const [pendingClaim, setPendingClaim]   = useState<PendingClaim | null>(null)
  const [submitted, setSubmitted]         = useState(false)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Already linked to a player?
      const { data: linked } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()
      if (linked) { setAlreadyLinked(true); setLoading(false); return }

      // Existing pending claim?
      const { data: claim } = await supabase
        .from('player_claims')
        .select('id, player_id, status, created_at')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle()

      if (claim) {
        const { data: claimedPlayer } = await supabase
          .from('players')
          .select('first_name, last_name')
          .eq('id', claim.player_id)
          .maybeSingle()
        setPendingClaim({ ...claim, player: claimedPlayer })
        setLoading(false)
        return
      }

      // Get players with pending claims so we can exclude them
      const { data: activeClaims } = await supabase
        .from('player_claims')
        .select('player_id')
        .eq('status', 'pending')
      const claimedIds = new Set((activeClaims ?? []).map(c => c.player_id))

      // Unclaimed active players
      const { data } = await supabase
        .from('players')
        .select('id, first_name, last_name, batting_style, bowling_style')
        .is('user_id', null)
        .eq('is_active', true)
        .order('last_name')

      const available = (data ?? []).filter(p => !claimedIds.has(p.id))
      setPlayers(available)
      setFiltered(available)
      setLoading(false)
    }
    init()
  }, [router])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(q ? players.filter(p => `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)) : players)
  }, [search, players])

  async function handleSubmitClaim() {
    if (!selected) return
    setSaving(true); setError(null)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setError('Not logged in'); setSaving(false); return }

    const { error: err } = await supabase.from('player_claims').insert({
      player_id: selected.id,
      user_id: user.id,
      claimant_email: user.email,
    })

    setSaving(false)
    if (err) {
      if (err.code === '23505') {
        setError('This player already has a pending claim, or you already have one in progress.')
      } else {
        setError(err.message)
      }
      return
    }
    setSubmitted(true)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  return (
    <>
      <style>{`
        .cl-wrap { min-height: 100vh; padding: var(--nav-h, 64px) 0 60px; }
        .cl-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid var(--border);
          padding: 40px 0 36px; margin-bottom: 32px;
        }
        .cl-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase; color: var(--sky);
          margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
        }
        .cl-eyebrow::before { content:''; display:inline-block; width:20px; height:1px; background:var(--sky); }
        .cl-title {
          font-family: var(--font-display); font-size: clamp(26px,4vw,40px);
          font-weight: 800; color: #f0f8ff; letter-spacing: -0.02em; margin: 0 0 10px;
        }
        .cl-sub { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 520px; }
        .cl-body { max-width: 560px; margin: 0 auto; padding: 0 20px; }
        .cl-card {
          display: flex; align-items: center; gap: 14px;
          padding: 14px 16px; border-radius: 10px;
          border: 1px solid var(--border); background: rgba(255,255,255,0.02);
          cursor: pointer; transition: border-color 0.15s, background 0.15s; margin-bottom: 8px;
        }
        .cl-card:hover { border-color: rgba(59,130,246,0.4); background: rgba(59,130,246,0.05); }
        .cl-card.selected { border-color: #3b82f6; background: rgba(59,130,246,0.1); }
        .cl-avatar {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #fff;
        }
        .cl-confirm-panel {
          margin-top: 24px; padding: 20px; border-radius: 12px;
          background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.3);
        }
        .cl-state-card {
          padding: 32px; text-align: center; border-radius: 14px; margin-top: 8px;
        }
        .cl-state-card.success { background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3); }
        .cl-state-card.pending { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.3); }
        .cl-state-card.linked  { background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.3); }
        .cl-state-title { font-family: var(--font-display); font-size: 22px; font-weight: 800; margin-bottom: 8px; }
        .cl-state-sub { font-size: 14px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
        .cl-empty { padding: 40px 0; text-align: center; color: var(--muted); font-size: 14px; }
      `}</style>

      <div className="cl-wrap">
        <div className="cl-hero">
          <div className="container">
            <div className="cl-eyebrow">Profile</div>
            <h1 className="cl-title">Claim Your Player Profile</h1>
            <p className="cl-sub">
              Link your account to your player record to unlock your personal stats and history.
            </p>
          </div>
        </div>

        <div className="cl-body">
          {alreadyLinked ? (
            <div className="cl-state-card linked">
              <div style={{ fontSize: 36, marginBottom: 12, color: '#93c5fd' }}>✓</div>
              <div className="cl-state-title" style={{ color: '#93c5fd' }}>Profile Already Linked</div>
              <div className="cl-state-sub">Your account is already connected to a player record.</div>
              <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>Go to Dashboard</button>
            </div>

          ) : pendingClaim ? (
            <div className="cl-state-card pending">
              <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
              <div className="cl-state-title" style={{ color: '#fbbf24' }}>Claim Pending Approval</div>
              <div className="cl-state-sub">
                Your claim for <strong style={{ color: 'var(--text)' }}>
                  {pendingClaim.player?.first_name} {pendingClaim.player?.last_name}
                </strong> is waiting for admin review. You&apos;ll be notified once it&apos;s approved.
              </div>
              <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
            </div>

          ) : submitted ? (
            <div className="cl-state-card success">
              <div style={{ fontSize: 36, marginBottom: 12 }}>📨</div>
              <div className="cl-state-title" style={{ color: '#86efac' }}>Claim Submitted</div>
              <div className="cl-state-sub">
                Your claim for <strong style={{ color: 'var(--text)' }}>
                  {selected?.first_name} {selected?.last_name}
                </strong> has been sent to an admin for approval. You&apos;ll receive a notification when it&apos;s reviewed.
              </div>
              <button className="btn btn-primary" onClick={() => router.push('/dashboard')}>Back to Dashboard</button>
            </div>

          ) : (
            <>
              <p style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 20, lineHeight: 1.6 }}>
                Search for your name below. If you don&apos;t appear, ask an admin to add you to the player list first.
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
                <div className="cl-empty">
                  {search ? `No available players matching "${search}"` : 'No unclaimed players found.'}
                </div>
              ) : (
                filtered.map(p => {
                  const isSelected = selected?.id === p.id
                  const initials = `${p.first_name[0]}${p.last_name[0]}`.toUpperCase()
                  const meta = [p.batting_style, p.bowling_style].filter(Boolean).join(' · ')
                  return (
                    <div
                      key={p.id}
                      className={`cl-card${isSelected ? ' selected' : ''}`}
                      onClick={() => setSelected(isSelected ? null : p)}
                    >
                      <div className="cl-avatar">{initials}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 15, color: 'var(--text)' }}>{p.first_name} {p.last_name}</div>
                        {meta && <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{meta}</div>}
                      </div>
                      {isSelected && (
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      )}
                    </div>
                  )
                })
              )}

              {selected && (
                <div className="cl-confirm-panel">
                  <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 8 }}>Claiming:</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#93c5fd', marginBottom: 4 }}>
                    {selected.first_name} {selected.last_name}
                  </div>
                  {(selected.batting_style || selected.bowling_style) && (
                    <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 14 }}>
                      {[selected.batting_style, selected.bowling_style].filter(Boolean).join(' · ')}
                    </div>
                  )}
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
                    An admin will review your request. Only claim a profile that belongs to you.
                  </p>
                  {error && <p style={{ color: 'var(--red, #ef4444)', fontSize: 13, marginBottom: 12 }}>{error}</p>}
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button
                      className="btn btn-primary"
                      disabled={saving}
                      onClick={handleSubmitClaim}
                      style={{ flex: 1, justifyContent: 'center', padding: '12px 0' }}
                    >
                      {saving ? 'Submitting…' : 'Submit Claim'}
                    </button>
                    <button className="btn btn-ghost" onClick={() => setSelected(null)} style={{ padding: '12px 16px' }}>
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
