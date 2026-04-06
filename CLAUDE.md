# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Bedfordview Cricket Club (BCC) web app — a Next.js 15 + Supabase platform for managing cricket matches, live scoring, player stats, and club membership.

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server at http://localhost:3000
npm run build      # Production build
npm run start      # Start production server
npm run lint       # Run ESLint
npm test           # Run engine unit tests (vitest)
```

## Environment Setup

Copy `.env.local.example` to `.env.local` and fill in:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` (server-side only)
- `NEXT_PUBLIC_SITE_URL`

Run `supabase/migrations/001_initial_schema.sql` in the Supabase SQL Editor to set up the schema and RLS policies.

### Granting admin access
Roles are stored in the **`user_roles` table** (not `players`). The RLS `has_role()` function checks `user_roles` exclusively. To grant admin:
```sql
INSERT INTO user_roles (user_id, role)
VALUES ('<auth-user-uuid>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```
Find the UUID via: `SELECT id, email FROM auth.users;`

Do NOT use `UPDATE players SET role = ...` — the `players` table has no `role` or `email` column and has no effect on permissions.

### Fixing match status for in-progress matches
If `matches.status` is stuck as `upcoming` while scoring is active:
```sql
UPDATE matches SET status = 'in_progress'
WHERE id IN (SELECT match_id FROM innings WHERE status = 'in_progress');
```

## Architecture

**Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase (PostgreSQL + Auth + Realtime)

**Key lib files:**
- `lib/supabase/client.ts` — browser Supabase client
- `lib/supabase/server.ts` — server/service role client
- `lib/supabase/realtime.ts` — typed Realtime channel helpers
- `lib/cricket/types.ts` — BallEvent, MatchPlayer, InningsState etc.
- `lib/cricket/engine.ts` — computeInningsState, computeStrikeAfterBall, totalBallRuns, bowlerRuns
- `lib/cricket/validators.ts` — validateBall (shared client+edge)
- `lib/cricket/phases.ts` — detectPhase (scorer UI state machine)
- `lib/offline/queue.ts` — Dexie IndexedDB queue with memory fallback
- `lib/supabase.ts` — legacy compat re-exports
- `lib/queries.ts` — legacy query helpers normalising new schema to old shape

**Data flow:** Server components use `async/await` Supabase queries directly; client components use Supabase client in `useEffect`. Public pages use ISR (`revalidate: 60–300`). No custom API routes — all queries go through Supabase client.

**Auth & roles:** Supabase Auth (email/password). Roles: `scorer`, `admin`. Stored in `user_roles` table. RLS `has_role()` function checks `user_roles` — admin implies scorer. Helper functions `getCurrentPlayerServer()`, `isScorer()`, `isAdmin()` in app code. Protected routes use client-side guards.

**Database tables:** `players`, `matches`, `innings`, `ball_events`, `match_players`, `opponents`, `competitions`, `seasons`, `grounds`, `user_roles`, `audit_log`. Views `career_batting_stats` and `career_bowling_stats` aggregate per-player stats.

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
- `/squad` — Player grid
- `/live` — **Live scores page** — polls every 30s, queries `innings.status = 'in_progress'` (not `matches.status`), shows score and chasing target
- `/matches/[id]` — Real-time public scorecard (Supabase Realtime + polling fallback)
- `/login`, `/register` — Auth pages

### Admin (require scorer/admin role)
- `/dashboard` — Member hub: live match, upcoming fixtures, recent results, admin panel, profile
- `/admin/matches` — Match list with Score/View/Delete actions
- `/admin/matches/new` — Create fixture
- `/admin/matches/[id]/score` — **Scorer interface** (ScorerShell)
- `/admin/players` — Player management
- `/admin/seasons` — Season management
- `/admin/users` — User role assignment
- `/admin/opponents` — Opposition clubs
- `/admin/competitions` — Leagues & cups

### Redirects
- `/match/[id]/live` → `/matches/[id]`
- `/match/[id]/score` → `/admin/matches/[id]/score`

## Scorer Shell (`components/scorer/ScorerShell.tsx`)

Phase state machine driven by `lib/cricket/phases.ts`:
`setup_bcc_xi` → `setup_opp_xi` → `captain_keeper` → `toss` → `select_openers` → `scoring` → `innings_break` → `match_complete`

**Critical:** When "Start Scoring" is clicked for innings 1, the scorer:
1. Creates `innings` row with `status = 'in_progress'`
2. Updates `matches.status = 'in_progress'` (required for live page)

Both require the user to have a row in `user_roles`. `matches` write requires `admin` role; `innings` write requires `admin` role; `ball_events` insert/delete allows `scorer` role.

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
- `vitest`, `@vitejs/plugin-react` — test framework
