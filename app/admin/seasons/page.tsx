'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Season {
  id: string
  name: string
  start_date: string
  end_date: string
  is_active: boolean
}

export default function SeasonsPage() {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm]       = useState({ name: '', start_date: '', end_date: '' })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    supabase.from('seasons').select('*').order('start_date', { ascending: false }).then(({ data }) => {
      if (data) setSeasons(data)
      setLoading(false)
    })
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true); setError(null)
    const { data, error } = await supabase
      .from('seasons')
      .insert({ name: form.name, start_date: form.start_date, end_date: form.end_date })
      .select().single()
    setSaving(false)
    if (error) { setError(error.message); return }
    setSeasons(prev => [data, ...prev])
    setForm({ name: '', start_date: '', end_date: '' })
  }

  async function toggleActive(season: Season) {
    // Partial unique index enforces only one active at a time
    if (!season.is_active) {
      // Deactivate current active first
      const current = seasons.find(s => s.is_active)
      if (current) {
        await supabase.from('seasons').update({ is_active: false }).eq('id', current.id)
        setSeasons(prev => prev.map(s => s.id === current.id ? { ...s, is_active: false } : s))
      }
    }
    const { error } = await supabase.from('seasons').update({ is_active: !season.is_active }).eq('id', season.id)
    if (!error) setSeasons(prev => prev.map(s => s.id === season.id ? { ...s, is_active: !season.is_active } : s))
    else setError(error.message)
  }

  return (
    <>
      <style>{`
        .form-input { width: 100%; padding: 8px 12px; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; color: var(--text); font-size: 14px; min-height: 44px; }
        .season-form-grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 12px; }
        .season-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        @media (max-width: 600px) {
          .season-form-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Admin</div>
            <h1>Seasons</h1>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 640 }}>
          <form onSubmit={handleCreate} style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4, padding: 24, marginBottom: 32 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>New Season</h3>
            <div className="season-form-grid">
              <input className="form-input" placeholder="Name (e.g. 2025/26)" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              <input className="form-input" type="date" placeholder="Start" value={form.start_date} onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))} required />
              <input className="form-input" type="date" placeholder="End" value={form.end_date} onChange={e => setForm(p => ({ ...p, end_date: e.target.value }))} required />
            </div>
            {error && <p style={{ color: 'var(--red)', fontSize: 13, marginBottom: 8 }}>{error}</p>}
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Creating...' : 'Create Season'}</button>
          </form>

          {loading ? (
            <div style={{ color: 'var(--muted)' }}>Loading...</div>
          ) : (
            <div className="season-table-scroll">
              <table className="table">
                <thead><tr><th>Season</th><th>Dates</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {seasons.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ color: 'var(--muted)', fontSize: 13 }}>{s.start_date} → {s.end_date}</td>
                      <td>
                        <span className={`badge ${s.is_active ? 'badge-lime' : 'badge-muted'}`}>
                          {s.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          onClick={() => toggleActive(s)}
                          style={{ fontSize: 12, padding: '4px 10px' }}
                        >
                          {s.is_active ? 'Deactivate' : 'Set Active'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
