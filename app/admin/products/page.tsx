'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Product {
  id: string
  name: string
  description: string | null
  image_url: string | null
  category: 'kit' | 'membership'
  price_zar: number
  sizes: string[]
  benefits: string[]
  is_active: boolean
  sort_order: number
}

const ALL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL']

function formatPrice(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ProductSkeleton() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.02)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '18px 20px',
      marginBottom: 10,
    }}>
      <div style={{ height: 16, width: '45%', background: 'rgba(59,130,246,0.07)', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ height: 12, width: '25%', background: 'rgba(59,130,246,0.05)', borderRadius: 4 }} />
    </div>
  )
}

interface ProductModalProps {
  product: Partial<Product> | null
  onClose: () => void
  onSave: (product: Partial<Product>) => Promise<void>
  saving: boolean
  error: string | null
  isNew: boolean
}

function ProductModal({ product, onClose, onSave, saving, error, isNew }: ProductModalProps) {
  const [form, setForm] = useState<Partial<Product>>(product || {
    name: '', description: '', image_url: '', category: 'kit',
    price_zar: 0, sizes: [], benefits: [], is_active: true, sort_order: 0,
  })
  const [priceInput, setPriceInput] = useState(
    product?.price_zar ? (product.price_zar / 100).toFixed(2) : ''
  )
  const [benefitsText, setBenefitsText] = useState(
    product?.benefits?.join('\n') || ''
  )

  function toggleSize(s: string) {
    setForm(prev => ({
      ...prev,
      sizes: prev.sizes?.includes(s)
        ? prev.sizes.filter(x => x !== s)
        : [...(prev.sizes || []), s],
    }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const cents = Math.round(parseFloat(priceInput || '0') * 100)
    const benefits = benefitsText.split('\n').map(b => b.trim()).filter(Boolean)
    await onSave({ ...form, price_zar: cents, benefits })
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(5,12,26,0.88)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--panel)',
        border: '1px solid rgba(59,130,246,0.25)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 20px 32px',
        width: '100%',
        maxWidth: 560,
        maxHeight: '92vh',
        overflowY: 'auto',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, #2563eb, #38bdf8, transparent)',
          borderRadius: '20px 20px 0 0',
        }} />
        {/* Drag handle */}
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(59,130,246,0.3)',
          margin: '8px auto 16px',
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
            {isNew ? 'Add Product' : 'Edit Product'}
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {isNew && (
            <div style={{ marginBottom: 16 }}>
              <label>Category</label>
              <select
                className="select"
                value={form.category}
                onChange={e => setForm(prev => ({ ...prev, category: e.target.value as 'kit' | 'membership' }))}
              >
                <option value="kit">Kit</option>
                <option value="membership">Membership</option>
              </select>
            </div>
          )}

          <div style={{ marginBottom: 16 }}>
            <label>Product Name</label>
            <input
              className="input"
              required
              value={form.name || ''}
              onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
              placeholder="e.g. BCC Playing Shirt"
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Description</label>
            <textarea
              className="input"
              rows={2}
              value={form.description || ''}
              onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Short product description"
              style={{ resize: 'vertical' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 12, marginBottom: 16 }}>
            <div>
              <label>Price (Rands)</label>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0"
                required
                value={priceInput}
                onChange={e => setPriceInput(e.target.value)}
                placeholder="450.00"
              />
            </div>
            <div>
              <label>Sort Order</label>
              <input
                className="input"
                type="number"
                value={form.sort_order ?? 0}
                onChange={e => setForm(prev => ({ ...prev, sort_order: parseInt(e.target.value) || 0 }))}
              />
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label>Image URL</label>
            <input
              className="input"
              value={form.image_url || ''}
              onChange={e => setForm(prev => ({ ...prev, image_url: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          {form.category === 'kit' && (
            <div style={{ marginBottom: 16 }}>
              <label>Available Sizes</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
                {ALL_SIZES.map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSize(s)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 8,
                      border: `1px solid ${form.sizes?.includes(s) ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`,
                      background: form.sizes?.includes(s) ? 'rgba(37,99,235,0.2)' : 'rgba(255,255,255,0.02)',
                      color: form.sizes?.includes(s) ? '#93c5fd' : 'var(--muted)',
                      fontFamily: 'var(--font-display)',
                      fontSize: 13, fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      minHeight: 44, minWidth: 48,
                      touchAction: 'manipulation',
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {form.category === 'membership' && (
            <div style={{ marginBottom: 16 }}>
              <label>Benefits (one per line)</label>
              <textarea
                className="input"
                rows={5}
                value={benefitsText}
                onChange={e => setBenefitsText(e.target.value)}
                placeholder="Access to all home matches&#10;Club newsletter&#10;..."
                style={{ resize: 'vertical' }}
              />
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <button
              type="button"
              onClick={() => setForm(prev => ({ ...prev, is_active: !prev.is_active }))}
              style={{
                width: 44, height: 24, borderRadius: 12,
                background: form.is_active ? '#2563eb' : 'rgba(255,255,255,0.1)',
                border: `1px solid ${form.is_active ? 'rgba(96,165,250,0.5)' : 'var(--border)'}`,
                cursor: 'pointer',
                position: 'relative',
                transition: 'background 0.2s',
                flexShrink: 0,
              }}
              aria-label={form.is_active ? 'Deactivate product' : 'Activate product'}
            >
              <span style={{
                position: 'absolute',
                top: 2, left: form.is_active ? 22 : 2,
                width: 18, height: 18, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
              }} />
            </button>
            <span style={{ fontSize: 13, color: form.is_active ? 'var(--text)' : 'var(--muted)' }}>
              {form.is_active ? 'Active — visible in shop' : 'Inactive — hidden from shop'}
            </span>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.28)',
              color: '#fca5a5',
              padding: '10px 14px',
              borderRadius: 8,
              fontSize: 13,
              marginBottom: 16,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1, padding: 12, borderRadius: 9,
                border: '1px solid var(--border)',
                background: 'rgba(255,255,255,0.03)',
                color: 'var(--muted)',
                cursor: 'pointer',
                fontFamily: 'var(--font-display)',
                fontSize: 13, fontWeight: 700,
                minHeight: 44,
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={saving}
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {saving ? 'Saving...' : isNew ? 'Add Product' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface DeleteModalProps {
  product: Product
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}

function DeleteModal({ product, onClose, onConfirm, deleting }: DeleteModalProps) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 999,
        background: 'rgba(5,12,26,0.88)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        backdropFilter: 'blur(4px)',
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{
        background: 'var(--panel)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '20px 20px 0 0',
        padding: '20px 24px 36px',
        maxWidth: 480, width: '100%',
        position: 'relative',
      }}>
        <div style={{
          width: 36, height: 4, borderRadius: 2,
          background: 'rgba(239,68,68,0.25)',
          margin: '0 auto 20px',
        }} />
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 3,
          background: 'linear-gradient(90deg, #ef4444, transparent)',
          borderRadius: '20px 20px 0 0',
        }} />
        <div style={{ fontSize: 28, marginBottom: 14 }}>🗑</div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
          Delete product?
        </div>
        <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 16, lineHeight: 1.6 }}>
          Delete <strong style={{ color: 'var(--text)' }}>{product.name}</strong>?
          This cannot be undone.
        </div>
        <div style={{
          background: 'rgba(239,68,68,0.07)',
          border: '1px solid rgba(239,68,68,0.18)',
          borderRadius: 7, padding: '9px 12px',
          fontSize: 12, color: 'rgba(252,165,165,0.7)',
          marginBottom: 22, lineHeight: 1.5,
        }}>
          Consider deactivating the product instead to preserve order history.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: 12, borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--muted)', cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontSize: 13, fontWeight: 700, minHeight: 44,
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            style={{
              flex: 1, padding: 12, borderRadius: 9,
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.35)',
              color: '#fca5a5', cursor: 'pointer',
              fontFamily: 'var(--font-display)',
              fontSize: 13, fontWeight: 700, minHeight: 44,
              opacity: deleting ? 0.5 : 1,
            }}
          >
            {deleting ? 'Deleting...' : 'Yes, delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminProductsPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [editTarget, setEditTarget] = useState<Partial<Product> | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [pageError, setPageError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
    })
  }, [router])

  const loadProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('category')
      .order('sort_order')
    if (error) { setPageError(error.message); return }
    setProducts((data || []) as Product[])
    setLoading(false)
  }, [])

  useEffect(() => {
    loadProducts()
  }, [loadProducts])

  async function handleToggleActive(product: Product) {
    if (!token) return
    const res = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: !product.is_active }),
    })
    if (res.ok) {
      setProducts(prev => prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p))
    } else {
      const data = await res.json()
      setPageError(data.error || 'Failed to update product')
    }
  }

  async function handleSave(productData: Partial<Product>) {
    if (!token) return
    setSaving(true)
    setSaveError(null)
    try {
      let res: Response
      if (isNew) {
        res = await fetch('/api/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(productData),
        })
      } else {
        res = await fetch(`/api/products/${editTarget?.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(productData),
        })
      }
      if (!res.ok) {
        const data = await res.json()
        setSaveError(data.error || 'Failed to save')
        setSaving(false)
        return
      }
      await loadProducts()
      setEditTarget(null)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!token || !deleteTarget) return
    setDeleting(true)
    const res = await fetch(`/api/products/${deleteTarget.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    setDeleting(false)
    if (!res.ok) {
      const data = await res.json()
      setPageError(data.error || 'Failed to delete')
      setDeleteTarget(null)
      return
    }
    setProducts(prev => prev.filter(p => p.id !== deleteTarget.id))
    setDeleteTarget(null)
  }

  const kitProducts = products.filter(p => p.category === 'kit')
  const membershipProducts = products.filter(p => p.category === 'membership')

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        .prod-hero {
          position: relative;
          padding: 36px 0 32px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
        }
        .prod-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .prod-hero-inner {
          position: relative; z-index: 1;
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .prod-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .prod-eyebrow::before {
          content: '';
          display: inline-block;
          width: 18px; height: 1px; background: var(--sky);
        }
        .prod-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 44px);
          font-weight: 800; line-height: 1.05;
          color: var(--text); letter-spacing: -0.02em;
        }
        .prod-section-head {
          display: flex; align-items: center; gap: 10px;
          margin: 28px 0 12px;
        }
        .prod-section-label {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.2em; text-transform: uppercase;
          color: var(--muted); white-space: nowrap;
        }
        .prod-section-line { flex: 1; height: 1px; background: var(--border); }
        .prod-card {
          background: rgba(255,255,255,0.02);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 18px;
          margin-bottom: 8px;
          display: flex; align-items: center; gap: 14px;
          transition: border-color 0.18s;
        }
        .prod-card:hover { border-color: rgba(59,130,246,0.3); }
        .prod-card.inactive { opacity: 0.55; }
        .prod-card-info { flex: 1; min-width: 0; }
        .prod-card-name {
          font-family: var(--font-display);
          font-size: 14px; font-weight: 700;
          color: var(--text); margin-bottom: 4px;
        }
        .prod-card-price {
          font-family: var(--font-display);
          font-size: 13px; font-weight: 600;
          color: #60a5fa;
        }
        .prod-card-meta {
          display: flex; align-items: center; gap: 8px;
          flex-wrap: wrap; margin-top: 6px;
        }
        .size-chip {
          padding: 2px 8px; border-radius: 4px;
          background: rgba(37,99,235,0.12);
          border: 1px solid rgba(59,130,246,0.22);
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.08em; text-transform: uppercase;
          color: #60a5fa;
        }
        .prod-card-actions {
          display: flex; gap: 8px; flex-shrink: 0;
        }
        .prod-action-btn {
          display: inline-flex; align-items: center; gap: 4px;
          padding: 7px 12px; border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 36px;
          white-space: nowrap;
        }
        .prod-action-btn:hover {
          border-color: rgba(59,130,246,0.3);
          background: rgba(37,99,235,0.08);
          color: var(--text);
        }
        .prod-action-btn.danger {
          color: rgba(252,165,165,0.7);
          border-color: rgba(239,68,68,0.15);
        }
        .prod-action-btn.danger:hover {
          background: rgba(239,68,68,0.1);
          border-color: rgba(239,68,68,0.35);
          color: #fca5a5;
        }
        .toggle-btn {
          width: 38px; height: 22px; border-radius: 11px;
          border: none; cursor: pointer;
          position: relative; flex-shrink: 0;
          transition: background 0.2s;
        }
        .toggle-btn .knob {
          position: absolute;
          top: 2px; width: 16px; height: 16px; border-radius: 50%;
          background: #fff;
          transition: left 0.2s;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .error-banner {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.28);
          color: #fca5a5;
          padding: 12px 16px; border-radius: 8px;
          font-size: 13px; margin-bottom: 16px;
          display: flex; align-items: center; gap: 8px;
        }
        @media (max-width: 640px) {
          .prod-card { flex-direction: column; align-items: flex-start; gap: 12px; }
          .prod-card-actions { width: 100%; }
          .prod-action-btn { flex: 1; justify-content: center; }
        }
      `}</style>

      <div className="prod-hero">
        <div className="container">
          <div className="prod-hero-inner">
            <div>
              <div className="prod-eyebrow">Admin</div>
              <div className="prod-title">Products</div>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => { setIsNew(true); setEditTarget({}); setSaveError(null) }}
            >
              + Add Product
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 8 }}>
        {pageError && (
          <div className="error-banner">
            <span>⚠</span> {pageError}
          </div>
        )}

        {/* Kit section */}
        <div className="prod-section-head">
          <span className="prod-section-label">Playing Kit</span>
          <div className="prod-section-line" />
          <span className="badge badge-blue">{kitProducts.length}</span>
        </div>

        {loading ? (
          <>
            <ProductSkeleton />
            <ProductSkeleton />
          </>
        ) : kitProducts.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
            No kit products yet.
          </div>
        ) : (
          kitProducts.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => { setIsNew(false); setEditTarget(p); setSaveError(null) }}
              onDelete={() => setDeleteTarget(p)}
              onToggle={() => handleToggleActive(p)}
            />
          ))
        )}

        {/* Membership section */}
        <div className="prod-section-head" style={{ marginTop: 32 }}>
          <span className="prod-section-label">Membership Tiers</span>
          <div className="prod-section-line" />
          <span className="badge badge-blue">{membershipProducts.length}</span>
        </div>

        {loading ? (
          <>
            <ProductSkeleton />
            <ProductSkeleton />
          </>
        ) : membershipProducts.length === 0 ? (
          <div style={{ color: 'var(--muted)', fontSize: 13, padding: '16px 0' }}>
            No membership products yet.
          </div>
        ) : (
          membershipProducts.map(p => (
            <ProductCard
              key={p.id}
              product={p}
              onEdit={() => { setIsNew(false); setEditTarget(p); setSaveError(null) }}
              onDelete={() => setDeleteTarget(p)}
              onToggle={() => handleToggleActive(p)}
            />
          ))
        )}
      </div>

      {editTarget !== null && (
        <ProductModal
          product={editTarget}
          onClose={() => setEditTarget(null)}
          onSave={handleSave}
          saving={saving}
          error={saveError}
          isNew={isNew}
        />
      )}

      {deleteTarget && (
        <DeleteModal
          product={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
          deleting={deleting}
        />
      )}
    </div>
  )
}

function ProductCard({
  product,
  onEdit,
  onDelete,
  onToggle,
}: {
  product: Product
  onEdit: () => void
  onDelete: () => void
  onToggle: () => void
}) {
  return (
    <div className={`prod-card${product.is_active ? '' : ' inactive'}`}>
      <div className="prod-card-info">
        <div className="prod-card-name">{product.name}</div>
        <div className="prod-card-price">{formatPrice(product.price_zar)}</div>
        {product.sizes && product.sizes.length > 0 && (
          <div className="prod-card-meta">
            {product.sizes.map(s => (
              <span key={s} className="size-chip">{s}</span>
            ))}
          </div>
        )}
        {product.benefits && product.benefits.length > 0 && (
          <div style={{ marginTop: 6, fontSize: 12, color: 'var(--muted)' }}>
            {product.benefits.slice(0, 2).join(' · ')}{product.benefits.length > 2 ? ` +${product.benefits.length - 2} more` : ''}
          </div>
        )}
      </div>

      <div className="prod-card-actions">
        <button
          className="toggle-btn"
          onClick={onToggle}
          aria-label={product.is_active ? 'Deactivate' : 'Activate'}
          style={{ background: product.is_active ? '#2563eb' : 'rgba(255,255,255,0.1)' }}
        >
          <span className="knob" style={{ left: product.is_active ? 20 : 2 }} />
        </button>
        <button className="prod-action-btn" onClick={onEdit}>
          Edit
        </button>
        <button className="prod-action-btn danger" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  )
}
