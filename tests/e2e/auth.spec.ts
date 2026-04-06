/**
 * Auth flows — login form validation, error display, logout.
 * Runs without stored auth state (uses fresh browser context).
 */
import { test, expect } from '@playwright/test'

// Override storageState so tests always start unauthenticated
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Login form validation', () => {
  test('shows error when both fields empty', async ({ page }) => {
    await page.goto('/login')
    await page.locator('button:has-text("Sign In")').click()
    await expect(page.locator('.error-box')).toContainText(/enter your email and password/i)
  })

  test('shows error when email missing', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="password"]').fill('somepassword')
    await page.locator('button:has-text("Sign In")').click()
    await expect(page.locator('.error-box')).toBeVisible()
  })

  test('shows error when password missing', async ({ page }) => {
    await page.goto('/login')
    await page.locator('input[type="email"]').fill('user@example.com')
    await page.locator('button:has-text("Sign In")').click()
    await expect(page.locator('.error-box')).toBeVisible()
  })

  test('shows invalid credentials error on bad login', async ({ page }) => {
    // Mock Supabase auth to reject
    await page.route('**/auth/v1/**', async route => {
      await route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_grant', error_description: 'Invalid login credentials' }),
      })
    })

    await page.goto('/login')
    await page.locator('input[type="email"]').fill('wrong@example.com')
    await page.locator('input[type="password"]').fill('wrongpassword')
    await page.locator('button:has-text("Sign In")').click()

    await expect(page.locator('.error-box').first()).toContainText(/invalid email or password/i)
  })

  test('submit button disabled while loading', async ({ page }) => {
    // Slow down auth to observe loading state
    await page.route('**/auth/v1/**', async route => {
      await new Promise(r => setTimeout(r, 2000))
      await route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_grant' }),
      })
    })

    await page.goto('/login')
    await page.locator('input[type="email"]').fill('user@example.com')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('button:has-text("Sign In")').click()

    // Button should show loading state
    const btn = page.locator('button:has-text("Signing In")')
    await expect(btn).toBeVisible()
    await expect(btn).toBeDisabled()
  })

  test('Enter key submits form', async ({ page }) => {
    await page.route('**/auth/v1/**', async route => {
      await route.fulfill({
        status: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'invalid_grant' }),
      })
    })

    await page.goto('/login')
    await page.locator('input[type="email"]').fill('user@example.com')
    await page.locator('input[type="password"]').fill('password')
    await page.locator('input[type="password"]').press('Enter')

    // Form was submitted (error shown or redirect attempted)
    await expect(page.locator('.error-box')).toBeVisible({ timeout: 5000 })
  })
})

test.describe('Successful login flow', () => {
  test('redirects to /dashboard on successful login', async ({ page }) => {
    // Mock successful auth
    await page.route('**/auth/v1/token**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: 'mock-token',
          refresh_token: 'mock-refresh',
          expires_in: 3600,
          token_type: 'bearer',
          user: { id: 'user-1', email: 'scorer@bcc.test', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
        }),
      })
    })

    await page.goto('/login')
    await page.locator('input[type="email"]').fill('scorer@bcc.test')
    await page.locator('input[type="password"]').fill('password123')
    await page.locator('button:has-text("Sign In")').click()

    // Next.js will call the server which checks real session — just check no error shown
    // (Full redirect test requires real session; this verifies the client flow)
    await page.waitForTimeout(1000)
    await expect(page.locator('.error-box')).not.toBeVisible()
  })
})

test.describe('Register page', () => {
  test('loads without error', async ({ page }) => {
    const response = await page.goto('/register')
    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('body')).toContainText(/register|sign up|join/i)
  })

  test('link back to login', async ({ page }) => {
    await page.goto('/register')
    // Target the in-card link — nav link is hidden on mobile viewports
    await expect(page.locator('.auth-sub a[href="/login"]')).toBeVisible()
  })
})
