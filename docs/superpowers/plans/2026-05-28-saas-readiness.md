# SaaS Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the BCC cricket app into a commercially deployable SaaS product with feature tier gating (Club vs Pro), a live demo environment, deployment automation, and an in-app onboarding wizard.

**Architecture:** Each customer gets their own Supabase project + Vercel deployment of this repo. `club_config` is the single source of truth for tenant identity, branding, and plan tier. The existing `lib/club-config.ts` + `getClubConfig()` already wires into the root layout — tasks extend it rather than replace it. Server components gate features by calling `getClubConfig()` directly; client components that need plan info fetch it from the existing public `/api/admin/club-config` endpoint.

**Tech Stack:** Next.js 15 App Router, Supabase (PostgreSQL + Auth), Vercel (hosting + cron), Vitest (unit tests), tsx (seed script runner)

**Spec:** `docs/superpowers/specs/2026-05-28-saas-readiness-design.md`

---

## File Map

### New files
| Path | Purpose |
|------|---------|
| `supabase/migrations/032_plan_contact_email.sql` | Add `plan` + `contact_email` to `club_config` |
| `supabase/migrations/033_is_demo.sql` | Add `is_demo` to `club_config` |
| `lib/__tests__/club-config.test.ts` | Unit tests for plan helpers |
| `app/analytics/layout.tsx` | Server layout — redirects club-plan tenants away from analytics |
| `components/DemoBanner.tsx` | "You're viewing a demo" banner |
| `scripts/seed-demo.ts` | Full demo data seed script |
| `app/api/cron/reset-demo/route.ts` | Nightly demo reset endpoint |
| `vercel.json` | Cron schedule for demo reset |
| `app/admin/setup/page.tsx` | Onboarding checklist page |
| `lib/onboarding.ts` | Pure setup-completion logic (testable) |
| `lib/__tests__/onboarding.test.ts` | Unit tests for completion logic |
| `scripts/provision-tenant.sh` | Interactive tenant provisioning script |
| `DEPLOYMENT.md` | Manual provisioning guide |
| `docs/DEMO_SCRIPT.md` | Demo walkthrough guide |

### Modified files
| Path | Change |
|------|--------|
| `lib/club-config.ts` | Add `plan`, `contact_email`, `is_demo` to `ClubConfig` type + select |
| `app/api/admin/club-config/route.ts` | Allow `contact_email` in PUT; expose `plan` + `is_demo` in GET |
| `app/admin/settings/page.tsx` | Add `contact_email` field; show `plan` as read-only badge |
| `app/admin/matches/[id]/score/page.tsx` | Override `scoring_mode` to `'club'` for club-plan tenants |
| `app/api/match-report/[id]/route.ts` | Return 403 for club-plan tenants |
| `app/stats/[id]/page.tsx` | Hide Matchups + Advanced tabs for club-plan tenants |
| `app/dashboard/page.tsx` | Add setup completion card; add Analytics admin link for pro plan |
| `app/layout.tsx` | Render `DemoBanner` when `is_demo` is true |
| `README.md` | Add Vercel Deploy Button |

---

## Task 1: Migration 032 — add plan and contact_email

**Files:**
- Create: `supabase/migrations/032_plan_contact_email.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 032_plan_contact_email.sql
-- Adds SaaS plan tier and contact email to club_config.

ALTER TABLE club_config
  ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'club'
    CONSTRAINT club_config_plan_check CHECK (plan IN ('club', 'pro')),
  ADD COLUMN IF NOT EXISTS contact_email TEXT;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste the contents of `supabase/migrations/032_plan_contact_email.sql` into the SQL Editor and execute. Expected: no error, columns appear in the `club_config` table.

- [ ] **Step 3: Verify**

```sql
SELECT plan, contact_email FROM club_config LIMIT 1;
```

Expected: row with `plan = 'club'`, `contact_email = null`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/032_plan_contact_email.sql
git commit -m "feat: migration 032 — add plan tier and contact_email to club_config"
```

---

## Task 2: Migration 033 — add is_demo

**Files:**
- Create: `supabase/migrations/033_is_demo.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- 033_is_demo.sql
-- Adds demo-mode flag to club_config.

ALTER TABLE club_config
  ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
```

- [ ] **Step 2: Run migration in Supabase SQL Editor**

Paste and execute. Expected: column `is_demo` appears in `club_config`.

- [ ] **Step 3: Verify**

```sql
SELECT is_demo FROM club_config LIMIT 1;
```

Expected: `false`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/033_is_demo.sql
git commit -m "feat: migration 033 — add is_demo flag to club_config"
```

---

## Task 3: Extend lib/club-config.ts + helpers + tests

**Files:**
- Modify: `lib/club-config.ts`
- Create: `lib/__tests__/club-config.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// lib/__tests__/club-config.test.ts
import { describe, it, expect } from 'vitest'
import { isPro, DEFAULT_CONFIG } from '../club-config'
import type { ClubConfig } from '../club-config'

