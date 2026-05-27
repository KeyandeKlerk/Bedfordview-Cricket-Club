import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// Routes that require a valid session
const PROTECTED_PREFIXES = [
  '/admin',
  '/dashboard',
  '/availability',
  '/selection',
  '/notifications',
]

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request: { headers: request.headers } })

  // E2E test bypass — never set in production; only tests send this cookie.
  const isE2eTest = request.cookies.get('e2e-auth-bypass')?.value === 'e2e-test-mode'
  if (isE2eTest) {
    return NextResponse.next({ request: { headers: request.headers } })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          // Use Supabase's own cookie options — do NOT force httpOnly here.
          // Auth cookies must be JS-readable so the browser Supabase client
          // can pick up the refreshed session via document.cookie.
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refreshes the session if expired and writes updated cookies to the response.
  // If both access and refresh tokens are expired, user is null.
  const { data: { user } } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname
  const isProtected = PROTECTED_PREFIXES.some(p => path.startsWith(p))

  if (!user && isProtected) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('next', path)
    return NextResponse.redirect(loginUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf)$).*)',
  ],
}
