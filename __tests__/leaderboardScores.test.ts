import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  domainRungsOf, gameColourTotals, seasonPointsFromGames, placePoints, WINNER_POINTS, bestAndWorst, eventRungInGame, rankBy,
  GAME_RESULT_RUNG, MAX_GAME_COLOUR_TOTAL, type SeasonRow, type GameTotalRow,
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

describe('colour total in a game', () => {
  it('sums every event in each finished game', () => {
    const rows = [
      row({ session_id: 'a' }),
      row({ session_id: 'b', session_date: '2026-06-01' }),
      row({ session_id: 'b', session_date: '2026-06-01', event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40002 }),
    ]
    expect(gameColourTotals(rows, open)).toEqual([
      { session_id: 'a', session_date: '2026-05-02', total: 6 },
      { session_id: 'b', session_date: '2026-06-01', total: 6 + DRILL_CAP },
    ])
  })

  it('skips a game still in progress', () => {
    expect(gameColourTotals([row({ session_id: 'live', closed: false })], open)).toEqual([])
  })

  it('counts an event once per game however many times it was scored', () => {
    const rows = [row({ raw_score: 10 }), row({}), row({ raw_score: 30 })]
    expect(gameColourTotals(rows, open).map(g => g.total)).toEqual([6])
  })

  it('reads the rating as it stood at each game', () => {
    const rows = [
      row({ session_id: 'early', event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40002 }),
      row({ session_id: 'late', event_name: 'Tennis', difficulty_tier: 'Game', raw_score: 40002 }),
    ]
    const at = (id: string) => new Map(id === 'late' ? [['Tennis', { rating: 1250, games: 10 }]] : [])
    expect(gameColourTotals(rows, open, at).map(g => g.total)).toEqual([DRILL_CAP, 8])
  })

  it('caps one game at ten events on Taniwha', () => {
    expect(MAX_GAME_COLOUR_TOTAL).toBe(120)
  })
})

describe('season points: by place in the game', () => {
  const g = (player_id: string, session_id: string, total: number): GameTotalRow => ({ player_id, session_id, total })

  it('pays 100 for 1st, 99 for 2nd, 98 for 3rd', () => {
    const s = seasonPointsFromGames([g('a', 'x', 50), g('b', 'x', 40), g('c', 'x', 30)])
    expect([s.get('a'), s.get('b'), s.get('c')].map(v => v!.points)).toEqual([100, 99, 98])
  })

  it('shares the higher place on a tie, then skips', () => {
    const s = seasonPointsFromGames([g('a', 'x', 50), g('b', 'x', 50), g('c', 'x', 30)])
    expect([s.get('a'), s.get('b'), s.get('c')].map(v => v!.points)).toEqual([100, 100, 98])
  })

  it('ranks each game on its own and sums the season', () => {
    const s = seasonPointsFromGames([g('a', 'x', 50), g('b', 'x', 40), g('a', 'y', 10), g('b', 'y', 20)])
    expect(s.get('a')).toEqual({ points: 199, games: 2 })
    expect(s.get('b')).toEqual({ points: 199, games: 2 })
  })

  it('makes one more game worth more than any finish, at club size', () => {
    // In a game of 50, 1st and last are 49 apart and last still pays 51.
    expect(placePoints(50)).toBeGreaterThan(placePoints(1) - placePoints(50))
    expect(placePoints(1)).toBe(WINNER_POINTS)
    expect([placePoints(99), placePoints(100), placePoints(101), placePoints(150)]).toEqual([2, 1, 1, 1])
  })

  it('counts a player once per game, as the primary key does', () => {
    const s = seasonPointsFromGames([g('a', 'x', 50), g('a', 'x', 50), g('b', 'x', 40)])
    expect(s.get('a')).toEqual({ points: 100, games: 1 })
    expect(s.get('b')).toEqual({ points: 99, games: 1 })
  })

  it('a player alone in a game still wins it', () => {
    expect(seasonPointsFromGames([g('a', 'x', 0)]).get('a')).toEqual({ points: 100, games: 1 })
  })

  it('matches the rule the database runs', () => {
    const sql = readFileSync('supabase/migrations/20260928011813_season_points_by_place.sql', 'utf8')
    // RANK() shares the higher place and skips, as seasonPointsFromGames does.
    expect(sql).toMatch(/RANK\(\) OVER \(PARTITION BY g\.session_id ORDER BY g\.colour_total DESC\)/)
    expect(sql).toContain(`GREATEST(${WINNER_POINTS + 1} - place, 1)`)
    expect(sql).toMatch(/s\.is_active = false AND s\.voided_at IS NULL/)
    // The season is the NZ day of the game (session_date is trigger-derived at Pacific/Auckland).
    expect(sql).toMatch(/EXTRACT\(YEAR FROM s\.session_date\)::int AS season_year/)
    expect(sql).toMatch(/GROUP BY player_id, season_year/)
    // A total is bounded by the most one game can hold.
    expect(sql).toContain(`colour_total BETWEEN 0 AND ${MAX_GAME_COLOUR_TOTAL}`)
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
