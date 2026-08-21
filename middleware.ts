import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          // Write cookies onto the request so downstream server components see them
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          // Re-create the response so we can attach the refreshed cookies
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
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
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    // Run on all paths except Next.js internals and static files
    '/((?!_next/static|_next/image|favicon.ico|logo\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
