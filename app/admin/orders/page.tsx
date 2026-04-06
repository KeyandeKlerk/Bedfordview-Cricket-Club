'use client'
import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Order {
  id: string
  reference: string
  order_type: 'kit' | 'membership'
  status: 'pending_eft' | 'paid' | 'fulfilled' | 'canceled'
  amount_total: number
  customer_name: string | null
  customer_email: string | null
  line_items: Array<{ name?: string; size?: string; qty: number; unitPrice: number }>
  shipping_address: { street?: string; city?: string; province?: string; postalCode?: string } | null
  created_at: string
  paid_at: string | null
}

const STATUS_LABEL: Record<string, string> = {
  pending_eft: 'Pending EFT',
  paid: 'Paid',
  fulfilled: 'Fulfilled',
  canceled: 'Canceled',
}

const STATUS_CLASS: Record<string, string> = {
  pending_eft: 'badge-gold',
  paid: 'badge-blue',
  fulfilled: 'badge-blue',
  canceled: 'badge-muted',
}

function formatPrice(cents: number) {
  return `R ${(cents / 100).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Simple SVG bar chart ──────────────────────────────────────────────────────
function BarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const height = 120
  const barW = 100 / data.length

  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
        {label}
      </div>
      <svg viewBox={`0 0 ${data.length * 40} ${height + 24}`} style={{ width: '100%', overflow: 'visible' }}>
        {data.map((d, i) => {
          const barH = max > 0 ? (d.value / max) * height : 0
          const x = i * 40 + 4
          const y = height - barH
          return (
            <g key={i}>
              <rect
                x={x} y={y}
                width={32} height={barH}
                rx={3}
                fill={barH > 0 ? 'rgba(37,99,235,0.5)' : 'rgba(59,130,246,0.08)'}
                stroke={barH > 0 ? 'rgba(96,165,250,0.4)' : 'rgba(59,130,246,0.15)'}
                strokeWidth={0.5}
              />
              {barH > 0 && (
                <text
                  x={x + 16} y={y - 4}
                  textAnchor="middle"
                  fill="#60a5fa"
                  fontSize={7}
                  fontFamily="var(--font-display)"
                  fontWeight={700}
                >
                  {d.value > 10000 ? `R${Math.round(d.value / 100 / 1000)}k` : `R${Math.round(d.value / 100)}`}
                </text>
              )}
              <text
                x={x + 16} y={height + 16}
                textAnchor="middle"
                fill="rgba(147,197,253,0.5)"
                fontSize={7}
                fontFamily="var(--font-display)"
              >
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function HorizontalBar({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 12 }}>
        {label}
      </div>
      {data.map((d, i) => (
        <div key={i} style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: 'var(--text)' }}>{d.label}</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#60a5fa' }}>{d.value}</span>
          </div>
          <div style={{ height: 6, background: 'rgba(59,130,246,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${max > 0 ? (d.value / max) * 100 : 0}%`,
              background: 'linear-gradient(90deg, #2563eb, #38bdf8)',
              borderRadius: 3,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function OrderSkeleton() {
  return (
    <tr>
      <td colSpan={8}>
        <div style={{ height: 48, background: 'rgba(59,130,246,0.04)', borderRadius: 4 }} />
      </td>
    </tr>
  )
}

export default function AdminOrdersPage() {
  const router = useRouter()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [token, setToken] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Stats
  const [stats, setStats] = useState({
    totalOrders: 0,
    confirmedRevenue: 0,
    pendingValue: 0,
    pendingCount: 0,
    activeMemberships: 0,
  })

  // Filters
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Chart data
  const [monthlyRevenue, setMonthlyRevenue] = useState<{ label: string; value: number }[]>([])
  const [sizeBreakdown, setSizeBreakdown] = useState<{ label: string; value: number }[]>([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { router.push('/login'); return }
      setToken(session.access_token)
    })
  }, [router])

  const loadOrders = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setError(null)

    const params = new URLSearchParams({
      page: String(page),
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(typeFilter !== 'all' && { type: typeFilter }),
      ...(dateFrom && { from: dateFrom }),
      ...(dateTo && { to: dateTo }),
      ...(search && { search }),
    })

    const res = await fetch(`/api/orders?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      setError('Failed to load orders')
      setLoading(false)
      return
    }
    const data = await res.json()
    setOrders(data.orders || [])
    setTotal(data.total || 0)
    setLoading(false)
  }, [token, page, statusFilter, typeFilter, dateFrom, dateTo, search])

  const loadStats = useCallback(async () => {
    if (!token) return

    // Load all orders for stats/charts (no pagination)
    const res = await fetch('/api/orders?page=1', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return
    // For stats, we need all orders - use supabase client directly
    const { data: allOrders } = await supabase
      .from('orders')
      .select('amount_total, status, order_type, created_at, line_items')
      .order('created_at', { ascending: false })
      .limit(500)

    if (!allOrders) return

    const confirmedRevenue = allOrders
      .filter(o => o.status === 'paid' || o.status === 'fulfilled')
      .reduce((sum: number, o: { amount_total: number }) => sum + (o.amount_total || 0), 0)

    const pendingOrders = allOrders.filter(o => o.status === 'pending_eft')
    const pendingValue = pendingOrders.reduce((sum: number, o: { amount_total: number }) => sum + (o.amount_total || 0), 0)

    // Monthly revenue — last 12 months
    const now = new Date()
    const months: { label: string; value: number }[] = []
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const monthLabel = d.toLocaleDateString('en-ZA', { month: 'short' })
      const monthStart = new Date(d.getFullYear(), d.getMonth(), 1)
      const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
      const revenue = allOrders
        .filter(o => {
          if (o.status !== 'paid' && o.status !== 'fulfilled') return false
          const created = new Date(o.created_at)
          return created >= monthStart && created <= monthEnd
        })
        .reduce((sum: number, o: { amount_total: number }) => sum + (o.amount_total || 0), 0)
      months.push({ label: monthLabel, value: revenue })
    }
    setMonthlyRevenue(months)

    // Size breakdown from kit orders
    const sizeCounts: Record<string, number> = {}
    allOrders
      .filter(o => o.order_type === 'kit')
      .forEach(o => {
        const items = Array.isArray(o.line_items) ? o.line_items : []
        items.forEach((item: { size?: string; qty?: number }) => {
          if (item.size) {
            sizeCounts[item.size] = (sizeCounts[item.size] || 0) + (item.qty || 1)
          }
        })
      })
    const sizeOrder = ['XS', 'S', 'M', 'L', 'XL', 'XXL']
    const sizeData = sizeOrder
      .filter(s => sizeCounts[s] !== undefined)
      .map(s => ({ label: s, value: sizeCounts[s] }))
    setSizeBreakdown(sizeData)

    // Active memberships
    const { count: activeMembershipCount } = await supabase
      .from('memberships')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')

    setStats({
      totalOrders: allOrders.length,
      confirmedRevenue,
      pendingValue,
      pendingCount: pendingOrders.length,
      activeMemberships: activeMembershipCount || 0,
    })
  }, [token])

  useEffect(() => {
    if (token) { loadOrders(); loadStats() }
  }, [token, loadOrders, loadStats])

  function handleSearchChange(val: string) {
    setSearchInput(val)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      setSearch(val)
      setPage(1)
    }, 400)
  }

  function applyFilter(key: string, val: string) {
    if (key === 'status') setStatusFilter(val)
    if (key === 'type') setTypeFilter(val)
    setPage(1)
  }

  async function handleAction(orderId: string, action: string) {
    if (!token) return
    setActionLoading(orderId + action)
    const res = await fetch(`/api/orders/${orderId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    })
    setActionLoading(null)
    if (!res.ok) {
      const data = await res.json()
      setError(data.error || 'Action failed')
      return
    }
    // Update order in state
    setOrders(prev => prev.map(o =>
      o.id === orderId
        ? { ...o, status: action as Order['status'], ...(action === 'paid' ? { paid_at: new Date().toISOString() } : {}) }
        : o
    ))
    loadStats()
  }

  function handleExport() {
    if (!token) return
    const params = new URLSearchParams({
      ...(statusFilter !== 'all' && { status: statusFilter }),
      ...(typeFilter !== 'all' && { type: typeFilter }),
      ...(dateFrom && { from: dateFrom }),
      ...(dateTo && { to: dateTo }),
    })
    const url = `/api/orders/export?${params}`
    // Use fetch with auth header and create blob URL
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.blob())
      .then(blob => {
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `bcc-orders-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(a.href)
      })
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
      <style>{`
        .ord-hero {
          position: relative;
          padding: 36px 0 32px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
          overflow: hidden;
        }
        .ord-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .ord-hero-inner {
          position: relative; z-index: 1;
          display: flex; align-items: flex-end; justify-content: space-between;
          gap: 16px; flex-wrap: wrap;
        }
        .ord-eyebrow {
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .ord-eyebrow::before {
          content: '';
          display: inline-block;
          width: 18px; height: 1px; background: var(--sky);
        }
        .ord-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 44px);
          font-weight: 800; line-height: 1.05;
          color: var(--text); letter-spacing: -0.02em;
        }
        /* Stats row — 2x2 on mobile, 4 across on desktop */
        .stats-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin: 20px 0;
        }
        @media (min-width: 768px) {
          .stats-row {
            grid-template-columns: repeat(4, 1fr);
            gap: 14px;
            margin: 24px 0;
          }
        }
        .stat-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px 18px;
          position: relative; overflow: hidden;
        }
        .stat-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, #2563eb, #38bdf8, transparent);
        }
        .stat-card-value {
          font-family: var(--font-display);
          font-size: 24px; font-weight: 800;
          color: #60a5fa; line-height: 1;
          margin-bottom: 5px;
        }
        .stat-card-label {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--muted);
        }
        .stat-card-sub {
          font-size: 11px; color: rgba(147,197,253,0.5);
          margin-top: 3px;
        }
        /* Charts — hidden on mobile to avoid clutter */
        .charts-row {
          display: none;
        }
        @media (min-width: 768px) {
          .charts-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            margin-bottom: 24px;
          }
        }
        .chart-card {
          background: rgba(5,18,42,0.7);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 18px 20px;
        }
        /* Filters — stacked on mobile, inline on desktop */
        .filters-bar {
          display: flex;
          flex-direction: column;
          gap: 10px;
          padding: 16px 0;
          border-bottom: 1px solid var(--border);
          margin-bottom: 16px;
        }
        @media (min-width: 900px) {
          .filters-bar {
            flex-direction: row;
            flex-wrap: wrap;
            align-items: center;
          }
        }
        .filter-tabs {
          display: flex; gap: 4px; flex-wrap: wrap;
        }
        .filter-tab {
          padding: 9px 14px; border-radius: 7px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 40px;
          white-space: nowrap;
          touch-action: manipulation;
        }
        .filter-tab:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .filter-tab.active {
          border-color: rgba(59,130,246,0.5);
          background: rgba(37,99,235,0.14);
          color: #93c5fd;
        }
        .filter-sep {
          display: none;
        }
        @media (min-width: 900px) {
          .filter-sep {
            display: block;
            width: 1px; height: 28px;
            background: var(--border);
            align-self: center;
          }
        }
        .filters-row-2 {
          display: flex; gap: 8px; align-items: center; flex-wrap: wrap;
        }
        .search-input {
          flex: 1; min-width: 0;
          padding: 10px 14px;
          background: rgba(10,22,40,0.8);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 8px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s;
          min-height: 44px;
        }
        .search-input:focus { border-color: rgba(96,165,250,0.5); }
        .search-input::placeholder { color: rgba(147,197,253,0.3); }
        .date-input {
          padding: 10px 10px;
          background: rgba(10,22,40,0.8);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 8px;
          color: var(--text);
          font-family: var(--font-body);
          font-size: 13px;
          outline: none;
          min-height: 44px;
          flex: 1;
        }
        @media (min-width: 640px) {
          .date-input { max-width: 145px; flex: none; }
          .search-input { max-width: 280px; }
        }
        .date-input:focus { border-color: rgba(96,165,250,0.5); }
        /* Table — hidden on mobile, visible on desktop */
        .ord-table-wrap {
          display: none;
        }
        @media (min-width: 768px) {
          .ord-table-wrap {
            display: block;
            background: rgba(5,18,42,0.7);
            border: 1px solid var(--border);
            border-radius: 12px;
            overflow: hidden;
            overflow-x: auto;
          }
        }
        .ord-table { width: 100%; border-collapse: collapse; font-size: 13px; min-width: 700px; }
        .ord-table th {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: rgba(147,197,253,0.45);
          text-align: left;
          padding: 12px 14px;
          border-bottom: 1px solid var(--border);
          white-space: nowrap;
        }
        .ord-table td {
          padding: 12px 14px;
          border-bottom: 1px solid rgba(59,130,246,0.06);
          color: var(--text);
          vertical-align: top;
        }
        .ord-table tbody tr:hover { background: rgba(37,99,235,0.03); }
        .ord-table tbody tr:last-child td { border-bottom: none; }
        .ord-ref {
          font-family: monospace;
          font-size: 12px; font-weight: 600;
          color: #93c5fd;
          cursor: pointer;
          text-decoration: underline;
          text-underline-offset: 2px;
        }
        .ord-ref:hover { color: #60a5fa; }
        .action-btn {
          display: inline-flex; align-items: center;
          padding: 5px 10px; border-radius: 6px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 10px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 28px;
          white-space: nowrap;
          margin-right: 4px; margin-bottom: 4px;
          touch-action: manipulation;
        }
        .action-btn:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .action-btn.pay { background: rgba(37,99,235,0.12); border-color: rgba(59,130,246,0.3); color: #93c5fd; }
        .action-btn.pay:hover { background: rgba(37,99,235,0.22); }
        .action-btn.fulfill { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #86efac; }
        .action-btn.fulfill:hover { background: rgba(34,197,94,0.2); }
        .action-btn.cancel { color: rgba(252,165,165,0.6); border-color: rgba(239,68,68,0.15); }
        .action-btn.cancel:hover { background: rgba(239,68,68,0.1); border-color: rgba(239,68,68,0.3); color: #fca5a5; }
        .action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        /* Expanded row */
        .ord-expand {
          background: rgba(37,99,235,0.04);
          border-top: none;
        }
        .ord-expand td {
          padding: 0;
          border-bottom: 1px solid rgba(59,130,246,0.1);
        }
        .ord-expand-inner {
          padding: 14px 14px 16px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          font-size: 12px;
        }
        .expand-title {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 8px;
        }

        /* Mobile order cards — shown below 768px, hidden above */
        .ord-cards { display: flex; flex-direction: column; gap: 12px; }
        @media (min-width: 768px) { .ord-cards { display: none; } }
        .ord-card {
          background: rgba(5,18,42,0.75);
          border: 1px solid var(--border);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }
        .ord-card::before {
          content: '';
          position: absolute; top: 0; left: 0; right: 0; height: 1px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.25), transparent);
        }
        .ord-card-head {
          padding: 12px 14px;
          display: flex; justify-content: space-between; align-items: flex-start; gap: 8px;
          border-bottom: 1px solid rgba(59,130,246,0.08);
          cursor: pointer;
        }
        .ord-card-ref {
          font-family: monospace;
          font-size: 13px; font-weight: 700;
          color: #93c5fd; flex: 1;
        }
        .ord-card-meta {
          padding: 10px 14px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 8px 12px;
        }
        .ord-meta-item { }
        .ord-meta-label {
          font-family: var(--font-display);
          font-size: 9px; font-weight: 700;
          letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--muted); margin-bottom: 3px;
        }
        .ord-meta-value {
          font-size: 13px; color: var(--text);
          line-height: 1.3;
        }
        .ord-card-actions {
          padding: 10px 14px 12px;
          border-top: 1px solid rgba(59,130,246,0.08);
          display: flex; gap: 8px; flex-wrap: wrap;
        }
        .ord-card-action-btn {
          flex: 1;
          padding: 10px 12px; border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          min-height: 44px;
          text-align: center;
          white-space: nowrap;
          touch-action: manipulation;
        }
        .ord-card-action-btn.pay { background: rgba(37,99,235,0.12); border-color: rgba(59,130,246,0.3); color: #93c5fd; }
        .ord-card-action-btn.fulfill { background: rgba(34,197,94,0.1); border-color: rgba(34,197,94,0.3); color: #86efac; }
        .ord-card-action-btn.cancel { color: rgba(252,165,165,0.7); border-color: rgba(239,68,68,0.2); }
        .ord-card-action-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ord-card-expand {
          padding: 10px 14px 14px;
          border-top: 1px solid rgba(59,130,246,0.06);
          background: rgba(37,99,235,0.03);
          font-size: 12px;
        }

        /* Pagination */
        .pagination {
          display: flex; align-items: center; justify-content: space-between;
          padding: 16px 0;
          font-size: 13px;
          color: var(--muted);
          flex-wrap: wrap; gap: 10px;
        }
        .page-btns { display: flex; gap: 6px; }
        .page-btn {
          width: 40px; height: 40px; border-radius: 8px;
          border: 1px solid var(--border);
          background: rgba(255,255,255,0.02);
          color: var(--muted);
          font-family: var(--font-display);
          font-size: 12px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          display: flex; align-items: center; justify-content: center;
          touch-action: manipulation;
        }
        .page-btn:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .page-btn.active { border-color: rgba(59,130,246,0.5); background: rgba(37,99,235,0.14); color: #93c5fd; }
        .page-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .error-banner {
          background: rgba(239,68,68,0.1);
          border: 1px solid rgba(239,68,68,0.28);
          color: #fca5a5;
          padding: 12px 16px; border-radius: 8px;
          font-size: 13px; margin-bottom: 16px;
        }
      `}</style>

      {/* Hero */}
      <div className="ord-hero">
        <div className="container">
          <div className="ord-hero-inner">
            <div>
              <div className="ord-eyebrow">Admin</div>
              <div className="ord-title">Orders</div>
            </div>
            <button className="btn btn-ghost" onClick={handleExport}>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 0 }}>

        {error && (
          <div className="error-banner">
            <span>⚠</span> {error}
          </div>
        )}

        {/* Stats */}
        <div className="stats-row">
          <div className="stat-card">
            <div className="stat-card-value">{stats.totalOrders}</div>
            <div className="stat-card-label">Total Orders</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">{formatPrice(stats.confirmedRevenue)}</div>
            <div className="stat-card-label">Confirmed Revenue</div>
            <div className="stat-card-sub">Paid + Fulfilled</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">{formatPrice(stats.pendingValue)}</div>
            <div className="stat-card-label">Pending EFT</div>
            <div className="stat-card-sub">{stats.pendingCount} order{stats.pendingCount !== 1 ? 's' : ''}</div>
          </div>
          <div className="stat-card">
            <div className="stat-card-value">{stats.activeMemberships}</div>
            <div className="stat-card-label">Active Members</div>
          </div>
        </div>

        {/* Charts */}
        {(monthlyRevenue.length > 0 || sizeBreakdown.length > 0) && (
          <div className="charts-row">
            {monthlyRevenue.length > 0 && (
              <div className="chart-card">
                <BarChart data={monthlyRevenue} label="Monthly Revenue (last 12 months)" />
              </div>
            )}
            {sizeBreakdown.length > 0 && (
              <div className="chart-card">
                <HorizontalBar data={sizeBreakdown} label="Kit Size Orders" />
              </div>
            )}
          </div>
        )}

        {/* Filters */}
        <div className="filters-bar">
          <div className="filter-tabs">
            {['all', 'pending_eft', 'paid', 'fulfilled', 'canceled'].map(s => (
              <button
                key={s}
                className={`filter-tab${statusFilter === s ? ' active' : ''}`}
                onClick={() => applyFilter('status', s)}
              >
                {s === 'all' ? 'All' : STATUS_LABEL[s]}
              </button>
            ))}
          </div>
          <div className="filter-tabs">
            {[['all', 'All Types'], ['kit', 'Kit'], ['membership', 'Membership']].map(([val, lbl]) => (
              <button
                key={val}
                className={`filter-tab${typeFilter === val ? ' active' : ''}`}
                onClick={() => applyFilter('type', val)}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="filters-row-2">
            <input
              className="date-input"
              type="date"
              value={dateFrom}
              onChange={e => { setDateFrom(e.target.value); setPage(1) }}
              title="From date"
            />
            <input
              className="date-input"
              type="date"
              value={dateTo}
              onChange={e => { setDateTo(e.target.value); setPage(1) }}
              title="To date"
            />
            <input
              className="search-input"
              type="search"
              placeholder="Search name, ref, email..."
              value={searchInput}
              onChange={e => handleSearchChange(e.target.value)}
            />
          </div>
        </div>

        {/* Mobile card list (shown below 768px) */}
        <div className="ord-cards">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <div key={i} style={{ height: 120, background: 'rgba(59,130,246,0.04)', borderRadius: 12 }} />
            ))
          ) : orders.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(147,197,253,0.35)', fontSize: 14 }}>
              No orders found.
            </div>
          ) : orders.map(order => {
            const isExpanded = expandedId === order.id
            const itemsSummary = order.line_items
              .map(li => `${li.name || 'Item'}${li.size ? ` (${li.size})` : ''} ×${li.qty}`)
              .join(', ')
            return (
              <div key={order.id} className="ord-card">
                <div className="ord-card-head" onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                  <div>
                    <div className="ord-card-ref">{order.reference}</div>
                    <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                      {order.customer_name || '—'} · {new Date(order.created_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                    <span className={`badge ${STATUS_CLASS[order.status] || 'badge-muted'}`}>
                      {STATUS_LABEL[order.status] || order.status}
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: '#60a5fa' }}>
                      {formatPrice(order.amount_total)}
                    </span>
                  </div>
                </div>
                {isExpanded && (
                  <div className="ord-card-expand">
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Items</div>
                      <div style={{ color: 'var(--text)', fontSize: 12 }}>{itemsSummary}</div>
                    </div>
                    {order.shipping_address && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Ship to</div>
                        <div style={{ color: 'var(--text)', fontSize: 12, lineHeight: 1.6 }}>
                          {order.shipping_address.street}, {order.shipping_address.city}, {order.shipping_address.province}
                        </div>
                      </div>
                    )}
                    {order.customer_email && (
                      <div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: 4 }}>Email</div>
                        <div style={{ color: 'var(--text)', fontSize: 12 }}>{order.customer_email}</div>
                      </div>
                    )}
                  </div>
                )}
                {(order.status === 'pending_eft' || order.status === 'paid') && (
                  <div className="ord-card-actions">
                    {order.status === 'pending_eft' && (
                      <button
                        className="ord-card-action-btn pay"
                        onClick={() => handleAction(order.id, 'paid')}
                        disabled={actionLoading === order.id + 'paid'}
                      >
                        {actionLoading === order.id + 'paid' ? '...' : 'Mark Paid'}
                      </button>
                    )}
                    {order.status === 'paid' && (
                      <button
                        className="ord-card-action-btn fulfill"
                        onClick={() => handleAction(order.id, 'fulfilled')}
                        disabled={actionLoading === order.id + 'fulfilled'}
                      >
                        {actionLoading === order.id + 'fulfilled' ? '...' : 'Fulfill'}
                      </button>
                    )}
                    <button
                      className="ord-card-action-btn cancel"
                      onClick={() => handleAction(order.id, 'canceled')}
                      disabled={actionLoading === order.id + 'canceled'}
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Desktop table (hidden below 768px) */}
        <div className="ord-table-wrap">
          <table className="ord-table">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Type</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total</th>
                <th>Status</th>
                <th>Date</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => <OrderSkeleton key={i} />)
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '48px 24px', color: 'rgba(147,197,253,0.35)', fontSize: 14 }}>
                    No orders found.
                  </td>
                </tr>
              ) : orders.flatMap(order => {
                const isExpanded = expandedId === order.id
                const itemsSummary = order.line_items
                  .map(li => `${li.name || 'Item'}${li.size ? ` (${li.size})` : ''} ×${li.qty}`)
                  .join(', ')

                const rows = [
                  <tr key={order.id} onClick={() => setExpandedId(isExpanded ? null : order.id)}>
                    <td>
                      <span className="ord-ref">{order.reference}</span>
                    </td>
                    <td>
                      <span className="badge badge-muted" style={{ textTransform: 'capitalize' }}>
                        {order.order_type}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, marginBottom: 1 }}>{order.customer_name || '—'}</div>
                      <div style={{ fontSize: 11, color: 'var(--muted)' }}>{order.customer_email || ''}</div>
                    </td>
                    <td style={{ maxWidth: 200, color: 'var(--muted)', fontSize: 12 }}>
                      {itemsSummary.length > 60 ? itemsSummary.slice(0, 60) + '...' : itemsSummary}
                    </td>
                    <td style={{ fontFamily: 'var(--font-display)', fontWeight: 700, color: '#60a5fa', whiteSpace: 'nowrap' }}>
                      {formatPrice(order.amount_total)}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_CLASS[order.status] || 'badge-muted'}`}>
                        {STATUS_LABEL[order.status] || order.status}
                      </span>
                    </td>
                    <td style={{ color: 'var(--muted)', whiteSpace: 'nowrap', fontSize: 12 }}>
                      {formatDate(order.created_at)}
                    </td>
                    <td onClick={e => e.stopPropagation()}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {order.status === 'pending_eft' && (
                          <button
                            className="action-btn pay"
                            onClick={() => handleAction(order.id, 'paid')}
                            disabled={actionLoading === order.id + 'paid'}
                          >
                            {actionLoading === order.id + 'paid' ? '...' : 'Mark Paid'}
                          </button>
                        )}
                        {order.status === 'paid' && (
                          <button
                            className="action-btn fulfill"
                            onClick={() => handleAction(order.id, 'fulfilled')}
                            disabled={actionLoading === order.id + 'fulfilled'}
                          >
                            {actionLoading === order.id + 'fulfilled' ? '...' : 'Fulfill'}
                          </button>
                        )}
                        {(order.status === 'pending_eft' || order.status === 'paid') && (
                          <button
                            className="action-btn cancel"
                            onClick={() => handleAction(order.id, 'canceled')}
                            disabled={actionLoading === order.id + 'canceled'}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>,
                ]

                if (isExpanded) {
                  rows.push(
                    <tr key={order.id + '-exp'} className="ord-expand">
                      <td colSpan={8}>
                        <div className="ord-expand-inner">
                          <div>
                            <div className="expand-title">Line Items</div>
                            {order.line_items.map((li, idx) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                                <span style={{ color: 'var(--text)' }}>
                                  {li.name || 'Item'}{li.size ? ` (${li.size})` : ''} ×{li.qty}
                                </span>
                                <span style={{ color: '#60a5fa', fontWeight: 600 }}>
                                  {formatPrice(li.unitPrice * li.qty)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <div>
                            {order.shipping_address && (
                              <>
                                <div className="expand-title">Shipping Address</div>
                                <div style={{ color: 'var(--text)', lineHeight: 1.7, fontSize: 12 }}>
                                  {order.shipping_address.street}<br />
                                  {order.shipping_address.city}<br />
                                  {order.shipping_address.province} {order.shipping_address.postalCode}
                                </div>
                              </>
                            )}
                            {order.paid_at && (
                              <div style={{ marginTop: 10 }}>
                                <div className="expand-title">Paid</div>
                                <div style={{ fontSize: 12, color: '#86efac' }}>{formatDate(order.paid_at)}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                }

                return rows
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination">
            <span>Showing {Math.min((page - 1) * 20 + 1, total)}–{Math.min(page * 20, total)} of {total} orders</span>
            <div className="page-btns">
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage(p => p - 1)}
              >
                ←
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const pg = page <= 4 ? i + 1 : page + i - 3
                if (pg > totalPages) return null
                return (
                  <button
                    key={pg}
                    className={`page-btn${pg === page ? ' active' : ''}`}
                    onClick={() => setPage(pg)}
                  >
                    {pg}
                  </button>
                )
              })}
              <button
                className="page-btn"
                disabled={page === totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
