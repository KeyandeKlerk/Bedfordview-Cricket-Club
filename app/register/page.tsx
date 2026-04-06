'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

const BATTING_STYLES = ['Right-hand bat', 'Left-hand bat']
const BOWLING_STYLES = ['Right-arm fast', 'Right-arm medium', 'Right-arm off-spin', 'Right-arm leg-spin',
  'Left-arm fast', 'Left-arm medium', 'Left-arm orthodox', 'Left-arm wrist-spin', 'Does not bowl']

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', confirm_password: '',
    batting_style: '', bowling_style: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function handleSubmit() {
    setError('')
    if (!form.full_name || !form.email || !form.password) { setError('Please fill in all required fields.'); return }
    if (form.password !== form.confirm_password) { setError('Passwords do not match.'); return }
    if (form.password.length < 8) { setError('Password must be at least 8 characters.'); return }

    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            batting_style: form.batting_style || null,
            bowling_style: form.bowling_style || null,
          }
        }
      })
      if (authError) throw authError
      setSuccess(true)
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.')
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
      `}</style>

      <div className="auth-page">
        <div className="auth-wrap">
          <Link href="/" className="auth-logo">
            <div className="auth-logo-icon">BCC</div>
            <div className="auth-logo-text">Bedfordview CC</div>
          </Link>

          <div className="auth-card">
            {success ? (
              <div className="success-card">
                <div className="success-icon">🏏</div>
                <div className="success-title">Welcome to BCC!</div>
                <p className="success-sub">
                  Check your email to verify your account, then sign in to access your dashboard.
                </p>
                <Link href="/login" className="btn btn-primary" style={{ display: 'inline-flex' }}>
                  Sign In
                </Link>
              </div>
            ) : (
              <>
                <div className="auth-title">Join the Club</div>
                <div className="auth-sub">
                  Already a member? <Link href="/login">Sign in →</Link>
                </div>

                {error && <div className="error-box">{error}</div>}

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
