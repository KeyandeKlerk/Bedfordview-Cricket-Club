/**
 * Admin availability — window list, create form, window detail.
 * All tests require real auth (server-side layout protection).
 * Data tables are mocked via route interception for isolation.
 */
import { test, expect } from '@playwright/test'
import { AVAILABILITY_WINDOW_FIXTURE, MATCH_FIXTURE, PLAYER_FIXTURE, mockAllAdmin, mockE2eAuth } from './helpers/supabase-mock'

// ─── Window list ──────────────────────────────────────────────────────────────

test.describe('Availability windows list', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await page.route('**/rest/v1/availability_windows**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([AVAILABILITY_WINDOW_FIXTURE]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows window title', async ({ page }) => {
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/weekend|availability|window/i)
  })

  test('shows Open badge for active window', async ({ page }) => {
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('Open')
  })

  test('has create/new window button', async ({ page }) => {
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    const btn = page.locator('button:has-text("New Window"), button:has-text("Create")')
    await expect(btn.first()).toBeVisible({ timeout: 10_000 })
  })

  test('toggling new window shows create form', async ({ page }) => {
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await page.locator('button:has-text("New Window")').first().click()
    await expect(page.locator('#av-title')).toBeVisible()
    await expect(page.locator('#av-deadline')).toBeVisible()
  })

  test('shows Closed section for past-deadline window', async ({ page }) => {
    const pastWindow = {
      ...AVAILABILITY_WINDOW_FIXTURE,
      id: 'window-past-1',
      title: 'Weekend 1 March',
      deadline: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      season: { name: '2026' },
    }
    await page.route('**/rest/v1/availability_windows**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([pastWindow]),
      })
    })
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('Closed')
  })

  test('create form validates deadline in the past', async ({ page }) => {
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    await page.locator('button:has-text("New Window")').first().click()

    // Fill in valid title + season
    await page.fill('#av-title', 'Test Window')
    // window_start / window_end = next week
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    const dateStr = nextWeek.toISOString().slice(0, 10)
    await page.fill('#av-start', dateStr)
    await page.fill('#av-end', dateStr)
    // Set a past deadline
    const pastDeadline = new Date(Date.now() - 60 * 60 * 1000)
      .toISOString()
      .slice(0, 16)
    await page.fill('#av-deadline', pastDeadline)
    await page.locator('button[type="submit"]').first().click()
    await expect(page.locator('body')).toContainText(/future|past/i, { timeout: 5_000 })
  })

  test('no overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/admin/availability')
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})

// ─── Window detail ────────────────────────────────────────────────────────────

test.describe('Availability window detail', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await mockAllAdmin(page)
    await page.route('**/rest/v1/availability_windows**', async route => {
      const url = route.request().url()
      // Return single object for .single() call, array otherwise
      if (url.includes('id=eq.')) {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(AVAILABILITY_WINDOW_FIXTURE),
        })
      } else {
        await route.fulfill({
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify([AVAILABILITY_WINDOW_FIXTURE]),
        })
      }
    })
    await page.route('**/rest/v1/player_availability**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            id: 'pa1',
            window_id: AVAILABILITY_WINDOW_FIXTURE.id,
            player_id: PLAYER_FIXTURE.id,
            status: 'available',
            note: null,
            submitted_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            player: { ...PLAYER_FIXTURE, user_id: 'test-user-uuid' },
          },
        ]),
      })
    })
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          availability_window_id: AVAILABILITY_WINDOW_FIXTURE.id,
          competition: { name: 'T20 League', category: 'senior' },
          opponent: { canonical_name: 'Edenvale CC' },
        }]),
      })
    })
    await page.route('**/rest/v1/selections**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ match_id: MATCH_FIXTURE.id, status: 'selected' }]),
      })
    })
    await page.route('**/rest/v1/players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...PLAYER_FIXTURE, user_id: 'test-user-uuid' }]),
      })
    })
  })

  test('loads window detail without error', async ({ page }) => {
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows player response summary chips', async ({ page }) => {
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/available|unavailable|tentative/i)
  })

  test('shows player name in response list', async ({ page }) => {
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('Alice')
  })

  test('shows XI selected indicator when active selections exist', async ({ page }) => {
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('XI selected')
  })

  test('shows XI not selected when only withdrawn selections exist', async ({ page }) => {
    // Override selections mock with withdrawn-only data
    await page.route('**/rest/v1/selections**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]), // filter status=selected returns empty
      })
    })
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('XI not selected yet')
  })

  test('linked match has "Select XI" link', async ({ page }) => {
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`a[href*="${MATCH_FIXTURE.id}/select"]`)).toBeVisible({ timeout: 10_000 })
  })

  test('no overflow on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(`/admin/availability/${AVAILABILITY_WINDOW_FIXTURE.id}`)
    await page.waitForLoadState('networkidle')
    const sw = await page.evaluate(() => document.documentElement.scrollWidth)
    const cw = await page.evaluate(() => document.documentElement.clientWidth)
    expect(sw).toBeLessThanOrEqual(cw + 1)
  })
})
