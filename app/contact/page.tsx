'use client'
import { useState } from 'react'

type FormState = { name: string; email: string; message: string }
type SubmitState = 'idle' | 'submitting' | 'success' | 'error'

export default function ContactPage() {
  const [form, setForm] = useState<FormState>({ name: '', email: '', message: '' })
  const [submitState, setSubmitState] = useState<SubmitState>('idle')

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) {
    setForm(f => ({ ...f, [e.target.name]: e.target.value }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setSubmitState('error')
      return
    }
    if (!form.email.includes('@')) {
      setSubmitState('error')
      return
    }
    setSubmitState('submitting')
    setTimeout(() => setSubmitState('success'), 250)
  }

  return (
    <>
      <style>{`
        .page-hero {
          padding: calc(var(--nav-h) + 60px) 0 60px;
          text-align: center;
        }
        .page-hero h1 {
          font-family: 'Syne', sans-serif;
          font-size: clamp(40px, 7vw, 72px);
          font-weight: 800;
          color: #f0f8ff;
          letter-spacing: -0.03em;
          margin: 12px 0 16px;
        }
        .page-hero-sub {
          font-family: 'Outfit', sans-serif;
          font-size: 17px;
          color: rgba(147,197,253,0.6);
          max-width: 480px;
          margin: 0 auto;
          line-height: 1.65;
        }
        .contact-body {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 24px 80px;
        }
        .contact-grid {
          display: grid;
          grid-template-columns: 1fr 1.4fr;
          gap: 28px;
          align-items: start;
        }
        @media (max-width: 768px) {
          .contact-grid { grid-template-columns: 1fr; }
          .page-hero { padding-top: calc(var(--nav-h) + 36px); }
          .page-hero-sub { font-size: 15px; }
        }
        .contact-info, .contact-form-panel { padding: 28px; }
        .contact-info-header {
          font-family: 'Syne', sans-serif;
          font-size: 16px;
          font-weight: 800;
          color: #e2eeff;
          letter-spacing: -0.01em;
          margin-bottom: 24px;
          padding-bottom: 16px;
          border-bottom: 1px solid rgba(59,130,246,0.12);
        }
        .contact-item {
          display: flex;
          gap: 14px;
          align-items: flex-start;
          padding: 14px 0;
          border-bottom: 1px solid rgba(59,130,246,0.07);
        }
        .contact-item:last-child { border-bottom: none; }
        .contact-item-icon {
          width: 38px; height: 38px;
          border-radius: 9px;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.2);
          display: flex; align-items: center; justify-content: center;
          font-size: 16px; flex-shrink: 0;
        }
        .contact-item-label {
          font-family: 'Outfit', sans-serif;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: rgba(147,197,253,0.45);
          margin-bottom: 4px;
        }
        .contact-item-value {
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          color: #93c5fd;
          text-decoration: none;
          line-height: 1.5;
          transition: color 0.15s;
        }
        a.contact-item-value:hover { color: #60a5fa; }
        .contact-item-value.plain { color: rgba(147,197,253,0.7); }
        .contact-form-panel .field {
          margin-bottom: 18px;
        }
        .contact-form-panel label {
          display: block;
          font-family: 'Outfit', sans-serif;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: rgba(147,197,253,0.5);
          margin-bottom: 8px;
        }
        .contact-textarea {
          min-height: 120px;
          resize: vertical;
        }
        .contact-error {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          background: rgba(239,68,68,0.08);
          border: 1px solid rgba(239,68,68,0.25);
          font-family: 'Outfit', sans-serif;
          font-size: 13px;
          color: #fca5a5;
          margin-bottom: 16px;
        }
        .contact-success {
          text-align: center;
          padding: 40px 20px;
        }
        .success-icon {
          width: 56px; height: 56px;
          border-radius: 50%;
          background: rgba(34,197,94,0.12);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 24px; color: #4ade80;
          margin: 0 auto 20px;
        }
        .success-title {
          font-family: 'Syne', sans-serif;
          font-size: 22px;
          font-weight: 800;
          color: #e2eeff;
          margin-bottom: 10px;
        }
        .contact-success p {
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          color: rgba(147,197,253,0.6);
        }
      `}</style>

      <div className="page-hero">
        <div className="container">
          <div className="section-label">Get in Touch</div>
          <h1>Contact Us</h1>
          <p className="page-hero-sub">
            Questions about joining, upcoming matches, or anything else — we'd love to hear from you.
          </p>
        </div>
      </div>

      <div className="contact-body">
        <div className="contact-grid">
          {/* LEFT: Club Info */}
          <div className="card contact-info">
            <div className="contact-info-header">Club Information</div>

            <div className="contact-item">
              <div className="contact-item-icon">📧</div>
              <div>
                <div className="contact-item-label">Email</div>
                <a href="mailto:info@bedfordviewcc.co.za" className="contact-item-value">
                  info@bedfordviewcc.co.za
                </a>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-item-icon">📍</div>
              <div>
                <div className="contact-item-label">Address</div>
                <div className="contact-item-value plain">
                  Van Buuren Rd, Bedfordview Extensions<br />
                  South Africa, 2008
                </div>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-item-icon">📘</div>
              <div>
                <div className="contact-item-label">Facebook</div>
                <a
                  href="https://www.facebook.com/people/Bedfordview-Cricket-Club-BCC/100063765303253/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-item-value"
                >
                  Bedfordview Cricket Club
                </a>
              </div>
            </div>

            <div className="contact-item">
              <div className="contact-item-icon">📷</div>
              <div>
                <div className="contact-item-label">Instagram</div>
                <a
                  href="https://www.instagram.com/bedfordviewcricketclub"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-item-value"
                >
                  @bedfordviewcricketclub
                </a>
              </div>
            </div>
          </div>

          {/* RIGHT: Contact Form */}
          <div className="card contact-form-panel">
            <div className="contact-info-header">Send a Message</div>

            {submitState === 'success' ? (
              <div className="contact-success">
                <div className="success-icon">✓</div>
                <div className="success-title">Message Sent!</div>
                <p>Thanks! We'll be in touch soon.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                {submitState === 'error' && (
                  <div className="contact-error">
                    Please fill in all fields with a valid email address.
                  </div>
                )}
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    name="name"
                    type="text"
                    className="input"
                    placeholder="Your name"
                    value={form.name}
                    onChange={handleChange}
                    disabled={submitState === 'submitting'}
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">Email</label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    className="input"
                    placeholder="your@email.com"
                    value={form.email}
                    onChange={handleChange}
                    disabled={submitState === 'submitting'}
                  />
                </div>
                <div className="field">
                  <label htmlFor="message">Message</label>
                  <textarea
                    id="message"
                    name="message"
                    className="input contact-textarea"
                    placeholder="What would you like to say?"
                    value={form.message}
                    onChange={handleChange}
                    disabled={submitState === 'submitting'}
                  />
                </div>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitState === 'submitting'}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {submitState === 'submitting' ? 'Sending…' : 'Send Message'}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
