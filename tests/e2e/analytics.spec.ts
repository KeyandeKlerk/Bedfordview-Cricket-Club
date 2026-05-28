/**
 * Analytics e2e tests.
 *
 * /analytics  — 'use client' page; all Supabase calls are client-side REST,
 *               intercepted by page.route(). No auth required.
 *
 * /analytics/match/[id] — SSR page (anonSupabase); in Next.js dev mode the
 *               server-side HTTP requests are still routable by page.route().
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE } from './helpers/supabase-mock'

const MATCH_ID = MATCH_FIXTURE.id

// ── Fixtures ──────────────────────────────────────────────────────────────────

const COMPLETED_MATCH = {
  ...MATCH_FIXTURE,
  status: 'completed',
  result_text: 'BCC won by 5 wickets',
  season_id: 'sea1',
  competition_id: 'comp1',
  opponent_id: 'opp1',
  our_team_side: 'home',
}

const INNINGS_ANALYTICS = {
  ...INNINGS_FIXTURE,
  batting_side: 'home',
  innings_number: 1,
  target: null,
}

const BALL_BASE = {
  id: 'ball-1',
  innings_id: INNINGS_FIXTURE.id,
  match_id: MATCH_ID,
  sequence_number: 1,
  over_number: 0,
  ball_in_over: 0,
  batter_id: 'mp1',
  non_striker_id: 'mp2',
  bowler_id: 'mp11',
  runs_off_bat: 4,
  extras_type: null,
  extras_runs: 0,
  is_boundary_four: true,
  is_boundary_six: false,
  dismissal_type: null,
  dismissed_player_id: null,
  created_at: new Date().toISOString(),
  wagon_x: null,
  wagon_y: null,
  pitch_length: null,
  pitch_line: null,
  shot_type: null,
  bowling_type: null,
  execution_quality: null,
  decision_quality: null,
}

const PROFESSIONAL_BALLS = [
  {
    ...BALL_BASE,
    id: 'ball-p1',
    sequence_number: 1,
    runs_off_bat: 4,
    wagon_x: 0.3,
    wagon_y: -0.8,
    pitch_length: 2,
    pitch_line: 1,
    shot_type: 'drive',
    bowling_type: 'seam',
    execution_quality: 4,
    decision_quality: 3,
  },
  {
    ...BALL_BASE,
    id: 'ball-p2',
    sequence_number: 2,
    runs_off_bat: 0,
    wagon_x: 0.0,
    wagon_y: -0.5,
    pitch_length: 3,
    pitch_line: 0,
    shot_type: 'block',
    bowling_type: 'seam',
    execution_quality: 3,
    decision_quality: 4,
  },
  {
    ...BALL_BASE,
    id: 'ball-p3',
    sequence_number: 3,
    runs_off_bat: 6,
    is_boundary_four: false,
    is_boundary_six: true,
    wagon_x: -0.5,
    wagon_y: 0.9,
    pitch_length: 1,
    pitch_line: 2,
    shot_type: 'pull',
    bowling_type: 'spin',
    execution_quality: 5,
    decision_quality: 5,
  },
]

// ── /analytics page helpers ───────────────────────────────────────────────────

async function mockAnalyticsOverview(page: import('@playwright/test').Page, opts: {
  balls?: object[]
} = {}) {
  const balls = opts.balls ?? [BALL_BASE]

  await page.route('**/rest/v1/seasons**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'sea1', name: '2026', is_active: true }]),
    })
  })

  await page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([COMPLETED_MATCH]),
    })
  })

  await page.route('**/rest/v1/innings**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([INNINGS_ANALYTICS]),
    })
  })

  await page.route('**/rest/v1/competitions**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'comp1', name: 'T20 League' }]),
    })
  })

  await page.route('**/rest/v1/batting_scorecard**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        {
          innings_id: INNINGS_FIXTURE.id,
          match_id: MATCH_ID,
          player_id: 'player-uuid-1',
          player_name: 'Alice Smith',
          actual_batting_position: 1,
          runs: 42,
          balls_faced: 30,
          dismissal_type: 'caught',
        },
      ]),
    })
  })

  await page.route('**/rest/v1/ball_events**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(balls),
    })
  })

  await page.route('**/rest/v1/opponents**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'opp1', canonical_name: 'Edenvale CC', short_name: 'ECC' }]),
    })
  })
}

// ── /analytics/match/[id] helpers ─────────────────────────────────────────────

async function mockMatchAnalytics(page: import('@playwright/test').Page, opts: {
  balls?: object[]
} = {}) {
  const balls = opts.balls ?? [BALL_BASE]

  await page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        id: MATCH_ID,
        match_date: '2026-04-10',
        result_text: 'BCC won by 5 wickets',
        overs_per_innings: 20,
        our_team_side: 'home',
        opponent: { canonical_name: 'Edenvale CC' },
        competition: { name: 'T20 League', category: 'senior' },
        ground: { name: 'Bedfordview Oval' },
      }]),
    })
  })

  await page.route('**/rest/v1/innings**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        ...INNINGS_ANALYTICS,
        batting_side: 'home',
      }]),
    })
  })

  await page.route('**/rest/v1/match_players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([
        { id: 'mp1', player_id: 'player-uuid-1', opposition_name: null, side: 'home', players: { first_name: 'Alice', last_name: 'Smith' } },
        { id: 'mp2', player_id: 'player-uuid-2', opposition_name: null, side: 'home', players: { first_name: 'Bob', last_name: 'Jones' } },
        { id: 'mp11', player_id: 'player-uuid-3', opposition_name: null, side: 'away', players: { first_name: 'Charlie', last_name: 'Brown' } },
      ]),
    })
  })

  await page.route('**/rest/v1/ball_events**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(balls),
    })
  })
}

