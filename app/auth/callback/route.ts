import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { AUTH_COOKIE_OPTIONS } from '@/lib/supabase-cookies'

/**
 * Only allow redirecting to a path on this site.
 *
 * `${origin}${next}` looks safe but is not: `next=@evil.com` builds
 * "https://allsport.nz@evil.com", where "allsport.nz" is parsed as userinfo and
 * the real host is evil.com. `next=//evil.com` is the protocol-relative variant.
 */
export function safeNext(next: string | null): string {
  if (!next) return '/dashboard'
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) {
    return '/dashboard'
  }
  return next
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  // Cache headers Supabase supplies whenever it writes auth cookies. Applied to
  // whichever redirect we return, so no CDN can cache a session token.
  let authCacheHeaders: Record<string, string> = {}

  const redirect = (to: string) => {
    const response = NextResponse.redirect(to)
    Object.entries(authCacheHeaders).forEach(([key, value]) =>
      response.headers.set(key, value)
    )
    return response
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookieOptions: AUTH_COOKIE_OPTIONS,
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet, headers) {
            authCacheHeaders = headers ?? {}
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Check if a player profile exists
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existing) {
        // No profile yet — send to registration to complete their details
        return redirect(`${origin}/register`)
      }

      return redirect(`${origin}${next}`)
    }
  }

  return redirect(`${origin}/login?error=auth`)
}
