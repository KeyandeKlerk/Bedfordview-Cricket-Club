'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

const NAV_LINKS = [
  { href: '/live',       label: 'Live' },
  { href: '/news',       label: 'News' },
  { href: '/shop',       label: 'Shop' },
  { href: '/membership', label: 'Membership' },
]

const NAV_DROPDOWNS = [
  {
    label: 'Fixtures',
    items: [
      { href: '/fixtures',        label: 'Senior Fixtures' },
      { href: '/junior/fixtures', label: 'Junior Fixtures' },
    ],
  },
  {
    label: 'Results',
    items: [
      { href: '/results',        label: 'Senior Results' },
      { href: '/junior/results', label: 'Junior Results' },
    ],
  },
  {
    label: 'Stats',
    items: [
      { href: '/stats',        label: 'Senior Stats' },
      { href: '/junior/stats', label: 'Junior Stats' },
    ],
  },
]

export default function Nav() {
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handler)
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [menuOpen])

  async function handleSignOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <>
      <style>{`
        .nav {
          position: fixed;
          top: 0; left: 0; right: 0;
          height: var(--nav-h);
          z-index: 100;
          transition: background 0.25s, border-color 0.25s, backdrop-filter 0.25s;
          border-bottom: 1px solid transparent;
        }
        .nav.scrolled {
          background: rgba(5,12,26,0.92);
          border-color: rgba(59,130,246,0.15);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
        }
        .nav-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 32px;
        }

        /* Logo */
        .nav-logo {
          display: flex;
          align-items: center;
          gap: 10px;
          text-decoration: none;
          flex-shrink: 0;
        }
        .nav-logo-img {
          width: 36px; height: 36px;
          border-radius: 9px;
          object-fit: cover;
          box-shadow: 0 0 0 1px rgba(96,165,250,0.3), 0 4px 12px rgba(29,78,216,0.4);
          flex-shrink: 0;
        }
        .nav-logo-text {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 15px;
          letter-spacing: -0.01em;
          color: #e2eeff;
          line-height: 1.15;
        }
        .nav-logo-text span {
          display: block;
          font-size: 9px;
          font-weight: 600;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(147,197,253,0.5);
        }

        /* Nav links */
        .nav-links {
          display: flex;
          align-items: center;
          gap: 2px;
          list-style: none;
        }
        .nav-links a {
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.02em;
          color: rgba(147,197,253,0.6);
          padding: 7px 14px;
          border-radius: 7px;
          transition: color 0.15s, background 0.15s;
          text-decoration: none;
          position: relative;
        }
        .nav-links a:hover {
          color: #e2eeff;
          background: rgba(37,99,235,0.1);
        }
        .nav-links a.active {
          color: #60a5fa;
          background: rgba(37,99,235,0.12);
        }
        .nav-links a.live-link {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .nav-live-dot {
          width: 5px; height: 5px; border-radius: 50%;
          background: #ef4444;
          box-shadow: 0 0 6px rgba(239,68,68,0.8);
          animation: navpulse 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }
        @keyframes navpulse { 0%,100%{ opacity:1; } 50%{ opacity:0.3; } }

        /* Dropdown */
        .nav-dropdown-wrap {
          position: relative;
        }
        .nav-dropdown-trigger {
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          font-size: 13px;
          letter-spacing: 0.02em;
          color: rgba(147,197,253,0.6);
          padding: 7px 14px;
          border-radius: 7px;
          background: none;
          border: none;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 5px;
          transition: color 0.15s, background 0.15s;
        }
        .nav-dropdown-trigger:hover, .nav-dropdown-wrap:hover .nav-dropdown-trigger {
          color: #e2eeff;
          background: rgba(37,99,235,0.1);
        }
        .nav-dropdown-trigger.active {
          color: #60a5fa;
          background: rgba(37,99,235,0.12);
        }
        .nav-dropdown-arrow {
          font-size: 9px;
          opacity: 0.5;
          transition: transform 0.15s;
        }
        .nav-dropdown-wrap:hover .nav-dropdown-arrow {
          transform: rotate(180deg);
        }
        .nav-dropdown-menu {
          position: absolute;
          top: calc(100% + 6px);
          left: 0;
          background: rgba(6,15,34,0.97);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 10px;
          padding: 6px;
          min-width: 180px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.4);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          opacity: 0;
          visibility: hidden;
          transform: translateY(-4px);
          transition: opacity 0.15s, transform 0.15s, visibility 0.15s;
          z-index: 200;
        }
        .nav-dropdown-wrap:hover .nav-dropdown-menu {
          opacity: 1;
          visibility: visible;
          transform: translateY(0);
        }
        .nav-dropdown-menu a {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 12px;
          border-radius: 7px;
          font-family: 'Outfit', sans-serif;
          font-weight: 600;
          font-size: 13px;
          color: rgba(147,197,253,0.6);
          text-decoration: none;
          transition: color 0.15s, background 0.15s;
          white-space: nowrap;
        }
        .nav-dropdown-menu a:hover {
          color: #e2eeff;
          background: rgba(37,99,235,0.12);
        }
        .nav-dropdown-menu a.active {
          color: #60a5fa;
          background: rgba(37,99,235,0.12);
        }
        .dropdown-item-dot {
          width: 6px; height: 6px; border-radius: 50%;
          flex-shrink: 0;
        }
        .dropdown-item-dot.senior { background: #3b82f6; }
        .dropdown-item-dot.junior { background: #10b981; }

        /* Right side */
        .nav-right {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .nav-user {
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          font-weight: 600;
          color: rgba(147,197,253,0.5);
          letter-spacing: 0.02em;
          padding: 0 4px;
        }
        .nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 14px;
          border-radius: 7px;
          font-family: 'Outfit', sans-serif;
          font-size: 12px;
          font-weight: 600;
          letter-spacing: 0.02em;
          text-decoration: none;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .nav-btn-ghost {
          background: rgba(37,99,235,0.08);
          color: #93c5fd;
          border: 1px solid rgba(59,130,246,0.18);
        }
        .nav-btn-ghost:hover {
          background: rgba(37,99,235,0.15);
          border-color: rgba(96,165,250,0.35);
        }
        .nav-btn-primary {
          background: linear-gradient(135deg, #2563eb, #0ea5e9);
          color: #fff;
          box-shadow: 0 2px 10px rgba(37,99,235,0.3);
        }
        .nav-btn-primary:hover {
          opacity: 0.9;
          box-shadow: 0 4px 14px rgba(37,99,235,0.4);
        }

        /* Hamburger */
        .nav-hamburger {
          display: none;
          flex-direction: column;
          gap: 5px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 10px;
          border-radius: 8px;
          transition: background 0.15s;
          touch-action: manipulation;
          min-width: 44px;
          min-height: 44px;
          align-items: center;
          justify-content: center;
        }
        .nav-hamburger:hover { background: rgba(37,99,235,0.1); }
        .nav-hamburger span {
          display: block;
          width: 22px; height: 2px;
          background: #93c5fd;
          border-radius: 1px;
          transition: all 0.2s;
        }

        /* Mobile menu */
        .mobile-menu {
          display: none;
          position: fixed;
          top: var(--nav-h);
          left: 0; right: 0;
          background: rgba(6,15,34,0.97);
          border-bottom: 1px solid rgba(59,130,246,0.15);
          backdrop-filter: blur(20px);
          -webkit-backdrop-filter: blur(20px);
          padding: 16px 20px 24px;
          flex-direction: column;
          gap: 4px;
          z-index: 99;
        }
        .mobile-menu.open { display: flex; }
        .mobile-menu a, .mobile-menu button {
          font-family: 'Syne', sans-serif;
          font-weight: 700;
          font-size: 18px;
          letter-spacing: -0.01em;
          color: #e2eeff;
          padding: 16px 8px;
          border-bottom: 1px solid rgba(59,130,246,0.1);
          text-decoration: none;
          background: none;
          border-left: none;
          border-right: none;
          border-top: none;
          cursor: pointer;
          text-align: left;
          transition: color 0.15s;
          width: 100%;
          min-height: 56px;
          display: flex;
          align-items: center;
          touch-action: manipulation;
        }
        .mobile-menu a:last-child, .mobile-menu button:last-child { border-bottom: none; }
        .mobile-menu a:hover, .mobile-menu button:hover { color: #60a5fa; }
        .mobile-menu-group { display: contents; }
        .mobile-menu-sub {
          padding: 10px 8px 10px 24px;
          border-bottom: 1px solid rgba(59,130,246,0.08);
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .mobile-menu-sub a {
          font-size: 15px;
          padding: 10px 8px;
          border-bottom: none;
          min-height: unset;
          color: rgba(147,197,253,0.7);
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mobile-section-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: rgba(147,197,253,0.3);
          padding: 12px 8px 4px;
        }

        @media (max-width: 768px) {
          .nav-links, .nav-right { display: none; }
          .nav-hamburger { display: flex; }
        }

        /* Backdrop overlay */
        .mobile-overlay {
          display: none;
          position: fixed;
          inset: 0;
          z-index: 98;
          background: rgba(5,12,26,0.6);
          backdrop-filter: blur(4px);
          -webkit-backdrop-filter: blur(4px);
        }
        @media (max-width: 768px) {
          .mobile-overlay { display: block; }
        }

        /* Animated hamburger → X */
        .nav-hamburger.open span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
        .nav-hamburger.open span:nth-child(2) { opacity: 0; transform: scaleX(0); }
        .nav-hamburger.open span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
      `}</style>

      <nav className={`nav${scrolled ? ' scrolled' : ''}`}>
        <div className="nav-inner">
          <Link href="/" className="nav-logo">
            <Image src="/bcc-logo.jpg" alt="BCC logo" width={36} height={36} className="nav-logo-img" priority />
            <div className="nav-logo-text">
              Bedfordview
              <span>Cricket Club</span>
            </div>
          </Link>

          <ul className="nav-links">
            {/* Dropdown items: Fixtures, Results, Stats */}
            {NAV_DROPDOWNS.map(d => {
              const isActive = d.items.some(i => pathname.startsWith(i.href))
              return (
                <li key={d.label} className="nav-dropdown-wrap">
                  <button className={`nav-dropdown-trigger${isActive ? ' active' : ''}`}>
                    {d.label}
                    <span className="nav-dropdown-arrow">▼</span>
                  </button>
                  <div className="nav-dropdown-menu">
                    {d.items.map(item => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={pathname.startsWith(item.href) ? 'active' : ''}
                      >
                        <span className={`dropdown-item-dot ${item.href.startsWith('/junior') ? 'junior' : 'senior'}`} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                </li>
              )
            })}
            {/* Regular flat links */}
            {NAV_LINKS.map(l => (
              <li key={l.href}>
                <Link
                  href={l.href}
                  className={[
                    pathname.startsWith(l.href) ? 'active' : '',
                    l.href === '/live' ? 'live-link' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {l.href === '/live' && <span className="nav-live-dot" />}
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>

          <div className="nav-right">
            {user ? (
              <>
                <span className="nav-user">{user.email?.split('@')[0]}</span>
                <Link href="/dashboard" className="nav-btn nav-btn-ghost">
                  Dashboard
                </Link>
                <button onClick={handleSignOut} className="nav-btn nav-btn-ghost">
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link href="/login" className="nav-btn nav-btn-ghost">
                  Sign In
                </Link>
                <Link href="/register" className="nav-btn nav-btn-primary">
                  Join Club
                </Link>
              </>
            )}
          </div>

          <button className={`nav-hamburger${menuOpen ? ' open' : ''}`} onClick={() => setMenuOpen(o => !o)} aria-label="Menu" aria-expanded={menuOpen}>
            <span /><span /><span />
          </button>
        </div>
      </nav>

      {menuOpen && <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />}

      <div className={`mobile-menu${menuOpen ? ' open' : ''}`}>
        {/* Dropdown groups expanded inline */}
        {NAV_DROPDOWNS.map(d => (
          <div key={d.label} className="mobile-menu-group">
            <div className="mobile-section-label">{d.label}</div>
            <div className="mobile-menu-sub">
              {d.items.map(item => (
                <Link key={item.href} href={item.href} onClick={() => setMenuOpen(false)}>
                  <span className={`dropdown-item-dot ${item.href.startsWith('/junior') ? 'junior' : 'senior'}`} />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
        {/* Flat links */}
        {NAV_LINKS.map(l => (
          <Link key={l.href} href={l.href} onClick={() => setMenuOpen(false)}>{l.label}</Link>
        ))}
        {user ? (
          <>
            <Link href="/dashboard" onClick={() => setMenuOpen(false)}>Dashboard</Link>
            <button onClick={handleSignOut}>Sign Out</button>
          </>
        ) : (
          <>
            <Link href="/login" onClick={() => setMenuOpen(false)}>Sign In</Link>
            <Link href="/register" onClick={() => setMenuOpen(false)}>Join Club</Link>
          </>
        )}
      </div>
    </>
  )
}
