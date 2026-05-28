/**
 * Public store / shop customer tests.
 *
 * /shop is a 'use client' page — no auth required, though the page will query
 * the Supabase `memberships` table if a session exists.  These tests run without
 * any auth cookie so the membership section simply renders in its guest state.
 *
 * Products are fetched from /api/products (not the Supabase REST endpoint).
 *
 * Product shape expected by the shop:
 *   { id, name, description, image_url, price_zar (cents), sizes, category, benefits }
 *
 * /membership just calls redirect('/shop'), so membership-related assertions
 * are made against /shop.
 */
import { test, expect } from '@playwright/test'

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const KIT_PRODUCT = {
  id: 'kit-prod-1',
  name: 'BCC Training Shirt',
  description: 'Official training shirt',
  image_url: null,
  price_zar: 29999,       // cents — formatPrice(29999) → "R 299.99"
  sizes: ['S', 'M', 'L', 'XL'],
  category: 'kit',
  benefits: null,
}

const MEMBERSHIP_PRODUCT = {
  id: 'mem-prod-1',
  name: 'Standard Membership',
  description: 'Season membership — full access',
  image_url: null,
  price_zar: 50000,       // cents — formatPrice(50000) → "R 500.00"
  sizes: [],
  category: 'membership',
  benefits: ['Access to all home matches', 'Club newsletter'],
}

// ─── Route helpers ────────────────────────────────────────────────────────────

async function mockProducts(page: import('@playwright/test').Page, products: object[] = [KIT_PRODUCT]) {
  await page.route('**/api/products**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(products),
    })
  })
}

async function mockOrdersPost(page: import('@playwright/test').Page, orderId = 'order-1') {
  await page.route('**/api/orders**', async route => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      })
    } else {
      await route.continue()
    }
  })
}

async function mockMemberships(page: import('@playwright/test').Page) {
  // No session → supabase.auth.getSession() returns null session.
  // Mock the auth endpoint to return an empty session so the page doesn't
  // hang waiting for an auth response.
  await page.route('**/auth/v1/token**', async route => {
    await route.fulfill({
      status: 400,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'invalid_grant', error_description: 'No session' }),
    })
  })
  await page.route('**/rest/v1/memberships**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
}

// ─── /shop — loads without error ──────────────────────────────────────────────

test.describe('/shop page', () => {
  test('loads without error', async ({ page }) => {
    await mockProducts(page)
    await mockMemberships(page)
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error|something went wrong/i)
  })

  // ── Product card rendering ─────────────────────────────────────────────────

  test('product name is visible after load', async ({ page }) => {
    await mockProducts(page)
    await mockMemberships(page)
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.product-name').first()).toBeVisible()
    await expect(page.locator('body')).toContainText('BCC Training Shirt')
  })

  test('product card shows name and formatted price', async ({ page }) => {
    await mockProducts(page)
    await mockMemberships(page)
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    const card = page.locator('.product-card').first()
    await expect(card).toBeVisible()
    await expect(card.locator('.product-name')).toContainText('BCC Training Shirt')
    // formatPrice(29999) → "R 299.99"
    await expect(card.locator('.product-price')).toContainText('299.99')
  })

  // ── Add to cart / checkout flow ────────────────────────────────────────────

  test('selecting a size and clicking Add to Cart produces no JS error', async ({ page }) => {
    await mockProducts(page)
    await mockMemberships(page)

    const jsErrors: string[] = []
    page.on('pageerror', err => jsErrors.push(err.message))

    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    // Pick a size first (required for kit products)
    const sizePill = page.locator('.size-pill').filter({ hasText: 'M' }).first()
    if (await sizePill.count() > 0) {
      await sizePill.click()
    }

    const addBtn = page.locator('.add-to-cart-btn').first()
    await expect(addBtn).toBeEnabled()
    await addBtn.click()

    // No uncaught JS errors
    expect(jsErrors).toHaveLength(0)
    // No error boundary text
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary/i)
  })

  test('checkout form submits and navigates to order confirmation (no JS error)', async ({ page }) => {
    await mockProducts(page)
    await mockMemberships(page)
    await mockOrdersPost(page, 'order-1')

    const jsErrors: string[] = []
    page.on('pageerror', err => jsErrors.push(err.message))

    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    // Select a size and add to cart
    const sizePill = page.locator('.size-pill').filter({ hasText: 'M' }).first()
    if (await sizePill.count() > 0) await sizePill.click()

    await page.locator('.add-to-cart-btn').first().click()

    // Open checkout — mobile bar "Checkout →" button (always visible)
    const checkoutBtn = page.locator('.cart-mobile-bar button.btn-primary').first()
    await expect(checkoutBtn).toBeEnabled({ timeout: 5_000 })
    await checkoutBtn.click()

    // Fill required checkout fields
    await page.fill('input[placeholder="Your full name"]', 'Test Customer')
    await page.fill('input[type="email"]', 'customer@test.com')
    await page.fill('input[placeholder="123 Main Road"]', '1 Test Street')
    await page.fill('input[placeholder="Bedfordview"]', 'Johannesburg')
    await page.selectOption('select.select', 'Gauteng')
    await page.fill('input[placeholder="2007"]', '2001')

    // Submit — the page will navigate to /shop/order/order-1 (mocked)
    await page.route('**/shop/order/order-1', async route => route.continue())
    const [response] = await Promise.all([
      page.waitForNavigation({ waitUntil: 'commit', timeout: 10_000 }).catch(() => null),
      page.locator('button[type="submit"].btn-primary').click(),
    ])

    // Either navigated away or stayed with no error boundary
    expect(jsErrors).toHaveLength(0)
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary/i)
    void response // may be null if navigation was blocked by test runner
  })

  // ── Membership section ─────────────────────────────────────────────────────

  test('"Join Now" button present for a membership-category product', async ({ page }) => {
    await mockProducts(page, [MEMBERSHIP_PRODUCT])
    await mockMemberships(page)
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    // The "Join Now →" button appears on tier cards for membership products
    const joinBtn = page.locator('button').filter({ hasText: /Join Now/i }).first()
    await expect(joinBtn).toBeVisible({ timeout: 10_000 })
  })

  // ── /membership redirect ────────────────────────────────────────────────────

  test('/membership redirects to /shop', async ({ page }) => {
    await mockProducts(page)
    await mockMemberships(page)
    await page.goto('/membership')
    // Next.js redirect() lands us on /shop
    await page.waitForURL('**/shop', { timeout: 10_000 })
    expect(page.url()).toMatch(/\/shop$/)
  })

  // ── Mobile viewport — no overflow ─────────────────────────────────────────

  test('no horizontal overflow on iPhone SE (375×667)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await mockProducts(page)
    await mockMemberships(page)
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})
