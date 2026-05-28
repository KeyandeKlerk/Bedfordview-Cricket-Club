'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

interface ClubConfig {
  club_name: string
  club_short_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  highlight_color: string
  bg_color: string
  default_scoring_mode: 'club' | 'professional'
  contact_email: string | null
  plan?: 'club' | 'pro'
}

const DEFAULTS: ClubConfig = {
  club_name: '',
  club_short_name: '',
  logo_url: null,
  favicon_url: null,
  primary_color: '#2563eb',
  highlight_color: '#38bdf8',
  bg_color: '#050c1a',
  default_scoring_mode: 'club',
  contact_email: null,
}

export default function ClubSettingsPage() {
  const [form, setForm]       = useState<ClubConfig>(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }, [])

  useEffect(() => {
    fetch('/api/admin/club-config')
      .then(r => r.json())
      .then(data => {
        if (data) setForm({ ...DEFAULTS, ...data })
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const set = (k: keyof ClubConfig, v: string) =>
    setForm(p => ({ ...p, [k]: v || (k === 'logo_url' || k === 'favicon_url' ? null : v) }))

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    setSuccess(false)
    const token = await getToken()
    const res = await fetch('/api/admin/club-config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(form),
    })
    const result = await res.json()
    setSaving(false)
    if (!res.ok) {
      setError(result.error ?? 'Failed to save settings.')
      return
    }
    setForm({ ...DEFAULTS, ...result })
    setSuccess(true)
    setTimeout(() => setSuccess(false), 3000)
  }

  return (
    <>
      <style>{`
        .settings-grid { display: grid; grid-template-columns: 1fr; gap: 12px; }
        @media (min-width: 640px) { .settings-grid { grid-template-columns: 1fr 1fr; } }
        .settings-input {
          width: 100%; padding: 8px 12px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; color: var(--text); font-size: 14px; min-height: 44px;
          box-sizing: border-box;
        }
        .settings-input:focus { outline: none; border-color: var(--blue-mid); }
        .settings-section {
          background: var(--panel); border: 1px solid var(--border);
          border-radius: 4px; padding: 24px; margin-bottom: 24px;
        }
        .settings-section-title {
          font-family: var(--font-display); font-weight: 800;
          text-transform: uppercase; letter-spacing: 0.06em;
          font-size: 13px; color: var(--muted); margin-bottom: 16px;
        }
        .color-row { display: flex; align-items: center; gap: 10px; }
        .color-swatch {
          width: 44px; height: 44px; border-radius: 4px;
          border: 1px solid var(--border); flex-shrink: 0; cursor: pointer;
          padding: 0; overflow: hidden; background: transparent;
        }
        .color-swatch input[type="color"] {
          width: 100%; height: 100%; border: none; padding: 0;
          cursor: pointer; opacity: 0; position: absolute; inset: 0;
        }
        .color-swatch-wrap { position: relative; width: 44px; height: 44px; flex-shrink: 0; }
        .color-hex {
          width: 100%; padding: 8px 12px;
          background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; color: var(--text); font-size: 14px;
          font-family: monospace; min-height: 44px; box-sizing: border-box;
        }
        .color-hex:focus { outline: none; border-color: var(--blue-mid); }
        .color-label { font-size: 13px; color: var(--muted); min-width: 130px; }
        .color-field-row { display: grid; grid-template-columns: 1fr; gap: 10px; }
        @media (min-width: 640px) { .color-field-row { grid-template-columns: 1fr 1fr 1fr; } }
        .logo-preview {
          margin-top: 12px; width: 80px; height: 80px; border-radius: 4px;
          border: 1px solid var(--border); object-fit: contain;
          background: var(--surface); display: block;
        }
        .preview-panel {
          border-radius: 6px; overflow: hidden;
          border: 1px solid var(--border); margin-top: 16px;
        }
        .preview-header {
          display: flex; align-items: center; gap: 12px;
          padding: 12px 16px;
        }
        .preview-logo {
          width: 32px; height: 32px; border-radius: 4px;
          object-fit: contain; background: rgba(255,255,255,0.08);
          flex-shrink: 0;
        }
        .preview-logo-placeholder {
          width: 32px; height: 32px; border-radius: 4px;
          display: flex; align-items: center; justify-content: center;
          font-size: 13px; font-weight: 800; flex-shrink: 0;
        }
        .preview-nav-links { display: flex; gap: 16px; margin-left: auto; }
        .preview-nav-link { font-size: 12px; font-weight: 500; opacity: 0.85; }
        .preview-body { padding: 16px; }
        .preview-stat {
          display: inline-block; padding: 6px 14px; border-radius: 4px;
          font-size: 13px; font-weight: 700; margin-right: 8px; margin-bottom: 8px;
        }
        .success-banner {
          background: rgba(34,197,94,0.12); border: 1px solid rgba(34,197,94,0.4);
          color: #4ade80; border-radius: 4px; padding: 10px 14px;
          font-size: 13px; margin-bottom: 16px;
        }
        .error-banner {
          background: rgba(239,68,68,0.08); border: 1px solid var(--red);
          color: var(--red); border-radius: 4px; padding: 10px 14px;
          font-size: 13px; margin-bottom: 16px;
        }
        .field-label { font-size: 13px; color: var(--muted); margin-bottom: 6px; display: block; }
        .save-row { display: flex; align-items: center; gap: 16px; margin-top: 8px; }
      `}</style>

      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Admin</div>
            <h1>Club Settings</h1>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 760 }}>
          {loading ? (
            <div style={{ color: 'var(--muted)' }}>Loading…</div>
          ) : (
            <form onSubmit={handleSave}>
              {success && <div className="success-banner">Settings saved successfully.</div>}
              {error   && <div className="error-banner">{error}</div>}

              {/* Club Identity */}
              <div className="settings-section">
                <div className="settings-section-title">Club Identity</div>
                <div className="settings-grid">
                  <div>
                    <label className="field-label">Club Name</label>
                    <input
                      className="settings-input"
                      placeholder="e.g. Bedfordview Cricket Club"
                      value={form.club_name}
                      maxLength={100}
                      onChange={e => set('club_name', e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="field-label">Short Name / Abbreviation</label>
                    <input
                      className="settings-input"
                      placeholder="e.g. BCC"
                      value={form.club_short_name}
                      maxLength={10}
                      onChange={e => set('club_short_name', e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Logo */}
              <div className="settings-section">
                <div className="settings-section-title">Logo &amp; Favicon</div>
                <div className="settings-grid">
                  <div>
                    <label className="field-label">Logo URL</label>
                    <input
                      className="settings-input"
                      placeholder="https://example.com/logo.png"
                      value={form.logo_url ?? ''}
                      onChange={e => set('logo_url', e.target.value)}
                    />
                    {form.logo_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.logo_url}
                        alt="Logo preview"
                        className="logo-preview"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                  </div>
                  <div>
                    <label className="field-label">Favicon URL</label>
                    <input
                      className="settings-input"
                      placeholder="https://example.com/favicon.ico"
                      value={form.favicon_url ?? ''}
                      onChange={e => set('favicon_url', e.target.value)}
                    />
                    {form.favicon_url && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={form.favicon_url}
                        alt="Favicon preview"
                        className="logo-preview"
                        style={{ width: 32, height: 32 }}
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Colours */}
              <div className="settings-section">
                <div className="settings-section-title">Brand Colours</div>
                <div className="color-field-row" style={{ marginBottom: 8 }}>
                  <ColorField
                    label="Primary (accent / buttons)"
                    value={form.primary_color}
                    onChange={v => set('primary_color', v)}
                  />
                  <ColorField
                    label="Highlight (links / glow)"
                    value={form.highlight_color}
                    onChange={v => set('highlight_color', v)}
                  />
                  <ColorField
                    label="Background"
                    value={form.bg_color}
                    onChange={v => set('bg_color', v)}
                  />
                </div>

                {/* Live preview */}
                <div className="preview-panel">
                  <div
                    className="preview-header"
                    style={{ background: form.bg_color }}
                  >
                    {form.logo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={form.logo_url} alt="logo" className="preview-logo" />
                    ) : (
                      <div
                        className="preview-logo-placeholder"
                        style={{ background: form.primary_color, color: form.bg_color }}
                      >
                        {form.club_short_name || 'CC'}
                      </div>
                    )}
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#ffffff' }}>
                      {form.club_name || 'Club Name'}
                    </span>
                    <div className="preview-nav-links">
                      {['Fixtures', 'Results', 'Squad'].map(l => (
                        <span key={l} className="preview-nav-link" style={{ color: form.highlight_color }}>{l}</span>
                      ))}
                    </div>
                  </div>
                  <div
                    className="preview-body"
                    style={{ background: form.bg_color }}
                  >
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Live preview
                    </div>
                    <span
                      className="preview-stat"
                      style={{ background: form.primary_color, color: '#ffffff' }}
                    >
                      {form.club_short_name || 'BCC'} 142/6
                    </span>
                    <span
                      className="preview-stat"
                      style={{ background: 'transparent', border: `1px solid ${form.primary_color}`, color: form.highlight_color }}
                    >
                      22.0 overs
                    </span>
                    <div style={{ marginTop: 6, fontSize: 13, color: form.highlight_color, fontWeight: 600 }}>
                      Target: 178 · Need 36 off 28
                    </div>
                  </div>
                </div>
              </div>

              {/* Scoring Defaults */}
              <div className="settings-section">
                <div className="settings-section-title">Scoring Defaults</div>
                <div>
                  <label className="field-label">Default Scoring Mode for New Matches</label>
                  <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                    {(['club', 'professional'] as const).map(mode => (
                      <button
                        key={mode}
                        type="button"
                        className={form.default_scoring_mode === mode ? 'btn btn-primary' : 'btn btn-ghost'}
                        onClick={() => setForm(p => ({ ...p, default_scoring_mode: mode }))}
                        style={{ flex: 1, justifyContent: 'center', textTransform: 'capitalize' }}
                      >
                        {mode === 'club' ? 'Club' : 'Professional'}
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 8 }}>
                    {form.default_scoring_mode === 'professional'
                      ? 'New matches will default to professional mode — post-ball annotation panel for wagon wheel, pitch map, and shot data.'
                      : 'New matches will default to club mode — standard scoring, no extra data entry required.'}
                  </p>
                </div>
              </div>

              {/* Contact & Plan */}
              <div className="settings-section">
                <div className="settings-section-title">Contact &amp; Plan</div>
                <div className="settings-grid">
                  <div>
                    <label className="field-label">Contact Email</label>
                    <input
                      className="settings-input"
                      type="email"
                      placeholder="contact@yourclub.com"
                      value={form.contact_email ?? ''}
                      onChange={e => set('contact_email', e.target.value)}
                    />
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                      Shown to users when a feature requires a plan upgrade.
                    </p>
                  </div>
                  <div>
                    <label className="field-label">Plan</label>
                    <div style={{
                      display: 'inline-flex', alignItems: 'center', gap: 8,
                      padding: '6px 14px', borderRadius: 4,
                      background: form.plan === 'pro' ? 'rgba(37,99,235,0.15)' : 'var(--surface)',
                      border: '1px solid var(--border)', marginTop: 2,
                    }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: form.plan === 'pro' ? 'var(--blue-mid)' : 'var(--muted)', textTransform: 'uppercase' }}>
                        {form.plan ?? 'Club'}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>
                      To change your plan, contact your account manager.
                    </p>
                  </div>
                </div>
              </div>

              <div className="save-row">
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Settings'}
                </button>
                {success && (
                  <span style={{ fontSize: 13, color: '#4ade80' }}>Saved.</span>
                )}
              </div>
            </form>
          )}
        </div>
      </div>
    </>
  )
}

// ── Colour field: swatch picker + hex text input ───────────────────────────
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const [hex, setHex] = useState(value)

  // keep local hex in sync when parent changes (e.g. initial load)
  useEffect(() => { setHex(value) }, [value])

  function commitHex(raw: string) {
    const v = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v)
    setHex(v)
  }

  return (
    <div>
      <label className="field-label">{label}</label>
      <div className="color-row">
        <div className="color-swatch-wrap">
          <div
            className="color-swatch"
            style={{ background: /^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888' }}
          />
          <input
            type="color"
            value={/^#[0-9a-fA-F]{6}$/.test(value) ? value : '#888888'}
            onChange={e => { setHex(e.target.value); onChange(e.target.value) }}
            style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer', border: 'none', padding: 0 }}
          />
        </div>
        <input
          className="color-hex"
          value={hex}
          onChange={e => setHex(e.target.value)}
          onBlur={e => commitHex(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitHex((e.target as HTMLInputElement).value) } }}
          maxLength={7}
          spellCheck={false}
        />
      </div>
    </div>
  )
}
