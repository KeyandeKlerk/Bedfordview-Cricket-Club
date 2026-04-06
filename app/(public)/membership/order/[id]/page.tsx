import { serverSupabase } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import CopyButton from './CopyButton'
import PrintButton from './PrintButton'

interface LineItem {
  name?: string
  qty: number
  unitPrice: number
  tier?: string
}

function formatPrice(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default async function MembershipOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const { data: order, error } = await serverSupabase
    .from('orders')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !order) notFound()

  const lineItems: LineItem[] = Array.isArray(order.line_items) ? order.line_items : []

  const bankName = process.env.NEXT_PUBLIC_BANK_NAME || 'FNB'
  const accountName = process.env.NEXT_PUBLIC_ACCOUNT_NAME || 'Bedfordview Cricket Club'
  const accountNumber = process.env.NEXT_PUBLIC_ACCOUNT_NUMBER || '62XXXXXXXXXX'
  const branchCode = process.env.NEXT_PUBLIC_BRANCH_CODE || '250655'

  return (
    <>
      <style>{`
        .mem-order-page {
          padding-top: var(--nav-h);
          min-height: 100vh;
          padding-bottom: 60px;
        }
        .mem-order-hero {
          position: relative;
          padding: 40px 0 36px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
          text-align: center;
        }
        .mem-order-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 60%, rgba(34,197,94,0.08) 0%, transparent 60%);
          pointer-events: none;
        }
        .mem-success-icon {
          width: 56px; height: 56px; border-radius: 50%;
          background: rgba(34,197,94,0.15);
          border: 1px solid rgba(34,197,94,0.35);
          display: flex; align-items: center; justify-content: center;
          margin: 0 auto 16px;
        }
        .mem-ref-label {
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: #86efac; margin-bottom: 10px;
        }
        .mem-ref {
          font-family: monospace;
          font-size: clamp(22px, 6vw, 40px);
          font-weight: 800; color: var(--text);
          letter-spacing: 0.04em; margin-bottom: 12px;
          word-break: break-all;
        }
        .mem-sub {
          font-size: 14px; color: var(--muted); max-width: 440px; margin: 0 auto;
          line-height: 1.7; padding: 0 16px;
        }
        .mem-order-body { padding-top: 24px; }

        /* Mobile-first: single column */
        .mem-order-layout {
          display: grid;
          grid-template-columns: 1fr;
          gap: 0;
        }
        @media (min-width: 768px) {
          .mem-order-layout {
            grid-template-columns: 1fr 320px;
            gap: 24px;
            align-items: start;
          }
        }

        .order-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid var(--border);
          border-radius: 14px;
          overflow: hidden;
          margin-bottom: 16px;
          position: relative;
        }
        .order-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent);
        }
        .order-card-head {
          padding: 14px 16px;
          border-bottom: 1px solid rgba(59,130,246,0.08);
        }
        .order-card-title {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--muted);
        }

        .pending-note {
          background: rgba(245,158,11,0.08);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          display: flex; gap: 12px; align-items: flex-start;
        }
        .pending-note-title {
          font-family: var(--font-display);
          fontWeight: 700; color: #fbbf24; margin-bottom: 4px; font-size: 14px;
        }

        /* Items list — no table */
        .items-list { padding: 4px 16px 0; }
        .item-row {
          display: flex; justify-content: space-between; align-items: flex-start;
          padding: 12px 0;
          border-bottom: 1px solid rgba(59,130,246,0.06);
          gap: 12px;
        }
        .item-row:last-child { border-bottom: none; }
        .item-name {
          font-size: 14px; color: var(--text); font-weight: 600;
          flex: 1; line-height: 1.4;
        }
        .item-meta { font-size: 12px; color: var(--muted); margin-top: 3px; }
        .item-price {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: #60a5fa; flex-shrink: 0;
        }
        .items-total {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px;
          border-top: 1px solid rgba(59,130,246,0.12);
          background: rgba(37,99,235,0.04);
        }
        .items-total-label {
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--muted);
        }
        .items-total-value {
          font-family: var(--font-display);
          font-size: 22px; font-weight: 800;
          color: #60a5fa;
        }

        /* Bank details card */
        .bank-card {
          background: linear-gradient(135deg, rgba(37,99,235,0.1) 0%, rgba(14,165,233,0.06) 100%);
          border: 1px solid rgba(59,130,246,0.28);
          border-radius: 14px;
          padding: 20px 18px;
          margin-bottom: 16px;
        }
        .bank-card-title {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        .bank-card-title::before {
          content: '';
          display: inline-block;
          width: 14px; height: 1px; background: var(--sky);
        }
        .bank-row {
          display: flex; justify-content: space-between; align-items: baseline;
          padding: 10px 0;
          border-bottom: 1px solid rgba(59,130,246,0.08);
          gap: 8px;
        }
        .bank-row:last-child { border-bottom: none; }
        .bank-label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--muted); flex-shrink: 0;
        }
        .bank-value {
          font-family: monospace;
          font-size: 14px; font-weight: 600;
          color: var(--text);
          text-align: right; word-break: break-all;
        }

        /* Reference block */
        .reference-block {
          margin-top: 16px;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.35);
          border-radius: 10px;
          padding: 16px;
          text-align: center;
        }
        .reference-instruction {
          font-size: 12px; color: var(--muted);
          margin-bottom: 10px; line-height: 1.5;
        }
        .reference-value {
          font-family: monospace;
          font-size: clamp(18px, 4vw, 26px);
          font-weight: 800;
          color: #93c5fd;
          letter-spacing: 0.06em;
          word-break: break-all;
          margin-bottom: 14px;
          line-height: 1.3;
        }

        .action-btns {
          display: flex; flex-direction: column; gap: 10px;
          margin-top: 16px;
        }
        .action-btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          padding: 13px 20px; border-radius: 9px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 48px;
          text-decoration: none;
        }
        .action-btn:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }

        @media print {
          .no-print { display: none !important; }
          body { background: white !important; color: black !important; }
        }
      `}</style>

      <div className="mem-order-page">
        <div className="mem-order-hero">
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="mem-success-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <div className="mem-ref-label">Membership Application Received</div>
            <div className="mem-ref">{order.reference}</div>
            <p className="mem-sub">
              Thank you{order.customer_name ? `, ${order.customer_name}` : ''}! Your membership application
              has been received. Please complete payment via EFT — your membership will be activated
              within 1 business day of payment clearing.
            </p>
          </div>
        </div>

        <div className="mem-order-body">
          <div className="container">
            <div className="mem-order-layout">
              {/* Left: pending note + items */}
              <div>
                <div className="pending-note">
                  <span style={{ fontSize: 20, flexShrink: 0 }}>⏳</span>
                  <div>
                    <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#fbbf24', marginBottom: 4, fontSize: 14 }}>
                      Pending Activation
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--muted)', lineHeight: 1.6 }}>
                      Your membership will be activated within 1 business day of your EFT payment clearing.
                      You will not need to do anything else after paying.
                    </div>
                  </div>
                </div>

                <div className="order-card">
                  <div className="order-card-head">
                    <div className="order-card-title">Membership Details</div>
                  </div>
                  <div className="items-list">
                    {lineItems.map((item, idx) => (
                      <div key={idx} className="item-row">
                        <div>
                          <div className="item-name">{item.name || 'Membership'}</div>
                          <div className="item-meta">1 Season</div>
                        </div>
                        <div className="item-price">{formatPrice(item.unitPrice)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="items-total">
                    <span className="items-total-label">Total</span>
                    <span className="items-total-value">{formatPrice(order.amount_total)}</span>
                  </div>
                </div>
              </div>

              {/* Right: bank details + actions */}
              <div>
                <div className="bank-card">
                  <div className="bank-card-title">EFT Payment Details</div>
                  <div className="bank-row">
                    <span className="bank-label">Bank</span>
                    <span className="bank-value">{bankName}</span>
                  </div>
                  <div className="bank-row">
                    <span className="bank-label">Account Name</span>
                    <span className="bank-value">{accountName}</span>
                  </div>
                  <div className="bank-row">
                    <span className="bank-label">Account No</span>
                    <span className="bank-value">{accountNumber}</span>
                  </div>
                  <div className="bank-row">
                    <span className="bank-label">Branch Code</span>
                    <span className="bank-value">{branchCode}</span>
                  </div>
                  <div className="bank-row" style={{ borderBottom: 'none' }}>
                    <span className="bank-label">Amount</span>
                    <span className="bank-value" style={{ color: '#60a5fa', fontSize: 16 }}>
                      {formatPrice(order.amount_total)}
                    </span>
                  </div>

                  <div className="reference-block">
                    <div className="reference-instruction">
                      Use this as your payment reference:
                    </div>
                    <div className="reference-value">{order.reference}</div>
                    <CopyButton text={order.reference} />
                  </div>
                </div>

                <div className="action-btns no-print">
                  <PrintButton />
                  <Link href="/membership" className="action-btn">
                    Back to Membership
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
