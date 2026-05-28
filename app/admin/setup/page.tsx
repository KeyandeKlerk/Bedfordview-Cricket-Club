// app/admin/setup/page.tsx
import Link from 'next/link'
import { serverSupabase } from '@/lib/supabase/server'
import { getClubConfig } from '@/lib/club-config'
import { getSetupSteps, isOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const [config, playerRes, seasonRes, matchRes, windowRes] = await Promise.all([
    getClubConfig(),
    serverSupabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
    serverSupabase.from('seasons').select('*', { count: 'exact', head: true }),
    serverSupabase.from('matches').select('*', { count: 'exact', head: true }),
    serverSupabase.from('availability_windows').select('*', { count: 'exact', head: true }),
  ])

  const steps = getSetupSteps({
    clubName: config.club_name,
    playerCount: playerRes.count ?? 0,
    seasonCount: seasonRes.count ?? 0,
    matchCount: matchRes.count ?? 0,
    windowCount: windowRes.count ?? 0,
  })
  const done = steps.filter(s => s.done).length
  const allDone = isOnboarded(steps)

  return (
    <>
      <style>{`
        .setup-step {
          display: flex; align-items: flex-start; gap: 16px;
          padding: 20px; background: var(--panel);
          border: 1px solid var(--border); border-radius: 6px;
          margin-bottom: 12px; text-decoration: none; color: inherit;
          transition: border-color 0.15s;
        }
        .setup-step:hover { border-color: var(--blue-mid); }
        .setup-step.done { opacity: 0.55; }
        .setup-icon {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; flex-shrink: 0; margin-top: 2px;
        }
        .setup-icon.complete { background: rgba(34,197,94,0.15); color: #4ade80; }
        .setup-icon.pending  { background: var(--surface); color: var(--muted); }
        .setup-label { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
        .setup-desc  { font-size: 13px; color: var(--muted); }
        .setup-arrow { margin-left: auto; color: var(--muted); align-self: center; flex-shrink: 0; }
      `}</style>

      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Admin</div>
            <h1>Club Setup</h1>
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>
              {allDone
                ? 'Setup complete — your club is ready to go.'
                : `Complete these ${steps.length} steps to get your club set up.`}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 680 }}>
          {/* Progress bar */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 32, padding: '16px 20px',
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 6,
          }}>
            <div style={{ flex: 1, height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(done / steps.length) * 100}%`,
                background: 'var(--blue-mid)', borderRadius: 3,
              }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {done} of {steps.length} complete
            </span>
          </div>

          {steps.map(step => (
            <Link
              key={step.key}
              href={step.href}
              className={`setup-step${step.done ? ' done' : ''}`}
            >
              <div className={`setup-icon ${step.done ? 'complete' : 'pending'}`}>
                {step.done ? '✓' : '○'}
              </div>
              <div>
                <div className="setup-label">{step.label}</div>
                <div className="setup-desc">{step.desc}</div>
              </div>
              {!step.done && <span className="setup-arrow">→</span>}
            </Link>
          ))}

          {allDone && (
            <div style={{
              marginTop: 24, padding: '16px 20px',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 6, color: '#4ade80', fontSize: 14, fontWeight: 600,
            }}>
              All steps complete. Your club is ready to use.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
