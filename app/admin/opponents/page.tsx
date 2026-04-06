'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Opponent {
  id: string
  canonical_name: string
  short_name: string | null
  aliases: string[]
}

export default function AdminOpponentsPage() {
  const [opponents, setOpponents] = useState<Opponent[]>([])
  const [loading, setLoading]     = useState(true)
  const [editId, setEditId]       = useState<string | null>(null)
  const [form, setForm]           = useState({ canonical_name: '', short_name: '', aliases: '' })
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState<string | null>(null)

  useEffect(() => {
    supabase.from('opponents').select('*').order('canonical_name').then(({ data }) => {
      if (data) setOpponents(data)
      setLoading(false)
    })
  }, [])

  function startEdit(o: Opponent | null) {
    if (!o) {
      setForm({ canonical_name: '', short_name: '', aliases: '' })
      setEditId('new')
    } else {
      setForm({ canonical_name: o.canonical_name, short_name: o.short_name ?? '', aliases: o.aliases.join(', ') })
      setEditId(o.id)
    }
    setError(null)
  }

  async function handleSave() {
    if (!form.canonical_name.trim()) { setError('Name is required.'); return }
    setSaving(true); setError(null)
    const payload = {
      canonical_name: form.canonical_name.trim(),
      short_name: form.short_name.trim() || null,
      aliases: form.aliases.split(',').map(s => s.trim()).filter(Boolean),
    }
    if (editId === 'new') {
      const { data, error } = await supabase.from('opponents').insert(payload).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      setOpponents(prev => [...prev, data].sort((a, b) => a.canonical_name.localeCompare(b.canonical_name)))
    } else {
      const { error } = await supabase.from('opponents').update(payload).eq('id', editId!)
      if (error) { setError(error.message); setSaving(false); return }
      setOpponents(prev => prev.map(o => o.id === editId ? { ...o, ...payload } : o))
    }
    setSaving(false)
    setEditId(null)
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this opponent? This cannot be undone if matches reference it.')) return
    const { error } = await supabase.from('opponents').delete().eq('id', id)
    if (error) { setError(error.message); return }
    setOpponents(prev => prev.filter(o => o.id !== id))
  }

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <div className="page-hero">
        <div className="container">
          <div className="section-label">Admin</div>
          <h1>Opponents</h1>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, maxWidth: 720 }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 20 }}>
          <button className="btn btn-primary" onClick={() => startEdit(null)}>+ Add Opponent</button>
        </div>

        {editId && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>
              {editId === 'new' ? 'New Opponent' : 'Edit Opponent'}
            </h3>
            <div style={{ display: 'grid', gap: 10, marginBottom: 12 }}>
              <input
                style={inputStyle}
                placeholder="Full name (e.g. Wanderers Cricket Club) *"
                value={form.canonical_name}
                onChange={e => setForm(p => ({ ...p, canonical_name: e.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Short name (e.g. Wanderers)"
                value={form.short_name}
                onChange={e => setForm(p => ({ ...p, short_name: e.target.value }))}
              />
              <input
                style={inputStyle}
                placeholder="Aliases (comma-separated, e.g. Wands, WCC)"
                value={form.aliases}
                onChange={e => setForm(p => ({ ...p, aliases: e.target.value }))}
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
        ) : opponents.length === 0 ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>No opponents yet.</div>
        ) : (
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
            <table className="table">
              <thead>
                <tr><th>Club</th><th>Short Name</th><th>Aliases</th><th></th></tr>
              </thead>
              <tbody>
                {opponents.map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 600 }}>{o.canonical_name}</td>
                    <td style={{ color: 'var(--muted)' }}>{o.short_name || '—'}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 12 }}>{o.aliases.length ? o.aliases.join(', ') : '—'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" onClick={() => startEdit(o)} style={{ fontSize: 12, padding: '4px 10px' }}>Edit</button>
                        <button className="btn btn-ghost" onClick={() => handleDelete(o.id)} style={{ fontSize: 12, padding: '4px 10px', color: 'var(--red)' }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '8px 12px',
  background: 'var(--surface)', border: '1px solid var(--border)',
  borderRadius: 4, color: 'var(--text)', fontSize: 14,
}
