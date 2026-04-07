'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface Match {
  id: string
  match_date: string
  venue: string | null
  competitions: { name: string; category: string | null } | null
  opponents: { canonical_name: string } | null
}

interface Selection {
  id: string
  position: number | null
  role: string
  status: string
  confirmed_at: string | null
  withdrawn_at: string | null
}

interface TeamMate {
  player_id: string
  position: number | null
  role: string
  players: { first_name: string; last_name: string } | null
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

const ROLE_LABELS: Record<string, string> = {
  player: 'Playing XI',
  reserve: 'Reserve',
  '12th_man': '12th Man',
}

export default function SelectionConfirmPage() {
  const { matchId } = useParams<{ matchId: string }>()
  const router = useRouter()

  const [match, setMatch] = useState<Match | null>(null)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [teammates, setTeammates] = useState<TeamMate[]>([])
  const [playerId, setPlayerId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [withdrawConfirm, setWithdrawConfirm] = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: playerData } = await supabase
        .from('players')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!playerData) { setLoading(false); return }
      setPlayerId(playerData.id)

      const [matchRes, selectionRes, teamsRes] = await Promise.all([
        supabase
          .from('matches')
          .select('id, match_date, venue, competitions(name, category), opponents(canonical_name)')
          .eq('id', matchId)
          .single(),
        supabase
          .from('selections')
          .select('id, position, role, status, confirmed_at, withdrawn_at')
          .eq('match_id', matchId)
          .eq('player_id', playerData.id)
          .maybeSingle(),
        supabase
          .from('selections')
          .select('player_id, position, role, players(first_name, last_name)')
          .eq('match_id', matchId)
          .eq('status', 'selected')
          .order('position'),
      ])

