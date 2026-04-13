export function OrderBarChart({ data, label }: { data: { label: string; value: number }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1)
  const height = 120

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
                <text x={x + 16} y={y - 4} textAnchor="middle" fill="#60a5fa" fontSize={7} fontFamily="var(--font-display)" fontWeight={700}>
                  {d.value > 10000 ? `R${Math.round(d.value / 100 / 1000)}k` : `R${Math.round(d.value / 100)}`}
                </text>
              )}
              <text x={x + 16} y={height + 16} textAnchor="middle" fill="rgba(147,197,253,0.5)" fontSize={7} fontFamily="var(--font-display)">
                {d.label}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function HorizontalBar({ data, label }: { data: { label: string; value: number }[]; label: string }) {
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

export function OrderSkeleton() {
  return (
    <tr>
      <td colSpan={8}>
        <div style={{ height: 48, background: 'rgba(59,130,246,0.04)', borderRadius: 4 }} />
      </td>
    </tr>
  )
}
