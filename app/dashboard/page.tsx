import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentPlayerServer } from '@/lib/supabase-server'
import { serverSupabase, anonSupabase as supabase } from '@/lib/supabase/server'
import { getSetupSteps, isOnboarded } from '@/lib/onboarding'
import { getClubConfig, isPro } from '@/lib/club-config'

export const dynamic = 'force-dynamic'

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}


function getAdminLinks(pro: boolean) {
  return [
    { href: '/admin/matches',      icon: '⚡', label: 'Matches',      sub: 'Manage, score & create' },
    { href: '/admin/availability', icon: '📅', label: 'Availability', sub: 'Windows & selection'    },
    { href: '/admin/news',         icon: '📰', label: 'News',         sub: 'Articles & match reports' },
    { href: '/admin/players',      icon: '👤', label: 'Players',      sub: 'Squad, accounts & roles' },
    { href: '/admin/seasons',      icon: '📆', label: 'Seasons',      sub: 'Manage seasons'          },
    { href: '/admin/opponents',    icon: '🏏', label: 'Opponents',    sub: 'Opposition clubs'        },
    { href: '/admin/grounds',      icon: '📍', label: 'Grounds',      sub: 'Match venues'            },
    { href: '/admin/competitions', icon: '🏆', label: 'Competitions', sub: 'Leagues & cups'          },
    { href: '/admin/settings',     icon: '🎨', label: 'Branding',     sub: 'Logo, colours & name'    },
    ...(pro ? [{ href: '/analytics', icon: '📈', label: 'Analytics', sub: 'Season & match analytics' }] : []),
  ]
}

const SCORER_LINKS = [
  { href: '/admin/matches',      icon: '⚡', label: 'Matches',      sub: 'View & score matches', },
  { href: '/admin/availability', icon: '📅', label: 'Availability', sub: 'Windows & selection',  },
]

const SHOP_LINKS = [
  { href: '/admin/orders',   icon: '📦', label: 'Orders',   sub: 'Manage orders',   },
  { href: '/admin/products', icon: '🛒', label: 'Products', sub: 'Manage products', },
]

