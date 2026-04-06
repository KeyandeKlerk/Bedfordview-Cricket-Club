import { createClient } from '@supabase/supabase-js'
import Link from 'next/link'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default async function ResultsContent({ category }: { category: 'senior' | 'junior' }) {
  let results: any[] = []
  try {
    const { data: teamRows } = await supabase
      .from('teams')
      .select('id')
      .eq('category', category)
      .eq('is_active', true)
    const teamIds = (teamRows ?? []).map((t: any) => t.id)

    if (teamIds.length > 0) {
      const { data } = await supabase
        .from('matches')
        .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name, match_format, overs_per_innings)')
        .eq('status', 'completed')
        .in('team_id', teamIds)
        .order('match_date', { ascending: false })
      results = data ?? []
    }
  } catch (_) {}

  const label = category === 'junior' ? 'Junior' : 'Senior'

  return (
    <>
      <style>{`
        .results-page { padding-top: var(--nav-h); min-height: 100vh; }
        .results-body { padding: 48px 0 80px; }

        .result-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid rgba(59,130,246,0.12);
          border-radius: 12px;
          margin-bottom: 10px;
          display: flex;
          overflow: hidden;
          text-decoration: none;
          transition: border-color 0.2s, background 0.2s, transform 0.15s;
          position: relative;
        }
        .result-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.2), transparent);
        }
        .result-card:hover {
          border-color: rgba(96,165,250,0.3);
          background: rgba(37,99,235,0.07);
          transform: translateX(3px);
        }
        .result-accent {
          width: 4px;
          background: linear-gradient(180deg, #0ea5e9, #6366f1);
          flex-shrink: 0;
        }
        .result-body {
          flex: 1;
          padding: 18px 22px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }
        .result-teams {
          font-family: 'Syne', sans-serif;
          font-size: 17px;
          font-weight: 800;
          color: #e2eeff;
          margin-bottom: 5px;
          letter-spacing: -0.02em;
          display: flex; align-items: center; gap: 8px;
        }
        .result-vs {
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 600;
          color: #38bdf8;
          padding: 2px 7px; border-radius: 4px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.2);
        }
        .result-meta {
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          color: rgba(147,197,253,0.5);
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .result-meta-sep { width: 2px; height: 2px; border-radius: 50%; background: currentColor; }
        .result-right {
          display: flex; flex-direction: column; align-items: flex-end; gap: 8px;
          flex-shrink: 0;
        }
        .result-outcome {
          font-family: 'Outfit', sans-serif;
          font-size: 12px; font-weight: 600;
          color: #38bdf8; white-space: nowrap;
          padding: 4px 10px; border-radius: 6px;
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.2);
        }
        .format-pill {
          padding: 3px 9px; border-radius: 5px;
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
        }
        .format-t20 {
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.25);
          color: #93c5fd;
        }
        .format-od {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.2);
          color: #fbbf24;
        }

        @media (max-width: 768px) {
          .result-body { padding: 14px 18px; gap: 10px; }
          .result-teams { font-size: 15px; margin-bottom: 4px; }
          .result-meta { font-size: 11px; }
          .results-body { padding: 32px 0 64px; }
        }
        @media (max-width: 480px) {
          .result-body { flex-direction: column; align-items: flex-start; gap: 8px; }
          .result-right { align-items: flex-start; flex-direction: row; flex-wrap: wrap; gap: 6px; }
          .result-teams { font-size: 14px; gap: 6px; }
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

      <div className="results-page">
        <div className="page-hero">
          <div className="container">
            <div className="section-label">{label} Match History</div>
            <h1>{label} Results</h1>
            <p style={{ marginTop: 14, fontSize: 16 }}>Full scorecards from every completed {label.toLowerCase()} match.</p>
          </div>
        </div>

        <div className="container results-body">
          {results.length === 0 ? (
            <div className="empty-page">
              <div className="empty-page-title">No results yet</div>
              <p>{label} results will appear here once matches are completed.</p>
            </div>
          ) : (
            results.map(m => (
              <Link key={m.id} href={`/results/${m.id}`} className="result-card">
                <div className="result-accent" />
                <div className="result-body">
                  <div>
                    <div className="result-teams">
                      BCC
                      <span className="result-vs">vs</span>
                      {m.opponent?.canonical_name ?? 'Unknown'}
                    </div>
                    <div className="result-meta">
                      {formatDate(m.match_date)}
                      {m.ground?.name && (
                        <>
                          <span className="result-meta-sep" />
                          {m.ground.name}
                        </>
                      )}
                      {m.competition?.name && (
                        <>
                          <span className="result-meta-sep" />
                          {m.competition.name}
                        </>
                      )}
                    </div>
                  </div>
                  <div className="result-right">
                    <span className={`format-pill ${m.competition?.match_format === 't20' ? 'format-t20' : 'format-od'}`}>
                      {m.competition?.match_format === 't20' ? 'T20' : `${m.competition?.overs_per_innings ?? '?'} ov`}
                    </span>
                    {m.result_text && (
                      <div className="result-outcome">{m.result_text}</div>
                    )}
                  </div>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </>
  )
}
