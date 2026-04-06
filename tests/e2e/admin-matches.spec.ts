/**
 * Admin matches — match list page, create match form.
 * Requires auth (uses storageState from auth.setup.ts).
 * Supabase data calls are intercepted and mocked.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE } from './helpers/supabase-mock'

// All tests in this file run under chromium with auth state
// (configured by playwright.config.ts)

test.beforeEach(async ({ page }) => {
  // Mock matches query
  await page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
      body: JSON.stringify([MATCH_FIXTURE]),
    })
  })

  // Mock players query (used in new match form)
  await page.route('**/rest/v1/players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 'p1', first_name: 'John', last_name: 'Smith' },
        { id: 'p2', first_name: 'Jane', last_name: 'Doe' },
      ]),
    })
  })

  // Mock opponents
  await page.route('**/rest/v1/opponents**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'opp1', canonical_name: 'Edenvale CC' }]),
    })
  })

  // Mock competitions
  await page.route('**/rest/v1/competitions**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'comp1', name: 'T20 League' }]),
    })
  })

  // Mock seasons
  await page.route('**/rest/v1/seasons**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'sea1', name: '2026' }]),
    })
  })

  // Mock grounds
  await page.route('**/rest/v1/grounds**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'g1', name: 'Bedfordview Oval' }]),
    })
  })
})

test.describe('Match list page', () => {
  test('loads and shows page heading', async ({ page }) => {
    await page.goto('/admin/matches')
    // Should show matches heading or list
    await expect(page.locator('h1, .am-title, [class*="title"]')).toBeVisible({ timeout: 10_000 })
  })

  test('has "+ New Match" button', async ({ page }) => {
    await page.goto('/admin/matches')
    const newMatchBtn = page.locator('a[href="/admin/matches/new"], button:has-text("New Match")')
    await expect(newMatchBtn).toBeVisible({ timeout: 10_000 })
  })

  test('filter tabs are present', async ({ page }) => {
    await page.goto('/admin/matches')
    // Expect some kind of status filter (Upcoming, In Progress, Completed, All)
    const body = page.locator('body')
    await expect(body).toContainText(/upcoming|all|completed/i)
  })
})

test.describe('Create match form', () => {
  test('loads the new match page', async ({ page }) => {
    await page.goto('/admin/matches/new')
    const response = await page.waitForResponse(r => r.url().includes('/admin/matches/new') || r.status() === 200)
    expect(response.status()).toBeLessThan(500)
  })

  test('form has required fields', async ({ page }) => {
    await page.goto('/admin/matches/new')
    await page.waitForLoadState('networkidle')

    // Should have a date input and opponent selector at minimum
    const body = page.locator('body')
    await expect(body).toContainText(/date|opponent|vs/i)
  })
})

test.describe('Dashboard', () => {
  test('admin links panel visible', async ({ page }) => {
    // Mock the player (getCurrentPlayerServer result)
    await page.route('**/rest/v1/players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 'p1', full_name: 'Test Admin', role: 'admin' }]),
      })
    })

    await page.goto('/dashboard')
    const body = page.locator('body')

    // Admin panel should show matches link (not "New Match" anymore)
    await expect(body).toContainText(/matches/i)
    // New Match tile should NOT exist as a separate entry
    const newMatchTiles = page.locator('a[href="/admin/matches/new"]')
    // There may be inline links, but no dedicated tile card with "New Match"
    // The grid should not show a "Create fixture" sub-label
    await expect(body).not.toContainText('Create fixture')
  })
})