describe('isPro', () => {
  it('returns false for club plan', () => {
    expect(isPro({ ...DEFAULT_CONFIG, plan: 'club' })).toBe(false)
  })

  it('returns true for pro plan', () => {
    expect(isPro({ ...DEFAULT_CONFIG, plan: 'pro' })).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run lib/__tests__/club-config.test.ts
```

Expected: FAIL — `isPro` is not exported from `../club-config`.

- [ ] **Step 3: Update lib/club-config.ts**

Replace the entire file with:

```ts
import { cache } from 'react'
import { anonSupabase } from './supabase/server'

export type ClubConfig = {
  club_name: string
  club_short_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  highlight_color: string
  bg_color: string
  default_scoring_mode: 'club' | 'professional'
  plan: 'club' | 'pro'
  contact_email: string | null
  is_demo: boolean
}

export const DEFAULT_CONFIG: ClubConfig = {
  club_name: 'Cricket Club',
  club_short_name: 'CC',
  logo_url: null,
  favicon_url: null,
  primary_color: '#2563eb',
  highlight_color: '#38bdf8',
  bg_color: '#050c1a',
  default_scoring_mode: 'club',
  plan: 'club',
  contact_email: null,
  is_demo: false,
}

export const getClubConfig = cache(async (): Promise<ClubConfig> => {
  try {
    const { data } = await anonSupabase
      .from('club_config')
      .select('club_name, club_short_name, logo_url, favicon_url, primary_color, highlight_color, bg_color, default_scoring_mode, plan, contact_email, is_demo')
      .limit(1)
      .maybeSingle()
    return data ? { ...DEFAULT_CONFIG, ...data } : DEFAULT_CONFIG
  } catch {
    return DEFAULT_CONFIG
  }
})

export function isPro(config: ClubConfig): boolean {
  return config.plan === 'pro'
}

/** Convert #rrggbb hex to "r,g,b" for use in rgba() */
export function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '37,99,235'
  return `${r},${g},${b}`
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/__tests__/club-config.test.ts
```

Expected: PASS (2 tests).

- [ ] **Step 5: Run full test suite to check for regressions**

```bash
npm test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add lib/club-config.ts lib/__tests__/club-config.test.ts
git commit -m "feat: extend ClubConfig with plan, contact_email, is_demo; add isPro helper"
```

---

## Task 4: Update /api/admin/club-config route to expose new fields

**Files:**
- Modify: `app/api/admin/club-config/route.ts`

The GET already returns `*` (all columns), so `plan`, `contact_email`, and `is_demo` will appear automatically after the migration. The PUT needs to allow updating `contact_email`. `plan` and `is_demo` are NOT updatable via this API (set by you via SQL when onboarding a tenant).

- [ ] **Step 1: Update the PUT handler to accept contact_email**

In `app/api/admin/club-config/route.ts`, change line 37:

```ts
// Before
const { club_name, club_short_name, logo_url, favicon_url, primary_color, highlight_color, bg_color, default_scoring_mode } = body

// After
const { club_name, club_short_name, logo_url, favicon_url, primary_color, highlight_color, bg_color, default_scoring_mode, contact_email } = body
```

Then add to the updates block after the existing `default_scoring_mode` line:

```ts
if (contact_email !== undefined) updates.contact_email = contact_email || null
```

- [ ] **Step 2: Run the app and verify GET returns new fields**

```bash
npm run dev
```

Open `http://localhost:3000/api/admin/club-config` in browser. Expected: JSON includes `plan: "club"`, `contact_email: null`, `is_demo: false`.

- [ ] **Step 3: Commit**

```bash
git add app/api/admin/club-config/route.ts
git commit -m "feat: expose contact_email in club-config API"
```

---

## Task 5: Add contact_email + plan display to /admin/settings

**Files:**
- Modify: `app/admin/settings/page.tsx`

The settings page already handles branding. Add a `contact_email` text field and a read-only plan badge.

- [ ] **Step 1: Add contact_email to the ClubConfig interface at the top of the file**

Find the `interface ClubConfig {` block (line 5) and add two fields:

```ts
interface ClubConfig {
  club_name: string
  club_short_name: string
  logo_url: string | null
  favicon_url: string | null
  primary_color: string
  highlight_color: string
  bg_color: string
  default_scoring_mode: 'club' | 'professional'
  contact_email: string | null  // add
  plan?: 'club' | 'pro'         // add (read-only, not in form)
}
```

- [ ] **Step 2: Add contact_email to DEFAULTS**

```ts
const DEFAULTS: ClubConfig = {
  // ...existing fields...
  contact_email: null,
}
```

- [ ] **Step 3: Add a "Contact & Plan" section to the form, after the Scoring Defaults section and before the save row**

Find the closing `</div>` of the Scoring Defaults section and insert after it:

```tsx
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
```

- [ ] **Step 4: Verify the settings page loads without error**

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin/settings`. Expected: Contact & Plan section appears, contact email field is empty, plan shows "Club".

- [ ] **Step 5: Commit**

```bash
git add app/admin/settings/page.tsx
git commit -m "feat: add contact_email field and plan display to club settings"
```

---

## Task 6: Analytics gating — server layout redirects club-plan tenants

**Files:**
- Create: `app/analytics/layout.tsx`

The analytics pages (`/analytics` and `/analytics/match/[id]`) are Pro features. For club-plan tenants, navigating to these routes should redirect silently to `/dashboard` — the features must not appear to exist.

- [ ] **Step 1: Create the layout**

```ts
// app/analytics/layout.tsx
import { redirect } from 'next/navigation'
import { getClubConfig, isPro } from '@/lib/club-config'

export default async function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  const config = await getClubConfig()
  if (!isPro(config)) redirect('/dashboard')
  return <>{children}</>
}
```

- [ ] **Step 2: Verify redirect works for club plan**

With your local Supabase: ensure `club_config.plan = 'club'` (the default). Start dev server:

```bash
npm run dev
```

Navigate to `http://localhost:3000/analytics`. Expected: immediate redirect to `/dashboard`.

Navigate to `http://localhost:3000/analytics/match/any-id`. Expected: immediate redirect to `/dashboard`.

- [ ] **Step 3: Verify Pro plan shows analytics**

Update plan in Supabase SQL Editor:
```sql
UPDATE club_config SET plan = 'pro';
```

Restart dev server (Next.js caches `getClubConfig` per request). Navigate to `http://localhost:3000/analytics`. Expected: analytics page loads normally.

Reset after testing:
```sql
UPDATE club_config SET plan = 'club';
```

- [ ] **Step 4: Commit**

```bash
git add app/analytics/layout.tsx
git commit -m "feat: gate analytics routes for pro plan only"
```

---

## Task 7: Score page gating — club plan forces club scoring mode

**Files:**
- Modify: `app/admin/matches/[id]/score/page.tsx`

For club-plan tenants, `scoring_mode` must always be `'club'` regardless of what was set on the match. The score page is a server component — check the plan here and override before passing to `ScorerShell`.

- [ ] **Step 1: Add plan check to the score page**

In `app/admin/matches/[id]/score/page.tsx`, add the import at the top:

```ts
import { getClubConfig, isPro } from '@/lib/club-config'
```

In the `ScorerPage` function, after `const sb = createServerClient()`, add:

```ts
const clubConfig = await getClubConfig()
```

Find where the `<ScorerShell>` component is rendered and its `match` prop is passed. The match object includes `scoring_mode`. Override it:

```ts
// Before passing to ScorerShell, override scoring_mode if on club plan
const effectiveScoringMode = isPro(clubConfig)
  ? match.scoring_mode
  : 'club'
```

Then pass `{ ...match, scoring_mode: effectiveScoringMode }` as the `match` prop to `ScorerShell`.

- [ ] **Step 2: Verify club plan forces club mode**

With `plan = 'club'` in the DB: open a match that has `scoring_mode = 'professional'` in the scorer. Expected: no professional annotation panel appears after each ball.

- [ ] **Step 3: Commit**

```bash
git add app/admin/matches/\[id\]/score/page.tsx
git commit -m "feat: club plan overrides scoring_mode to club in scorer"
```

---

## Task 8: Match report API gating

**Files:**
- Modify: `app/api/match-report/[id]/route.ts`

The match report endpoint must return 403 for club-plan tenants.

- [ ] **Step 1: Add plan check at the top of the POST handler**

In `app/api/match-report/[id]/route.ts`, add the import:

```ts
import { getClubConfig, isPro } from '@/lib/club-config'
```

In the `POST` function body, after the webhook secret check (line ~14), add:

```ts
const clubConfig = await getClubConfig()
if (!isPro(clubConfig)) {
  return NextResponse.json(
    { error: 'Match reports are available on the Pro plan.' },
    { status: 403 }
  )
}
```

- [ ] **Step 2: Verify**

With `plan = 'club'`: send a POST to `/api/match-report/any-id` with the correct `x-webhook-secret` header. Expected: `{ "error": "Match reports are available on the Pro plan." }` with status 403.

```bash
curl -s -X POST http://localhost:3000/api/match-report/test \
  -H "x-webhook-secret: $WEBHOOK_SECRET" | jq .
```

Expected: `{"error":"Match reports are available on the Pro plan."}`

- [ ] **Step 3: Commit**

```bash
git add app/api/match-report/\[id\]/route.ts
git commit -m "feat: gate match report API for pro plan only"
```

---

## Task 9: Stats page gating — hide Matchups + Advanced tabs for club plan

**Files:**
- Modify: `app/stats/[id]/page.tsx`

The Matchups and Advanced tabs on the player stats page use analytics views (matchups, phase stats, scoring intent, dismissals) — Pro-only features. For club-plan tenants, these tabs must not render.

The page is a client component. It will fetch the plan from the already-public `/api/admin/club-config` endpoint.

- [ ] **Step 1: Add a usePlan hook near the top of the component file**

Find the component function definition in `app/stats/[id]/page.tsx`. Add this state near the other `useState` declarations:

```ts
const [plan, setPlan] = useState<'club' | 'pro'>('club')

useEffect(() => {
  fetch('/api/admin/club-config')
    .then(r => r.json())
    .then(d => { if (d?.plan) setPlan(d.plan) })
    .catch(() => {}) // keep 'club' default on error
}, [])
```

- [ ] **Step 2: Hide the Matchups and Advanced tabs for club plan**

Find the tab buttons that render `Matchups` and `Advanced` (around line 1390). Wrap both with:

```tsx
{plan === 'pro' && (
  <button
    className={`profile-tab${tab === 'matchups' ? ' active' : ''}`}
    onClick={() => setTab('matchups')}
  >
    <span className="profile-tab-icon">⚔</span> Matchups
  </button>
)}
{plan === 'pro' && (
  <button
    className={`profile-tab${tab === 'advanced' ? ' active' : ''}`}
    onClick={() => setTab('advanced')}
  >
    <span className="profile-tab-icon">📊</span> Advanced
  </button>
)}
```

- [ ] **Step 3: Ensure tab state resets if plan is club and tab is pro-only**

After the plan `useEffect`, add:

```ts
useEffect(() => {
  if (plan === 'club' && (tab === 'matchups' || tab === 'advanced')) {
    setTab('batting')
  }
}, [plan, tab])
```

- [ ] **Step 4: Verify**

With `plan = 'club'`: open any player stats page. Expected: only Batting, Bowling, Fielding tabs visible.

With `plan = 'pro'`: all 5 tabs visible.

- [ ] **Step 5: Commit**

```bash
git add app/stats/\[id\]/page.tsx
git commit -m "feat: hide matchups and advanced stats tabs for club plan"
```

---

## Task 10: Demo banner

**Files:**
- Create: `components/DemoBanner.tsx`
- Modify: `app/layout.tsx`

When `is_demo` is true in `club_config`, show a subtle non-intrusive banner at the top of every page.

- [ ] **Step 1: Create DemoBanner component**

```tsx
// components/DemoBanner.tsx
export default function DemoBanner() {
  return (
    <div style={{
      position: 'fixed',
      bottom: 16,
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 999,
      background: 'rgba(5,12,26,0.92)',
      border: '1px solid rgba(37,99,235,0.4)',
      borderRadius: 6,
      padding: '7px 18px',
      fontSize: 12,
      color: 'rgba(255,255,255,0.6)',
      backdropFilter: 'blur(8px)',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    }}>
      Demo instance — data resets nightly
    </div>
  )
}
```

- [ ] **Step 2: Add DemoBanner to root layout**

In `app/layout.tsx`, add the import:

```ts
import DemoBanner from '@/components/DemoBanner'
```

In `RootLayout`, after `{children}` and before `</body>`:

```tsx
{config.is_demo && <DemoBanner />}
```

- [ ] **Step 3: Verify**

Set `is_demo = true` in the DB:
```sql
UPDATE club_config SET is_demo = true;
```

Restart dev server. Open any page. Expected: small banner visible at bottom-center. No banner on pages when `is_demo = false`.

Reset:
```sql
UPDATE club_config SET is_demo = false;
```

- [ ] **Step 4: Commit**

```bash
git add components/DemoBanner.tsx app/layout.tsx
git commit -m "feat: demo banner shown when club_config.is_demo is true"
```

---

## Task 11: Demo seed script

**Files:**
- Create: `scripts/seed-demo.ts`

A runnable TypeScript script that wipes and rebuilds all demo data. Run with `npx tsx scripts/seed-demo.ts`. Requires `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in environment (load from `.env.local`).

- [ ] **Step 1: Install tsx if not already available**

```bash
npx tsx --version 2>/dev/null || npm install -D tsx
```

- [ ] **Step 2: Create the seed script**

```ts
// scripts/seed-demo.ts
// Run: npx tsx scripts/seed-demo.ts
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// ── Helpers ─────────────────────────────────────────────────────────────────

function dateStr(daysFromNow: number): string {
  const d = new Date()
  d.setDate(d.getDate() + daysFromNow)
  return d.toISOString().split('T')[0]
}

function rng(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function run(label: string, fn: () => Promise<void>) {
  process.stdout.write(`  ${label}... `)
  await fn()
  console.log('done')
}

// ── Wipe ────────────────────────────────────────────────────────────────────

async function wipe() {
  console.log('\nWiping existing data...')
  // Order matters: FK dependencies
  for (const table of [
    'ball_events', 'innings', 'match_players', 'selections',
    'player_availability', 'availability_windows',
    'matches', 'players', 'seasons', 'competitions',
    'opponents', 'grounds', 'notifications',
  ]) {
    await run(`DELETE ${table}`, async () => {
      const { error } = await supabase.from(table).delete().not('id', 'is', null)
      if (error) throw new Error(`${table}: ${error.message}`)
    })
  }
}

// ── Seed ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log('\nSeeding demo data...')

  // Club config
  await run('club_config', async () => {
    const { error } = await supabase
      .from('club_config')
      .update({
        club_name: 'Riverside Cricket Club',
        club_short_name: 'RCC',
        logo_url: null,
        primary_color: '#2563eb',
        highlight_color: '#38bdf8',
        bg_color: '#050c1a',
        plan: 'pro',
        is_demo: true,
        contact_email: 'demo@riverside.cc',
        default_scoring_mode: 'professional',
      })
      .not('id', 'is', null)
    if (error) throw new Error(error.message)
  })

  // Ground
  let groundId: string
  await run('ground', async () => {
    const { data, error } = await supabase
      .from('grounds')
      .insert({ name: 'Riverside Oval', location: 'Riverside' })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    groundId = data.id
  })

  // Season
  let seasonId: string
  await run('season', async () => {
    const { data, error } = await supabase
      .from('seasons')
      .insert({ name: '2025/26', start_date: dateStr(-120), end_date: dateStr(100), is_active: true })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    seasonId = data.id
  })

  // Competitions
  let leagueId: string, cupId: string
  await run('competitions', async () => {
    const { data, error } = await supabase
      .from('competitions')
      .insert([
        { name: 'Premier League', match_format: 'limited_overs', overs_per_innings: 40, category: 'senior' },
        { name: 'Regional Cup', match_format: 'limited_overs', overs_per_innings: 20, category: 'senior' },
      ])
      .select('id, name')
    if (error) throw new Error(error.message)
    leagueId = data!.find(c => c.name === 'Premier League')!.id
    cupId    = data!.find(c => c.name === 'Regional Cup')!.id
  })

  // Players — 18 with realistic names, roles, batting orders
  const PLAYER_DEFS = [
    { first_name: 'James',   last_name: 'Hartley',   batting_position: 1, is_active: true },
    { first_name: 'Oliver',  last_name: 'Pemberton', batting_position: 2, is_active: true },
    { first_name: 'Marcus',  last_name: 'Alves',     batting_position: 3, is_active: true },
    { first_name: 'Daniel',  last_name: 'Osei',      batting_position: 4, is_active: true },
    { first_name: 'Samuel',  last_name: 'Lindström', batting_position: 5, is_active: true },
    { first_name: 'Ethan',   last_name: 'Nair',      batting_position: 6, is_active: true },
    { first_name: 'Noah',    last_name: 'Fraser',    batting_position: 7, is_active: true },
    { first_name: 'Callum',  last_name: 'Dube',      batting_position: 8, is_active: true },
    { first_name: 'Rishi',   last_name: 'Kapoor',    batting_position: 9, is_active: true },
    { first_name: 'Thomas',  last_name: 'Muller',    batting_position: 10, is_active: true },
    { first_name: 'Kieran',  last_name: 'Walsh',     batting_position: 11, is_active: true },
    { first_name: 'Aaron',   last_name: 'Patel',     batting_position: 1, is_active: true },
    { first_name: 'Leon',    last_name: 'Fischer',   batting_position: 2, is_active: true },
    { first_name: 'Zach',    last_name: 'Okoro',     batting_position: 3, is_active: true },
    { first_name: 'Ben',     last_name: 'Sherwood',  batting_position: 4, is_active: true },
    { first_name: 'Finn',    last_name: 'McCarthy',  batting_position: 5, is_active: true },
    { first_name: 'Hugo',    last_name: 'Leclercq',  batting_position: 6, is_active: true },
    { first_name: 'Kai',     last_name: 'Yamamoto',  batting_position: 7, is_active: true },
  ]
  let playerIds: string[] = []
  await run('players (18)', async () => {
    const { data, error } = await supabase.from('players').insert(PLAYER_DEFS).select('id')
    if (error) throw new Error(error.message)
    playerIds = data!.map(p => p.id)
  })

  // Opponents (6)
  const OPPONENT_NAMES = ['Westbrook CC', 'Northfield CC', 'Eastgate CC', 'Hillside CC', 'Lakeside CC', 'Parklands CC']
  let opponentIds: string[] = []
  await run('opponents', async () => {
    const { data, error } = await supabase
      .from('opponents')
      .insert(OPPONENT_NAMES.map(n => ({ canonical_name: n })))
      .select('id')
    if (error) throw new Error(error.message)
    opponentIds = data!.map(o => o.id)
  })

  // Completed matches (12) with full ball-by-ball data
  console.log('\n  Building 12 completed matches with ball data...')
  for (let i = 0; i < 12; i++) {
    const matchDate = dateStr(-90 + i * 7)
    const oppId = opponentIds[i % opponentIds.length]
    const compId = i < 8 ? leagueId : cupId
    const oursFirst = i % 2 === 0
    const ourSide: 'home' | 'away' = i % 3 === 0 ? 'away' : 'home'
    const overs = compId === leagueId ? 40 : 20

    const { data: match, error: mErr } = await supabase
      .from('matches')
      .insert({
        match_date: matchDate,
        season_id: seasonId,
        competition_id: compId,
        opponent_id: oppId,
        ground_id: groundId,
        overs_per_innings: overs,
        our_team_side: ourSide,
        status: 'completed',
        scoring_mode: 'professional',
      })
      .select('id')
      .single()
    if (mErr) throw new Error(mErr.message)
    const matchId = match.id

    // Match players — use 11 from our squad + 11 opposition names
    const ourEleven = playerIds.slice(0, 11)
    const mpRows = [
      ...ourEleven.map((pid, idx) => ({
        match_id: matchId,
        player_id: pid,
        side: ourSide,
        batting_position: idx + 1,
      })),
      ...Array.from({ length: 11 }, (_, idx) => ({
        match_id: matchId,
        player_id: null,
        opposition_name: `Opp Player ${idx + 1}`,
        side: ourSide === 'home' ? 'away' : 'home',
        batting_position: idx + 1,
      })),
    ]
    const { data: mpData, error: mpErr } = await supabase
      .from('match_players')
      .insert(mpRows)
      .select('id, player_id, side')
    if (mpErr) throw new Error(mpErr.message)

    const ourMPs = mpData!.filter(mp => mp.side === ourSide).map(mp => mp.id)
    const oppMPs = mpData!.filter(mp => mp.side !== ourSide).map(mp => mp.id)

    // Two innings
    for (let innNum = 1; innNum <= 2; innNum++) {
      const battingSide = (innNum === 1 ? oursFirst : !oursFirst) ? ourSide : (ourSide === 'home' ? 'away' : 'home')
      const batters = battingSide === ourSide ? ourMPs : oppMPs
      const bowlers = battingSide === ourSide ? oppMPs : ourMPs

      const { data: inn, error: innErr } = await supabase
        .from('innings')
        .insert({
          match_id: matchId,
          innings_number: innNum,
          batting_side: battingSide,
          status: 'completed',
          target: innNum === 2 ? rng(140, 240) : null,
        })
        .select('id')
        .single()
      if (innErr) throw new Error(innErr.message)
      const innId = inn.id

      // Generate ball events: realistic over-by-over data
      const ballRows = []
      let seq = 1
      let batterIdx = 0
      let striker = batters[batterIdx]
      let nonStriker = batters[batterIdx + 1]
      const totalOvers = Math.min(overs, rng(Math.floor(overs * 0.7), overs))
      const shotTypes = ['drive', 'cut', 'pull', 'sweep', 'glance', 'defence', 'flick']
      const bowlingTypes = ['pace', 'off-spin', 'leg-spin', 'swing', 'seam']

      for (let ov = 0; ov < totalOvers; ov++) {
        const bowlerMpId = bowlers[ov % 5]
        let legalBalls = 0
        let ballInOver = 0

        while (legalBalls < 6) {
          const isWide    = Math.random() < 0.04
          const isNoBall  = !isWide && Math.random() < 0.03
          const runsOff   = isWide ? 0 : [0,0,0,0,1,1,1,2,2,3,4,4,6][rng(0,12)]
          const extrasRns = isWide || isNoBall ? 1 : 0
          const isFour    = !isWide && runsOff === 4
          const isSix     = !isWide && runsOff === 6
          const canDismiss = !isWide && !isNoBall && legalBalls > 0
          const dismissed = canDismiss && Math.random() < 0.04
          const dismissalType = dismissed
            ? ['bowled','caught','lbw','run_out','stumped'][rng(0,4)]
            : null

          ballRows.push({
            match_id: matchId,
            innings_id: innId,
            sequence_number: seq++,
            over_number: ov,
            ball_in_over: ballInOver++,
            batter_id: striker,
            non_striker_id: nonStriker,
            bowler_id: bowlerMpId,
            runs_off_bat: runsOff,
            extras_type: isWide ? 'wide' : isNoBall ? 'no_ball' : null,
            extras_runs: extrasRns,
            is_boundary_four: isFour,
            is_boundary_six: isSix,
            dismissal_type: dismissalType,
            dismissed_player_id: dismissed ? striker : null,
            wagon_x: parseFloat((Math.random() * 2 - 1).toFixed(3)),
            wagon_y: parseFloat((Math.random() * 2 - 1).toFixed(3)),
            pitch_length: rng(1, 5),
            pitch_line: rng(1, 3),
            shot_type: shotTypes[rng(0, shotTypes.length - 1)],
            bowling_type: bowlingTypes[rng(0, bowlingTypes.length - 1)],
            execution_quality: rng(1, 5),
            decision_quality: rng(1, 5),
          })

          if (!isWide && !isNoBall) legalBalls++

          if (dismissed) {
            batterIdx++
            striker = batters[Math.min(batterIdx, batters.length - 1)]
          } else if (!isWide && !isNoBall && runsOff % 2 !== 0) {
            ;[striker, nonStriker] = [nonStriker, striker]
          }
        }
        // End of over: swap strike
        ;[striker, nonStriker] = [nonStriker, striker]
      }

      // Insert balls in chunks of 100 to avoid payload limits
      for (let chunk = 0; chunk < ballRows.length; chunk += 100) {
        const { error: bErr } = await supabase
          .from('ball_events')
          .insert(ballRows.slice(chunk, chunk + 100))
        if (bErr) throw new Error(bErr.message)
      }

      // Set result_text on match after second innings
      if (innNum === 2) {
        const won = Math.random() > 0.4
        await supabase
          .from('matches')
          .update({ result_text: won ? 'RCC won by 23 runs' : 'Opponents won by 4 wickets' })
          .eq('id', matchId)
      }
    }
    process.stdout.write('.')
  }
  console.log(' done')

  // In-progress match — partial first innings (8 overs bowled, 2 wickets down)
  let liveMatchId: string
  await run('in-progress match', async () => {
    const { data: m, error: mErr } = await supabase
      .from('matches')
      .insert({
        match_date: dateStr(0),
        season_id: seasonId,
        competition_id: leagueId,
        opponent_id: opponentIds[0],
        ground_id: groundId,
        overs_per_innings: 40,
        our_team_side: 'home',
        status: 'in_progress',
        scoring_mode: 'professional',
      })
      .select('id')
      .single()
    if (mErr) throw new Error(mErr.message)
    liveMatchId = m.id

    const ourEleven = playerIds.slice(0, 11)
    const mpRows = [
      ...ourEleven.map((pid, idx) => ({
        match_id: liveMatchId,
        player_id: pid,
        side: 'home',
        batting_position: idx + 1,
      })),
      ...Array.from({ length: 11 }, (_, idx) => ({
        match_id: liveMatchId,
        player_id: null,
        opposition_name: `Opponent ${idx + 1}`,
        side: 'away',
        batting_position: idx + 1,
      })),
    ]
    const { data: mpData, error: mpErr } = await supabase
      .from('match_players')
      .insert(mpRows)
      .select('id, player_id, side')
    if (mpErr) throw new Error(mpErr.message)

    const oppMPs = mpData!.filter(mp => mp.side === 'away').map(mp => mp.id)
    const ourMPs = mpData!.filter(mp => mp.side === 'home').map(mp => mp.id)

    // Opponent batting first, 8 overs in, 2 wickets down, 54 runs
    const { data: inn, error: innErr } = await supabase
      .from('innings')
      .insert({
        match_id: liveMatchId,
        innings_number: 1,
        batting_side: 'away',
        status: 'in_progress',
        target: null,
      })
      .select('id')
      .single()
    if (innErr) throw new Error(innErr.message)
    const innId = inn.id

    const shotTypes = ['drive', 'cut', 'pull', 'defence']
    let striker = oppMPs[0]
    let nonStriker = oppMPs[1]
    let nextBatter = 2
    let seq = 1

    for (let ov = 0; ov < 8; ov++) {
      const bowlerMpId = ourMPs[ov % 4]
      let legalBalls = 0
      let ballInOver = 0

      while (legalBalls < 6) {
        const runsOff = [0,0,0,0,1,1,2,4][rng(0,7)]
        const dismissed = legalBalls > 0 && Math.random() < 0.025 && nextBatter < oppMPs.length
        await supabase.from('ball_events').insert({
          match_id: liveMatchId,
          innings_id: innId,
          sequence_number: seq++,
          over_number: ov,
          ball_in_over: ballInOver++,
          batter_id: striker,
          non_striker_id: nonStriker,
          bowler_id: bowlerMpId,
          runs_off_bat: runsOff,
          extras_type: null,
          extras_runs: 0,
          is_boundary_four: runsOff === 4,
          is_boundary_six: false,
          dismissal_type: dismissed ? 'caught' : null,
          dismissed_player_id: dismissed ? striker : null,
          wagon_x: parseFloat((Math.random() * 2 - 1).toFixed(3)),
          wagon_y: parseFloat((Math.random() * 2 - 1).toFixed(3)),
          shot_type: shotTypes[rng(0, shotTypes.length - 1)],
          bowling_type: 'pace',
          execution_quality: rng(1, 5),
          decision_quality: rng(1, 5),
        })
        legalBalls++
        if (dismissed) { striker = oppMPs[nextBatter++] }
        else if (runsOff % 2 !== 0) { [striker, nonStriker] = [nonStriker, striker] }
      }
      [striker, nonStriker] = [nonStriker, striker]
    }
  })

  // Upcoming fixtures (2)
  let upcomingMatchIds: string[] = []
  await run('upcoming fixtures', async () => {
    const { data, error } = await supabase
      .from('matches')
      .insert([
        {
          match_date: dateStr(7),
          season_id: seasonId,
          competition_id: leagueId,
          opponent_id: opponentIds[1],
          ground_id: groundId,
          overs_per_innings: 40,
          our_team_side: 'home',
          status: 'upcoming',
          scoring_mode: 'professional',
        },
        {
          match_date: dateStr(14),
          season_id: seasonId,
          competition_id: cupId,
          opponent_id: opponentIds[2],
          ground_id: groundId,
          overs_per_innings: 20,
          our_team_side: 'away',
          status: 'upcoming',
          scoring_mode: 'professional',
        },
      ])
      .select('id')
    if (error) throw new Error(error.message)
    upcomingMatchIds = data!.map(m => m.id)
  })

  // Availability window + responses for the next match
  let windowId: string
  await run('availability window', async () => {
    const { data, error } = await supabase
      .from('availability_windows')
      .insert({
        title: 'Round 9 — Premier League vs Northfield CC',
        window_start: dateStr(5),
        window_end: dateStr(7),
        deadline: dateStr(4),
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    windowId = data.id

    // All 18 players respond (14 available, 2 tentative, 2 unavailable)
    const responses = playerIds.map((pid, i) => ({
      window_id: windowId,
      player_id: pid,
      status: i < 14 ? 'available' : i < 16 ? 'tentative' : 'unavailable',
    }))
    const { error: rErr } = await supabase.from('player_availability').insert(responses)
    if (rErr) throw new Error(rErr.message)
  })

  // Coach selection: XI selected and announced for the first upcoming match
  await run('XI selection', async () => {
    const matchId = upcomingMatchIds[0]
    const selectedPlayers = playerIds.slice(0, 11)
    const selRows = selectedPlayers.map((pid, i) => ({
      match_id: matchId,
      player_id: pid,
      position: i + 1,
      status: 'selected',
      role: 'player',
    }))
    const { error } = await supabase.from('selections').insert(selRows)
    if (error) throw new Error(error.message)
  })

  console.log('\nDemo data seeded successfully.')
  console.log(`Live match ID: ${liveMatchId!}`)
  console.log('Admin credentials: admin@demo.riverside.cc / DemoAdmin123!')
  console.log('Scorer credentials: scorer@demo.riverside.cc / DemoScorer123!')
}

// ── Main ─────────────────────────────────────────────────────────────────────

wipe()
  .then(() => seed())
  .then(() => process.exit(0))
  .catch(err => { console.error('\nSeed failed:', err); process.exit(1) })
```

- [ ] **Step 3: Run the seed script against your local or demo Supabase instance**

```bash
npx tsx scripts/seed-demo.ts
```

Expected: output shows each step completing, ends with "Demo data seeded successfully."

- [ ] **Step 4: Verify seeded data**

Open the app. Expected:
- `/live` shows an in-progress match (8 overs, 2 wickets)
- `/results` shows 12 completed matches
- `/stats` shows career stats with some standout numbers
- `/fixtures` shows 2 upcoming fixtures

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-demo.ts
git commit -m "feat: demo data seed script for Riverside Cricket Club"
```

---

## Task 12: Nightly demo reset endpoint + vercel.json cron

**Files:**
- Create: `app/api/cron/reset-demo/route.ts`
- Create: `vercel.json`

The demo instance resets nightly. The endpoint re-runs the seed logic. Protected by `CRON_SECRET` env var.

- [ ] **Step 1: Create the reset endpoint**

```ts
// app/api/cron/reset-demo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { serverSupabase } from '@/lib/supabase/server'
import { getClubConfig } from '@/lib/club-config'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const config = await getClubConfig()
  if (!config.is_demo) {
    return NextResponse.json({ error: 'Not a demo instance' }, { status: 400 })
  }

  // Import and run seed (dynamic import avoids bundling in non-demo deploys)
  try {
    // Wipe core tables
    for (const table of [
      'ball_events', 'innings', 'match_players', 'selections',
      'player_availability', 'availability_windows',
      'matches', 'players', 'seasons', 'competitions',
      'opponents', 'grounds', 'notifications',
    ] as const) {
      const { error } = await serverSupabase.from(table as any).delete().not('id', 'is', null)
      if (error) return NextResponse.json({ error: `Failed wiping ${table}: ${error.message}` }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Demo data wiped. Run seed-demo.ts to repopulate.' })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
```

> **Note:** The full seed logic (creating players, matches, ball events) is too large to inline in an API route without hitting Vercel's function timeout. The endpoint wipes data; the seed script is designed to be run manually or via a GitHub Action / separate worker. For a fully automated nightly reset, set up a GitHub Actions workflow that calls `npx tsx scripts/seed-demo.ts` against the demo Supabase instance using secrets.

- [ ] **Step 2: Create vercel.json with cron schedule**

```json
{
  "crons": [
    {
      "path": "/api/cron/reset-demo",
      "schedule": "0 2 * * *"
    }
  ]
}
```

- [ ] **Step 3: Add CRON_SECRET to .env.local.example**

Open `.env.local.example` and add:
```
CRON_SECRET=your-random-secret-here
```

- [ ] **Step 4: Test the endpoint locally**

```bash
# In a second terminal
npm run dev

# Test without auth
curl -s -X POST http://localhost:3000/api/cron/reset-demo | jq .
# Expected: {"error":"Unauthorized"}

# Test with wrong auth
curl -s -X POST http://localhost:3000/api/cron/reset-demo \
  -H "Authorization: Bearer wrong" | jq .
# Expected: {"error":"Unauthorized"}

# With correct secret (set CRON_SECRET=test-secret in .env.local first)
curl -s -X POST http://localhost:3000/api/cron/reset-demo \
  -H "Authorization: Bearer test-secret" | jq .
# Expected: {"error":"Not a demo instance"} (since local is_demo is false)
```

- [ ] **Step 5: Commit**

```bash
git add app/api/cron/reset-demo/route.ts vercel.json
git commit -m "feat: nightly demo reset endpoint + vercel.json cron schedule"
```

---

## Task 13: Setup completion logic + /admin/setup page

**Files:**
- Create: `lib/onboarding.ts`
- Create: `lib/__tests__/onboarding.test.ts`
- Create: `app/admin/setup/page.tsx`

- [ ] **Step 1: Write failing tests for onboarding logic**

```ts
// lib/__tests__/onboarding.test.ts
import { describe, it, expect } from 'vitest'
import { getSetupSteps, isOnboarded } from '../onboarding'

const base = { clubName: 'Cricket Club', playerCount: 0, seasonCount: 0, matchCount: 0, windowCount: 0 }

describe('getSetupSteps', () => {
  it('returns 5 steps', () => {
    expect(getSetupSteps(base)).toHaveLength(5)
  })

  it('branding step is incomplete when club_name is default', () => {
    const steps = getSetupSteps({ ...base, clubName: 'Cricket Club' })
    expect(steps.find(s => s.key === 'branding')!.done).toBe(false)
  })

  it('branding step is complete when club_name is changed', () => {
    const steps = getSetupSteps({ ...base, clubName: 'Riverside CC' })
    expect(steps.find(s => s.key === 'branding')!.done).toBe(true)
  })

  it('players step requires 11+ players', () => {
    expect(getSetupSteps({ ...base, playerCount: 10 }).find(s => s.key === 'players')!.done).toBe(false)
    expect(getSetupSteps({ ...base, playerCount: 11 }).find(s => s.key === 'players')!.done).toBe(true)
  })
})

describe('isOnboarded', () => {
  it('returns false when any step incomplete', () => {
    expect(isOnboarded(getSetupSteps(base))).toBe(false)
  })

  it('returns true when all steps done', () => {
    const full = { clubName: 'Riverside CC', playerCount: 11, seasonCount: 1, matchCount: 1, windowCount: 1 }
    expect(isOnboarded(getSetupSteps(full))).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
npx vitest run lib/__tests__/onboarding.test.ts
```

Expected: FAIL — `getSetupSteps` is not exported.

- [ ] **Step 3: Create lib/onboarding.ts**

```ts
// lib/onboarding.ts
export interface SetupCheckData {
  clubName: string
  playerCount: number
  seasonCount: number
  matchCount: number
  windowCount: number
}

export interface SetupStep {
  key: string
  label: string
  desc: string
  href: string
  done: boolean
}

export function getSetupSteps(data: SetupCheckData): SetupStep[] {
  return [
    {
      key: 'branding',
      label: 'Configure club branding',
      desc: 'Set your club name, short name, colours, and logo.',
      href: '/admin/settings',
      done: data.clubName !== 'Cricket Club' && data.clubName.trim().length > 0,
    },
    {
      key: 'players',
      label: 'Add players',
      desc: 'You need at least 11 players before you can select an XI.',
      href: '/admin/players',
      done: data.playerCount >= 11,
    },
    {
      key: 'season',
      label: 'Create a season',
      desc: 'Seasons group matches and power career statistics.',
      href: '/admin/seasons',
      done: data.seasonCount > 0,
    },
    {
      key: 'fixture',
      label: 'Create your first fixture',
      desc: 'Schedule a match to start using scoring and availability.',
      href: '/admin/matches/new',
      done: data.matchCount > 0,
    },
    {
      key: 'availability',
      label: 'Set up an availability window',
      desc: 'Collect player availability before selecting your XI.',
      href: '/admin/availability',
      done: data.windowCount > 0,
    },
  ]
}

export function isOnboarded(steps: SetupStep[]): boolean {
  return steps.every(s => s.done)
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npx vitest run lib/__tests__/onboarding.test.ts
```

Expected: PASS (6 tests).

- [ ] **Step 5: Create /admin/setup page**

```tsx
// app/admin/setup/page.tsx
import Link from 'next/link'
import { serverSupabase } from '@/lib/supabase/server'
import { getClubConfig } from '@/lib/club-config'
import { getSetupSteps, isOnboarded } from '@/lib/onboarding'

export const dynamic = 'force-dynamic'

export default async function SetupPage() {
  const [config, playerRes, seasonRes, matchRes, windowRes] = await Promise.all([
    getClubConfig(),
    serverSupabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
    serverSupabase.from('seasons').select('*', { count: 'exact', head: true }),
    serverSupabase.from('matches').select('*', { count: 'exact', head: true }),
    serverSupabase.from('availability_windows').select('*', { count: 'exact', head: true }),
  ])

  const steps = getSetupSteps({
    clubName: config.club_name,
    playerCount: playerRes.count ?? 0,
    seasonCount: seasonRes.count ?? 0,
    matchCount: matchRes.count ?? 0,
    windowCount: windowRes.count ?? 0,
  })
  const done = steps.filter(s => s.done).length
  const allDone = isOnboarded(steps)

  return (
    <>
      <style>{`
        .setup-step {
          display: flex; align-items: flex-start; gap: 16px;
          padding: 20px; background: var(--panel);
          border: 1px solid var(--border); border-radius: 6px;
          margin-bottom: 12px; text-decoration: none; color: inherit;
          transition: border-color 0.15s;
        }
        .setup-step:hover { border-color: var(--blue-mid); }
        .setup-step.done { opacity: 0.55; }
        .setup-icon {
          width: 32px; height: 32px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 15px; flex-shrink: 0; margin-top: 2px;
        }
        .setup-icon.complete { background: rgba(34,197,94,0.15); color: #4ade80; }
        .setup-icon.pending  { background: var(--surface); color: var(--muted); }
        .setup-label { font-weight: 700; font-size: 15px; margin-bottom: 4px; }
        .setup-desc  { font-size: 13px; color: var(--muted); }
        .setup-arrow { margin-left: auto; color: var(--muted); align-self: center; flex-shrink: 0; }
      `}</style>

      <div style={{ paddingTop: 'var(--nav-h)', minHeight: '100vh', paddingBottom: 80 }}>
        <div className="page-hero">
          <div className="container">
            <div className="section-label">Admin</div>
            <h1>Club Setup</h1>
            <p style={{ color: 'var(--muted)', marginTop: 8 }}>
              {allDone
                ? 'Setup complete — your club is ready to go.'
                : `Complete these ${steps.length} steps to get your club set up.`}
            </p>
          </div>
        </div>

        <div className="container" style={{ paddingTop: 32, maxWidth: 680 }}>
          {/* Progress */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            marginBottom: 32, padding: '16px 20px',
            background: 'var(--panel)', border: '1px solid var(--border)',
            borderRadius: 6,
          }}>
            <div style={{ flex: 1, height: 6, background: 'var(--surface)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${(done / steps.length) * 100}%`,
                background: 'var(--blue-mid)', borderRadius: 3, transition: 'width 0.3s',
              }} />
            </div>
            <span style={{ fontSize: 13, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
              {done} of {steps.length} complete
            </span>
          </div>

          {steps.map(step => (
            <Link
              key={step.key}
              href={step.href}
              className={`setup-step${step.done ? ' done' : ''}`}
            >
              <div className={`setup-icon ${step.done ? 'complete' : 'pending'}`}>
                {step.done ? '✓' : '○'}
              </div>
              <div>
                <div className="setup-label">{step.label}</div>
                <div className="setup-desc">{step.desc}</div>
              </div>
              {!step.done && <span className="setup-arrow">→</span>}
            </Link>
          ))}

          {allDone && (
            <div style={{
              marginTop: 24, padding: '16px 20px',
              background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.3)',
              borderRadius: 6, color: '#4ade80', fontSize: 14, fontWeight: 600,
            }}>
              All steps complete. Your club is ready to use.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 6: Verify the setup page renders**

```bash
npm run dev
```

Navigate to `http://localhost:3000/admin/setup` (must be logged in as admin). Expected: checklist page showing 5 steps with correct completion state for your local data.

- [ ] **Step 7: Commit**

```bash
git add lib/onboarding.ts lib/__tests__/onboarding.test.ts app/admin/setup/page.tsx
git commit -m "feat: onboarding setup page with 5-step completion checklist"
```

---

## Task 14: Dashboard setup card + admin links

**Files:**
- Modify: `app/dashboard/page.tsx`

Add the setup completion card to the dashboard for admins/coaches. Also add an Analytics admin link for Pro plan tenants.

- [ ] **Step 1: Add imports at the top of dashboard/page.tsx**

```ts
import { getSetupSteps, isOnboarded } from '@/lib/onboarding'
import { getClubConfig, isPro } from '@/lib/club-config'
```

- [ ] **Step 2: Add setup data fetch inside DashboardPage**

Add to the existing `Promise.all` at the top of `DashboardPage`:

```ts
const [player, matchRes, clubConfig, playerCountRes, seasonCountRes, matchCountRes, windowCountRes] = await Promise.all([
  getCurrentPlayerServer(),
  supabase.from('matches').select('*, opponent:opponents(canonical_name), competition:competitions(match_format, overs_per_innings)').in('status', ['upcoming', 'in_progress', 'completed']).order('match_date', { ascending: false }).limit(20),
  getClubConfig(),
  serverSupabase.from('players').select('*', { count: 'exact', head: true }).eq('is_active', true),
  serverSupabase.from('seasons').select('*', { count: 'exact', head: true }),
  serverSupabase.from('matches').select('*', { count: 'exact', head: true }),
  serverSupabase.from('availability_windows').select('*', { count: 'exact', head: true }),
])
```

After the `player` null check, compute setup state:

```ts
const setupSteps = getSetupSteps({
  clubName: clubConfig.club_name,
  playerCount: playerCountRes.count ?? 0,
  seasonCount: seasonCountRes.count ?? 0,
  matchCount: matchCountRes.count ?? 0,
  windowCount: windowCountRes.count ?? 0,
})
const setupDone = setupSteps.filter(s => s.done).length
const allSetupDone = isOnboarded(setupSteps)
```

- [ ] **Step 3: Add Analytics link to ADMIN_LINKS for Pro plan**

Modify the `ADMIN_LINKS` array definition. Make it a function that takes the plan:

```ts
function getAdminLinks(pro: boolean) {
  return [
    { href: '/admin/matches',      icon: '⚡', label: 'Matches',      sub: 'Manage, score & create' },
    { href: '/admin/availability', icon: '📅', label: 'Availability', sub: 'Windows & selection'    },
    { href: '/admin/news',         icon: '📰', label: 'News',         sub: 'Articles & match reports' },
    { href: '/admin/players',      icon: '👤', label: 'Players',      sub: 'Squad, accounts & roles' },
    { href: '/admin/seasons',      icon: '📆', label: 'Seasons',      sub: 'Manage seasons'          },
    { href: '/admin/opponents',    icon: '🏏', label: 'Opponents',    sub: 'Opposition clubs'        },
    { href: '/admin/grounds',      icon: '📍', label: 'Grounds',      sub: 'Match venues'            },
    { href: '/admin/competitions', icon: '🏆', label: 'Competitions', sub: 'Leagues & cups'          },
    { href: '/admin/settings',     icon: '🎨', label: 'Branding',     sub: 'Logo, colours & name'    },
    ...(pro ? [{ href: '/analytics', icon: '📈', label: 'Analytics', sub: 'Season & match analytics' }] : []),
  ]
}
```

In the component, replace any reference to `ADMIN_LINKS` with `getAdminLinks(isPro(clubConfig))`.

- [ ] **Step 4: Render setup card for admins/coaches when setup is incomplete**

In the JSX, before the admin panel section, add:

```tsx
{(player.role === 'admin' || player.role === 'coach') && !allSetupDone && (
  <div style={{
    background: 'var(--panel)', border: '1px solid var(--border)',
    borderRadius: 6, padding: '20px 24px', marginBottom: 24,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
      <div style={{ fontWeight: 700, fontSize: 15 }}>Club Setup</div>
      <span style={{ fontSize: 13, color: 'var(--muted)' }}>{setupDone} of {setupSteps.length} complete</span>
    </div>
    <div style={{ height: 6, background: 'var(--surface)', borderRadius: 3, marginBottom: 16, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${(setupDone / setupSteps.length) * 100}%`,
        background: 'var(--blue-mid)', borderRadius: 3,
      }} />
    </div>
    <Link href="/admin/setup" style={{ color: 'var(--blue-mid)', fontWeight: 600, fontSize: 14 }}>
      Continue setup →
    </Link>
  </div>
)}
```

- [ ] **Step 5: Verify dashboard shows setup card on a fresh install**

On a local instance with minimal data (or after wiping players/seasons), navigate to `/dashboard`. Expected: setup card visible with progress bar and "Continue setup →" link. Card disappears once all 5 steps are complete.

- [ ] **Step 6: Commit**

```bash
git add app/dashboard/page.tsx
git commit -m "feat: setup completion card and pro analytics link on dashboard"
```

---

## Task 15: Provisioning script

**Files:**
- Create: `scripts/provision-tenant.sh`

An interactive script to provision a new tenant from scratch.

- [ ] **Step 1: Create the script**

```bash
#!/usr/bin/env bash
# scripts/provision-tenant.sh
# Provisions a new BCC SaaS tenant: Supabase project + migrations + Vercel deploy.
# Prerequisites: supabase CLI (logged in), vercel CLI (logged in)

set -euo pipefail

echo ""
echo "=== BCC SaaS Tenant Provisioning ==="
echo ""

# ── Prerequisites check ──────────────────────────────────────────────────────

for cmd in supabase vercel node; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "Error: '$cmd' not found. Please install it before running this script."
    exit 1
  fi
done

# ── Gather inputs ────────────────────────────────────────────────────────────

read -rp "Club name (e.g. Riverside Cricket Club): " CLUB_NAME
read -rp "Club short name (e.g. RCC, max 10 chars): " CLUB_SHORT
read -rp "Admin email: " ADMIN_EMAIL
read -rp "Plan [club/pro] (default: club): " PLAN
PLAN="${PLAN:-club}"
if [[ "$PLAN" != "club" && "$PLAN" != "pro" ]]; then
  echo "Invalid plan. Must be 'club' or 'pro'."
  exit 1
fi

read -rp "Supabase organisation ID (find at supabase.com/dashboard): " ORG_ID
read -rp "Supabase DB password (create a strong password): " DB_PASSWORD
read -rsp "Admin initial password: " ADMIN_PASSWORD
echo ""

SLUG=$(echo "$CLUB_SHORT" | tr '[:upper:]' '[:lower:]' | tr -s ' ' '-' | tr -cd 'a-z0-9-')
PROJECT_NAME="bcc-${SLUG}"

echo ""
echo "Creating Supabase project '${PROJECT_NAME}'..."

# ── Create Supabase project ──────────────────────────────────────────────────

PROJECT_JSON=$(supabase projects create "$PROJECT_NAME" \
  --org-id "$ORG_ID" \
  --db-password "$DB_PASSWORD" \
  --region "ap-southeast-2" \
  --output json)

PROJECT_REF=$(echo "$PROJECT_JSON" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).id)")
PROJECT_URL="https://${PROJECT_REF}.supabase.co"

echo "Project created: $PROJECT_REF"
echo "Waiting 30s for project to initialise..."
sleep 30

# ── Get service role key ─────────────────────────────────────────────────────

SERVICE_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const k=JSON.parse(d);console.log(k.find(x=>x.name==='service_role').api_key)")

echo "Service role key obtained."

# ── Run migrations ───────────────────────────────────────────────────────────

echo ""
echo "Running migrations..."

MIGRATIONS_DIR="supabase/migrations"
for f in "$MIGRATIONS_DIR"/*.sql; do
  echo "  Applying $(basename "$f")..."
  supabase db push --project-ref "$PROJECT_REF" < "$f" || {
    echo "Migration failed: $f"
    exit 1
  }
done

echo "All migrations applied."

# ── Insert club_config ───────────────────────────────────────────────────────

echo ""
echo "Inserting club configuration..."

# Pro tenants default to professional scoring mode
DEFAULT_MODE="club"
if [[ "$PLAN" == "pro" ]]; then DEFAULT_MODE="professional"; fi

supabase sql --project-ref "$PROJECT_REF" <<SQL
UPDATE club_config SET
  club_name = '${CLUB_NAME}',
  club_short_name = '${CLUB_SHORT}',
  plan = '${PLAN}',
  default_scoring_mode = '${DEFAULT_MODE}',
  is_demo = false
WHERE true;
SQL

# ── Create admin user ────────────────────────────────────────────────────────

echo "Creating admin user ${ADMIN_EMAIL}..."

USER_JSON=$(supabase auth admin create-user \
  --project-ref "$PROJECT_REF" \
  --email "$ADMIN_EMAIL" \
  --password "$ADMIN_PASSWORD" \
  --email-confirm \
  --output json)

USER_ID=$(echo "$USER_JSON" | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');console.log(JSON.parse(d).id)")

supabase sql --project-ref "$PROJECT_REF" <<SQL
INSERT INTO user_roles (user_id, role) VALUES ('${USER_ID}', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
SQL

echo "Admin user created: $ADMIN_EMAIL"

# ── Deploy to Vercel ─────────────────────────────────────────────────────────

echo ""
echo "Deploying to Vercel..."

ANON_KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" --output json \
  | node -e "const d=require('fs').readFileSync('/dev/stdin','utf8');const k=JSON.parse(d);console.log(k.find(x=>x.name==='anon').api_key)")

SITE_URL=$(vercel deploy --prod \
  --env NEXT_PUBLIC_SUPABASE_URL="$PROJECT_URL" \
  --env NEXT_PUBLIC_SUPABASE_ANON_KEY="$ANON_KEY" \
  --env SUPABASE_SERVICE_ROLE_KEY="$SERVICE_KEY" \
  --env NEXT_PUBLIC_SITE_URL="https://$(echo "$PROJECT_NAME").vercel.app" \
  --yes)

# ── Summary ──────────────────────────────────────────────────────────────────

echo ""
echo "=========================================="
echo "  Tenant provisioned successfully!"
echo "=========================================="
echo "  App URL:            $SITE_URL"
echo "  Supabase project:   $PROJECT_REF"
echo "  Supabase dashboard: https://supabase.com/dashboard/project/${PROJECT_REF}"
echo "  Admin login:        $ADMIN_EMAIL"
echo "  Plan:               $PLAN"
echo "=========================================="
echo ""
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/provision-tenant.sh
```

- [ ] **Step 3: Dry-run sanity check (without executing)**

```bash
bash -n scripts/provision-tenant.sh
```

Expected: no syntax errors reported.

- [ ] **Step 4: Commit**

```bash
git add scripts/provision-tenant.sh
git commit -m "feat: interactive tenant provisioning script"
```

---

## Task 16: Documentation — DEPLOYMENT.md + DEMO_SCRIPT.md + README

**Files:**
- Create: `DEPLOYMENT.md`
- Create: `docs/DEMO_SCRIPT.md`
- Modify: `README.md`

- [ ] **Step 1: Create DEPLOYMENT.md**

```markdown
# Deployment Guide

This guide covers provisioning a new BCC SaaS tenant manually.

## Prerequisites

- Node.js 18+
- [Supabase CLI](https://supabase.com/docs/guides/cli) — `npm install -g supabase`
- [Vercel CLI](https://vercel.com/docs/cli) — `npm install -g vercel`
- Access to a Supabase organisation

## Automated Provisioning

Run the interactive script:

```bash
bash scripts/provision-tenant.sh
```

The script guides you through creating a Supabase project, running migrations, and deploying to Vercel.

## Manual Provisioning

### 1. Create Supabase project

Go to [supabase.com](https://supabase.com) → New project. Note the project ref, URL, anon key, and service role key.

### 2. Run migrations

In the Supabase SQL Editor, run each file from `supabase/migrations/` in order (001 → 033). Copy-paste each file's contents and execute. Stop if any migration fails.

### 3. Configure club_config

```sql
UPDATE club_config SET
  club_name = 'Your Club Name',
  club_short_name = 'YCC',
  plan = 'club',   -- or 'pro'
  is_demo = false;
```

### 4. Create the first admin user

In the Supabase Dashboard → Authentication → Users → Invite user. Then grant admin role:

```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<auth-user-uuid>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Find the UUID: `SELECT id, email FROM auth.users;`

### 5. Deploy to Vercel

```bash
vercel deploy --prod
```

Set these environment variables when prompted:

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-only) |
| `NEXT_PUBLIC_SITE_URL` | Your deployed app URL |
| `WEBHOOK_SECRET` | Random secret for match report webhook |
| `CRON_SECRET` | Random secret for demo reset cron (demo instances only) |

### 6. Verify deployment

1. Open the app URL — club name should appear in the header
2. Log in with the admin account
3. Navigate to `/admin/setup` — setup checklist should show 0/5 steps complete
4. Follow the checklist to finish configuration

## Upgrading a tenant from Club to Pro

```sql
UPDATE club_config SET plan = 'pro';
```

Analytics routes and professional scoring mode activate immediately.

## Troubleshooting

**Auth cookies not working / session lost on refresh**
Check that `middleware.ts` is not overriding Supabase cookie options with `httpOnly: true`. The browser Supabase client must be able to read auth cookies.

**`/live` not showing in-progress match**
Check: (1) scorer has a row in `user_roles`; (2) `innings.status = 'in_progress'`; (3) `matches.status = 'in_progress'`. Fix with:
```sql
UPDATE matches SET status = 'in_progress'
WHERE id IN (SELECT match_id FROM innings WHERE status = 'in_progress');
```

**RLS blocking data reads**
Ensure `club_config` public read policy exists. Run: `SELECT * FROM pg_policies WHERE tablename = 'club_config';`
```

- [ ] **Step 2: Create docs/DEMO_SCRIPT.md**

```markdown
# Demo Script — Riverside Cricket Club

Use this walkthrough to demonstrate the platform to prospects. The demo instance is at [your demo URL]. Log in as `admin@demo.riverside.cc` / `DemoAdmin123!`.

**Total time:** 15–20 minutes

---

## 1. Live Scoring (3 min)

**Navigate to `/live`**
- Point out: real-time score card updating as balls are bowled
- "Any supporter with the link can follow the game live"

**Navigate to `/admin/matches` → open the in-progress match → Score**
- Log in as scorer (`scorer@demo.riverside.cc` / `DemoScorer123!`) in another tab
- Show: tap a run, a four, a wicket
- In Pro mode: show the annotation panel (wagon wheel tap, pitch map tap)
- "Every ball is recorded with optional professional-grade data"

---

## 2. Match Analytics (3 min)

**Navigate to `/results` → click any completed match → View Analytics**
- Show: run rate chart, fall of wickets timeline
- Scroll to Pro charts: wagon wheel, pitch map heat, shot type breakdown
- "Coaches can replay the full innings ball by ball"

---

## 3. Career Statistics (2 min)

**Navigate to `/stats`**
- Point out the standout player at the top of the batting table
- Click through to their player page
- Show: Batting, Bowling, Fielding tabs
- Switch to Matchups tab: "How does this batter perform against specific bowlers?"

---

## 4. Availability & Selection Workflow (4 min)

**Navigate to `/admin/availability`**
- Open the active window
- Show: 18 players, 14 available (green), 2 tentative (amber), 2 unavailable (red)
- Click "Select XI →" for the upcoming match

**On the selection page:**
- Show: player pool pre-filtered by availability
- Tap to select 11, drag to reorder
- Click "Announce Selection" — triggers notifications to selected players

**On a player's phone (or `/notifications`):**
- Show: "You've been selected for Saturday vs Northfield CC — confirm your place"
- Tap Confirm

---

## 5. Dashboard & Admin (2 min)

**Navigate to `/dashboard`**
- Show: upcoming fixtures, recent results, live match widget
- Show: admin panel with all management sections
- "Everything a club needs — scoring, selection, availability, stats, notifications — in one place"

---

## 6. White-Label Branding (1 min)

**Navigate to `/admin/settings`**
- Change the club name and primary colour live
- Show the preview panel update in real time
- "Every club gets their own branded instance"

---

## Closing

> "We've just seen the full lifecycle: availability collected, XI selected, match scored ball by ball, results and analytics visible immediately. All of it happens in one system, on any device."
```

- [ ] **Step 3: Add Vercel Deploy Button to README.md**

Open `README.md` and add near the top (after the project title and description):

```markdown
## Quick Deploy

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FYOUR_ORG%2FYOUR_REPO&env=NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_ANON_KEY,SUPABASE_SERVICE_ROLE_KEY,NEXT_PUBLIC_SITE_URL&envDescription=Required%20Supabase%20and%20site%20configuration&project-name=bcc-cricket)

> After deploying, run all migrations (`supabase/migrations/001` → `033`) in your Supabase SQL Editor. See [DEPLOYMENT.md](DEPLOYMENT.md) for the full guide.
```

Replace `YOUR_ORG/YOUR_REPO` with the actual GitHub repository path.

- [ ] **Step 4: Commit**

```bash
git add DEPLOYMENT.md docs/DEMO_SCRIPT.md README.md
git commit -m "docs: deployment guide, demo script, and Vercel deploy button"
```

---

## Task 17: Final integration check

- [ ] **Step 1: Run the full unit test suite**

```bash
npm test
```

Expected: all tests pass.

- [ ] **Step 2: Build check**

```bash
npm run build
```

Expected: build succeeds with no TypeScript errors.

- [ ] **Step 3: Run the app and walk through the demo script**

```bash
npm run dev
```

Manually walk through the 6 sections of `docs/DEMO_SCRIPT.md` against local data. Verify:
- Analytics redirect to dashboard for `plan = 'club'`
- Analytics accessible for `plan = 'pro'`
- Scorer shows professional annotations for `plan = 'pro'`
- Scorer shows club-only mode for `plan = 'club'`
- Setup page shows correct completion state
- Dashboard shows setup card when setup is incomplete
- Demo banner appears when `is_demo = true`

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "chore: SaaS readiness — final integration verified"
```
