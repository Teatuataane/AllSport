// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// ── The gate that keeps Supabase out of the marketing bundle ─────────────────
// hasAuthCookie() decides whether the global shell downloads the Supabase client
// (223 KB raw / 59 KB gzipped, realtime included) or paints the logged-out bar
// without it. Two directions matter and they are NOT symmetric:
//
//   false when signed out  -> the whole point; a regression here silently costs
//                             every marketing visitor 59 KB again, and nothing
//                             breaks, so nothing would report it.
//   true  when signed in   -> a regression here is VISIBLE: a signed-in player
//                             gets the logged-out navbar.
//
// Hence the fail-open contract: anything uncertain must return true.

const URL_KEY = 'NEXT_PUBLIC_SUPABASE_URL'
const REF = 'pvutdyosuhpwnklrpczu'

/** Fresh module each time — the ref is read from the env at call time. */
async function load() {
  vi.resetModules()
  return (await import('@/lib/authCookie')).hasAuthCookie
}

function clearCookies() {
  for (const c of document.cookie.split(';')) {
    const name = c.split('=')[0].trim()
    if (name) document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
  }
}

const original = process.env[URL_KEY]

beforeEach(() => {
  clearCookies()
  process.env[URL_KEY] = `https://${REF}.supabase.co`
})

afterEach(() => {
  clearCookies()
  if (original === undefined) delete process.env[URL_KEY]
  else process.env[URL_KEY] = original
})

describe('hasAuthCookie', () => {
  it('is false with no cookies at all — the marketing-visitor case', async () => {
    expect(await (await load())()).toBe(false)
  })

  it('is false when only unrelated cookies are present', async () => {
    document.cookie = 'theme=dark; path=/'
    document.cookie = 'allsport_active_player_id=abc; path=/'
    expect(await (await load())()).toBe(false)
  })

  it('is true for this project’s auth cookie', async () => {
    document.cookie = `sb-${REF}-auth-token=whatever; path=/`
    expect(await (await load())()).toBe(true)
  })

  it('is true for a chunked session (.0/.1 suffixes)', async () => {
    // @supabase/ssr splits a session that will not fit in one cookie, so the
    // name is a PREFIX, not an exact match. Matching on equality would sign out
    // exactly the users with the largest sessions.
    document.cookie = `sb-${REF}-auth-token.0=part-one; path=/`
    document.cookie = `sb-${REF}-auth-token.1=part-two; path=/`
    expect(await (await load())()).toBe(true)
  })

  it('finds the cookie when it is not first in the string', async () => {
    document.cookie = 'theme=dark; path=/'
    document.cookie = `sb-${REF}-auth-token=whatever; path=/`
    expect(await (await load())()).toBe(true)
  })

  // ── Fail-open ──────────────────────────────────────────────────────────────

  it('falls back to a generic match when the URL is missing', async () => {
    delete process.env[URL_KEY]
    document.cookie = 'sb-someotherref-auth-token=whatever; path=/'
    expect(await (await load())()).toBe(true)
  })

  it('falls back to a generic match when the URL is unparseable', async () => {
    process.env[URL_KEY] = 'not a url'
    document.cookie = 'sb-someotherref-auth-token=whatever; path=/'
    expect(await (await load())()).toBe(true)
  })

  it('still reports false with no URL and no auth cookie', async () => {
    delete process.env[URL_KEY]
    document.cookie = 'theme=dark; path=/'
    expect(await (await load())()).toBe(false)
  })

  it('does not confuse another project’s cookie for this one', async () => {
    // The ref IS known here, so the generic fallback must not apply: a stray
    // cookie from a different Supabase project is not a session for this app.
    document.cookie = 'sb-someotherref-auth-token=whatever; path=/'
    expect(await (await load())()).toBe(false)
  })
})
