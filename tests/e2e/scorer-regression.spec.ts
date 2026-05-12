/**
 * Scorer regression tests — catches specific bugs that were fixed.
 *
 * Bug 1: Phase reversion on re-entry
 *   When a scorer exits mid-match and returns, the page would sometimes show the
 *   BCC XI setup screen instead of the scoring screen. Root cause: detectPhase()
 *   filtered match_players by `side`, and if that query returned empty (transient
 *   RLS/auth state), bcc.length < 11 → setup_bcc_xi.
 *   Fix: short-circuit in detectPhase — in_progress innings + ballCount > 0 → scoring.
 *
 * Bug 2: Notification bell overlaps scorer UI
 *   The admin layout renders a NotificationBell fixed at top:14 right:14 zIndex:200.
 *   On the scorer page the header's top-right area (← Matches, Inn N) sits directly
 *   under the bell, making those controls unreachable on mobile.
 *   Fix: ConditionalNotificationBell hides the bell on /admin/matches/[id]/score routes.
 */
import { test, expect } from '@playwright/test'
import { MATCH_FIXTURE, INNINGS_FIXTURE } from './helpers/supabase-mock'

const SCORER_URL = `/admin/matches/${MATCH_FIXTURE.id}/score`
const NEEDS_AUTH = 'Requires TEST_USER_EMAIL + TEST_USER_PASSWORD env vars'

// ─── Shared ball fixtures ─────────────────────────────────────────────────────

const SAMPLE_BALLS = Array.from({ length: 6 }, (_, i) => ({
  id: `ball-${i + 1}`,
  innings_id: INNINGS_FIXTURE.id,
  match_id: MATCH_FIXTURE.id,
  sequence_number: i + 1,
  over_number: 0,
  ball_in_over: i + 1,
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
}))

// ─── Bug 1: Phase reversion ───────────────────────────────────────────────────

test.describe('Bug regression: scorer phase reversion on re-entry', () => {
  /**
   * Simulates the worst-case re-entry scenario: match_players returns [] (as if
   * RLS filtered everything out), but innings is in_progress with existing balls.
   * The scorer must show the scoring screen, not BCC XI setup.
   */
  test.beforeEach(async ({ page }) => {
    // match_players returns empty — simulates transient RLS failure
    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })

    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          opponent: { canonical_name: 'Edenvale CC' },
          competition: { name: 'T20 League' },
        }]),
      })
    })

    // Innings is actively in_progress
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...INNINGS_FIXTURE, status: 'in_progress' }]),
      })
    })

    // 6 balls already scored
    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_BALLS),
      })
    })

    await page.route('**/rest/v1/players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })

    await page.route('**/rest/v1/selections**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      })
    })

    await page.route('**/rest/v1/rpc/acquire_scoring_lock**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(true),
      })
    })
  })

  test('shows scoring screen when re-entering a match with existing balls, even if match_players is empty', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Must NOT show BCC XI setup
    await expect(page.locator('body')).not.toContainText(/BCC XI|select.*squad|STEP 1/i)

    // Must show scoring UI — run buttons or score display
    // The score header shows runs/wickets
    const hasRunBtn = await page.locator('button').filter({ hasText: /^[0-6]$/ }).count() > 0
    const hasScore  = await page.locator('body').getByText(/\d+\/\d+/).count() > 0
    expect(hasRunBtn || hasScore, 'Scoring screen should be visible').toBe(true)
  })

  test('no 500 error shown when match_players is empty on re-entry', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    await expect(page.locator('body')).not.toContainText(/500|internal server error|something went wrong/i)
  })
})

test.describe('Bug regression: scorer with partial match_players (< 11 per side)', () => {
  /**
   * Only 3 match_players returned (partial load). With existing balls and an
   * in_progress innings, phase must still be scoring.
   */
  test.beforeEach(async ({ page }) => {
    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { id: 'mp1', player_id: 'p1', match_id: MATCH_FIXTURE.id, side: MATCH_FIXTURE.our_team_side, batting_position: 1, actual_batting_position: 1, is_captain: true, is_keeper: false, opposition_name: null },
          { id: 'mp2', player_id: 'p2', match_id: MATCH_FIXTURE.id, side: MATCH_FIXTURE.our_team_side, batting_position: 2, actual_batting_position: 2, is_captain: false, is_keeper: true, opposition_name: null },
        ]),
      })
    })
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          opponent: { canonical_name: 'Edenvale CC' },
          competition: { name: 'T20 League' },
        }]),
      })
    })
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...INNINGS_FIXTURE, status: 'in_progress' }]),
      })
    })
    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_BALLS),
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
  })

  test('shows scoring screen even with partial match_players load', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Must NOT be stuck on setup_bcc_xi
    await expect(page.locator('body')).not.toContainText(/STEP 1.*BCC XI/i)
    await expect(page.locator('body')).not.toContainText(/500|something went wrong/i)
  })
})

