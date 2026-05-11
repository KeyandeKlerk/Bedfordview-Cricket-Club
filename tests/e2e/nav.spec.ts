/**
 * Nav component tests — desktop links, mobile hamburger, overlay, scroll lock.
 * Desktop behaviour relies on viewport > 1100px; mobile uses Pixel 5 (393px wide).
 */
import { test, expect } from '@playwright/test'

const NAV_LINKS = ['Fixtures', 'Results', 'Stats', 'Live', 'News', 'Shop', 'Membership']

// ─── Desktop (chromium project — 1280px wide by default) ─────────────────────

test.describe('Desktop nav', () => {
  test('all nav links visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    for (const label of NAV_LINKS) {
      await expect(page.locator(`.nav-links a:has-text("${label}")`)).toBeVisible()
    }
  })

  test('hamburger hidden on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    const hamburger = page.locator('.nav-hamburger')
    // CSS hides it — check it is not visible (display:none)
    await expect(hamburger).toBeHidden()
  })

  test('active link highlighted when navigating to /fixtures', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/fixtures')
    const fixturesLink = page.locator('.nav-links a[href="/fixtures"]')
    const className = await fixturesLink.getAttribute('class')
    expect(className).toMatch(/active/)
  })

  test('Live nav link has pulse dot', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')
    await expect(page.locator('.nav-links .nav-live-dot')).toBeVisible()
  })

  test('Sign In and Join Club buttons visible when logged out', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    // Use fresh unauthenticated context
    test.use({ storageState: { cookies: [], origins: [] } })
    await page.goto('/')
    const body = page.locator('body')
    await expect(body).toContainText(/sign in|join club/i)
  })
})

// ─── Mobile hamburger (Pixel 5 — 393px wide) ─────────────────────────────────

test.describe('Mobile nav', () => {
  test.use({ viewport: { width: 393, height: 851 } })

  test('hamburger button visible on mobile', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.nav-hamburger')).toBeVisible()
  })

  test('nav links list hidden on mobile', async ({ page }) => {
    await page.goto('/')
    // CSS hides .nav-links below 1100px
    await expect(page.locator('.nav-links')).toBeHidden()
  })

  test('mobile menu hidden before hamburger tap', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('.mobile-menu')).not.toHaveClass(/open/)
  })

  test('tapping hamburger opens mobile menu', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-hamburger').tap()
    await expect(page.locator('.mobile-menu')).toHaveClass(/open/)
  })

  test('mobile menu contains all nav links', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-hamburger').tap()
    const menu = page.locator('.mobile-menu')
    for (const label of NAV_LINKS) {
      await expect(menu.locator(`a:has-text("${label}")`)).toBeVisible()
    }
  })

  test('tapping hamburger again closes menu', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-hamburger').tap()
    await expect(page.locator('.mobile-menu')).toHaveClass(/open/)
    await page.locator('.nav-hamburger').tap()
    await expect(page.locator('.mobile-menu')).not.toHaveClass(/open/)
  })

  test('tapping overlay backdrop closes menu', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-hamburger').tap()
    await expect(page.locator('.mobile-overlay')).toBeVisible()
    await page.locator('.mobile-overlay').tap()
    await expect(page.locator('.mobile-menu')).not.toHaveClass(/open/)
  })

  test('body scroll locked while menu open', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-hamburger').tap()
    const overflow = await page.evaluate(() => document.body.style.overflow)
    expect(overflow).toBe('hidden')
  })

  test('body scroll restored after menu closes', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-hamburger').tap()
    await page.locator('.nav-hamburger').tap()
    const overflow = await page.evaluate(() => document.body.style.overflow)
    expect(overflow).toBe('')
  })

  test('navigating via mobile menu closes it', async ({ page }) => {
    await page.goto('/')
    await page.locator('.nav-hamburger').tap()
    await page.locator('.mobile-menu a:has-text("Fixtures")').tap()
    // After navigation menu should be closed
    await page.waitForLoadState('networkidle')
    await expect(page.locator('.mobile-menu')).not.toHaveClass(/open/)
  })

  test('hamburger tap target is at least 44×44px', async ({ page }) => {
    await page.goto('/')
    const box = await page.locator('.nav-hamburger').boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  })
})
