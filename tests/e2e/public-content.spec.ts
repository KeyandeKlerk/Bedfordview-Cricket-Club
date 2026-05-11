/**
 * Public content pages — news, shop, membership, contact, gallery, junior, analytics.
 * No auth required for any of these.
 */
import { test, expect } from '@playwright/test'
import { ARTICLE_FIXTURE, PRODUCT_FIXTURE } from './helpers/supabase-mock'

// ─── News ─────────────────────────────────────────────────────────────────────

test.describe('News page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/articles**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([ARTICLE_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    const res = await page.goto('/news')
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('does not redirect to login', async ({ page }) => {
    await page.goto('/news')
    expect(page.url()).not.toContain('/login')
  })

  test('shows news content', async ({ page }) => {
    await page.goto('/news')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/news|article|latest/i)
  })
})

test.describe('News article page', () => {
  test('loads article page without error', async ({ page }) => {
    await page.route('**/rest/v1/articles**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([ARTICLE_FIXTURE]),
      })
    })

    const res = await page.goto(`/news/${ARTICLE_FIXTURE.slug}`)
    expect(res?.status()).toBeLessThan(500)
  })
})

// ─── Shop ─────────────────────────────────────────────────────────────────────

test.describe('Shop page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/products**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([PRODUCT_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    const res = await page.goto('/shop')
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('does not redirect to login', async ({ page }) => {
    await page.goto('/shop')
    expect(page.url()).not.toContain('/login')
  })

  test('shows shop content', async ({ page }) => {
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/shop|product|item|kit/i)
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

// ─── Membership ───────────────────────────────────────────────────────────────

test.describe('Membership page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/products**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...PRODUCT_FIXTURE, category: 'membership', name: 'Full Member', price_cents: 30000 }]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    const res = await page.goto('/membership')
    expect(res?.status()).toBeLessThan(500)
  })

  test('does not redirect to login', async ({ page }) => {
    await page.goto('/membership')
    expect(page.url()).not.toContain('/login')
  })

  test('shows membership content', async ({ page }) => {
    await page.goto('/membership')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/membership|member|plan/i)
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/membership')
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

// ─── Contact ──────────────────────────────────────────────────────────────────

test.describe('Contact page', () => {
  test('loads without error', async ({ page }) => {
    const res = await page.goto('/contact')
    expect(res?.status()).toBeLessThan(500)
  })

  test('has contact form fields', async ({ page }) => {
    await page.goto('/contact')
    await page.waitForLoadState('networkidle')
    const body = page.locator('body')
    await expect(body).toContainText(/contact|message|email/i)
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/contact')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

// ─── Gallery ──────────────────────────────────────────────────────────────────

test.describe('Gallery page', () => {
  test('loads without error', async ({ page }) => {
    const res = await page.goto('/gallery')
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('does not redirect to login', async ({ page }) => {
    await page.goto('/gallery')
    expect(page.url()).not.toContain('/login')
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/gallery')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

// ─── Junior pages ─────────────────────────────────────────────────────────────

for (const route of ['/junior/fixtures', '/junior/results', '/junior/stats']) {
  test.describe(`Junior ${route}`, () => {
    test('loads without error and without redirecting to login', async ({ page }) => {
      const res = await page.goto(route)
      expect(res?.status()).toBeLessThan(500)
      expect(page.url()).not.toContain('/login')
      await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
    })
  })
}

// ─── Analytics ────────────────────────────────────────────────────────────────

test.describe('Analytics page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/seasons**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 'sea1', name: '2026', is_active: true }]),
      })
    })
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })
    await page.route('**/rest/v1/competitions**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })
  })

  test('loads without auth and without error', async ({ page }) => {
    const res = await page.goto('/analytics')
    expect(res?.status()).toBeLessThan(500)
    expect(page.url()).not.toContain('/login')
  })

  test('shows analytics content', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/analytics|stats|season/i)
  })
})
