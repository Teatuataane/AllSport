// @vitest-environment jsdom
//
// ── HOME's weekly games card and the walk-up offer ───────────────────────────
// What this pins:
//   1. Each weekly game shows its next date and a Join button until joined.
//   2. A cancelled or moved date is shown with the kaiwhakawā's words.
//   3. A joined player can say they cannot make the next date, and undo it.
//   4. The walk-up offer joins, or goes away on "Not now".

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react'
import WeeklyGamesCard from '@/components/WeeklyGamesCard'
import { WeeklyGameOfferView } from '@/components/play/WeeklyGameOffer'
import type { GameNotice, Site, WeeklyGame } from '@/lib/weeklyGames'

afterEach(cleanup)

// Tuesday 17 Nov 2026, 9am NZDT.
const now = new Date('2026-11-17T09:00:00+13:00')
const site: Site = { id: 's1', name: 'AllSport HQ', address: '26 Carbine Place, Sockburn', map_url: null, is_active: true }
const tue: WeeklyGame = { id: 'tue', site_id: 's1', dow: 2, start_time: '16:30:00', is_active: true }
const sat: WeeklyGame = { id: 'sat', site_id: 's1', dow: 6, start_time: '09:00:00', is_active: true }
const notice = (over: Partial<GameNotice>): GameNotice => ({
  id: Math.random().toString(36), weekly_game_id: 'tue', game_date: '2026-11-17',
  kind: 'message', message: null, created_at: '2026-11-17T06:00:00Z', ...over,
})

function renderCard(over: Partial<Parameters<typeof WeeklyGamesCard>[0]> = {}) {
  const handlers = { onJoin: vi.fn(), onLeave: vi.fn(), onAway: vi.fn() }
  render(
    <WeeklyGamesCard
      sites={[site]} games={[sat, tue]} notices={[]} mine={new Set()} away={new Set()} now={now}
      {...handlers} {...over}
    />,
  )
  return handlers
}

describe('WeeklyGamesCard', () => {
  it('lists games in week order with their next date and a Join button', () => {
    const h = renderCard()
    const rows = screen.getAllByTestId(/weekly-game-/)
    expect(rows.map(r => r.dataset.testid)).toEqual(['weekly-game-tue', 'weekly-game-sat'])
    expect(within(rows[0]).getByText('Tuesday 4:30pm')).toBeTruthy()
    expect(within(rows[0]).getByText('Next: Today')).toBeTruthy()
    expect(within(rows[1]).getByText('Next: Sat 21 Nov')).toBeTruthy()
    fireEvent.click(within(rows[1]).getByRole('button', { name: 'Join' }))
    expect(h.onJoin).toHaveBeenCalledWith('sat')
  })

  it('shows a cancellation and a move with the kaiwhakawā\'s words', () => {
    renderCard({
      notices: [
        notice({ kind: 'cancelled', message: 'Cancelled because of rain.' }),
        notice({ weekly_game_id: 'sat', game_date: '2026-11-21', kind: 'moved', message: 'Jellie Park, by the pavilion' }),
      ],
    })
    const [tueRow, satRow] = screen.getAllByTestId(/weekly-game-/)
    expect(within(tueRow).getByText('Cancelled')).toBeTruthy()
    expect(within(tueRow).getByText('Cancelled because of rain.')).toBeTruthy()
    expect(within(satRow).getByText('Moved')).toBeTruthy()
    expect(within(satRow).getByText('Jellie Park, by the pavilion')).toBeTruthy()
  })

  it('lets a joined player miss the next date, undo it, or leave', () => {
    const h = renderCard({ mine: new Set(['sat']) })
    const satRow = screen.getAllByTestId(/weekly-game-/)[1]
    expect(within(satRow).getByText('Joined')).toBeTruthy()
    fireEvent.click(within(satRow).getByRole('button', { name: "Can't make it Sat 21 Nov" }))
    expect(h.onAway).toHaveBeenCalledWith('sat', '2026-11-21', true)
    fireEvent.click(within(satRow).getByRole('button', { name: 'Leave this weekly game' }))
    expect(h.onLeave).toHaveBeenCalledWith('sat')
    cleanup()

    const h2 = renderCard({ mine: new Set(['sat']), away: new Set(['sat|2026-11-21']) })
    const row = screen.getAllByTestId(/weekly-game-/)[1]
    expect(within(row).getByText('You are away')).toBeTruthy()
    fireEvent.click(within(row).getByRole('button', { name: 'I can come Sat 21 Nov after all' }))
    expect(h2.onAway).toHaveBeenCalledWith('sat', '2026-11-21', false)
  })

  it('says whose games they are when a parent views a child', () => {
    renderCard({ who: 'Aroha' })
    expect(screen.getByText("Aroha's weekly games")).toBeTruthy()
  })

  it('shows nothing when there are no weekly games', () => {
    const { container } = render(
      <WeeklyGamesCard sites={[site]} games={[]} notices={[]} mine={new Set()} away={new Set()}
        onJoin={() => {}} onLeave={() => {}} onAway={() => {}} />,
    )
    expect(container.innerHTML).toBe('')
  })
})

describe('WeeklyGameOfferView', () => {
  it('offers the weekly game and reports a join', () => {
    const onJoin = vi.fn()
    const onDismiss = vi.fn()
    render(<WeeklyGameOfferView game={sat} site={site} state="offer" onJoin={onJoin} onDismiss={onDismiss} />)
    expect(screen.getByText('Saturday 9:00am')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Join weekly game' }))
    expect(onJoin).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Not now' }))
    expect(onDismiss).toHaveBeenCalled()
  })

  it('confirms once joined', () => {
    render(<WeeklyGameOfferView game={sat} site={site} state="joined" onJoin={() => {}} onDismiss={() => {}} />)
    expect(screen.getByText(/You will hear about Saturday 9:00am at AllSport HQ/)).toBeTruthy()
  })
})

describe('PushStrip (phase 2)', () => {
  const base = { busy: false, error: '', onTurnOn: vi.fn(), onTurnOff: vi.fn() }
  it('shows only once the player has joined a game', () => {
    renderCard({ push: { ...base, state: 'off' } })
    expect(screen.queryByTestId('push-strip')).toBeNull()
    cleanup()
    renderCard({ mine: new Set(['sat']), push: { ...base, state: 'off' } })
    fireEvent.click(screen.getByRole('button', { name: 'Turn on notices' }))
    expect(base.onTurnOn).toHaveBeenCalled()
  })
  it('tells an iPhone to add to Home Screen, and says email covers the rest', () => {
    renderCard({ mine: new Set(['sat']), push: { ...base, state: 'ios-install' } })
    expect(screen.getByText(/Add to Home Screen/)).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Turn on notices' })).toBeNull()
    cleanup()
    renderCard({ mine: new Set(['sat']), push: { ...base, state: 'denied' } })
    expect(screen.getByText(/come by email/)).toBeTruthy()
  })
  it('lets a phone with notices on turn them off', () => {
    renderCard({ mine: new Set(['sat']), push: { ...base, state: 'on' } })
    fireEvent.click(screen.getByRole('button', { name: 'Turn off' }))
    expect(base.onTurnOff).toHaveBeenCalled()
  })
})
