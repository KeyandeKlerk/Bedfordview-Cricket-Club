/**
 * Registration form — full field validation, dropdowns, success state.
 * Always runs unauthenticated.
 */
import { test, expect } from '@playwright/test'

test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Register page structure', () => {
  test('shows "Join the Club" heading', async ({ page }) => {
    const res = await page.goto('/register')
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('.auth-title')).toContainText(/join the club/i)
  })

  test('has link back to login inside card', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('.auth-sub a[href="/login"]')).toBeVisible()
  })

  test('all required fields present', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('input[placeholder*="full name" i]')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[type="password"]').first()).toBeVisible()
    // Confirm password field
    await expect(page.locator('input[placeholder*="repeat password" i]')).toBeVisible()
  })

  test('batting style dropdown has options', async ({ page }) => {
    await page.goto('/register')
    const select = page.locator('select').first()
    const options = await select.locator('option').count()
    expect(options).toBeGreaterThan(1)
  })

  test('bowling style dropdown has options', async ({ page }) => {
    await page.goto('/register')
    const selects = page.locator('select')
    const count = await selects.count()
    expect(count).toBeGreaterThanOrEqual(2)
    const options = await selects.nth(1).locator('option').count()
    expect(options).toBeGreaterThan(1)
  })

  test('submit button shows "Create Account"', async ({ page }) => {
    await page.goto('/register')
    await expect(page.locator('button:has-text("Create Account")')).toBeVisible()
  })
})

test.describe('Register form validation', () => {
  test('shows error when required fields empty', async ({ page }) => {
    await page.goto('/register')
    await page.locator('button:has-text("Create Account")').click()
    await expect(page.locator('.error-box')).toContainText(/fill in all required|required/i)
  })

  test('shows error when passwords do not match', async ({ page }) => {
    await page.goto('/register')
    await page.locator('input[placeholder*="full name" i]').fill('Test User')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[placeholder*="repeat password" i]').fill('differentpassword')
    await page.locator('button:has-text("Create Account")').click()
    await expect(page.locator('.error-box')).toContainText(/passwords do not match/i)
  })

  test('shows error when password is too short', async ({ page }) => {
    await page.goto('/register')
    await page.locator('input[placeholder*="full name" i]').fill('Test User')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('short')
    await page.locator('input[placeholder*="repeat password" i]').fill('short')
    await page.locator('button:has-text("Create Account")').click()
    await expect(page.locator('.error-box')).toContainText(/at least 8 characters/i)
  })

  test('button shows loading state during submission', async ({ page }) => {
    // Slow down registration API to observe loading state
    await page.route('**/api/auth/register', async route => {
      await new Promise(r => setTimeout(r, 1500))
      await route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email already registered' }),
      })
    })

    await page.goto('/register')
    await page.locator('input[placeholder*="full name" i]').fill('Test User')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[placeholder*="repeat password" i]').fill('password123')
    await page.locator('button:has-text("Create Account")').click()

    await expect(page.locator('button:has-text("Creating Account")')).toBeVisible()
    await expect(page.locator('button:has-text("Creating Account")')).toBeDisabled()
  })

  test('shows API error message', async ({ page }) => {
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email already registered' }),
      })
    })

    await page.goto('/register')
    await page.locator('input[placeholder*="full name" i]').fill('Test User')
    await page.locator('input[type="email"]').fill('test@example.com')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[placeholder*="repeat password" i]').fill('password123')
    await page.locator('button:has-text("Create Account")').click()

    await expect(page.locator('.error-box')).toContainText(/email already registered/i)
  })

  test('successful registration shows welcome card', async ({ page }) => {
    await page.route('**/api/auth/register', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      })
    })
    // Mock sign-in to fail so we see the success card (not redirect)
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_grant' }),
      })
    })

    await page.goto('/register')
    await page.locator('input[placeholder*="full name" i]').fill('Alice Smith')
    await page.locator('input[type="email"]').fill('alice@example.com')
    await page.locator('input[type="password"]').first().fill('password123')
    await page.locator('input[placeholder*="repeat password" i]').fill('password123')
    await page.locator('button:has-text("Create Account")').click()

    await expect(page.locator('.success-title')).toContainText(/welcome/i)
    await expect(page.locator('a[href="/login"]')).toBeVisible()
  })
})
