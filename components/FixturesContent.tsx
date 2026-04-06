'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'

type Category = 'all' | 'senior' | 'junior'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

export default function FixturesContent() {
  const [allFixtures, setAllFixtures] = useState<any[]>([])
  const [category, setCategory] = useState<Category>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('matches')
      .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name, overs_per_innings, match_format, category)')
      .eq('status', 'upcoming')
      .order('match_date', { ascending: true })
      .then(({ data }) => {
        setAllFixtures(data ?? [])
        setLoading(false)
      })
  }, [])

  const fixtures = useMemo(() =>
    category === 'all' ? allFixtures : allFixtures.filter((m: any) => m.competition?.category === category),
    [allFixtures, category]
  )

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {}
    fixtures.forEach((m: any) => {
      const month = new Date(m.match_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
      if (!g[month]) g[month] = []
      g[month].push(m)
    })
    return g
  }, [fixtures])

  return (
    <>
      <style>{`
        .fixtures-page { padding-top: var(--nav-h); min-height: 100vh; }
        .fixtures-body { padding: 32px 0 80px; }

        .cat-filter {
          display: flex; gap: 8px; margin-bottom: 32px; flex-wrap: wrap;
        }
        .cat-btn {
          padding: 8px 18px; border-radius: 20px;
          border: 1px solid rgba(59,130,246,0.2);
          background: transparent; color: rgba(147,197,253,0.55);
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; min-height: 38px;
          touch-action: manipulation; display: flex; align-items: center; gap: 6px;
        }
        .cat-btn:hover { border-color: rgba(59,130,246,0.4); color: rgba(147,197,253,0.85); }
        .cat-btn.active-all  { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.5); color: #93c5fd; }
        .cat-btn.active-senior { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.5); color: #93c5fd; }
        .cat-btn.active-junior { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #6ee7b7; }
        .cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .cat-dot-senior { background: #3b82f6; }
        .cat-dot-junior { background: #10b981; }

        .month-group { margin-bottom: 48px; }
        .month-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: #38bdf8; margin-bottom: 14px;
          display: flex; align-items: center; gap: 12px;
        }
        .month-label::after {
          content: ''; flex: 1; height: 1px;
          background: linear-gradient(90deg, rgba(59,130,246,0.2), transparent);
        }

        .fixture-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 12px; margin-bottom: 10px;
          display: flex; overflow: hidden;
          transition: border-color 0.2s, background 0.2s, transform 0.15s;
          position: relative;
        }
        .fixture-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent);
        }
        .fixture-card:hover { border-color: rgba(96,165,250,0.3); background: rgba(37,99,235,0.07); transform: translateY(-1px); }
        .fixture-accent { width: 4px; background: linear-gradient(180deg, #2563eb, #38bdf8); flex-shrink: 0; }
        .fixture-accent-junior { background: linear-gradient(180deg, #10b981, #34d399); }

        .fixture-body {
          flex: 1; padding: 18px 20px; min-width: 0;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .fixture-left { flex: 1; min-width: 0; }
        .fixture-teams {
          font-family: 'Syne', sans-serif; font-size: 17px; font-weight: 800;
          color: #e2eeff; margin-bottom: 8px; letter-spacing: -0.02em;
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .fixture-vs {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          color: #38bdf8; padding: 2px 7px; border-radius: 4px;
          background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2);
          flex-shrink: 0;
        }
        .fixture-meta { display: flex; gap: 14px; flex-wrap: wrap; }
        .fixture-meta-item {
          display: flex; align-items: center; gap: 5px;
          font-family: 'Outfit', sans-serif; font-size: 12px; color: rgba(147,197,253,0.55);
        }
        .fixture-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .format-badge {
          padding: 4px 10px; border-radius: 6px;
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase; white-space: nowrap;
        }
        .format-t20 { background: rgba(37,99,235,0.15); border: 1px solid rgba(59,130,246,0.3); color: #93c5fd; }
        .format-od  { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.25); color: #fbbf24; }
        .team-pill {
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          padding: 2px 7px; border-radius: 4px; white-space: nowrap;
        }
        .team-pill-senior { background: rgba(37,99,235,0.1); color: rgba(147,197,253,0.6); border: 1px solid rgba(59,130,246,0.15); }
        .team-pill-junior { background: rgba(16,185,129,0.1); color: #6ee7b7; border: 1px solid rgba(16,185,129,0.2); }

        .empty-page { padding: 60px 0; text-align: center; }
        .empty-page-title {
          font-family: 'Syne', sans-serif; font-size: 22px; font-weight: 800;
          color: rgba(147,197,253,0.3); margin-bottom: 10px; letter-spacing: -0.01em;
        }
        .empty-page p { font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(147,197,253,0.3); }

        @media (max-width: 480px) {
          .fixture-body { flex-direction: column; align-items: flex-start; padding: 14px 16px; gap: 10px; }
          .fixture-right { flex-direction: row; align-items: center; gap: 8px; }
          .fixture-teams { font-size: 15px; }
          .fixture-meta { gap: 8px; }
          .fixture-meta-item { font-size: 11px; }
        }
      `}</style>

      <div className="fixtures-page">
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Schedule</div>
            <h1>Fixtures</h1>
            <p style={{ marginTop: 12, fontSize: 15 }}>Upcoming matches for Bedfordview Cricket Club.</p>
          </div>
        </div>

        <div className="container fixtures-body">
          <div className="cat-filter">
            {(['all', 'senior', 'junior'] as Category[]).map(c => (
              <button
                key={c}
                className={`cat-btn${category === c ? ` active-${c}` : ''}`}
                onClick={() => setCategory(c)}
              >
                {c !== 'all' && <span className={`cat-dot cat-dot-${c}`} />}
                {c === 'all' ? 'All Fixtures' : c === 'senior' ? 'Senior' : 'Junior'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="empty-page"><p>Loading fixtures…</p></div>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="empty-page">
              <div className="empty-page-title">No fixtures scheduled</div>
              <p>Check back soon for upcoming matches.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([month, ms]) => (
              <div key={month} className="month-group">
                <div className="month-label">{month}</div>
                {ms.map((m: any) => {
                  const isJunior = m.competition?.category === 'junior'
                  return (
                    <div key={m.id} className="fixture-card">
                      <div className={`fixture-accent${isJunior ? ' fixture-accent-junior' : ''}`} />
                      <div className="fixture-body">
                        <div className="fixture-left">
                          <div className="fixture-teams">
                            BCC
                            <span className="fixture-vs">vs</span>
                            {m.opponent?.canonical_name ?? 'TBC'}
                          </div>
                          <div className="fixture-meta">
                            <span className="fixture-meta-item">📅 {formatDate(m.match_date)}</span>
                            <span className="fixture-meta-item">🕐 {formatTime(m.match_date)}</span>
                            {m.ground?.name && <span className="fixture-meta-item">📍 {m.ground.name}</span>}
                            {m.competition?.name && <span className="fixture-meta-item">🏆 {m.competition.name}</span>}
                          </div>
                        </div>
                        <div className="fixture-right">
                          <span className={`format-badge ${m.competition?.match_format === 't20' ? 'format-t20' : 'format-od'}`}>
                            {m.competition?.match_format === 't20' ? 'T20' : `${m.competition?.overs_per_innings ?? '?'} ov`}
                          </span>
                          {category === 'all' && (
                            <span className={`team-pill team-pill-${isJunior ? 'junior' : 'senior'}`}>
                              {isJunior ? 'Junior' : 'Senior'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
