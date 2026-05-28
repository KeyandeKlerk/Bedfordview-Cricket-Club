# Comprehensive Test Suite Design

**Date:** 2026-05-27  
**Goal:** Achieve regression-detection certainty across all core functionality — scorer, stats, store, admin, player flows — including reload and dropped-connection edge cases. All tests run in CI with zero external credentials.

---

## 1. Architecture

Stack unchanged: **vitest** (unit) + **Playwright** (e2e). No new frameworks.

Core change: all 135 Playwright tests currently gated by `TEST_USER_EMAIL`/`TEST_USER_PASSWORD` env vars are converted to use the mock infrastructure already proven in `scorer-score-verification.spec.ts`. After conversion every test runs in CI with no credentials and no Supabase instance.

```
Unit tests (vitest)          no browser, pure logic, ~6s
  lib/cricket/*              existing — 452 tests ✓
  lib/offline/queue          NEW — Dexie offline queue
  lib/stats/formatters       NEW — stat formatter edge cases
  components/scorer/*        NEW — BallAnnotationPanel, WagonWheelPicker,
                                    PitchMapPicker, ShotTypePicker,
                                    BowlingTypePicker, QualityPicker

E2E tests (Playwright)       browser, mocked Supabase, no credentials
  scorer/*                   135 gated tests → unblocked
  stats.spec.ts              NEW — /stats, /stats/[id]
  analytics.spec.ts          NEW — /analytics, /analytics/match/[id]
  store-customer.spec.ts     NEW — /shop, /membership customer flow
  offline-scoring.spec.ts    NEW — network drop, queue flush, reload
  edge-cases.spec.ts         NEW — setup/break/complete reloads, double-click guard
  professional-scoring.spec.ts NEW — annotation panel, wagon wheel, LHB
```

---

## 2. Workstream 1 — Un-gate the 135 auth-skipped e2e tests

**Files affected:**
`scorer.spec.ts`, `scorer-complete.spec.ts`, `scorer-lock.spec.ts`, `admin-matches.spec.ts`, `admin-players.spec.ts`, `admin-users.spec.ts`, `admin-news.spec.ts`, `admin-availability.spec.ts`, `admin-selection.spec.ts`, `dashboard.spec.ts`, `live.spec.ts`, `player-flows.spec.ts`

**Conversion pattern for each test:**
1. Remove `test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)`
2. Add `mockAllAdmin(page)` in `beforeEach` (or targeted `mockSupabaseQuery()` calls where `mockAllAdmin` is too broad)
3. Add `mockAuthUser()` + `mockSupabaseAuth()` where the test navigates to an auth-protected page

**Scorer-specific tests** (need full match state) follow the `scorer-score-verification.spec.ts` pattern:
- Import `MATCH_FIXTURE`, `INNINGS_FIXTURE` from `helpers/supabase-mock.ts`
- Add `MATCH_PLAYERS_FIXTURE` to `helpers/supabase-mock.ts` (does not exist yet — create as part of this work, matching the 11-player array shape used in `scorer-score-verification.spec.ts` inline)
- Mock `matches`, `innings`, `ball_events`, `match_players` tables
- Mock `user_roles` to return a scorer/admin row so lock acquisition passes
- Mock the `acquire_scoring_lock` RPC endpoint

**Acceptance criteria:** `npx playwright test` with no env vars set produces zero skipped tests and all 135 previously-skipped tests either pass or are explicitly `.todo`.

---

## 3. Workstream 2 — Unit test gaps

### 3a. Offline queue (`lib/offline/queue.ts`)

Test file: `lib/offline/__tests__/queue.test.ts`

Uses `fake-indexeddb` to mock Dexie in Node (vitest jsdom environment). Add `fake-indexeddb` as a devDependency (`npm install -D fake-indexeddb`).

| Test | Assertion |
|------|-----------|
| `queueBall()` stores ball | ball appears in `balls` table after call |
| `flushQueue()` on success | POSTs balls, clears queue |
| `flushQueue()` on network failure | queue retains all balls, no data loss |
| `queueAnnotation()` | annotation stored in `pendingAnnotations` |
| `mergeAnnotationIntoBallQueue()` — ball still queued | annotation merged into queued ball row |
| `mergeAnnotationIntoBallQueue()` — ball already synced | annotation stored in `pendingAnnotations` instead |
| `flushAnnotations()` | sends pending annotations, clears `pendingAnnotations` |
| Memory fallback | queue works when IndexedDB unavailable |

### 3b. Stats formatters (`lib/stats/formatters.ts`)

Test file: `lib/stats/__tests__/formatters.test.ts`

| Test | Input → Expected output |
|------|------------------------|
| `overs()` — exact | 6 balls → "1.0" |
| `overs()` — partial | 7 balls → "1.1" |
| `overs()` — zero | 0 balls → "0.0" |
| `fmt()` — null | null → "-" |
| `fmt()` — zero | 0 → "0" |
| `fmt()` — decimal | 33.333... → "33.33" (2dp) |
| `bestFigures()` — standard | picks best wickets then best runs |
| `bestFigures()` — no innings | returns "-" |
| `formatDate()` — valid ISO | returns human-readable string |
| `formatDate()` — invalid | returns "-" or empty string without throwing |

