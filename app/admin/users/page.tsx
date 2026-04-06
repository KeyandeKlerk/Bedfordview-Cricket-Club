'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface UserRole {
  id: string
  user_id: string
  role: string
  assigned_at: string
}

export default function AdminUsersPage() {
  const [roles, setRoles]     = useState<UserRole[]>([])
  const [loading, setLoading] = useState(true)
  const [newUserId, setNewUserId] = useState('')
  const [newRole, setNewRole]     = useState<'scorer' | 'admin'>('scorer')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('user_roles').select('*').order('assigned_at', { ascending: false }).then(({ data }) => {
      if (data) setRoles(data)
      setLoading(false)
    })
  }, [])

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!newUserId.trim()) return
    setSaving(true); setError(null)
    const { data, error } = await supabase
      .from('user_roles')
      .upsert({ user_id: newUserId.trim(), role: newRole }, { onConflict: 'user_id,role' })
      .select().single()
    setSaving(false)
    if (error) { setError(error.message); return }

    // Audit log
    await supabase.from('audit_log').insert({
      action: 'role_assigned',
      entity_type: 'user_roles',
      entity_id: data.id,
      new_data: { user_id: newUserId, role: newRole },
    })

    setRoles(prev => [data, ...prev.filter(r => !(r.user_id === data.user_id && r.role === data.role))])
    setNewUserId('')
  }

  async function handleRevoke(role: UserRole) {
    const { error } = await supabase.from('user_roles').delete().eq('id', role.id)
    if (error) { setError(error.message); return }
    await supabase.from('audit_log').insert({
      action: 'role_revoked',
      entity_type: 'user_roles',
      entity_id: role.id,
      old_data: { user_id: role.user_id, role: role.role },
    })
    setRoles(prev => prev.filter(r => r.id !== role.id))
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="page-hero">
        <div className="container">
          <div className="section-label">Admin</div>
          <h1>User Roles</h1>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, maxWidth: 640 }}>
        <form onSubmit={handleAssign} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4, padding: 24, marginBottom: 32 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>
            Assign Role
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 12, alignItems: 'end' }}>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>User ID (from Supabase Auth)</label>
              <input
                style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 14 }}
                placeholder="user-uuid"
                value={newUserId}
                onChange={e => setNewUserId(e.target.value)}
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 12, color: 'var(--muted)', display: 'block', marginBottom: 4 }}>Role</label>
              <select
                style={{ width: '100%', padding: '8px 12px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 14 }}
                value={newRole}
                onChange={e => setNewRole(e.target.value as 'scorer' | 'admin')}
              >
                <option value="scorer">scorer</option>
                <option value="admin">admin</option>
              </select>
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? '...' : 'Assign'}</button>
          </div>
          {error && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 8 }}>{error}</p>}
        </form>

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading...</div>
        ) : (
          <table className="table">
            <thead><tr><th>User ID</th><th>Role</th><th>Assigned</th><th></th></tr></thead>
            <tbody>
              {roles.map(r => (
                <tr key={r.id}>
                  <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.user_id.slice(0, 16)}...</td>
                  <td><span className={`badge ${r.role === 'admin' ? 'badge-lime' : 'badge-gold'}`}>{r.role}</span></td>
                  <td style={{ color: 'var(--muted)', fontSize: 13 }}>{new Date(r.assigned_at).toLocaleDateString()}</td>
                  <td>
                    <button
                      className="btn btn-ghost"
                      onClick={() => handleRevoke(r)}
                      style={{ fontSize: 12, color: 'var(--red)' }}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
