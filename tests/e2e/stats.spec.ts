/**
 * Stats page e2e tests.
 *
 * /stats       — career batting/bowling/fielding tables (StatsContent component)
 * /stats/[id]  — individual player profile with 5 tabs
 *
 * Both pages are public (no auth required) but we still call mockE2eAuth to
 * avoid any auth-related side effects in SessionGuard or NotificationBell.
 *
 * Supabase queries are intercepted at the REST layer; no real database needed.
 */
import { test, expect } from '@playwright/test'
import { mockE2eAuth } from './helpers/supabase-mock'

// ── Shared fixture data ────────────────────────────────────────────────────────

const PLAYER_ID = 'player-1'

const BATTING_ROW = {
  player_id: PLAYER_ID,
  player_name: 'Test Player',
  team_category: 'senior',
  matches: 12,
  innings: 11,
  not_outs: 2,
  total_runs: 340,
  highest_score: 78,
  fifties: 3,
  hundreds: 0,
  ducks: 1,
  fours: 28,
  sixes: 4,
  balls_faced: 410,
  dismissals: 9,
  average: 37.78,
  strike_rate: 82.93,
}

const BOWLING_ROW = {
  player_id: PLAYER_ID,
  player_name: 'Test Player',
  team_category: 'senior',
  matches: 12,
  legal_balls: 144,
  runs_conceded: 210,
  wickets: 8,
  maidens: 2,
  best_bowling_wickets: 3,
  best_bowling_runs: 24,
  wides: 6,
  no_balls: 2,
  boundaries: 18,
  economy: 8.75,
}

const FIELDING_ROW = {
  player_id: PLAYER_ID,
  player_name: 'Test Player',
  team_category: 'senior',
  matches: 12,
  catches: 5,
  caught_bowled: 1,
  stumpings: 0,
  run_outs: 2,
  total_dismissals: 8,
}

const PLAYER_INFO = {
  id: PLAYER_ID,
  first_name: 'Test',
  last_name: 'Player',
  nickname: null,
  batting_style: 'Right-hand bat',
  bowling_style: 'Right-arm medium',
  is_active: true,
}

// ── Route setup helpers ────────────────────────────────────────────────────────

/**
 * Mock all queries made by StatsContent on /stats.
 * Primary path: career view (no season filter, senior category).
 */
async function setupStatsRoutes(page: import('@playwright/test').Page) {
  // Seasons + competitions — loaded on mount
  await page.route('**/rest/v1/seasons**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'sea1', name: '2026', is_active: true }]),
    })
  })
  await page.route('**/rest/v1/competitions**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'comp1', name: 'T20 League', season_id: 'sea1', type: 'league', category: 'senior' }]),
    })
  })

  // Career stats views (triggered when selectedSeasonId === 'career')
  await page.route('**/rest/v1/career_batting_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([BATTING_ROW]),
    })
  })
  await page.route('**/rest/v1/career_bowling_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([BOWLING_ROW]),
    })
  })
  await page.route('**/rest/v1/career_fielding_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([FIELDING_ROW]),
    })
  })

  // Season stats views (in case active-season filter fires after load)
  await page.route('**/rest/v1/season_batting_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([BATTING_ROW]),
    })
  })
  await page.route('**/rest/v1/season_bowling_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([BOWLING_ROW]),
    })
  })
  await page.route('**/rest/v1/season_fielding_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([FIELDING_ROW]),
    })
  })
}

/**
 * Mock all queries made by the PlayerProfilePage on /stats/[id].
 * Returns empty arrays for ball-level data so derived metrics stay null/zero.
 */
