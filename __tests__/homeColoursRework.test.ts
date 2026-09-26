// ── Home colours rework: the pure paths the first tests left open ────────────
// The overall colour became the AVERAGE of the ten domains (overallRung), each
// EventGrade now carries the score that earned it (`best`) and the player's
// rating, and HOME chooses what to show through lib/colourDisplay.ts. The
// screens that use these are behind a login, so this is what notices a slip.

import { describe, it, expect } from 'vitest'
import { overallRung, overallGrade, gradeInk, gradeForRung, MA, type DomainGradeResult } from '@/lib/grading'
import { eventGrade, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import { bestScoreLabel, domainExtremesByColour, bestEventByColour } from '@/lib/colourDisplay'
import { colourStanding, rankByColours } from '@/lib/colourBoard'
import { RAINBOW, RAINBOW_STOPS } from '@/lib/domainColours'
import { getEventByName } from '@/lib/eventData'

const ev = (name: string) => getEventByName(name)!
const openMan: GradePlayer = { division: "Men's", ageYears: 30, gender: 'Male' }
const row = (event_name: string, raw_score: number, extra: Partial<GradeResultRow> = {}): GradeResultRow =>
  ({ event_name, raw_score, weight_kg: null, difficulty_tier: null, ...extra })

describe('overallRung edge cases', () => {
  it('clamps a negative or over-range rung rather than letting it skew the average', () => {
    expect(overallRung([-5, 10, 10, 10, 10, 10, 10, 10, 10, 10])).toBe(9)
    expect(overallRung(Array(10).fill(99))).toBe(12)
  })
  it('lands exactly on a whole colour despite float arithmetic', () => {
    // 7 × 10 = 70 / 10 = 7, never 6.999…
    expect(overallRung(Array(10).fill(7))).toBe(7)
  })
  it('accepts any iterable, as the family chips pass Map.values()', () => {
    expect(overallRung(new Map(Array.from({ length: 10 }, (_, i) => [i, 4])).values())).toBe(4)
  })
})

describe('overallGrade weakest under the average rule', () => {
  const d = (rungs: number[]): DomainGradeResult[] =>
    rungs.map((rung, i) => ({ domainNumber: i + 1, rung, availableCount: 12, required: 6, metAtRung: 0, nextRung: rung + 1, metAtNextRung: 0 }))
  it('names Mā domains as the weakest, since they now drag the average', () => {
    const r = overallGrade(d([4, 4, 0, 4, 4, 4, 4, 4, 0, 4]))
    expect(r.weakest).toEqual([3, 9])
    expect(r.ungraded).toEqual([3, 9])
  })
  it('an empty list is Mā with nothing weakest', () => {
    expect(overallGrade([])).toEqual({ rung: 0, ungraded: [], weakest: [] })
  })
})

describe('colourStanding / rankByColours with the average', () => {
  it('a player with one domain held still has Mā overall', () => {
    expect(colourStanding(new Map([[1, 9]])).overall).toBe(0)
  })
  it('ties share a rank when every key matches', () => {
    const held = new Map([[1, 3]])
    const rows = rankByColours([
      { playerId: 'a', name: 'A', held, games: 4 },
      { playerId: 'b', name: 'B', held: new Map(held), games: 4 },
    ])
    expect(rows.map(r => r.rank)).toEqual([1, 1])
  })
})

describe('gradeInk', () => {
  it('Mā is muted grey, Taniwha reads white, others their own hex', () => {
    expect(gradeInk(MA)).toBe('#777')
    expect(gradeInk(gradeForRung(12))).toBe('#ffffff')
    expect(gradeInk(gradeForRung(3))).toBe(gradeForRung(3).hex)
  })
})

describe('RAINBOW', () => {
  it('is built from RAINBOW_STOPS and unchanged from the brand string', () => {
    expect(RAINBOW).toBe('linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)')
    expect(RAINBOW_STOPS).toHaveLength(6)
  })
})

describe('eventGrade best: which score HOME shows', () => {
  it('a lift shows the row that reached the higher rung, not the heaviest', () => {
    // 100kg at 120kg bodyweight is a lower ratio than 90kg at 60kg.
    const heavy = row('Deadlift', 100, { weight_kg: 100, bodyweightKg: 120 })
    const light = row('Deadlift', 90, { weight_kg: 90, bodyweightKg: 60 })
    const g = eventGrade(ev('Deadlift'), [heavy, light], openMan)
    expect(g.rung).toBeGreaterThan(eventGrade(ev('Deadlift'), [heavy], openMan).rung)
    expect(g.best?.weight_kg).toBe(90)
  })
  it('a lift that reaches no rung shows the heaviest', () => {
    // Any real lift is at least Kiwikiwi, so no rung means the only row with a
    // bodyweight is an empty entry; the heaviest row is still what HOME shows.
    const rows = [
      row('Deadlift', 0, { weight_kg: 0, bodyweightKg: 80 }),
      row('Deadlift', 100, { weight_kg: 100 }),
    ]
    const g = eventGrade(ev('Deadlift'), rows, openMan)
    expect(g.rung).toBe(0)
    expect(g.bodyweightBlocked).toBeUndefined()
    expect(g.best?.weight_kg).toBe(100)
  })
  it('a lift blocked by a missing bodyweight still shows its best score', () => {
    const g = eventGrade(ev('Deadlift'), [row('Deadlift', 80, { weight_kg: 80 }), row('Deadlift', 120, { weight_kg: 120 })], openMan)
    expect(g.bodyweightBlocked).toBe(true)
    expect(g.best?.weight_kg).toBe(120)
  })
  it('an unplayed event carries no best', () => {
    expect(eventGrade(ev('Deadlift'), [], openMan).best).toBeUndefined()
  })
  it('Wrestling carries its rating and no best', () => {
    const g = eventGrade(ev('Wrestling'), [], openMan, { rating: 1310, games: 10 })
    expect(g.rating).toEqual({ rating: 1310, games: 10 })
    expect(g.best).toBeUndefined()
  })
})

describe('bestScoreLabel edge cases', () => {
  it('an unknown slug shows nothing', () => {
    expect(bestScoreLabel({ slug: 'not-an-event', best: { raw_score: 1, weight_kg: null, difficulty_tier: null } })).toBeNull()
  })
  it('one game reads singular', () => {
    expect(bestScoreLabel({ slug: ev('Wrestling').slug, rating: { rating: 1000, games: 1 } })).toBe('Rating 1000 · 1 game')
  })
  it('keeps formatPR\'s D-number when the row carries no tier name', () => {
    const label = bestScoreLabel({ slug: ev('Pushup Contest').slug, best: { raw_score: 30001, weight_kg: null, difficulty_tier: null } })
    expect(label).toMatch(/^D\d+ · /)
  })
})

describe('domainExtremesByColour edge cases', () => {
  it('an unrated domain loses a colour tie to a rated one', () => {
    const r = domainExtremesByColour(new Map([[4, 2], [5, 2]]), new Map([[5, 50]]))!
    expect(r.best.domainNumber).toBe(5)
  })
  it('the lowest domain number wins a full tie', () => {
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, 3]))
    const r = domainExtremesByColour(held, new Map())!
    expect(r.best.domainNumber).toBe(1)
    expect(r.weakest.domainNumber).toBe(10)
  })
})

describe('bestEventByColour edge cases', () => {
  it('a higher colour wins whatever its Top %', () => {
    const events = new Map([
      ['a', { slug: ev('Deadlift').slug, rung: 2 }],
      ['b', { slug: ev('Javelin').slug, rung: 5 }],
    ])
    expect(bestEventByColour(events, new Map([['Deadlift', 1], ['Javelin', 99]]))?.slug).toBe(ev('Javelin').slug)
  })
  it('the first seen wins when colour and Top % both tie', () => {
    const events = new Map([
      ['a', { slug: ev('Deadlift').slug, rung: 3 }],
      ['b', { slug: ev('Javelin').slug, rung: 3 }],
    ])
    expect(bestEventByColour(events)?.slug).toBe(ev('Deadlift').slug)
  })
})
