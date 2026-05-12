/**
 * Scorer reload + wicket regression tests.
 *
 * The bug: after a page reload mid-innings, React state variables opener1/opener2
 * reset to null. If the last recorded ball was a wicket (currentStrikerId=null from
 * computeInningsState), effectiveStrikerId fell to opener1 (null) and triggered the
 * "Waiting for innings setup..." guard — hiding the new-batter picker.
 *
 * Fix: the guard is skipped when needsNewBatter=true.
 *
 * These tests simulate reload by navigating fresh to the scorer page with mocked
 * ball_events that already include a dismissal as the last ball.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE } from './helpers/supabase-mock'

const SCORER_URL = `/admin/matches/${MATCH_FIXTURE.id}/score`
const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars'

const BASE_INNINGS = {
  ...INNINGS_FIXTURE,
  status: 'in_progress',
  batting_side: MATCH_FIXTURE.our_team_side, // 'home'
  target: null,
  bonus_runs: 0,
}

/** 6 normal dot balls establishing mp1 as striker, mp2 as non-striker, mp11 as bowler */
const NORMAL_BALLS = Array.from({ length: 6 }, (_, i) => ({
  id: `ball-${i + 1}`,
  innings_id: INNINGS_FIXTURE.id,
  match_id: MATCH_FIXTURE.id,
  sequence_number: i + 1,
  over_number: 0,
  ball_in_over: i,
  batter_id: 'mp1',
  non_striker_id: 'mp2',
  bowler_id: 'mp11',
  runs_off_bat: 0,
  extras_type: null,
  extras_runs: 0,
  is_boundary_four: false,
  is_boundary_six: false,
  dismissal_type: null,
  dismissed_player_id: null,
  fielder_id: null,
  fielder_substitute_name: null,
  penalty_reason: null,
  penalty_to_fielding: false,
  commentary: null,
  created_at: new Date().toISOString(),
}))

/** Wicket ball: striker (mp1) is bowled */
const WICKET_BALL = {
  id: 'ball-7',
  innings_id: INNINGS_FIXTURE.id,
  match_id: MATCH_FIXTURE.id,
  sequence_number: 7,
  over_number: 1,
  ball_in_over: 0,
  batter_id: 'mp1',
  non_striker_id: 'mp2',
  bowler_id: 'mp11',
  runs_off_bat: 0,
  extras_type: null,
  extras_runs: 0,
  is_boundary_four: false,
  is_boundary_six: false,
  dismissal_type: 'bowled',
  dismissed_player_id: 'mp1',
  fielder_id: null,
  fielder_substitute_name: null,
  penalty_reason: null,
  penalty_to_fielding: false,
  commentary: 'Bowled!',
  created_at: new Date().toISOString(),
}

/** Non-striker run-out ball: mp2 is run out */
const NON_STRIKER_RUNOUT_BALL = {
  ...WICKET_BALL,
  id: 'ball-7-ro',
  sequence_number: 7,
  dismissal_type: 'run_out',
  dismissed_player_id: 'mp2',   // non-striker is out
  fielder_id: 'f1',
}

async function setupCommonRoutes(page: import('@playwright/test').Page, balls: object[]) {
  await page.route('**/rest/v1/matches**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{
        ...MATCH_FIXTURE,
        toss_won_by: MATCH_FIXTURE.our_team_side,
        toss_decision: 'bat',
        opponent: { canonical_name: 'Edenvale CC' },
        competition: { name: 'T20 League' },
      }]),
    })
  })

  await page.route('**/rest/v1/innings**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([BASE_INNINGS]),
    })
  })

  // match_players intentionally empty — simulates reload with transient load
  // Phase short-circuit (in_progress + balls > 0) still routes to 'scoring'
  await page.route('**/rest/v1/match_players**', async route => {
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
      body: JSON.stringify(balls),
    })
  })

  await page.route('**/rest/v1/players**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
  })

  await page.route('**/rest/v1/selections**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
  })

  await page.route('**/rest/v1/rpc/acquire_scoring_lock**', async route => {
    await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(true) })
  })
}

// ── Reload + striker wicket ───────────────────────────────────────────────────

test.describe('Reload mid-innings — last ball was a striker wicket', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page, [...NORMAL_BALLS, WICKET_BALL])
  })

  test('does NOT show "Waiting for innings setup..." after reload with wicket as last ball', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Waiting for innings setup...')
  })

  test('shows "Choose next batter" prompt after reload with striker wicket', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    // needsNewBatter=true → "Wicket — Choose next batter →" button is shown
    await expect(
      page.locator('button').filter({ hasText: /Choose next batter/i }).first()
    ).toBeVisible()
  })

  test('does not show a crash or error boundary after reload + wicket', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary|500|internal server error/i)
  })

  test('run buttons 0-6 are NOT shown while new batter is required', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    // Run buttons are hidden when needsNewBatter=true
    const runBtns = page.locator('button').filter({ hasText: /^[0-6]$/ })
    expect(await runBtns.count()).toBe(0)
  })
})

// ── Reload + non-striker run-out ──────────────────────────────────────────────

test.describe('Reload mid-innings — last ball was a non-striker run-out', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommonRoutes(page, [...NORMAL_BALLS, NON_STRIKER_RUNOUT_BALL])
  })

  test('does NOT show "Waiting for innings setup..." when non-striker is out after reload', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Waiting for innings setup...')
  })

  test('shows "Choose next batter" prompt after non-striker run-out on reload', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('button').filter({ hasText: /Choose next batter/i }).first()
    ).toBeVisible()
  })
})

// ── Normal reload (no wicket) ─────────────────────────────────────────────────

test.describe('Reload mid-innings — normal ball as last delivery (no wicket)', () => {
  test.beforeEach(async ({ page }) => {
    // Only normal balls — last ball is a dot, no dismissal
    await setupCommonRoutes(page, NORMAL_BALLS)
  })

  test('shows scoring run buttons (0-6) after a normal reload', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    // With 6 normal balls (1 completed over), legalBalls=6 → needsNewBowler=true
    // Either run buttons or "Choose bowler" prompt visible — scorer is NOT on setup screen
    const hasRunBtns = await page.locator('button').filter({ hasText: /^[0-6]$/ }).count() > 0
    const hasScore   = await page.locator('[data-testid="score-header"]').count() > 0
    expect(hasRunBtns || hasScore, 'Scoring UI must be visible after normal reload').toBe(true)
  })

  test('does NOT show "Waiting for innings setup..." after a normal reload', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Waiting for innings setup...')
  })

  test('does NOT show "Choose next batter" prompt after a normal reload (no wicket)', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(
      page.locator('button').filter({ hasText: /Choose next batter/i }).first()
    ).not.toBeVisible()
  })
})
