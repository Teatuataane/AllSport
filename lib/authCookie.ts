// ─── Cheap "is anyone signed in?" probe ──────────────────────────────────────
// No Supabase import, on purpose. This module exists so the global shell
// (Navbar, BottomNav, useNavState, useActivePlayer) can answer "is there a
// session?" WITHOUT statically importing @supabase/supabase-js.
//
// WHY IT MATTERS: createBrowserClient builds a full SupabaseClient, which
// statically imports realtime-js. Tree-shaking cannot drop it, so every module
// that held a module-scope `createClient()` put 223 KB (59 KB gzipped) of
// client + websocket stack into the shell bundle — on EVERY route, including
// the marketing homepage, where it was downloaded and parsed solely to decide
// whether the navbar says "Sign in". Measured on a production build: the
// homepage shipped 221 KB gzipped of JavaScript, and this was the largest
// single piece of it.
//
// This is only safe because `httpOnly` is deliberately OFF on the auth cookie
// (see lib/supabase-cookies.ts) — @supabase/ssr's browser client itself reads
// the session out of document.cookie. If that ever changes, the browser client
// stops working long before this does, so this does not add a new constraint.
//
// NOT A SECURITY BOUNDARY. A forged cookie buys nothing: every query is still
// authorised server-side by RLS against the real JWT. The only thing this
// decides is whether to spend the bytes.

/**
 * The project ref Supabase names its cookies after — the first label of the
 * project host, e.g. `https://abcdef.supabase.co` -> `abcdef`.
 */
function projectRef(): string | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!url) return null
  try {
    return new URL(url).hostname.split('.')[0] || null
  } catch {
    return null
  }
}

// `sb-{ref}-auth-token`, plus the `.0`/`.1` suffixes @supabase/ssr uses when a
// session is too big for one cookie — hence a prefix match, not an equality one.
const GENERIC = /(?:^|;\s*)sb-[^=;\s]+-auth-token/

/**
 * True when this browser is carrying a Supabase auth cookie for this project.
 *
 * FAILS OPEN. If the ref cannot be derived, or document.cookie is unreadable,
 * this returns true so the caller loads Supabase and asks properly. A false
 * negative would show a signed-in player the logged-out navbar; a false
 * positive only costs the bytes we would have spent anyway.
 */
export function hasAuthCookie(): boolean {
  if (typeof document === 'undefined') return false
  let cookie: string
  try {
    cookie = document.cookie
  } catch {
    return true // blocked site data — ask Supabase rather than guess
  }
  const ref = projectRef()
  if (!ref) return GENERIC.test(cookie)
  return cookie.includes(`sb-${ref}-auth-token`)
}
