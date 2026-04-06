'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Season { id: string; name: string; is_active: boolean }
interface Competition {
  id: string
  name: string
  season_id: string
  type: string
  overs_per_innings: number
  match_format: string
  is_active: boolean
}

const FORMATS = ['t20', 'odi', 'test', 'hundred', 'club']
const TYPES   = ['league', 'cup', 'friendly', 'tour']

export default function AdminCompetitionsPage() {
  const [seasons, setSeasons]             = useState<Season[]>([])
  const [competitions, setCompetitions]   = useState<Competition[]>([])
  const [filterSeason, setFilterSeason]   = useState('')
  const [loading, setLoading]             = useState(true)
  const [editId, setEditId]               = useState<string | null>(null)
  const [form, setForm]                   = useState({
    name: '', season_id: '', type: 'league', overs_per_innings: '20', match_format: 'club',
  })
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [sRes, cRes] = await Promise.all([
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
        supabase.from('competitions').select('*').order('name'),
      ])
      if (sRes.data) {
        setSeasons(sRes.data)
        const active = sRes.data.find((s: Season) => s.is_active)
        if (active) setFilterSeason(active.id)
      }
      if (cRes.data) setCompetitions(cRes.data)
      setLoading(false)
    }
    load()
  }, [])

  function startEdit(c: Competition | null) {
    if (!c) {
      const active = seasons.find(s => s.is_active)
      setForm({ name: '', season_id: active?.id ?? '', type: 'league', overs_per_innings: '20', match_format: 'club' })
      setEditId('new')
    } else {
      setForm({
        name: c.name, season_id: c.season_id, type: c.type,
        overs_per_innings: String(c.overs_per_innings), match_format: c.match_format,
      })
      setEditId(c.id)
    }
    setError(null)
  }

  async function handleSave() {
    if (!form.name.trim() || !form.season_id) { setError('Name and season are required.'); return }
    setSaving(true); setError(null)
    const payload = {
      name: form.name.trim(),
      season_id: form.season_id,
      type: form.type,
      overs_per_innings: parseInt(form.overs_per_innings) || 20,
      match_format: form.match_format,
    }
    if (editId === 'new') {
      const { data, error } = await supabase.from('competitions').insert({ ...payload, is_active: true }).select().single()
      if (error) { setError(error.message); setSaving(false); return }
      setCompetitions(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    } else {
      const { error } = await supabase.from('competitions').update(payload).eq('id', editId!)
      if (error) { setError(error.message); setSaving(false); return }
      setCompetitions(prev => prev.map(c => c.id === editId ? { ...c, ...payload } : c))
    }
    setSaving(false)
    setEditId(null)
  }

  async function toggleActive(c: Competition) {
    const { error } = await supabase.from('competitions').update({ is_active: !c.is_active }).eq('id', c.id)
    if (!error) setCompetitions(prev => prev.map(x => x.id === c.id ? { ...x, is_active: !c.is_active } : x))
    else setError(error.message)
  }

  const f = (k: keyof typeof form, v: string) => setForm(p => ({ ...p, [k]: v }))
  const visible = competitions.filter(c => !filterSeason || c.season_id === filterSeason)
  const seasonName = (id: string) => seasons.find(s => s.id === id)?.name ?? '—'

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        .comp-form-grid { display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 12px; }
        @media (min-width: 640px) {
          .comp-form-grid { grid-template-columns: 1fr 1fr; }
        }
        .comp-table-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .comp-table-scroll .table { min-width: 560px; }
      `}</style>
      <div className="page-hero">
        <div className="container">
          <div className="section-label">Admin</div>
          <h1>Competitions</h1>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 32, maxWidth: 800 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <select
            style={inputStyle}
            value={filterSeason}
            onChange={e => setFilterSeason(e.target.value)}
          >
            <option value="">All seasons</option>
            {seasons.map(s => <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (active)' : ''}</option>)}
          </select>
          <button className="btn btn-primary" onClick={() => startEdit(null)}>+ Add Competition</button>
        </div>

        {editId && (
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4, padding: 24, marginBottom: 24 }}>
            <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>
              {editId === 'new' ? 'New Competition' : 'Edit Competition'}
            </h3>
            <div className="comp-form-grid">
              <input style={inputStyle} placeholder="Competition name *" value={form.name} onChange={e => f('name', e.target.value)} />
              <select style={inputStyle} value={form.season_id} onChange={e => f('season_id', e.target.value)}>
                <option value="">Select season *</option>
                {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <select style={inputStyle} value={form.type} onChange={e => f('type', e.target.value)}>
                {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <select style={inputStyle} value={form.match_format} onChange={e => f('match_format', e.target.value)}>
                {FORMATS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input
                style={inputStyle}
                type="number"
                placeholder="Overs per innings"
                value={form.overs_per_innings}
                onChange={e => f('overs_per_innings', e.target.value)}
                min={1} max={100}
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
        ) : visible.length === 0 ? (
          <div style={{ color: 'var(--muted)', textAlign: 'center', padding: '40px 0' }}>
            No competitions{filterSeason ? ' for this season' : ''}.
          </div>
        ) : (
          <div className="comp-table-scroll">
            <table className="table">
              <thead>
                <tr><th>Competition</th><th>Season</th><th>Format</th><th>Overs</th><th>Status</th><th></th></tr>
              </thead>
              <tbody>
                {visible.map(c => (
                  <tr key={c.id}>
                    <td style={{ fontWeight: 600 }}>{c.name}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{seasonName(c.season_id)}</td>
                    <td style={{ color: 'var(--muted)', fontSize: 13 }}>{c.match_format} · {c.type}</td>
                    <td style={{ color: 'var(--muted)' }}>{c.overs_per_innings}</td>
                    <td>
                      <span className={`badge ${c.is_active ? 'badge-lime' : 'badge-muted'}`}>
                        {c.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn btn-ghost" onClick={() => startEdit(c)} style={{ fontSize: 12, padding: '4px 10px' }}>Edit</button>
                        <button className="btn btn-ghost" onClick={() => toggleActive(c)} style={{ fontSize: 12, padding: '4px 10px' }}>
                          {c.is_active ? 'Deactivate' : 'Activate'}
                        </button>
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
