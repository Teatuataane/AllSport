import { describe, it, expect } from 'vitest'
import { buildCsp, buildSecurityHeaders } from '@/lib/securityHeaders'
import { AUTH_COOKIE_OPTIONS } from '@/lib/supabase-cookies'
import { safeNext } from '@/app/auth/callback/route'

const SUPABASE = 'https://pvutdyosuhpwnklrpczu.supabase.co'

/**
 * These tests guard controls that fail SILENTLY. Nothing in the app breaks if
 * frame-ancestors is dropped or the Secure flag disappears — the protection
 * just stops existing. Only an assertion notices.
 */

describe('CSP directives', () => {
  const csp = buildCsp(SUPABASE)
  const directive = (name: string) =>
    csp.split('; ').find(d => d === name || d.startsWith(`${name} `))

  it('defaults to self', () => {
    expect(directive('default-src')).toBe("default-src 'self'")
  })

  it("blocks framing entirely (clickjacking on the live scoring screen)", () => {
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'")
  })

  it('blocks plugins and locks base-uri and form-action to self', () => {
    expect(directive('object-src')).toBe("object-src 'none'")
    expect(directive('base-uri')).toBe("base-uri 'self'")
    expect(directive('form-action')).toBe("form-action 'self'")
  })

  it('allows the Supabase REST origin AND its realtime socket', () => {
    // The live session holds an open Realtime subscription. Allowing https but
    // not wss silently kills live score updates, which is easy to miss because
    // the 15-second polling fallback masks it.
    const connect = directive('connect-src')
    expect(connect).toContain(SUPABASE)
    expect(connect).toContain('wss://pvutdyosuhpwnklrpczu.supabase.co')
  })

  it('derives the socket origin from whatever URL it is given', () => {
    const csp = buildCsp('https://example-ref.supabase.co')
    expect(csp).toContain('connect-src \'self\' https://example-ref.supabase.co wss://example-ref.supabase.co')
  })

  it('ignores any path on the supplied Supabase URL', () => {
    // A trailing slash or path in the env var must not leak into the directive,
    // which would make it match nothing.
    expect(buildCsp('https://ref.supabase.co/rest/v1')).toContain(
      "connect-src 'self' https://ref.supabase.co wss://ref.supabase.co"
    )
  })

  it('does NOT allow Google Fonts — the fonts are self-hosted', () => {
    // Fonts come from next/font/google in app/layout.tsx, which serves them
    // from our own origin. Allowing these hosts again would re-open the leak of
    // every visitor's IP address to Google on page load, which is the exact
    // thing self-hosting removed. This test is the tripwire for that.
    expect(directive('style-src')).not.toContain('fonts.googleapis.com')
    expect(directive('font-src')).not.toContain('fonts.gstatic.com')
    expect(directive('font-src')).toBe("font-src 'self'")
  })

  it('allows arbitrary https images for partner club logos', () => {
    // partners.logo_url is a judge-set external URL rendered on /supporters.
    expect(directive('img-src')).toContain('https:')
  })

  it("keeps 'unsafe-inline' on style-src for React inline style props", () => {
    // The whole app styles via style={{ }}. Dropping this blanks every page.
    expect(directive('style-src')).toContain("'unsafe-inline'")
  })
})

