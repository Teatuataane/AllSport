import { describe, it, expect } from 'vitest'
import {
  domainRungsOf, seasonPoints, bestAndWorst, eventRungInGame, rankBy, GAME_RESULT_RUNG, MAX_GAME_POINTS, type SeasonRow,
} from '@/lib/leaderboardScores'
import { DRILL_CAP, type DomainGradeResult } from '@/lib/grading'
import type { GradePlayer } from '@/lib/playerGrades'

const open: GradePlayer = { division: "Men's", ageYears: 25, gender: 'male' }
const masters: GradePlayer = { division: 'Masters Women', ageYears: 45, gender: 'female' }

const row = (over: Partial<SeasonRow>): SeasonRow => ({
  session_id: 's1', session_date: '2026-05-02', closed: true,
  event_name: 'Forward Fold', raw_score: 20030, weight_kg: null, difficulty_tier: null,
  ...over,
})

const domain = (n: number, rung: number): DomainGradeResult => ({
  domainNumber: n, rung, availableCount: 12, slots: 6, counted: [], average: rung, nextRung: rung + 1, toNext: 6,
})

describe('domain colours', () => {
  it('lists one rung per domain in order, unplayed domains 0', () => {
    expect(domainRungsOf([domain(1, 6), domain(2, 4), domain(9, 3)])).toEqual([6, 4, 0, 0, 0, 0, 0, 0, 3, 0])
  })
})

describe('an event in one game', () => {
  it('scores the colour rung the result reached', () => {
    // Forward Fold 20030 is rung 6 on the Open ladder.
    expect(eventRungInGame('Forward Fold', [row({})], open)).toBe(6)
  })

  it('shifts for age, so the same result is worth more to a Master', () => {
    // This is what lets people who never meet compete: the ladder, not the score, moves.
    expect(eventRungInGame('Forward Fold', [row({})], masters)).toBe(7)
  })

  it('takes the best of several rows in the same game', () => {
    expect(eventRungInGame('Forward Fold', [row({ raw_score: 10 }), row({})], open)).toBe(6)
  })

  it('scores a retired event name as nothing rather than throwing', () => {
    expect(eventRungInGame('Toe Squat', [row({ event_name: 'Toe Squat' })], open)).toBe(0)
  })

  it('pays for playing the real contest, a win above a draw above a loss', () => {
    // Tennis: the Game rung is tier 5 (index 4), raw = 40000 + result term.
    const game = (term: number) => [row({ event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40000 + term })]
    expect(eventRungInGame('Tennis', game(2), open)).toBe(GAME_RESULT_RUNG[2])
    expect(eventRungInGame('Tennis', game(1), open)).toBe(GAME_RESULT_RUNG[1])
    expect(eventRungInGame('Tennis', game(0), open)).toBe(GAME_RESULT_RUNG[0])
    expect(GAME_RESULT_RUNG[2]).toBe(DRILL_CAP)
  })

  it('lets a rating colour beat the result floor on a game event', () => {
    const win = [row({ event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40002 })]
    expect(eventRungInGame('Tennis', win, open, { rating: 1350, games: 12 })).toBe(9)
  })
})

describe('season points', () => {
  it('sums every event in every finished game of the year', () => {
    const rows = [
      row({ session_id: 'a' }),
      row({ session_id: 'b', session_date: '2026-06-01' }),
      row({ session_id: 'b', session_date: '2026-06-01', event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40002 }),
    ]
    expect(seasonPoints(rows, open, 2026)).toEqual({ points: 6 + 6 + DRILL_CAP, games: 2 })
  })

  it('ignores other years and games still in progress', () => {
    const rows = [
      row({ session_id: 'old', session_date: '2025-12-31' }),
      row({ session_id: 'live', closed: false }),
    ]
    expect(seasonPoints(rows, open, 2026)).toEqual({ points: 0, games: 0 })
  })

  it('counts an event once per game however many times it was scored', () => {
    const rows = [row({ raw_score: 10 }), row({}), row({ raw_score: 30 })]
    expect(seasonPoints(rows, open, 2026)).toEqual({ points: 6, games: 1 })
  })

  it('reads the rating as it stood at each game', () => {
    const rows = [
      row({ session_id: 'early', event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40002 }),
      row({ session_id: 'late', event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40002 }),
    ]
    const at = (id: string) => new Map(id === 'late' ? [['Tennis', { rating: 1250, games: 10 }]] : [])
    expect(seasonPoints(rows, open, 2026, at).points).toBe(DRILL_CAP + 8)
  })

  it('caps one game at ten events on Taniwha', () => {
    expect(MAX_GAME_POINTS).toBe(120)
  })
})

describe('ranking', () => {
  it('orders highest first and shares a rank on a full tie', () => {
    const ranked = rankBy(
      [{ name: 'B', v: 3 }, { name: 'A', v: 5 }, { name: 'C', v: 3 }, { name: 'D', v: 1 }],
      r => [r.v],
    )
    expect(ranked.map(r => [r.name, r.rank])).toEqual([['A', 1], ['B', 2], ['C', 2], ['D', 4]])
  })

  it('breaks a tie on the next key before sharing', () => {
    const ranked = rankBy([{ name: 'A', v: 3, g: 1 }, { name: 'B', v: 3, g: 4 }], r => [r.v, r.g])
    expect(ranked.map(r => [r.name, r.rank])).toEqual([['B', 1], ['A', 2]])
  })
})

describe('best and worst domain', () => {
  it('picks the highest and lowest rung by index', () => {
    expect(bestAndWorst([3, 6, 1, 4, 6, 2, 3, 3, 5, 2])).toEqual({ best: 1, worst: 2 })
  })

  it('takes the earliest domain on a tie, and one domain for both when all are equal', () => {
    expect(bestAndWorst(Array(10).fill(0))).toEqual({ best: 0, worst: 0 })
    expect(bestAndWorst([0, 0, 5, 0, 5, 0, 0, 0, 0, 0])).toEqual({ best: 2, worst: 0 })
  })
})
