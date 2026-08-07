// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import ColourAlertBanner from '@/components/ColourAlertBanner'
import ColourWatchlistPanel from '@/components/ColourWatchlist'
import { colourByRung } from '@/lib/colours'
import type { ColourAlert, WatchlistEntry } from '@/lib/colourAlerts'

afterEach(cleanup)

function alert(over: Partial<ColourAlert> = {}): ColourAlert {
  return {
    playerId: 'p1',
    playerName: 'Meredith',
    colour: colourByRung(3)!, // Whero
    state: 'earned',
    lifetimePoints: 940,
    guaranteed: 70,
    projected: 130,
    shortfall: 0,
    ...over,
  }
}

function entry(over: Partial<WatchlistEntry> = {}): WatchlistEntry {
  return {
    playerId: 'p1',
    playerName: 'Meredith',
    colour: colourByRung(3)!,
    pointsToGo: 200,
    avgPointsPerSession: 150,
    sessionsAway: 2,
    ...over,
  }
}

describe('ColourAlertBanner', () => {
  it('renders nothing when there is nothing to announce', () => {
    const { container } = render(
      <ColourAlertBanner alerts={[]} claimingPlayerId={null} onCelebrate={() => {}} />,
    )
    expect(container.innerHTML).toBe('')
  })

  it('an earned alert says "has earned" and offers the Celebrated button', () => {
    render(<ColourAlertBanner alerts={[alert()]} claimingPlayerId={null} onCelebrate={() => {}} />)
    expect(screen.getByTestId('colour-alert-p1')).toHaveProperty('dataset.state', 'earned')
    expect(screen.getByText(/has earned/)).toBeTruthy()
    expect(screen.getByText('Whero')).toBeTruthy()
    expect(screen.getByText('Confirmed — safe to announce')).toBeTruthy()
    expect(screen.getByRole('button', { name: /celebrated/i })).toBeTruthy()
  })

  it('an on-track alert has NO button — announcing it could be retracted', () => {
    render(
      <ColourAlertBanner
        alerts={[alert({ state: 'on-track', shortfall: 40 })]}
        claimingPlayerId={null}
        onCelebrate={() => {}}
      />,
    )
    expect(screen.getByText(/is on track for/)).toBeTruthy()
    expect(screen.getByText(/40 more guaranteed pts needed/)).toBeTruthy()
    expect(screen.queryByRole('button')).toBeNull()
  })

  it('fires onCelebrate with the alert when the button is tapped', () => {
    const onCelebrate = vi.fn()
    const a = alert()
    render(<ColourAlertBanner alerts={[a]} claimingPlayerId={null} onCelebrate={onCelebrate} />)
    fireEvent.click(screen.getByRole('button', { name: /celebrated/i }))
    expect(onCelebrate).toHaveBeenCalledTimes(1)
    expect(onCelebrate).toHaveBeenCalledWith(a)
  })

  it('disables the button while that player’s claim is in flight', () => {
    const onCelebrate = vi.fn()
    render(<ColourAlertBanner alerts={[alert()]} claimingPlayerId="p1" onCelebrate={onCelebrate} />)
    const btn = screen.getByRole('button') as HTMLButtonElement
    expect(btn.disabled).toBe(true)
    expect(btn.textContent).toContain('Saving')
    fireEvent.click(btn)
    expect(onCelebrate).not.toHaveBeenCalled()
  })

  it('only disables the row being claimed, not every row', () => {
    render(
      <ColourAlertBanner
        alerts={[alert(), alert({ playerId: 'p2', playerName: 'Salvador' })]}
        claimingPlayerId="p1"
        onCelebrate={() => {}}
      />,
    )
    const buttons = screen.getAllByRole('button') as HTMLButtonElement[]
    expect(buttons.map(b => b.disabled)).toEqual([true, false])
  })

  it('renders a rainbow chip edge for Taniwha Uenuku instead of a solid fallback', () => {
    render(
      <ColourAlertBanner
        alerts={[alert({ colour: colourByRung(18)! })]}
        claimingPlayerId={null}
        onCelebrate={() => {}}
      />,
    )
    const chip = screen.getByTestId('colour-alert-p1').firstElementChild!.nextElementSibling as HTMLElement
    expect(chip.style.border).toContain('transparent')
    expect(chip.style.backgroundImage).toContain('linear-gradient')
  })
})

describe('ColourWatchlistPanel', () => {
  it('renders nothing when nobody is close', () => {
    const { container } = render(<ColourWatchlistPanel entries={[]} />)
    expect(container.innerHTML).toBe('')
  })

  it('shows the player, target colour, gap and current form', () => {
    render(<ColourWatchlistPanel entries={[entry()]} />)
    expect(screen.getByText('Approaching a colour')).toBeTruthy()
    expect(screen.getByText(/Meredith/)).toBeTruthy()
    expect(screen.getByText('Whero')).toBeTruthy()
    expect(screen.getByText(/200 pts to go · averaging 150\/session/)).toBeTruthy()
    expect(screen.getByText('2')).toBeTruthy()
  })

  it('says "session" not "sessions" when only one is left', () => {
    render(<ColourWatchlistPanel entries={[entry({ sessionsAway: 1 })]} />)
    expect(screen.getByText('session')).toBeTruthy()
    expect(screen.queryByText('sessions')).toBeNull()
  })

  it('renders one row per player', () => {
    render(
      <ColourWatchlistPanel
        entries={[entry(), entry({ playerId: 'p2', playerName: 'Salvador', sessionsAway: 3 })]}
      />,
    )
    expect(screen.getByText(/Meredith/)).toBeTruthy()
    expect(screen.getByText(/Salvador/)).toBeTruthy()
    expect(screen.getAllByText('sessions')).toHaveLength(2)
  })

  it('formats a four-figure gap with a thousands separator', () => {
    render(<ColourWatchlistPanel entries={[entry({ colour: colourByRung(10)!, pointsToGo: 1500 })]} />)
    expect(screen.getByText(/1,500 pts to go/)).toBeTruthy()
  })
})
