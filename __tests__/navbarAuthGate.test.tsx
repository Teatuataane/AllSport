// @vitest-environment jsdom
//
// ── The gate that keeps Supabase out of the marketing bundle ─────────────────
// Navbar renders on every route from the root layout. It used to hold a
// module-scope createClient(), which put the Supabase client and its realtime
// stack (223 KB raw / 59 KB gzipped) into EVERY page's bundle — including the
// homepage, purely to decide whether the bar says "Sign in".
//
// It is now gated on hasAuthCookie() and imports Supabase dynamically. Two
// behaviours have to hold together, and they pull in opposite directions:
//
//   1. No cookie  -> NEVER import Supabase. The whole saving is this.
//   2. Cookie     -> import, read the session, and subscribe.
//
// And the subtle one, which is what this file exists for: signing in at /login
// is a router.push — a CLIENT-side navigation — so Navbar never remounts. With
// the effect keyed on [] the only people who ever see /login would keep the
// logged-out bar until a hard reload. It is keyed on `pathname` instead, with a
// ref making it idempotent.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

// Navbar reaches Supabase through this hook too; stub it so the only import
// under test is Navbar's own.
vi.mock('@/lib/useNavState', () => ({
  useNavState: () => ({
    userId: null, isJudge: false, liveSessionId: null,
    playHref: '/dashboard#join', playLabel: 'Play', playColour: '#5c5c5c',
  }),
}))

let hasCookie = false
vi.mock('@/lib/authCookie', () => ({ hasAuthCookie: () => hasCookie }))

const unsubscribe = vi.fn()
let createClientCalls = 0
let importFails = false
vi.mock('@/lib/supabase-browser', () => ({
  createClient: () => {
    createClientCalls++
    if (importFails) throw new Error('chunk load failed')
    return {
      auth: {
        getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe } } }),
      },
    }
  },
}))

beforeEach(() => { pathname = '/'; hasCookie = false; createClientCalls = 0; importFails = false; unsubscribe.mockClear() })
afterEach(cleanup)

async function Navbar() {
  return (await import('@/components/Navbar')).default
}

describe('Navbar auth gate', () => {
  it('never touches Supabase for a visitor with no auth cookie', async () => {
    const Bar = await Navbar()
    render(<Bar />)
    // Give any effect a chance to fire before asserting the negative.
    await new Promise(r => setTimeout(r, 20))
    expect(createClientCalls).toBe(0)
  })

  it('loads Supabase when an auth cookie is present', async () => {
    hasCookie = true
    const Bar = await Navbar()
    render(<Bar />)
    await waitFor(() => expect(createClientCalls).toBe(1))
  })

  it('picks up the session after a client-side sign-in navigation', async () => {
    // Arrive at /login with no cookie: nothing loads.
    pathname = '/login'
    const Bar = await Navbar()
    const { rerender } = render(<Bar />)
    await new Promise(r => setTimeout(r, 20))
    expect(createClientCalls).toBe(0)

    // Sign in: router.push('/dashboard') changes pathname WITHOUT remounting.
    // Keyed on [] this would stay 0 forever and the bar would stay logged-out.
    hasCookie = true
    pathname = '/dashboard'
    rerender(<Bar />)
    await waitFor(() => expect(createClientCalls).toBe(1))
  })

  it('does not re-import or re-subscribe on later navigations', async () => {
    hasCookie = true
    const Bar = await Navbar()
    const { rerender } = render(<Bar />)
    await waitFor(() => expect(createClientCalls).toBe(1))

    for (const p of ['/leaderboard', '/prs', '/dashboard']) {
      pathname = p
      rerender(<Bar />)
      await new Promise(r => setTimeout(r, 10))
    }
    expect(createClientCalls).toBe(1)
  })

  it('unsubscribes on unmount, not on navigation', async () => {
    hasCookie = true
    const Bar = await Navbar()
    const { rerender, unmount } = render(<Bar />)
    await waitFor(() => expect(createClientCalls).toBe(1))

    // Navigating must NOT tear the subscription down — it is keyed on pathname.
    pathname = '/leaderboard'
    rerender(<Bar />)
    await new Promise(r => setTimeout(r, 10))
    expect(unsubscribe).not.toHaveBeenCalled()

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })
})

describe('Navbar when the Supabase chunk fails to load', () => {
  // Making the import dynamic introduced a failure mode that could not exist
  // when it was static. Without a catch, `authResolved` never flips, so
  // `authLoading` is pinned true and the auth slot renders NOTHING — a
  // signed-in player gets a bar with no Dashboard and no Sign out until they
  // hard-reload. On flaky mobile, which is the exact audience of this change.
  it('still renders a usable bar instead of an empty slot', async () => {
    hasCookie = true
    importFails = true
    const Bar = await Navbar()
    const { container } = render(<Bar />)
    await waitFor(() => expect(createClientCalls).toBe(1))
    // Something must be in the bar — the logged-out CTA is wrong for a
    // signed-in player, but it is visible and actionable. Empty is neither.
    await waitFor(() => expect(container.textContent).toMatch(/sign in|play/i))
  })

  it('retries the import on the next navigation instead of giving up', async () => {
    hasCookie = true
    importFails = true
    const Bar = await Navbar()
    const { rerender } = render(<Bar />)
    await waitFor(() => expect(createClientCalls).toBe(1))

    // Recovered connection: navigating must try again. The `started` ref is
    // cleared in the catch precisely so this is not a one-shot failure.
    importFails = false
    pathname = '/leaderboard'
    rerender(<Bar />)
    await waitFor(() => expect(createClientCalls).toBe(2))
  })
})
