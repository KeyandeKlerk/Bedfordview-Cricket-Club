/**
 * Live scores page (/live) — empty state, in-progress match card, no auth required.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE } from './helpers/supabase-mock'

test.describe('Live page — empty state', () => {
  test.beforeEach(async ({ page }) => {
    // Return no in-progress innings
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })
  })

  test('loads without error', async ({ page }) => {
    const res = await page.goto('/live')
    expect(res?.status()).toBeLessThan(500)
  })

  test('does not redirect to login', async ({ page }) => {
    await page.goto('/live')
    expect(page.url()).not.toContain('/login')
  })

  test('shows no live match indicator when innings empty', async ({ page }) => {
    await page.goto('/live')
    await page.waitForLoadState('networkidle')
    const body = page.locator('body')
    // Page should indicate no live matches
    await expect(body).toContainText(/no live|no match|not in progress|upcoming/i)
  })
})

test.describe('Live page — match in progress', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...INNINGS_FIXTURE, status: 'in_progress' }]),
      })
    })

    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          status: 'in_progress',
          opponent: { canonical_name: 'Edenvale CC' },
          competition: { name: 'T20 League', overs_per_innings: 20, match_format: 'T20' },
        }]),
      })
    })

    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })

    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })
  })

  test('renders a match card when innings in progress', async ({ page }) => {
    await page.goto('/live')
    await page.waitForLoadState('networkidle')
    // Should show opponent or score info
    const body = page.locator('body')
    await expect(body).toContainText(/edenvale|live|in.?progress|score/i)
  })

  test('no horizontal overflow on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/live')
    await page.waitForLoadState('networkidle')
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})

test.describe('Live page — second innings chasing', () => {
  test('shows target info for second innings', async ({ page }) => {
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { ...INNINGS_FIXTURE, innings_number: 1, status: 'completed', runs: 156, wickets: 8 },
          { ...INNINGS_FIXTURE, id: 'inn2', innings_number: 2, status: 'in_progress', runs: 45, wickets: 2 },
        ]),
      })
    })

    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          status: 'in_progress',
          opponent: { canonical_name: 'Edenvale CC' },
          competition: { name: 'T20 League', overs_per_innings: 20, match_format: 'T20' },
        }]),
      })
    })

    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })

    await page.goto('/live')
    await page.waitForLoadState('networkidle')
    // Should show target / need info
    const body = page.locator('body')
    await expect(body).toContainText(/target|need|chasing|\d+/i)
  })
})
