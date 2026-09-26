import { describe, it, expect } from 'vitest'
import { GAMES_REQUIRED, TOP_RUNG } from '@/lib/grading'
import { colourGates, releasable, eventGrade, gameEvidence, type GradePlayer } from '@/lib/playerGrades'
import { normaliseActivity } from '@/lib/workouts'
import { workoutEvidence, fitActivity, suggestEvents, allowedDays, addDays, type WorkoutEntryRow } from '@/lib/workouts'
import { getEventByName } from '@/lib/eventData'

describe('the games ladder', () => {
  it('holds the games quota Tāne set, one per colour', () => {
    expect(GAMES_REQUIRED).toEqual([0, 1, 3, 5, 8, 12, 16, 20, 30, 40, 55, 75, 100])
    expect(GAMES_REQUIRED).toHaveLength(TOP_RUNG + 1)
  })
})

describe('what a domain has waiting', () => {
  it('releasable lists only the domains whose standards are above the colour held', () => {
    const domains = [1, 2, 3].map(n => ({ domainNumber: n, rung: 3, availableCount: 12, slots: 6, counted: [], average: 3, nextRung: 4, toNext: 6 }))
    const gates = colourGates(domains, new Map([[1, 0], [2, 3], [3, 1]]))
    expect(releasable(gates).map(g => [g.domainNumber, g.releasable])).toEqual([[1, 3], [3, 3]])
  })
})

describe('logged workouts as evidence', () => {
  const w = (witnessed: boolean) => ({ player_id: 'p', performed_on: '2026-09-16', witnessed, created_at: '2026-09-16T01:00:00Z' })
  const entry = (e: Partial<WorkoutEntryRow>): WorkoutEntryRow => ({
    event_slug: 'cycling', raw_score: null, weight_kg: null, difficulty_tier: null, workouts: w(false), ...e,
  })

  it('turns a best split into a grading row', () => {
    const { rows } = workoutEvidence([entry({ raw_score: 29900, difficulty_tier: '1000m' })])
    expect(rows).toEqual([{ event_name: 'Cycling', raw_score: 29900, weight_kg: null, difficulty_tier: '1000m', source: 'solo' }])
  })

  it('marks a kaiwhakawā-logged entry as witnessed', () => {
    expect(workoutEvidence([entry({ raw_score: 29900, workouts: w(true) })]).rows[0].source).toBe('witnessed')
  })

  it('gives an entry without a score no grading row, and an unfitted entry nothing', () => {
    expect(workoutEvidence([entry({})]).rows).toEqual([])
    expect(workoutEvidence([entry({ event_slug: null })])).toEqual({ rows: [] })
  })

  it('carries the source through to the event colour', () => {
    const player: GradePlayer = { division: "Men's", ageYears: 30, gender: 'Male' }
    const cycling = getEventByName('Cycling')!
    const g = eventGrade(cycling, [
      { event_name: 'Cycling', raw_score: 19935, weight_kg: null, difficulty_tier: '500m', source: 'game' },
      { event_name: 'Cycling', raw_score: 29905, weight_kg: null, difficulty_tier: '1000m', source: 'solo' },
    ], player)
    expect(g.rung).toBeGreaterThan(0)
    expect(g.source).toBe('solo')
  })
})

describe('fitting what someone typed', () => {
  const aliases = new Map([['road ride', 'cycling']])

  it('fits by alias or by the event name, exactly', () => {
    expect(fitActivity('  Road   Ride ', aliases)?.slug).toBe('cycling')
    expect(fitActivity('deadlift', aliases)?.slug).toBe('deadlift')
    expect(fitActivity('yoga', aliases)).toBeNull()
  })

  it('suggests events while typing, best match first', () => {
    expect(suggestEvents('cyc', aliases)[0].slug).toBe('cycling')
    expect(suggestEvents('r', aliases)).toEqual([])
  })
})

describe('the days a workout may carry', () => {
  it('is today and the seven before it, in NZ time', () => {
    const d = allowedDays(new Date('2026-09-15T20:00:00Z')) // 8am 16 September NZ
    expect(d[0]).toBe('2026-09-16')
    expect(d).toHaveLength(8)
    expect(d[7]).toBe('2026-09-09')
  })

  it('does calendar arithmetic across a month end', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })
})

describe('game results as evidence', () => {
  const row = (session_id: string, closed: boolean, event_name = 'Cycling', difficulty_tier: string | null = '1000m') =>
    ({ session_id, event_name, raw_score: 29900, weight_kg: null, difficulty_tier, closed })

  it('counts games only from sessions that have finished', () => {
    const g = gameEvidence([row('a', true), row('a', true), row('b', true), row('live', false)])
    expect(g.games).toBe(2)
    expect(g.rows).toHaveLength(4)
  })

  it('still grades the standards from a game in progress', () => {
    const g = gameEvidence([row('live', false)])
    expect(g.rows).toHaveLength(1)
    expect(g.rows[0].source).toBe('game')
    expect(g.games).toBe(0)
  })
})

describe('matching activities', () => {
  it('collapses runs of whitespace, as the database does', () => {
    expect(normaliseActivity('  Road \t  Ride ')).toBe('road ride')
  })
})

describe('a colour earned only by rating', () => {
  it('names the game as its source', () => {
    const player: GradePlayer = { division: "Men's", ageYears: 30, gender: 'Male' }
    const w = getEventByName('Wrestling')!
    expect(eventGrade(w, [], player, { rating: 1310, games: 10 }).source).toBe('game')
    expect(eventGrade(w, [], player).source).toBeUndefined()
  })
})
