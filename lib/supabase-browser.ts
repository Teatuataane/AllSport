import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

/**
 * The signed-in user, read from the locally stored session. CLIENT COMPONENTS ONLY.
 *
 * Prefer this over `supabase.auth.getUser()` in client components. `getUser()`
 * makes a network round trip to the auth server on EVERY call, and page effects
 * await it before running their own queries — so it sat at the head of a serial
 * waterfall on every authenticated page, after middleware had already refreshed
 * the session on the same request.
 *
 * `getSession()` reads the stored session with no network call, and still calls
 * the refresh endpoint by itself once the token is near expiry, so it does not
 * hand back something stale or dead.
 *
 * This is safe here because it is NOT a security boundary. Every query is
 * authorised server-side by RLS against the real JWT, so a tampered local
 * session grants no access; the redirects these call sites perform are UX, not
 * enforcement.
 *
 * It is NOT safe server-side — supabase-js wraps the user in a warning proxy
 * when the storage is a server one — so server components and middleware must
 * keep calling `getUser()`. See `app/scoring/layout.tsx` and `middleware.ts`.
 */
export async function getSessionUser() {
  const { data: { session } } = await createClient().auth.getSession()
  return session?.user ?? null
}
