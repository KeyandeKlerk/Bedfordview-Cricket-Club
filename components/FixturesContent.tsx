import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })
}
function formatTime(d: string) {
  return new Date(d).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })
}

export default async function FixturesContent({ category }: { category: 'senior' | 'junior' }) {
  let fixtures: any[] = []
  try {
    // Step 1: resolve team IDs for this category
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id')
      .eq('category', category)
      .eq('is_active', true)
    const teamIds = (teamRows ?? []).map((t: any) => t.id)

    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('matches')
        .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name, overs_per_innings, match_format)')
        .eq('status', 'upcoming')
        .in('team_id', teamIds)
        .order('match_date', { ascending: true })
      fixtures = data ?? []
    }
  } catch (_) {}

  const grouped: Record<string, any[]> = {}
  fixtures.forEach(m => {
    const month = new Date(m.match_date).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' })
    if (!grouped[month]) grouped[month] = []
    grouped[month].push(m)
  })

  const label = category === 'junior' ? 'Junior' : 'Senior'

  return (
    <>
      <style>{`
        .fixtures-page { padding-top: var(--nav-h); min-height: 100vh; }
        .fixtures-body { padding: 48px 0 80px; }

        .month-group { margin-bottom: 52px; }
        .month-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.25em;
          text-transform: uppercase;
          color: #38bdf8;
          margin-bottom: 16px;
          display: flex; align-items: center; gap: 12px;
        }
        .month-label::after {
          content: '';
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, rgba(59,130,246,0.2), transparent);
        }

        .fixture-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 12px;
          margin-bottom: 10px;
          display: flex;
          overflow: hidden;
          transition: border-color 0.2s, background 0.2s, transform 0.15s;
          position: relative;
        }
        .fixture-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent);
        }
        .fixture-card:hover {
          border-color: rgba(96,165,250,0.3);
          background: rgba(37,99,235,0.07);
          transform: translateY(-1px);
        }

        .fixture-accent {
          width: 4px;
          background: linear-gradient(180deg, #2563eb, #38bdf8);
          flex-shrink: 0;
        }

        .fixture-body {
          flex: 1;
          padding: 20px 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .fixture-teams {
          font-family: 'Syne', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #e2eeff;
          margin-bottom: 10px;
          letter-spacing: -0.02em;
          display: flex; align-items: center; gap: 10px;
        }
        .fixture-vs {
          font-family: 'Outfit', sans-serif;
          font-size: 12px; font-weight: 600;
          color: #38bdf8;
          padding: 2px 8px; border-radius: 4px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.2);
        }

        .fixture-meta {
          display: flex;
          gap: 20px;
          flex-wrap: wrap;
        }
        .fixture-meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          color: rgba(147,197,253,0.55);
        }
        .fixture-meta-icon { font-size: 12px; opacity: 0.7; }

        .fixture-right {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
          flex-shrink: 0;
        }
        .format-badge {
          padding: 4px 12px; border-radius: 6px;
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
        }
        .format-t20 {
          background: rgba(37,99,235,0.15);
          border: 1px solid rgba(59,130,246,0.3);
          color: #93c5fd;
        }
        .format-od {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          color: #fbbf24;
        }

        @media (max-width: 768px) {
          .fixture-body { padding: 16px 18px; }
          .fixture-teams { font-size: 17px; margin-bottom: 8px; }
          .fixture-meta { gap: 10px; }
          .fixture-meta-item { font-size: 11px; }
          .fixtures-body { padding: 32px 0 64px; }
        }
        @media (max-width: 480px) {
          .fixture-body { flex-direction: column; align-items: flex-start; gap: 10px; }
          .fixture-right { align-items: flex-start; flex-direction: row; gap: 8px; }
          .fixture-teams { font-size: 15px; gap: 8px; }
          .fixture-meta { gap: 8px; }
        }

        .empty-page { padding: 80px 0; text-align: center; }
        .empty-page-title {
          font-family: 'Syne', sans-serif;
          font-size: 24px; font-weight: 800;
          color: rgba(147,197,253,0.3);
          margin-bottom: 12px;
          letter-spacing: -0.01em;
        }
        .empty-page p { font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(147,197,253,0.3); }
      `}</style>

      <div className="fixtures-page">
        <div className="page-hero">
          <div className="container">
            <div className="section-label">{label} Schedule</div>
            <h1>{label} Fixtures</h1>
            <p style={{ marginTop: 14, fontSize: 16 }}>Upcoming {label.toLowerCase()} matches for Bedfordview Cricket Club.</p>
          </div>
        </div>

        <div className="container fixtures-body">
          {Object.keys(grouped).length === 0 ? (
            <div className="empty-page">
              <div className="empty-page-title">No fixtures scheduled</div>
              <p>Check back soon for upcoming {label.toLowerCase()} matches.</p>
            </div>
          ) : (
            Object.entries(grouped).map(([month, ms]) => (
              <div key={month} className="month-group">
                <div className="month-label">{month}</div>
                {ms.map(m => (
                  <div key={m.id} className="fixture-card">
                    <div className="fixture-accent" />
                    <div className="fixture-body">
                      <div>
                        <div className="fixture-teams">
                          BCC
                          <span className="fixture-vs">vs</span>
                          {m.opponent?.canonical_name ?? 'TBC'}
                        </div>
                        <div className="fixture-meta">
                          <span className="fixture-meta-item">
                            <span className="fixture-meta-icon">📅</span>
                            {formatDate(m.match_date)}
                          </span>
                          <span className="fixture-meta-item">
                            <span className="fixture-meta-icon">🕐</span>
                            {formatTime(m.match_date)}
                          </span>
                          {m.ground?.name && (
                            <span className="fixture-meta-item">
                              <span className="fixture-meta-icon">📍</span>
                              {m.ground.name}
                            </span>
                          )}
                          {m.competition?.name && (
                            <span className="fixture-meta-item">
                              <span className="fixture-meta-icon">🏆</span>
                              {m.competition.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="fixture-right">
                        <span className={`format-badge ${m.competition?.match_format === 't20' ? 'format-t20' : 'format-od'}`}>
                          {m.competition?.match_format === 't20' ? 'T20' : `${m.competition?.overs_per_innings ?? '?'} ov`}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  )
}
