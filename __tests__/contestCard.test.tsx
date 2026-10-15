// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { ContestCard, ContestJudgeCard, firstName } from '@/components/play/ContestCard'
import type { ContestState } from '@/lib/useContest'

afterEach(cleanup)

const base: ContestState = { status: 'idle', pairing: null, waiting: 0, noneEligible: false, matches: 3, played: 0 }
const noop = () => {}
const card = (state: Partial<ContestState>, handlers: Partial<{ onReady: () => void; onLeave: () => void; onBye: () => void }> = {}) =>
  render(<ContestCard state={{ ...base, ...state }} busy={false} error={null} locked={false}
    onReady={handlers.onReady ?? noop} onLeave={handlers.onLeave ?? noop} onBye={handlers.onBye ?? noop} />)

describe('ContestCard', () => {
  it('starts with Ready and the match count', () => {
    const onReady = vi.fn()
    card({}, { onReady })
    expect(screen.getByTestId('contest-card').textContent).toContain('Match 1 of 3')
    fireEvent.click(screen.getByRole('button', { name: 'Ready for a match' }))
    expect(onReady).toHaveBeenCalled()
  })
  it('names whom to find once paired', () => {
    card({ status: 'paired', pairing: { id: 'p', opponent_id: 'o', opponent_name: 'Aroha Smith', opponent_icon: '🦊', by_judge: false } })
    expect(screen.getByTestId('contest-paired').textContent).toContain('Find Aroha')
    expect(screen.queryByRole('button', { name: 'Ready for a match' })).toBeNull()
  })
  it('offers a bye only when nobody can be paired', () => {
    card({ status: 'waiting', waiting: 1 })
    expect(screen.queryByRole('button', { name: 'Take a bye' })).toBeNull()
    cleanup()
    const onBye = vi.fn()
    card({ status: 'waiting', waiting: 1, noneEligible: true }, { onBye })
    fireEvent.click(screen.getByRole('button', { name: 'Take a bye' }))
    expect(onBye).toHaveBeenCalled()
  })
  it('asks for a bodyweight on a contact event', () => {
    card({ status: 'needs_bodyweight' })
    expect(screen.getByTestId('contest-card').textContent).toContain("Enter today's bodyweight")
  })
  it('says extra matches count once the target is met', () => {
    card({ played: 3 })
    expect(screen.getByTestId('contest-card').textContent).toContain('3 played · extra matches count')
    expect(screen.getByRole('button', { name: 'Ready for another' })).toBeTruthy()
  })
  it('first names', () => {
    expect(firstName('  Aroha  Smith ')).toBe('Aroha')
  })
})

describe('ContestJudgeCard', () => {
  it('pairs two waiting players and changes the rules', () => {
    const onPair = vi.fn(), onRules = vi.fn()
    render(<ContestJudgeCard error={null} onPair={onPair} onRules={onRules} board={{
      waiting: [{ id: 'a', name: 'Ann', points: 1 }, { id: 'b', name: 'Ben', points: 0 }], paired: [], matches: 3, mixed: false,
    }} />)
    fireEvent.click(screen.getByText('Ann · 1'))
    fireEvent.click(screen.getByText('Ben · 0'))
    fireEvent.click(screen.getByRole('button', { name: 'Pair these two' }))
    expect(onPair).toHaveBeenCalledWith('a', 'b')
    fireEvent.click(screen.getByRole('button', { name: 'More matches' }))
    expect(onRules).toHaveBeenCalledWith(4, false)
  })
})
