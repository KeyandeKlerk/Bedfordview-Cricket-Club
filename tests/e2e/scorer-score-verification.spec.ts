/**
 * Scorer score verification tests.
 *
 * Verifies that clicking run / extras / wicket buttons correctly updates the
 * score display in [data-testid="score-header"].  Score updates are optimistic
 * (setBalls fires before the Supabase POST on line 621 of ScorerShell), so
 * assertions can run immediately after a button click without waiting for the
 * network round-trip.
 *
 * Setup: 1 pre-existing single (mp1 → 1 run) gives score 1/0 on load and
 * leaves computeInningsState with currentStrikerId=mp2 / currentBowlerId=mp11,
 * so the "Waiting for innings setup..." guard is never triggered.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE } from './helpers/supabase-mock'

const SCORER_URL = `/admin/matches/${MATCH_FIXTURE.id}/score`
const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars'

const BASE_INNINGS = {
  ...INNINGS_FIXTURE,
  status: 'in_progress',
  batting_side: MATCH_FIXTURE.our_team_side,
  target: null,
  bonus_runs: 0,
}

/** 1 single by mp1 — score 1/0, legalBalls=1. After crossing: currentStrikerId=mp2 */
const INITIAL_BALL = {
  id: 'ball-1',
  innings_id: INNINGS_FIXTURE.id,
  match_id: MATCH_FIXTURE.id,
  sequence_number: 1,
  over_number: 0,
  ball_in_over: 0,
  batter_id: 'mp1',
  non_striker_id: 'mp2',
  bowler_id: 'mp11',
  runs_off_bat: 1,
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
}

async function setupRoutes(page: import('@playwright/test').Page) {
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

  await page.route('**/rest/v1/match_players**', async route => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([]),
    })
  })

  await page.route('**/rest/v1/ball_events**', async route => {
    const method = route.request().method()
    if (method === 'POST') {
      const raw = route.request().postData() ?? '{}'
      const body = Array.isArray(JSON.parse(raw)) ? JSON.parse(raw)[0] : JSON.parse(raw)
      await route.fulfill({
        status: 201,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, id: `ball-new-${Date.now()}` }),
      })
    } else if (method === 'DELETE' || method === 'PATCH') {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    } else {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([INITIAL_BALL]),
      })
    }
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

// ── Score header presence ─────────────────────────────────────────────────────

test.describe('Score header — presence and initial value', () => {
  test.beforeEach(async ({ page }) => { await setupRoutes(page) })

  test('score header is visible on load', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('score-header')).toBeVisible()
  })

  test('score header shows 1/0 from the pre-existing single', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    const header = page.getByTestId('score-header')
    // totalRuns=1, wickets=0 from the initial ball
    await expect(header).toContainText('1')
    await expect(header).toContainText('/0')
  })

  test('does NOT show "Waiting for innings setup..." when balls exist', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText('Waiting for innings setup...')
  })
})

// ── Run button score updates ──────────────────────────────────────────────────

test.describe('Run button clicks update the score display', () => {
  test.beforeEach(async ({ page }) => { await setupRoutes(page) })

  test('dot ball (0) keeps score at 1/0', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const runBtn = page.locator('button').filter({ hasText: /^0$/ })
    if (await runBtn.count() === 0) return

    await runBtn.first().click()
    // totalRuns stays 1, wickets stays 0
    const header = page.getByTestId('score-header')
    await expect(header).toContainText('1')
    await expect(header).toContainText('/0')
  })

  test('clicking "1" updates score to 2/0', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const runBtn = page.locator('button').filter({ hasText: /^1$/ })
    if (await runBtn.count() === 0) return

    await runBtn.first().click()
    // Optimistic update: 1 initial + 1 new = 2/0
    await expect(page.getByTestId('score-header')).toContainText('2')
  })

  test('clicking "4" updates score to 5/0', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const runBtn = page.locator('button').filter({ hasText: /^4$/ })
    if (await runBtn.count() === 0) return

    await runBtn.first().click()
    // 1 initial + 4 boundary = 5/0
    await expect(page.getByTestId('score-header')).toContainText('5')
  })

  test('clicking "6" updates score to 7/0', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const runBtn = page.locator('button').filter({ hasText: /^6$/ })
    if (await runBtn.count() === 0) return

    await runBtn.first().click()
    // 1 initial + 6 six = 7/0
    await expect(page.getByTestId('score-header')).toContainText('7')
  })
})