export default async function DashboardPage() {
  const [player, matchRes, clubConfig] = await Promise.all([
    getCurrentPlayerServer(),
    supabase.from('matches').select('*, opponent:opponents(canonical_name), competition:competitions(match_format, overs_per_innings)').in('status', ['upcoming', 'in_progress', 'completed']).order('match_date', { ascending: false }).limit(20),
    getClubConfig(),
  ])

  if (!player) redirect('/login')

  // Only fetch setup data for roles that see the setup card
  const isAdminOrCoach = player.role === 'admin' || player.role === 'coach'
  const [playerCountRes, seasonCountRes, matchCountRes, windowCountRes] = isAdminOrCoach
    ? await Promise.all([
        serverSupabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
        serverSupabase.from('seasons').select('*', { count: 'exact', head: true }),
        serverSupabase.from('matches').select('*', { count: 'exact', head: true }),
        serverSupabase.from('availability_windows').select('*', { count: 'exact', head: true }),
      ])
    : [{ count: 0 }, { count: 0 }, { count: 0 }, { count: 0 }]

  const setupSteps = getSetupSteps({
    clubName: clubConfig.club_name,
    playerCount: playerCountRes.count ?? 0,
    seasonCount: seasonCountRes.count ?? 0,
    matchCount: matchCountRes.count ?? 0,
    windowCount: windowCountRes.count ?? 0,
  })
  const setupDone = setupSteps.filter(s => s.done).length
  const allSetupDone = isOnboarded(setupSteps)

  const matches = matchRes.data ?? []
  const liveMatch = matches.find(m => m.status === 'in_progress')
  const upcomingAll = matches.filter(m => m.status === 'upcoming')
  const recentAll   = matches.filter(m => m.status === 'completed')
  const upcoming  = upcomingAll.slice(0, 3)
  const recent    = recentAll.slice(0, 3)

  const firstName = player.full_name.split(' ')[0]
  const initials  = player.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  // Membership status for current user
  const { data: membership } = await serverSupabase
    .from('memberships')
    .select('status, tier, valid_until')
    .eq('user_id', player.id)
    .is('player_id', null)
    .maybeSingle()

  // Pending order count for shop badge
  let pendingOrderCount = 0
  if (player.role === 'shop' || player.role === 'admin') {
    const { count } = await serverSupabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_eft')
    pendingOrderCount = count || 0
  }

  // Open availability windows + this player's responses
  const now = new Date().toISOString()
  const { data: openWindows } = await serverSupabase
    .from('availability_windows')
    .select('id, title, window_start, window_end, deadline')
    .gt('deadline', now)
    .order('deadline', { ascending: true })
    .limit(5)

  // Fetch player's existing responses for these windows (only if they have a linked player)
  type AvailWindow = { id: string; title: string; window_start: string; window_end: string; deadline: string }
  type AvailResponse = { window_id: string; status: string }
  const windows: AvailWindow[] = openWindows ?? []
  let myResponses: AvailResponse[] = []
  if (player.player_id && windows.length > 0) {
    const { data: resp } = await serverSupabase
      .from('player_availability')
      .select('window_id, status')
      .eq('player_id', player.player_id)
      .in('window_id', windows.map(w => w.id))
    myResponses = resp ?? []
  }
  const responseMap = Object.fromEntries(myResponses.map(r => [r.window_id, r.status]))

  const isAdminRole   = player.role === 'admin'
  const isScorerRole  = player.role === 'scorer' || player.role === 'admin'
  const isShopRole    = player.role === 'shop'   || player.role === 'admin'
  const hasToolsPanel = (player.role === 'scorer' || player.role === 'coach') && !isAdminRole

  const tod = (() => { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening' })()
  const todayStr = new Date().toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <>
      <style>{`
        .db { min-height: 100vh; color: var(--text); }

        /* ── WELCOME ROW ── */
        .db-welcome {
          display: flex; align-items: center; justify-content: space-between;
          padding-top: calc(var(--nav-h) + 32px); padding-bottom: 20px;
          flex-wrap: wrap; gap: 16px;
        }
        .db-welcome-left { display: flex; align-items: center; gap: 16px; }
        .db-initials {
          width: 52px; height: 52px; border-radius: 14px;
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 19px; font-weight: 800; color: #fff;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.4), 0 6px 20px rgba(29,78,216,0.4);
          flex-shrink: 0;
        }
        .db-greeting {
          font-family: var(--font-display); font-size: clamp(20px, 3vw, 28px);
          font-weight: 800; color: #f0f8ff; letter-spacing: -0.02em; line-height: 1.1; margin: 0;
        }
        .db-date { font-size: 13px; color: rgba(147,197,253,0.5); margin: 4px 0 0; }
        .db-role-badge {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 14px; border-radius: 7px;
          background: rgba(37,99,235,0.15); border: 1px solid rgba(59,130,246,0.3);
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase; color: #93c5fd;
        }
        .db-role-dot { width: 5px; height: 5px; border-radius: 50%; background: #3b82f6; box-shadow: 0 0 8px rgba(59,130,246,0.8); }

        /* ── STATS STRIP ── */
        .db-stats-strip { padding-bottom: 24px; }
        .db-stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
        .db-stat-card {
          padding: 18px 20px; background: rgba(255,255,255,0.03);
          border: 1px solid rgba(59,130,246,0.18); border-radius: 12px;
          text-align: center; position: relative; overflow: hidden;
          transition: border-color 0.2s;
        }
        .db-stat-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #1d4ed8, #38bdf8, transparent);
        }
        .db-stat-card:hover { border-color: rgba(59,130,246,0.35); }
        .db-stat-num { font-family: var(--font-display); font-size: 28px; font-weight: 800; color: #93c5fd; line-height: 1; margin-bottom: 4px; }
        .db-stat-num.live-num { color: #fca5a5; }
        .db-stat-label { font-size: 9px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: rgba(147,197,253,0.45); }

        /* ── TWO-COLUMN GRID ── */
        .db-main-area { padding-bottom: 40px; }
        .db-grid {
          display: grid; grid-template-columns: 1fr; gap: 20px; align-items: start;
        }
        @media (min-width: 768px) {
          .db-grid { grid-template-columns: 3fr 2fr; }
        }
        .db-col-left, .db-col-right { display: flex; flex-direction: column; gap: 20px; }

        /* ── CARD SHELL ── */
        .db-card {
          background: rgba(255,255,255,0.025);
          border: 1px solid var(--border);
          border-radius: 14px; overflow: hidden;
        }
        .db-card-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 14px 18px; border-bottom: 1px solid var(--border);
        }
        .db-card-title {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: rgba(147,197,253,0.5);
        }
        .db-card-body { padding: 16px 18px; }

        /* ── LIVE CARD ── */
        .live-card {
          position: relative;
          background: linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(14,165,233,0.07) 100%);
          border: 1px solid rgba(96,165,250,0.35);
          border-radius: 14px; padding: 22px; overflow: hidden;
        }
        .live-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #ef4444, #f97316, transparent);
        }
        .live-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 4px 12px; border-radius: 6px;
          background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.28);
          font-family: var(--font-display); font-size: 9px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #fca5a5; margin-bottom: 14px;
        }
        .live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ef4444; box-shadow: 0 0 8px rgba(239,68,68,0.8);
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{ opacity:1; } 50%{ opacity:0.3; } }
        .live-teams {
          font-family: var(--font-display); font-size: clamp(18px, 2.5vw, 24px); font-weight: 700;
          color: #f0f8ff; letter-spacing: -0.02em; margin-bottom: 16px;
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .live-vs {
          font-size: 13px; font-weight: 500; color: var(--sky);
          padding: 2px 9px; border-radius: 4px;
          background: rgba(56,189,248,0.1); border: 1px solid rgba(56,189,248,0.2);
        }
        .live-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        /* ── SECTION HEADERS (inside cards) ── */
        .db-section { margin-bottom: 20px; }
        .db-section:last-child { margin-bottom: 0; }
        .db-section-head {
          display: flex; align-items: center; gap: 10px; margin-bottom: 12px;
        }
        .db-section-title {
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em; white-space: nowrap;
        }
        .db-section-line { flex: 1; height: 1px; background: var(--border); }
        .db-section-count {
          font-family: var(--font-display); font-size: 9px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--muted); white-space: nowrap;
        }

        /* ── MATCH CARDS ── */
        .match-card {
          display: flex; align-items: stretch;
          background: rgba(255,255,255,0.02); border: 1px solid var(--border);
          border-radius: 10px; margin-bottom: 8px; text-decoration: none;
          overflow: hidden; transition: border-color 0.18s, background 0.18s, transform 0.15s;
          min-height: 60px;
        }
        .match-card:hover { border-color: rgba(59,130,246,0.35); background: rgba(37,99,235,0.05); transform: translateX(2px); }
        .match-card-accent { width: 3px; background: linear-gradient(180deg, #2563eb, #38bdf8); flex-shrink: 0; }
        .match-card-body { flex: 1; padding: 11px 14px; display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .match-card-info { flex: 1; min-width: 0; }
        .match-vs {
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          color: var(--text); margin-bottom: 3px; letter-spacing: -0.01em;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%;
        }
        .match-meta { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11px; color: var(--muted); }
        .match-meta-sep { width: 2px; height: 2px; border-radius: 50%; background: currentColor; opacity: 0.5; }
        .format-pill {
          padding: 1px 7px; border-radius: 4px;
          background: rgba(37,99,235,0.15); border: 1px solid rgba(59,130,246,0.22);
          font-size: 9px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: #60a5fa;
        }
        .match-result {
          font-family: var(--font-display); font-size: 11px; font-weight: 600;
          color: var(--sky); padding: 3px 9px; border-radius: 5px;
          background: rgba(56,189,248,0.08); border: 1px solid rgba(56,189,248,0.18);
          flex-shrink: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .score-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 7px 12px; border-radius: 7px;
          background: rgba(37,99,235,0.15); border: 1px solid rgba(59,130,246,0.28);
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: #93c5fd; white-space: nowrap; text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
          min-height: 34px; flex-shrink: 0;
        }
        .score-btn:hover { background: rgba(37,99,235,0.28); border-color: rgba(96,165,250,0.5); }

        .empty-state {
          text-align: center; padding: 24px 16px;
          color: rgba(147,197,253,0.35); font-size: 13px;
          border: 1px dashed rgba(59,130,246,0.15); border-radius: 10px; line-height: 1.7;
        }
        .all-link {
          display: inline-flex; align-items: center; gap: 5px; margin-top: 8px;
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--blue-mid); text-decoration: none;
          transition: color 0.15s, gap 0.15s;
        }
        .all-link:hover { color: #60a5fa; gap: 9px; }

        /* ── PROFILE CARD ── */
        .profile-avatar {
          width: 44px; height: 44px; border-radius: 11px;
          background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 16px; font-weight: 800; color: #fff;
          margin-bottom: 12px; box-shadow: 0 4px 14px rgba(29,78,216,0.35);
        }
        .profile-name { font-family: var(--font-display); font-size: 14px; font-weight: 700; color: var(--text); margin-bottom: 2px; }
        .profile-email { font-size: 11px; color: var(--muted); margin-bottom: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .profile-role-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 11px; border-radius: 6px;
          background: rgba(37,99,235,0.14); border: 1px solid rgba(59,130,246,0.28);
          font-family: var(--font-display); font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase; color: #93c5fd;
        }
        .profile-role-dot { width: 4px; height: 4px; border-radius: 50%; background: var(--blue-mid); box-shadow: 0 0 6px rgba(59,130,246,0.8); }

        /* ── BOTTOM ROLE PANELS ── */
        .db-bottom-section { padding-bottom: 60px; }
        .db-bottom-panel { margin-bottom: 28px; }
        .db-bottom-panel-head {
          display: flex; align-items: center; gap: 10px;
          padding-bottom: 14px; border-bottom: 1px solid var(--border); margin-bottom: 16px;
        }
        .db-bottom-panel-title {
          font-family: var(--font-display); font-size: 11px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase; color: rgba(147,197,253,0.4);
        }
        .db-tiles { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; }
        .db-tile {
          display: flex; flex-direction: column; gap: 5px;
          padding: 16px 14px; border-radius: 12px;
          background: rgba(255,255,255,0.025); border: 1px solid var(--border);
          text-decoration: none; transition: border-color 0.15s, background 0.15s;
          position: relative; overflow: hidden;
        }
        .db-tile::after {
          content: ''; position: absolute; bottom: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #1d4ed8, #0ea5e9);
          transform: scaleX(0); transform-origin: left; transition: transform 0.18s ease;
        }
        .db-tile:hover { border-color: rgba(96,165,250,0.35); background: rgba(37,99,235,0.07); }
        .db-tile:hover::after { transform: scaleX(1); }
        .db-tile-icon { font-size: 20px; line-height: 1; margin-bottom: 6px; }
        .db-tile-label { font-family: var(--font-display); font-size: 12px; font-weight: 700; color: #e2eeff; }
        .db-tile-sub { font-size: 10px; color: rgba(147,197,253,0.4); line-height: 1.3; }
        .db-tile-badge {
          position: absolute; top: 10px; right: 10px;
          background: #ef4444; color: #fff; border-radius: 999px;
          font-size: 9px; font-weight: 700; padding: 2px 7px;
        }
        .db-pending-badge {
          margin-left: auto;
          padding: '1px 7px'; border-radius: 10px;
          background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.3);
          font-family: var(--font-display); font-size: 9px; font-weight: 700; color: #fbbf24;
          padding: 2px 8px;
        }

        /* ── RESPONSIVE ── */
        @media (max-width: 600px) {
          .db-welcome { padding-top: calc(var(--nav-h) + 20px); padding-bottom: 12px; }
          .db-greeting { font-size: 19px; }
          .db-stat-num { font-size: 22px; }
          .db-tiles { grid-template-columns: repeat(2, 1fr); }
          .db-tile-sub { display: none; }
        }
        @media (max-width: 360px) {
          .db-tiles { grid-template-columns: 1fr 1fr; gap: 8px; }
        }
      `}</style>

      <div className="db">

        {/* ── 1. WELCOME ROW ── */}
        <section className="db-welcome container">
          <div className="db-welcome-left">
            <div className="db-initials">{initials}</div>
            <div>
              <h1 className="db-greeting">Good {tod}, {firstName}</h1>
              <p className="db-date">{todayStr}</p>
            </div>
          </div>
          <span className="db-role-badge">
            <span className="db-role-dot" />
            {player.role}
          </span>
        </section>

        {/* ── 2. STATS STRIP ── */}
        <section className="db-stats-strip container">
          <div className="db-stats-grid">
            <div className="db-stat-card">
              <div className="db-stat-num">{upcomingAll.length}</div>
              <div className="db-stat-label">Upcoming</div>
            </div>
            <div className="db-stat-card">
              <div className="db-stat-num">{recentAll.length}</div>
              <div className="db-stat-label">Recent</div>
            </div>
            <div className="db-stat-card">
              <div className={`db-stat-num${liveMatch ? ' live-num' : ''}`}>{liveMatch ? 1 : 0}</div>
              <div className="db-stat-label">Live Now</div>
            </div>
          </div>
        </section>

        {/* ── 3. TWO-COLUMN GRID ── */}
        <main className="db-main-area container">
          <div className="db-grid">

            {/* LEFT COLUMN */}
            <div className="db-col-left">

              {/* Live match */}
              {liveMatch && (
                <div className="live-card">
                  <div className="live-pill"><span className="live-dot" /> Match in progress</div>
                  <div className="live-teams">
                    BCC <span className="live-vs">vs</span> {liveMatch.opponent?.canonical_name ?? 'Unknown'}
                  </div>
                  <div className="live-actions">
                    <Link href={`/matches/${liveMatch.id}`} className="btn btn-ghost">Watch Live</Link>
                    {isScorerRole && (
                      <Link href={`/admin/matches/${liveMatch.id}/score`} className="btn btn-primary">Open Scorer →</Link>
                    )}
                  </div>
                </div>
              )}

              {/* Upcoming fixtures card */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">Upcoming Fixtures</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{upcomingAll.length} scheduled</span>
                </div>
                <div className="db-card-body">
                  {upcoming.length === 0 ? (
                    <div className="empty-state">
                      No upcoming fixtures.{' '}
                      {isScorerRole && (
                        <Link href="/admin/matches/new" style={{ color: 'var(--blue-mid)', textDecoration: 'none', fontWeight: 600 }}>Create one →</Link>
                      )}
                    </div>
                  ) : upcoming.map(m => (
                    <div key={m.id} className="match-card">
                      <div className="match-card-accent" />
                      <div className="match-card-body">
                        <div className="match-card-info">
                          <div className="match-vs">BCC vs {m.opponent?.canonical_name ?? 'TBC'}</div>
                          <div className="match-meta">
                            {formatDate(m.match_date)}
                            <span className="match-meta-sep" />
                            {m.competition?.overs_per_innings ?? 20} overs
                            <span className="format-pill">{m.competition?.match_format === 't20' ? 'T20' : 'OD'}</span>
                          </div>
                        </div>
                        {isScorerRole && (
                          <Link href={`/admin/matches/${m.id}/score`} className="score-btn">Score →</Link>
                        )}
                      </div>
                    </div>
                  ))}
                  {isScorerRole && <Link href="/admin/matches/new" className="all-link">+ New fixture →</Link>}
                </div>
              </div>

              {/* Availability windows card */}
              {windows.length > 0 && (
                <div className="db-card">
                  <div className="db-card-head">
                    <span className="db-card-title">Availability</span>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{windows.length} open</span>
                  </div>
                  <div className="db-card-body">
                    {!player.player_id && (
                      <div style={{
                        padding: '12px 14px', borderRadius: 10, marginBottom: 12,
                        background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)',
                        fontSize: 13, color: '#fbbf24', display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ flexShrink: 0 }}>⚠️</span>
                        <span>
                          <Link href="/claim-profile" style={{ color: '#fbbf24', fontWeight: 700 }}>Claim your player profile</Link>
                          {' '}to submit availability.
                        </span>
                      </div>
                    )}
                    {windows.map(w => {
                      const response = responseMap[w.id]
                      const deadlineDate = new Date(w.deadline)
                      const hoursLeft = Math.round((deadlineDate.getTime() - Date.now()) / 3600000)
                      const isUrgent = hoursLeft < 24
                      const STATUS_LABEL: Record<string, string> = {
                        available: '✅ Available',
                        unavailable: '❌ Unavailable',
                        tentative: '❓ Tentative',
                      }
                      return (
                        <Link key={w.id} href={`/availability/${w.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: 10 }}>
                          <div style={{
                            padding: '13px 14px', borderRadius: 10,
                            background: response ? 'rgba(255,255,255,0.02)' : 'rgba(59,130,246,0.06)',
                            border: `1px solid ${response ? 'var(--border)' : 'rgba(59,130,246,0.3)'}`,
                            display: 'flex', alignItems: 'center', gap: 12, transition: 'border-color 0.15s',
                          }}>
                            <div style={{
                              width: 34, height: 34, borderRadius: 9, flexShrink: 0,
                              background: response ? 'rgba(255,255,255,0.04)' : 'rgba(59,130,246,0.15)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15,
                            }}>
                              {response ? (response === 'available' ? '✅' : response === 'unavailable' ? '❌' : '❓') : '📅'}
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>{w.title}</div>
                              <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                                {new Date(w.window_start).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                                {' — '}
                                {new Date(w.window_end).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              {response ? (
                                <span style={{ fontSize: 11, fontWeight: 700, color: response === 'available' ? '#86efac' : response === 'unavailable' ? '#fca5a5' : '#fde68a' }}>
                                  {STATUS_LABEL[response]}
                                </span>
                              ) : (
                                <span style={{ fontSize: 11, fontWeight: 700, color: isUrgent ? '#fca5a5' : '#93c5fd' }}>
                                  {isUrgent ? `${hoursLeft}h left` : `${Math.floor(hoursLeft / 24)}d left`}
                                </span>
                              )}
                              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>{response ? 'Tap to change' : 'Respond →'}</div>
                            </div>
                          </div>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT COLUMN */}
            <div className="db-col-right">

              {/* Profile + membership card */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">My Profile</span>
                </div>
                <div className="db-card-body">
                  <div className="profile-avatar">{initials}</div>
                  <div className="profile-name">{player.full_name}</div>
                  <div className="profile-email">{player.email}</div>
                  <div className="profile-role-badge">
                    <span className="profile-role-dot" />
                    {player.role}
                  </div>

                  <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
                    {membership?.status === 'active' ? (
                      <div style={{
                        padding: '12px 14px', borderRadius: 10,
                        background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.24)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>✓</span>
                        <div>
                          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: '#86efac', marginBottom: 1 }}>
                            Active Member
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1)}
                            {membership.valid_until ? ` · until ${new Date(membership.valid_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}` : ''}
                          </div>
                        </div>
                      </div>
                    ) : membership?.status === 'pending' ? (
                      <div style={{
                        padding: '12px 14px', borderRadius: 10,
                        background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.22)',
                        display: 'flex', alignItems: 'center', gap: 10,
                      }}>
                        <span style={{ fontSize: 16, flexShrink: 0 }}>⏳</span>
                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: '#fbbf24' }}>Payment Pending</div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 12, color: 'var(--muted)' }}>No active membership this season.</div>
                        <Link href="/membership" className="btn btn-ghost" style={{ fontSize: 12, padding: '7px 14px', minHeight: 34, display: 'inline-flex', alignItems: 'center' }}>
                          Join this season →
                        </Link>
                      </div>
                    )}
                  </div>

                  <Link href="/stats" style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginTop: 14, padding: '9px 12px',
                    background: 'rgba(37,99,235,0.07)', border: '1px solid rgba(59,130,246,0.18)',
                    borderRadius: 8, fontFamily: 'var(--font-display)',
                    fontSize: 10, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase',
                    color: '#60a5fa', textDecoration: 'none',
                    transition: 'border-color 0.15s, background 0.15s', minHeight: 40,
                  }}>
                    Club Statistics <span>→</span>
                  </Link>
                </div>
              </div>

              {/* Recent results card */}
              <div className="db-card">
                <div className="db-card-head">
                  <span className="db-card-title">Recent Results</span>
                  <span style={{ fontSize: 11, color: 'var(--muted)' }}>{recentAll.length} played</span>
                </div>
                <div className="db-card-body">
                  {recent.length === 0 ? (
                    <div className="empty-state">No results yet.</div>
                  ) : recent.map(m => (
                    <Link href={`/results/${m.id}`} key={m.id} className="match-card">
                      <div className="match-card-accent" style={{ background: 'linear-gradient(180deg, #0ea5e9, #6366f1)' }} />
                      <div className="match-card-body">
                        <div className="match-card-info">
                          <div className="match-vs">BCC vs {m.opponent?.canonical_name ?? 'Unknown'}</div>
                          <div className="match-meta">{formatDate(m.match_date)}</div>
                        </div>
                        {m.result_text && <span className="match-result">{m.result_text}</span>}
                      </div>
                    </Link>
                  ))}
                  <Link href="/results" className="all-link">View all results →</Link>
                </div>
              </div>

            </div>
          </div>
        </main>

        {/* ── 4. ROLE PANELS ── */}
        <section className="db-bottom-section container">

            <div className="db-bottom-panel">
              <div className="db-bottom-panel-head">
                <span style={{ fontSize: 14 }}>👨‍👩‍👧</span>
                <span className="db-bottom-panel-title">Family</span>
              </div>
              <div className="db-tiles">
                <Link href="/dashboard/family" className="db-tile">
                  <div className="db-tile-icon">👨‍👩‍👧</div>
                  <div className="db-tile-label">Family</div>
                  <div className="db-tile-sub">Manage dependents</div>
                </Link>
              </div>
            </div>

            {(player.role === 'admin' || player.role === 'coach') && !allSetupDone && (
              <div style={{
                background: 'var(--panel)', border: '1px solid var(--border)',
                borderRadius: 6, padding: '20px 24px', marginBottom: 24,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>Club Setup</div>
                  <span style={{ fontSize: 13, color: 'var(--muted)' }}>{setupDone} of {setupSteps.length} complete</span>
                </div>
                <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(setupDone / setupSteps.length) * 100}%`,
                    background: 'var(--blue-mid)', borderRadius: 3,
                  }} />
                </div>
                <Link href="/admin/setup" style={{ color: 'var(--blue-mid)', fontWeight: 600, fontSize: 14 }}>
                  Continue setup →
                </Link>
              </div>
            )}

            {isAdminRole && (
              <div className="db-bottom-panel">
                <div className="db-bottom-panel-head">
                  <span style={{ fontSize: 14 }}>⚙</span>
                  <span className="db-bottom-panel-title">Admin Panel</span>
                </div>
                <div className="db-tiles">
                  {getAdminLinks(isPro(clubConfig)).map(link => (
                    <Link key={link.href} href={link.href} className="db-tile">
                      <div className="db-tile-icon">{link.icon}</div>
                      <div className="db-tile-label">{link.label}</div>
                      <div className="db-tile-sub">{link.sub}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {isShopRole && (
              <div className="db-bottom-panel">
                <div className="db-bottom-panel-head">
                  <span style={{ fontSize: 14 }}>🛒</span>
                  <span className="db-bottom-panel-title">Shop Panel</span>
                  {pendingOrderCount > 0 && (
                    <span className="db-pending-badge">{pendingOrderCount} pending</span>
                  )}
                </div>
                <div className="db-tiles">
                  {SHOP_LINKS.map(link => (
                    <Link key={link.href} href={link.href} className="db-tile">
                      <div className="db-tile-icon">{link.icon}</div>
                      <div className="db-tile-label">{link.label}</div>
                      <div className="db-tile-sub">{link.sub}</div>
                      {link.href === '/admin/orders' && pendingOrderCount > 0 && (
                        <span className="db-tile-badge">{pendingOrderCount}</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {hasToolsPanel && (
              <div className="db-bottom-panel">
                <div className="db-bottom-panel-head">
                  <span style={{ fontSize: 14 }}>⚡</span>
                  <span className="db-bottom-panel-title">Match Tools</span>
                </div>
                <div className="db-tiles">
                  {SCORER_LINKS.map(link => (
                    <Link key={link.href} href={link.href} className="db-tile">
                      <div className="db-tile-icon">{link.icon}</div>
                      <div className="db-tile-label">{link.label}</div>
                      <div className="db-tile-sub">{link.sub}</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

        </section>

      </div>
    </>
  )
}
