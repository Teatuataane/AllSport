import { describe, it, expect } from 'vitest'
import { divisionPool } from '@/lib/rating'

// The Elo engine this file used to cover (computeRatings / eloTo100 /
// domainRatings / topEvent / topDomain) was deleted in the August 2026
// performance pass — it had zero call sites once percentiles replaced the
// player-facing skill score. See PERF_AGGREGATION_PLAN.md.

describe('divisionPool', () => {
  it('has three pools, one per division', () => {
    expect(divisionPool("Men's")).toBe('men')
    expect(divisionPool("Women's")).toBe('women')
    expect(divisionPool('Juniors')).toBe('juniors')
    // Folded in by 20261019214532; no row holds them.
    expect(divisionPool('Masters Women')).toBeNull()
    expect(divisionPool(null)).toBeNull()
  })
})
