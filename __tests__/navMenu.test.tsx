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

describe('phone tabs', () => {
  it('has five tabs, with Colours as one of them', async () => {
    const Navbar = (await import('@/components/Navbar')).default
    const { container, findByText } = render(<Navbar />)
    await findByText('MORE')
    const tabs = [...container.querySelectorAll('.phone-nav [aria-label="Main"] > *')].map(t => t.textContent)
    expect(tabs).toEqual(['Play', 'Home', 'Colours', 'Board', 'More'])
  })

  // Value: protects=the phone MORE menu dims the page and closes on an outside tap; fails_when=the menu is rendered inside <nav>, whose backdrop-filter shrinks its fixed backdrop to the 48px bar; why_new=caught in review, nothing tested where the menu mounts; seam=none
  it('MORE opens outside the bar and holds the player’s own things only', async () => {
    const Navbar = (await import('@/components/Navbar')).default
    const { container, findByText, getByRole } = render(<Navbar />)
    await findByText('MORE')
    fireEvent.click(container.querySelector('.phone-nav [aria-label="Main"] button')!)
    const dialog = getByRole('dialog')
    expect(dialog.closest('nav')).toBeNull()
    const text = dialog.textContent ?? ''
    for (const row of MENU_ROWS) expect(text).toContain(row)
    for (const page of PUBLIC_PAGES) expect(text).not.toContain(page)
  })
})

describe('one bar', () => {
  it('the phone tabs live inside the top bar, and nothing is fixed to the bottom', async () => {
    const Navbar = (await import('@/components/Navbar')).default
    const { container, findByText } = render(<Navbar />)
    await findByText('MORE')
    const phone = container.querySelector('.phone-nav')
    expect(phone?.querySelector('[aria-label="Main"]')).toBeTruthy()
    const layout = (await import('node:fs')).readFileSync('app/layout.tsx', 'utf8')
    expect(layout).not.toMatch(/BottomNav/)
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

// Value: protects=the phone tab strip marking the current page and the live game dot;
// fails_when=aria-current lands on the wrong tab, More stops calling onMore, or the live dot
// shows with no game running; why_new=PhoneTabStrip is new and the PhoneTabs test above only
// checks labels; seam=none
describe('phone tab strip', () => {
  const none = { play: false, home: false, colours: false, board: false, more: false }

  it('marks only the active tab as the current page, and More toggles through onMore', async () => {
    const { PhoneTabStrip } = await import('@/components/NavTabs')
    const onMore = vi.fn()
    const { container, getByText } = render(
      <PhoneTabStrip playHref="/scoring/s1" playLabel="Play" playColour="#EA4742" live={false}
        active={{ ...none, colours: true }} onMore={onMore} />,
    )
    const current = [...container.querySelectorAll('[aria-current="page"]')].map(e => e.textContent)
    expect(current).toEqual(['Colours'])
    expect(container.querySelector('a[href="/scoring/s1"]')?.textContent).toBe('Play')
    fireEvent.click(getByText('More'))
    expect(onMore).toHaveBeenCalledTimes(1)
  })

  it('shows the live dot on PLAY only while a game runs', async () => {
    const { PhoneTabStrip } = await import('@/components/NavTabs')
    const props = { playHref: '/scoring/s1', playLabel: 'Play', playColour: '#EA4742', active: none, onMore: () => {} }
    const dots = (c: HTMLElement) => c.querySelectorAll('span[aria-hidden]').length
    const off = render(<PhoneTabStrip {...props} live={false} />)
    expect(dots(off.container)).toBe(0)
    cleanup()
    const on = render(<PhoneTabStrip {...props} live />)
    expect(dots(on.container)).toBe(1)
    expect(on.container.querySelector('a[href="/scoring/s1"] span[aria-hidden]')).toBeTruthy()
  })
})

// Value: protects=Submit on the quick-entry and add-events sheets staying tappable on phones;
// fails_when=a sheet's zIndex drops to or below the top bar's (1000-1010), so the nav, which now
// holds the phone tabs, covers the sheet; why_new=the zIndex raise is new in this change and no
// test reads it; seam=none
describe('sheets sit above the one bar', () => {
  it('every play sheet stacks above every fixed layer of the top bar and its menu', async () => {
    const fs = await import('node:fs')
    const zs = (file: string) =>
      [...fs.readFileSync(file, 'utf8').matchAll(/position: 'fixed'[^}]*?zIndex: (\d+)/g)].map(m => Number(m[1]))
    const nav = [...zs('components/Navbar.tsx'), ...zs('components/NavTabs.tsx')]
    expect(nav.length).toBeGreaterThan(0)
    const top = Math.max(...nav)
    for (const sheet of ['components/play/QuickEntrySheet.tsx', 'components/play/AddEventsSheet.tsx']) {
      const own = zs(sheet)
      expect(own.length, sheet).toBeGreaterThan(0)
      expect(Math.min(...own), sheet).toBeGreaterThan(top)
    }
  })
})
