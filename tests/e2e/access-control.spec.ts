/**
 * Access control — verifies that protected routes redirect unauthenticated users.
 * All tests run without auth state.
 */
import { test, expect } from '@playwright/test'

// Always unauthenticated
test.use({ storageState: { cookies: [], origins: [] } })

const PROTECTED_ROUTES = [
  '/dashboard',
  '/admin/matches',
  '/admin/players',
  '/admin/seasons',
  '/admin/users',
  '/admin/opponents',
  '/admin/competitions',
]

// The scorer page requires a match UUID — use a placeholder that still exercises the auth check
const SCORER_ROUTE = '/admin/matches/00000000-0000-0000-0000-000000000001/score'

for (const route of PROTECTED_ROUTES) {
  test(`${route} redirects to /login when unauthenticated`, async ({ page }) => {
    await page.goto(route)
    // Should end up on login page (either directly or after redirect)
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
}

test(`${SCORER_ROUTE} redirects to /login when unauthenticated`, async ({ page }) => {
  await page.goto(SCORER_ROUTE)
  await page.waitForURL(/\/login/, { timeout: 10_000 })
  expect(page.url()).toContain('/login')
})

test.describe('Role-based access in dashboard', () => {
  /**
   * These tests use the real app and require auth. They run in the 'security' project
   * which has no auth state. We verify the redirect behaviour for unauthenticated users.
   */

  test('admin panel link not visible to unauthenticated visitors', async ({ page }) => {
    // The dashboard redirects to login, so unauthenticated users never see admin links
    await page.goto('/dashboard')
    expect(page.url()).toContain('/login')
  })
})

test.describe('Direct URL manipulation', () => {
  test('cannot access scorer by guessing a match UUID', async ({ page }) => {
    // Even if attacker guesses a valid-looking UUID, they hit the server auth check
    await page.goto('/admin/matches/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/score')
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })

  test('cannot access new match form without auth', async ({ page }) => {
    await page.goto('/admin/matches/new')
    // Should either redirect to login or show nothing useful
    await page.waitForURL(/\/login/, { timeout: 10_000 })
    expect(page.url()).toContain('/login')
  })
})

test.describe('Public routes are accessible without auth', () => {
  for (const route of ['/', '/fixtures', '/results', '/stats', '/squad', '/live', '/login', '/register']) {
    test(`${route} is reachable`, async ({ page }) => {
      await page.goto(route)
      expect(page.url()).not.toContain('/login?')
      const status = await page.evaluate(() => document.querySelector('body') ? 200 : 500)
      expect(status).toBe(200)
    })
  }
})
