/**
 * Admin XI selection page (/admin/matches/[id]/select).
 * Requires auth.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, PLAYER_FIXTURE, SELECTION_FIXTURE, AVAILABILITY_WINDOW_FIXTURE, mockAllAdmin, mockE2eAuth } from './helpers/supabase-mock'
const SELECT_URL = `/admin/matches/${MATCH_FIXTURE.id}/select`

function setupSelectionMocks(page: import('@playwright/test').Page) {
  page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        ...MATCH_FIXTURE,
        competition_id: 'comp1',
        competition: { id: 'comp1', name: 'T20 League', category: 'senior', match_format: 'T20' },
        opponent: { canonical_name: 'Edenvale CC' },
      }]),
    })
  })

  page.route('**/rest/v1/players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        Array.from({ length: 15 }, (_, i) => ({
          ...PLAYER_FIXTURE,
          id: `player-${i}`,
          first_name: `Player`,
          last_name: `${i + 1}`,
        }))
      ),
    })
  })

  page.route('**/rest/v1/selections**', async route => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    } else {
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SELECTION_FIXTURE),
      })
    }
  })

  page.route('**/rest/v1/availability_windows**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([AVAILABILITY_WINDOW_FIXTURE]),
    })
  })

  page.route('**/rest/v1/player_availability**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  page.route('**/rest/v1/competitions**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'comp1', name: 'T20 League', category: 'senior', match_format: 'T20' }]),
    })
  })
}

test.describe('XI selection page', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    setupSelectionMocks(page)
  })

  test('loads without error', async ({ page }) => {
    await page.goto(SELECT_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows match context (opponent)', async ({ page }) => {
    await page.goto(SELECT_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/edenvale|select|XI/i)
  })

  test('player pool renders', async ({ page }) => {
    await page.goto(SELECT_URL)
    await page.waitForLoadState('networkidle')
    // At least some player names should be shown
    await expect(page.locator('body')).toContainText(/player/i)
  })

  test('selected count indicator present', async ({ page }) => {
    await page.goto(SELECT_URL)
    await page.waitForLoadState('networkidle')
    // Shows something like "0 / 11" or "Selected: 0"
    await expect(page.locator('body')).toContainText(/\d.*\/.*11|selected|0.*11/i)
  })

  test('announce button present', async ({ page }) => {
    await page.goto(SELECT_URL)
    await page.waitForLoadState('networkidle')
    const announceBtn = page.locator('button:has-text("Announce"), button:has-text("announce")')
    await expect(announceBtn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(SELECT_URL)
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})
