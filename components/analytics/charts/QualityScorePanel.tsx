'use client'

interface QualityRow {
  label: string
  excellent?: number
  good: number
  poor: number
  total: number
}

interface QualityScorePanelProps {
  balls: Array<{
    execution_quality: string | null
    decision_quality: string | null
  }>
}

export default function QualityScorePanel({ balls }: QualityScorePanelProps) {
  const withExec = balls.filter(b => b.execution_quality)
  const withDecision = balls.filter(b => b.decision_quality)

  if (withExec.length === 0 && withDecision.length === 0) {
    return (
      <div style={{ textAlign: 'center', color: 'var(--muted)', padding: '24px 0', fontSize: 13 }}>
        No quality data recorded yet.
      </div>
    )
  }

  const execStats = {
    excellent: withExec.filter(b => b.execution_quality === 'excellent').length,
    good: withExec.filter(b => b.execution_quality === 'good').length,
    poor: withExec.filter(b => b.execution_quality === 'poor').length,
    total: withExec.length,
  }
  const decStats = {
    good: withDecision.filter(b => b.decision_quality === 'good').length,
    poor: withDecision.filter(b => b.decision_quality === 'poor').length,
    total: withDecision.length,
  }

  function QualityBar({ row, hasExcellent }: { row: QualityRow; hasExcellent: boolean }) {
    if (row.total === 0) return null
    const pct = (n: number) => row.total > 0 ? `${((n / row.total) * 100).toFixed(0)}%` : '0%'
    return (
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, color: 'var(--muted)', marginBottom: 6 }}>{row.label}</div>
        <div style={{ display: 'flex', height: 20, borderRadius: 4, overflow: 'hidden' }}>
          {hasExcellent && (row.excellent ?? 0) > 0 && (
            <div title={`Excellent: ${row.excellent}`} style={{ flex: row.excellent, background: '#22c55e' }} />
          )}
          {row.good > 0 && (
            <div title={`Good: ${row.good}`} style={{ flex: row.good, background: '#3b82f6' }} />
          )}
          {row.poor > 0 && (
            <div title={`Poor: ${row.poor}`} style={{ flex: row.poor, background: '#ef4444' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
          {hasExcellent && (
            <div style={{ fontSize: 11, color: '#22c55e' }}>Excellent {pct(row.excellent ?? 0)}</div>
          )}
          <div style={{ fontSize: 11, color: '#3b82f6' }}>Good {pct(row.good)}</div>
          <div style={{ fontSize: 11, color: '#ef4444' }}>Poor {pct(row.poor)}</div>
          <div style={{ fontSize: 11, color: 'var(--dim)', marginLeft: 'auto' }}>{row.total} balls</div>
        </div>
      </div>
    )
  }

  return (
    <div>
      {withExec.length > 0 && (
        <QualityBar
          row={{ label: 'Execution Quality', ...execStats }}
          hasExcellent={true}
        />
      )}
      {withDecision.length > 0 && (
        <QualityBar
          row={{ label: 'Decision Quality', excellent: undefined, ...decStats }}
          hasExcellent={false}
        />
      )}
    </div>
  )
}
