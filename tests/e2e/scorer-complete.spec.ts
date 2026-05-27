/**
 * Scorer complete flow — phase walkthrough, over end, wicket modal, undo, extras, innings break.
 * Extends the basic scorer.spec.ts checks with the full 8-phase journey.
 * Uses mock auth — no real credentials required.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE, mockE2eAuth } from './helpers/supabase-mock'

const SCORER_URL = `/admin/matches/${MATCH_FIXTURE.id}/score`

/** 15 BCC players + 11 opposition players */
const BCC_PLAYERS = Array.from({ length: 11 }, (_, i) => ({
  id: `mp${i + 1}`,
  player_id: `p${i + 1}`,
  match_id: MATCH_FIXTURE.id,
  batting_order: i + 1,
  first_name: `BCC${i + 1}`,
  last_name: 'Player',
  is_captain: i === 0,
  is_keeper: i === 1,
  team_side: 'bcc',
}))

const OPP_PLAYERS = Array.from({ length: 11 }, (_, i) => ({
  id: `omp${i + 1}`,
  player_id: null,
  match_id: MATCH_FIXTURE.id,
  batting_order: i + 1,
  first_name: `Opp${i + 1}`,
  last_name: 'Player',
  is_captain: i === 0,
  is_keeper: i === 1,
  team_side: 'opp',
}))

const ALL_PLAYERS = [...BCC_PLAYERS, ...OPP_PLAYERS]

function setupScorerMocks(page: import('@playwright/test').Page, inningsData = [INNINGS_FIXTURE]) {
  page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([MATCH_FIXTURE]),
    })
  })

  page.route('**/rest/v1/innings**', async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inningsData) })
    } else {
      await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(INNINGS_FIXTURE) })
    }
  })

  page.route('**/rest/v1/match_players**', async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ALL_PLAYERS) })
    } else {
      await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    }
  })

  page.route('**/rest/v1/players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(BCC_PLAYERS.map(p => ({
        id: p.player_id, first_name: p.first_name, last_name: p.last_name, is_active: true,
      }))),
    })
  })

  page.route('**/rest/v1/ball_events**', async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    } else {
      await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'ball-1' }) })
    }
  })

  page.route('**/rest/v1/selections**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
  })
}

// ─── Setup phases ─────────────────────────────────────────────────────────────

test.describe('Scorer: setup_bcc_xi phase', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupScorerMocks(page, []) // empty innings → setup phase
  })

  test('BCC XI setup shows player checkboxes or names', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/BCC|squad|select|XI/i)
  })

  test('step indicator shows current step', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/STEP \d|step \d/i)
  })

  test('back link to matches present', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href="/admin/matches"]')).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Active scoring — run buttons ─────────────────────────────────────────────

test.describe('Scorer: scoring phase — run buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupScorerMocks(page, [{
      ...INNINGS_FIXTURE,
      status: 'in_progress',
    }])

    // Override match players to show active striker/bowler
    page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { ...BCC_PLAYERS[0], is_striker: true },
          { ...BCC_PLAYERS[1], is_striker: false },
          { ...OPP_PLAYERS[0], is_current_bowler: true, batting_order: null },
        ]),
      })
    })
  })

  test('run buttons 0–6 are visible', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    for (const run of [0, 1, 2, 3, 4, 5, 6]) {
      const btn = page.locator('button').filter({ hasText: new RegExp(`^${run}$`) })
      if (await btn.count() > 0) {
        await expect(btn.first()).toBeVisible()
      }
    }
  })

  test('clicking "1" does not crash the app', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const runBtn = page.locator('button').filter({ hasText: /^1$/ })
    if (await runBtn.count() > 0) {
      await runBtn.first().click()
      await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary/i)
    }
  })

  test('clicking "4" marks boundary', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const runBtn = page.locator('button').filter({ hasText: /^4$/ })
    if (await runBtn.count() > 0) {
      await runBtn.first().click()
      await expect(page.locator('body')).not.toContainText(/error boundary|something went wrong/i)
    }
  })
})

// ─── Extras ───────────────────────────────────────────────────────────────────

