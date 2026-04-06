'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { usePlayer } from '../PlayerProvider'

type Opposition = { id: string; name: string; players: string[] }

export default function NewMatchPage() {
  const currentPlayer = usePlayer()
  const [opposition, setOpposition] = useState<Opposition[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Form state
  const [form, setForm] = useState({
    date: '',
    time: '10:00',
    venue: '',
    overs: '20',
    toss_winner: '',
    toss_decision: 'bat',
    away_team_id: '',       // existing opposition id
    away_team_custom: '',   // or type a new name
    use_existing_opp: true,
  })

  useEffect(() => {
    async function load() {
      const opp = await supabase.from('opposition').select('*').order('name').then(r => r.data || [])
      setOpposition(opp as Opposition[])
      setLoading(false)
    }
    load()
  }, [])

  const set = (k: string, v: string | boolean) => setForm(f => ({ ...f, [k]: v }))


  const awayTeamName = form.use_existing_opp
    ? opposition.find(o => o.id === form.away_team_id)?.name || ''
    : form.away_team_custom

  async function handleCreate() {
    setError('')
    if (!form.date) { setError('Please select a match date.'); return }
    if (!awayTeamName) { setError('Please select or enter the opposition team.'); return }
    setSaving(true)
    try {
      const matchDateTime = new Date(`${form.date}T${form.time}:00`)

      // If new opposition team typed, save it
      let oppId = form.use_existing_opp ? form.away_team_id : null
      if (!form.use_existing_opp && form.away_team_custom) {
        const { data: newOpp, error: oppErr } = await supabase
          .from('opposition')
          .insert({ name: form.away_team_custom, players: [] })
          .select()
          .single()
        if (oppErr) throw oppErr
        oppId = newOpp.id
      }

      // Create the match
      const { data: match, error: matchErr } = await supabase
        .from('matches')
        .insert({
          date: matchDateTime.toISOString(),
          home_team: 'Bedfordview CC',
          away_team: awayTeamName,
          venue: form.venue || null,
          overs: parseInt(form.overs),
          status: 'upcoming',
        })
        .select()
        .single()

      if (matchErr) throw matchErr

      window.location.href = `/dashboard?match_created=${match.id}`
    } catch (err: any) {
      setError(err.message || 'Failed to create match. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--muted)' }}>Loading…</div>
  }

  return (
    <>
      <style>{`
        .nm-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }
        .nm-hero {
          background: var(--deep);
          border-bottom: 1px solid var(--border);
          padding: 32px 0;
          margin-bottom: 40px;
        }
        .nm-breadcrumb {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted);
          margin-bottom: 10px;
        }
        .nm-breadcrumb a { color: var(--lime); text-decoration: none; }
        .nm-breadcrumb a:hover { text-decoration: underline; }
        .nm-title {
          font-family: var(--font-display);
          font-size: 40px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .nm-grid {
          display: grid;
          grid-template-columns: 1fr 360px;
          gap: 32px;
          align-items: start;
        }
        @media (max-width: 900px) { .nm-grid { grid-template-columns: 1fr; } }

        .nm-card {
          background: var(--panel);
          border: 1px solid var(--border);
          border-radius: 4px;
          overflow: hidden;
          margin-bottom: 24px;
        }
        .nm-card-header {
          padding: 16px 20px;
          border-bottom: 1px solid var(--border);
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .nm-card-title {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.06em;
          color: var(--text);
        }
        .nm-card-body { padding: 20px; }

        .field-row-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .field-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 600px) {
          .field-row-3, .field-row-2 { grid-template-columns: 1fr; }
        }

        /* OPPOSITION TOGGLE */
        .opp-toggle {
          display: flex;
          gap: 0;
          margin-bottom: 16px;
          border: 1px solid var(--border);
          border-radius: 2px;
          overflow: hidden;
        }
        .opp-toggle-btn {
          flex: 1;
          padding: 10px;
          background: transparent;
          border: none;
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--muted);
          cursor: pointer;
          transition: background 0.15s, color 0.15s;
        }
        .opp-toggle-btn.active {
          background: var(--lime-dim);
          color: var(--lime);
        }

        /* PLAYER SELECTOR */
        .player-select-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px;
          max-height: 360px;
          overflow-y: auto;
          padding-right: 4px;
        }
        @media (max-width: 600px) { .player-select-grid { grid-template-columns: 1fr; } }
        .player-select-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid var(--border);
          border-radius: 4px;
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          user-select: none;
        }
        .player-select-item:hover { background: rgba(255,255,255,0.06); }
        .player-select-item.selected {
          border-color: var(--lime);
          background: var(--lime-dim);
        }
        .player-checkbox {
          width: 18px; height: 18px;
          border: 2px solid var(--border);
          border-radius: 2px;
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          transition: border-color 0.15s, background 0.15s;
        }
        .player-select-item.selected .player-checkbox {
          border-color: var(--lime);
          background: var(--lime);
          color: var(--black);
        }
        .player-select-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--text);
          line-height: 1.2;
        }
        .player-select-sub {
          font-size: 11px;
          color: var(--muted);
        }
        .select-all-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .select-count {
          font-family: var(--font-display);
          font-size: 13px;
          font-weight: 600;
          color: var(--muted);
        }
        .select-count span { color: var(--lime); }
        .select-all-btn {
          font-family: var(--font-display);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--lime);
          background: none;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .select-all-btn:hover { text-decoration: underline; }

        /* SUMMARY SIDEBAR */
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid var(--border);
          font-size: 14px;
        }
        .summary-row:last-child { border-bottom: none; }
        .summary-key { color: var(--muted); }
        .summary-val { color: var(--text); font-weight: 500; font-family: var(--font-display); font-size: 15px; letter-spacing: 0.02em; }
        .summary-val.highlight { color: var(--lime); }

        .error-box {
          background: rgba(224,60,46,0.12);
          border: 1px solid rgba(224,60,46,0.3);
          color: var(--red);
          padding: 12px 16px;
          border-radius: 2px;
          font-size: 14px;
          margin-bottom: 20px;
        }
        .btn-create {
          width: 100%;
          height: 52px;
          font-size: 18px;
          margin-top: 8px;
        }
      `}</style>

      <div className="nm-page">
        <div className="nm-hero">
          <div className="container">
            <div className="nm-breadcrumb">
              <Link href="/dashboard">Dashboard</Link> / New Match
            </div>
            <div className="nm-title">Create Match</div>
          </div>
        </div>

        <div className="container">
          <div className="nm-grid">
            {/* LEFT — FORM */}
            <div>
              {error && <div className="error-box">{error}</div>}

              {/* MATCH DETAILS */}
              <div className="nm-card">
                <div className="nm-card-header">
                  <span style={{ fontSize: 18 }}>📅</span>
                  <div className="nm-card-title">Match Details</div>
                </div>
                <div className="nm-card-body">
                  <div className="field-row-3">
                    <div className="field">
                      <label>Date *</label>
                      <input className="input" type="date" value={form.date}
                        onChange={e => set('date', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Time</label>
                      <input className="input" type="time" value={form.time}
                        onChange={e => set('time', e.target.value)} />
                    </div>
                    <div className="field">
                      <label>Format</label>
                      <select className="select" value={form.overs} onChange={e => set('overs', e.target.value)}>
                        <option value="20">T20 (20 overs)</option>
                        <option value="40">One Day (40 overs)</option>
                        <option value="50">One Day (50 overs)</option>
                        <option value="10">10 overs</option>
                      </select>
                    </div>
                  </div>
                  <div className="field">
                    <label>Venue</label>
                    <input className="input" value={form.venue}
                      onChange={e => set('venue', e.target.value)}
                      placeholder="e.g. Bedfordview Oval" />
                  </div>
                </div>
              </div>

              {/* OPPOSITION */}
              <div className="nm-card">
                <div className="nm-card-header">
                  <span style={{ fontSize: 18 }}>🆚</span>
                  <div className="nm-card-title">Opposition</div>
                </div>
                <div className="nm-card-body">
                  <div className="opp-toggle">
                    <button
                      className={`opp-toggle-btn ${form.use_existing_opp ? 'active' : ''}`}
                      onClick={() => set('use_existing_opp', true)}>
                      Saved Team
                    </button>
                    <button
                      className={`opp-toggle-btn ${!form.use_existing_opp ? 'active' : ''}`}
                      onClick={() => set('use_existing_opp', false)}>
                      New Team
                    </button>
                  </div>

                  {form.use_existing_opp ? (
                    <div className="field">
                      <label>Select Opposition *</label>
                      {opposition.length === 0 ? (
                        <div style={{ color: 'var(--muted)', fontSize: 14, padding: '12px 0' }}>
                          No saved teams yet.{' '}
                          <button className="select-all-btn" onClick={() => set('use_existing_opp', false)}>
                            Add a new team →
                          </button>
                        </div>
                      ) : (
                        <select className="select" value={form.away_team_id}
                          onChange={e => set('away_team_id', e.target.value)}>
                          <option value="">Choose team…</option>
                          {opposition.map(o => (
                            <option key={o.id} value={o.id}>{o.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <div className="field">
                      <label>Opposition Team Name *</label>
                      <input className="input" value={form.away_team_custom}
                        onChange={e => set('away_team_custom', e.target.value)}
                        placeholder="e.g. Old Eds CC" />
                      <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                        This team will be saved for future matches.
                      </div>
                    </div>
                  )}
                </div>
              </div>

            </div>

            {/* RIGHT — SUMMARY */}
            <div>
              <div className="nm-card">
                <div className="nm-card-header">
                  <div className="nm-card-title">Match Summary</div>
                </div>
                <div className="nm-card-body">
                  {[
                    { key: 'Home Team', val: 'Bedfordview CC', highlight: true },
                    { key: 'Away Team', val: awayTeamName || '—' },
                    {
                      key: 'Date', val: form.date
                        ? new Date(`${form.date}T${form.time}`).toLocaleDateString('en-ZA', {
                            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
                          })
                        : '—'
                    },
                    { key: 'Time', val: form.time || '—' },
                    { key: 'Format', val: form.overs === '20' ? 'T20' : `${form.overs} overs` },
                    { key: 'Venue', val: form.venue || 'TBC' },
                  ].map(r => (
                    <div key={r.key} className="summary-row">
                      <span className="summary-key">{r.key}</span>
                      <span className={`summary-val ${r.highlight ? 'highlight' : ''}`}>{r.val}</span>
                    </div>
                  ))}

                  <button className="btn btn-primary btn-create" onClick={handleCreate} disabled={saving}>
                    {saving ? 'Creating…' : 'Create Match'}
                  </button>

                  <Link href="/dashboard" className="btn btn-ghost"
                    style={{ width: '100%', justifyContent: 'center', marginTop: 10, fontSize: 14, padding: '12px' }}>
                    Cancel
                  </Link>
                </div>
              </div>

              <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', borderRadius: 4, padding: '16px 20px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 8 }}>
                  After creating
                </div>
                <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.7 }}>
                  The match will be saved as <strong style={{ color: 'var(--text)' }}>Upcoming</strong>. When you open the scorer on match day, you'll select your XI from the full registered squad at that point.
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}