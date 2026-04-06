'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface MembershipProduct {
  id: string
  name: string
  description: string | null
  price_zar: number
  benefits: string[]
  sort_order: number
}

interface Membership {
  status: string
  tier: string
  valid_until: string | null
}

function formatPrice(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function MembershipCardSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 18,
      padding: 28,
    }}>
      <div style={{ height: 16, width: '55%', background: 'rgba(59,130,246,0.07)', borderRadius: 4, marginBottom: 12 }} />
      <div style={{ height: 32, width: '40%', background: 'rgba(59,130,246,0.07)', borderRadius: 4, marginBottom: 18 }} />
      {[1,2,3,4].map(i => (
        <div key={i} style={{ height: 12, width: `${60 + i * 8}%`, background: 'rgba(59,130,246,0.04)', borderRadius: 4, marginBottom: 8 }} />
      ))}
    </div>
  )
}

export default function MembershipPage() {
  const router = useRouter()
  const [products, setProducts] = useState<MembershipProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [membership, setMembership] = useState<Membership | null | undefined>(undefined) // undefined = not yet fetched
  const [activeForm, setActiveForm] = useState<string | null>(null) // productId
  const [form, setForm] = useState({ customerName: '', customerEmail: '' })
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)
  const [userLoaded, setUserLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/products?category=membership')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        setAuthToken(session.access_token)
        setForm({
          customerName: session.user.user_metadata?.full_name || '',
          customerEmail: session.user.email || '',
        })

        // Check existing membership
        const { data } = await supabase
          .from('memberships')
          .select('status, tier, valid_until')
          .eq('user_id', session.user.id)
          .maybeSingle()
        setMembership(data as Membership | null)
      } else {
        setMembership(null)
      }
      setUserLoaded(true)
    })
  }, [])

  async function handleJoin(product: MembershipProduct, e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setSubmitError(null)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderType: 'membership',
          lineItems: [{
            productId: product.id,
            name: product.name,
            size: '',
            qty: 1,
            unitPrice: product.price_zar,
            tier: product.name.toLowerCase().includes('family') ? 'family' : 'standard',
          }],
          customerName: form.customerName,
          customerEmail: form.customerEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to submit')
        setSubmitting(false)
        return
      }
      router.push(`/membership/order/${data.orderId}`)
    } catch {
      setSubmitError('Network error — please try again')
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        .mem-page {
          padding-top: var(--nav-h);
          min-height: 100vh;
          padding-bottom: 80px;
        }
        .mem-hero {
          position: relative;
          padding: 56px 0 52px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
          text-align: center;
        }
        .mem-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 60%, rgba(37,99,235,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .mem-hero-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 12px;
        }
        .mem-hero-title {
          font-family: var(--font-display);
          font-size: clamp(32px, 6vw, 60px);
          font-weight: 800; line-height: 1.05;
          color: var(--text); letter-spacing: -0.02em;
          margin-bottom: 14px;
        }
        .mem-hero-sub {
          font-size: 15px; color: var(--muted); max-width: 480px; margin: 0 auto;
        }
        .mem-body { padding-top: 40px; }
        /* Active membership banner */
        .active-membership-card {
          background: linear-gradient(135deg, rgba(34,197,94,0.1) 0%, rgba(16,185,129,0.06) 100%);
          border: 1px solid rgba(34,197,94,0.3);
          border-radius: 14px;
          padding: 22px 24px;
          margin-bottom: 36px;
          display: flex; align-items: center; gap: 16px;
          position: relative; overflow: hidden;
        }
        .active-membership-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #22c55e, #10b981, transparent);
        }
        .mem-active-icon {
          width: 48px; height: 48px; border-radius: 12px;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.3);
          display: flex; align-items: center; justify-content: center;
          font-size: 22px; flex-shrink: 0;
        }
        .mem-active-info { flex: 1; }
        .mem-active-title {
          font-family: var(--font-display);
          font-size: 16px; font-weight: 800;
          color: var(--text); margin-bottom: 3px;
        }
        .mem-active-sub { font-size: 13px; color: var(--muted); }
        /* Pending banner */
        .pending-membership-card {
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.28);
          border-radius: 14px;
          padding: 18px 22px;
          margin-bottom: 36px;
          display: flex; align-items: center; gap: 14px;
        }
        /* Tier cards — mobile-first single column */
        .tier-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
          margin-bottom: 40px;
        }
        @media (min-width: 680px) {
          .tier-grid { grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); }
        }
        .tier-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid var(--border);
          border-radius: 18px;
          padding: 28px 24px;
          display: flex; flex-direction: column;
          position: relative; overflow: hidden;
          transition: border-color 0.2s, transform 0.2s;
        }
        .tier-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, #2563eb, #38bdf8, transparent);
        }
        .tier-card:hover { border-color: rgba(96,165,250,0.35); transform: translateY(-3px); }
        .tier-name {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 8px;
        }
        .tier-price {
          font-family: var(--font-display);
          font-size: clamp(28px, 4vw, 36px);
          font-weight: 800; color: var(--text);
          letter-spacing: -0.02em; margin-bottom: 4px;
        }
        .tier-price-sub {
          font-size: 12px; color: var(--muted); margin-bottom: 20px;
        }
        .tier-desc {
          font-size: 13px; color: var(--muted);
          margin-bottom: 18px; line-height: 1.6;
        }
        .tier-benefits { list-style: none; margin-bottom: 24px; flex: 1; }
        .tier-benefit {
          display: flex; align-items: flex-start; gap: 10px;
          font-size: 13px; color: var(--text);
          margin-bottom: 10px; line-height: 1.5;
        }
        .tier-benefit::before {
          content: '✓';
          color: #22c55e;
          font-weight: 700; font-size: 12px;
          margin-top: 1px; flex-shrink: 0;
        }
        /* Inline join form */
        .join-form {
          background: rgba(37,99,235,0.06);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 12px;
          padding: 18px;
          margin-top: 8px;
        }
        .join-form-title {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 14px;
        }
        .error-msg {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.28);
          color: #fca5a5;
          padding: 10px 14px; border-radius: 8px;
          font-size: 13px; margin-top: 12px;
        }
        @media (max-width: 680px) {
          .active-membership-card { flex-direction: column; text-align: center; }
        }
      `}</style>

      <div className="mem-page">
        <div className="mem-hero">
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="mem-hero-eyebrow">Bedfordview Cricket Club</div>
            <div className="mem-hero-title">Membership</div>
            <p className="mem-hero-sub">
              Join BCC and be part of our cricket family. Season membership includes access
              to all home matches and club events.
            </p>
          </div>
        </div>

        <div className="mem-body">
          <div className="container">

            {/* Membership status for logged-in users */}
            {userLoaded && membership?.status === 'active' && (
              <div className="active-membership-card">
                <div className="mem-active-icon">✓</div>
                <div className="mem-active-info">
                  <div className="mem-active-title">
                    Active Member — {membership.tier.charAt(0).toUpperCase() + membership.tier.slice(1)} Membership
                  </div>
                  <div className="mem-active-sub">
                    {membership.valid_until
                      ? `Valid until ${new Date(membership.valid_until).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })}`
                      : 'Season membership active'}
                  </div>
                </div>
                <span className="badge badge-blue" style={{ background: 'rgba(34,197,94,0.15)', color: '#86efac', borderColor: 'rgba(34,197,94,0.35)', flexShrink: 0 }}>
                  Active
                </span>
              </div>
            )}

            {userLoaded && membership?.status === 'pending' && (
              <div className="pending-membership-card">
                <span style={{ fontSize: 22 }}>⏳</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fbbf24', marginBottom: 2 }}>
                    Payment Pending
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--muted)' }}>
                    Your membership will be activated within 1 business day of payment clearing.
                  </div>
                </div>
              </div>
            )}

            {/* Tier cards */}
            <div className="tier-grid">
              {loading ? (
                <>
                  <MembershipCardSkeleton />
                  <MembershipCardSkeleton />
                </>
              ) : products.length === 0 ? (
                <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 24px', color: 'var(--muted)', fontSize: 14 }}>
                  No membership tiers available. Check back soon.
                </div>
              ) : products.map(product => (
                <div key={product.id} className="tier-card">
                  <div className="tier-name">{product.name}</div>
                  <div className="tier-price">{formatPrice(product.price_zar)}</div>
                  <div className="tier-price-sub">per season</div>
                  {product.description && (
                    <div className="tier-desc">{product.description}</div>
                  )}
                  {product.benefits && product.benefits.length > 0 && (
                    <ul className="tier-benefits">
                      {product.benefits.map((benefit, idx) => (
                        <li key={idx} className="tier-benefit">{benefit}</li>
                      ))}
                    </ul>
                  )}

                  {membership?.status === 'active' ? (
                    <div style={{ padding: '12px 0', fontSize: 13, color: '#86efac', textAlign: 'center' }}>
                      You have an active membership
                    </div>
                  ) : activeForm === product.id ? (
                    <form className="join-form" onSubmit={e => handleJoin(product, e)}>
                      <div className="join-form-title">Your Details</div>
                      <div style={{ marginBottom: 12 }}>
                        <label>Full Name</label>
                        <input
                          className="input"
                          required
                          value={form.customerName}
                          onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                          placeholder="Your full name"
                        />
                      </div>
                      <div style={{ marginBottom: 14 }}>
                        <label>Email Address</label>
                        <input
                          className="input"
                          type="email"
                          required
                          value={form.customerEmail}
                          onChange={e => setForm(prev => ({ ...prev, customerEmail: e.target.value }))}
                          placeholder="your@email.com"
                        />
                      </div>
                      {submitError && <div className="error-msg">{submitError}</div>}
                      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                        <button
                          type="button"
                          onClick={() => setActiveForm(null)}
                          style={{
                            flex: 1, padding: 12, borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'rgba(255,255,255,0.02)',
                            color: 'var(--muted)', cursor: 'pointer',
                            fontFamily: 'var(--font-display)',
                            fontSize: 13, fontWeight: 700, minHeight: 48,
                            touchAction: 'manipulation',
                          }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="btn btn-primary"
                          disabled={submitting}
                          style={{ flex: 2, justifyContent: 'center', fontSize: 13 }}
                        >
                          {submitting ? 'Processing...' : `Proceed — ${formatPrice(product.price_zar)}`}
                        </button>
                      </div>
                    </form>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => { setActiveForm(product.id); setSubmitError(null) }}
                      style={{ width: '100%', justifyContent: 'center' }}
                    >
                      Join Now →
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Info */}
            <div style={{
              background: 'rgba(255,255,255,0.01)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '20px 24px',
              fontSize: 13, color: 'var(--muted)',
              lineHeight: 1.7,
            }}>
              <strong style={{ color: 'var(--text)', fontFamily: 'var(--font-display)', fontSize: 12, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                How it works
              </strong>
              <p style={{ marginTop: 8, color: 'var(--muted)' }}>
                After submitting, you will receive EFT banking details. Your membership will be activated
                within 1 business day of your payment clearing. For questions, contact the club secretary.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
