/**
 * Results detail / scorecard page (/results/[id]).
 * Server-rendered ISR — mocks Supabase REST calls.
 */
import { test, expect } from '@playwright/test'

const MATCH_ID = 'match-uuid-scorecard'

function setupScorecardMocks(page: import('@playwright/test').Page) {
  page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: MATCH_ID,
        match_date: '2026-03-15',
        status: 'completed',
        our_team_side: 'home',
        overs_per_innings: 20,
        free_hit_on_no_ball: true,
        result_text: 'BCC won by 34 runs',
        opponent: { canonical_name: 'Edenvale CC' },
        ground: { name: 'Bedfordview Oval' },
        competition: { name: 'T20 League', match_format: 'T20', overs_per_innings: 20 },
      }),
    })
  })

  page.route('**/rest/v1/innings**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 'inn1', match_id: MATCH_ID, innings_number: 1, batting_side: 'bcc', batting_team: 'bcc', status: 'completed', runs: 156, wickets: 8, overs_completed: 20 },
        { id: 'inn2', match_id: MATCH_ID, innings_number: 2, batting_side: 'opp', batting_team: 'opp', status: 'completed', runs: 122, wickets: 10, overs_completed: 18 },
      ]),
    })
  })

  page.route('**/rest/v1/match_players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 'mp1', match_id: MATCH_ID, player_id: 'p1', batting_order: 1, first_name: 'Alice', last_name: 'Smith', is_captain: true, is_keeper: false, team_side: 'bcc' },
        { id: 'mp2', match_id: MATCH_ID, player_id: 'p2', batting_order: 2, first_name: 'Bob', last_name: 'Jones', is_captain: false, is_keeper: false, team_side: 'bcc' },
      ]),
    })
  })

  page.route('**/rest/v1/ball_events**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  page.route('**/rest/v1/players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 'p1', first_name: 'Alice', last_name: 'Smith' },
        { id: 'p2', first_name: 'Bob', last_name: 'Jones' },
      ]),
    })
  })
}

test.describe('Results scorecard page', () => {
  test.beforeEach(async ({ page }) => {
    setupScorecardMocks(page)
  })

  test('loads without error', async ({ page }) => {
    const res = await page.goto(`/results/${MATCH_ID}`)
    expect(res?.status()).toBeLessThan(500)
    await expect(page.locator('body')).not.toContainText(/500|internal server error/i)
  })

  test('shows opponent name in page', async ({ page }) => {
    await page.goto(`/results/${MATCH_ID}`)
    await expect(page.locator('body')).toContainText(/edenvale cc/i)
  })

  test('shows match date', async ({ page }) => {
    await page.goto(`/results/${MATCH_ID}`)
    await expect(page.locator('body')).toContainText(/2026|march|15/i)
  })

  test('batting table columns are present', async ({ page }) => {
    await page.goto(`/results/${MATCH_ID}`)
    const body = page.locator('body')
    // Standard scorecard column headers
    await expect(body).toContainText(/runs|balls|4s|6s/i)
  })

  test('bowling table columns are present', async ({ page }) => {
    await page.goto(`/results/${MATCH_ID}`)
    const body = page.locator('body')
    await expect(body).toContainText(/overs|wickets|econ/i)
  })

  test('no horizontal overflow on desktop', async ({ page }) => {
    await page.goto(`/results/${MATCH_ID}`)
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth)
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth)
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1)
  })
})

test.describe('Results scorecard — unknown ID', () => {
  test('unknown match ID shows error, not crash', async ({ page }) => {
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(null),
      })
    })

    const res = await page.goto('/results/00000000-0000-0000-0000-000000000000')
    // Should be a 404 or error page, not a 500
    expect(res?.status()).not.toBe(500)
    const body = await page.locator('body').textContent()
    expect(body).not.toMatch(/at Object\.<anonymous>|at Module\._compile/)
  })
})
