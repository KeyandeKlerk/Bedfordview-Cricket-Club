# SaaS Readiness Design

**Date:** 2026-05-28  
**Status:** Approved  
**Author:** Keyan de Klerk

## Overview

This document describes the changes required to make the Bedfordview Cricket Club (BCC) web app a commercially deployable SaaS product. Each customer (club, academy, or association) gets their own Supabase project + Vercel deployment. Billing, pricing pages, and tenant provisioning live outside this repository. This spec covers what changes inside the app itself.

The work is split into four areas:

1. Feature tier gating (Club vs Pro plan)
2. Demo environment with realistic seed data
3. Deployment automation for provisioning new tenants
4. In-app onboarding wizard for new club admins

---

## 1. Feature Tier Gating

### Data Model

Add a `plan` column to the existing `club_config` table (migration `032`):

```sql
ALTER TABLE club_config
  ADD COLUMN plan TEXT NOT NULL DEFAULT 'club'
    CHECK (plan IN ('club', 'pro'));
```

`club_config` is already the single row that controls per-tenant configuration. `plan` lives here alongside branding.

### Plan Definitions

**Club tier** — all core functionality:
- Club-mode scoring (ball-by-ball, standard extras, wickets)
- Availability tracking and team selection workflow
- Notifications
- Basic stats (career batting and bowling tables, individual player stats)
- Public pages (fixtures, results, scorecards, squad, live scores)
- Shop and membership

**Pro tier** — everything in Club, plus:
- Professional scoring mode (wagon wheel, pitch map, shot type, bowling type, quality annotations, RHB/LHB toggle)
- Advanced analytics (`/analytics`, `/analytics/match/[id]` pro charts: wagon wheel, pitch map, phase breakdown, matchups, partnerships, dismissal analysis, scoring intent)
- Match reports (`/api/match-report/[id]`)

### Implementation

**`lib/club-config.ts`** — new server-side module. Exports `getClubConfig()` which fetches the `club_config` row and returns typed config including `plan`. All server components and API routes that need the plan check call this function. Avoids scattered direct Supabase queries for config.

**ScorerShell** — if `plan === 'club'`, the scoring mode is forced to `'club'` and the professional mode toggle never renders. The match's `scoring_mode` column is ignored; the plan takes precedence.

**Analytics routes** — `/analytics` and `/analytics/match/[id]` are server components. They call `getClubConfig()` and, if `plan === 'club'`, render an upgrade prompt card instead of the charts. Navigation to these pages still works — prospects on a trial can see that the feature exists.

**Match report API** — `GET /api/match-report/[id]` returns `403` with `{ error: "Match reports are available on the Pro plan" }` if `plan === 'club'`.

**Upgrade prompts** — a shared `<UpgradePrompt feature="..." />` component renders a card with the feature name and a contact line ("To upgrade to Pro, contact [configured email]"). No pop-ups, no paywalls on navigation.

---

## 2. Demo Environment

### Purpose

A live hosted instance that tells a complete mid-season story, ready to walk any prospect through the full platform in a single sitting. The demo is on the Pro plan so all features are visible.

### New `club_config` column

```sql
ALTER TABLE club_config
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false;
```

When `true`, a subtle non-intrusive banner renders at the top of every page: "You're viewing a demo — data resets nightly."

### Seed Script

**`scripts/seed-demo.ts`** — a single runnable TypeScript script (via `npx tsx`) that wipes and rebuilds all demo data. Safe to run repeatedly. Uses the service role key.

**Data created:**

| Entity | Count | Notes |
|--------|-------|-------|
| Club config | 1 | "Riverside Cricket Club", Pro plan, `is_demo: true` |
| Players | 18 | Realistic names, mix of batters/bowlers/all-rounders |
| Season | 1 | Current year, active |
| Competition | 2 | A league and a cup |
| Completed matches | 12 | Full ball-by-ball data; enough to populate all 7 analytics views |
| Upcoming fixtures | 2 | With opponents and grounds set |
| Availability window | 1 | All 18 players have responded |
| Coach selection | 1 | XI selected for next upcoming match, announced |
| In-progress match | 1 | Partial first innings (8 overs bowled), `matches.status = 'in_progress'` |
| Demo accounts | 3 | `admin@demo`, `scorer@demo`, `coach@demo` |

**Data narrative** — the seeded data tells a coherent story:
- The club is 8 games into a 14-game season
- One player has a standout batting average (55+) and another has standout bowling figures
- The in-progress match has the club batting, 2 wickets down, chasing a total
- Availability for the next game is fully collected; the coach selection has been announced
- Notifications feed shows recent selection and availability activity

**Demo walkthrough order** (documented in `docs/DEMO_SCRIPT.md`):
1. `/live` — in-progress match score
2. `/admin/matches/[id]/score` — pick up scoring in Pro mode
3. `/results/[id]` — completed scorecard
4. `/analytics/match/[id]` — wagon wheel, pitch map, phase charts
5. `/stats` — career tables
6. `/stats/[id]` — individual player deep-dive
7. `/admin/availability/[id]` — full availability view, XI selection ready
8. `/notifications` — notification feed

### Nightly Reset

A Vercel cron job (`vercel.json` schedule) hits `POST /api/cron/reset-demo` nightly at 02:00 UTC. The route runs the seed script logic server-side (same operations, no CLI dependency) to restore the demo to its original state. Protected by a `CRON_SECRET` environment variable checked against the `Authorization` header.

---

## 3. Deployment Automation

### Provisioning Script

