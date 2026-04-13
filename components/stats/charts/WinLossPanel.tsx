export default function WinLossPanel({ rows, statCols }: {
  rows: Array<{ label: string; color: string; innings: number; [k: string]: any }>
  statCols: Array<{ key: string; label: string }>
}) {
  return (
    <div className="table-scroll">
      <table className="season-table">
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Result</th>
            <th>Inn</th>
            {statCols.map(c => <th key={c.key}>{c.label}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.label}>
              <td style={{ textAlign: 'left' }}>
                <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: row.color, marginRight: 8, verticalAlign: 'middle' }} />
                {row.label}
              </td>
              <td>{row.innings || '—'}</td>
              {statCols.map(c => <td key={c.key}>{row[c.key] ?? '—'}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
