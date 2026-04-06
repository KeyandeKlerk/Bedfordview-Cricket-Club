'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function NewMatchPage() {
  const router = useRouter()
  const [seasons, setSeasons]           = useState<any[]>([])
  const [competitions, setCompetitions] = useState<any[]>([])
  const [opponents, setOpponents]       = useState<any[]>([])
  const [grounds, setGrounds]           = useState<any[]>([])
  const [teams, setTeams]               = useState<any[]>([])

  const [seasonId, setSeasonId]           = useState('')
  const [competitionId, setCompetitionId] = useState('')
  const [opponentId, setOpponentId]       = useState('')
  const [groundId, setGroundId]           = useState('')
  const [matchDate, setMatchDate]         = useState('')
  const [teamCategory, setTeamCategory]   = useState<'senior' | 'junior'>('senior')
  const [ourTeamSide, setOurTeamSide]     = useState<'home' | 'away'>('home')
  const [freeHit, setFreeHit]             = useState(true)
  const [newOpponentName, setNewOpponentName] = useState('')
  const [addingOpponent, setAddingOpponent]   = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const [seasonsRes, opponentsRes, groundsRes, teamsRes] = await Promise.all([
        supabase.from('seasons').select('*').order('start_date', { ascending: false }),
        supabase.from('opponents').select('*').order('canonical_name'),
        supabase.from('grounds').select('*').order('name'),
        supabase.from('teams').select('id, name, category').order('category'),
      ])
      if (seasonsRes.data) {
        setSeasons(seasonsRes.data)
        const active = seasonsRes.data.find((s: any) => s.is_active)
        if (active) setSeasonId(active.id)
      }
      if (opponentsRes.data) setOpponents(opponentsRes.data)
      if (groundsRes.data)   setGrounds(groundsRes.data)
      if (teamsRes.data)     setTeams(teamsRes.data)
    }
    load()
  }, [])

  useEffect(() => {
    if (!seasonId) return
    supabase.from('competitions').select('*')
      .eq('season_id', seasonId)
      .eq('is_active', true)
      .order('name')
      .then(({ data }) => { if (data) setCompetitions(data) })
  }, [seasonId])

  // Auto-set team category when competition is selected
  function handleCompetitionChange(id: string) {
    setCompetitionId(id)
    const comp = competitions.find((c: any) => c.id === id)
    if (comp?.category) setTeamCategory(comp.category)
  }

  const activeSeason = seasons.find(s => s.id === seasonId)
  const selectedComp = competitions.find(c => c.id === competitionId)
  const teamId = teams.find((t: any) => t.category === teamCategory)?.id ?? null

  async function addNewOpponent() {
    if (!newOpponentName.trim()) return
    const { data, error } = await supabase
      .from('opponents')
      .insert({ canonical_name: newOpponentName.trim() })
      .select()
      .single()
    if (error) { setError(error.message); return }
    setOpponents(prev => [...prev, data])
    setOpponentId(data.id)
    setAddingOpponent(false)
    setNewOpponentName('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!seasonId || !competitionId || !opponentId || !matchDate) {
      setError('All required fields must be filled.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { data, error } = await supabase
        .from('matches')
        .insert({
          season_id: seasonId,
          competition_id: competitionId,
          opponent_id: opponentId,
          ground_id: groundId || null,
          match_date: matchDate,
          our_team_side: ourTeamSide,
          free_hit_on_no_ball: freeHit,
          match_format: selectedComp?.match_format ?? 'club',
          overs_per_innings: selectedComp?.overs_per_innings ?? 20,
          status: 'upcoming',
          team_id: teamId,
        })
        .select('id')
        .single()

      if (error) throw error

      await supabase.from('audit_log').insert({
        action: 'match_created',
        entity_type: 'matches',
        entity_id: data.id,
        new_data: { match_date: matchDate, opponent_id: opponentId },
      })

      router.push('/dashboard')
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <style>{`
        .new-match-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }
        .form-section { margin-bottom: 28px; }
        .form-label { font-size: 13px; color: var(--muted); margin-bottom: 6px; display: block; }
        .form-select, .form-input {
          width: 100%; padding: 10px 14px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; color: var(--text); font-size: 14px;
        }
        .form-select:focus, .form-input:focus { outline: none; border-color: var(--lime); }
      `}</style>

      <div className="new-match-page">
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Admin</div>
            <h1>New Match</h1>
          </div>
        </div>

        <div className="container" style={{ maxWidth: 600, paddingTop: 40 }}>
          <form onSubmit={handleSubmit}>
            {/* Season — read-only if active */}
            <div className="form-section">
              <label className="form-label">Season</label>
              {activeSeason ? (
                <div style={{ padding: '10px 14px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 14 }}>
                  {activeSeason.name}
                </div>
              ) : (
                <select className="form-select" value={seasonId} onChange={e => setSeasonId(e.target.value)}>
                  <option value="">Select season...</option>
                  {seasons.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              )}
              {!activeSeason && <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>No active season found. Create one first.</p>}
            </div>

            {/* Competition */}
            <div className="form-section">
              <label className="form-label">Competition *</label>
              <select
                className="form-select"
                value={competitionId}
                onChange={e => handleCompetitionChange(e.target.value)}
                required
              >
                <option value="">Select competition...</option>
                {competitions.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.overs_per_innings} ov · {c.category ?? 'senior'})
                  </option>
                ))}
              </select>
              {selectedComp && (
                <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
                  {selectedComp.overs_per_innings} overs · {selectedComp.match_format}
                </p>
              )}
            </div>

            {/* Senior / Junior */}
            <div className="form-section">
              <label className="form-label">Team *</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['senior', 'junior'] as const).map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={teamCategory === cat ? 'btn btn-primary' : 'btn btn-ghost'}
                    onClick={() => setTeamCategory(cat)}
                    style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }}
                  >
                    {cat === 'senior' ? 'Senior XI' : 'Junior XI'}
                  </button>
                ))}
              </div>
              {!teamId && (
                <p style={{ color: 'var(--red)', fontSize: 12, marginTop: 4 }}>
                  No {teamCategory} team found in DB — run migration 008 first.
                </p>
              )}
            </div>

            {/* Opponent */}
            <div className="form-section">
              <label className="form-label">Opponent *</label>
              {addingOpponent ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="form-input"
                    placeholder="Opponent name"
                    value={newOpponentName}
                    onChange={e => setNewOpponentName(e.target.value)}
                  />
                  <button type="button" className="btn btn-primary" onClick={addNewOpponent}>Add</button>
                  <button type="button" className="btn btn-ghost" onClick={() => setAddingOpponent(false)}>Cancel</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="form-select" value={opponentId} onChange={e => setOpponentId(e.target.value)} required>
                    <option value="">Select opponent...</option>
                    {opponents.map(o => <option key={o.id} value={o.id}>{o.canonical_name}</option>)}
                  </select>
                  <button type="button" className="btn btn-ghost" onClick={() => setAddingOpponent(true)} style={{ whiteSpace: 'nowrap', fontSize: 12 }}>
                    + New
                  </button>
                </div>
              )}
            </div>

            {/* Ground */}
            <div className="form-section">
              <label className="form-label">Ground</label>
              <select className="form-select" value={groundId} onChange={e => setGroundId(e.target.value)}>
                <option value="">Select ground (optional)</option>
                {grounds.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* Date/Time */}
            <div className="form-section">
              <label className="form-label">Match Date & Time *</label>
              <input
                className="form-input"
                type="datetime-local"
                value={matchDate}
                onChange={e => setMatchDate(e.target.value)}
                required
              />
            </div>

            {/* Home/Away */}
            <div className="form-section">
              <label className="form-label">We are playing</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {(['home', 'away'] as const).map(side => (
                  <button
                    key={side}
                    type="button"
                    className={ourTeamSide === side ? 'btn btn-primary' : 'btn btn-ghost'}
                    onClick={() => setOurTeamSide(side)}
                    style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }}
                  >
                    {side}
                  </button>
                ))}
              </div>
            </div>

            {/* Free hit */}
            <div className="form-section">
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
                <input
                  type="checkbox"
                  checked={freeHit}
                  onChange={e => setFreeHit(e.target.checked)}
                />
                Free hit after no-ball
              </label>
            </div>

            {error && (
              <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 14 }}>{error}</div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving || !activeSeason}
              style={{ width: '100%', justifyContent: 'center', padding: 14, fontSize: 16 }}
            >
              {saving ? 'Creating...' : 'Create Match'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
