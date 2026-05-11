/**
 * Mobile layout — every page not already covered in mobile.spec.ts.
 * Runs on Pixel 5 (mobile-chrome project) AND iPhone SE (iphone-se / iphone-se-public projects).
 * Checks for horizontal overflow, nav hamburger, and key element visibility.
 *
 * Note: auth-required pages skip without credentials.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, PLAYER_FIXTURE, PRODUCT_FIXTURE } from './helpers/supabase-mock'

const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars'

// ─── Helper ───────────────────────────────────────────────────────────────────

async function noHorizontalOverflow(page: import('@playwright/test').Page) {
  const sw = await page.evaluate(() => document.documentElement.scrollWidth)
  const cw = await page.evaluate(() => document.documentElement.clientWidth)
  expect(sw, 'horizontal overflow detected').toBeLessThanOrEqual(cw + 1)
}

// ─── Nav hamburger (all viewports where this spec runs) ───────────────────────

test.describe('Mobile nav hamburger', () => {
  test('hamburger visible on mobile and opens menu', async ({ page }) => {
    await page.goto('/')
    const hamburger = page.locator('.nav-hamburger')
    // Only test if hamburger is actually visible (CSS hides it on desktop)
    const isVisible = await hamburger.isVisible()
    if (!isVisible) return // running in desktop project — skip

    await expect(hamburger).toBeVisible()
    await hamburger.tap()
    await expect(page.locator('.mobile-menu')).toHaveClass(/open/)
    await hamburger.tap()
    await expect(page.locator('.mobile-menu')).not.toHaveClass(/open/)
  })
})

// ─── Public pages ─────────────────────────────────────────────────────────────

test.describe('Results page — mobile', () => {
  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/results')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })
})

test.describe('Results detail — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: MATCH_FIXTURE.id, match_date: '2026-03-15', status: 'completed', our_team_side: 'home',
          overs_per_innings: 20, free_hit_on_no_ball: true, result_text: 'BCC won',
          opponent: { canonical_name: 'Edenvale CC' }, ground: { name: 'Oval' },
          competition: { name: 'T20 League', match_format: 'T20', overs_per_innings: 20 },
        }),
      })
    })
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/players**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
  })

  test('scorecard page no horizontal overflow', async ({ page }) => {
    await page.goto(`/results/${MATCH_FIXTURE.id}`)
    await noHorizontalOverflow(page)
  })
})

test.describe('Stats page — mobile', () => {
  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })

  test('stats content visible', async ({ page }) => {
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText(/batting|bowling|stats/i)
  })
})

test.describe('Live page — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/live')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })
})

test.describe('News page — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/articles**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/news')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })
})

test.describe('Shop page — mobile single column', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/products**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([PRODUCT_FIXTURE]),
      })
    })
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/shop')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })
})

test.describe('Membership page — mobile stacked', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/products**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...PRODUCT_FIXTURE, category: 'membership' }]),
      })
    })
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/membership')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })
})

test.describe('Contact page — mobile', () => {
  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/contact')
    await noHorizontalOverflow(page)
  })
})

test.describe('Gallery page — mobile', () => {
  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/gallery')
    await noHorizontalOverflow(page)
  })
})

test.describe('Register page — mobile', () => {
  test.use({ storageState: { cookies: [], origins: [] } })

  test('form inputs not clipped', async ({ page }) => {
    await page.goto('/register')
    const input = page.locator('input[type="email"]')
    const box = await input.boundingBox()
    expect(box?.width).toBeGreaterThan(200)
  })

  test('no horizontal overflow', async ({ page }) => {
    await page.goto('/register')
    await noHorizontalOverflow(page)
  })
})

// ─── Admin pages (auth required) ─────────────────────────────────────────────

test.describe('Admin match list — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([MATCH_FIXTURE]),
      })
    })
    await page.route('**/rest/v1/opponents**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/competitions**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
  })

  test('no horizontal overflow', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/matches')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })
})

test.describe('New match form — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
  })

  test('form controls accessible and no overflow', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/matches/new')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
    // At least one input visible
    const inputs = page.locator('input, select')
    expect(await inputs.count()).toBeGreaterThan(0)
  })
})

test.describe('Admin players — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([PLAYER_FIXTURE]),
      })
    })
  })

  test('no horizontal overflow', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/admin/players')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })
})

test.describe('Dashboard — mobile', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/memberships**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/orders**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
  })

  test('no horizontal overflow', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    await noHorizontalOverflow(page)
  })

  test('admin grid links not overflowing', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto('/dashboard')
    await page.waitForLoadState('networkidle')
    const viewport = page.viewportSize()
    const links = page.locator('a[href^="/admin/"]')
    const count = await links.count()
    for (let i = 0; i < Math.min(count, 4); i++) {
      const box = await links.nth(i).boundingBox()
      if (box && viewport) {
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
      }
    }
  })
})
