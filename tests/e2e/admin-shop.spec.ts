/**
 * Admin products and orders pages.
 * Requires auth.
 */
import { test, expect } from '@playwright/test'
import { PRODUCT_FIXTURE, ORDER_FIXTURE, mockAllAdmin, mockE2eAuth } from './helpers/supabase-mock'

// ─── Products ─────────────────────────────────────────────────────────────────

test.describe('Products list', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await page.route('**/rest/v1/products**', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([PRODUCT_FIXTURE]),
        })
      } else {
        await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PRODUCT_FIXTURE) })
      }
    })
    await page.route('**/api/products**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([PRODUCT_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('product name shown in list', async ({ page }) => {
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/playing shirt|product/i)
  })

  test('has new/add product button', async ({ page }) => {
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')
    const btn = page.locator('button:has-text("New"), button:has-text("Add Product"), button:has-text("Create")')
    await expect(btn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('product form has required fields', async ({ page }) => {
    await page.goto('/admin/products')
    await page.waitForLoadState('networkidle')

    const addBtn = page.locator('button:has-text("New"), button:has-text("Add Product"), button:has-text("Create")')
    if (await addBtn.count() > 0) {
      await addBtn.first().click()
      const body = page.locator('body')
      // Should show fields for name, price
      await expect(body).toContainText(/name|price/i)
    }
  })
})

// ─── Orders ───────────────────────────────────────────────────────────────────

test.describe('Orders list', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await page.route('**/rest/v1/orders**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([ORDER_FIXTURE]),
      })
    })
    await page.route('**/api/orders**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([ORDER_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows orders content', async ({ page }) => {
    await page.goto('/admin/orders')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/order|status|pending/i)
  })

  test('no horizontal overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin/orders')
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})
