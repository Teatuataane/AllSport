import { describe, it, expect } from 'vitest'
import { GAMES_REQUIRED, UNITS_REQUIRED, UNIT_MULTIPLIER, TOP_RUNG, colourGate } from '@/lib/grading'
import { unitsSinceConferral, colourGates, releasable, gateBlocker, eventGrade, gameEvidence, type GradePlayer } from '@/lib/playerGrades'
import { fmtUnits, fmtUnitsLabel } from '@/lib/units'
import { normaliseActivity } from '@/lib/workouts'
import { workoutEvidence, fitActivity, suggestEvents, allowedDays, addDays, recentUnitsByDomain, type WorkoutEntryRow } from '@/lib/workouts'
import { getEventByName } from '@/lib/eventData'

describe('the games and training ladders', () => {
  it('holds the games quota Tāne set, one per colour', () => {
    expect(GAMES_REQUIRED).toEqual([0, 1, 3, 5, 8, 12, 16, 20, 30, 40, 55, 75, 100])
    expect(GAMES_REQUIRED).toHaveLength(TOP_RUNG + 1)
  })

  it('derives the training ladder from the games steps, calibrated at 1.5', () => {
    expect(UNIT_MULTIPLIER).toBe(1.5)
    expect(UNITS_REQUIRED).toEqual([0, 0, 3, 3, 5, 6, 6, 6, 15, 15, 23, 30, 38])
  })

  it('asks no training for Kiwikiwi, which anyone can reach', () => {
    expect(UNITS_REQUIRED[1]).toBe(0)
  })
})

describe('a colour needs all three gates', () => {
  const base = { domainNumber: 3, standardsRung: 5, held: 2, games: 10, unitsSinceHeld: 10 }

  it('releases the next colour, one at a time, when all three pass', () => {
    const g = colourGate(base)
    expect(g).toMatchObject({ next: 3, standardsMet: true, gamesMet: true, trainingMet: true, releasable: 3 })
  })

  it('holds it back on each gate alone', () => {
    expect(colourGate({ ...base, standardsRung: 2 }).releasable).toBe(0)
    expect(colourGate({ ...base, games: 4 }).releasable).toBe(0)
    expect(colourGate({ ...base, unitsSinceHeld: 2 }).releasable).toBe(0)
  })

  it('does not let floating-point quarters fall short of a whole number', () => {
    expect(colourGate({ ...base, unitsSinceHeld: 0.1 + 0.2 + 2.7 }).trainingMet).toBe(true)
  })

  it('offers nothing above Taniwha', () => {
    expect(colourGate({ ...base, held: TOP_RUNG, standardsRung: TOP_RUNG }).next).toBeNull()
  })

  it('says what is missing, in words', () => {
    expect(gateBlocker(colourGate({ ...base, games: 4, unitsSinceHeld: 1 }))).toBe('1 more game · 2 more units')
    expect(gateBlocker(colourGate(base))).toBeNull()
  })

  it('releasable lists only the domains ready now', () => {
    const domains = [1, 2].map(n => ({ domainNumber: n, rung: 3, availableCount: 12, required: 6, metAtRung: 6, nextRung: 4, metAtNextRung: 0 }))
    const gates = colourGates(domains, new Map([[1, 0], [2, 0]]), 10, new Map([[1, 0], [2, 0]]))
    expect(releasable(gates).map(g => [g.domainNumber, g.releasable])).toEqual([[1, 1], [2, 1]])
  })
})

