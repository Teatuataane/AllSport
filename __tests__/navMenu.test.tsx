// @vitest-environment jsdom
//
// ── The menu, on both widths ─────────────────────────────────────────────────
// September 2026 simplification. Two things this pins:
//
//   1. The tabs are PLAY · HOME · COLOURS · BOARD · MORE, and MORE holds only
//      the player's own things. Public website pages live in the footer.
//   2. The DESKTOP top bar opens the same MORE menu. Before this it rendered the
//      tabs alone, so a signed-in player on a laptop could not sign out or
//      reach their profile. Nothing else in the suite would notice a regression.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, waitFor } from '@testing-library/react'

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('@/lib/useNavState', () => ({
  useNavState: () => ({
    userId: 'u1', isJudge: false, liveSessionId: null,
    playHref: '/dashboard#join', playLabel: 'Play', playColour: '#5c5c5c',
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

const MENU_ROWS = ['Log a workout', 'My events', 'Play history', 'Profile & family', 'My koha', 'Sign out']
const PUBLIC_PAGES = ['Schedule', 'Give koha', 'Event guide', 'How to play', 'Supporters']

describe('bottom bar', () => {
  it('has five tabs, with Colours as one of them', async () => {
    const BottomNav = (await import('@/components/BottomNav')).default
    const { container } = render(<BottomNav />)
    const tabs = [...container.querySelectorAll('nav[aria-label="Main"] > *')].map(t => t.textContent)
    expect(tabs).toEqual(['Play', 'Home', 'Colours', 'Board', 'More'])
  })

  it('MORE holds the player’s own things and no public pages', async () => {
    const BottomNav = (await import('@/components/BottomNav')).default
    const { getByText, getByRole } = render(<BottomNav />)
    fireEvent.click(getByText('More'))
    const text = getByRole('dialog').textContent ?? ''
    for (const row of MENU_ROWS) expect(text).toContain(row)
    for (const page of PUBLIC_PAGES) expect(text).not.toContain(page)
  })
})

describe('desktop top bar', () => {
  it('opens the same menu, so a laptop can sign out', async () => {
    const Navbar = (await import('@/components/Navbar')).default
    const { findByText, getByRole } = render(<Navbar />)
    fireEvent.click(await findByText('MORE'))
    await waitFor(() => expect(getByRole('dialog').textContent).toContain('Sign out'))
    expect(getByRole('dialog').textContent).toContain('Profile & family')
  })
})
