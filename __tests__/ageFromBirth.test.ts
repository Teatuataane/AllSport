import { describe, it, expect, vi, afterEach } from 'vitest'
import { ageBand } from '@/lib/grading'
import { ageInYear } from '@/lib/seasonYear'
import { eventGrade, playerInYear, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import { gameColourTotals, type SeasonRow } from '@/lib/leaderboardScores'
import { ageAllowanceNote } from '@/lib/standardsLadder'
import { getEventByName } from '@/lib/eventData'

// The age allowance comes from the age a player turns in the year being graded
// (Tāne, 20 Oct 2026), not from their division. A division only changes by
// hand, so a player who turned 40 kept the Open ladder until a kaiwhakawā
// moved them, and one Women's player was in exactly that state on 20 Oct 2026.

afterEach(() => { vi.useRealTimers() })

const wallSit = getEventByName('Wall Sit')!
const hold = (secs: number): GradeResultRow => ({ event_name: 'Wall Sit', raw_score: secs, weight_kg: null, difficulty_tier: null })

describe('ageBand reads the age, not the division', () => {
  it('bands every age the old divisions covered', () => {
    expect(ageBand("Men's", 11)).toBe('U12')
    expect(ageBand("Men's", 13)).toBe('U14')
    expect(ageBand("Women's", 16)).toBe('U16')
    expect(ageBand('Juniors', 17)).toBe('Open')
    expect(ageBand("Women's", 39)).toBe('Open')
    expect(ageBand("Women's", 40)).toBe('Over40')
    expect(ageBand("Men's", 59)).toBe('Over40')
    expect(ageBand("Men's", 60)).toBe('Over60')
  })

  it('with no age, takes a junior as U14 and anyone else as Open', () => {
    expect(ageBand('Juniors', null)).toBe('U14')
    expect(ageBand("Women's", null)).toBe('Open')
    expect(ageBand("Men's", null)).toBe('Open')
  })

  it('gives the allowance by age to a player still filed under an adult division', () => {
    // Wall Sit is Stamina, a number: 72s is the eighth colour on the list, and
    // Stamina's 10% at 55 makes the ninth colour's 80s a 72s hold.
    const open: GradePlayer = { division: "Women's", ageYears: 39, gender: 'Female' }
    const older: GradePlayer = { division: "Women's", ageYears: 55, gender: 'Female' }
    expect(eventGrade(wallSit, [hold(72)], open).rung).toBe(8)
    expect(eventGrade(wallSit, [hold(72)], older).rung).toBe(9)
  })
})

describe('one age for the whole colour year', () => {
  it('is the year minus the birth year, birthday or not', () => {
    expect(ageInYear({ birthYear: 1986, ageYears: 39 }, 2026)).toBe(40)
    expect(ageInYear({ birthYear: 1986, ageYears: 39 }, 2025)).toBe(39)
  })

  it('moves the age today by the years between when the view has no birth year', () => {
    vi.useFakeTimers({ now: new Date('2026-10-13T00:00:00.000Z'), toFake: ['Date'] })
    expect(ageInYear({ ageYears: 39 }, 2026)).toBe(39)
    expect(ageInYear({ ageYears: 39 }, 2025)).toBe(38)
    expect(ageInYear({ ageYears: null }, 2026)).toBeNull()
  })

  it('ages a player for the year asked', () => {
    const p: GradePlayer = { division: "Men's", ageYears: 39, birthYear: 1986, gender: 'Male' }
    expect(playerInYear(p, 2026).ageYears).toBe(40)
    expect(playerInYear(p, 2027).ageYears).toBe(41)
  })
})

describe('a game is priced on the age turned in its own year', () => {
  it('never re-prices last year\'s game when a band is crossed on 1 January', () => {
    // Born 1971: 54 through 2025 (Stamina 5%), 55 through 2026 (Stamina 10%).
    const p: GradePlayer = { division: "Men's", ageYears: 55, birthYear: 1971, gender: 'Male' }
    const row = (session_id: string, session_date: string): SeasonRow =>
      ({ ...hold(72), session_id, session_date, closed: true })
    const totals = gameColourTotals([row('g25', '2025-12-02'), row('g26', '2026-02-03')], p)
    const by = new Map(totals.map(t => [t.session_id, t.total]))
    expect(by.get('g25')).toBeLessThan(9)
    expect(by.get('g26')).toBe(9)
  })
})

describe('the ladder says when it is shifted for age', () => {
  it('names the domain allowance and the age it is for', () => {
    expect(ageAllowanceNote(wallSit, { division: "Men's", ageYears: 57, gender: null }))
      .toBe('Includes your scaling: 90% of the listed standard at 57 this year.')
    expect(ageAllowanceNote(wallSit, { division: "Women's", ageYears: 71, gender: null }))
      .toBe('Includes your scaling: 80% of the listed standard at 71 this year.')
    expect(ageAllowanceNote(wallSit, { division: "Men's", ageYears: 30, gender: null })).toBeNull()
  })

  it('says where a half goes, on an event with levels', () => {
    const backExt = getEventByName('Back Extension')!
    expect(ageAllowanceNote(backExt, { division: "Men's", ageYears: 45, gender: null }))
      .toBe('Your Stamina allowance is +½ colour at 45 this year. These are the listed standards; the half counts in your exact score.')
    expect(ageAllowanceNote(backExt, { division: "Men's", ageYears: 66, gender: null }))
      .toBe('Your Stamina allowance is +1½ colours at 66 this year. These are the +1 standards; the extra half counts in your exact score.')
  })

  it('says nothing on a rating-only event, whose colours are never shifted', () => {
    const wrestling = getEventByName('Wrestling')!
    expect(ageAllowanceNote(wrestling, { division: "Men's", ageYears: 65, gender: null })).toBeNull()
  })
})
