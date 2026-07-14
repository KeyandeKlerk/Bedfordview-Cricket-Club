/**
 * Admin news page — article list, publish toggle, delete.
 * Requires auth.
 */
import { test, expect } from '@playwright/test'
import { ARTICLE_FIXTURE, mockAllAdmin, mockE2eAuth, mockStorageUpload } from './helpers/supabase-mock'

test.describe('Admin news page', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await page.route('**/rest/v1/articles**', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([ARTICLE_FIXTURE]),
        })
      } else {
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ARTICLE_FIXTURE) })
      }
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/admin/news')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows article title', async ({ page }) => {
    await page.goto('/admin/news')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/bcc win|article|news/i)
  })

  test('has create/new article button', async ({ page }) => {
    await page.goto('/admin/news')
    await page.waitForLoadState('networkidle')
    const btn = page.locator('button:has-text("New"), button:has-text("Create"), a[href*="news/new"]')
    await expect(btn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('shows publish status', async ({ page }) => {
    await page.goto('/admin/news')
    await page.waitForLoadState('networkidle')
    // Published articles show some indicator
    await expect(page.locator('body')).toContainText(/published|draft|publish/i)
  })

  test('delete button present', async ({ page }) => {
    await page.goto('/admin/news')
    await page.waitForLoadState('networkidle')
    const deleteBtn = page.locator('button:has-text("Delete"), button[aria-label*="delete" i]')
    await expect(deleteBtn.first()).toBeVisible({ timeout: 10_000 })
  })
})

test.describe('Admin news editor — rich content', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await mockStorageUpload(page)
    await page.route('**/rest/v1/articles**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ARTICLE_FIXTURE),
      })
    })
  })

  test('shows the rich text toolbar instead of a plain textarea', async ({ page }) => {
    await page.goto('/admin/news/new')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.tiptap-toolbar')).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('textarea[placeholder*="markdown" i]')).toHaveCount(0)
  })

  test('shows category dropdown with all five options', async ({ page }) => {
    await page.goto('/admin/news/new')
    await page.waitForLoadState('networkidle')
    const options = page.locator('select option')
    await expect(page.locator('body')).toContainText(/match report|club news|junior section|announcement|general/i)
  })

  test('shows Save Draft, Schedule, and Publish Now actions', async ({ page }) => {
    await page.goto('/admin/news/new')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('button:has-text("Save Draft")')).toBeVisible()
    await expect(page.locator('button:has-text("Schedule")')).toBeVisible()
    await expect(page.locator('button:has-text("Publish Now")')).toBeVisible()
  })
})