**`scripts/provision-tenant.sh`** — interactive Bash script. Prerequisites: Supabase CLI and Vercel CLI installed and authenticated.

**Steps:**
1. Prompts: club name, admin email, plan (`club` or `pro`)
2. Creates Supabase project via `supabase projects create`
3. Links project locally
4. Runs migrations `001`–`032` in strict order; aborts on first failure
5. Inserts `club_config` row with club name, plan, `is_demo: false`
6. Creates admin user via `supabase auth admin createuser`
7. Inserts admin role into `user_roles`
8. Deploys to Vercel via `vercel deploy --prod` with env vars
9. Prints summary: app URL, admin login credentials, Supabase dashboard URL

**Migration safety:** the script checks the exit code of each migration individually. A partial migration is worse than a failed one — the script stops and reports exactly which migration failed.

### Vercel Deploy Button

A `[![Deploy with Vercel](https://vercel.com/button)](...)` badge in `README.md` linking to Vercel's one-click deploy flow. Pre-populates all required environment variable *names* so the operator knows what values to supply. Does not automate Supabase setup — that still requires the script or manual steps. The button covers the "I want to try self-hosting" path without the CLI.

### `DEPLOYMENT.md`

A step-by-step manual provisioning guide covering:
- Prerequisites (Node 18+, Supabase CLI, Vercel CLI)
- Environment variables reference (what each one does)
- Migration order and how to run them
- First login and granting admin role via SQL
- Troubleshooting common errors (cookie/auth issues, RLS failures)

### Scope boundary

No central tenant registry or control plane. A spreadsheet tracking Supabase project IDs, customer names, and plan tiers is sufficient at current scale.

---

## 4. In-App Onboarding Wizard

### Philosophy

A persistent checklist page rather than a modal wizard or guided tour overlay. Simpler to build, impossible to accidentally dismiss, and easier to return to if setup is interrupted.

### Setup Completion Model

Completion is derived from existing data — no extra tracking columns needed:

| Step | Completion check |
|------|-----------------|
| 1. Configure branding | `club_config.club_name != 'Cricket Club'` (the seeded default) |
| 2. Add players | At least 11 players exist in `players` |
| 3. Create a season | At least 1 row in `seasons` |
| 4. Create first fixture | At least 1 row in `matches` |
| 5. Set up availability | At least 1 row in `availability_windows` |

All 5 complete = onboarded.

### `/admin/setup` Page

A dedicated setup page showing all 5 steps with status indicators (pending / complete), a one-line explanation of why each step matters, and a direct link to the relevant admin page. Accessible at any time from the admin sidebar.

**Example step card:**
```
✓  Add players
   Players must exist before you can select your XI or track availability.
   → /admin/players
```

### Dashboard Integration

The admin dashboard (`/dashboard`) checks completion on load. If fewer than 5 steps are complete, a prominent checklist card appears at the top of the page showing step count ("3 of 5 setup steps complete") and a link to `/admin/setup`. Once all 5 steps are done, the card disappears permanently.

The check is lightweight — a single aggregated query, not 5 separate queries.

### Empty States

Every admin list page that renders a blank table on a fresh install gets a proper empty state:
- `/admin/players` — "No players yet. Add your first player to get started." + Add Player button
- `/admin/matches` — "No matches yet. Create your first fixture." + New Match button
- `/admin/seasons` — "No seasons yet. Create a season to start tracking stats." + New Season button
- `/admin/availability` — "No availability windows yet. Create one to start collecting responses." + New Window button

Empty states use the existing card/button design system — no new components needed.

### Club Branding Edit Page

Step 1 of the setup checklist requires a place to edit club config. Add `/admin/settings` — a simple form for:
- Club name (`club_name`, `club_short_name`)
- Primary colour (colour picker → `primary_color`)
- Logo upload (Supabase Storage → `logo_url`)
- Contact email (`contact_email` — new column, added in migration `032` alongside `plan`)

The `contact_email` value is used in `<UpgradePrompt />` cards.

This page is also useful post-onboarding for ongoing branding changes.

---

## Out of Scope

- Billing integration (Stripe or otherwise) — lives outside this repo
- Central tenant registry / control plane — not needed at current scale
- In-app plan upgrade flow — customers contact you to upgrade; you update `club_config.plan` via SQL
- Multi-team / multi-club within a single tenant — enterprise path, not designed here
- Guided tour overlays / product walkthroughs (e.g. Intercom, Shepherd.js)

---

## Migration Summary

| Migration | Change |
|-----------|--------|
| `032` | Add `plan TEXT CHECK ('club','pro')` and `contact_email TEXT` to `club_config` |
| `033` | Add `is_demo BOOLEAN DEFAULT false` to `club_config` |

Two separate migrations keeps rollback clean if the demo flag is ever removed.

---

## File Additions Summary

| Path | Purpose |
|------|---------|
| `lib/club-config.ts` | Server-side `getClubConfig()` — plan + branding |
| `components/UpgradePrompt.tsx` | Shared upgrade prompt card |
| `scripts/seed-demo.ts` | Demo data seed script |
| `scripts/provision-tenant.sh` | New tenant provisioning script |
| `app/api/cron/reset-demo/route.ts` | Nightly demo reset endpoint |
| `app/admin/setup/page.tsx` | Onboarding checklist page |
| `app/admin/settings/page.tsx` | Club branding edit page |
| `docs/DEMO_SCRIPT.md` | Walkthrough guide for sales demos |
| `DEPLOYMENT.md` | Manual provisioning guide |
