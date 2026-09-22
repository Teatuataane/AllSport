import { describe, it, expect, vi, afterEach } from 'vitest'
import { recheckGrades, withdrawColours } from '@/lib/recheckGrades'

// ─── The client helpers, against a stubbed fetch ────────────────────────────
// Both the request (what the client asserts to the server) and the response
// mapping (what the screens branch on). Neither helper may ever throw.

const respond = (status: number, body: unknown = {}) => {
  const f = vi.fn(async (_url: string, _init: RequestInit) => new Response(JSON.stringify(body), { status }))
  vi.stubGlobal('fetch', f)
  return f
}
const sent = (f: ReturnType<typeof respond>) => {
  const [url, init] = f.mock.calls[0]
  return { url, method: init.method, body: JSON.parse(init.body as string) }
}

afterEach(() => vi.unstubAllGlobals())

describe('what the client sends', () => {
  it('a recheck carries a player and a force flag, and nothing to be lied to about', async () => {
    // No colour, no rung, no score: the server re-derives all of it.
    const f = respond(200, { conferred: [] })
    await recheckGrades({ playerId: 'kid', force: true })
    expect(sent(f)).toEqual({ url: '/api/grades/recheck', method: 'POST', body: { playerId: 'kid', force: true } })
  })

  it('force defaults to false, and an absent player means "me"', async () => {
    const f = respond(200, { conferred: [] })
    await recheckGrades()
    expect(sent(f).body).toEqual({ force: false })
  })

  it('a withdrawal names the player and the domain as a number', async () => {
    // The route refuses a domain that is not an integer 1 to 10; sending it as
    // a string, or at the wrong key, would be refused rather than re-judged.
    const f = respond(200, { withdrawn: [] })
    await withdrawColours('kid', 3, 'bad log')
    expect(sent(f).body).toEqual({ playerId: 'kid', withdraw: { domain: 3, reason: 'bad log' } })
  })
})

describe('recheckGrades', () => {
  it('maps ok / 503 / 500 / a thrown fetch to what the screen needs', async () => {
    const c = { domainNumber: 1, rung: 2, name: 'Whero', events: 6 }
    respond(200, { conferred: [c] })
    expect(await recheckGrades({ playerId: 'p' })).toEqual({ conferred: [c], writable: true, ok: true })
    respond(503, { pending: [c] })
    expect(await recheckGrades()).toEqual({ conferred: [], writable: false, ok: true })
    // A failure is reported as one, so the panel can say so; players' screens
    // simply ignore `ok`.
    respond(500)
    expect(await recheckGrades()).toEqual({ conferred: [], writable: true, ok: false })
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(await recheckGrades()).toEqual({ conferred: [], writable: true, ok: false })
  })

  it('survives a response that is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>502</html>', { status: 502 })))
    expect(await recheckGrades()).toEqual({ conferred: [], writable: true, ok: false })
  })
})

describe('withdrawColours', () => {
  const w = { domainNumber: 3, rung: 4, name: 'Kōwhai' }

  it('reports ok:false only when the question got no real answer', async () => {
    respond(200, { withdrawn: [w], logged: true })
    expect(await withdrawColours('p', 3)).toEqual({ withdrawn: [w], writable: true, ok: true, logged: true })
    respond(503)
    expect(await withdrawColours('p', 3)).toEqual({ withdrawn: [], writable: false, ok: true, logged: true })
    respond(403)
    expect((await withdrawColours('p', 3)).ok).toBe(false)
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect((await withdrawColours('p', 3)).ok).toBe(false)
  })

  it('treats a 2xx with no withdrawn list as no answer, not as "nothing to take back"', async () => {
    // That is a recheck response, and saying "their colours still stand" on it
    // would tell a kaiwhakawā something nobody checked.
    respond(200, { conferred: [], checked: true })
    expect((await withdrawColours('p', 3)).ok).toBe(false)
  })

  it('passes through a withdrawal whose notice could not be logged', async () => {
    respond(200, { withdrawn: [w], logged: false })
    expect(await withdrawColours('p', 3)).toEqual({ withdrawn: [w], writable: true, ok: true, logged: false })
  })
})
