'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

const ALL_ROLES = ['player', 'shop', 'scorer', 'coach', 'admin'] as const
type Role = (typeof ALL_ROLES)[number]

const ROLE_BADGE: Record<Role, string> = {
  player:  'badge-blue',
  shop:    'badge-gold',
  scorer:  'badge-gold',
  coach:   'badge-lime',
  admin:   'badge-lime',
}

interface RoleEntry { id: string; role: string; assigned_at: string }
interface UserRow {
  id: string
  email: string
  full_name: string | null
  created_at: string
  roles: RoleEntry[]
}

export default function AdminUsersPage() {
  const [users, setUsers]           = useState<UserRow[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [pendingRoles, setPendingRoles] = useState<Record<string, Role>>({})
  const [saving, setSaving]         = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }, [])

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/users', {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error('Failed to load users')
      setUsers(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [getToken])

  useEffect(() => { loadUsers() }, [loadUsers])

  async function handleAssign(userId: string) {
    const role = pendingRoles[userId] ?? availableRolesFor(userId)[0]
    if (!role) return
    setSaving(`assign:${userId}`)
    setError(null)
    const token = await getToken()
    const res = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, role }),
    })
    const result = await res.json()
    setSaving(null)
    if (!res.ok) { setError(result.error); return }
    await loadUsers()
    setPendingRoles(prev => { const n = { ...prev }; delete n[userId]; return n })
  }

  async function handleRevoke(userId: string, roleEntry: RoleEntry) {
    setSaving(`revoke:${roleEntry.id}`)
    setError(null)
    const { error: err } = await supabase.from('user_roles').delete().eq('id', roleEntry.id)
    if (err) { setError(err.message); setSaving(null); return }
    await supabase.from('audit_log').insert({
      action: 'role_revoked',
      entity_type: 'user_roles',
      entity_id: roleEntry.id,
      old_data: { user_id: userId, role: roleEntry.role },
    })
    setSaving(null)
    setUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, roles: u.roles.filter(r => r.id !== roleEntry.id) } : u
    ))
  }

  async function handleDelete(userId: string) {
    setSaving(`delete:${userId}`)
    setError(null)
    const token = await getToken()
    const res = await fetch(`/api/admin/users/${userId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    setSaving(null)
    setConfirmDelete(null)
    if (!res.ok) { setError(result.error); return }
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  function availableRolesFor(userId: string) {
    const user = users.find(u => u.id === userId)
    if (!user) return [...ALL_ROLES]
    return ALL_ROLES.filter(r => !user.roles.some(er => er.role === r))
  }

  const filtered = users.filter(u =>
    !search ||
    u.email.toLowerCase().includes(search.toLowerCase()) ||
    (u.full_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        .um-search {
          width: 100%; padding: 10px 14px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; color: var(--text); font-size: 14px;
          margin-bottom: 24px;
        }
        .um-search:focus { outline: none; border-color: var(--blue-mid); }
        .um-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .um-wrap .table { min-width: 640px; }
        .um-role-list { display: flex; flex-wrap: wrap; gap: 5px; align-items: center; }
        .um-role-chip {
          display: inline-flex; align-items: center; gap: 3px;
          padding: 2px 8px 2px 10px; border-radius: 12px; font-size: 11px; font-weight: 600;
          background: var(--surface); border: 1px solid var(--border); color: var(--text);
          line-height: 1.6; white-space: nowrap;
        }
        .um-role-chip button {
          background: none; border: none; cursor: pointer; padding: 0 0 0 2px;
          color: var(--muted); font-size: 14px; line-height: 1; display: flex; align-items: center;
        }
        .um-role-chip button:hover { color: var(--red); }
        .um-role-chip button:disabled { opacity: 0.4; cursor: not-allowed; }
        .um-add-row { display: flex; gap: 6px; align-items: center; }
        .um-select {
          padding: 5px 8px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; color: var(--text); font-size: 12px; min-height: 32px;
        }
        .um-name { font-weight: 600; font-size: 14px; color: var(--text); }
        .um-email { font-size: 12px; color: var(--muted); margin-top: 1px; }
        .um-del-row { display: flex; gap: 6px; align-items: center; white-space: nowrap; }
        .um-del-label { font-size: 12px; color: var(--muted); }
        .um-count { font-size: 12px; color: var(--muted); margin-bottom: 16px; }
      `}</style>

      <div className="page-hero">
        <div className="container">
          <div className="section-label">Admin</div>
          <h1>User Management</h1>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, maxWidth: 900 }}>
        {error && (
          <div style={{
            color: 'var(--red)', background: 'rgba(239,68,68,0.08)',
            border: '1px solid var(--red)', borderRadius: 4,
            padding: '10px 14px', marginBottom: 16, fontSize: 13,
          }}>
            {error}
          </div>
        )}

        <input
          className="um-search"
          placeholder="Search by name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading…</div>
        ) : (
          <>
            <div className="um-count">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</div>
            <div className="um-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Current Roles</th>
                    <th>Add Role</th>
                    <th>Joined</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(u => {
                    const available = availableRolesFor(u.id)
                    const isDeleting = saving === `delete:${u.id}`

                    return (
                      <tr key={u.id}>
                        <td>
                          {u.full_name && <div className="um-name">{u.full_name}</div>}
                          <div className="um-email">{u.email}</div>
                        </td>

                        <td>
                          <div className="um-role-list">
                            {u.roles.length === 0 && (
                              <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>
                            )}
                            {u.roles.map(r => (
                              <span key={r.id} className={`um-role-chip badge ${ROLE_BADGE[r.role as Role] ?? 'badge-blue'}`}>
                                {r.role}
                                <button
                                  title={`Revoke ${r.role}`}
                                  disabled={saving === `revoke:${r.id}`}
                                  onClick={() => handleRevoke(u.id, r)}
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                          </div>
                        </td>

                        <td>
                          {available.length > 0 && (
                            <div className="um-add-row">
                              <select
                                className="um-select"
                                value={pendingRoles[u.id] ?? available[0]}
                                onChange={e => setPendingRoles(prev => ({
                                  ...prev,
                                  [u.id]: e.target.value as Role,
                                }))}
                              >
                                {available.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 12, padding: '5px 12px', minHeight: 32 }}
                                disabled={saving === `assign:${u.id}`}
                                onClick={() => handleAssign(u.id)}
                              >
                                {saving === `assign:${u.id}` ? '…' : 'Assign'}
                              </button>
                            </div>
                          )}
                        </td>

                        <td style={{ color: 'var(--muted)', fontSize: 12, whiteSpace: 'nowrap' }}>
                          {new Date(u.created_at).toLocaleDateString()}
                        </td>

                        <td>
                          {confirmDelete === u.id ? (
                            <div className="um-del-row">
                              <span className="um-del-label">Sure?</span>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 12, color: 'var(--red)', padding: '2px 8px' }}
                                disabled={isDeleting}
                                onClick={() => handleDelete(u.id)}
                              >
                                {isDeleting ? '…' : 'Delete'}
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 12, padding: '2px 8px' }}
                                onClick={() => setConfirmDelete(null)}
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 12, color: 'var(--muted)', padding: '2px 8px' }}
                              onClick={() => setConfirmDelete(u.id)}
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ color: 'var(--muted)', textAlign: 'center', padding: 32 }}>
                        {search ? `No users matching "${search}"` : 'No users found'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
