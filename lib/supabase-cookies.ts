import type { CookieOptions } from '@supabase/ssr'

/**
 * Shared options for the Supabase auth cookies.
 *
 * Must be passed to EVERY client (browser, server, middleware, route handlers).
 * @supabase/ssr's own defaults are `{ path: '/', sameSite: 'lax', httpOnly: false }`
 * with no `secure` flag, so without this the session token is sent over plain
 * HTTP if a request ever downgrades.
 *
 * `secure` is off in development because localhost is served over http and the
 * browser silently drops Secure cookies there.
 *
 * `httpOnly` is deliberately absent. @supabase/ssr's browser client reads the
 * session out of `document.cookie`, and every client component in this app goes
 * through `lib/supabase-browser.ts`, so setting httpOnly would sign everyone
 * out. See SECURITY.md for what it would take to change that.
 *
 * `sameSite: 'lax'` is required for the Google OAuth return trip — 'strict'
 * withholds cookies on the cross-site top-level navigation back to
 * /auth/callback.
 */
export const AUTH_COOKIE_OPTIONS: CookieOptions = {
  path: '/',
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
}
