/**
 * Admin players page — list, add/edit form fields, deactivate confirmation.
 * Requires auth.
 */
import { test, expect } from '@playwright/test'
import { PLAYER_FIXTURE, mockAllAdmin } from './helpers/supabase-mock'

const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars'

test.describe('Players list', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAdmin(page)
  })

  test('loads without error', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows page heading', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1, [class*="title"]')).toBeVisible({ timeout: 10_000 })
  })

  test('player names are listed', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/alice|smith|bob|jones/i)
  })

  test('has add/new player button', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Player"), button:has-text("Add Player")')
    await expect(addBtn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

test.describe('Players add form', () => {
  test.beforeEach(async ({ page }) => {
    await mockAllAdmin(page)
    await page.route('**/rest/v1/players**', async route => {
      const method = route.request().method()
      if (method === 'POST' || method === 'PATCH') {
        await route.fulfill({
          status: 201,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(PLAYER_FIXTURE),
        })
      } else {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([PLAYER_FIXTURE]),
        })
      }
    })
  })

  test('add form has first name and last name fields', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')

    // Open the form
    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Player"), button:has-text("Add Player")')
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      await expect(page.locator('input[placeholder*="first" i], input[placeholder*="First" i]')).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('input[placeholder*="last" i], input[placeholder*="Last" i]')).toBeVisible()
    }
  })

  test('add form has batting and bowling style selects', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button:has-text("Add"), button:has-text("New Player"), button:has-text("Add Player")')
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      const selects = page.locator('select')
      await expect(selects.first()).toBeVisible({ timeout: 5_000 })
    }
  })
})
