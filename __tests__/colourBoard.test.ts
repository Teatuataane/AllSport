import { describe, it, expect } from 'vitest'
import { rankByColours, colourStanding, countGames } from '@/lib/colourBoard'

const all = (rung: number) => new Map(Array.from({ length: 10 }, (_, i) => [i + 1, rung]))

describe('colourStanding', () => {
  it('counts a missing domain as Mā in the average', () => {
    const nine = all(4); nine.delete(10)
    expect(colourStanding(nine, 100)).toEqual({ domainsHeld: 9, colourSum: 36, overall: 3 })
  })
  it('the overall is the average domain, rounded down', () => {
    const m = all(5); m.set(3, 2)
    expect(colourStanding(m, 100).overall).toBe(4)
  })
  it('caps the overall by games played, as HOME does', () => {
    // Kōwhai (4) needs 8 games; with 7 the board shows Karaka (3).
    expect(colourStanding(all(4), 7).overall).toBe(3)
    expect(colourStanding(all(4), 8).overall).toBe(4)
  })
  it('handles a player with nothing conferred', () => {
    expect(colourStanding(undefined, 0)).toEqual({ domainsHeld: 0, colourSum: 0, overall: 0 })
  })
})

describe('countGames', () => {
  it('counts distinct sessions, skipping guests and every excluded session', () => {
    const rows = [
      { player_id: 'a', session_id: 's1' }, { player_id: 'a', session_id: 's1' },
      { player_id: 'a', session_id: 's2' }, { player_id: 'a', session_id: 'void' },
      { player_id: 'a', session_id: 'live' }, { player_id: null, session_id: 's1' },
      { player_id: 'b', session_id: 'live' },
    ]
    const g = countGames(rows, new Set(['void', 'live']))
    expect(g.get('a')).toBe(2)
    expect(g.has('b')).toBe(false)
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

describe('displayOverall', () => {
  it('hides a Mā overall so the cell counts domains instead', async () => {
    const { displayOverall } = await import('@/lib/colourBoard')
    expect(displayOverall({ overall: 0 })).toBeNull()
    expect(displayOverall({ overall: 4 })).toBe(4)
  })
})