### 3c. Professional scoring components

Test files in `components/scorer/__tests__/`:

**`BallAnnotationPanel.test.tsx`**
- Renders all pickers (wagon wheel, pitch map, shot type, bowling type, quality)
- Skip button calls `onSkip` without calling `onConfirm`
- Confirm button fires `onConfirm` with all collected values
- Panel does not auto-submit without user action

**`WagonWheelPicker.test.tsx`**
- Tap at normalised position stores `(wagon_x, wagon_y)` in `[-1, 1]` range
- LHB prop flips the off-side shading class
- Renders without error when no initial value

**`PitchMapPicker.test.tsx`**
- Tap snaps to correct `pitch_length` × `pitch_line` cell
- Selected cell gets highlighted state
- Renders without error when no initial value

**`ShotTypePicker.test.tsx` / `BowlingTypePicker.test.tsx` / `QualityPicker.test.tsx`**
- All options render
- Clicking an option fires `onChange` with the correct value
- Selected option shows active state
- Deselecting (clicking again) clears selection

---

## 4. Workstream 3 — New e2e spec files

All use mocked Supabase. All import from `tests/e2e/helpers/supabase-mock.ts`.

### `stats.spec.ts`
- `/stats` loads without error
- Batting and bowling tables render with at least one row (mocked career stats)
- Player name is a link to `/stats/[id]`
- `/stats/[id]` loads; all 5 tabs (Batting, Bowling, Fielding, Matchups, Advanced) present
- Switching tabs shows different content
- No horizontal overflow on iPhone SE

### `analytics.spec.ts`
- `/analytics` loads without error
- Run rate section and phase breakdown section render
- Match link navigates to `/analytics/match/[id]`
- `/analytics/match/[id]` loads; run rate chart, FoW, phase breakdown sections present
- `scoring_mode = 'professional'`: wagon wheel and pitch map sections visible
- `scoring_mode = 'club'`: professional sections absent
- Empty state (no balls): page renders gracefully without crashing

### `store-customer.spec.ts`
- `/shop` loads without error; product name visible
- Product card shows name, price
- Place order / add to cart flow completes without JS error
- Order confirmation state shown after submission
- `/membership` loads without error; purchase/join button present
- No overflow on iPhone SE

### `offline-scoring.spec.ts`

Uses `page.setOffline(true)` / `page.setOffline(false)` for network simulation.

- Ball scored offline: score display updates optimistically (no error shown)
- Ball scored offline: Dexie queue contains the ball (checked via `page.evaluate`)
- Reconnect: flush fires POST to `ball_events` endpoint
- Score consistent after flush (no double-count, no missing ball)
- Mid-score page reload: scorer recovers state from Dexie queue
- Undo while offline: ball removed from queue without network call
- Undo after offline flush: DELETE sent to `ball_events` on reconnect

### `edge-cases.spec.ts`
- Reload during scorer setup phase: returns to same setup step, not start
- Reload during innings break: shows innings break UI, not setup
- Reload on match complete: shows match complete screen, not scoring UI
- Rapid double-click on run button: only one ball recorded (button disabled between submissions)
- Session token refresh mid-scoring: scorer continues without redirect to login

### `professional-scoring.spec.ts`
- After scoring a ball in professional mode: annotation panel appears
- Skip button: panel dismissed, next ball ready, no annotation stored
- Filling wagon wheel + shot type + confirm: `ball_events` PATCH called with annotation data
- Change-bowler prompt: does not appear until after annotation panel is dismissed
- LHB toggle: wagon wheel SVG has LHB class applied
- Panel skippable even when no pickers have been touched

---

## 5. CI Pipeline

File: `.github/workflows/test.yml`

```yaml
name: Tests
on:
  push:
  pull_request:
    branches: [main]

jobs:
  unit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci
      - run: npm test -- --run

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npx playwright install chromium --with-deps
      - run: npm run build
      - run: npm run test:e2e
        env:
          CI: true
```

**Key decisions:**
- Chromium only in CI. Full cross-browser (Pixel 5, iPhone SE) runs locally and on a weekly schedule.
- `CI=true` triggers production build path in `playwright.config.ts` and enables test retries.
- No `TEST_USER_EMAIL` / `TEST_USER_PASSWORD` secrets needed.
- Unit and e2e jobs run in parallel (build overlaps with vitest).
- Estimated total wall time: ~3 min unit + ~8 min e2e = ~11 min per push.

Weekly scheduled run (`.github/workflows/test-full.yml`) runs all Playwright projects including mobile viewports.

---

## 6. Definition of Done

- `npm test -- --run` exits 0 with no skipped tests
- `npx playwright test` (no env vars) exits 0 with zero skipped tests
- GitHub Actions green on every push to main
- The 135 previously-gated tests all run and pass
- New specs cover: stats pages, analytics pages, store customer flow, offline/dropped-connection scenarios, professional scoring annotation panel