async function setupProfileRoutes(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([PLAYER_INFO]),
    })
  })

  await page.route('**/rest/v1/career_batting_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ ...BATTING_ROW, team_category: 'senior' }]),
    })
  })
  await page.route('**/rest/v1/career_bowling_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ ...BOWLING_ROW, team_category: 'senior' }]),
    })
  })
  await page.route('**/rest/v1/career_fielding_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ ...FIELDING_ROW, team_category: 'senior' }]),
    })
  })

  // Season-level stats
  await page.route('**/rest/v1/season_batting_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/season_bowling_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/season_fielding_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  // Scorecard views
  await page.route('**/rest/v1/batting_scorecard**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/bowling_scorecard**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  // Reliability view
  await page.route('**/rest/v1/player_reliability**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  // Match-level data (matches, match_players, opponents, ball_events)
  await page.route('**/rest/v1/matches**', async route => {
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
  await page.route('**/rest/v1/opponents**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/ball_events**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  // Wave 4 analytics views (loaded on matchups/advanced tab)
  await page.route('**/rest/v1/batter_bowler_matchups**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/phase_batting_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/phase_bowling_stats**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/scoring_intent**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
  await page.route('**/rest/v1/dismissal_analysis**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })
}

// ── /stats page tests ──────────────────────────────────────────────────────────

test.describe('/stats page', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await setupStatsRoutes(page)
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary|500|internal server error/i)
  })

  test('batting table renders with at least one row', async ({ page }) => {
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')

    // Wait for the loading state to clear
    await expect(page.getByText('Loading stats…')).not.toBeVisible({ timeout: 10000 }).catch(() => {})

    // The player name must appear in the table
    await expect(page.getByRole('link', { name: 'Test Player' }).first()).toBeVisible()
  })

  test('bowling table renders with at least one row', async ({ page }) => {
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')

    // Switch to bowling tab
    await page.locator('button').filter({ hasText: /^.*Bowling$/ }).first().click()
    await expect(page.getByText('Loading stats…')).not.toBeVisible({ timeout: 10000 }).catch(() => {})

    await expect(page.getByRole('link', { name: 'Test Player' }).first()).toBeVisible()
  })

  test('player name in batting table is a link to /stats/[id]', async ({ page }) => {
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')
    await expect(page.getByText('Loading stats…')).not.toBeVisible({ timeout: 10000 }).catch(() => {})

    const playerLink = page.getByRole('link', { name: 'Test Player' }).first()
    await expect(playerLink).toHaveAttribute('href', `/stats/${PLAYER_ID}`)
  })
})

// ── /stats/[id] page tests ─────────────────────────────────────────────────────

test.describe('/stats/[id] page', () => {
  test.beforeEach(async ({ page }) => {
    await mockE2eAuth(page)
    await setupProfileRoutes(page)
  })

  test('loads without error', async ({ page }) => {
    await page.goto(`/stats/${PLAYER_ID}`)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary|500|internal server error/i)
    // Should show player name, not "not found"
    await expect(page.getByText('Player Not Found')).not.toBeVisible()
  })

  test('all 5 tabs are present', async ({ page }) => {
    await page.goto(`/stats/${PLAYER_ID}`)
    await page.waitForLoadState('networkidle')

    for (const tabLabel of ['Batting', 'Bowling', 'Fielding', 'Matchups', 'Advanced']) {
      await expect(
        page.locator('button.profile-tab').filter({ hasText: tabLabel })
      ).toBeVisible()
    }
  })

  test('switching to Bowling tab changes displayed content', async ({ page }) => {
    await page.goto(`/stats/${PLAYER_ID}`)
    await page.waitForLoadState('networkidle')

    // Batting tab is active by default — career batting panel should be visible
    // (look for text that is specific to the batting view)
    const battingPanel = page.locator('text=No batting data recorded yet.').or(
      page.locator('.career-card-lbl').filter({ hasText: /Innings|Average|Strike Rate/i })
    )

    // Click Bowling tab
    await page.locator('button.profile-tab').filter({ hasText: 'Bowling' }).click()

    // Bowling-specific content must now be present
    // The bowling career panel shows "Wickets", "Economy", or "No bowling data recorded yet."
    const bowlingContent = page.locator('text=No bowling data recorded yet.').or(
      page.locator('.career-card-lbl').filter({ hasText: /Wickets|Economy|Overs/i })
    )
    await expect(bowlingContent.first()).toBeVisible({ timeout: 5000 })
  })
})

// ── Mobile — no horizontal overflow ───────────────────────────────────────────

test.describe('Mobile — no horizontal overflow', () => {
  test.use({ viewport: { width: 375, height: 667 } })

  test('/stats page has no horizontal overflow on iPhone SE (375×667)', async ({ page }) => {
    await mockE2eAuth(page)
    await setupStatsRoutes(page)
    await page.goto('/stats')
    await page.waitForLoadState('networkidle')

    const scrollWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(scrollWidth).toBeLessThanOrEqual(375)
  })
})
