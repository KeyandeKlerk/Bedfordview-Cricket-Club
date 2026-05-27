# Bedfordview Cricket Club — Web App

A full-featured cricket club management platform built with Next.js 15 and Supabase. Covers live scoring, player stats, analytics, team selection, availability tracking, membership, shop, and notifications.

---

## Prerequisites

- Node.js 18+
- Supabase account (free at supabase.com)
- Vercel account (free at vercel.com)

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_SITE_URL`

### 3. Run migrations

In the Supabase SQL Editor, run all files in `supabase/migrations/` in numeric order (001 → 031).

### 4. Grant admin access

After registering, find your auth UUID and insert a role:

```sql
SELECT id, email FROM auth.users;

INSERT INTO user_roles (user_id, role)
VALUES ('<your-uuid>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

### 5. Run locally

```bash
npm run dev
```

Open http://localhost:3000

### 6. Deploy

```bash
npx vercel
```

Add the same environment variables in the Vercel dashboard.

---

## What's built

### Scoring
- **Club mode** — streamlined ball-by-ball scoring, no extra input required
- **Professional mode** — post-ball annotation panel (wagon wheel, pitch map, shot type, bowling type, quality ratings) with full offline support via IndexedDB queue
- Scoring lock — only one session can score at a time; HandoverModal transfers control without losing state
- Free hit, DLS, penalty runs, no-ball/wide crossing logic, undo
- Pre-populated XI from coach selections

### Analytics
- **Match analytics** (`/analytics/match/[id]`) — run rate chart, fall of wickets, partnerships, required rate, phase breakdown (powerplay/middle/death)
- **Player stats** (`/stats/[id]`) — career batting/bowling/fielding, season-by-season tables, matchups, head-to-head, phase splits, scoring intent, dismissal analysis
- **Tier 2 professional charts** — wagon wheel scatter plot, pitch map heatmap, shot type breakdown, quality score panel (shown when professional data is present)
- Seven analytics SQL views: `batter_bowler_matchups`, `phase_batting_stats`, `phase_bowling_stats`, `partnership_stats`, `dismissal_analysis`, `scoring_intent`, `bowling_pair_stats`

### Club management
- Availability windows — collect player availability per weekend; edge function notifies all active players
- Coach XI selection — filter by competition category, override unavailable players, announce to squad
- Player confirmations — 1-tap accept/withdraw via `/selection/[matchId]`
- Notifications — real-time in-app feed with idempotency-keyed deduplication
- Membership purchase and order management
- Club shop with product management
- News articles

### Public pages
- Live scores (`/live`) — polls every 30s
- Real-time scorecard (`/matches/[id]`) — Supabase Realtime + polling fallback
- Fixtures, results, full scorecards, squad, junior section equivalents
- Career stats tables and individual player profiles

---

## Commands

```bash
npm run dev          # Dev server at http://localhost:3000
npm run build        # Production build
npm run lint         # ESLint
npm test             # Unit tests (vitest)
npm run test:e2e     # Playwright e2e tests
```

---

## Key directories

```
app/
  admin/              ← Scorer, match management, player admin, settings
  analytics/          ← Match analytics + overview charts
  stats/[id]/         ← Individual player stats (5 tabs including Matchups + Advanced)
  matches/[id]/       ← Real-time public scorecard
  live/               ← Live scores list
  results/[id]/       ← Full match scorecard
  junior/             ← Junior section fixtures/results/stats

components/
  scorer/             ← ScorerShell + all scoring sub-components
  scorer/professional/← Annotation panel, wagon wheel, pitch map, shot/bowling pickers
  analytics/charts/   ← SVG chart components (run rate, wagon wheel, heatmap, etc.)
  layout/             ← SessionGuard, nav, notification bell

lib/
  cricket/            ← engine, validators, phases, types, commentary, DLS
  offline/queue.ts    ← Dexie IndexedDB queue + annotation queuing
  scoring-lock.ts     ← Optimistic scoring lock
  stats/              ← Formatters and TypeScript types for stats views

supabase/
  migrations/         ← 031 migrations (run in order)
  functions/          ← Edge functions for notifications, validation, stats refresh
```