describe('units since the last colour', () => {
  const conferred = '2026-09-20T05:00:00Z' // 5pm NZ, 20 September

  it('counts everything before the first colour', () => {
    const u = unitsSinceConferral([{ domain: 6, units: 25, at: '2026-01-01T00:00:00Z' }], [])
    expect(u.get(6)).toBe(25)
  })

  it('starts again at each conferral, per domain', () => {
    const u = unitsSinceConferral([
      { domain: 6, units: 5, at: '2026-09-19T00:00:00Z' },
      { domain: 6, units: 2, at: '2026-09-21T00:00:00Z' },
      { domain: 2, units: 4, at: '2026-09-19T00:00:00Z' },
    ], [{ domain_number: 6, conferred_at: conferred }])
    expect(u.get(6)).toBe(2)
    expect(u.get(2)).toBe(4)
  })

  it('refuses a workout trained before the conferral day, even when logged after it', () => {
    const u = unitsSinceConferral([
      { domain: 6, units: 10, at: '2026-09-21T00:00:00Z', day: '2026-09-15' },
      { domain: 6, units: 3, at: '2026-09-21T00:00:00Z', day: '2026-09-20' },
    ], [{ domain_number: 6, conferred_at: conferred }])
    expect(u.get(6)).toBe(3)
  })
})

describe('logged workouts as evidence', () => {
  const w = (witnessed: boolean) => ({ player_id: 'p', performed_on: '2026-09-16', witnessed, created_at: '2026-09-16T01:00:00Z' })
  const entry = (e: Partial<WorkoutEntryRow>): WorkoutEntryRow => ({
    event_slug: 'cycling', count: null, volume_distance_m: null, raw_score: null, weight_kg: null, difficulty_tier: null, workouts: w(false), ...e,
  })

  it('turns a best split into a grading row, and the whole ride into units', () => {
    const { rows, units } = workoutEvidence([entry({ raw_score: 29900, difficulty_tier: '1000m', volume_distance_m: 25000 })])
    expect(rows).toEqual([{ event_name: 'Cycling', raw_score: 29900, weight_kg: null, difficulty_tier: '1000m', source: 'solo' }])
    expect(units).toEqual([{ domain: 6, units: 25, at: '2026-09-16T01:00:00Z', day: '2026-09-16' }])
  })

  it('marks a kaiwhakawā-logged entry as witnessed', () => {
    expect(workoutEvidence([entry({ raw_score: 29900, workouts: w(true) })]).rows[0].source).toBe('witnessed')
  })

  it('gives volume without a score no grading row, and an unfitted entry nothing', () => {
    expect(workoutEvidence([entry({ volume_distance_m: 5000 })]).rows).toEqual([])
    expect(workoutEvidence([entry({ event_slug: null, count: 4 })])).toEqual({ rows: [], units: [] })
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

  it('counts this week by the day trained', () => {
    const now = new Date('2026-09-16T01:00:00Z')
    const m = recentUnitsByDomain([
      { domain: 6, units: 5, at: '2026-09-16T00:00:00Z', day: '2026-09-16' },
      { domain: 6, units: 9, at: '2026-09-16T00:00:00Z', day: '2026-09-01' },
    ], 7, now)
    expect(m.get(6)).toBe(5)
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
    ({ session_id, event_name, raw_score: 29900, weight_kg: null, difficulty_tier, at: '2026-09-10T04:30:00Z', closed })

  it('counts games and units only from sessions that have finished', () => {
    const g = gameEvidence([row('a', true), row('a', true), row('b', true), row('live', false)])
    expect(g.games).toBe(2)
    expect(g.units.map(u => u.units)).toEqual([1, 1, 1])
  })

  it('still grades the standards from a game in progress', () => {
    const g = gameEvidence([row('live', false)])
    expect(g.rows).toHaveLength(1)
    expect(g.rows[0].source).toBe('game')
    expect(g.games).toBe(0)
  })

  it('earns nothing for a retired event', () => {
    expect(gameEvidence([row('a', true, 'Walking', null)]).units).toEqual([])
  })
})

describe('showing units', () => {
  it('rounds down, so a player is never shown a unit they have not finished', () => {
    expect(fmtUnits(2.95)).toBe('2.9')
    expect(fmtUnits(3 - 1e-12)).toBe('3')
    expect(fmtUnits(0.1 + 0.2 + 2.7)).toBe('3')
  })

  it('pluralises from the number shown, not the raw sum', () => {
    expect(fmtUnitsLabel(1)).toBe('1 unit')
    expect(fmtUnitsLabel(1.05)).toBe('1 unit')
    expect(fmtUnitsLabel(2.5)).toBe('2.5 units')
    expect(fmtUnitsLabel(0)).toBe('0 units')
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
