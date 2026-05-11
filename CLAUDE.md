# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bedfordview Cricket Club (BCC) web app — a Next.js 15 + Supabase platform for managing cricket matches, live scoring, player stats, club membership, availability tracking, team selection, and notifications.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm test           # Run all unit tests (vitest)
npx vitest run lib/cricket/__tests__/engine.test.ts   # Run a single test file
npm run test:e2e          # Run Playwright e2e tests (headless)
npm run test:e2e:ui       # Run Playwright e2e tests with UI
npm run test:e2e:report   # Show last Playwright report
```

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `NEXT_PUBLIC_SITE_URL`

Run migrations in order in the Supabase SQL Editor:
1. `supabase/migrations/001_initial_schema.sql`
2. `supabase/migrations/013_identity_bridge.sql`
3. `supabase/migrations/014_availability_selection.sql`
4. `supabase/migrations/015_notifications.sql`
5. `supabase/migrations/016_attended_flag.sql`
6. `supabase/migrations/017_reliability_view.sql`
7. `supabase/migrations/018_fix_selection_rls.sql`

### Granting roles
Roles are stored in the **`user_roles` table** (not `players`). The `has_role()` DB function checks `user_roles` with hierarchy: `admin > coach > scorer > shop > player`. To grant a role:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<auth-user-uuid>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```
Find the UUID via: `SELECT id, email FROM auth.users;`

Do NOT use `UPDATE players SET role = ...` — the `players` table has no `role` column.

### Fixing match status for in-progress matches
If `matches.status` is stuck as `upcoming` while scoring is active:
```sql
UPDATE matches SET status = 'in_progress'
WHERE id IN (SELECT match_id FROM innings WHERE status = 'in_progress');
```

## Architecture

**Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (PostgreSQL + Auth + Realtime + Edge Functions)

**Key lib files:**
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server/service role client
- `lib/supabase/realtime.ts` — typed Realtime channel helpers
- `lib/cricket/types.ts` — BallEvent, MatchPlayer, InningsState, Role etc.
- `lib/cricket/engine.ts` — computeInningsState, computeStrikeAfterBall, totalBallRuns, bowlerRuns
- `lib/cricket/validators.ts` — validateBall (shared client+edge)
- `lib/cricket/phases.ts` — detectPhase (scorer UI state machine)
- `lib/cricket/commentary.ts` — ball-by-ball commentary generator
- `lib/cricket/reportGenerator.ts` — match report text generation
- `lib/offline/queue.ts` — Dexie IndexedDB queue with memory fallback
- `lib/scoring-lock.ts` — optimistic lock for multi-scorer concurrency (acquireLock, renewLock, releaseLock, initiateHandover, acceptHandover)
- `lib/stats/formatters.ts` — shared stat formatters: overs(), fmt(), bestFigures(), formatDate()
- `lib/stats/types.ts` — TypeScript types for stats views
- `lib/supabase.ts` — legacy compat re-exports (Player type, isAdmin, isScorer, getCurrentPlayer)
- `lib/supabase-server.ts` — `getCurrentPlayerServer()` — fetches user + linked player + highest-privilege role
- `lib/queries.ts` — legacy query helpers normalising new schema to old shape

**Data flow:** Server components use `async/await` Supabase queries directly; client components use Supabase client in `useEffect`. Public pages use ISR (`revalidate: 60–300`). API routes exist for privileged server-side operations that require the service role key (role assignment, player creation, order management).

**Auth & roles:** Supabase Auth (email/password). Role hierarchy: `admin > coach > scorer > shop > player > member`. Stored in `user_roles` table. `has_role()` DB function enforces hierarchy. `getCurrentPlayerServer()` returns the highest-privilege role and linked player record (if claimed).

**Middleware (`middleware.ts`):** Runs on all non-static routes. Calls `supabase.auth.getUser()` to refresh expired sessions and write updated cookies. Does not enforce route protection — that happens in `app/admin/layout.tsx` and individual server components.

**Database tables (core):** `players`, `matches`, `innings`, `ball_events`, `match_players`, `opponents`, `competitions`, `seasons`, `grounds`, `user_roles`, `audit_log`

