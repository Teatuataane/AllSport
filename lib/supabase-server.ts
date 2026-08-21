import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { AUTH_COOKIE_OPTIONS } from './supabase-cookies'

/**
 * Anonymous, COOKIE-FREE client for reading PUBLIC data in server components.
 *
 * `createSupabaseServerClient()` below reads cookies, which opts the calling
 * route into dynamic rendering — every request re-renders on the server. For a
 * table whose SELECT policy is `USING (true)` there is nothing to authenticate,
 * so this client touches no cookies and leaves the route statically renderable
 * (pair it with an `export const revalidate` on the page).
 *
 * Use this ONLY for genuinely public tables. Anything scoped to the signed-in
 * user must go through `createSupabaseServerClient()` so RLS sees their JWT.
 */
export function createSupabasePublicClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: AUTH_COOKIE_OPTIONS,
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}