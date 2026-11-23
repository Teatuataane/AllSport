// @vitest-environment jsdom
//
// ── HOME's weekly games card and the walk-up offer ───────────────────────────
// What this pins:
//   1. Each weekly game shows its next date and a Join button until joined.
//   2. A cancelled or moved date is shown with the kaiwhakawā's words.
//   3. A joined player answers "Coming?" for the next date (and a parent for
//      each child), sees the counts, and the question stands out from 4pm the
//      day before. Before the bookings migration, "Can't make it" still works.
//   4. The walk-up offer joins, or goes away on "Not now".

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent, within } from '@testing-library/react'
import WeeklyGamesCard from '@/components/WeeklyGamesCard'
import { WeeklyGameOfferView } from '@/components/play/WeeklyGameOffer'
import { ComingListView } from '@/components/play/ComingList'
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
  const handlers = { onJoin: vi.fn(), onLeave: vi.fn(), onAnswer: vi.fn() }
  render(
    <WeeklyGamesCard
      sites={[site]} games={[sat, tue]} notices={[]} mine={new Set()} playerId="me" answers={new Map()} now={now}
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

  it('asks a joined player "Coming?" and takes an answer back on a second tap', () => {
    const h = renderCard({ mine: new Set(['sat']) })
    const satRow = screen.getAllByTestId(/weekly-game-/)[1]
    expect(within(satRow).getByText('Joined')).toBeTruthy()
    const q = within(satRow).getByRole('group', { name: 'Coming Sat 21 Nov?' })
    fireEvent.click(within(q).getByRole('button', { name: 'Yes' }))
    expect(h.onAnswer).toHaveBeenCalledWith('sat', '2026-11-21', 'me', 'yes')
    fireEvent.click(within(satRow).getByRole('button', { name: 'Leave this weekly game' }))
    expect(h.onLeave).toHaveBeenCalledWith('sat')
    cleanup()

    const h2 = renderCard({ mine: new Set(['sat']), answers: new Map([['sat|2026-11-21|me', 'no' as const]]) })
    const row = screen.getAllByTestId(/weekly-game-/)[1]
    expect(within(row).getByText('Not coming')).toBeTruthy()
    const no = within(row).getByRole('button', { name: 'Not this time' })
    expect(no.getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(no)
    expect(h2.onAnswer).toHaveBeenCalledWith('sat', '2026-11-21', 'me', null)
  })

  it('lets a parent answer for each child registered to the game', () => {
    const h = renderCard({ family: [{ id: 'kid', name: 'Aroha', games: new Set(['sat']) }], mine: new Set(['sat']) })
    const satRow = screen.getAllByTestId(/weekly-game-/)[1]
    fireEvent.click(within(satRow).getByRole('button', { name: 'Aroha: Yes' }))
    expect(h.onAnswer).toHaveBeenCalledWith('sat', '2026-11-21', 'kid', 'yes')
    fireEvent.click(within(satRow).getByRole('button', { name: 'You: Not this time' }))
    expect(h.onAnswer).toHaveBeenCalledWith('sat', '2026-11-21', 'me', 'no')
    // The child's game shows even when the parent has not joined it.
    cleanup()
    renderCard({ family: [{ id: 'kid', name: 'Aroha', games: new Set(['sat']) }] })
    const row = screen.getAllByTestId(/weekly-game-/)[1]
    expect(within(row).getByRole('button', { name: 'Yes' })).toBeTruthy()
  })

  it('shows the counts, and no question once the game has started or is cancelled', () => {
    renderCard({
      mine: new Set(['tue', 'sat']),
      counts: new Map([['sat|2026-11-21', { coming: 6, notComing: 3, unanswered: 11 }]]),
      notices: [notice({ kind: 'cancelled' })],
    })
    const [tueRow, satRow] = screen.getAllByTestId(/weekly-game-/)
    expect(within(satRow).getByText("6 coming · 3 not · 11 haven't said")).toBeTruthy()
    expect(within(tueRow).queryByRole('group')).toBeNull()
    cleanup()
    renderCard({ mine: new Set(['tue']), now: new Date('2026-11-17T16:40:00+13:00') })
    expect(within(screen.getAllByTestId(/weekly-game-/)[0]).queryByRole('group')).toBeNull()
  })

  it('keeps "Can\'t make it" until the bookings migration is applied', () => {
    const h = renderCard({ mine: new Set(['sat']), bookingsLive: false })
    const satRow = screen.getAllByTestId(/weekly-game-/)[1]
    expect(within(satRow).queryByRole('group')).toBeNull()
    fireEvent.click(within(satRow).getByRole('button', { name: "Can't make it Sat 21 Nov" }))
    expect(h.onAnswer).toHaveBeenCalledWith('sat', '2026-11-21', 'me', 'no')
  })

  it('says whose games they are when a parent views a child', () => {
    renderCard({ who: 'Aroha' })
    expect(screen.getByText("Aroha's weekly games")).toBeTruthy()
  })

  it('shows nothing when there are no weekly games', () => {
    const { container } = render(
      <WeeklyGamesCard sites={[site]} games={[]} notices={[]} mine={new Set()} playerId="me" answers={new Map()}
        onJoin={() => {}} onLeave={() => {}} onAnswer={() => {}} />,
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

describe('ComingListView (game screen)', () => {
  it('ticks a player once they score, and the Kaiārahi can tick the rest', () => {
    const onTick = vi.fn()
    render(
      <ComingListView
        coming={[{ id: 'a', name: 'Aroha' }, { id: 'b', name: 'Mere' }, { id: 'c', name: 'Tama' }]}
        notComing={2} hereIds={new Set(['a'])} ticked={new Set(['b'])} onTick={onTick}
      />,
    )
    expect(screen.getByText("Said they're coming · 2 of 3 here · 2 not")).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Aroha' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: 'Mere' }).getAttribute('aria-pressed')).toBe('true')
    fireEvent.click(screen.getByRole('button', { name: 'Tama' }))
    expect(onTick).toHaveBeenCalledWith('c')
  })

  it('shows nothing when nobody answered', () => {
    const { container } = render(
      <ComingListView coming={[]} notComing={0} hereIds={new Set()} ticked={new Set()} onTick={() => {}} />,
    )
    expect(container.innerHTML).toBe('')
  })
})