**Database tables (new):**
- `availability_windows` — weekend windows for availability collection (no category — that comes from each match's competition)
- `player_availability` — player responses (available / unavailable / tentative) per window
- `selections` — coach XI selections per match; UNIQUE(match_id, player_id)
- `notifications` — in-app notifications with `idempotency_key TEXT UNIQUE` to prevent duplicates

**Scoring lock fields on `matches`:** `scorer_session_id`, `scorer_locked_at`, `scorer_user_id`, `pending_handover_to`, `pending_handover_at`. Lock TTL is 2 minutes; heartbeat every 30s. Uses `acquire_scoring_lock` RPC to avoid a PostgREST bug with `.or()` on UPDATE.

**Database functions:**
- `has_role(user_uuid, required_role)` — hierarchy-aware role check (use in RLS policies)
- `current_player_id()` — returns `players.id` for the current auth user
- `acquire_scoring_lock(p_match_id, p_session_id, p_user_id)` — atomic lock acquisition

**Views:**
- `career_batting_stats`, `career_bowling_stats` — per-player career aggregates
- `player_reliability` — availability_rate + commitment_rate per player per season

## Identity Bridge (players ↔ auth.users)

`players.user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL` links cricket identities to login accounts. Players claim their profile via `/admin/profile/claim`. Until claimed, `player_id` is null in session data. The scorer, availability, and selection pages all work without a claim — claiming just unlocks personal dashboards.

## Styling

**Design system:** Deep navy background (`#050c1a`), blue accent (`#2563eb`, `#3b82f6`), sky highlight (`#38bdf8`). Fonts: `Syne` (display/headings) + `Outfit` (body) via Google Fonts. Full-page blue mesh grid via `body::before`. CSS variables in `app/globals.css` `:root`. Utility classes (`.btn`, `.badge`, `.card`, `.table`, `.container`, `.grid-*`) defined globally. Page-specific styles use scoped `<style>` tags. Mobile-first, breakpoints at 768px/900px.

**Legacy alias:** `--lime` is mapped to `--blue-mid` in globals.css to avoid breaking scorer components that still reference it.

## Routes

### Public
- `/` — Homepage with hero, upcoming fixtures preview, results preview, CTA
- `/fixtures` — Upcoming matches grouped by month
- `/results` — Completed matches list
- `/results/[id]` — Full match scorecard (innings, batting, bowling, FoW)
- `/stats` — Career batting and bowling tables
- `/stats/[id]` — Individual player career stats
- `/squad` — Player grid
- `/live` — **Live scores page** — polls every 30s, queries `innings.status = 'in_progress'` (not `matches.status`), shows score and chasing target
- `/matches/[id]` — Real-time public scorecard (Supabase Realtime + polling fallback)
- `/(public)/news` — Club news articles
- `/(public)/membership` — Membership purchase
- `/(public)/shop` — Club shop
- `/gallery`, `/contact` — Static content pages
- `/junior/fixtures`, `/junior/results`, `/junior/stats` — Junior section equivalents
- `/analytics` — Match analytics and charts
- `/login`, `/register` — Auth pages

### Admin (require scorer/admin/coach/shop role — enforced in `app/admin/layout.tsx`)
- `/admin/matches` — Match list with Score/View/Delete actions
- `/admin/matches/new` — Create fixture
- `/admin/matches/[id]/score` — **Scorer interface** (ScorerShell) — pre-populated from coach selections
- `/admin/matches/[id]/select` — **Coach XI selection** — filter by competitions.category, override modal for unavailable players
- `/admin/players` — Player management
- `/admin/seasons` — Season management
- `/admin/users` — User role assignment
- `/admin/opponents` — Opposition clubs
- `/admin/competitions` — Leagues & cups
- `/admin/availability` — Availability windows list + create
- `/admin/availability/[id]` — Window detail: player responses + linked matches with "Select XI →" per match
- `/admin/news` — News article management
- `/admin/orders` — Order management
- `/admin/products` — Shop product management
- `/admin/profile/claim` — Link auth account to player record

### Player-facing
- `/availability/[windowId]` — 2-tap availability submission (available / tentative / unavailable + optional note)
- `/selection/[matchId]` — 1-tap selection confirmation, team list, withdraw flow
- `/notifications` — Full notification feed with mark-read and real-time updates

### Dashboard
- `/dashboard` — Member hub: live match, upcoming fixtures, recent results, admin panel, profile

### Redirects
- `/match/[id]/live` → `/matches/[id]`
- `/match/[id]/score` → `/admin/matches/[id]/score`

### Notification Bell
`components/NotificationBell.tsx` — fixed top-right on admin pages. Subscribes to `notifications` table via Realtime. Links to `/notifications`.

### API Routes
All require a Bearer token + admin role check (except `/api/auth/register`):
- `POST /api/admin/set-role` — assign scorer/admin role; writes to `user_roles` + `audit_log`
- `POST /api/admin/create-player` — create a new player record
- `POST /api/auth/register` — public registration
- `GET /api/match-report/[id]` — generate text match report
- `GET/POST /api/orders` — order creation and listing
- `POST /api/orders/[id]/confirm` — confirm an order
- `GET /api/orders/export` — CSV export of orders
- `GET/PUT/DELETE /api/products/[id]` — product management
- `POST /api/on-selection-announced` — proxy to edge function (also callable directly)

## Edge Functions

All in `supabase/functions/`. Deploy via `supabase functions deploy <name>`.

| Function | Trigger | Purpose |
|----------|---------|---------|
| `on-availability-window-created` | DB Webhook: `availability_windows INSERT` | Notifies ALL active players with user_id |
| `on-selection-announced` | HTTP POST from coach UI | Notifies selected players; returns 207 on partial failure |
| `on-match-completed` | DB Webhook: `matches UPDATE WHERE status='completed'` | Notifies attendees; marks non-attendees as did_not_play |
| `on-order-paid` | DB Webhook: `orders UPDATE WHERE status='paid'` | Creates membership, assigns player role, notifies user |
| `availability-deadline-reminder` | pg_cron `0 18 * * *` or Vercel cron | Reminds non-responders 24h before deadline |
| `validate-ball` | HTTP POST from scorer | Server-side ball validation (mirrors `lib/cricket/validators.ts`) |
| `refresh-stats` | HTTP POST | Manually trigger stats view refresh |

All notifications use `idempotency_key TEXT UNIQUE` in format `{type}:{entity_id}:{user_id}` to prevent duplicates on retry.

## Scorer Shell (`components/scorer/ScorerShell.tsx`)

Phase state machine driven by `lib/cricket/phases.ts`:
`setup_bcc_xi` → `setup_opp_xi` → `captain_keeper` → `toss` → `select_openers` → `scoring` → `innings_break` → `match_complete`

**Pre-population from selections:** If coach has selected an XI via `/admin/matches/[id]/select`, the scorer page loads `selections` first and pre-checks those 11 players. Falls back to full active player list for legacy matches with no selections.

**Critical:** When "Start Scoring" is clicked for innings 1, the scorer:
1. Creates `innings` row with `status = 'in_progress'`
2. Updates `matches.status = 'in_progress'` (required for live page)

Both require the user to have a row in `user_roles`. `matches` write requires `admin` role; `innings` write requires `admin` role; `ball_events` insert/delete allows `scorer` role.

**Scoring lock:** Only one session can score at a time. `lib/scoring-lock.ts` manages the lock via the `matches` table fields. A HandoverModal lets the current scorer transfer control to another user without losing state.

## Availability & Selection Flow

1. **Coach creates window** → `availability_windows` row → Edge function notifies all active players
2. **Players submit** → `/availability/[windowId]` → `player_availability` rows (RLS blocks after deadline)
3. **Coach views window** → `/admin/availability/[id]` → sees summary by category, linked matches
4. **Coach selects XI** → `/admin/matches/[id]/select` → `selections` rows per match (player pool filtered by `competitions.category`)
5. **Coach announces** → `on-selection-announced` called → notifies selected players
6. **Players confirm** → `/selection/[matchId]` → `selections.confirmed_at` set
7. **Scorer opens match** → XI pre-populated from `selections WHERE status='selected'`

## Live Page Notes

`/live` queries `innings.status = 'in_progress'` (not `matches.status`) so it works even if the match row wasn't updated. If a match shows in DB with innings in_progress but not on the live page, check:
1. Is there a row in `user_roles` for the scorer? (`SELECT * FROM user_roles`)
2. Is `innings.status = 'in_progress'`? (run the diagnostic SQL above)
3. Wait up to 30s for the auto-refresh poll

## Key Cricket Logic

- `totalBallRuns(ball)` = runs_off_bat + extras_runs
- `bowlerRuns(ball)` = 0 for bye/leg_bye/penalty; runs_off_bat + extras_runs for wide/no_ball
- `isLegalDelivery(ball)` = NOT (wide OR no_ball)
- End-of-over swap + odd runs = net cancel (original striker faces next over)
- `nextBallIsFreeHit` = last ball was a no_ball
- Bye breaks a maiden

## Dependencies

- `dexie` — IndexedDB wrapper for offline queue
- `swr` — React data fetching (available)
- `vitest`, `@vitejs/plugin-react` — unit test framework
- `@playwright/test` — e2e test framework
