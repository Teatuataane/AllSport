/**
 * Google Identity Services settings for "Continue with Google"
 * (components/GoogleSignInButton.tsx). Pure, so it can be tested.
 *
 * The client ID is public by design: Google puts it in every sign-in URL. It is
 * the same OAuth client the Supabase Google provider is configured with, which
 * is what lets Supabase accept the ID token. NEXT_PUBLIC_GOOGLE_CLIENT_ID
 * overrides it (a preview project, say). Every site origin that shows the
 * button must be listed under "Authorized JavaScript origins" on this client in
 * Google Cloud, or Google refuses the popup.
 */
export const GOOGLE_CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '802988820990-obrde3ot3qb1t5ti3fuicb33d2j40onl.apps.googleusercontent.com'

export const GSI_SCRIPT_URL = 'https://accounts.google.com/gsi/client'

/** Hosts the Google button needs, for the CSP (lib/securityHeaders.ts). */
export const GSI_ORIGIN = 'https://accounts.google.com'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * A one-time nonce. Google embeds the HASHED value in the ID token; Supabase is
 * given the RAW value and checks sha256(raw) matches, so a token captured from
 * someone else's sign-in cannot be replayed here.
 */
export async function makeNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = toHex(crypto.getRandomValues(new Uint8Array(32)))
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw))
  return { raw, hashed: toHex(new Uint8Array(digest)) }
}
