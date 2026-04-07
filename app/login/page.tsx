'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin() {
    setError('')
    if (!email || !password) { setError('Please enter your email and password.'); return }
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError
      router.push('/dashboard')
    } catch (err: any) {
      const msg: string = err?.message ?? ''
      if (msg.toLowerCase().includes('email not confirmed')) {
        setError('Please confirm your email address before signing in.')
      } else {
        setError('Invalid email or password.')
      }
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
        /* Glow behind card */
        .auth-page::before {
          content: '';
          position: fixed;
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          width: 500px; height: 500px;
          background: radial-gradient(circle, rgba(37,99,235,0.1) 0%, transparent 65%);
          pointer-events: none;
        }

        .auth-wrap {
          width: 100%;
          max-width: 420px;
          padding: 24px;
          position: relative; z-index: 1;
        }

        /* Logo mark above card */
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

        .auth-field { margin-bottom: 18px; }
        .auth-label {
          display: block;
          font-family: 'Outfit', sans-serif;
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.5);
          margin-bottom: 8px;
        }
        .auth-input {
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
        .auth-input:focus {
          border-color: rgba(96,165,250,0.5);
          box-shadow: 0 0 0 3px rgba(37,99,235,0.12);
        }
        .auth-input::placeholder { color: rgba(147,197,253,0.25); }

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
            <div className="auth-title">Sign In</div>
            <div className="auth-sub">
              Not a member yet? <Link href="/register">Join the club →</Link>
            </div>

            {error && <div className="error-box">{error}</div>}

            <div className="auth-field">
              <label className="auth-label">Email Address</label>
              <input
                className="auth-input"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@example.com"
              />
            </div>
            <div className="auth-field">
              <label className="auth-label">Password</label>
              <input
                className="auth-input"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="Your password"
              />
            </div>

            <button className="btn btn-primary btn-submit" onClick={handleLogin} disabled={loading}>
              {loading ? 'Signing In…' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
