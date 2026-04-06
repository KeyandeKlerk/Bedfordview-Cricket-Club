import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentPlayerServer } from '@/lib/supabase-server'
import { serverSupabase } from '@/lib/supabase/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

function isScorer(role: string) { return role === 'scorer' || role === 'admin' }
function isAdmin(role: string)  { return role === 'admin' }
function isShop(role: string)   { return role === 'shop' || role === 'admin' }

const ADMIN_LINKS = [
  { href: '/admin/matches',      icon: '⚡', label: 'Matches',      sub: 'Manage, score & create', },
  { href: '/admin/news',         icon: '📰', label: 'News',         sub: 'Articles & match reports', },
  { href: '/admin/players',      icon: '👤', label: 'Players',      sub: 'Manage squad',           },
  { href: '/admin/seasons',      icon: '📆', label: 'Seasons',      sub: 'Manage seasons',         },
  { href: '/admin/users',        icon: '🔑', label: 'Users',        sub: 'Assign roles',           },
  { href: '/admin/opponents',    icon: '🏏', label: 'Opponents',    sub: 'Opposition clubs',       },
  { href: '/admin/competitions', icon: '🏆', label: 'Competitions', sub: 'Leagues & cups',         },
]

const SCORER_LINKS = [
  { href: '/admin/matches', icon: '⚡', label: 'Matches', sub: 'View & score matches', },
]

const SHOP_LINKS = [
  { href: '/admin/orders',   icon: '📦', label: 'Orders',   sub: 'Manage orders',   },
  { href: '/admin/products', icon: '🛒', label: 'Products', sub: 'Manage products', },
]