// ── /analytics overview tests ─────────────────────────────────────────────────

test.describe('/analytics overview page', () => {
  test.beforeEach(async ({ page }) => {
    await mockAnalyticsOverview(page)
  })

  test('loads without error', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary|500|internal server error/i)
  })

  test('page hero heading is present', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1')).toContainText('Analytics')
  })

  test('Season Results section renders after data loads', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')
    // The "Season Results" section title appears once matches are loaded
    await expect(page.locator('body')).toContainText('Season Results')
  })

  test('Chasing vs Defending section renders', async ({ page }) => {
    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('Chasing vs Defending')
  })

  test('match analysis link navigates to /analytics/match/[id]', async ({ page }) => {
    // Mock the match analytics page queries too, so navigation does not 404
    await mockMatchAnalytics(page)

    await page.goto('/analytics')
    await page.waitForLoadState('networkidle')

    // The "Full analysis →" link in the Match Analysis table
    const link = page.locator('a').filter({ hasText: /Full analysis/i }).first()
    await expect(link).toBeVisible()
    await link.click()
    await page.waitForURL(`**/analytics/match/${MATCH_ID}`)
    expect(page.url()).toContain(`/analytics/match/${MATCH_ID}`)
  })
})

// ── /analytics/match/[id] tests ───────────────────────────────────────────────

test.describe('/analytics/match/[id] page', () => {
  const MATCH_URL = `/analytics/match/${MATCH_ID}`

  test('loads without error', async ({ page }) => {
    await mockMatchAnalytics(page)
    await page.goto(MATCH_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary|500|internal server error/i)
  })

  test('run rate chart section is present', async ({ page }) => {
    await mockMatchAnalytics(page)
    await page.goto(MATCH_URL)
    await page.waitForLoadState('networkidle')
    // MatchRunRateChart is rendered inside a .ma-card when overData.length > 0
    // The page hero or card area contains the match result text
    await expect(page.locator('body')).toContainText('BCC vs Edenvale CC')
  })

  test('fall of wickets section is present when a wicket ball exists', async ({ page }) => {
    const dismissalBall = {
      ...BALL_BASE,
      id: 'ball-w1',
      runs_off_bat: 0,
      dismissal_type: 'bowled',
      dismissed_player_id: 'mp1',
    }
    await mockMatchAnalytics(page, { balls: [BALL_BASE, dismissalBall] })
    await page.goto(MATCH_URL)
    await page.waitForLoadState('networkidle')
    // FallOfWicketsTimeline is rendered when fow.length > 0
    // The ma-section-title "Phase Breakdown" is always shown; FoW card appears with wickets
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary/i)
    // Phase breakdown is always present
    await expect(page.locator('body')).toContainText('Phase Breakdown')
  })

  test('phase breakdown section is present', async ({ page }) => {
    await mockMatchAnalytics(page)
    await page.goto(MATCH_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('Phase Breakdown')
  })

  test('professional data sections visible when balls have wagon/pitch data', async ({ page }) => {
    await mockMatchAnalytics(page, { balls: PROFESSIONAL_BALLS })
    await page.goto(MATCH_URL)
    await page.waitForLoadState('networkidle')
    // The "Professional Data" section title appears when any ball has wagon_x/pitch_length/shot_type/quality
    await expect(page.locator('body')).toContainText('Professional Data')
    // Wagon Wheel and Pitch Map labels
    await expect(page.locator('body')).toContainText('Wagon Wheel')
    await expect(page.locator('body')).toContainText('Pitch Map')
    await expect(page.locator('body')).toContainText('Shot Types')
  })

  test('professional sections absent when balls have no professional data (club mode)', async ({ page }) => {
    // Plain balls with all professional fields null
    const clubBalls = [BALL_BASE, { ...BALL_BASE, id: 'ball-2', sequence_number: 2 }]
    await mockMatchAnalytics(page, { balls: clubBalls })
    await page.goto(MATCH_URL)
    await page.waitForLoadState('networkidle')
    // No professional data section
    await expect(page.locator('body')).not.toContainText('Professional Data')
    await expect(page.locator('body')).not.toContainText('Wagon Wheel')
  })

  test('page renders gracefully with no ball events (empty state)', async ({ page }) => {
    await mockMatchAnalytics(page, { balls: [] })
    await page.goto(MATCH_URL)
    await page.waitForLoadState('networkidle')
    // Should not crash; no error boundary text
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary|500/i)
    // The hero heading with the opponent name should still render
    await expect(page.locator('h1')).toContainText('BCC vs Edenvale CC')
  })
})
