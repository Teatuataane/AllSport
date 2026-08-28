// @vitest-environment jsdom
//
// Ported from __tests__/colourComponents.test.tsx when the colour ladder was
// retired. The behaviours under test did not change with the rework — an
// on-track alert must never offer a button, and only the row being claimed may
// be disabled — so the assertions carry straight over to the taniwha versions.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react'
import TaniwhaAlertBanner from '@/components/TaniwhaAlertBanner'
import TaniwhaFigure from '@/components/TaniwhaFigure'
import { TaniwhaPicker, type PlayerTaniwhaRow, type TaniwhaState } from '@/components/TaniwhaCard'
import TaniwhaWatchlist from '@/components/TaniwhaWatchlist'
import {
  taniwhaForDomain, KAHUI, WHANAU, PARTS, IMPLEMENT_PART, partFor,
  BODY_PARTS_PER_TANIWHA,
} from '@/lib/taniwha'
import type { TaniwhaAlert, TaniwhaWatchEntry } from '@/lib/taniwhaAlerts'

afterEach(cleanup)

const TERE = taniwhaForDomain(4)!

function alert(over: Partial<TaniwhaAlert> = {}): TaniwhaAlert {
  return {
    playerId: 'p1',
    playerName: 'Meredith',
    taniwha: TERE,
    state: 'earned',
    crownOrdinal: 2,
    lifetimePoints: 19_990,
    guaranteed: 10,
    projected: 130,
    pointsShortfall: 0,
    winsShortfall: 0,
    ...over,
  }
}

function entry(over: Partial<TaniwhaWatchEntry> = {}): TaniwhaWatchEntry {
  return {
    playerId: 'p1',
    playerName: 'Meredith',
    taniwha: TERE,
    crownOrdinal: 2,
    blocker: 'points',
    partsToGo: 0,
    winsToGo: 0,
    pointsToGo: 300,
    avgPointsPerSession: 150,
    sessionsAway: 2,
    ...over,
  }
}

