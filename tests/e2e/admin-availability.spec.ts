/**
 * Admin availability — window list, create form, window detail.
 * Requires auth.
 */
import { test, expect } from '@playwright/test'
import { AVAILABILITY_WINDOW_FIXTURE, MATCH_FIXTURE, PLAYER_FIXTURE, mockAllAdmin } from './helpers/supabase-mock'

const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars'

test.describe('Availability windows list', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAdmin(page)
    await page.route('**/rest/v1/availability_windows**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([AVAILABILITY_WINDOW_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows window title', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/weekend|availability|window/i)
  })

  test('has create/new window button', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    const btn = page.locator('button:has-text("Create"), button:has-text("New"), button:has-text("Add Window")')
    await expect(btn.first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Availability window detail', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAdmin(page)
    await page.route('**/rest/v1/availability_windows**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([AVAILABILITY_WINDOW_FIXTURE]),
      })
    })
    await page.route('**/rest/v1/player_availability**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { id: 'pa1', window_id: AVAILABILITY_WINDOW_FIXTURE.id, player_id: PLAYER_FIXTURE.id, status: 'available', note: null },
        ]),
      })
    })
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...MATCH_FIXTURE, availability_window_id: AVAILABILITY_WINDOW_FIXTURE.id }]),
      })
    })
    await page.route('**/rest/v1/opponents**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 'opp1', canonical_name: 'Edenvale CC' }]),
      })
    })
    await page.route('**/rest/v1/competitions**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 'comp1', name: 'T20 League', category: 'senior' }]),
      })
    })
  })

  test('loads window detail without error', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows player response summary', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/available|unavailable|tentative/i)
  })

  test('linked match has "Select XI" link', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href*="select"]')).toBeVisible({ timeout: 10_000 })
  })
})