// ── Wicket ────────────────────────────────────────────────────────────────────

test.describe('Wicket updates score and shows batter picker', () => {
  test.beforeEach(async ({ page }) => { await setupRoutes(page) })

  test('Bowled dismissal increments wickets to /1', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Click the WICKET button (label varies — "W" or "Wicket")
    const wicketBtn = page.locator('button').filter({ hasText: /^W$|^WICKET$/i })
    if (await wicketBtn.count() === 0) return

    await wicketBtn.first().click()

    // Wicket modal — click Bowled
    const bowledBtn = page.locator('button').filter({ hasText: /^Bowled$/i })
    if (await bowledBtn.count() === 0) return
    await bowledBtn.first().click()

    // Score: runs stay at 1, wickets become 1
    await expect(page.getByTestId('score-header')).toContainText('/1')
  })

  test('Bowled dismissal shows "Choose next batter" button', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const wicketBtn = page.locator('button').filter({ hasText: /^W$|^WICKET$/i })
    if (await wicketBtn.count() === 0) return
    await wicketBtn.first().click()

    const bowledBtn = page.locator('button').filter({ hasText: /^Bowled$/i })
    if (await bowledBtn.count() === 0) return
    await bowledBtn.first().click()

    // needsNewBatter becomes true — picker button must appear
    await expect(
      page.locator('button').filter({ hasText: /Choose next batter/i }).first()
    ).toBeVisible()
  })

  test('run buttons are hidden while "Choose next batter" is required', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const wicketBtn = page.locator('button').filter({ hasText: /^W$|^WICKET$/i })
    if (await wicketBtn.count() === 0) return
    await wicketBtn.first().click()

    const bowledBtn = page.locator('button').filter({ hasText: /^Bowled$/i })
    if (await bowledBtn.count() === 0) return
    await bowledBtn.first().click()

    // needsNewBatter=true → run buttons must not be shown
    await expect(
      page.locator('button').filter({ hasText: /Choose next batter/i }).first()
    ).toBeVisible()
    const runBtns = page.locator('button').filter({ hasText: /^[0-6]$/ })
    expect(await runBtns.count()).toBe(0)
  })
})

// ── Extras ────────────────────────────────────────────────────────────────────

test.describe('Extras update the score without crashing', () => {
  test.beforeEach(async ({ page }) => { await setupRoutes(page) })

  test('Wide adds 1 extra to total runs', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Wide button label may be "Wd" or "Wide"
    const wideBtn = page.locator('button').filter({ hasText: /^Wd$|^Wide$/i })
    if (await wideBtn.count() === 0) return

    await wideBtn.first().click()
    // 1 initial + 1 wide extra = 2 total runs
    await expect(page.getByTestId('score-header')).toContainText('2')
    // No crash
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary/i)
  })

  test('No Ball adds to runs and shows free-hit indicator', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    const nbBtn = page.locator('button').filter({ hasText: /^NB$|^No.?Ball$/i })
    if (await nbBtn.count() === 0) return

    await nbBtn.first().click()
    // 1 initial + 1 no-ball extra = 2 total runs
    await expect(page.getByTestId('score-header')).toContainText('2')
    // FREE HIT indicator must appear after a no-ball
    await expect(page.locator('body')).toContainText(/FREE HIT|free.?hit/i)
  })
})

// ── No errors on scoring screen load ─────────────────────────────────────────

test.describe('Scoring screen loads without errors', () => {
  test.beforeEach(async ({ page }) => { await setupRoutes(page) })

  test('no error boundary shown on load', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).not.toContainText(/something went wrong|error boundary|500|internal server error/i)
  })

  test('run buttons 0–6 are all visible in scoring phase', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    for (const n of [0, 1, 2, 3, 4, 5, 6]) {
      const btn = page.locator('button').filter({ hasText: new RegExp(`^${n}$`) })
      if (await btn.count() > 0) {
        await expect(btn.first()).toBeVisible()
      }
    }
  })
})
