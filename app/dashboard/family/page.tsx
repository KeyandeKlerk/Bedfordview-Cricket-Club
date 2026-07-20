'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { age } from '@/lib/family'

interface Player {
  id: string
  first_name: string
  last_name: string
  date_of_birth: string | null
  user_id: string | null
  batting_style: string | null
  bowling_style: string | null
}

interface Dependent {
  linkId: string
  relationship: string
  player: Player
  isClaimed: boolean
  canClaim: boolean
}

async function authedFetch(path: string, options: RequestInit = {}) {
  const { data: { session } } = await supabase.auth.getSession()
  return fetch(path, {
    ...options,
    headers: {
      ...(options.headers ?? {}),
      Authorization: `Bearer ${session?.access_token ?? ''}`,
    },
  })
}

export default function FamilyPage() {
  const router = useRouter()
  const [dependents, setDependents] = useState<Dependent[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addForm, setAddForm] = useState({ firstName: '', lastName: '', dateOfBirth: '' })
  const [saving, setSaving] = useState(false)
  const [inviteMessage, setInviteMessage] = useState<{ playerId: string; message: string } | null>(null)

  async function load() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const res = await authedFetch('/api/dependents')
    if (!res.ok) { setError('Failed to load dependents.'); setLoading(false); return }
    const data = await res.json()
    setDependents(data.dependents ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleAddDependent() {
    setError(null)
    if (!addForm.firstName || !addForm.lastName || !addForm.dateOfBirth) {
      setError("Please fill in your child's name and date of birth.")
      return
    }
    setSaving(true)
    const res = await authedFetch('/api/dependents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addForm),
    })
    const data = await res.json()
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Failed to add dependent.'); return }
    setAddForm({ firstName: '', lastName: '', dateOfBirth: '' })
    setShowAddForm(false)
    load()
  }

  async function handleInviteClaim(playerId: string) {
    const res = await authedFetch(`/api/dependents/${playerId}/invite-claim`, { method: 'POST' })
    const data = await res.json()
    if (!res.ok) { setError(data.error || 'Failed to generate invite.'); return }
    setInviteMessage({ playerId, message: data.message })
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: 'var(--muted)', fontSize: 14 }}>Loading…</div>
    </div>
  )

  return (
    <>
      <style>{`
        .fam-wrap { min-height: 100vh; padding: var(--nav-h, 64px) 0 60px; }
        .fam-hero {
          background: linear-gradient(180deg, #060f22 0%, #050c1a 100%);
          border-bottom: 1px solid var(--border);
          padding: 40px 0 36px; margin-bottom: 32px;
        }
        .fam-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase; color: var(--sky);
          margin-bottom: 10px; display: flex; align-items: center; gap: 10px;
        }
        .fam-eyebrow::before { content:''; display:inline-block; width:20px; height:1px; background:var(--sky); }
        .fam-title {
          font-family: var(--font-display); font-size: clamp(26px,4vw,40px);
          font-weight: 800; color: #f0f8ff; letter-spacing: -0.02em; margin: 0 0 10px;
        }
        .fam-sub { font-size: 14px; color: var(--muted); line-height: 1.6; max-width: 520px; }
        .fam-body { max-width: 640px; margin: 0 auto; padding: 0 20px; }
        .fam-card {
          padding: 18px 20px; border-radius: 12px;
          border: 1px solid var(--border); background: rgba(255,255,255,0.02);
          margin-bottom: 12px;
        }
        .fam-card-head { display: flex; align-items: center; gap: 14px; }
        .fam-avatar {
          width: 40px; height: 40px; border-radius: 10px; flex-shrink: 0;
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 14px; font-weight: 800; color: #fff;
        }
        .fam-name { font-weight: 600; font-size: 15px; color: var(--text); }
        .fam-meta { font-size: 12px; color: var(--muted); margin-top: 2px; }
        .fam-pill {
          margin-left: auto; padding: 4px 10px; border-radius: 999px;
          font-size: 11px; font-weight: 700; white-space: nowrap;
        }
        .fam-pill.managed { background: rgba(59,130,246,0.12); border: 1px solid rgba(59,130,246,0.3); color: #93c5fd; }
        .fam-pill.claimable { background: rgba(245,158,11,0.12); border: 1px solid rgba(245,158,11,0.3); color: #fbbf24; }
        .fam-pill.claimed { background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.3); color: #86efac; }
        .fam-actions { display: flex; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
        .fam-empty { padding: 40px 0; text-align: center; color: var(--muted); font-size: 14px; }
        .fam-add-form {
          margin-top: 16px; padding: 18px; border-radius: 12px;
          background: rgba(59,130,246,0.06); border: 1px solid rgba(59,130,246,0.24);
        }
        .fam-field { margin-bottom: 12px; }
        .fam-label {
          display: block; font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(147,197,253,0.5); margin-bottom: 6px;
        }
        .fam-invite-msg {
          margin-top: 10px; padding: 10px 12px; border-radius: 8px; font-size: 12px;
          background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.24); color: var(--text);
          line-height: 1.5;
        }
      `}</style>

      <div className="fam-wrap">
        <div className="fam-hero">
          <div className="container">
            <div className="fam-eyebrow">Family</div>
            <h1 className="fam-title">Manage Dependents</h1>
            <p className="fam-sub">
              Add your children as dependents to submit their availability, confirm selection,
              and order kit/membership on their behalf.
            </p>
          </div>
        </div>

        <div className="fam-body">
          {error && (
            <div style={{ padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#fca5a5', fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {dependents.length === 0 ? (
            <div className="fam-empty">You have no linked dependents yet.</div>
          ) : (
            dependents.map(dep => {
              const p = dep.player
              const initials = `${p.first_name[0]}${p.last_name[0]}`.toUpperCase()
              const ageStr = p.date_of_birth ? `${age(p.date_of_birth)} years old` : null
              return (
                <div key={dep.linkId} className="fam-card">
                  <div className="fam-card-head">
                    <div className="fam-avatar">{initials}</div>
                    <div>
                      <div className="fam-name">{p.first_name} {p.last_name}</div>
                      {ageStr && <div className="fam-meta">{ageStr}</div>}
                    </div>
                    <span className={`fam-pill ${dep.isClaimed ? 'claimed' : dep.canClaim ? 'claimable' : 'managed'}`}>
                      {dep.isClaimed ? 'Self-managed' : dep.canClaim ? 'Can claim own login' : 'Managed by you'}
                    </span>
                  </div>

                  {!dep.isClaimed && (
                    <div className="fam-actions">
                      {dep.canClaim && (
                        <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }}
                          onClick={() => handleInviteClaim(p.id)}>
                          Invite to claim their own login
                        </button>
                      )}
                    </div>
                  )}

                  {inviteMessage?.playerId === p.id && (
                    <div className="fam-invite-msg">{inviteMessage.message}</div>
                  )}
                </div>
              )
            })
          )}

          {showAddForm ? (
            <div className="fam-add-form">
              <div className="fam-field">
                <label className="fam-label">First Name *</label>
                <input className="input" style={{ width: '100%' }} value={addForm.firstName}
                  onChange={e => setAddForm(f => ({ ...f, firstName: e.target.value }))} />
              </div>
              <div className="fam-field">
                <label className="fam-label">Last Name *</label>
                <input className="input" style={{ width: '100%' }} value={addForm.lastName}
                  onChange={e => setAddForm(f => ({ ...f, lastName: e.target.value }))} />
              </div>
              <div className="fam-field">
                <label className="fam-label">Date of Birth *</label>
                <input className="input" style={{ width: '100%' }} type="date" value={addForm.dateOfBirth}
                  onChange={e => setAddForm(f => ({ ...f, dateOfBirth: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" disabled={saving} onClick={handleAddDependent}>
                  {saving ? 'Adding…' : 'Add Child'}
                </button>
                <button className="btn btn-ghost" onClick={() => setShowAddForm(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <button className="btn btn-primary" style={{ marginTop: 12 }} onClick={() => setShowAddForm(true)}>
              + Add Another Child
            </button>
          )}
        </div>
      </div>
    </>
  )
}
