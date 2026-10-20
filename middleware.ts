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
  //
  // KEEP getUser() HERE — do not swap this for getSession(). Server-side the
  // cookie is attacker-supplied and unverified, and this is also the call that
  // writes the refreshed cookie back. Client components read the refreshed
  // session locally via getSessionUser() instead of repeating this round trip.
  //
  // It is raced against a time limit. getUser() only goes to Supabase Auth when
  // the request carries a login cookie, so when Supabase is slow (21 Oct 2026:
  // the project ran out of Disk IO and was throttled) every signed-in page hung
  // until Vercel killed the middleware ("Routing middleware took too long"),
  // while signed-out browsers loaded fine. Past the limit we serve the page
  // without a refreshed cookie: the next request tries again, and the browser
  // client refreshes its own session. A failed call is treated the same way;
  // the page itself still decides what a signed-out visitor may see.
  // Whatever setAll() does after we have returned only touches a response
  // nobody will send, so it is harmless.
  await withTimeout(supabase.auth.getUser(), GET_USER_TIMEOUT_MS)

  return supabaseResponse
}

// Well under Vercel's middleware limit, well over a healthy getUser() (~0.3s).
const GET_USER_TIMEOUT_MS = 4000

function withTimeout(work: Promise<unknown>, ms: number): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const limit = new Promise<void>((resolve) => {
    timer = setTimeout(resolve, ms)
  })
  return Promise.race([work.then(() => undefined, () => undefined), limit]).finally(() =>
    clearTimeout(timer)
  )
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
