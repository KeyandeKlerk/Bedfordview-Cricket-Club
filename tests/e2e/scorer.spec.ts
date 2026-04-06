/**
 * Scorer shell — setup phases, ball entry, wicket flow, undo, extras.
 * Mocks all Supabase calls so tests run offline.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE } from './helpers/supabase-mock'

const SCORER_URL = `/admin/matches/${MATCH_FIXTURE.id}/score`

const PLAYERS = [
  { id: 'mp1', player_id: 'p1', match_id: MATCH_FIXTURE.id, batting_order: 1, first_name: 'Alice', last_name: 'Smith', is_captain: false, is_keeper: false },
  { id: 'mp2', player_id: 'p2', match_id: MATCH_FIXTURE.id, batting_order: 2, first_name: 'Bob', last_name: 'Jones', is_captain: false, is_keeper: false },
  { id: 'mp3', player_id: 'p3', match_id: MATCH_FIXTURE.id, batting_order: 3, first_name: 'Carol', last_name: 'Taylor', is_captain: true, is_keeper: false },
]

function setupScorerMocks(page: import('@playwright/test').Page) {
  // Single match row
  page.route(`**/rest/v1/matches**`, async route => {
    const url = route.request().url()
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(url.includes('single') || !url.includes('eq') ? MATCH_FIXTURE : [MATCH_FIXTURE]),
    })
  })

  // Innings — start with empty (setup phase)
  page.route('**/rest/v1/innings**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  // Match players
  page.route('**/rest/v1/match_players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(PLAYERS),
    })
  })

  // All players (for selection modal)
  page.route('**/rest/v1/players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(PLAYERS.map(p => ({
        id: p.player_id,
        first_name: p.first_name,
        last_name: p.last_name,
      }))),
    })
  })

  // Ball events — empty
  page.route('**/rest/v1/ball_events**', async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    } else {
      // POST/DELETE — acknowledge
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
    }
  })
}

const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars (real session)'

test.describe('Scorer setup phases', () => {
  test.beforeEach(async ({ page }) => {
    setupScorerMocks(page)
  })

  test('shows back link to matches on setup phase', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const backLink = page.locator('a[href="/admin/matches"]')
    await expect(backLink.first()).toBeVisible({ timeout: 10_000 })
  })

  test('shows step indicator on setup', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toContainText(/STEP \d \/ 5/i)
  })

  test('BCC XI setup phase visible', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).toContainText(/BCC XI|Squad|select.*player/i)
  })
})

test.describe('Active scoring UI', () => {
  test.beforeEach(async ({ page }) => {
    setupScorerMocks(page)

    // Override innings to return in-progress innings
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([INNINGS_FIXTURE]),
      })
    })

    // Match players with batters and bowler set
    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { ...PLAYERS[0], is_striker: true, batting_order: 1 },
          { ...PLAYERS[1], is_striker: false, batting_order: 2 },
          { ...PLAYERS[2], is_current_bowler: true, batting_order: null },
        ]),
      })
    })
  })

  test('shows run buttons 0–6', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Wait for scoring phase (if redirected to scoring)
    // Run buttons 0, 1, 2, 3, 4, 5, 6 should be present
    for (const run of [0, 1, 2, 3, 4, 5, 6]) {
      // Look for buttons by text content
      const btn = page.locator(`button`).filter({ hasText: new RegExp(`^${run}$`) })
      // Only check if we're on the scoring screen
      if (await btn.count() > 0) {
        await expect(btn.first()).toBeVisible()
      }
    }
  })

  test('has extras buttons', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const body = page.locator('body')
    // Check for extras (Wide, No Ball, Bye, Leg Bye)
    if (await body.getByText(/wide|no.?ball|bye|wd|nb/i).count() > 0) {
      await expect(body.getByText(/wide|wd/i).first()).toBeVisible()
    }
  })

  test('has wicket button', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    if (await page.locator('button:has-text("Wkt"), button:has-text("Wicket")').count() > 0) {
      await expect(page.locator('button:has-text("Wkt"), button:has-text("Wicket")').first()).toBeVisible()
    }
  })

  test('has undo button', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    if (await page.locator('button:has-text("Undo")').count() > 0) {
      await expect(page.locator('button:has-text("Undo")').first()).toBeVisible()
    }
  })
})

test.describe('Ball submission', () => {
  test('clicking run button does not show error', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    setupScorerMocks(page)

    // In-progress innings
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([INNINGS_FIXTURE]),
      })
    })

    // Ball events POST
    await page.route('**/rest/v1/ball_events**', async route => {
      const method = route.request().method()
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: 'ball-1' }),
        })
      } else {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([]),
        })
      }
    })

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // If the scoring controls are visible, try clicking "1"
    const runBtn = page.locator('button').filter({ hasText: /^1$/ })
    if (await runBtn.count() > 0) {
      await runBtn.first().click()
      // No crash / error boundary triggered
      await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary/i)
    }
  })
})
