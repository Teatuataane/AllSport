import { describe, it, expect } from 'vitest'
import { seasonMedals, rankMedals } from '@/lib/medalTable'

const sessions = [
  { id: 's1', session_date: '2026-03-01' },
  { id: 's2', session_date: '2026-03-08' },
  { id: 's3', session_date: '2025-12-20' },
  { id: 's4', session_date: '2026-04-01' },
]

describe('seasonMedals', () => {
  it('counts one medal per game, not per result row', () => {
    const m = seasonMedals([
      { player_id: 'a', session_id: 's1', placement: 1 },
      { player_id: 'a', session_id: 's1', placement: 1 },
      { player_id: 'a', session_id: 's1', placement: 1 },
    ], sessions, 2026)
    expect(m.get('a')).toEqual({ gold: 1, silver: 0, bronze: 0, games: 1 })
  })

  it('only counts games in the season year', () => {
    const m = seasonMedals([
      { player_id: 'a', session_id: 's1', placement: 1 },
      { player_id: 'a', session_id: 's3', placement: 1 },
    ], sessions, 2026)
    expect(m.get('a')?.gold).toBe(1)
  })

  it('counts a walkover: a division of one still wins gold', () => {
    const m = seasonMedals([{ player_id: 'solo', session_id: 's2', placement: 1 }], sessions, 2026)
    expect(m.get('solo')?.gold).toBe(1)
  })

  it('counts 4th and below as a game but no medal', () => {
    const m = seasonMedals([
      { player_id: 'a', session_id: 's1', placement: 2 },
      { player_id: 'a', session_id: 's2', placement: 3 },
      { player_id: 'a', session_id: 's4', placement: 5 },
    ], sessions, 2026)
    expect(m.get('a')).toEqual({ gold: 0, silver: 1, bronze: 1, games: 3 })
  })

  it('ignores guests and games with no placement (voided or never closed)', () => {
    const m = seasonMedals([
      { player_id: null, session_id: 's1', placement: 1 },
      { player_id: 'a', session_id: 's1', placement: null },
    ], sessions, 2026)
    expect(m.size).toBe(0)
  })
})

describe('rankMedals', () => {
  const p = (playerId: string, gold: number, silver: number, bronze: number, games = 1) =>
    ({ playerId, name: playerId, gold, silver, bronze, games })

  it('ranks by gold, then silver, then bronze', () => {
    const r = rankMedals([p('b', 1, 5, 5), p('a', 2, 0, 0), p('c', 1, 5, 6)])
    expect(r.map(x => x.playerId)).toEqual(['a', 'c', 'b'])
  })

  it('never lets games played outrank a medal', () => {
    const r = rankMedals([p('regular', 0, 0, 1, 40), p('once', 1, 0, 0, 1)])
    expect(r[0].playerId).toBe('once')
  })

  it('players level on all three share a place', () => {
    const r = rankMedals([p('a', 1, 1, 0), p('b', 1, 1, 0), p('c', 1, 0, 0)])
    expect(r.map(x => x.rank)).toEqual([1, 1, 3])
  })
})
