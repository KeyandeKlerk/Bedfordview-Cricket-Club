/**
 * Auth setup — runs once before authenticated test projects.
 * Performs a real login using TEST_USER_EMAIL / TEST_USER_PASSWORD env vars,
 * then saves the browser storage state so other tests can reuse the session.
 *
 * Usage:
 *   TEST_USER_EMAIL=scorer@bcc.test TEST_USER_PASSWORD=secret npx playwright test
 *
 * If env vars are not set the setup is skipped and a minimal stub file is written,
 * allowing public/unauthenticated tests to still run in CI without credentials.
 */
import { test as setup, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const AUTH_FILE = path.join(__dirname, '.auth/user.json')

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD

  if (!email || !password) {
    // Write an empty storage state so dependent projects don't crash
    fs.mkdirSync(path.dirname(AUTH_FILE), { recursive: true })
    fs.writeFileSync(AUTH_FILE, JSON.stringify({ cookies: [], origins: [] }))
    console.warn(
      '\n⚠  TEST_USER_EMAIL / TEST_USER_PASSWORD not set — auth setup skipped.\n' +
      '   Authenticated tests will likely fail. Set env vars to run them.\n'
    )
    return
  }

  await page.goto('/login')
  await expect(page.locator('.auth-title')).toContainText('Sign In')

  await page.locator('input[type="email"]').fill(email)
  await page.locator('input[type="password"]').fill(password)
  await page.locator('button.btn-submit, button:has-text("Sign In")').click()

  // Should redirect to dashboard
  await page.waitForURL('**/dashboard', { timeout: 15_000 })
  await expect(page.locator('body')).not.toContainText('Invalid email or password')

  await page.context().storageState({ path: AUTH_FILE })
})