describe('security header set', () => {
  const headers = buildSecurityHeaders(SUPABASE)
  const value = (key: string) => headers.find(h => h.key === key)?.value

  it('sets every header the app relies on', () => {
    expect(headers.map(h => h.key).sort()).toEqual([
      'Access-Control-Allow-Origin',
      'Content-Security-Policy',
      'Cross-Origin-Opener-Policy',
      'Permissions-Policy',
      'Referrer-Policy',
      'Strict-Transport-Security',
      'X-Content-Type-Options',
      'X-Frame-Options',
    ])
  })

  it('scopes ACAO instead of leaving Vercel wildcard', () => {
    // Vercel serves prerendered HTML with `Access-Control-Allow-Origin: *`.
    expect(value('Access-Control-Allow-Origin')).toBe('https://allsport.nz')
    expect(value('Access-Control-Allow-Origin')).not.toBe('*')
  })

  it('carries includeSubDomains on HSTS', () => {
    expect(value('Strict-Transport-Security')).toContain('includeSubDomains')
  })

  it('does not enable HSTS preload without a deliberate decision', () => {
    // preload is effectively irreversible; it needs every subdomain on HTTPS.
    expect(value('Strict-Transport-Security')).not.toContain('preload')
  })

  it('denies framing at the legacy header too', () => {
    expect(value('X-Frame-Options')).toBe('DENY')
  })

  it('sets nosniff and a referrer policy that does not leak paths cross-origin', () => {
    expect(value('X-Content-Type-Options')).toBe('nosniff')
    expect(value('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
  })

  it('denies camera, microphone and geolocation', () => {
    const pp = value('Permissions-Policy')!
    expect(pp).toContain('camera=()')
    expect(pp).toContain('microphone=()')
    expect(pp).toContain('geolocation=()')
  })
})

describe('auth cookie options', () => {
  it('pins path and sameSite', () => {
    expect(AUTH_COOKIE_OPTIONS.path).toBe('/')
    // 'strict' would withhold the cookie on the cross-site top-level navigation
    // back from Google OAuth, breaking sign-in.
    expect(AUTH_COOKIE_OPTIONS.sameSite).toBe('lax')
  })

  it('ties Secure to the environment rather than hardcoding it off', () => {
    // Secure must be on in prod; it cannot be on for http://localhost or the
    // browser drops the cookie and dev login silently fails.
    expect(AUTH_COOKIE_OPTIONS.secure).toBe(process.env.NODE_ENV === 'production')
  })

  it('does not claim httpOnly, which would break the browser client', () => {
    // @supabase/ssr's browser client reads the session from document.cookie.
    // Setting httpOnly here signs every player out. Documented, not accidental.
    expect(AUTH_COOKIE_OPTIONS.httpOnly).toBeUndefined()
  })
})

describe('safeNext — OAuth open-redirect guard', () => {
  it('defaults to the dashboard when absent or empty', () => {
    expect(safeNext(null)).toBe('/dashboard')
    expect(safeNext('')).toBe('/dashboard')
  })

  it('passes through ordinary in-app paths', () => {
    expect(safeNext('/prs')).toBe('/prs')
    expect(safeNext('/scoring/abc-123')).toBe('/scoring/abc-123')
    expect(safeNext('/leaderboard?division=women')).toBe('/leaderboard?division=women')
  })

  it('rejects userinfo smuggling', () => {
    // `${origin}${next}` with '@evil.com' builds https://allsport.nz@evil.com,
    // where allsport.nz parses as userinfo and the real host is evil.com.
    expect(safeNext('@evil.com')).toBe('/dashboard')
  })

  it('rejects protocol-relative URLs', () => {
    expect(safeNext('//evil.com')).toBe('/dashboard')
    expect(safeNext('//evil.com/phish')).toBe('/dashboard')
  })

  it('rejects the backslash variant some parsers normalise to //', () => {
    expect(safeNext('/\\evil.com')).toBe('/dashboard')
  })

  it('rejects absolute URLs to other origins', () => {
    expect(safeNext('https://evil.com')).toBe('/dashboard')
    expect(safeNext('http://evil.com')).toBe('/dashboard')
  })

  it('rejects anything not rooted at /', () => {
    expect(safeNext('dashboard')).toBe('/dashboard')
    expect(safeNext('evil.com')).toBe('/dashboard')
  })

  it('always returns a value starting with a single slash', () => {
    // Invariant the caller depends on: the result is concatenated onto origin.
    const inputs = [null, '', '/x', '//x', '@x', 'https://x', '/\\x', 'x']
    for (const input of inputs) {
      const out = safeNext(input)
      expect(out.startsWith('/')).toBe(true)
      expect(out.startsWith('//')).toBe(false)
    }
  })
})
