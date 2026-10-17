// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ContestCard, ContestJudgeCard, firstName, type ContestName } from '@/components/play/ContestCard'
import type { ContestRecord } from '@/lib/swiss'

afterEach(cleanup)

const rec = (playerId: string, wins: number, losses: number, draws = 0): ContestRecord =>
  ({ playerId, wins, losses, draws, points: wins + draws / 2, games: wins + losses + draws, met: new Set(), lastAt: '' })
const named = (id: string, name: string, wins: number, losses: number): ContestName => ({ id, name, record: rec(id, wins, losses) })
const noop = () => {}

describe('ContestCard', () => {
  it('says to play anyone before the first match', () => {
    render(<ContestCard me={null} suggestions={[]} unbeaten={[]} needsBodyweight={false} pickedId={null} locked={false} onPick={noop} />)
    expect(screen.getByTestId('contest-first').textContent).toContain('Play anyone')
    expect(screen.queryByTestId('contest-suggestion')).toBeNull()
  })
  it('shows who to play next, and tapping one picks them', () => {
    const onPick = vi.fn()
    render(<ContestCard me={rec('me', 2, 0)} suggestions={[named('a', 'Aroha Smith', 2, 0), named('h', 'Hemi Rua', 1, 0)]}
      unbeaten={[]} needsBodyweight={false} pickedId="h" locked={false} onPick={onPick} />)
    const chips = screen.getAllByTestId('contest-suggestion')
    expect(chips.map(c => c.textContent)).toEqual(['Aroha2–0', 'Hemi1–0'])
    expect(chips[1].getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByTestId('contest-card').textContent).toContain('You: 2–0')
    fireEvent.click(chips[0])
    expect(onPick).toHaveBeenCalledWith('a', 'Aroha Smith')
  })
  it('says so when nobody can be suggested', () => {
    render(<ContestCard me={rec('me', 1, 0)} suggestions={[]} unbeaten={[]} needsBodyweight={false} pickedId={null} locked={false} onPick={noop} />)
    expect(screen.getByTestId('contest-none')).toBeTruthy()
  })
  it('asks for a bodyweight on a contact event without one', () => {
    render(<ContestCard me={rec('me', 1, 0)} suggestions={[named('a', 'Aroha', 1, 0)]} unbeaten={[]} needsBodyweight
      pickedId={null} locked={false} onPick={noop} />)
    expect(screen.getByTestId('contest-card').textContent).toContain('bodyweight')
    expect(screen.queryByTestId('contest-suggestion')).toBeNull()
  })
  it('names who is unbeaten today', () => {
    render(<ContestCard me={null} suggestions={[]} needsBodyweight={false} pickedId={null} locked={false} onPick={noop}
      unbeaten={[named('a', 'Aroha Smith', 3, 0), named('b', 'Ben', 2, 0), named('c', 'Cai', 1, 0), named('d', 'Dee', 1, 0)]} />)
    expect(screen.getByTestId('contest-unbeaten').textContent).toBe('Unbeaten today: Aroha (3–0), Ben (2–0), Cai (1–0) and 1 more')
  })
})

describe('ContestJudgeCard', () => {
  it('shows the table and the mixed switch on contact events', () => {
    const onMixed = vi.fn()
    render(<ContestJudgeCard table={[named('a', 'Aroha Smith', 2, 0), named('b', 'Ben', 0, 2)]} unbeaten={[]} contact mixed={false}
      error={null} onMixed={onMixed} />)
    expect(screen.getByTestId('contest-table').textContent).toBe('Aroha Smith2–0Ben0–2')
    fireEvent.click(screen.getByRole('checkbox'))
    expect(onMixed).toHaveBeenCalledWith(true)
  })
  it('has no mixed switch when the event is not contact', () => {
    render(<ContestJudgeCard table={[]} unbeaten={[]} contact={false} mixed={false} error={null} onMixed={noop} />)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('firstName', () => {
  it('is the first word', () => {
    expect(firstName('  Aroha  Smith ')).toBe('Aroha')
  })
})
