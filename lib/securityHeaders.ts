/**
 * HTTP security headers, in one testable place.
 *
 * Lives in lib/ rather than inline in next.config.ts so the policy can be unit
 * tested. A CSP is a security control that fails SILENTLY when it regresses:
 * drop `frame-ancestors` and nothing breaks, no test goes red, and the app is
 * simply framable again. The tests in __tests__/securityHeaders.test.ts are the
 * only thing that notices.
 */

export type HeaderPair = { key: string; value: string }

/**
 * Build the Content-Security-Policy.
 *
 * @param supabaseUrl the project URL, e.g. https://abc.supabase.co. Both the
 *   REST origin and its wss:// counterpart are allowed in connect-src, because
 *   the live-session screen holds an open Realtime socket.
 *
 * script-src keeps 'unsafe-inline': Next's App Router injects inline bootstrap
 * and flight scripts on every page. Removing it means per-request nonces, which
 * forces every route dynamic and gives up static prerendering. The tradeoff is
 * accepted deliberately — there is no dangerouslySetInnerHTML in this codebase
 * and React escapes interpolated output, so the inline-injection surface is
 * small, while default-src/connect-src still block exfiltration to other hosts.
 *
 * style-src keeps 'unsafe-inline' because the app styles via React
 * `style={{ }}` props, which emit inline style attributes.
 */
export function buildCsp(supabaseUrl: string): string {
  const origin = new URL(supabaseUrl).origin
  const socket = origin.replace(/^https:/, 'wss:')

  return [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    // No Google Fonts hosts. The typefaces are self-hosted by next/font/google
    // (app/layout.tsx), so the stylesheet and the font files both come from our
    // own origin and nothing needs to reach Google.
    //
    // This is the part that KEEPS it fixed. Self-hosting closed the leak of
    // every visitor's IP to Google; these two directives are what stops a
    // future `<link rel="stylesheet" href="https://fonts.googleapis.com/...">`
    // from quietly reopening it. Without them that link just works, and nobody
    // finds out. If a font stops rendering, the fault is in layout.tsx.
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    // https: covers partner club logos (partners.logo_url is an arbitrary URL
    // set by a kaiwhakawā). data:/blob: cover the session QR code canvas.
    "img-src 'self' data: blob: https:",
    `connect-src 'self' ${origin} ${socket}`,
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/**
 * The full header set applied to every route.
 *
 * @param supabaseUrl passed through to buildCsp.
 * @param siteOrigin the canonical public origin, used to scope the
 *   Access-Control-Allow-Origin that Vercel would otherwise serve as `*`.
 */
export function buildSecurityHeaders(
  supabaseUrl: string,
  siteOrigin = 'https://allsport.nz'
): HeaderPair[] {
  return [
    { key: 'Content-Security-Policy', value: buildCsp(supabaseUrl) },
    // Vercel sets HSTS but without includeSubDomains. Add `; preload` only once
    // every allsport.nz subdomain is HTTPS-only — preload is hard to reverse.
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    // Legacy backstop for browsers that ignore frame-ancestors.
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    {
      key: 'Permissions-Policy',
      value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
    },
    // Vercel serves prerendered HTML with `Access-Control-Allow-Origin: *`.
    // Nothing here is a cross-origin API, so scope it back to same-origin.
    { key: 'Access-Control-Allow-Origin', value: siteOrigin },
  ]
}
