'use client'
import React from 'react'

interface Props {
  children: React.ReactNode
  queueCount?: number
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ScorerErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ScorerErrorBoundary]', error, info)
    // Best-effort audit log (fire-and-forget, no await)
    try {
      fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scorer_crash', error: error.message, stack: info.componentStack }),
      }).catch(() => {})
    } catch { /* ignore */ }
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const saved = this.props.queueCount ?? 0

    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        textAlign: 'center',
      }}>
        <div style={{ maxWidth: 480 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 900, textTransform: 'uppercase', marginBottom: 12 }}>
            Scorer Crashed
          </h2>
          <p style={{ color: 'var(--muted)', marginBottom: 8 }}>
            {this.state.error?.message ?? 'An unexpected error occurred.'}
          </p>
          {saved > 0 && (
            <p style={{ color: 'var(--lime)', fontWeight: 600, marginBottom: 20 }}>
              {saved} ball{saved !== 1 ? 's' : ''} saved locally and will sync when you reload.
            </p>
          )}
          <button
            className="btn btn-primary"
            onClick={() => window.location.reload()}
            style={{ width: '100%', justifyContent: 'center', marginBottom: 12 }}
          >
            Reload Scorer
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ width: '100%', justifyContent: 'center' }}
          >
            Try to Continue
          </button>
        </div>
      </div>
    )
  }
}
