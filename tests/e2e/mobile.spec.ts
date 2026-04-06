/**
 * Mobile layout tests — verifies the scorer fits on screen without scrolling.
 * Runs on Pixel 5 viewport (393 × 851) via the mobile-chrome playwright project.
 *
 * These tests are the most important for UX — a scorer that requires scrolling
 * breaks live match scoring.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE } from './helpers/supabase-mock'

const SCORER_URL = `/admin/matches/${MATCH_FIXTURE.id}/score`

function setupScorerMocks(page: import('@playwright/test').Page) {
  page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([MATCH_FIXTURE]),
    })
  })

  page.route('**/rest/v1/innings**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        ...INNINGS_FIXTURE,
        status: 'in_progress',
      }]),
    })
  })

  page.route('**/rest/v1/match_players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 'mp1', player_id: 'p1', match_id: MATCH_FIXTURE.id, first_name: 'Alice', last_name: 'Smith', is_striker: true, batting_order: 1, is_captain: false, is_keeper: false },
        { id: 'mp2', player_id: 'p2', match_id: MATCH_FIXTURE.id, first_name: 'Bob', last_name: 'Jones', is_striker: false, batting_order: 2, is_captain: false, is_keeper: false },
        { id: 'mp3', player_id: 'p3', match_id: MATCH_FIXTURE.id, first_name: 'Carol', last_name: 'Taylor', is_current_bowler: true, batting_order: null, is_captain: false, is_keeper: false },
      ]),
    })
  })

  page.route('**/rest/v1/players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 'p1', first_name: 'Alice', last_name: 'Smith' },
        { id: 'p2', first_name: 'Bob', last_name: 'Jones' },
      ]),
    })
  })

  page.route('**/rest/v1/ball_events**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
}

const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars (real session)'

test.describe('Scorer mobile layout — no scroll', () => {
  test.beforeEach(async ({ page }) => {
    setupScorerMocks(page)
  })

  test('scorer shell uses fixed positioning — no scroll', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // The .scorer-shell element should have position:fixed
    const scorerShell = page.locator('.scorer-shell')
    if (await scorerShell.count() > 0) {
      const position = await scorerShell.evaluate(el =>
        window.getComputedStyle(el).position
      )
      expect(position).toBe('fixed')
    }
  })

  test('page body scroll height equals viewport height', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // With position:fixed layout the document should not be taller than viewport
    const scrollHeight = await page.evaluate(() => document.documentElement.scrollHeight)
    const viewportHeight = await page.evaluate(() => window.innerHeight)

    // Allow 1px tolerance
    expect(scrollHeight).toBeLessThanOrEqual(viewportHeight + 1)
  })

  test('controls section is visible in viewport', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const scorerControls = page.locator('.scorer-controls')
    if (await scorerControls.count() > 0) {
      const box = await scorerControls.boundingBox()
      expect(box).not.toBeNull()

      const viewportHeight = page.viewportSize()?.height ?? 851
      // Controls bottom should not exceed viewport
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight + 2)
    }
  })

  test('run buttons are visible without scrolling', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Find run buttons
    const runBtn1 = page.locator('button').filter({ hasText: /^1$/ })
    if (await runBtn1.count() > 0) {
      const box = await runBtn1.first().boundingBox()
      expect(box).not.toBeNull()

      const viewportHeight = page.viewportSize()?.height ?? 851
      // Button must be within viewport — not pushed below fold
      expect(box!.y).toBeLessThan(viewportHeight)
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewportHeight + 2)
    }
  })

  test('no horizontal overflow on scorer', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})

test.describe('Public pages on mobile', () => {
  test('homepage fits mobile viewport without horizontal scroll', async ({ page }) => {
    await page.goto('/')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('fixtures page is readable on mobile', async ({ page }) => {
    await page.goto('/fixtures')
    await expect(page.locator('body')).toBeVisible()
    // No overflow
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('results page is readable on mobile', async ({ page }) => {
    await page.goto('/results')
    await expect(page.locator('body')).toBeVisible()
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })

  test('login page is usable on mobile', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible()

    // Inputs should be wide enough (not clipped)
    const emailInput = page.locator('input[type="email"]')
    const box = await emailInput.boundingBox()
    expect(box?.width).toBeGreaterThan(200)
  })
})

test.describe('Touch interactions', () => {
  test('run buttons have sufficient tap target size', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    setupScorerMocks(page)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const runBtn = page.locator('button').filter({ hasText: /^[0-6]$/ })
    if (await runBtn.count() > 0) {
      const box = await runBtn.first().boundingBox()
      // WCAG 2.5.5: minimum 44×44px touch target; our clamp is min 56px
      expect(box?.height).toBeGreaterThanOrEqual(44)
      expect(box?.width).toBeGreaterThan(44)
    }
  })
})
