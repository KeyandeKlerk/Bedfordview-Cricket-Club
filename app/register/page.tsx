'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BATTING_STYLES = ['Right-hand bat', 'Left-hand bat']
const BOWLING_STYLES = ['Right-arm fast', 'Right-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin',
  'Left-arm fast', 'Left-arm medium', 'Left-arm orthodox', 'Left-arm wrist-spin', 'Does not bowl']

type Screen = 'choose' | 'self' | 'child'

export default function RegisterPage() {
  const router = useRouter()
  const [screen, setScreen] = useState<Screen>('choose')
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    batting_style: '', bowling_style: '',
  })
  const [parentAlsoPlays, setParentAlsoPlays] = useState(false)
  const [child, setChild] = useState({ firstName: '', lastName: '', dateOfBirth: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))
  const setChildField = (k: string, v: string) => setChild(c => ({ ...c, [k]: v }))

  async function handleSubmit() {
    setError('')
    if (!form.full_name || !form.email || !form.password) { setError('Please fill in all required fields.'); return }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }

    if (screen === 'child') {
      if (!child.firstName || !child.lastName || !child.dateOfBirth) {
        setError("Please fill in your child's name and date of birth."); return
      }
      if (new Date(child.dateOfBirth) > new Date()) {
        setError('Date of birth cannot be in the future.'); return
      }
    }

    setLoading(true)
    try {
      // Create user + player record(s) + role via server route (uses service
      // role, so email is auto-confirmed and sign-in works immediately after)
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: screen,
          email: form.email,
          password: form.password,
          full_name: form.full_name,
          ...(screen === 'self' ? {
            batting_style: form.batting_style || undefined,
            bowling_style: form.bowling_style || undefined,
          } : {
            child: {
              firstName: child.firstName,
              lastName: child.lastName,
              dateOfBirth: child.dateOfBirth,
            },
            ...(parentAlsoPlays ? {
              parentAlsoPlays: {
                battingStyle: form.batting_style || undefined,
                bowlingStyle: form.bowling_style || undefined,
              },
            } : {}),
          }),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Registration failed. Please try again.'); return }

      // Auto sign-in so the user lands on their dashboard immediately
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: form.email,
        password: form.password,
      })
      if (signInError) {
        // Account created but sign-in failed — send to login
        setSuccess(true)
        return
      }
      router.push(screen === 'child' ? '/dashboard/family' : '/dashboard')
    } catch {
      setError('Registration failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <style>{`
        .auth-page {
          min-height: 100vh;
          padding-top: var(--nav-h);
          display: flex;
          align-items: center;
          justify-content: center;
          padding-bottom: 60px;
          position: relative;
        }
        .auth-page::before {
          content: '';
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 600px; height: 500px;
          background: radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 65%);
          pointer-events: none;
        }

        .auth-wrap {
          width: 100%;
          max-width: 540px;
          padding: 24px;
          position: relative; z-index: 1;
        }

        .auth-logo {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-bottom: 32px;
          text-decoration: none;
        }
        .auth-logo-icon {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Syne', sans-serif;
          font-size: 13px; font-weight: 800;
          color: #fff;
          box-shadow: 0 4px 16px rgba(29,78,216,0.4);
        }
        .auth-logo-text {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 800;
          color: #e2eeff;
          letter-spacing: -0.01em;
        }

        .auth-card {
          background: rgba(5,18,42,0.85);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 16px;
          padding: 36px;
          backdrop-filter: blur(20px);
          position: relative;
          overflow: hidden;
        }
        .auth-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.5), transparent);
        }
        @media (max-width: 500px) { .auth-card { padding: 24px; } }

        .auth-title {
          font-family: 'Syne', sans-serif;
          font-size: 26px;
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.02em;
          margin-bottom: 6px;
        }
        .auth-sub {
          font-family: 'Outfit', sans-serif;
          color: rgba(147,197,253,0.55);
          font-size: 13px;
          margin-bottom: 28px;
        }
        .auth-sub a {
          color: #60a5fa;
          text-decoration: none;
          font-weight: 600;
          transition: color 0.15s;
        }
        .auth-sub a:hover { color: #93c5fd; }

        .error-box {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.25);
          color: #fca5a5;
          padding: 12px 16px;
          border-radius: 8px;
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          margin-bottom: 20px;
          display: flex; align-items: center; gap: 8px;
        }
        .error-box::before { content: '⚠'; font-size: 14px; }

        .success-card {
          text-align: center;
          padding: 8px 0;
        }
        .success-icon {
          width: 56px; height: 56px; border-radius: 14px;
          background: linear-gradient(135deg, #1d4ed8, #0ea5e9);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px;
          margin: 0 auto 20px;
          box-shadow: 0 4px 20px rgba(29,78,216,0.4);
        }
        .success-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px; font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.01em;
          margin-bottom: 10px;
        }
        .success-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          color: rgba(147,197,253,0.55);
          line-height: 1.6;
          margin-bottom: 24px;
        }

        .auth-field { margin-bottom: 18px; }
        .auth-label {
          display: block;
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.5);
          margin-bottom: 8px;
        }
        .auth-input, .auth-select {
          width: 100%;
          background: rgba(10,22,40,0.8);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 8px;
          color: #e2eeff;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          padding: 12px 16px;
          outline: none;
          transition: border-color 0.15s, box-shadow 0.15s;
        }
        .auth-input:focus, .auth-select:focus {
          border-color: rgba(96,165,250,0.5);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .auth-input::placeholder { color: rgba(147,197,253,0.25); }
        .auth-select option { background: #0a1628; }

        .field-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        @media (max-width: 500px) { .field-row { grid-template-columns: 1fr; } }

        .section-divider {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 24px 0 20px;
        }
        .section-divider-line {
          flex: 1; height: 1px;
          background: rgba(59,130,246,0.12);
        }
        .section-divider-text {
          font-family: 'Outfit', sans-serif;
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: rgba(147,197,253,0.35);
          white-space: nowrap;
        }

        .btn-submit {
          width: 100%;
          height: 48px;
          margin-top: 8px;
          font-size: 14px;
        }

        .choose-cards {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }
        .choose-card {
          display: flex;
          align-items: center;
          gap: 14px;
          padding: 18px 20px;
          border-radius: 12px;
          border: 1px solid rgba(59,130,246,0.18);
          background: rgba(255,255,255,0.02);
          cursor: pointer;
          transition: border-color 0.15s, background 0.15s;
          text-align: left;
        }
        .choose-card:hover {
          border-color: rgba(96,165,250,0.5);
          background: rgba(37,99,235,0.07);
        }
        .choose-card-icon { font-size: 26px; flex-shrink: 0; }
        .choose-card-label {
          font-family: 'Syne', sans-serif;
          font-size: 15px; font-weight: 800; color: #f0f8ff;
          margin-bottom: 2px;
        }
        .choose-card-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 12px; color: rgba(147,197,253,0.55);
        }

        .back-link {
          background: none; border: none; cursor: pointer;
          color: rgba(147,197,253,0.55); font-family: 'Outfit', sans-serif;
          font-size: 12px; padding: 0; margin-bottom: 16px;
          display: inline-flex; align-items: center; gap: 6px;
        }
        .back-link:hover { color: #93c5fd; }

        .checkbox-row {
          display: flex; align-items: center; gap: 10px;
          margin-bottom: 18px; cursor: pointer;
        }
        .checkbox-row input { width: 16px; height: 16px; accent-color: #2563eb; }
        .checkbox-row span {
          font-family: 'Outfit', sans-serif; font-size: 13px; color: rgba(226,238,255,0.85);
        }
      `}</style>

      <div className="auth-page">
        <div className="auth-wrap">
          <Link href="/" className="auth-logo">
            {/* TODO: use config.club_short_name */}
            <div className="auth-logo-icon">BCC</div>
            {/* TODO: use config.club_name */}
            <div className="auth-logo-text">Bedfordview CC</div>
          </Link>

          <div className="auth-card">
            {success ? (
              <div className="success-card">
                <div className="success-icon">🏏</div>
                {/* TODO: use config.club_short_name */}
                <div className="success-title">Welcome to BCC!</div>
                <p className="success-sub">
                  Your account has been created. Sign in to access your dashboard.
                </p>
                <Link href="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                  Sign In
                </Link>
              </div>
            ) : screen === 'choose' ? (
              <>
                <div className="auth-title">Join the Club</div>
                <div className="auth-sub">
                  Already a member? <Link href="/login">Sign in →</Link>
                </div>

                <div className="choose-cards">
                  <button type="button" className="choose-card" onClick={() => setScreen('self')}>
                    <span className="choose-card-icon">🏏</span>
                    <span>
                      <div className="choose-card-label">Register Myself</div>
                      <div className="choose-card-sub">I want to create my own player account.</div>
                    </span>
                  </button>
                  <button type="button" className="choose-card" onClick={() => setScreen('child')}>
                    <span className="choose-card-icon">👨‍👩‍👧</span>
                    <span>
                      <div className="choose-card-label">Register My Child</div>
                      <div className="choose-card-sub">I'm a parent/guardian signing up a junior player.</div>
                    </span>
                  </button>
                </div>
              </>
            ) : (
              <>
                <button type="button" className="back-link" onClick={() => setScreen('choose')}>← Back</button>
                <div className="auth-title">{screen === 'child' ? 'Register Your Child' : 'Join the Club'}</div>
                <div className="auth-sub">
                  Already a member? <Link href="/login">Sign in →</Link>
                </div>

                {error && <div className="error-box">{error}</div>}

                {screen === 'child' && (
                  <div className="section-divider" style={{ marginTop: 0 }}>
                    <div className="section-divider-line" />
                    <span className="section-divider-text">Your Details (Parent/Guardian)</span>
                    <div className="section-divider-line" />
                  </div>
                )}

                <div className="auth-field">
                  <label className="auth-label">Full Name *</label>
                  <input className="auth-input" value={form.full_name}
                    onChange={e => set('full_name', e.target.value)}
                    placeholder="Your full name" />
                </div>
                <div className="auth-field">
                  <label className="auth-label">Email Address *</label>
                  <input className="auth-input" type="email" value={form.email}
                    onChange={e => set('email', e.target.value)}
                    placeholder="you@example.com" />
                </div>
                <div className="field-row">
                  <div className="auth-field">
                    <label className="auth-label">Password *</label>
                    <input className="auth-input" type="password" value={form.password}
                      onChange={e => set('password', e.target.value)}
                      placeholder="Min 8 characters" />
                  </div>
                  <div className="auth-field">
                    <label className="auth-label">Confirm *</label>
                    <input className="auth-input" type="password" value={form.confirm_password}
                      onChange={e => set('confirm_password', e.target.value)}
                      placeholder="Repeat password" />
                  </div>
                </div>

                {screen === 'child' && (
                  <label className="checkbox-row">
                    <input type="checkbox" checked={parentAlsoPlays}
                      onChange={e => setParentAlsoPlays(e.target.checked)} />
                    <span>I also play for the club</span>
                  </label>
                )}

                {(screen === 'self' || parentAlsoPlays) && (
                  <>
                    <div className="section-divider">
                      <div className="section-divider-line" />
                      <span className="section-divider-text">Cricket Profile (optional)</span>
                      <div className="section-divider-line" />
                    </div>

                    <div className="field-row">
                      <div className="auth-field">
                        <label className="auth-label">Batting Style</label>
                        <select className="auth-select" value={form.batting_style}
                          onChange={e => set('batting_style', e.target.value)}>
                          <option value="">Select…</option>
                          {BATTING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      <div className="auth-field">
                        <label className="auth-label">Bowling Style</label>
                        <select className="auth-select" value={form.bowling_style}
                          onChange={e => set('bowling_style', e.target.value)}>
                          <option value="">Select…</option>
                          {BOWLING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                    </div>
                  </>
                )}

                {screen === 'child' && (
                  <>
                    <div className="section-divider">
                      <div className="section-divider-line" />
                      <span className="section-divider-text">Your Child's Details</span>
                      <div className="section-divider-line" />
                    </div>

                    <div className="field-row">
                      <div className="auth-field">
                        <label className="auth-label">First Name *</label>
                        <input className="auth-input" value={child.firstName}
                          onChange={e => setChildField('firstName', e.target.value)}
                          placeholder="Child's first name" />
                      </div>
                      <div className="auth-field">
                        <label className="auth-label">Last Name *</label>
                        <input className="auth-input" value={child.lastName}
                          onChange={e => setChildField('lastName', e.target.value)}
                          placeholder="Child's last name" />
                      </div>
                    </div>
                    <div className="auth-field">
                      <label className="auth-label">Date of Birth *</label>
                      <input className="auth-input" type="date" value={child.dateOfBirth}
                        onChange={e => setChildField('dateOfBirth', e.target.value)} />
                    </div>
                  </>
                )}

                <button className="btn btn-primary btn-submit" onClick={handleSubmit} disabled={loading}>
                  {loading ? 'Creating Account…' : 'Create Account'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