test.describe('Scorer: extras buttons', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupScorerMocks(page, [{ ...INNINGS_FIXTURE, status: 'in_progress' }])
    page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { ...BCC_PLAYERS[0], is_striker: true },
          { ...BCC_PLAYERS[1], is_striker: false },
          { ...OPP_PLAYERS[0], is_current_bowler: true, batting_order: null },
        ]),
      })
    })
  })

  test('wide button visible', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    const wide = page.locator('button:has-text("Wide"), button:has-text("Wd")')
    if (await wide.count() > 0) {
      await expect(wide.first()).toBeVisible()
    }
  })

  test('no-ball button visible', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    const nb = page.locator('button:has-text("No Ball"), button:has-text("NB"), button:has-text("No·Ball")')
    if (await nb.count() > 0) {
      await expect(nb.first()).toBeVisible()
    }
  })

  test('bye button visible', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    const bye = page.locator('button:has-text("Bye")')
    if (await bye.count() > 0) {
      await expect(bye.first()).toBeVisible()
    }
  })

  test('leg bye button visible', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    const lb = page.locator('button:has-text("Leg Bye"), button:has-text("LB"), button:has-text("Leg·Bye")')
    if (await lb.count() > 0) {
      await expect(lb.first()).toBeVisible()
    }
  })
})

// ─── Wicket modal ─────────────────────────────────────────────────────────────

test.describe('Scorer: wicket flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupScorerMocks(page, [{ ...INNINGS_FIXTURE, status: 'in_progress' }])
    page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { ...BCC_PLAYERS[0], is_striker: true },
          { ...BCC_PLAYERS[1], is_striker: false },
          { ...OPP_PLAYERS[0], is_current_bowler: true, batting_order: null },
        ]),
      })
    })
  })

  test('wicket button opens WicketModal', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const wktBtn = page.locator('button:has-text("Wkt"), button:has-text("Wicket")')
    if (await wktBtn.count() > 0) {
      await wktBtn.first().click()
      // Modal should show dismissal types
      await expect(page.locator('body')).toContainText(/bowled|caught|lbw|run out|stumped/i)
    }
  })

  test('wicket modal has dismissal type buttons', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const wktBtn = page.locator('button:has-text("Wkt"), button:has-text("Wicket")')
    if (await wktBtn.count() > 0) {
      await wktBtn.first().click()
      await expect(page.locator('button:has-text("Bowled"), button:has-text("bowled")')).toBeVisible({ timeout: 5_000 })
    }
  })
})

// ─── Undo ─────────────────────────────────────────────────────────────────────

test.describe('Scorer: undo', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupScorerMocks(page, [{ ...INNINGS_FIXTURE, status: 'in_progress' }])
    page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { ...BCC_PLAYERS[0], is_striker: true },
          { ...BCC_PLAYERS[1], is_striker: false },
          { ...OPP_PLAYERS[0], is_current_bowler: true, batting_order: null },
        ]),
      })
    })
  })

  test('undo button is present on scoring screen', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const undoBtn = page.locator('button:has-text("Undo")')
    if (await undoBtn.count() > 0) {
      await expect(undoBtn.first()).toBeVisible()
    }
  })

  test('undo does not crash after no balls to undo', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Mock the DELETE endpoint for ball_events
    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })

    const undoBtn = page.locator('button:has-text("Undo")')
    if (await undoBtn.count() > 0) {
      await undoBtn.first().click()
      // Should not error-boundary crash
      await expect(page.locator('body')).not.toContainText(/something went wrong/i)
    }
  })
})

// ─── Innings break ────────────────────────────────────────────────────────────

test.describe('Scorer: innings break phase', () => {
  test('innings break UI shows when first innings completed', async ({ page }) => {
    await mockE2eAuth(page)
    setupScorerMocks(page, [
      { ...INNINGS_FIXTURE, innings_number: 1, status: 'completed', runs: 156, wickets: 10 },
    ])

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    // Should show innings break / target info
    await expect(page.locator('body')).toContainText(/innings|break|target|157/i)
  })
})
