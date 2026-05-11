'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'

// ── Types ────────────────────────────────────────────────────────────────────

const ALL_ROLES = ['player', 'shop', 'scorer', 'coach', 'admin'] as const
type Role = (typeof ALL_ROLES)[number]

const ROLE_BADGE: Record<Role, string> = {
  player: 'badge-blue',
  shop:   'badge-gold',
  scorer: 'badge-gold',
  coach:  'badge-lime',
  admin:  'badge-lime',
}

interface Player {
  id: string
  first_name: string
  last_name: string
  nickname: string | null
  batting_style: string | null
  bowling_style: string | null
  is_active: boolean
  user_id: string | null
  email: string | null
}

interface RoleEntry { id: string; role: string; assigned_at: string }
interface AuthUser {
  id: string
  email: string
  full_name: string | null
  created_at: string
  roles: RoleEntry[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BATTING_STYLES = ['Right-hand bat', 'Left-hand bat']
const BOWLING_STYLES = [
  'Right-arm fast', 'Right-arm fast-medium', 'Right-arm medium',
  'Right-arm medium-fast', 'Right-arm off break', 'Right-arm leg break',
  'Left-arm fast', 'Left-arm fast-medium', 'Left-arm medium',
  'Left-arm orthodox', 'Left-arm unorthodox',
]

function getInitials(p: Player) {
  return ((p.first_name[0] ?? '') + (p.last_name[0] ?? '')).toUpperCase()
}

function PlayerSkeleton() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 40, height: 40, borderRadius: 10, background: 'rgba(59,130,246,0.07)', flexShrink: 0 }} />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ height: 13, width: '40%', background: 'rgba(59,130,246,0.06)', borderRadius: 4 }} />
        <div style={{ height: 11, width: '60%', background: 'rgba(59,130,246,0.04)', borderRadius: 4 }} />
      </div>
      <div style={{ height: 22, width: 54, background: 'rgba(59,130,246,0.05)', borderRadius: 5 }} />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminPlayersPage() {
  const [players, setPlayers]       = useState<Player[]>([])
  const [authUsers, setAuthUsers]   = useState<AuthUser[]>([])
  const [loading, setLoading]       = useState(true)
  const [isAdmin, setIsAdmin]       = useState(false)

  // Edit / new player modal
  const [editPlayer, setEditPlayer] = useState<Player | null | 'new'>(null)
  const [form, setForm]             = useState<Partial<Player>>({})
  const [saving, setSaving]         = useState(false)
  const [formError, setFormError]   = useState<string | null>(null)

  // Deactivate confirmation
  const [deactivateTarget, setDeactivateTarget] = useState<Player | null>(null)
  const [deactivating, setDeactivating]         = useState(false)

  // Delete account confirmation
  const [deleteAccountTarget, setDeleteAccountTarget] = useState<Player | null>(null)
  const [deletingAccount, setDeletingAccount]         = useState(false)
  const [deleteError, setDeleteError]                 = useState<string | null>(null)

  // Role management
  const [pendingRoles, setPendingRoles] = useState<Record<string, Role>>({})
  const [roleSaving, setRoleSaving]     = useState<string | null>(null)
  const [roleError, setRoleError]       = useState<string | null>(null)

  // Filters
  const [search, setSearch]           = useState('')
  const [showInactive, setShowInactive] = useState(false)

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? ''
  }, [])

  useEffect(() => {
    async function load() {
      const token = await getToken()
      const [playersResult, authRes] = await Promise.all([
        supabase
          .from('players')
          .select('id, first_name, last_name, nickname, batting_style, bowling_style, is_active, user_id, email')
          .order('last_name'),
        fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token}` } }),
      ])

      if (playersResult.data) setPlayers(playersResult.data)

      if (authRes.ok) {
        setAuthUsers(await authRes.json())
        setIsAdmin(true)
      }
      setLoading(false)
    }
    load()
  }, [getToken])

  const authMap = useMemo(
    () => new Map(authUsers.map(u => [u.id, u])),
    [authUsers]
  )

  // ── Role handlers ──────────────────────────────────────────────────────────

  function availableRolesFor(userId: string) {
    const auth = authMap.get(userId)
    if (!auth) return [...ALL_ROLES]
    return ALL_ROLES.filter(r => !auth.roles.some(er => er.role === r))
  }

  async function handleAssignRole(userId: string) {
    const available = availableRolesFor(userId)
    const role = pendingRoles[userId] ?? available[0]
    if (!role) return
    setRoleSaving(`assign:${userId}`)
    setRoleError(null)
    const token = await getToken()
    const res = await fetch('/api/admin/set-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ userId, role }),
    })
    const result = await res.json()
    setRoleSaving(null)
    if (!res.ok) { setRoleError(result.error); return }

    // Refresh auth data for this user
    const token2 = await getToken()
    const refreshed = await fetch('/api/admin/users', { headers: { Authorization: `Bearer ${token2}` } })
    if (refreshed.ok) setAuthUsers(await refreshed.json())
    setPendingRoles(prev => { const n = { ...prev }; delete n[userId]; return n })
  }

  async function handleRevokeRole(userId: string, roleEntry: RoleEntry) {
    setRoleSaving(`revoke:${roleEntry.id}`)
    setRoleError(null)
    const { error: err } = await supabase.from('user_roles').delete().eq('id', roleEntry.id)
    if (err) { setRoleError(err.message); setRoleSaving(null); return }
    await supabase.from('audit_log').insert({
      action: 'role_revoked', entity_type: 'user_roles', entity_id: roleEntry.id,
      old_data: { user_id: userId, role: roleEntry.role },
    })
    setRoleSaving(null)
    setAuthUsers(prev => prev.map(u =>
      u.id === userId ? { ...u, roles: u.roles.filter(r => r.id !== roleEntry.id) } : u
    ))
  }

  // ── Delete account handler ─────────────────────────────────────────────────

  async function handleDeleteAccount() {
    if (!deleteAccountTarget?.user_id) return
    setDeletingAccount(true)
    setDeleteError(null)
    const token = await getToken()
    const res = await fetch(`/api/admin/users/${deleteAccountTarget.user_id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    })
    const result = await res.json()
    setDeletingAccount(false)
    if (!res.ok) { setDeleteError(result.error); return }

    const uid = deleteAccountTarget.user_id
    setPlayers(prev => prev.map(p =>
      p.user_id === uid ? { ...p, user_id: null, is_active: false } : p
    ))
    setAuthUsers(prev => prev.filter(u => u.id !== uid))
    setDeleteAccountTarget(null)
  }

  // ── Player CRUD ────────────────────────────────────────────────────────────

  function openNew() {
    setForm({ first_name: '', last_name: '', nickname: '', batting_style: '', bowling_style: '', is_active: true })
    setEditPlayer('new')
    setFormError(null)
  }

  function openEdit(player: Player) {
    setForm({ ...player })
    setEditPlayer(player)
    setFormError(null)
  }

  function closeModal() { setEditPlayer(null); setFormError(null) }

  async function handleSave() {
    if (!form.first_name?.trim() || !form.last_name?.trim()) {
      setFormError('First name and last name are required.')
      return
    }
    setSaving(true); setFormError(null)
    try {
      if (editPlayer === 'new') {
        const { data, error } = await supabase
          .from('players')
          .insert({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            nickname: form.nickname?.trim() || null,
            batting_style: form.batting_style || null,
            bowling_style: form.bowling_style || null,
            is_active: true,
          })
          .select()
          .single()
        if (error) throw error
        setPlayers(prev => [...prev, data].sort((a, b) => a.last_name.localeCompare(b.last_name)))
      } else if (editPlayer) {
        const { error } = await supabase
          .from('players')
          .update({
            first_name: form.first_name.trim(),
            last_name: form.last_name.trim(),
            nickname: form.nickname?.trim() || null,
            batting_style: form.batting_style || null,
            bowling_style: form.bowling_style || null,
          })
          .eq('id', (editPlayer as Player).id)
        if (error) throw error
        setPlayers(prev => prev.map(p =>
          p.id === (editPlayer as Player).id ? { ...p, ...form } as Player : p
        ))
      }
      closeModal()
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setSaving(false)
    }
  }

  async function confirmDeactivate() {
    if (!deactivateTarget) return
    setDeactivating(true)
    const { error } = await supabase.from('players').update({ is_active: false }).eq('id', deactivateTarget.id)
    setDeactivating(false)
    if (!error) setPlayers(prev => prev.map(p => p.id === deactivateTarget!.id ? { ...p, is_active: false } : p))
    setDeactivateTarget(null)
  }

  // ── Filtering ──────────────────────────────────────────────────────────────

  const visiblePlayers = players.filter(p => {
    if (!showInactive && !p.is_active) return false
    if (search.trim()) {
      const q = search.toLowerCase()
      const authUser = p.user_id ? authMap.get(p.user_id) : null
      return (
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.nickname ?? '').toLowerCase().includes(q) ||
        (authUser?.email ?? p.email ?? '').toLowerCase().includes(q)
      )
    }
    return true
  })

  const activePlayers   = players.filter(p => p.is_active)
  const inactivePlayers = players.filter(p => !p.is_active)
  const linkedPlayers   = players.filter(p => p.user_id)
  const isNew = editPlayer === 'new'

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        .ap-page { padding-top: var(--nav-h); min-height: 100vh; padding-bottom: 80px; }

        .ap-hero {
          position: relative; overflow: hidden;
          padding: 36px 0 32px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(180deg, var(--deep) 0%, var(--black) 100%);
        }
        .ap-hero::before {
          content: '';
          position: absolute; inset: 0;
          background: radial-gradient(ellipse at 70% 50%, rgba(37,99,235,0.08) 0%, transparent 65%);
          pointer-events: none;
        }
        .ap-hero-inner {
          position: relative; z-index: 1;
          display: flex; align-items: flex-end;
          justify-content: space-between; gap: 16px; flex-wrap: wrap;
        }
        .ap-eyebrow {
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.25em; text-transform: uppercase;
          color: var(--sky); margin-bottom: 8px;
          display: flex; align-items: center; gap: 8px;
        }
        .ap-eyebrow::before { content: ''; display: inline-block; width: 18px; height: 1px; background: var(--sky); }
        .ap-title {
          font-family: var(--font-display);
          font-size: clamp(28px, 5vw, 44px); font-weight: 800;
          color: var(--text); letter-spacing: -0.02em; line-height: 1.05;
        }

        .ap-controls {
          display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
          margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid var(--border);
        }
        .ap-search-wrap { position: relative; flex: 1; min-width: 180px; }
        .ap-search-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--muted); pointer-events: none; }
        .ap-search {
          width: 100%; background: rgba(10,22,40,0.8);
          border: 1px solid rgba(59,130,246,0.18); border-radius: 9px;
          color: var(--text); font-family: var(--font-body); font-size: 14px;
          padding: 10px 14px 10px 36px; outline: none;
          transition: border-color 0.15s, box-shadow 0.15s; min-height: 44px;
        }
        .ap-search:focus { border-color: rgba(96,165,250,0.45); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .ap-search::placeholder { color: rgba(147,197,253,0.28); }

        .ap-toggle {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 10px 14px; border-radius: 9px; border: 1px solid var(--border);
          background: rgba(255,255,255,0.02); color: var(--muted);
          font-family: var(--font-display); font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s; min-height: 44px; white-space: nowrap;
        }
        .ap-toggle:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .ap-toggle.active { border-color: rgba(59,130,246,0.45); background: rgba(37,99,235,0.12); color: #93c5fd; }

        .ap-stats { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .ap-stat-pill {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 7px;
          font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.08em;
          background: rgba(37,99,235,0.08); border: 1px solid rgba(59,130,246,0.16); color: var(--muted);
        }
        .ap-stat-pill strong { font-size: 14px; font-weight: 800; color: #60a5fa; font-family: var(--font-display); }

        .ap-player-row {
          display: flex; align-items: flex-start; gap: 12px;
          padding: 14px 0; border-bottom: 1px solid var(--border);
          transition: background 0.12s; flex-wrap: wrap;
        }
        .ap-player-row:last-child { border-bottom: none; }
        .ap-player-row.inactive { opacity: 0.5; }
        .ap-avatar {
          width: 40px; height: 40px; border-radius: 10px;
          background: linear-gradient(135deg, rgba(29,78,216,0.6) 0%, rgba(14,165,233,0.6) 100%);
          border: 1px solid rgba(59,130,246,0.25);
          display: flex; align-items: center; justify-content: center;
          font-family: var(--font-display); font-size: 13px; font-weight: 800;
          color: #93c5fd; flex-shrink: 0; margin-top: 2px;
        }
        .ap-player-info { flex: 1; min-width: 0; }
        .ap-player-name {
          font-family: var(--font-display); font-size: 14px; font-weight: 700;
          color: var(--text); letter-spacing: -0.01em; margin-bottom: 3px;
        }
        .ap-player-nick { color: var(--muted); font-weight: 400; }
        .ap-player-meta {
          font-size: 11px; color: var(--muted);
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
        }
        .ap-player-meta-sep { width: 2px; height: 2px; border-radius: 50%; background: currentColor; opacity: 0.4; }

        /* Account section */
        .ap-account {
          margin-top: 8px; padding-top: 8px;
          border-top: 1px solid rgba(59,130,246,0.08);
          display: flex; flex-wrap: wrap; align-items: center; gap: 8px;
        }
        .ap-account-email { font-size: 12px; color: var(--muted); }
        .ap-role-list { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
        .ap-role-chip {
          display: inline-flex; align-items: center; gap: 2px;
          padding: 1px 7px 1px 9px; border-radius: 10px; font-size: 11px; font-weight: 600;
          line-height: 1.7; white-space: nowrap;
        }
        .ap-role-chip button {
          background: none; border: none; cursor: pointer; padding: 0 0 0 1px;
          color: inherit; font-size: 13px; line-height: 1; opacity: 0.5;
          display: flex; align-items: center;
        }
        .ap-role-chip button:hover { opacity: 1; }
        .ap-role-chip button:disabled { opacity: 0.25; cursor: not-allowed; }
        .ap-add-role { display: flex; gap: 5px; align-items: center; }
        .ap-role-select {
          padding: 3px 7px; background: var(--surface); border: 1px solid var(--border);
          border-radius: 4px; color: var(--text); font-size: 11px; min-height: 26px;
        }
        .ap-no-account { font-size: 11px; color: rgba(147,197,253,0.25); margin-top: 6px; }

        .ap-player-actions {
          display: flex; align-items: center; gap: 6px; flex-shrink: 0;
        }
        @media (max-width: 480px) {
          .ap-player-row { align-items: flex-start; }
          .ap-player-actions { width: 100%; padding-left: 52px; }
          .ap-row-btn { flex: 1; justify-content: center; min-height: 40px; }
        }
        .ap-row-btn {
          display: inline-flex; align-items: center;
          padding: 8px 12px; border-radius: 7px; border: 1px solid var(--border);
          background: rgba(255,255,255,0.02); color: var(--muted);
          font-family: var(--font-display); font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s; min-height: 36px; white-space: nowrap;
        }
        .ap-row-btn:hover { border-color: rgba(59,130,246,0.3); background: rgba(37,99,235,0.07); color: var(--text); }
        .ap-row-btn.danger { color: rgba(252,165,165,0.6); border-color: rgba(239,68,68,0.14); }
        .ap-row-btn.danger:hover { background: rgba(239,68,68,0.09); border-color: rgba(239,68,68,0.3); color: #fca5a5; }

        .ap-empty {
          text-align: center; padding: 40px 20px;
          color: rgba(147,197,253,0.35); font-size: 14px;
          border: 1px dashed rgba(59,130,246,0.14); border-radius: 12px; line-height: 1.8;
        }

        /* Modals */
        .ap-modal-overlay {
          position: fixed; inset: 0; z-index: 900;
          background: rgba(5,12,26,0.88);
          display: flex; align-items: flex-end; justify-content: center;
          backdrop-filter: blur(4px);
        }
        @media (min-width: 600px) {
          .ap-modal-overlay { align-items: center; }
          .ap-modal { border-radius: 16px !important; max-width: 460px !important; }
        }
        .ap-modal {
          background: var(--panel); border: 1px solid rgba(59,130,246,0.2);
          border-radius: 20px 20px 0 0; width: 100%; max-width: 100%; padding: 0;
          position: relative; max-height: 92vh; overflow-y: auto;
        }
        .ap-modal::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 2px;
          background: linear-gradient(90deg, transparent, rgba(59,130,246,0.45), transparent);
          border-radius: 20px 20px 0 0;
        }
        .ap-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: rgba(59,130,246,0.2); margin: 14px auto 0; }
        .ap-modal-head {
          padding: 20px 24px 16px; border-bottom: 1px solid var(--border);
          display: flex; align-items: center; justify-content: space-between;
        }
        .ap-modal-title { font-family: var(--font-display); font-size: 18px; font-weight: 800; color: var(--text); letter-spacing: -0.01em; }
        .ap-modal-close {
          width: 36px; height: 36px; border-radius: 8px; background: rgba(255,255,255,0.04);
          border: 1px solid var(--border); color: var(--muted); cursor: pointer;
          display: flex; align-items: center; justify-content: center; font-size: 16px; transition: all 0.15s;
        }
        .ap-modal-close:hover { background: rgba(255,255,255,0.08); color: var(--text); }
        .ap-modal-body { padding: 20px 24px 24px; }

        .ap-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .ap-field { margin-bottom: 14px; }
        .ap-label {
          display: block; font-family: var(--font-display); font-size: 10px; font-weight: 700;
          letter-spacing: 0.15em; text-transform: uppercase; color: rgba(147,197,253,0.45); margin-bottom: 6px;
        }
        .ap-input, .ap-select {
          width: 100%; background: rgba(10,22,40,0.8); border: 1px solid rgba(59,130,246,0.18);
          border-radius: 9px; color: var(--text); font-family: var(--font-body); font-size: 15px;
          padding: 12px 14px; outline: none; transition: border-color 0.15s, box-shadow 0.15s;
          min-height: 48px; -webkit-appearance: none;
        }
        .ap-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%2360a5fa' stroke-width='1.5' fill='none' stroke-linecap='round'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 14px center; padding-right: 36px; }
        .ap-input:focus, .ap-select:focus { border-color: rgba(96,165,250,0.45); box-shadow: 0 0 0 3px rgba(37,99,235,0.1); }
        .ap-input::placeholder { color: rgba(147,197,253,0.25); }
        .ap-select option { background: var(--surface); }

        .ap-form-error { background: rgba(239,68,68,0.09); border: 1px solid rgba(239,68,68,0.25); color: #fca5a5; border-radius: 8px; padding: 10px 14px; font-size: 13px; margin-bottom: 16px; }
        .ap-form-actions { display: flex; gap: 10px; padding-top: 4px; }
        .ap-btn-cancel {
          flex: 1; padding: 13px; border-radius: 10px; border: 1px solid var(--border);
          background: rgba(255,255,255,0.03); color: var(--muted); cursor: pointer;
          font-family: var(--font-display); font-size: 14px; font-weight: 700;
          transition: all 0.15s; min-height: 48px;
        }
        .ap-btn-cancel:hover { border-color: rgba(59,130,246,0.3); color: var(--text); }
        .ap-btn-save {
          flex: 2; padding: 13px; border-radius: 10px;
          background: linear-gradient(135deg, #2563eb 0%, #0ea5e9 100%);
          border: none; color: #fff; cursor: pointer;
          font-family: var(--font-display); font-size: 14px; font-weight: 700;
          transition: opacity 0.15s; min-height: 48px;
          box-shadow: 0 4px 16px rgba(37,99,235,0.3);
        }
        .ap-btn-save:hover:not(:disabled) { opacity: 0.9; }
        .ap-btn-save:disabled { opacity: 0.5; cursor: not-allowed; }

        .ap-conf-overlay {
          position: fixed; inset: 0; z-index: 999;
          background: rgba(5,12,26,0.88);
          display: flex; align-items: center; justify-content: center;
          padding: 20px; backdrop-filter: blur(4px);
        }
        .ap-conf-modal {
          background: var(--panel); border-radius: 16px; padding: 28px 24px;
          max-width: 380px; width: 100%; position: relative;
        }
        .ap-conf-modal.warn { border: 1px solid rgba(245,158,11,0.28); }
        .ap-conf-modal.warn::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #f59e0b, transparent); border-radius: 16px 16px 0 0; }
        .ap-conf-modal.danger { border: 1px solid rgba(239,68,68,0.28); }
        .ap-conf-modal.danger::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #ef4444, transparent); border-radius: 16px 16px 0 0; }
        .ap-conf-title { font-family: var(--font-display); font-size: 17px; font-weight: 800; color: var(--text); margin-bottom: 8px; }
        .ap-conf-body { font-size: 13px; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
        .ap-conf-error { font-size: 12px; color: #fca5a5; margin-bottom: 12px; }
        .ap-conf-actions { display: flex; gap: 10px; }
        .ap-conf-cancel {
          flex: 1; padding: 12px; border-radius: 9px; border: 1px solid var(--border);
          background: rgba(255,255,255,0.03); color: var(--muted); cursor: pointer;
          font-family: var(--font-display); font-size: 13px; font-weight: 700;
          transition: all 0.15s; min-height: 44px;
        }
        .ap-conf-cancel:hover { color: var(--text); border-color: rgba(59,130,246,0.3); }
        .ap-conf-btn-warn {
          flex: 1; padding: 12px; border-radius: 9px;
          background: rgba(245,158,11,0.15); border: 1px solid rgba(245,158,11,0.35); color: #fbbf24;
          cursor: pointer; font-family: var(--font-display); font-size: 13px; font-weight: 700;
          transition: all 0.15s; min-height: 44px;
        }
        .ap-conf-btn-warn:hover:not(:disabled) { background: rgba(245,158,11,0.25); border-color: rgba(245,158,11,0.55); }
        .ap-conf-btn-danger {
          flex: 1; padding: 12px; border-radius: 9px;
          background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.35); color: #fca5a5;
          cursor: pointer; font-family: var(--font-display); font-size: 13px; font-weight: 700;
          transition: all 0.15s; min-height: 44px;
        }
        .ap-conf-btn-danger:hover:not(:disabled) { background: rgba(239,68,68,0.25); border-color: rgba(239,68,68,0.55); }
        .ap-conf-btn-warn:disabled, .ap-conf-btn-danger:disabled { opacity: 0.5; cursor: not-allowed; }

        .ap-role-err { font-size: 12px; color: #fca5a5; margin-top: 4px; }

        @media (max-width: 480px) { .ap-form-row { grid-template-columns: 1fr; } }
      `}</style>

      <div className="ap-page">

        <div className="ap-hero">
          <div className="container">
            <div className="ap-hero-inner">
              <div>
                <div className="ap-eyebrow">Admin</div>
                <div className="ap-title">Players</div>
              </div>
              <button className="btn btn-primary" onClick={openNew}>+ Add Player</button>
            </div>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 24 }}>

          {!loading && (
            <div className="ap-stats">
              <div className="ap-stat-pill"><strong>{activePlayers.length}</strong>Active</div>
              {inactivePlayers.length > 0 && <div className="ap-stat-pill"><strong>{inactivePlayers.length}</strong>Inactive</div>}
              {isAdmin && <div className="ap-stat-pill"><strong>{linkedPlayers.length}</strong>Linked accounts</div>}
            </div>
          )}

          <div className="ap-controls">
            <div className="ap-search-wrap">
              <span className="ap-search-icon">⌕</span>
              <input
                className="ap-search"
                type="search"
                placeholder="Search by name or email…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            {inactivePlayers.length > 0 && (
              <button className={`ap-toggle${showInactive ? ' active' : ''}`} onClick={() => setShowInactive(v => !v)}>
                {showInactive ? 'Hide inactive' : 'Show inactive'}
              </button>
            )}
          </div>

          {roleError && <div style={{ fontSize: 12, color: '#fca5a5', marginBottom: 12 }}>{roleError}</div>}

          {loading ? (
            <>{[...Array(5)].map((_, i) => <PlayerSkeleton key={i} />)}</>
          ) : visiblePlayers.length === 0 ? (
            <div className="ap-empty">
              {search
                ? <>No players match &ldquo;{search}&rdquo;.</>
                : <><button onClick={openNew} style={{ color: 'var(--blue-mid)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14 }}>Add the first player →</button></>
              }
            </div>
          ) : (
            visiblePlayers.map(p => {
              const authData = p.user_id ? authMap.get(p.user_id) : null
              const email = authData?.email ?? p.email ?? null
              const available = p.user_id ? availableRolesFor(p.user_id) : []

              return (
                <div key={p.id} className={`ap-player-row${p.is_active ? '' : ' inactive'}`}>
                  <div className="ap-avatar">{getInitials(p)}</div>

                  <div className="ap-player-info">
                    <div className="ap-player-name">
                      {p.first_name} {p.last_name}
                      {p.nickname && <span className="ap-player-nick"> &ldquo;{p.nickname}&rdquo;</span>}
                    </div>
                    <div className="ap-player-meta">
                      {p.batting_style && <span>{p.batting_style}</span>}
                      {p.batting_style && p.bowling_style && <span className="ap-player-meta-sep" />}
                      {p.bowling_style && <span>{p.bowling_style}</span>}
                      {!p.batting_style && !p.bowling_style && <span style={{ opacity: 0.45 }}>No style set</span>}
                    </div>

                    {/* Account & roles section */}
                    {isAdmin && (
                      authData ? (
                        <div className="ap-account">
                          <span className="ap-account-email">{email}</span>
                          <div className="ap-role-list">
                            {authData.roles.length === 0 && (
                              <span style={{ fontSize: 11, color: 'var(--muted)' }}>no roles</span>
                            )}
                            {authData.roles.map(r => (
                              <span key={r.id} className={`ap-role-chip badge ${ROLE_BADGE[r.role as Role] ?? 'badge-blue'}`}>
                                {r.role}
                                <button
                                  title={`Revoke ${r.role}`}
                                  disabled={roleSaving === `revoke:${r.id}`}
                                  onClick={() => handleRevokeRole(authData.id, r)}
                                >×</button>
                              </span>
                            ))}
                          </div>
                          {available.length > 0 && (
                            <div className="ap-add-role">
                              <select
                                className="ap-role-select"
                                value={pendingRoles[authData.id] ?? available[0]}
                                onChange={e => setPendingRoles(prev => ({ ...prev, [authData.id]: e.target.value as Role }))}
                              >
                                {available.map(r => <option key={r} value={r}>{r}</option>)}
                              </select>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 11, padding: '3px 10px', minHeight: 26 }}
                                disabled={roleSaving === `assign:${authData.id}`}
                                onClick={() => handleAssignRole(authData.id)}
                              >
                                {roleSaving === `assign:${authData.id}` ? '…' : 'Assign'}
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="ap-no-account">No linked account</div>
                      )
                    )}
                  </div>

                  <div className="ap-player-actions">
                    {!p.is_active && <span className="badge badge-muted" style={{ marginRight: 4 }}>Inactive</span>}
                    <button className="ap-row-btn" onClick={() => openEdit(p)}>Edit</button>
                    {p.is_active && (
                      <button className="ap-row-btn danger" onClick={() => setDeactivateTarget(p)}>Deactivate</button>
                    )}
                    {isAdmin && authData && (
                      <button className="ap-row-btn danger" onClick={() => { setDeleteAccountTarget(p); setDeleteError(null) }}>
                        Delete Account
                      </button>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Edit / New player modal */}
      {editPlayer !== null && (
        <div className="ap-modal-overlay" onClick={e => { if (e.target === e.currentTarget) closeModal() }}>
          <div className="ap-modal">
            <div className="ap-modal-handle" />
            <div className="ap-modal-head">
              <div className="ap-modal-title">{isNew ? 'New Player' : `Edit ${(editPlayer as Player).first_name}`}</div>
              <button className="ap-modal-close" onClick={closeModal} aria-label="Close">✕</button>
            </div>
            <div className="ap-modal-body">
              <div className="ap-form-row">
                <div className="ap-field">
                  <label className="ap-label">First Name *</label>
                  <input className="ap-input" placeholder="e.g. James" value={form.first_name ?? ''} onChange={e => setForm(p => ({ ...p, first_name: e.target.value }))} autoFocus={isNew} />
                </div>
                <div className="ap-field">
                  <label className="ap-label">Last Name *</label>
                  <input className="ap-input" placeholder="e.g. Anderson" value={form.last_name ?? ''} onChange={e => setForm(p => ({ ...p, last_name: e.target.value }))} />
                </div>
              </div>
              <div className="ap-field">
                <label className="ap-label">Nickname</label>
                <input className="ap-input" placeholder="Optional" value={form.nickname ?? ''} onChange={e => setForm(p => ({ ...p, nickname: e.target.value }))} />
              </div>
              <div className="ap-form-row">
                <div className="ap-field">
                  <label className="ap-label">Batting Style</label>
                  <select className="ap-select" value={form.batting_style ?? ''} onChange={e => setForm(p => ({ ...p, batting_style: e.target.value }))}>
                    <option value="">Not set</option>
                    {BATTING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div className="ap-field">
                  <label className="ap-label">Bowling Style</label>
                  <select className="ap-select" value={form.bowling_style ?? ''} onChange={e => setForm(p => ({ ...p, bowling_style: e.target.value }))}>
                    <option value="">Not set</option>
                    {BOWLING_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              {formError && <div className="ap-form-error">{formError}</div>}
              <div className="ap-form-actions">
                <button className="ap-btn-cancel" onClick={closeModal}>Cancel</button>
                <button className="ap-btn-save" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving…' : isNew ? 'Add Player' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Deactivate confirmation */}
      {deactivateTarget && (
        <div className="ap-conf-overlay" onClick={e => { if (e.target === e.currentTarget) setDeactivateTarget(null) }}>
          <div className="ap-conf-modal warn">
            <div className="ap-conf-title">Deactivate player?</div>
            <div className="ap-conf-body">
              <strong style={{ color: 'var(--text)' }}>{deactivateTarget.first_name} {deactivateTarget.last_name}</strong>{' '}
              will be marked as inactive and will no longer appear in match selections. You can reactivate them via Edit at any time.
            </div>
            <div className="ap-conf-actions">
              <button className="ap-conf-cancel" onClick={() => setDeactivateTarget(null)}>Cancel</button>
              <button className="ap-conf-btn-warn" onClick={confirmDeactivate} disabled={deactivating}>
                {deactivating ? 'Deactivating…' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete account confirmation */}
      {deleteAccountTarget && (
        <div className="ap-conf-overlay" onClick={e => { if (e.target === e.currentTarget) { if (!deletingAccount) setDeleteAccountTarget(null) } }}>
          <div className="ap-conf-modal danger">
            <div className="ap-conf-title">Delete account?</div>
            <div className="ap-conf-body">
              <strong style={{ color: 'var(--text)' }}>{deleteAccountTarget.first_name} {deleteAccountTarget.last_name}</strong>{' '}
              will lose all login access and their roles will be removed. Their player record and cricket history are preserved. This cannot be undone.
            </div>
            {deleteError && <div className="ap-conf-error">{deleteError}</div>}
            <div className="ap-conf-actions">
              <button className="ap-conf-cancel" disabled={deletingAccount} onClick={() => setDeleteAccountTarget(null)}>Cancel</button>
              <button className="ap-conf-btn-danger" onClick={handleDeleteAccount} disabled={deletingAccount}>
                {deletingAccount ? 'Deleting…' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
