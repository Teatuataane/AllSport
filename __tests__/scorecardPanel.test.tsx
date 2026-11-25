// @vitest-environment jsdom
//
// ── Scorecard panel (multi-location step 13) ────────────────────────────────
// What this pins:
//   1. Each game shows turn-up, regulars, comebacks, show-up, this term.
//   2. Reach shows only when given (a head), with 1 to 4 as "fewer than 5".

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ScorecardView, type ScoreCardRow } from '@/app/components/ScorecardPanel'
import type { Reach, Scorecard } from '@/lib/successMeasures'

afterEach(cleanup)

const card: Scorecard = {
  turnUp: 6.5, sessions8: 8, trend: [5, 6, null, 7, 6, 7, 8, 7], regulars: 9,
  comeback: { of: 6, yes: 4 }, showUp: { of: 10, yes: 8 }, held: 18,
  cancelled: [{ reason: 'weather', count: 2 }], newPlayers: 12,
}
const reach: Reach = {
  total: 12,
  age: new Map([['12-17', 7], ['25-44', 5]]),
  sex: new Map([['Female', 8], ['Male', 4]]),
  ethnicity: new Map([['Māori', 5], ['European', 9]]),
  deprivation: new Map([['Q5', 6], ['Q2', 3]]),
}
const row = (over: Partial<ScoreCardRow> = {}): ScoreCardRow =>
  ({ key: 'g', title: 'AllSport HQ', sub: 'Tuesdays 4:30pm', card, reach: null, ...over })

describe('ScorecardView', () => {
  it('shows a game\'s measures without reach for a Kaiārahi', () => {
    render(<ScorecardView rows={[row()]} term="Term 4 2026" head={false} />)
    expect(screen.getByText('6.5')).toBeTruthy()
    expect(screen.getByText('67%')).toBeTruthy()
    expect(screen.getByText('80%')).toBeTruthy()
    expect(screen.getByText('held · cancelled 2 Weather')).toBeTruthy()
    expect(screen.queryByText(/Reach/)).toBeNull()
  })

  it('shows reach to a head, hiding groups under five', () => {
    render(<ScorecardView rows={[row({ reach })]} term="Term 4 2026" head />)
    expect(screen.getByText('Reach: 12 new this term')).toBeTruthy()
    expect(screen.getByText('Q5 (most deprived)')).toBeTruthy()
    expect(screen.getAllByText('fewer than 5').length).toBe(2) // Male 4, Q2 3
  })

  it('says so when a Kaiārahi has no games', () => {
    render(<ScorecardView rows={[]} term="Term 4 2026" head={false} />)
    expect(screen.getByText('No games of yours in the last eight weeks.')).toBeTruthy()
  })
})
