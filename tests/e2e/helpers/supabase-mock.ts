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
