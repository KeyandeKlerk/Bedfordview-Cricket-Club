'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, isAdmin } from '@/lib/supabase'
import type { Player } from '@/lib/supabase'
import { usePlayer } from '../PlayerProvider'

type Role = 'member' | 'scorer' | 'admin'

const BATTING_STYLES = ['Right-hand bat', 'Left-hand bat']
const BOWLING_STYLES = [
  'Right-arm fast', 'Right-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin',
  'Left-arm fast', 'Left-arm medium', 'Left-arm orthodox', 'Left-arm wrist-spin', 'Does not bowl',
]

function generatePassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

const EMPTY_FORM = { full_name: '', email: '', batting_style: '', bowling_style: '', role: 'member' as Role }

export default function PlayersPage() {
  const currentPlayer = usePlayer()
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState('')

  // Add player form
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [tempPassword, setTempPassword] = useState('')
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<{ name: string; password: string } | null>(null)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('players').select('*').order('full_name')
      if (error) { setError(error.message); setLoading(false); return }
      setPlayers((data || []) as Player[])
      setLoading(false)
    }
    load()
  }, [])

  function openForm() {
    setForm(EMPTY_FORM)
    setTempPassword(generatePassword())
    setCreated(null)
    setError('')
    setShowForm(true)
  }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleCreate() {
    setError('')
    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Full name and email are required.')
      return
    }
    setCreating(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/create-player', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ ...form, temp_password: tempPassword }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error || 'Failed to create player')
      setPlayers(ps => [...ps, body.player].sort((a, b) => a.full_name.localeCompare(b.full_name)))
      setCreated({ name: form.full_name, password: tempPassword })
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function changeRole(playerId: string, role: Role) {
    setSaving(playerId)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/set-role', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ playerId, role }),
      })
      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error || 'Failed to update role')
      }
      setPlayers(ps => ps.map(p => p.id === playerId ? { ...p, role } : p))
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(null)
    }
  }

  if (loading) return (
    <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>
      Loading…
    </div>
  )

  const roleColor: Record<string, string> = {
    admin: 'var(--lime)',
    scorer: 'var(--gold)',
    coach: '#a78bfa',
    player: '#38bdf8',
    shop: '#fb923c',
    member: 'var(--muted)',
  }

  return (
    <>
      <style>{`
        .pl-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }
        .pl-hero {
          background: var(--deep);
          border-bottom: 1px solid var(--border);
          padding: 32px 0;
          margin-bottom: 40px;
        }
        .pl-hero-row {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }
        .pl-breadcrumb {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }
        .pl-breadcrumb a { color: var(--lime); text-decoration: none; }
        .pl-breadcrumb a:hover { text-decoration: underline; }
        .pl-title {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .pl-subtitle { font-size: 14px; color: var(--muted); margin-top: 6px; }

        /* ADD PLAYER FORM */
        .add-form {
          background: var(--panel);
          border: 1px solid var(--lime);
          border-radius: 4px;
          padding: 24px;
          margin-bottom: 28px;
        }
        .add-form-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          margin-bottom: 20px;
        }
        .add-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 16px;
        }
        @media (max-width: 600px) { .add-form-grid { grid-template-columns: 1fr; } }
        .add-form-actions { display: flex; gap: 10px; margin-top: 20px; flex-wrap: wrap; }

        .temp-pw-row {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(255,255,255,0.04);
          border: 1px solid var(--border);
          border-radius: 2px;
          padding: 10px 14px;
        }
        .temp-pw-label {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--muted);
          flex-shrink: 0;
        }
        .temp-pw-val {
          font-family: monospace;
          font-size: 15px;
          color: var(--lime);
          flex: 1;
          letter-spacing: 0.05em;
        }
        .copy-btn {
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          background: none;
          border: 1px solid var(--border);
          border-radius: 2px;
          color: var(--muted);
          padding: 4px 10px;
          cursor: pointer;
          transition: border-color 0.15s, color 0.15s;
          flex-shrink: 0;
        }
        .copy-btn:hover { border-color: var(--lime); color: var(--lime); }

        /* SUCCESS BANNER */
        .success-banner {
          background: rgba(184,240,0,0.08);
          border: 1px solid rgba(184,240,0,0.3);
          border-radius: 4px;
          padding: 20px 24px;
          margin-bottom: 28px;
        }
        .success-banner-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--lime);
          margin-bottom: 8px;
        }
        .success-banner p { font-size: 14px; color: var(--muted); margin-bottom: 10px; }
        .success-pw-row {
          display: flex;
          align-items: center;
          gap: 10px;
          background: rgba(0,0,0,0.3);
          border-radius: 2px;
          padding: 10px 14px;
          margin-top: 8px;
        }
        .success-pw-val { font-family: monospace; font-size: 16px; color: var(--lime); flex: 1; }

        /* TABLE */
        .pl-table-wrap {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
        }
        .pl-table { width: 100%; border-collapse: collapse; }
        .pl-table th {
          padding: 12px 16px;
          text-align: left;
          font-family: var(--font-display);
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          border-bottom: 1px solid var(--border);
          background: var(--deep);
        }
        .pl-table td {
          padding: 14px 16px;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
          color: var(--text);
          vertical-align: middle;
        }
        .pl-table tr:last-child td { border-bottom: none; }
        .pl-table tr:hover td { background: rgba(255,255,255,0.02); }
        .pl-name { font-weight: 600; }
        .pl-email { color: var(--muted); font-size: 12px; margin-top: 2px; }
        .pl-inactive { opacity: 0.45; }

        .role-select {
          background: var(--deep);
          border: 1px solid var(--border);
          border-radius: 2px;
          color: var(--text);
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          padding: 6px 10px;
          cursor: pointer;
          transition: border-color 0.15s;
        }
        .role-select:hover { border-color: var(--lime); }
        .role-select:disabled { opacity: 0.5; cursor: default; }

        .error-box {
          background: rgba(224,60,46,0.12);
          border: 1px solid rgba(224,60,46,0.3);
          color: var(--red);
          padding: 12px 16px;
          border-radius: 2px;
          font-size: 14px;
          margin-bottom: 20px;
        }
        @media (max-width: 600px) {
          .pl-col-style, .pl-col-joined { display: none; }
        }
      `}</style>

      <div className="pl-page">
        <div className="pl-hero">
          <div className="container">
            <div className="pl-breadcrumb">
              <Link href="/dashboard">Dashboard</Link> / Players
            </div>
            <div className="pl-hero-row">
              <div>
                <div className="pl-title">Manage Squad</div>
                <div className="pl-subtitle">{players.length} registered player{players.length !== 1 ? 's' : ''}</div>
              </div>
              {!showForm && (
                <button className="btn btn-primary" onClick={openForm} style={{ flexShrink: 0 }}>
                  + Add Player
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="container">
          {error && <div className="error-box">{error}</div>}

          {/* SUCCESS BANNER */}
          {created && (
            <div className="success-banner">
              <div className="success-banner-title">Player added</div>
              <p><strong style={{ color: 'var(--text)' }}>{created.name}</strong> has been added to the squad. Share these login credentials with them — they can change their password after signing in.</p>
              <div className="success-pw-row">
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', flexShrink: 0 }}>Temp password</span>
                <span className="success-pw-val">{created.password}</span>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(created.password)}>Copy</button>
              </div>
              <button className="btn btn-ghost" style={{ marginTop: 14, fontSize: 13 }} onClick={() => { setCreated(null); openForm() }}>
                Add Another
              </button>
            </div>
          )}

          {/* ADD PLAYER FORM */}
          {showForm && !created && (
            <div className="add-form">
              <div className="add-form-title">New Player</div>

              <div className="add-form-grid">
                <div className="field">
                  <label>Full Name *</label>
                  <input className="input" value={form.full_name} onChange={e => set('full_name', e.target.value)} placeholder="e.g. James Smith" />
                </div>
                <div className="field">
                  <label>Email Address *</label>
                  <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="player@email.com" />
                </div>
                <div className="field">
                  <label>Batting Style</label>
                  <select className="select" value={form.batting_style} onChange={e => set('batting_style', e.target.value)}>
                    <option value="">Select…</option>
                    {BATTING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Bowling Style</label>
                  <select className="select" value={form.bowling_style} onChange={e => set('bowling_style', e.target.value)}>
                    <option value="">Select…</option>
                    {BOWLING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>

              <div className="field" style={{ marginBottom: 0 }}>
                <label>Role</label>
                <select className="select" value={form.role} onChange={e => set('role', e.target.value)} style={{ maxWidth: 200 }}>
                  <option value="member">Member</option>
                  <option value="scorer">Scorer</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div style={{ marginTop: 20 }}>
                <label style={{ fontSize: 12, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', display: 'block', marginBottom: 8 }}>
                  Temporary Password
                </label>
                <div className="temp-pw-row">
                  <span className="temp-pw-label">Login with</span>
                  <span className="temp-pw-val">{tempPassword}</span>
                  <button className="copy-btn" onClick={() => navigator.clipboard.writeText(tempPassword)}>Copy</button>
                  <button className="copy-btn" onClick={() => setTempPassword(generatePassword())}>New</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                  Share this with the player — they can change it from their profile after signing in.
                </div>
              </div>

              <div className="add-form-actions">
                <button className="btn btn-primary" onClick={handleCreate} disabled={creating}>
                  {creating ? 'Adding…' : 'Add Player'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={creating}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* SEARCH */}
          <div style={{ position: 'relative', marginBottom: 16 }}>
            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--muted)', fontSize: 18, pointerEvents: 'none' }}>⌕</span>
            <input
              className="input"
              style={{ paddingLeft: 40 }}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search players…"
            />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 16, padding: 0, lineHeight: 1 }}>✕</button>
            )}
          </div>

          {/* PLAYERS TABLE */}
          <div className="pl-table-wrap">
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th className="pl-col-style">Batting</th>
                  <th className="pl-col-style">Bowling</th>
                  <th className="pl-col-joined">Joined</th>
                  <th>Role</th>
                </tr>
              </thead>
              <tbody>
                {players.filter(p => !search || p.full_name.toLowerCase().includes(search.toLowerCase()) || p.email.toLowerCase().includes(search.toLowerCase())).map(p => (
                  <tr key={p.id} className={!p.active ? 'pl-inactive' : ''}>
                    <td>
                      <div className="pl-name">{p.full_name}</div>
                      <div className="pl-email">{p.email}</div>
                    </td>
                    <td className="pl-col-style" style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {p.batting_style || '—'}
                    </td>
                    <td className="pl-col-style" style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {p.bowling_style || '—'}
                    </td>
                    <td className="pl-col-joined" style={{ color: 'var(--muted)', fontSize: 13 }}>
                      {new Date(p.joined_date).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td>
                      {p.id === currentPlayer?.id ? (
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: roleColor[p.role] }}>
                          {p.role}
                        </span>
                      ) : (
                        <select
                          className="role-select"
                          value={p.role}
                          disabled={saving === p.id}
                          style={{ color: roleColor[p.role] }}
                          onChange={e => changeRole(p.id, e.target.value as Role)}
                        >
                          <option value="member">Member</option>
                          <option value="scorer">Scorer</option>
                          <option value="admin">Admin</option>
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  )
}
