'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

interface Product {
  id: string
  name: string
  description: string | null
  image_url: string | null
  price_zar: number
  sizes: string[]
}

type CartItem = {
  productId: string
  name: string
  size: string
  qty: number
  unitPrice: number
}

function formatPrice(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ProductCardSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
    }}>
      <div style={{ height: 200, background: 'rgba(59,130,246,0.05)' }} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ height: 16, width: '70%', background: 'rgba(59,130,246,0.07)', borderRadius: 4, marginBottom: 8 }} />
        <div style={{ height: 20, width: '40%', background: 'rgba(59,130,246,0.07)', borderRadius: 4, marginBottom: 12 }} />
        <div style={{ display: 'flex', gap: 6 }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: 32, width: 44, background: 'rgba(59,130,246,0.05)', borderRadius: 6 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export default function ShopPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cart, setCart] = useState<CartItem[]>([])
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [authToken, setAuthToken] = useState<string | null>(null)

  // Checkout form state
  const [form, setForm] = useState({
    customerName: '',
    customerEmail: '',
    phone: '',
    street: '',
    city: '',
    province: '',
    postalCode: '',
  })

  useEffect(() => {
    fetch('/api/products?category=kit')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setProducts(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setAuthToken(session.access_token)
        setForm(prev => ({
          ...prev,
          customerEmail: session.user.email || '',
          customerName: session.user.user_metadata?.full_name || '',
        }))
      }
    })
  }, [])

  function selectSize(productId: string, size: string) {
    setSelectedSizes(prev => ({ ...prev, [productId]: size }))
  }

  function addToCart(product: Product) {
    const size = selectedSizes[product.id]
    if (!size && product.sizes.length > 0) return // must pick a size

    setCart(prev => {
      const existing = prev.find(c => c.productId === product.id && c.size === (size || ''))
      if (existing) {
        return prev.map(c =>
          c.productId === product.id && c.size === (size || '')
            ? { ...c, qty: c.qty + 1 }
            : c
        )
      }
      return [...prev, { productId: product.id, name: product.name, size: size || '', qty: 1, unitPrice: product.price_zar }]
    })
  }

  function removeFromCart(productId: string, size: string) {
    setCart(prev => prev.filter(c => !(c.productId === productId && c.size === size)))
  }

  function updateQty(productId: string, size: string, qty: number) {
    if (qty <= 0) { removeFromCart(productId, size); return }
    setCart(prev => prev.map(c => c.productId === productId && c.size === size ? { ...c, qty } : c))
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.unitPrice * item.qty, 0)
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0)

  async function handleCheckout(e: React.FormEvent) {
    e.preventDefault()
    if (cart.length === 0) return
    setSubmitting(true)
    setSubmitError(null)

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          orderType: 'kit',
          lineItems: cart,
          shippingAddress: {
            street: form.street,
            city: form.city,
            province: form.province,
            postalCode: form.postalCode,
          },
          customerName: form.customerName,
          customerEmail: form.customerEmail,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setSubmitError(data.error || 'Failed to place order')
        setSubmitting(false)
        return
      }
      router.push(`/shop/order/${data.orderId}`)
    } catch {
      setSubmitError('Network error — please try again')
      setSubmitting(false)
    }
  }

  return (
    <>
      <style>{`
        .shop-page {
          padding-top: var(--nav-h);
          min-height: 100vh;
          padding-bottom: 90px;
        }
        .shop-hero {
          position: relative;
          padding: 56px 0 52px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
          text-align: center;
        }
        .shop-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 50% 60%, rgba(37,99,235,0.12) 0%, transparent 60%);
          pointer-events: none;
        }
        .shop-hero-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 12px;
        }
        .shop-hero-title {
          font-family: var(--font-display);
          font-size: clamp(32px, 6vw, 60px);
          font-weight: 800; line-height: 1.05;
          color: var(--text); letter-spacing: -0.02em;
          margin-bottom: 14px;
        }
        .shop-hero-sub {
          font-size: 15px; color: var(--muted); max-width: 480px; margin: 0 auto;
        }
        .shop-layout {
          display: grid;
          grid-template-columns: 1fr 340px;
          gap: 28px;
          padding-top: 32px;
          align-items: start;
        }
        .product-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 20px;
        }
        .product-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid var(--border);
          border-radius: 16px;
          overflow: hidden;
          transition: border-color 0.2s, transform 0.2s;
          position: relative;
        }
        .product-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.3), transparent);
        }
        .product-card:hover { border-color: rgba(96,165,250,0.35); transform: translateY(-2px); }
        .product-image {
          height: 200px;
          background: linear-gradient(135deg, rgba(37,99,235,0.12) 0%, rgba(14,165,233,0.06) 100%);
          display: flex; align-items: center; justify-content: center;
          font-size: 56px;
          border-bottom: 1px solid var(--border);
        }
        .product-body { padding: 16px 18px 18px; }
        .product-name {
          font-family: var(--font-display);
          font-size: 15px; font-weight: 700;
          color: var(--text); margin-bottom: 4px;
          letter-spacing: -0.01em;
        }
        .product-price {
          font-family: var(--font-display);
          font-size: 18px; font-weight: 800;
          color: #60a5fa; margin-bottom: 12px;
        }
        .product-desc {
          font-size: 13px; color: var(--muted);
          margin-bottom: 14px; line-height: 1.5;
        }
        .size-pills { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
        .size-pill {
          padding: 8px 16px; border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 44px; min-width: 44px;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .size-pill:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .size-pill.selected {
          border-color: rgba(96,165,250,0.5);
          background: rgba(37,99,235,0.2);
          color: #93c5fd;
        }
        .add-to-cart-btn {
          width: 100%;
          padding: 11px;
          border-radius: 9px;
          border: none;
          background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
          color: #fff;
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          cursor: pointer;
          transition: opacity 0.15s, transform 0.15s;
          min-height: 44px;
          box-shadow: 0 4px 14px rgba(37,99,235,0.25);
        }
        .add-to-cart-btn:hover:not(:disabled) { opacity: 0.9; transform: translateY(-1px); }
        .add-to-cart-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none; }
        .size-hint {
          font-size: 12px; color: rgba(252,165,165,0.7);
          margin-bottom: 8px;
        }
        /* Cart sidebar */
        .cart-panel {
          position: sticky; top: calc(var(--nav-h) + 16px);
          background: rgba(5,18,42,0.85);
          border: 1px solid rgba(59,130,246,0.18);
          border-radius: 16px;
          overflow: hidden;
        }
        .cart-panel::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.35), transparent);
        }
        .cart-head {
          padding: 16px 20px;
          border-bottom: 1px solid rgba(59,130,246,0.1);
          display: flex; align-items: center; justify-content: space-between;
        }
        .cart-title {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--muted);
        }
        .cart-count-badge {
          padding: 2px 8px; border-radius: 10px;
          background: rgba(37,99,235,0.2);
          border: 1px solid rgba(59,130,246,0.3);
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          color: #93c5fd;
        }
        .cart-body { padding: 14px 16px; }
        .cart-item {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 0;
          border-bottom: 1px solid rgba(59,130,246,0.08);
        }
        .cart-item:last-child { border-bottom: none; }
        .cart-item-info { flex: 1; min-width: 0; }
        .cart-item-name {
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          color: var(--text); margin-bottom: 2px;
        }
        .cart-item-size { font-size: 11px; color: var(--muted); }
        .cart-item-price {
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          color: #60a5fa; flex-shrink: 0;
        }
        .qty-control {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        .qty-btn {
          width: 36px; height: 36px; border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.03);
          color: var(--text);
          font-size: 16px; font-weight: 700;
          cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: border-color 0.15s;
          touch-action: manipulation;
        }
        .qty-btn:hover { border-color: rgba(59,130,246,0.3); }
        .qty-num {
          font-family: var(--font-display);
          font-size: 13px; font-weight: 700;
          color: var(--text); min-width: 16px; text-align: center;
        }
        .cart-total-row {
          display: flex; justify-content: space-between; align-items: center;
          padding: 14px 16px;
          border-top: 1px solid rgba(59,130,246,0.12);
        }
        .cart-total-label {
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          letter-spacing: 0.1em; text-transform: uppercase;
          color: var(--muted);
        }
        .cart-total-value {
          font-family: var(--font-display);
          font-size: 20px; font-weight: 800;
          color: #60a5fa;
        }
        .cart-cta { padding: 0 16px 16px; }
        .cart-empty {
          padding: 24px 16px; text-align: center;
          color: rgba(147,197,253,0.35); font-size: 13px;
          line-height: 1.7;
        }
        /* Checkout panel */
        .checkout-overlay {
          position: fixed; inset: 0; z-index: 50;
          background: rgba(5,12,26,0.9);
          display: flex; align-items: flex-end; justify-content: center;
          padding: 0;
          backdrop-filter: blur(4px);
        }
        .checkout-sheet {
          background: var(--panel);
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 20px 20px 0 0;
          width: 100%; max-width: 600px;
          max-height: 92vh;
          overflow-y: auto;
          padding: 28px 24px 40px;
          position: relative;
        }
        .checkout-sheet::before {
          content: '';
          display: block;
          width: 36px; height: 4px; border-radius: 2px;
          background: rgba(59,130,246,0.3);
          margin: 0 auto 24px;
        }
        .checkout-title {
          font-family: var(--font-display);
          font-size: 20px; font-weight: 800;
          color: var(--text); margin-bottom: 20px;
          letter-spacing: -0.01em;
        }
        .form-section-label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--sky); margin: 20px 0 12px;
          display: flex; align-items: center; gap: 8px;
        }
        .form-section-label::before {
          content: '';
          display: inline-block;
          width: 14px; height: 1px; background: var(--sky);
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
        }
        .checkout-summary {
          background: rgba(37,99,235,0.07);
          border: 1px solid rgba(59,130,246,0.15);
          border-radius: 10px;
          padding: 14px 16px;
          margin-bottom: 20px;
        }
        .checkout-summary-title {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 10px;
        }
        .checkout-summary-item {
          display: flex; justify-content: space-between;
          font-size: 13px; margin-bottom: 6px;
          color: var(--text);
        }
        .checkout-summary-total {
          display: flex; justify-content: space-between;
          padding-top: 10px;
          border-top: 1px solid rgba(59,130,246,0.12);
          margin-top: 8px;
          font-family: var(--font-display);
          font-size: 16px; font-weight: 800;
          color: #60a5fa;
        }
        .error-msg {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.28);
          color: #fca5a5;
          padding: 10px 14px; border-radius: 8px;
          font-size: 13px; margin: 16px 0;
        }
        /* Mobile cart bottom bar */
        .cart-mobile-bar {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 40;
          background: rgba(6,15,34,0.97);
          border-top: 1px solid rgba(59,130,246,0.2);
          padding: 12px 16px;
          display: flex;
          align-items: center; gap: 14px;
          backdrop-filter: blur(12px);
        }
        /* Default: mobile-first — single column, bottom bar visible */
        .shop-layout { grid-template-columns: 1fr; }
        .cart-panel-desktop { display: none; }
        .product-grid { grid-template-columns: 1fr; }
        .form-row { grid-template-columns: 1fr; }
        .checkout-sheet { padding: 20px 16px 40px; }

        @media (min-width: 640px) {
          .product-grid { grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); }
        }
        @media (min-width: 900px) {
          .shop-layout { grid-template-columns: 1fr 340px; }
          .cart-panel-desktop { display: block; }
          .cart-mobile-bar { display: none; }
          .shop-page { padding-bottom: 48px; }
          .form-row { grid-template-columns: 1fr 1fr; }
          .checkout-sheet { padding: 28px 24px 40px; }
        }
      `}</style>

      <div className="shop-page">
        <div className="shop-hero">
          <div className="container" style={{ position: 'relative', zIndex: 1 }}>
            <div className="shop-hero-eyebrow">Bedfordview Cricket Club</div>
            <div className="shop-hero-title">Club Shop</div>
            <p className="shop-hero-sub">
              Official BCC playing kit — order online, pay by EFT.
            </p>
          </div>
        </div>

        <div className="container">
          <div className="shop-layout">
            {/* Products */}
            <div>
              <div className="product-grid">
                {loading ? (
                  <>
                    <ProductCardSkeleton />
                    <ProductCardSkeleton />
                    <ProductCardSkeleton />
                  </>
                ) : products.length === 0 ? (
                  <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '48px 24px', color: 'var(--muted)', fontSize: 14 }}>
                    No products available right now. Check back soon.
                  </div>
                ) : products.map(product => {
                  const selectedSize = selectedSizes[product.id]
                  const needsSize = product.sizes.length > 0
                  const canAdd = !needsSize || !!selectedSize
                  return (
                    <div key={product.id} className="product-card">
                      <div className="product-image">
                        {product.image_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={product.image_url} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          <span style={{ fontSize: 56, opacity: 0.4 }}>👕</span>
                        )}
                      </div>
                      <div className="product-body">
                        <div className="product-name">{product.name}</div>
                        <div className="product-price">{formatPrice(product.price_zar)}</div>
                        {product.description && (
                          <div className="product-desc">{product.description}</div>
                        )}
                        {product.sizes.length > 0 && (
                          <>
                            <div className="size-pills">
                              {product.sizes.map(s => (
                                <button
                                  key={s}
                                  className={`size-pill${selectedSize === s ? ' selected' : ''}`}
                                  onClick={() => selectSize(product.id, s)}
                                  type="button"
                                >
                                  {s}
                                </button>
                              ))}
                            </div>
                            {!canAdd && (
                              <div className="size-hint">Select a size to add to cart</div>
                            )}
                          </>
                        )}
                        <button
                          className="add-to-cart-btn"
                          disabled={!canAdd}
                          onClick={() => addToCart(product)}
                          type="button"
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Desktop cart sidebar */}
            <div className="cart-panel-desktop">
              <CartPanel
                cart={cart}
                cartCount={cartCount}
                cartTotal={cartTotal}
                onUpdateQty={updateQty}
                onRemove={removeFromCart}
                onCheckout={() => setCheckoutOpen(true)}
              />
            </div>
          </div>
        </div>

        {/* Mobile bottom bar */}
        <div className="cart-mobile-bar">
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 2 }}>
              {cartCount} item{cartCount !== 1 ? 's' : ''}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: '#60a5fa' }}>
              {formatPrice(cartTotal)}
            </div>
          </div>
          <button
            className="btn btn-primary"
            disabled={cart.length === 0}
            onClick={() => setCheckoutOpen(true)}
          >
            Checkout →
          </button>
        </div>
      </div>

      {/* Checkout sheet */}
      {checkoutOpen && (
        <div
          className="checkout-overlay"
          onClick={e => { if (e.target === e.currentTarget) setCheckoutOpen(false) }}
        >
          <div className="checkout-sheet">
            <div className="checkout-title">Complete Your Order</div>

            {/* Order summary */}
            <div className="checkout-summary">
              <div className="checkout-summary-title">Order Summary</div>
              {cart.map(item => (
                <div key={`${item.productId}-${item.size}`} className="checkout-summary-item">
                  <span>{item.name}{item.size ? ` (${item.size})` : ''} ×{item.qty}</span>
                  <span>{formatPrice(item.unitPrice * item.qty)}</span>
                </div>
              ))}
              <div className="checkout-summary-total">
                <span>Total</span>
                <span>{formatPrice(cartTotal)}</span>
              </div>
            </div>

            <form onSubmit={handleCheckout}>
              <div className="form-section-label">Contact Details</div>
              <div style={{ marginBottom: 14 }}>
                <label>Full Name</label>
                <input
                  className="input"
                  required
                  value={form.customerName}
                  onChange={e => setForm(prev => ({ ...prev, customerName: e.target.value }))}
                  placeholder="Your full name"
                />
              </div>
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div>
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
                <div>
                  <label>Phone Number</label>
                  <input
                    className="input"
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="082 000 0000"
                  />
                </div>
              </div>

              <div className="form-section-label">Delivery Address</div>
              <div style={{ marginBottom: 14 }}>
                <label>Street Address</label>
                <input
                  className="input"
                  required
                  value={form.street}
                  onChange={e => setForm(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="123 Main Road"
                />
              </div>
              <div className="form-row" style={{ marginBottom: 14 }}>
                <div>
                  <label>City / Suburb</label>
                  <input
                    className="input"
                    required
                    value={form.city}
                    onChange={e => setForm(prev => ({ ...prev, city: e.target.value }))}
                    placeholder="Bedfordview"
                  />
                </div>
                <div>
                  <label>Province</label>
                  <select
                    className="select"
                    required
                    value={form.province}
                    onChange={e => setForm(prev => ({ ...prev, province: e.target.value }))}
                  >
                    <option value="">Select...</option>
                    <option value="Gauteng">Gauteng</option>
                    <option value="Western Cape">Western Cape</option>
                    <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                    <option value="Eastern Cape">Eastern Cape</option>
                    <option value="Limpopo">Limpopo</option>
                    <option value="Mpumalanga">Mpumalanga</option>
                    <option value="North West">North West</option>
                    <option value="Free State">Free State</option>
                    <option value="Northern Cape">Northern Cape</option>
                  </select>
                </div>
              </div>
              <div style={{ marginBottom: 20 }}>
                <label>Postal Code</label>
                <input
                  className="input"
                  required
                  value={form.postalCode}
                  onChange={e => setForm(prev => ({ ...prev, postalCode: e.target.value }))}
                  placeholder="2007"
                  style={{ maxWidth: 160 }}
                />
              </div>

              {submitError && <div className="error-msg">{submitError}</div>}

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => setCheckoutOpen(false)}
                  style={{
                    flex: 1, padding: 14, borderRadius: 10,
                    border: '1px solid var(--border)',
                    background: 'rgba(255,255,255,0.03)',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontSize: 14, fontWeight: 700,
                    minHeight: 48,
                  }}
                >
                  Back to Cart
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ flex: 2, justifyContent: 'center', fontSize: 14 }}
                >
                  {submitting ? 'Placing Order...' : `Place Order — ${formatPrice(cartTotal)}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}

function CartPanel({
  cart, cartCount, cartTotal, onUpdateQty, onRemove, onCheckout,
}: {
  cart: CartItem[]
  cartCount: number
  cartTotal: number
  onUpdateQty: (pid: string, size: string, qty: number) => void
  onRemove: (pid: string, size: string) => void
  onCheckout: () => void
}) {
  return (
    <div className="cart-panel" style={{ position: 'relative' }}>
      <div className="cart-head">
        <span className="cart-title">Your Cart</span>
        {cartCount > 0 && (
          <span className="cart-count-badge">{cartCount}</span>
        )}
      </div>

      {cart.length === 0 ? (
        <div className="cart-empty">
          Your cart is empty.<br />
          Add items from the shop.
        </div>
      ) : (
        <div className="cart-body">
          {cart.map(item => (
            <div key={`${item.productId}-${item.size}`} className="cart-item">
              <div className="cart-item-info">
                <div className="cart-item-name">{item.name}</div>
                {item.size && <div className="cart-item-size">Size: {item.size}</div>}
              </div>
              <div className="qty-control">
                <button className="qty-btn" onClick={() => onUpdateQty(item.productId, item.size, item.qty - 1)}>−</button>
                <span className="qty-num">{item.qty}</span>
                <button className="qty-btn" onClick={() => onUpdateQty(item.productId, item.size, item.qty + 1)}>+</button>
              </div>
              <span className="cart-item-price">{formatPrice(item.unitPrice * item.qty)}</span>
            </div>
          ))}
        </div>
      )}

      {cart.length > 0 && (
        <>
          <div className="cart-total-row">
            <span className="cart-total-label">Total</span>
            <span className="cart-total-value">{formatPrice(cartTotal)}</span>
          </div>
          <div className="cart-cta">
            <button
              className="btn btn-primary"
              onClick={onCheckout}
              style={{ width: '100%', justifyContent: 'center' }}
            >
              Checkout →
            </button>
            <p style={{ fontSize: 11, color: 'var(--muted)', textAlign: 'center', marginTop: 10 }}>
              Pay by EFT. Order confirmed after payment clears.
            </p>
          </div>
        </>
      )}
    </div>
  )
}
