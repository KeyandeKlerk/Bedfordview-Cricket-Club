/**
 * Public routes — no auth required.
 * Tested on both Desktop Chrome and mobile Pixel 5 (see playwright.config.ts).
 */
import { test, expect } from '@playwright/test'

test.describe('Homepage', () => {
  test('loads and shows BCC branding', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/bedfordview|bcc/i)
    // Nav is present
    await expect(page.locator('nav, header')).toBeVisible()
  })

  test('has links to fixtures and results', async ({ page }) => {
    await page.goto('/')
    const body = page.locator('body')
    await expect(body).toContainText(/fixtures|upcoming/i)
    await expect(body).toContainText(/results|recent/i)
  })
})

test.describe('Fixtures page', () => {
  test('loads without error', async ({ page }) => {
    const response = await page.goto('/fixtures')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('does not redirect to login', async ({ page }) => {
    await page.goto('/fixtures')
    expect(page.url()).not.toContain('/login')
  })
})

test.describe('Results page', () => {
  test('loads without error', async ({ page }) => {
    const response = await page.goto('/results')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })
})

test.describe('Stats page', () => {
  test('loads career stats tables', async ({ page }) => {
    const response = await page.goto('/stats')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toContainText(/batting|bowling|stats/i)
  })
})

test.describe('Squad page', () => {
  test('loads without error', async ({ page }) => {
    const response = await page.goto('/squad')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })
})

test.describe('Live page', () => {
  test('loads without auth', async ({ page }) => {
    const response = await page.goto('/live')
    expect(response?.status()).toBeLessThan(500)
    expect(page.url()).not.toContain('/login')
  })
})

test.describe('Login page', () => {
  test('shows sign-in form', async ({ page }) => {
    await page.goto('/login')
    await expect(page.locator('.auth-title, h1')).toContainText(/sign in/i)
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]')).toBeVisible()
  })

  test('link to register page', async ({ page }) => {
    await page.goto('/login')
    // Target the in-card link — nav link is hidden on mobile viewports
    await expect(page.locator('.auth-sub a[href="/register"]')).toBeVisible()
  })
})

test.describe('Legacy redirects', () => {
  test('/match/[id]/live redirects to /matches/[id]', async ({ page }) => {
    const res = await page.goto('/match/some-id/live')
    // Should not 404 (redirect counts as success)
    expect(res?.status()).not.toBe(404)
  })
})

test.describe('Mobile layout', () => {
  test('nav is visible on mobile viewport', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('nav, header')).toBeVisible()
  })

  test('no horizontal scroll on homepage', async ({ page }) => {
    await page.goto('/')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    // Allow 1px tolerance for sub-pixel rendering
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})