export default async function DashboardPage() {
  const [player, matchRes] = await Promise.all([
    getCurrentPlayerServer(),
    supabase
      .from('matches')
      .select('*, opponent:opponents(canonical_name), competition:competitions(match_format, overs_per_innings)')
      .in('status', ['upcoming', 'in_progress', 'completed'])
      .order('match_date', { ascending: false })
      .limit(20),
  ])

  if (!player) redirect('/login')

  const matches = matchRes.data ?? []
  const liveMatch = matches.find(m => m.status === 'in_progress')
  const upcomingAll = matches.filter(m => m.status === 'upcoming')
  const recentAll   = matches.filter(m => m.status === 'completed')
  const upcoming  = upcomingAll.slice(0, 3)
  const recent    = recentAll.slice(0, 3)

  const firstName = player.full_name.split(' ')[0]
  const initials  = player.full_name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()

  const adminLinks = isAdmin(player.role) ? ADMIN_LINKS : isScorer(player.role) ? SCORER_LINKS : []
  const shopLinks  = isShop(player.role) ? SHOP_LINKS : []

  // Membership status for current user
  const { data: membership } = await serverSupabase
    .from('memberships')
    .select('status, tier, valid_until')
    .eq('user_id', player.id)
    .maybeSingle()

  // Pending order count for shop badge
  let pendingOrderCount = 0
  if (isShop(player.role)) {
    const { count } = await serverSupabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending_eft')
    pendingOrderCount = count || 0
  }

  return (
    <>
      <style>{`
        .db {
          min-height: 100vh;
          padding-top: var(--nav-h);
          color: var(--text);
        }

        /* ── HERO ── */
        .db-hero {
          position: relative;
          overflow: hidden;
          padding: 40px 0 44px;
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          border-bottom: 1px solid var(--border);
        }
        .db-hero-glow {
          position: absolute;
          top: -80px; right: -60px;
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(37,99,235,0.14) 0%, transparent 70%);
          pointer-events: none;
        }
        .db-hero-glow2 {
          position: absolute;
          bottom: -80px; left: 5%;
          width: 360px; height: 360px;
          background: radial-gradient(circle, rgba(14,165,233,0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .db-hero-inner {
          position: relative; z-index: 2;
        }

        .db-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky);
          margin-bottom: 10px;
          display: flex; align-items: center; gap: 10px;
        }
        .db-eyebrow::before {
          content: '';
          display: inline-block;
          width: 20px; height: 1px;
          background: var(--sky);
        }

        .db-hero-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 24px;
          flex-wrap: wrap;
        }

        .hero-left { flex: 1; min-width: 0; }

        .hero-avatar {
          width: 56px; height: 56px; border-radius: 14px;
          background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display);
          font-size: 20px; font-weight: 800;
          color: #fff;
          box-shadow: 0 0 0 1px rgba(59,130,246,0.4), 0 6px 24px rgba(29,78,216,0.4);
          margin-bottom: 16px;
        }

        .db-name {
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 44px);
          font-weight: 800;
          line-height: 1.05;
          color: #f0f8ff;
          letter-spacing: -0.02em;
          margin-bottom: 14px;
        }
        .db-name-accent {
          background: linear-gradient(135deg, #60a5fa 0%, #38bdf8 100%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .db-role-badge {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 5px 14px; border-radius: 7px;
          background: rgba(37,99,235,0.15);
          border: 1px solid rgba(59,130,246,0.3);
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #93c5fd;
        }
        .db-role-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #3b82f6;
          box-shadow: 0 0 8px rgba(59,130,246,0.8);
        }

        /* Hero quick stats */
        .hero-stats {
          display: flex;
          gap: 10px;
          flex-wrap: wrap;
          align-self: flex-start;
          padding-top: 4px;
        }
        .hero-stat-card {
          padding: 16px 22px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 12px;
          min-width: 90px;
          text-align: center;
          position: relative; overflow: hidden;
          transition: border-color 0.2s;
        }
        .hero-stat-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, #1d4ed8, #38bdf8, transparent);
        }
        .hero-stat-card:hover { border-color: rgba(59,130,246,0.38); }
        .hero-stat-num {
          font-family: var(--font-display);
          font-size: 30px; font-weight: 800;
          color: #93c5fd; line-height: 1;
          margin-bottom: 5px;
        }
        .hero-stat-num.live-num { color: #fca5a5; }
        .hero-stat-label {
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: rgba(147,197,253,0.45);
        }

        /* ── BODY ── */
        .db-body { padding: 28px 0 80px; }
        .db-grid {
          display: grid;
          grid-template-columns: 1fr 280px;
          gap: 20px;
          align-items: start;
        }

        /* ── LIVE CARD ── */
        .live-card {
          position: relative;
          background: linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(14,165,233,0.07) 100%);
          border: 1px solid rgba(96,165,250,0.35);
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 20px;
          overflow: hidden;
        }
        .live-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, #ef4444, #f97316, transparent);
        }
        .live-pill {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 4px 12px; border-radius: 6px;
          background: rgba(239,68,68,0.12);
          border: 1px solid rgba(239,68,68,0.28);
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #fca5a5; margin-bottom: 14px;
        }
        .live-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 8px rgba(239,68,68,0.8);
          animation: blink 1.2s ease-in-out infinite;
        }
        @keyframes blink { 0%,100%{ opacity:1; } 50%{ opacity:0.3; } }
        .live-teams {
          font-family: var(--font-display);
          font-size: clamp(20px, 3vw, 26px); font-weight: 700;
          color: #f0f8ff; letter-spacing: -0.02em;
          margin-bottom: 18px;
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
        }
        .live-vs {
          font-size: 13px; font-weight: 500;
          color: var(--sky);
          padding: 2px 9px; border-radius: 4px;
          background: rgba(56,189,248,0.1);
          border: 1px solid rgba(56,189,248,0.2);
        }
        .live-actions { display: flex; gap: 10px; flex-wrap: wrap; }

        /* ── SECTION HEADERS ── */
        .db-section { margin-bottom: 24px; }
        .db-section-head {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 12px;
        }
        .db-section-title {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em;
          white-space: nowrap;
        }
        .db-section-line { flex: 1; height: 1px; background: var(--border); }
        .db-section-count {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--muted); white-space: nowrap;
        }

        /* ── MATCH CARDS ── */
        .match-card {
          display: flex; align-items: stretch;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 10px;
          margin-bottom: 8px;
          text-decoration: none;
          overflow: hidden;
          transition: border-color 0.18s, background 0.18s, transform 0.15s;
          min-height: 64px;
        }
        .match-card:hover {
          border-color: rgba(59,130,246,0.35);
          background: rgba(37,99,235,0.05);
          transform: translateX(2px);
        }
        .match-card-accent {
          width: 3px;
          background: linear-gradient(180deg, #2563eb, #38bdf8);
          flex-shrink: 0;
        }
        .match-card-body {
          flex: 1; padding: 12px 16px;
          display: flex; align-items: center; gap: 10px;
        }
        .match-card-info { flex: 1; min-width: 0; }
        .match-vs {
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          color: var(--text); margin-bottom: 3px;
          letter-spacing: -0.01em;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        }
        .match-meta {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          font-size: 11px; color: var(--muted);
        }
        .match-meta-sep { width: 2px; height: 2px; border-radius: 50%; background: currentColor; opacity: 0.5; }
        .format-pill {
          padding: 1px 7px; border-radius: 4px;
          background: rgba(37,99,235,0.15);
          border: 1px solid rgba(59,130,246,0.22);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: #60a5fa;
        }
        .match-result {
          font-family: var(--font-display);
          font-size: 11px; font-weight: 600;
          color: var(--sky); white-space: nowrap;
          padding: 3px 9px; border-radius: 5px;
          background: rgba(56,189,248,0.08);
          border: 1px solid rgba(56,189,248,0.18);
          flex-shrink: 0;
        }
        .score-btn {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 8px 12px; border-radius: 7px;
          background: rgba(37,99,235,0.15);
          border: 1px solid rgba(59,130,246,0.28);
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.06em; text-transform: uppercase;
          color: #93c5fd; white-space: nowrap;
          text-decoration: none;
          transition: background 0.15s, border-color 0.15s;
          min-height: 36px;
          flex-shrink: 0;
        }
        .score-btn:hover { background: rgba(37,99,235,0.28); border-color: rgba(96,165,250,0.5); }

        .empty-state {
          text-align: center; padding: 28px 20px;
          color: rgba(147,197,253,0.35); font-size: 13px;
          border: 1px dashed rgba(59,130,246,0.15);
          border-radius: 10px; line-height: 1.7;
        }

        .all-link {
          display: inline-flex; align-items: center; gap: 5px;
          margin-top: 10px;
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--blue-mid); text-decoration: none;
          transition: color 0.15s, gap 0.15s;
        }
        .all-link:hover { color: #60a5fa; gap: 9px; }

        /* ── SIDEBAR ── */
        .db-panel {
          background: rgba(5,18,42,0.85);
          border: 1px solid rgba(59,130,246,0.14);
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 16px;
          position: relative;
        }
        .db-panel::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent);
        }
        .db-panel-head {
          padding: 14px 18px;
          border-bottom: 1px solid rgba(59,130,246,0.08);
          display: flex; align-items: center; gap: 8px;
        }
        .db-panel-title {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: var(--muted);
        }
        .db-panel-body { padding: 14px; }

        /* ── ADMIN GRID ── */
        .admin-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 7px;
        }
        .admin-tile {
          display: flex; flex-direction: column;
          padding: 12px;
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 10px;
          text-decoration: none;
          transition: border-color 0.18s, background 0.18s, transform 0.15s;
          position: relative; overflow: hidden;
          min-height: 80px;
        }
        .admin-tile::after {
          content: '';
          position: absolute;
          bottom: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #1d4ed8, #0ea5e9);
          transform: scaleX(0); transform-origin: left;
          transition: transform 0.18s ease;
        }
        .admin-tile:hover {
          border-color: rgba(59,130,246,0.32);
          background: rgba(37,99,235,0.08);
          transform: translateY(-2px);
        }
        .admin-tile:hover::after { transform: scaleX(1); }
        .admin-tile-icon {
          font-size: 16px;
          margin-bottom: 8px;
          line-height: 1;
        }
        .admin-tile-label {
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          color: var(--text); margin-bottom: 2px;
          letter-spacing: -0.01em;
        }
        .admin-tile-sub {
          font-size: 9px; color: rgba(147,197,253,0.38);
          line-height: 1.3;
        }

        /* ── PROFILE ── */
        .profile-avatar {
          width: 44px; height: 44px; border-radius: 11px;
          background: linear-gradient(135deg, #1d4ed8 0%, #0ea5e9 100%);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display);
          font-size: 16px; font-weight: 800; color: #fff;
          margin-bottom: 12px;
          box-shadow: 0 4px 14px rgba(29,78,216,0.35);
        }
        .profile-name {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: var(--text); margin-bottom: 2px;
        }
        .profile-email {
          font-size: 11px; color: var(--muted);
          margin-bottom: 12px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .profile-role-badge {
          display: inline-flex; align-items: center; gap: 5px;
          padding: 4px 11px; border-radius: 6px;
          background: rgba(37,99,235,0.14);
          border: 1px solid rgba(59,130,246,0.28);
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.18em; text-transform: uppercase;
          color: #93c5fd;
        }
        .profile-role-dot {
          width: 4px; height: 4px; border-radius: 50%;
          background: var(--blue-mid);
          box-shadow: 0 0 6px rgba(59,130,246,0.8);
        }

        .stats-empty {
          text-align: center; padding: 14px 0 10px;
          font-size: 12px; color: rgba(147,197,253,0.35);
          line-height: 1.7;
        }
        .stats-link {
          display: flex; align-items: center; justify-content: space-between;
          width: 100%; padding: 10px 14px;
          background: rgba(37,99,235,0.07);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 8px;
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: #60a5fa; text-decoration: none;
          margin-top: 10px;
          transition: border-color 0.15s, background 0.15s;
          min-height: 44px;
        }
        .stats-link:hover { border-color: rgba(59,130,246,0.38); background: rgba(37,99,235,0.14); }

        /* ── RESPONSIVE ── */
        @media (max-width: 900px) {
          .db-grid { grid-template-columns: 1fr; }
          /* On mobile, sidebar comes AFTER main content but admin panel floats up */
          .db-sidebar { order: -1; }
          .db-main { order: 2; }
          .admin-grid { grid-template-columns: repeat(4, 1fr); gap: 8px; }
        }
        @media (max-width: 600px) {
          .admin-grid { grid-template-columns: repeat(2, 1fr); }
          .hero-stats { gap: 8px; }
          .hero-stat-card { padding: 12px 16px; min-width: 76px; }
          .hero-stat-num { font-size: 24px; }
          .db-hero { padding: 28px 0 32px; }
          .live-teams { font-size: 20px; }
        }
      `}</style>

      <div className="db">
        {/* ── HERO ── */}
        <div className="db-hero">
          <div className="db-hero-glow" />
          <div className="db-hero-glow2" />
          <div className="container">
            <div className="db-hero-inner">
              <div className="db-eyebrow">Bedfordview Cricket Club — Dashboard</div>
              <div className="db-hero-row">
                <div className="hero-left">
                  <div className="hero-avatar">{initials}</div>
                  <div className="db-name">
                    Welcome back,{' '}
                    <span className="db-name-accent">{firstName}</span>
                  </div>
                  <div className="db-role-badge">
                    <span className="db-role-dot" />
                    {player.role}
                  </div>
                </div>

                <div className="hero-stats">
                  {liveMatch && (
                    <div className="hero-stat-card">
                      <div className="hero-stat-num live-num">1</div>
                      <div className="hero-stat-label">Live now</div>
                    </div>
                  )}
                  <div className="hero-stat-card">
                    <div className="hero-stat-num">{upcomingAll.length}</div>
                    <div className="hero-stat-label">Upcoming</div>
                  </div>
                  <div className="hero-stat-card">
                    <div className="hero-stat-num">{recentAll.length}</div>
                    <div className="hero-stat-label">Results</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── BODY ── */}
        <div className="db-body">
          <div className="container">
            <div className="db-grid">

              {/* ── SIDEBAR ── (reordered above main on mobile via order) */}
              <div className="db-sidebar" style={{ display: 'contents' }}>
                <div style={{ gridColumn: '2', gridRow: '1 / span 3' }}>

                  {/* ADMIN / SCORER PANEL */}
                  {adminLinks.length > 0 && (
                    <div className="db-panel">
                      <div className="db-panel-head">
                        <span style={{ fontSize: 14 }}>⚙</span>
                        <div className="db-panel-title">
                          {isAdmin(player.role) ? 'Admin Panel' : 'Scorer Panel'}
                        </div>
                      </div>
                      <div className="db-panel-body">
                        <div className="admin-grid">
                          {adminLinks.map(link => (
                            <Link key={link.href} href={link.href} className="admin-tile">
                              <div className="admin-tile-icon">{link.icon}</div>
                              <div className="admin-tile-label">{link.label}</div>
                              <div className="admin-tile-sub">{link.sub}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SHOP PANEL */}
                  {shopLinks.length > 0 && (
                    <div className="db-panel">
                      <div className="db-panel-head">
                        <span style={{ fontSize: 14 }}>🛒</span>
                        <div className="db-panel-title">Shop Panel</div>
                        {pendingOrderCount > 0 && (
                          <span style={{
                            marginLeft: 'auto',
                            padding: '1px 7px', borderRadius: 10,
                            background: 'rgba(245,158,11,0.15)',
                            border: '1px solid rgba(245,158,11,0.3)',
                            fontFamily: 'var(--font-display)',
                            fontSize: 9, fontWeight: 700,
                            color: '#fbbf24',
                          }}>
                            {pendingOrderCount} pending
                          </span>
                        )}
                      </div>
                      <div className="db-panel-body">
                        <div className="admin-grid">
                          {shopLinks.map(link => (
                            <Link key={link.href} href={link.href} className="admin-tile">
                              <div className="admin-tile-icon">{link.icon}</div>
                              <div className="admin-tile-label">{link.label}</div>
                              <div className="admin-tile-sub">{link.sub}</div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* PROFILE */}
                  <div className="db-panel">
                    <div className="db-panel-head">
                      <span style={{ fontSize: 14 }}>👤</span>
                      <div className="db-panel-title">My Profile</div>
                    </div>
                    <div className="db-panel-body">
                      <div className="profile-avatar">{initials}</div>
                      <div className="profile-name">{player.full_name}</div>
                      <div className="profile-email">{player.email}</div>
                      <div className="profile-role-badge">
                        <span className="profile-role-dot" />
                        {player.role}
                      </div>
                    </div>
                  </div>

                  {/* STATS */}
                  <div className="db-panel">
                    <div className="db-panel-head">
                      <span style={{ fontSize: 14 }}>📊</span>
                      <div className="db-panel-title">My Stats</div>
                    </div>
                    <div className="db-panel-body">
                      <div className="stats-empty">
                        Play a match to see your personal stats here.
                      </div>
                      <Link href="/stats" className="stats-link">
                        Club Statistics
                        <span>→</span>
                      </Link>
                    </div>
                  </div>

                </div>
              </div>

              {/* ── MAIN COLUMN ── */}
              <div className="db-main" style={{ gridColumn: '1', gridRow: '1 / span 3' }}>

                {/* MEMBERSHIP STATUS */}
                {membership?.status === 'active' ? (
                  <div style={{
                    position: 'relative',
                    background: 'linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.06) 100%)',
                    border: '1px solid rgba(34,197,94,0.28)',
                    borderRadius: 14,
                    padding: '18px 22px',
                    marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 14,
                    overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                      background: 'linear-gradient(90deg, #22c55e, #10b981, transparent)',
                    }} />
                    <div style={{
                      width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                      background: 'rgba(34,197,94,0.15)',
                      border: '1px solid rgba(34,197,94,0.3)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>✓</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: 2 }}>
                        Active Member — {membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1)} Membership
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        {membership.valid_until
                          ? `Valid until ${new Date(membership.valid_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : 'Season membership active'}
                      </div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 6,
                      background: 'rgba(34,197,94,0.15)',
                      border: '1px solid rgba(34,197,94,0.3)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 9, fontWeight: 700, letterSpacing: '0.15em',
                      textTransform: 'uppercase', color: '#86efac',
                      flexShrink: 0,
                    }}>Active</span>
                  </div>
                ) : membership?.status === 'pending' ? (
                  <div style={{
                    background: 'rgba(245,158,11,0.07)',
                    border: '1px solid rgba(245,158,11,0.25)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    marginBottom: 20,
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <span style={{ fontSize: 18, flexShrink: 0 }}>⏳</span>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#fbbf24', marginBottom: 2 }}>
                        Membership Payment Pending
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Will be activated within 1 business day of payment clearing.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    background: 'rgba(37,99,235,0.05)',
                    border: '1px dashed rgba(59,130,246,0.2)',
                    borderRadius: 12,
                    padding: '14px 18px',
                    marginBottom: 20,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    flexWrap: 'wrap',
                  }}>
                    <div>
                      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                        No active membership
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--muted)' }}>
                        Join BCC this season to access all home matches and club events.
                      </div>
                    </div>
                    <Link href="/membership" className="btn btn-ghost" style={{ fontSize: 12, padding: '8px 16px', minHeight: 36 }}>
                      Join this season →
                    </Link>
                  </div>
                )}

                {/* LIVE MATCH */}
                {liveMatch && (
                  <div className="live-card">
                    <div className="live-pill">
                      <span className="live-dot" />
                      Match in progress
                    </div>
                    <div className="live-teams">
                      BCC
                      <span className="live-vs">vs</span>
                      {liveMatch.opponent?.canonical_name ?? 'Unknown'}
                    </div>
                    <div className="live-actions">
                      <Link href={`/matches/${liveMatch.id}`} className="btn btn-ghost">
                        Watch Live
                      </Link>
                      {isScorer(player.role) && (
                        <Link href={`/admin/matches/${liveMatch.id}/score`} className="btn btn-primary">
                          Open Scorer →
                        </Link>
                      )}
                    </div>
                  </div>
                )}

                {/* UPCOMING FIXTURES */}
                <div className="db-section">
                  <div className="db-section-head">
                    <div className="db-section-title">Upcoming Fixtures</div>
                    <div className="db-section-line" />
                    <div className="db-section-count">{upcoming.length} scheduled</div>
                  </div>

                  {upcoming.length === 0 ? (
                    <div className="empty-state">
                      No upcoming fixtures scheduled.{' '}
                      {isScorer(player.role) && (
                        <Link href="/admin/matches/new" style={{ color: 'var(--blue-mid)', textDecoration: 'none', fontWeight: 600 }}>
                          Create one →
                        </Link>
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
                            <span className="format-pill">
                              {m.competition?.match_format === 't20' ? 'T20' : 'OD'}
                            </span>
                          </div>
                        </div>
                        {isScorer(player.role) && (
                          <Link href={`/admin/matches/${m.id}/score`} className="score-btn">
                            Score →
                          </Link>
                        )}
                      </div>
                    </div>
                  ))}

                  {isScorer(player.role) && (
                    <Link href="/admin/matches/new" className="all-link">
                      + New fixture →
                    </Link>
                  )}
                </div>

                {/* RECENT RESULTS */}
                <div className="db-section">
                  <div className="db-section-head">
                    <div className="db-section-title">Recent Results</div>
                    <div className="db-section-line" />
                    <div className="db-section-count">{recent.length} played</div>
                  </div>

                  {recent.length === 0 ? (
                    <div className="empty-state">No results recorded yet.</div>
                  ) : recent.map(m => (
                    <Link href={`/results/${m.id}`} key={m.id} className="match-card">
                      <div className="match-card-accent" style={{ background: 'linear-gradient(180deg, #0ea5e9, #6366f1)' }} />
                      <div className="match-card-body">
                        <div className="match-card-info">
                          <div className="match-vs">BCC vs {m.opponent?.canonical_name ?? 'Unknown'}</div>
                          <div className="match-meta">{formatDate(m.match_date)}</div>
                        </div>
                        {m.result_text && (
                          <span className="match-result">{m.result_text}</span>
                        )}
                      </div>
                    </Link>
                  ))}

                  <Link href="/results" className="all-link">
                    View all results →
                  </Link>
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </>
  )
}
