// @vitest-environment jsdom
//
// ── A kaiwhakawā's desktop bar ───────────────────────────────────────────────
// The PLAY tab was folded into the KAIWHAKAWĀ link for a judge, because both
// pointed at /judge. That link must carry playHref, or a judge loses the route
// to a live game. A player keeps PLAY and never sees the link.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, waitFor } from '@testing-library/react'

const nav = vi.hoisted(() => ({ isJudge: false }))

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/useNavState', () => ({
  useNavState: () => ({
    userId: 'u1', isJudge: nav.isJudge, liveSessionId: 's9',
    playHref: '/scoring/s9', playLabel: nav.isJudge ? 'Judge' : 'Play', playColour: '#EA4742',
  }),
}))
vi.mock('@/lib/authCookie', () => ({ hasAuthCookie: () => true }))
vi.mock('@/lib/supabase-browser', () => ({
  createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session: { user: { id: 'u1' } } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signOut: async () => ({}),
    },
  }),
}))

afterEach(cleanup)

const links = (c: HTMLElement) => [...c.querySelectorAll('a')].map(a => ({ text: a.textContent?.trim(), href: a.getAttribute('href') }))

describe('desktop top bar tabs', () => {
  it('a kaiwhakawā gets no PLAY or JUDGE tab, and the KAIWHAKAWĀ link goes to the live game', async () => {
    nav.isJudge = true
    const Navbar = (await import('@/components/Navbar')).default
    const { container, findByText } = render(<Navbar />)
    await findByText('HOME')
    await waitFor(() => expect(links(container).some(l => l.text === 'KAIWHAKAWĀ')).toBe(true))
    const all = links(container)
    expect(all.find(l => l.text === 'KAIWHAKAWĀ')!.href).toBe('/scoring/s9')
    expect(all.some(l => l.text === 'PLAY' || l.text === 'JUDGE')).toBe(false)
  })

  it('a player keeps the PLAY tab and has no KAIWHAKAWĀ link', async () => {
    nav.isJudge = false
    const Navbar = (await import('@/components/Navbar')).default
    const { container, findByText } = render(<Navbar />)
    await findByText('HOME')
    const all = links(container)
    expect(all.find(l => l.text === 'PLAY')?.href).toBe('/scoring/s9')
    expect(all.some(l => l.text === 'KAIWHAKAWĀ')).toBe(false)
  })
})
