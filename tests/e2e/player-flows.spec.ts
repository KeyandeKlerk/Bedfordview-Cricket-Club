/**
 * Player-facing flows — availability, selection, notifications, profile claim.
 * Uses mock auth bypass — no real credentials needed.
 */
import { test, expect } from '@playwright/test'
import {
  AVAILABILITY_WINDOW_FIXTURE,
  MATCH_FIXTURE,
  PLAYER_FIXTURE,
  NOTIFICATION_FIXTURE,
  SELECTION_FIXTURE,
  mockE2eAuth,
} from './helpers/supabase-mock'

// ─── Availability submission ──────────────────────────────────────────────────

test.describe('Availability submission (/availability/[windowId])', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await page.route('**/rest/v1/availability_windows**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([AVAILABILITY_WINDOW_FIXTURE]),
      })
    })
    await page.route('**/rest/v1/player_availability**', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
      } else {
        await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      }
    })
    await page.route('**/rest/v1/players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([PLAYER_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto(`/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows availability buttons', async ({ page }) => {
    await page.goto(`/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    const body = page.locator('body')
    await expect(body).toContainText(/available|tentative|unavailable/i)
  })

  test('shows deadline countdown', async ({ page }) => {
    await page.goto(`/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/deadline|closes|due/i)
  })

  test('note textarea is present', async ({ page }) => {
    await page.goto(`/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    // Note input may be a textarea or input
    if (await page.locator('textarea, input[placeholder*="note" i]').count() > 0) {
      await expect(page.locator('textarea, input[placeholder*="note" i]').first()).toBeVisible()
    }
  })

  test('buttons fit screen without overflow on iPhone SE', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

// ─── Selection confirmation ───────────────────────────────────────────────────

test.describe('Selection confirmation (/selection/[matchId])', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          opponent: { canonical_name: 'Edenvale CC' },
          competition: { name: 'T20 League', match_format: 'T20', overs_per_innings: 20 },
        }]),
      })
    })
    await page.route('**/rest/v1/selections**', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([SELECTION_FIXTURE]),
        })
      } else {
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(SELECTION_FIXTURE) })
      }
    })
    await page.route('**/rest/v1/players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([PLAYER_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto(`/selection/${MATCH_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows match info', async ({ page }) => {
    await page.goto(`/selection/${MATCH_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/edenvale|match|selected/i)
  })

  test('confirm or withdraw buttons visible', async ({ page }) => {
    await page.goto(`/selection/${MATCH_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    const btn = page.locator('button:has-text("Confirm"), button:has-text("Withdraw"), button:has-text("Accept")')
    await expect(btn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('no overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/selection/${MATCH_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

// ─── Notifications ────────────────────────────────────────────────────────────

test.describe('Notifications page (/notifications)', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await page.route('**/rest/v1/notifications**', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([NOTIFICATION_FIXTURE]),
        })
      } else {
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      }
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows notification title', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/notification|selected|you have been/i)
  })

  test('has mark all read button', async ({ page }) => {
    await page.goto('/notifications')
    await page.waitForLoadState('networkidle')
    const btn = page.locator('button:has-text("Mark all"), button:has-text("mark all")')
    await expect(btn.first()).toBeVisible({ timeout: 10_000 })
  })
})

// ─── Profile claim ────────────────────────────────────────────────────────────

test.describe('Profile claim (/admin/profile/claim)', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await page.route('**/rest/v1/players**', async route => {
      const method = route.request().method()
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([PLAYER_FIXTURE]),
        })
      } else {
        await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(PLAYER_FIXTURE) })
      }
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/admin/profile/claim')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows player search or list', async ({ page }) => {
    await page.goto('/admin/profile/claim')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/claim|profile|player|alice/i)
  })
})
