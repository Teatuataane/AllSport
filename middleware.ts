import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { AUTH_COOKIE_OPTIONS } from '@/lib/supabase-cookies'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          // Write cookies onto the request so downstream server components see them
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Re-create the response so we can attach the refreshed cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          // Supabase hands us no-store cache headers whenever it writes auth
          // cookies. They are NOT optional: without them Vercel's CDN can cache
          // a response carrying one player's session token and serve it to
          // someone else. Must be applied after the response is re-created.
          // `?? {}` guards the hot path: middleware runs on every request, and
          // an older/newer @supabase/ssr calling setAll with one argument would
          // otherwise throw here and take the whole site down.
          Object.entries(headers ?? {}).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // This call refreshes the session if the access token has expired.
  // Never remove it — session persistence breaks without it.
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
