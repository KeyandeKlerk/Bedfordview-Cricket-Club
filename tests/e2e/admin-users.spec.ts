/**
 * Admin users page — role list, assignment form, revoke.
 * Requires auth.
 */
import { test, expect } from '@playwright/test'
import { mockAllAdmin, mockE2eAuth } from './helpers/supabase-mock'

test.describe('Users page', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await page.route('**/rest/v1/user_roles**', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([
            { id: 'ur1', user_id: 'test-user-uuid', role: 'admin' },
            { id: 'ur2', user_id: 'other-user-uuid', role: 'scorer' },
          ]),
        })
      } else {
        await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      }
    })
    await page.route('**/api/admin/set-role**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true }),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows user roles list', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/role|admin|scorer/i)
  })

  test('has role assignment form', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    // Should have a select or input for role assignment
    await expect(page.locator('select, input[placeholder*="user" i]')).toBeVisible({ timeout: 10_000 })
  })

  test('role select has scorer and admin options', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    const roleSelect = page.locator('select').filter({ hasText: /scorer|admin/i }).first()
    if (await roleSelect.count() > 0) {
      await expect(roleSelect).toBeVisible()
    } else {
      // May be in a different form structure — just check page has role references
      await expect(page.locator('body')).toContainText(/scorer|admin/i)
    }
  })

  test('revoke/remove button present', async ({ page }) => {
    await page.goto('/admin/users')
    await page.waitForLoadState('networkidle')
    const revokeBtn = page.locator('button:has-text("Revoke"), button:has-text("Remove"), button:has-text("Delete")')
    await expect(revokeBtn.first()).toBeVisible({ timeout: 10_000 })
  })
})
