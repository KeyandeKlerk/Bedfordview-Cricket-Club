'use client'
import { useEffect, useState, useMemo } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase/client'

type Category = 'all' | 'senior' | 'junior'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ResultsContent() {
  const [allResults, setAllResults] = useState<any[]>([])
  const [category, setCategory] = useState<Category>('all')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('matches')
      .select('*, opponent:opponents(canonical_name), ground:grounds(name), competition:competitions(name, match_format, overs_per_innings), team:teams(category)')
      .eq('status', 'completed')
      .order('match_date', { ascending: false })
      .then(({ data }) => {
        setAllResults(data ?? [])
        setLoading(false)
      })
  }, [])

  const results = useMemo(() =>
    category === 'all' ? allResults : allResults.filter((m: any) => m.team?.category === category),
    [allResults, category]
  )

  return (
    <>
      <style>{`
        .results-page { padding-top: var(--nav-h); min-height: 100vh; }
        .results-body { padding: 32px 0 80px; }

        .cat-filter { display: flex; gap: 8px; margin-bottom: 28px; flex-wrap: wrap; }
        .cat-btn {
          padding: 8px 18px; border-radius: 20px;
          border: 1px solid rgba(59,130,246,0.2);
          background: transparent; color: rgba(147,197,253,0.55);
          font-family: 'Outfit', sans-serif; font-size: 13px; font-weight: 600;
          cursor: pointer; transition: all 0.15s; min-height: 38px;
          touch-action: manipulation; display: flex; align-items: center; gap: 6px;
        }
        .cat-btn:hover { border-color: rgba(59,130,246,0.4); color: rgba(147,197,253,0.85); }
        .cat-btn.active-all    { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.5); color: #93c5fd; }
        .cat-btn.active-senior { background: rgba(37,99,235,0.18); border-color: rgba(59,130,246,0.5); color: #93c5fd; }
        .cat-btn.active-junior { background: rgba(16,185,129,0.15); border-color: rgba(16,185,129,0.4); color: #6ee7b7; }
        .cat-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        .cat-dot-senior { background: #3b82f6; }
        .cat-dot-junior { background: #10b981; }

        .result-card {
          background: rgba(5,18,42,0.7); border: 1px solid rgba(59,130,246,0.12);
          border-radius: 12px; margin-bottom: 10px;
          display: flex; overflow: hidden; text-decoration: none;
          transition: border-color 0.2s, background 0.2s, transform 0.15s; position: relative;
        }
        .result-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.2), transparent);
        }
        .result-card:hover { border-color: rgba(96,165,250,0.3); background: rgba(37,99,235,0.07); transform: translateX(3px); }
        .result-accent { width: 4px; background: linear-gradient(180deg, #0ea5e9, #6366f1); flex-shrink: 0; }
        .result-accent-junior { background: linear-gradient(180deg, #10b981, #6366f1); }

        .result-body {
          flex: 1; padding: 16px 20px; min-width: 0;
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
        }
        .result-left { flex: 1; min-width: 0; }
        .result-teams {
          font-family: 'Syne', sans-serif; font-size: 16px; font-weight: 800;
          color: #e2eeff; margin-bottom: 5px; letter-spacing: -0.02em;
          display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
        }
        .result-vs {
          font-family: 'Outfit', sans-serif; font-size: 10px; font-weight: 600;
          color: #38bdf8; padding: 2px 6px; border-radius: 4px;
          background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2); flex-shrink: 0;
        }
        .result-meta {
          font-family: 'Outfit', sans-serif; font-size: 11px; color: rgba(147,197,253,0.5);
          display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
        }
        .result-meta-sep { width: 2px; height: 2px; border-radius: 50%; background: currentColor; }
        .result-right { display: flex; flex-direction: column; align-items: flex-end; gap: 6px; flex-shrink: 0; }
        .result-outcome {
          font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600;
          color: #38bdf8; padding: 3px 9px; border-radius: 5px;
          background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.2);
          max-width: 150px; text-align: right; word-break: break-word;
        }
        .format-pill {
          padding: 3px 8px; border-radius: 5px;
          font-family: 'Outfit', sans-serif; font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap;
        }
        .format-t20 { background: rgba(37,99,235,0.12); border: 1px solid rgba(59,130,246,0.25); color: #93c5fd; }
        .format-od  { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); color: #fbbf24; }
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
          color: rgba(147,197,253,0.3); margin-bottom: 10px;
        }
        .empty-page p { font-family: 'Outfit', sans-serif; font-size: 14px; color: rgba(147,197,253,0.3); }

        @media (max-width: 480px) {
          .result-body { flex-direction: column; align-items: flex-start; padding: 12px 16px; gap: 8px; }
          .result-right { flex-direction: row; align-items: center; flex-wrap: wrap; gap: 6px; }
          .result-teams { font-size: 14px; }
          .result-outcome { max-width: none; text-align: left; }
        }
      `}</style>

      <div className="results-page">
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Match History</div>
            <h1>Results</h1>
            <p style={{ marginTop: 12, fontSize: 15 }}>Full scorecards from every completed match.</p>
          </div>
        </div>

        <div className="container results-body">
          <div className="cat-filter">
            {(['all', 'senior', 'junior'] as Category[]).map(c => (
              <button
                key={c}
                className={`cat-btn${category === c ? ` active-${c}` : ''}`}
                onClick={() => setCategory(c)}
              >
                {c !== 'all' && <span className={`cat-dot cat-dot-${c}`} />}
                {c === 'all' ? 'All Results' : c === 'senior' ? 'Senior' : 'Junior'}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="empty-page"><p>Loading results…</p></div>
          ) : results.length === 0 ? (
            <div className="empty-page">
              <div className="empty-page-title">No results yet</div>
              <p>Results will appear here once matches are completed.</p>
            </div>
          ) : (
            results.map((m: any) => {
              const isJunior = m.team?.category === 'junior'
              return (
                <Link key={m.id} href={`/results/${m.id}`} className="result-card">
                  <div className={`result-accent${isJunior ? ' result-accent-junior' : ''}`} />
                  <div className="result-body">
                    <div className="result-left">
                      <div className="result-teams">
                        BCC
                        <span className="result-vs">vs</span>
                        {m.opponent?.canonical_name ?? 'Unknown'}
                      </div>
                      <div className="result-meta">
                        {formatDate(m.match_date)}
                        {m.ground?.name && <><span className="result-meta-sep" />{m.ground.name}</>}
                        {m.competition?.name && <><span className="result-meta-sep" />{m.competition.name}</>}
                      </div>
                    </div>
                    <div className="result-right">
                      <span className={`format-pill ${m.competition?.match_format === 't20' ? 'format-t20' : 'format-od'}`}>
                        {m.competition?.match_format === 't20' ? 'T20' : `${m.competition?.overs_per_innings ?? '?'} ov`}
                      </span>
                      {m.result_text && <div className="result-outcome">{m.result_text}</div>}
                      {category === 'all' && (
                        <span className={`team-pill team-pill-${isJunior ? 'junior' : 'senior'}`}>
                          {isJunior ? 'Junior' : 'Senior'}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
