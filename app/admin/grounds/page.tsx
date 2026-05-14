'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Ground {
  id: string
  name: string
  location: string | null
}

export default function AdminGroundsPage() {
  const [grounds, setGrounds] = useState<Ground[]>([])
  const [loading, setLoading] = useState(true)
  const [editId, setEditId]   = useState<string | null>(null)
  const [form, setForm]       = useState({ name: '', location: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('grounds').select('*').order('name').then(({ data }) => {
      if (data) setGrounds(data)
      setLoading(false)
    })
  }, [])

  function startEdit(g: Ground | null) {
    if (!g) {
      setForm({ name: '', location: '' })
      setEditId('new')
    } else {
      setForm({ name: g.name, location: g.location ?? '' })
      setEditId(g.id)
    }
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError(null)
    const payload = {
      name: form.name.trim(),
      location: form.location.trim() || null,
    }
    if (editId === 'new') {
      const { data, error } = await supabase.from('grounds').insert(payload).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      setGrounds(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      const { error } = await supabase.from('grounds').update(payload).eq('id', editId!)
      if (error) { setError(error.message); setSaving(false); return }
      setGrounds(prev => prev.map(g => g.id === editId ? { ...g, ...payload } : g))
    }
    setSaving(false)
    setEditId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this ground? Matches linked to it will lose their venue.')) return
    const { error } = await supabase.from('grounds').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setGrounds(prev => prev.filter(g => g.id !== id))
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="page-hero">
        <div className="container">
          <div className="section-label">Admin</div>
          <h1>Grounds</h1>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button className="btn btn-primary" onClick={() => startEdit(null)}>+ Add Ground</button>
        </div>

        {editId && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>
              {editId === 'new' ? 'New Ground' : 'Edit Ground'}
            </h3>
            <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
              <input
                style={inputStyle}
                placeholder="Ground name (e.g. Bedfordview Sports Club) *"
                value={form.name}
                onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Location / address (optional)"
                value={form.location}
                onChange={e => setForm(p => ({ ...p, location: e.target.value }))}
              />
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="btn btn-ghost" onClick={() => setEditId(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ color: 'var(--muted)' }}>Loading...</div>
        ) : grounds.length === 0 ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No grounds yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <table className="table" style={{ minWidth: 400 }}>
              <thead>
                <tr><th>Name</th><th>Location</th><th></th></tr>
              </thead>
              <tbody>
                {grounds.map(g => (
                  <tr key={g.id}>
                    <td style={{ fontWeight: 600 }}>{g.name}</td>
                    <td style={{ color: 'var(--muted)' }}>{g.location || '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" onClick={() => startEdit(g)} style={{ fontSize: 12, padding: '4px 10px' }}>Edit</button>
                        <button className="btn btn-ghost" onClick={() => handleDelete(g.id)} style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red)' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {error && !editId && <p style={{ color: 'var(--red)', fontSize: 13, marginTop: 12 }}>{error}</p>}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text)', fontSize: 14,
}
