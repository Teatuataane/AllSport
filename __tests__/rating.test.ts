import { describe, it, expect } from 'vitest'
import { divisionPool, sessionWins } from '@/lib/rating'

// The Elo engine this file used to cover (computeRatings / eloTo100 /
// domainRatings / topEvent / topDomain) was deleted in the August 2026
// performance pass — it had zero call sites once percentiles replaced the
// player-facing skill score. See PERF_AGGREGATION_PLAN.md.

describe('divisionPool', () => {
  it('unifies masters/grandmasters into gender pools and treats Youth as Juniors', () => {
    expect(divisionPool("Men's")).toBe('men')
    expect(divisionPool('Grandmaster Men')).toBe('men')
    expect(divisionPool('Masters Women')).toBe('women')
    expect(divisionPool('Youth')).toBe('juniors')
    expect(divisionPool(null)).toBeNull()
  })
})

describe('sessionWins', () => {
  it('counts each won session once, ignoring extra rows', () => {
    const rows = [
      { player_id: 'a', session_id: 's1', placement: 1 },
      { player_id: 'a', session_id: 's1', placement: 1 }, // second event row, same session
      { player_id: 'a', session_id: 's2', placement: 2 },
      { player_id: 'b', session_id: 's1', placement: 2 },
      { player_id: null, session_id: 's1', placement: 1 },
    ]
    const w = sessionWins(rows)
    expect(w.get('a')).toBe(1)
    expect(w.get('b')).toBeUndefined()
  })
})
