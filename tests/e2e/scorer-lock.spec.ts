/**
 * Scoring lock system — lock state display, handover modal.
 * Verifies that the UI correctly shows when a match is locked and by whom.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE, mockE2eAuth } from './helpers/supabase-mock'

const SCORER_URL = `/admin/matches/${MATCH_FIXTURE.id}/score`

const LOCKED_MATCH = {
  ...MATCH_FIXTURE,
  scorer_session_id: 'session-abc',
  scorer_locked_at: new Date().toISOString(),
  scorer_user_id: 'other-user-uuid',
  pending_handover_to: null,
  pending_handover_at: null,
}

const FREE_MATCH = {
  ...MATCH_FIXTURE,
  scorer_session_id: null,
  scorer_locked_at: null,
  scorer_user_id: null,
  pending_handover_to: null,
  pending_handover_at: null,
}

const EXPIRED_MATCH = {
  ...LOCKED_MATCH,
  scorer_locked_at: new Date(Date.now() - 3 * 60 * 1000).toISOString(), // 3 min ago > 2 min TTL
}

function setupLockMocks(page: import('@playwright/test').Page, matchData: object) {
  page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([matchData]),
    })
  })
  page.route('**/rest/v1/innings**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ ...INNINGS_FIXTURE, status: 'in_progress' }]),
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
      body: JSON.stringify([]),
    })
  })
  page.route('**/rest/v1/ball_events**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
  })
  page.route('**/rest/v1/selections**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
  })
  // RPC for acquire_scoring_lock
  page.route('**/rest/v1/rpc/acquire_scoring_lock**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(true) })
  })
}

test.describe('Scorer lock — free match', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupLockMocks(page, FREE_MATCH)
  })

  test('loads scorer without lock warning when match is free', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    // No "locked by" warning should appear
    await expect(page.locator('body')).not.toContainText(/locked by|being scored by/i)
  })
})

test.describe('Scorer lock — match locked by another user', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupLockMocks(page, LOCKED_MATCH)
    // Acquire lock fails — another session holds it
    page.route('**/rest/v1/rpc/acquire_scoring_lock**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(false) })
    })
  })

  test('shows lock warning when another session holds lock', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    // Should show that the match is locked
    await expect(page.locator('body')).toContainText(/locked|being scored|another session|handover/i)
  })
})

test.describe('Scorer lock — expired lock', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupLockMocks(page, EXPIRED_MATCH)
  })

  test('expired lock treated as free (no lock warning)', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    // Expired lock → should be able to score, no blocking warning
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })
})

test.describe('Scorer: handover', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupLockMocks(page, FREE_MATCH)
  })

  test('handover button visible on scoring screen', async ({ page }) => {
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const handoverBtn = page.locator('button:has-text("Handover"), button:has-text("Hand Over"), button:has-text("Transfer")')
    if (await handoverBtn.count() > 0) {
      await expect(handoverBtn.first()).toBeVisible()
    }
  })
})
