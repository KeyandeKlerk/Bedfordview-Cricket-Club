/**
 * Authenticated dashboard — role-based admin links, upcoming/recent sections.
 * Requires auth (storageState from auth.setup.ts).
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE } from './helpers/supabase-mock'

const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars'

test.describe('Dashboard — structure', () => {
  test.beforeEach(async ({ page }) => {
    // Mock matches query used by dashboard
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { ...MATCH_FIXTURE, status: 'upcoming' },
          { ...MATCH_FIXTURE, id: 'match-2', status: 'completed' },
        ]),
      })
    })
    await page.route('**/rest/v1/memberships**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })
    await page.route('**/rest/v1/orders**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })
  })

  test('loads and shows dashboard heading', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
    await expect(page.locator('body')).toContainText(/dashboard|welcome/i)
  })

  test('shows Matches admin link', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href="/admin/matches"]')).toBeVisible()
  })

  test('shows Players admin link', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href="/admin/players"]')).toBeVisible()
  })

  test('shows Availability admin link', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('a[href="/admin/availability"]')).toBeVisible()
  })

  test('upcoming fixtures section present', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/upcoming|fixture/i)
  })

  test('recent results section present', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/result|recent|completed/i)
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

test.describe('Dashboard — unauthenticated redirect', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('redirects to /login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})