describe('TaniwhaAlertBanner', () => {
  it('renders nothing when there is nothing to announce', () => {
    const { container } = render(
      <TaniwhaAlertBanner alerts={[]} claimingPlayerId={null} onCelebrate={() => {}} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('an earned alert says so and offers the Celebrated button', () => {
    render(<TaniwhaAlertBanner alerts={[alert()]} claimingPlayerId={null} onCelebrate={() => {}} />)
    expect(screen.getByTestId('taniwha-alert-p1')).toHaveProperty('dataset.state', 'earned')
    expect(screen.getByText(/HAS EARNED CROWN #2/)).toBeTruthy()
    expect(screen.getByText(/SAFE TO CALL IT/)).toBeTruthy()
    expect(screen.getByText(/Te Taniwha o te Tere/)).toBeTruthy()
    expect(screen.getByRole('button', { name: /celebrated/i })).toBeTruthy()
  })

  it('an on-track alert has NO button — announcing it could be retracted', () => {
    render(
      <TaniwhaAlertBanner
        alerts={[alert({ state: 'on-track', winsShortfall: 1 })]}
        claimingPlayerId={null}
        onCelebrate={() => {}}
      />,
    )
    expect(screen.getByTestId('taniwha-alert-p1')).toHaveProperty('dataset.state', 'on-track')
    expect(screen.getByText(/ON TRACK/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: /celebrated/i })).toBeNull()
  })

  it('says which shortfall is holding an on-track alert back', () => {
    const { rerender } = render(
      <TaniwhaAlertBanner alerts={[alert({ state: 'on-track', winsShortfall: 1 })]}
        claimingPlayerId={null} onCelebrate={() => {}} />)
    expect(screen.getByText(/NEEDS THE 9TH WIN/)).toBeTruthy()
    rerender(
      <TaniwhaAlertBanner alerts={[alert({ state: 'on-track', winsShortfall: 0, pointsShortfall: 1200 })]}
        claimingPlayerId={null} onCelebrate={() => {}} />)
    expect(screen.getByText(/1,200 PTS ON CURRENT PLACING/)).toBeTruthy()
  })

  it('fires onCelebrate with the alert when the button is tapped', () => {
    const spy = vi.fn()
    const a = alert()
    render(<TaniwhaAlertBanner alerts={[a]} claimingPlayerId={null} onCelebrate={spy} />)
    fireEvent.click(screen.getByRole('button', { name: /celebrated/i }))
    expect(spy).toHaveBeenCalledWith(a)
  })

  it('only disables the row being claimed, not every row', () => {
    render(
      <TaniwhaAlertBanner
        alerts={[alert(), alert({ playerId: 'p2', playerName: 'Rangi', taniwha: WHANAU })]}
        claimingPlayerId="p1"
        onCelebrate={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button') as HTMLButtonElement[]
    expect(buttons).toHaveLength(2)
    expect(buttons[0].disabled).toBe(true)
    expect(buttons[1].disabled).toBe(false)
    expect(screen.getByText(/Saving/)).toBeTruthy()
  })

  it('renders a gradient chip edge for Te Kāhui instead of falling back to a solid', () => {
    // CSS `border` cannot take a gradient and falls back silently, which has
    // shipped as a real bug twice.
    const { container } = render(
      <TaniwhaAlertBanner alerts={[alert({ taniwha: KAHUI })]} claimingPlayerId={null} onCelebrate={() => {}} />,
    )
    expect(container.innerHTML).toContain('linear-gradient')
  })
})

describe('TaniwhaWatchlist', () => {
  it('renders nothing when nobody is close', () => {
    const { container } = render(<TaniwhaWatchlist entries={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('leads with the BLOCKER, which is the whole point of the panel', () => {
    render(<TaniwhaWatchlist entries={[entry()]} />)
    expect(screen.getByTestId('taniwha-watch-p1')).toHaveProperty('dataset.blocker', 'points')
    expect(screen.getByText('POINTS')).toBeTruthy()
    expect(screen.getByText(/300 pts/)).toBeTruthy()
    expect(screen.getByText(/150\/session/)).toBeTruthy()
  })

  it('says "session" not "sessions" when only one is left', () => {
    render(<TaniwhaWatchlist entries={[entry({ pointsToGo: 100, sessionsAway: 1 })]} />)
    expect(screen.getByText(/about 1 session at/)).toBeTruthy()
  })

  it('tells a coach to chase wins rather than points when that is the blocker', () => {
    render(<TaniwhaWatchlist entries={[entry({ blocker: 'wins', winsToGo: 4, pointsToGo: 0, sessionsAway: null })]} />)
    expect(screen.getByText('WINS')).toBeTruthy()
    expect(screen.getByText(/4 more event wins of 9/)).toBeTruthy()
  })

  it('gives the whānau crown its own wording — it is a referral, not a win', () => {
    render(<TaniwhaWatchlist entries={[entry({ taniwha: WHANAU, blocker: 'wins', winsToGo: 1, sessionsAway: null })]} />)
    expect(screen.getByText(/one qualified referral/)).toBeTruthy()
  })

  it('says READY when nothing is left', () => {
    render(<TaniwhaWatchlist entries={[entry({ blocker: 'ready', pointsToGo: 0, sessionsAway: null })]} />)
    expect(screen.getByText('READY')).toBeTruthy()
    expect(screen.getByText(/the moment this session closes/)).toBeTruthy()
  })

  it('renders one row per player', () => {
    render(<TaniwhaWatchlist entries={[entry(), entry({ playerId: 'p2', playerName: 'Rangi' })]} />)
    expect(screen.getByTestId('taniwha-watch-p1')).toBeTruthy()
    expect(screen.getByTestId('taniwha-watch-p2')).toBeTruthy()
  })

  it('formats a four-figure gap with a thousands separator', () => {
    render(<TaniwhaWatchlist entries={[entry({ pointsToGo: 4200, sessionsAway: 28 })]} />)
    expect(screen.getByText(/4,200 pts/)).toBeTruthy()
  })
})


// ─── TaniwhaFigure art fallback ───────────────────────────────────────────────
// Eleven of the twelve taniwha are not drawn yet. Rather than showing them as
// barely-visible filler geometry, they borrow Whānau's pieces and ink them in
// their own colour. These tests pin the two things that are easy to get wrong
// and invisible when you do.

function maskUrls(container: HTMLElement): string[] {
  return [...container.querySelectorAll<HTMLElement>('div[aria-hidden]')]
    .map(el => el.style.getPropertyValue('mask-image') || el.style.getPropertyValue('-webkit-mask-image'))
    .filter(Boolean)
}

describe('TaniwhaFigure art fallback', () => {
  it('draws an undrawn taniwha with Whanau pieces, before any probe resolves', () => {
    const { container } = render(
      <TaniwhaFigure taniwha={TERE} limbsEarned={4} ink={TERE.accent} ghost="#111" ghostStroke="#222" />
    )
    const urls = maskUrls(container)
    expect(urls.length).toBeGreaterThan(0)
    // Every piece comes from Whanau's folder, never Te Tere's, which has no art.
    for (const u of urls) {
      expect(u).toContain(`/taniwha/${WHANAU.slug}/`)
      expect(u).not.toContain(`/taniwha/${TERE.slug}/`)
    }
  })

  it("borrows Whanau's implement, not the one the taniwha will eventually carry", () => {
    const { container } = render(
      <TaniwhaFigure taniwha={TERE} limbsEarned={10} ink={TERE.accent} ghost="#111" ghostStroke="#222" />
    )
    const urls = maskUrls(container).join(' ')
    // Piece ten is the only piece that differs between taniwha. Asking for Te
    // Tere's implement inside Whanau's folder would 404 and lose the piece.
    expect(urls).toContain(`${partFor(WHANAU, IMPLEMENT_PART)!.slug}.png`)
    expect(urls).not.toContain(`${partFor(TERE, IMPLEMENT_PART)!.slug}.png`)
  })

  it('inks the borrowed art in the taniwha own colour, so they stay distinct', () => {
    const { container } = render(
      <TaniwhaFigure taniwha={TERE} limbsEarned={3} ink={TERE.accent} ghost="#111" ghostStroke="#222" />
    )
    const painted = [...container.querySelectorAll<HTMLElement>('div[aria-hidden]')]
    expect(painted.length).toBe(PARTS.length)
    for (const el of painted) expect(el.style.backgroundColor).toBeTruthy()
  })

  it('leaves Te Kahui on geometry — it is an assembly, not a borrowed creature', () => {
    const { container } = render(
      <TaniwhaFigure taniwha={KAHUI} limbsEarned={5} ink={KAHUI.accent} ghost="#111" ghostStroke="#222" />
    )
    expect(maskUrls(container)).toHaveLength(0)
    expect(container.querySelector('svg')).not.toBeNull()
  })
})

// ─── TaniwhaPicker ────────────────────────────────────────────────────────────
// Leaving Whanau used to be a one-way door: choose_taniwha took a domain number,
// Whanau is the one taniwha without a domain, and this list offered only the
// ten domains. A player who switched could never switch back, and their
// part-built Whanau sat there with no way to resume it.

const rpc = vi.fn<(...a: unknown[]) => Promise<{ error: { message: string } | null }>>(async () => ({ error: null }))
vi.mock('@/lib/supabase-browser', () => ({
  createClient: () => ({ rpc: (...a: unknown[]) => rpc(...(a as [])) }),
}))

function row(over: Partial<PlayerTaniwhaRow> & { taniwha_slug: string }): PlayerTaniwhaRow {
  return {
    domain_number: null, body_parts: 0, is_building: false,
    crowned_at: null, crown_order: null, crowned_session_id: null, ...over,
  }
}

function pickerState(rows: PlayerTaniwhaRow[]): TaniwhaState {
  return { rows, winsByEvent: {}, points: 4_000 }
}

describe('TaniwhaPicker', () => {
  it('offers Whanau alongside the ten domains', () => {
    render(<TaniwhaPicker state={pickerState([row({ taniwha_slug: 'whanau' })])} points={4_000} onChanged={() => {}} />)
    expect(screen.getByText(WHANAU.name)).toBeTruthy()
    // Ten domains plus Whanau.
    expect(screen.getAllByRole('button')).toHaveLength(11)
  })

  it('asks for Whanau with NULL, the only value that names it', async () => {
    rpc.mockClear()
    render(<TaniwhaPicker
      state={pickerState([
        row({ taniwha_slug: 'whanau', body_parts: 4 }),
        row({ taniwha_slug: TERE.slug, domain_number: 4, is_building: true }),
      ])}
      points={4_000} onChanged={() => {}}
    />)
    fireEvent.click(screen.getByText(WHANAU.name))
    expect(rpc).toHaveBeenCalledWith('choose_taniwha', { p_domain_number: null })
  })

  it('shows the pieces already banked on Whanau, so switching back looks safe', () => {
    render(<TaniwhaPicker state={pickerState([row({ taniwha_slug: 'whanau', body_parts: 4 })])} points={4_000} onChanged={() => {}} />)
    expect(screen.getByText(new RegExp(`4/${BODY_PARTS_PER_TANIWHA} pieces`))).toBeTruthy()
  })

  it('still renders while every domain is crowned but Whanau is not', () => {
    const rows = [
      row({ taniwha_slug: 'whanau' }),
      ...Array.from({ length: 10 }, (_, i) => row({
        taniwha_slug: taniwhaForDomain(i + 1)!.slug,
        domain_number: i + 1,
        crowned_at: '2026-08-01T00:00:00Z',
        crown_order: i + 1,
      })),
    ]
    // The old early-return counted the ten domains alone and hid the whole
    // picker here — the exact state a player switching back is in.
    render(<TaniwhaPicker state={pickerState(rows)} points={40_000} onChanged={() => {}} />)
    expect(screen.getByText(WHANAU.name)).toBeTruthy()
  })
})

// ─── TaniwhaFigure art probe (async) ─────────────────────────────────────────
// The first-paint tests above only exercise the SYNCHRONOUS initial state. The
// probe itself is what retires the stand-in when a taniwha is finally drawn, and
// if it broke, every taniwha would render Whānau art forever — dropping in new
// art would silently do nothing, which is exactly the failure class that has
// cost this repo before (a CSS mask reads only alpha, so wrong-but-present art
// still looks right).
//
// jsdom never loads images, so neither onload nor onerror fires on its own.
// Driving them by hand is the only way to reach these branches.

class FakeImage {
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  private _src = ''
  static last: FakeImage | null = null
  set src(v: string) { this._src = v; FakeImage.last = this }
  get src() { return this._src }
}

function withFakeImage<T>(fn: () => T): T {
  const real = globalThis.Image
  ;(globalThis as { Image: unknown }).Image = FakeImage
  try { return fn() } finally { (globalThis as { Image: unknown }).Image = real }
}

describe('TaniwhaFigure art probe', () => {
  it('renders a taniwha OWN art once the probe succeeds', () => {
    // kaha is used by no other test here, so the module-scope probe cache
    // cannot pre-answer for it.
    const KAHA = taniwhaForDomain(1)!
    const { container } = withFakeImage(() => {
      const r = render(
        <TaniwhaFigure taniwha={KAHA} limbsEarned={3} ink={KAHA.accent} ghost="#111" ghostStroke="#222" />
      )
      act(() => { FakeImage.last?.onload?.() })
      return r
    })
    const urls = maskUrls(container).join(' ')
    expect(urls).toContain(`/taniwha/${KAHA.slug}/`)
    expect(urls).not.toContain(`/taniwha/${WHANAU.slug}/`)
  })

  it('falls back to Whanau art when the probe fails', () => {
    const KAHA_TINANA = taniwhaForDomain(2)!
    const { container } = withFakeImage(() => {
      const r = render(
        <TaniwhaFigure taniwha={KAHA_TINANA} limbsEarned={3} ink={KAHA_TINANA.accent} ghost="#111" ghostStroke="#222" />
      )
      act(() => { FakeImage.last?.onerror?.() })
      return r
    })
    const urls = maskUrls(container).join(' ')
    expect(urls).toContain(`/taniwha/${WHANAU.slug}/`)
    expect(urls).not.toContain(`/taniwha/${KAHA_TINANA.slug}/`)
  })

  it('drops Whanau itself to geometry rather than borrowing from itself', () => {
    // The infinite-regress guard. Without it, whānau with missing art would ask
    // for whānau art forever and render an empty frame.
    const { container } = withFakeImage(() => {
      const r = render(
        <TaniwhaFigure taniwha={WHANAU} limbsEarned={3} ink={WHANAU.accent} ghost="#111" ghostStroke="#222" />
      )
      act(() => { FakeImage.last?.onerror?.() })
      return r
    })
    expect(maskUrls(container)).toHaveLength(0)
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('remembers a probe result, so it costs one image load per taniwha per page', () => {
    const HIKO = taniwhaForDomain(3)!
    withFakeImage(() => {
      render(<TaniwhaFigure taniwha={HIKO} limbsEarned={1} ink={HIKO.accent} ghost="#111" ghostStroke="#222" />)
      act(() => { FakeImage.last?.onload?.() })
    })
    cleanup()
    FakeImage.last = null
    // Second mount: the cached answer must settle it with no new Image at all.
    const { container } = withFakeImage(() => render(
      <TaniwhaFigure taniwha={HIKO} limbsEarned={1} ink={HIKO.accent} ghost="#111" ghostStroke="#222" />
    ))
    expect(FakeImage.last).toBeNull()
    expect(maskUrls(container).join(' ')).toContain(`/taniwha/${HIKO.slug}/`)
  })
})

describe('TaniwhaPicker failure and empty states', () => {
  it('shows the server refusal instead of failing silently', async () => {
    // choose_taniwha refuses mid-session (55006) so a crown condition cannot
    // move under a kaiwhakawa about to announce it. Players WILL hit this, and
    // without the message the row just looks dead.
    rpc.mockClear()
    rpc.mockResolvedValueOnce({ error: { message: 'choose_taniwha: not while a session is live — finish the game first' } })
    render(<TaniwhaPicker state={pickerState([row({ taniwha_slug: 'whanau' })])} points={4_000} onChanged={() => {}} />)
    fireEvent.click(screen.getByText(WHANAU.name))
    expect(await screen.findByText(/not while a session is live/)).toBeTruthy()
  })

  it('renders for a player with no taniwha rows at all', () => {
    // A brand-new account before the seed lands. rows.find returns undefined
    // the whole way down, so every optional chain has to hold.
    const { container } = render(<TaniwhaPicker state={pickerState([])} points={0} onChanged={() => {}} />)
    expect(screen.getByText(WHANAU.name)).toBeTruthy()
    expect(container.querySelectorAll('button')).toHaveLength(11)
    // No row means no piece COUNT on any subtitle (the explainer prose above
    // legitimately contains the word "pieces").
    expect(screen.queryByText(new RegExp(`\\d+/${BODY_PARTS_PER_TANIWHA} pieces`))).toBeNull()
  })
})
