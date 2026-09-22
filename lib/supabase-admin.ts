// ─── The elevated client ─────────────────────────────────────────────────────
// SERVER ONLY. The service key bypasses RLS entirely, so a leak is total: it
// reads every email, phone number, date of birth and guardian contact the
// lockdown of 20260813000003 exists to protect.
//
// Rules, none of which are optional:
//   · the env var is NOT prefixed NEXT_PUBLIC_, so Next never inlines it into a
//     client bundle;
//   · nothing in app/ or components/ that renders on the client may import this
//     file — __tests__/autoConferral.test.ts fails the build if one does;
//   · it is used for WRITES ONLY. Auto-conferral reads through the caller's own
//     login so RLS stays the guard (spec decision 1), and reaches for this only
//     to write the award the engine has already justified.
//
// The key is absent until someone sets it. That is a normal state, not a bug:
// the route answers 503 and the page carries on showing computed colours, so
// deploying this before the secret exists changes nothing for anybody.

import { createClient } from '@supabase/supabase-js'

export const SERVICE_KEY_ENV = 'SUPABASE_SERVICE_ROLE_KEY'

/** Whether the elevated client can be built at all. */
export function hasServiceKey(): boolean {
  return !!process.env[SERVICE_KEY_ENV]
}

/**
 * Throws rather than returning a half-working client: an admin client silently
 * falling back to the anon key would fail its writes through RLS and look like
 * a logic bug for as long as it took someone to check the environment.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== 'undefined') {
    throw new Error('supabase-admin: the service key must never reach a browser')
  }
  const key = process.env[SERVICE_KEY_ENV]
  if (!key) throw new Error(`supabase-admin: ${SERVICE_KEY_ENV} is not set`)
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
