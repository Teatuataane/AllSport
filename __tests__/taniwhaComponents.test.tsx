// @vitest-environment jsdom
//
// Ported from __tests__/colourComponents.test.tsx when the colour ladder was
// retired. The behaviours under test did not change with the rework — an
// on-track alert must never offer a button, and only the row being claimed may
// be disabled — so the assertions carry straight over to the taniwha versions.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import TaniwhaAlertBanner from '@/components/TaniwhaAlertBanner'
import TaniwhaWatchlist from '@/components/TaniwhaWatchlist'
import { taniwhaForDomain, KAHUI, WHANAU } from '@/lib/taniwha'
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
