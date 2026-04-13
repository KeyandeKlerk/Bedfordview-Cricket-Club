export default function CSSBarChart({ items, maxVal }: {
  items: Array<{ label: string; value: number; sublabel?: string }>
  maxVal: number
}) {
  return (
    <div className="bar-chart">
      {items.map(item => (
        <div key={item.label} className="bar-row">
          <div className="bar-label">{item.label}</div>
          <div className="bar-track">
            <div
              className="bar-fill"
              style={{ width: maxVal > 0 ? `${(item.value / maxVal) * 100}%` : '0%' }}
            />
          </div>
          <div className="bar-value">
            {item.value}{item.sublabel ? ` ${item.sublabel}` : ''}
          </div>
        </div>
      ))}
    </div>
  )
}