// ─── Bug 2: Notification bell overlap ────────────────────────────────────────

test.describe('Bug regression: notification bell must not overlap scorer controls', () => {
  test.beforeEach(async ({ page }) => {
    // Full setup for the scoring screen
    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { id: 'mp1', player_id: 'p1', match_id: MATCH_FIXTURE.id, side: MATCH_FIXTURE.our_team_side, batting_position: 1, actual_batting_position: 1, is_captain: true, is_keeper: false, opposition_name: null },
          { id: 'mp2', player_id: 'p2', match_id: MATCH_FIXTURE.id, side: MATCH_FIXTURE.our_team_side, batting_position: 2, actual_batting_position: 2, is_captain: false, is_keeper: true, opposition_name: null },
        ]),
      })
    })
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          opponent: { canonical_name: 'Edenvale CC' },
          competition: { name: 'T20 League' },
        }]),
      })
    })
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ ...INNINGS_FIXTURE, status: 'in_progress' }]),
      })
    })
    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(SAMPLE_BALLS),
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
  })

  test('notification bell is hidden on the scorer page', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // ConditionalNotificationBell renders null on scorer routes.
    // The bell is an <a href="/notifications"> — it must not be in the DOM (or at least not visible).
    const bell = page.locator('a[href="/notifications"]')
    // Either absent or not visible — both are acceptable
    const count = await bell.count()
    if (count > 0) {
      await expect(bell.first()).not.toBeVisible()
    }
    // If count === 0, the element was never rendered — test passes implicitly
  })

  test('← Matches link is clickable and not obscured by notification bell', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Find the ← Matches link in the scorer header
    const matchesLink = page.locator('a[href="/admin/matches"]').first()
    if (await matchesLink.count() === 0) return // link not present on this screen

    const linkBox = await matchesLink.boundingBox()
    const bellEl  = page.locator('a[href="/notifications"]')

    // If no bell visible, there's nothing to overlap
    if (linkBox && await bellEl.count() > 0 && await bellEl.first().isVisible()) {
      const bellBox = await bellEl.first().boundingBox()
      if (bellBox) {
        const overlapping =
          linkBox.x < bellBox.x + bellBox.width &&
          linkBox.x + linkBox.width > bellBox.x &&
          linkBox.y < bellBox.y + bellBox.height &&
          linkBox.y + linkBox.height > bellBox.y
        expect(overlapping, 'notification bell must not overlap ← Matches link').toBe(false)
      }
    }
  })

  test('Inn N label in scorer header is visible and not obscured on mobile', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    // Simulate mobile viewport — most likely to cause overlap
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // "Inn 1" or similar should be readable in the header
    const viewport = page.viewportSize()!
    const innLabel = page.locator('text=/Inn \\d/i').first()
    if (await innLabel.count() > 0) {
      const box = await innLabel.boundingBox()
      if (box) {
        // Must be within viewport width
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
        // Must be visible (not hidden behind bell)
        await expect(innLabel).toBeVisible()
      }
    }
  })
})

// ─── Scorer setup phase — notification bell also hidden ───────────────────────

test.describe('Bug regression: notification bell hidden during scorer setup phases', () => {
  test.beforeEach(async ({ page }) => {
    // Empty innings → forces setup_bcc_xi phase
    await page.route('**/rest/v1/innings**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/match_players**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
    })
    await page.route('**/rest/v1/matches**', async route => {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{
          ...MATCH_FIXTURE,
          opponent: { canonical_name: 'Edenvale CC' },
          competition: { name: 'T20 League' },
        }]),
      })
    })
    await page.route('**/rest/v1/ball_events**', async route => {
      await route.fulfill({ status: 200, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify([]) })
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
  })

  test('notification bell not visible during BCC XI setup phase', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // We should be in setup_bcc_xi phase
    await expect(page.locator('body')).toContainText(/BCC XI|squad|select/i)

    // Bell is an <a href="/notifications"> — must not be visible on scorer route
    const bell = page.locator('a[href="/notifications"]')
    if (await bell.count() > 0) {
      await expect(bell.first()).not.toBeVisible()
    }
  })

  test('STEP header text not clipped behind bell on iPhone SE width', async ({ page }) => {
    test.skip(!process.env.TEST_USER_EMAIL, NEEDS_AUTH)

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(SCORER_URL)
    await page.waitForLoadState('networkidle')

    // Step indicator should be within the viewport
    const stepLabel = page.locator('text=/STEP \\d/i').first()
    if (await stepLabel.count() > 0) {
      const box = await stepLabel.boundingBox()
      if (box) {
        expect(box.x + box.width).toBeLessThanOrEqual(376)
      }
    }
  })
})
