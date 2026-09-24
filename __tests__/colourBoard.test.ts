import { describe, it, expect } from 'vitest'
import { rankByColours, colourStanding } from '@/lib/colourBoard'

const all = (rung: number) => new Map(Array.from({ length: 10 }, (_, i) => [i + 1, rung]))

describe('colourStanding', () => {
  it('counts a missing domain as Mā in the average', () => {
    const nine = all(4); nine.delete(10)
    expect(colourStanding(nine)).toEqual({ domainsHeld: 9, colourSum: 36, overall: 3 })
  })
  it('the overall is the average domain, rounded down', () => {
    const m = all(5); m.set(3, 2)
    expect(colourStanding(m).overall).toBe(4)
  })
  it('handles a player with nothing conferred', () => {
    expect(colourStanding(undefined)).toEqual({ domainsHeld: 0, colourSum: 0, overall: 0 })
  })
})

describe('rankByColours', () => {
  it('ranks on the average, so nine Taniwha domains beat ten Kiwikiwi', () => {
    const nine = all(12); nine.delete(1)
    const rows = rankByColours([
      { playerId: 'a', name: 'A', held: nine, games: 90 },
      { playerId: 'b', name: 'B', held: all(1), games: 2 },
    ])
    expect(rows.map(r => r.playerId)).toEqual(['a', 'b'])
  })

  it('falls back to games when nobody holds a colour, so the board does not all tie', () => {
    const rows = rankByColours([
      { playerId: 'a', name: 'A', held: undefined, games: 3 },
      { playerId: 'b', name: 'B', held: undefined, games: 12 },
    ])
    expect(rows.map(r => [r.playerId, r.rank])).toEqual([['b', 1], ['a', 2]])
  })

  it('shares a rank on a full tie, and the next rank skips', () => {
    const rows = rankByColours([
      { playerId: 'a', name: 'A', held: undefined, games: 5 },
      { playerId: 'b', name: 'B', held: undefined, games: 5 },
      { playerId: 'c', name: 'C', held: undefined, games: 1 },
    ])
    expect(rows.map(r => r.rank)).toEqual([1, 1, 3])
  })
})
