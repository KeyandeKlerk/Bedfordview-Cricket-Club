import { Page, Route } from '@playwright/test'

/** Mock a Supabase REST endpoint with fixture data */
export async function mockSupabaseQuery(
  page: Page,
  table: string,
  data: object | object[],
  options: { status?: number; count?: number } = {}
) {
  const { status = 200, count } = options
  const body = Array.isArray(data) ? data : [data]

  await page.route(`**/rest/v1/${table}**`, async (route: Route) => {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (count !== undefined) {
      headers['Content-Range'] = `0-${body.length - 1}/${count}`
    }
    await route.fulfill({ status, headers, body: JSON.stringify(body) })
  })
}

/** Mock Supabase auth token endpoint to return a valid session */
export async function mockSupabaseAuth(page: Page, user: {
  id?: string
  email?: string
  role?: string
} = {}) {
  const userId = user.id ?? 'test-user-uuid'
  const email = user.email ?? 'scorer@bcc.test'

  const session = {
    access_token: 'mock-access-token',
    refresh_token: 'mock-refresh-token',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
    },
  }

  await page.route('**/auth/v1/token**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    })
  })

  return session
}

/** Mock auth user endpoint to return the current user */
export async function mockAuthUser(page: Page, userId = 'test-user-uuid', email = 'scorer@bcc.test') {
  await page.route('**/auth/v1/user**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: userId,
        email,
        app_metadata: {},
        user_metadata: {},
        aud: 'authenticated',
        role: 'authenticated',
        created_at: new Date().toISOString(),
      }),
    })
  })
}

/** Block all Supabase requests (for unauthenticated tests) */
export async function blockSupabaseAuth(page: Page) {
  await page.route('**/auth/v1/user**', async (route: Route) => {
    await route.fulfill({
      status: 401,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'invalid_request', error_description: 'No auth header found' }),
    })
  })
}

/** Fixture: a minimal match object */
export const MATCH_FIXTURE = {
  id: 'match-uuid-1',
  match_date: '2026-04-10',
  status: 'upcoming',
  our_team_side: 'home',
  overs_per_innings: 20,
  free_hit_on_no_ball: true,
  opponent: { canonical_name: 'Edenvale CC' },
  competition: { name: 'T20 League' },
}

export const INNINGS_FIXTURE = {
  id: 'innings-uuid-1',
  match_id: 'match-uuid-1',
  innings_number: 1,
  batting_team: 'bcc',
  status: 'in_progress',
  runs: 45,
  wickets: 2,
  overs_completed: 5,
  created_at: new Date().toISOString(),
}

export const PLAYER_FIXTURE = {
  id: 'player-uuid-1',
  first_name: 'Alice',
  last_name: 'Smith',
  batting_style: 'Right-hand bat',
  bowling_style: 'Right-arm medium',
  is_active: true,
  user_id: null,
  jersey_number: 7,
  is_captain_club: false,
  is_vice_captain: false,
  created_at: new Date().toISOString(),
}

export const ARTICLE_FIXTURE = {
  id: 'article-uuid-1',
  title: 'BCC Win the League',
  slug: 'bcc-win-the-league',
  content: 'Bedfordview Cricket Club clinched the T20 League title...',
  excerpt: 'BCC clinched the title in dramatic fashion.',
  published_at: new Date().toISOString(),
  created_at: new Date().toISOString(),
  match_id: null,
}

export const PRODUCT_FIXTURE = {
  id: 'product-uuid-1',
  name: 'BCC Playing Shirt',
  description: 'Official BCC playing shirt',
  image_url: null,
  category: 'kit',
  price_cents: 45000,
  available_sizes: ['S', 'M', 'L', 'XL'],
  benefits: null,
  is_active: true,
  sort_order: 1,
  created_at: new Date().toISOString(),
}

export const ORDER_FIXTURE = {
  id: 'order-uuid-1',
  user_id: 'test-user-uuid',
  status: 'pending',
  total_cents: 45000,
  type: 'kit',
  created_at: new Date().toISOString(),
  line_items: [{ product_id: 'product-uuid-1', qty: 1, size: 'M', price_cents: 45000 }],
}

export const AVAILABILITY_WINDOW_FIXTURE = {
  id: 'window-uuid-1',
  title: 'Weekend 12 April',
  season_id: 'sea1',
  window_start: '2026-04-12',
  window_end: '2026-04-13',
  deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
}

export const NOTIFICATION_FIXTURE = {
  id: 'notif-uuid-1',
  user_id: 'test-user-uuid',
  type: 'selection_announced',
  title: 'You have been selected',
  body: 'You have been selected for the match vs Edenvale CC.',
  entity_type: 'match',
  entity_id: 'match-uuid-1',
  read_at: null,
  idempotency_key: 'selection_announced:match-uuid-1:test-user-uuid',
  created_at: new Date().toISOString(),
}

export const SELECTION_FIXTURE = {
  id: 'selection-uuid-1',
  match_id: 'match-uuid-1',
  player_id: 'player-uuid-1',
  status: 'selected',
  confirmed_at: null,
  withdrawn_at: null,
  created_at: new Date().toISOString(),
}

/**
 * Stub all 7 common admin table queries in one call.
 * Reduces 60-line beforeEach boilerplate to a single helper.
 */
export async function mockAllAdmin(page: Page) {
  await page.route('**/rest/v1/matches**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Content-Range': '0-0/1' },
      body: JSON.stringify([MATCH_FIXTURE]),
    })
  })
  await page.route('**/rest/v1/players**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([PLAYER_FIXTURE, { ...PLAYER_FIXTURE, id: 'player-uuid-2', first_name: 'Bob', last_name: 'Jones' }]),
    })
  })
  await page.route('**/rest/v1/opponents**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'opp1', canonical_name: 'Edenvale CC' }]),
    })
  })
  await page.route('**/rest/v1/competitions**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'comp1', name: 'T20 League', category: 'senior', match_format: 'T20' }]),
    })
  })
  await page.route('**/rest/v1/seasons**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'sea1', name: '2026', is_active: true }]),
    })
  })
  await page.route('**/rest/v1/grounds**', async (route: Route) => {
    await route.fulfill({
      status: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify([{ id: 'g1', name: 'Bedfordview Oval' }]),
    })
  })
  await page.route('**/rest/v1/user_roles**', async (route: Route) => {
    const method = route.request().method()
    if (method === 'GET') {
      await route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ id: 'ur1', user_id: 'test-user-uuid', role: 'admin' }]),
      })
    } else {
      await route.fulfill({ status: 201, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    }
  })
}

/**
 * Sets the E2E bypass cookie (middleware) and mocks client-side auth checks.
 * Call in beforeEach for any test that navigates to a protected route (/admin, /dashboard, etc.).
 */
export async function mockE2eAuth(
  page: Page,
  userId = 'test-user-uuid',
  email = 'admin@bcc.test'
) {
  // 1. Bypass server-side middleware redirect
  await page.context().addCookies([{
    name: 'e2e-bypass',
    value: 'e2e-test-mode',
    domain: 'localhost',
    path: '/',
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  }])

  // 2. Mock client-side auth checks using existing helpers
  await mockAuthUser(page, userId, email)
  await mockSupabaseAuth(page, { id: userId, email })
}