      if (!matchRes.data) { router.push('/dashboard'); return }
      setMatch(matchRes.data as unknown as Match)
      setSelection(selectionRes.data as Selection | null)
      setTeammates((teamsRes.data ?? []) as unknown as TeamMate[])
      setLoading(false)
    }
    load()
  }, [matchId, router])

  async function handleConfirm() {
    if (!selection) return
    setConfirming(true); setError(null)

    const { error: err } = await supabase
      .from('selections')
      .update({ confirmed_at: new Date().toISOString() })
      .eq('id', selection.id)
      .eq('player_id', playerId)

    setConfirming(false)
    if (err) { setError(err.message); return }
    setSelection(s => s ? { ...s, confirmed_at: new Date().toISOString() } : s)
  }

  async function handleWithdraw() {
    if (!selection) return
    setWithdrawing(true); setError(null)

    const { error: err } = await supabase
      .from('selections')
      .update({ status: 'withdrawn', withdrawn_at: new Date().toISOString() })
      .eq('id', selection.id)
      .eq('player_id', playerId)

    setWithdrawing(false)
    if (err) { setError(err.message); return }
    setSelection(s => s ? { ...s, status: 'withdrawn', withdrawn_at: new Date().toISOString() } : s)
    setWithdrawConfirm(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  if (!playerId) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#f0f8ff', textAlign: 'center' }}>
        No Player Profile
      </div>
      <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', maxWidth: 300 }}>
        You need to claim your player profile to confirm selection.
      </div>
      <button className="btn btn-primary" onClick={() => router.push('/admin/profile/claim')}>
        Claim Profile →
      </button>
    </div>
  )

  if (!selection) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 16, padding: 24 }}>
      <div style={{ fontSize: 40 }}>📋</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#f0f8ff', textAlign: 'center' }}>
        Not Selected
      </div>
      <div style={{ fontSize: 14, color: 'var(--muted)', textAlign: 'center', maxWidth: 300 }}>
        You have not been selected for this match.
      </div>
      <button className="btn btn-ghost" onClick={() => router.push('/dashboard')}>
        ← Dashboard
      </button>
    </div>
  )

  const category = match?.competitions?.category
  const isWithdrawn = selection.status === 'withdrawn'
  const isConfirmed = !!selection.confirmed_at

  return (
    <>
      <style>{`
        .sel-wrap { min-height: 100vh; padding-bottom: 60px; }
        .sel-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid var(--border);
          padding: 40px 0 32px; margin-bottom: 32px;
        }
        .sel-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase; color: var(--sky);
          margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
        }
        .sel-eyebrow::before { content:''; display:inline-block; width:20px; height:1px; background:var(--sky); }
        .sel-title { font-family: var(--font-display); font-size: clamp(22px,4vw,36px); font-weight: 800; color: #f0f8ff; margin: 0 0 6px; }
        .sel-sub { font-size: 14px; color: var(--muted); }
        .sel-body { max-width: 480px; margin: 0 auto; padding: 0 20px; }
        .sel-card {
          padding: 24px; border-radius: 14px;
          border: 1px solid var(--border); background: rgba(255,255,255,0.02);
          margin-bottom: 20px;
        }
        .sel-position {
          font-family: var(--font-display); font-size: 64px; font-weight: 900;
          color: #3b82f6; line-height: 1; margin-bottom: 4px;
        }
        .sel-role-label { font-size: 13px; color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; font-weight: 600; }
        .team-list { list-style: none; padding: 0; margin: 0; }
        .team-item {
          display: flex; align-items: center; gap: 12px;
          padding: 10px 0; border-bottom: 1px solid rgba(255,255,255,0.04);
          font-size: 14px;
        }
        .team-item:last-child { border-bottom: none; }
        .team-pos {
          width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
          background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 12px; font-weight: 700; color: #93c5fd;
        }
        .team-name { color: var(--text); font-weight: 500; }
        .team-name.highlight { color: #93c5fd; font-weight: 700; }
        .confirm-btn {
          width: 100%; padding: 18px; border-radius: 14px;
          background: linear-gradient(135deg, #166534, #15803d);
          border: 1px solid rgba(34,197,94,0.4);
          color: #fff; font-family: var(--font-display); font-size: 18px; font-weight: 800;
          cursor: pointer; transition: opacity 0.15s; margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .confirm-btn:hover:not(:disabled) { opacity: 0.9; }
        .confirm-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .confirmed-banner {
          padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;
          background: rgba(34,197,94,0.08); border: 1px solid rgba(34,197,94,0.3);
        }
        .withdrawn-banner {
          padding: 20px; border-radius: 12px; text-align: center; margin-bottom: 20px;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.3);
        }
        .withdraw-modal {
          position: fixed; inset: 0; background: rgba(0,0,0,0.7);
          display: flex; align-items: center; justify-content: center; z-index: 500; padding: 24px;
        }
        .withdraw-dialog {
          background: #0d1b33; border: 1px solid var(--border); border-radius: 16px;
          padding: 28px; max-width: 360px; width: 100%;
        }
      `}</style>

      {withdrawConfirm && (
        <div className="withdraw-modal" onClick={() => setWithdrawConfirm(false)}>
          <div className="withdraw-dialog" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#fca5a5', marginBottom: 12 }}>
              Withdraw from Match?
            </div>
            <div style={{ fontSize: 14, color: 'var(--muted)', marginBottom: 24, lineHeight: 1.6 }}>
              This will notify the coach that you are no longer available. Make sure you&apos;ve spoken to them first.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                style={{ flex: 1, padding: '12px 0', borderRadius: 10, background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', color: '#fca5a5', cursor: 'pointer', fontWeight: 700 }}
                disabled={withdrawing}
                onClick={handleWithdraw}
              >
                {withdrawing ? 'Withdrawing…' : 'Yes, Withdraw'}
              </button>
              <button className="btn btn-ghost" style={{ padding: '12px 16px' }} onClick={() => setWithdrawConfirm(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="sel-wrap">
        <div className="sel-hero">
          <div className="container">
            <div className="sel-eyebrow">Team Selection</div>
            <h1 className="sel-title">
              BCC vs {match?.opponents?.canonical_name ?? '—'}
            </h1>
            <div className="sel-sub">
              {match && `${formatDate(match.match_date)} · ${formatTime(match.match_date)}`}
              {match?.venue && ` · ${match.venue}`}
              {category && (
                <span style={{ marginLeft: 8, padding: '2px 8px', borderRadius: 6, background: 'rgba(59,130,246,0.15)', color: '#93c5fd', fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {category}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="sel-body">
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {/* Position badge */}
          {selection.role === 'player' && selection.position && (
            <div className="sel-card" style={{ textAlign: 'center' }}>
              <div className="sel-position">#{selection.position}</div>
              <div className="sel-role-label">{ROLE_LABELS[selection.role] ?? selection.role}</div>
            </div>
          )}

          {selection.role !== 'player' && (
            <div className="sel-card" style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>
                {selection.role === 'reserve' ? '🔄' : '🎯'}
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#93c5fd' }}>
                {ROLE_LABELS[selection.role] ?? selection.role}
              </div>
            </div>
          )}

          {/* Status */}
          {isWithdrawn ? (
            <div className="withdrawn-banner">
              <div style={{ fontSize: 28, marginBottom: 8 }}>🚫</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#fca5a5', marginBottom: 4 }}>
                Withdrawn
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                You have withdrawn from this match. Contact the coach if this was a mistake.
              </div>
            </div>
          ) : isConfirmed ? (
            <div className="confirmed-banner">
              <div style={{ fontSize: 28, marginBottom: 8 }}>✅</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#86efac', marginBottom: 4 }}>
                You&apos;re Confirmed!
              </div>
              <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                The coach knows you&apos;ll be there.
              </div>
            </div>
          ) : (
            <button
              className="confirm-btn"
              disabled={confirming}
              onClick={handleConfirm}
            >
              {confirming ? 'Confirming…' : '✅  CONFIRM I\'LL PLAY'}
            </button>
          )}

          {/* Withdraw link */}
          {!isWithdrawn && (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <button
                style={{ background: 'none', border: 'none', color: 'var(--muted)', fontSize: 13, cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                onClick={() => setWithdrawConfirm(true)}
              >
                I need to withdraw
              </button>
            </div>
          )}

          {/* Team list */}
          {teammates.length > 0 && (
            <div className="sel-card">
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 16 }}>
                Selected XI
              </div>
              <ul className="team-list">
                {teammates.map(t => {
                  const isMe = t.player_id === playerId
                  const name = t.players ? `${t.players.first_name} ${t.players.last_name}` : 'Unknown'
                  return (
                    <li key={t.player_id} className="team-item">
                      <div className="team-pos" style={isMe ? { background: 'rgba(59,130,246,0.3)', borderColor: '#3b82f6' } : {}}>
                        {t.position ?? '—'}
                      </div>
                      <span className={`team-name${isMe ? ' highlight' : ''}`}>
                        {name}{isMe ? ' (you)' : ''}
                      </span>
                      {t.role !== 'player' && (
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                          {ROLE_LABELS[t.role] ?? t.role}
                        </span>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          )}

          <button
            className="btn btn-ghost"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            onClick={() => router.push('/dashboard')}
          >
            ← Back to Dashboard
          </button>
        </div>
      </div>
    </>
  )
}
