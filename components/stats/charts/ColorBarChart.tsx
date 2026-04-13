export default function ColorBarChart({ items, maxVal }: {
  items: Array<{ label: string; value: number; sublabel?: string; color?: string }>
  maxVal: number
}) {
  return (
    <div className="bar-chart">
      {items.map(item => (
        <div key={item.label} className="bar-row">
          <div className="bar-label">{item.label}</div>
          <div className="bar-track">
            <div className="bar-fill" style={{
              width: maxVal > 0 ? `${(item.value / maxVal) * 100}%` : '0%',
              background: item.color
                ? `linear-gradient(90deg, ${item.color}cc, ${item.color})`
                : 'linear-gradient(90deg, #2563eb, #38bdf8)',
            }} />
          </div>
          <div className="bar-value">{item.value}{item.sublabel ? ` ${item.sublabel}` : ''}</div>
        </div>
      ))}
    </div>
  )
}
