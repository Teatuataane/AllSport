import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getEventBySlug } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'
import { halfStepCredit, rungForCompound, gradeForRung, domainGrade } from '@/lib/grading'
import { eventGrade, eventCredit, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import { eventRungInGame } from '@/lib/leaderboardScores'
import { eventFlags, type GameScore } from '@/lib/gameReport'

// Tāne, 10 Oct 2026: lifting a higher colour's LOAD, short of its time, reps
// or distance (but at least half of it), is worth half a colour below that
// colour (lib/grading.ts, Half steps).

const toe = getEventBySlug('toe-lift')!
const tib = getEventBySlug('tibialis-curl')!
const glute = getEventBySlug('glute-thrust')!
const ladder = (slug: string) => STANDARDS[slug].all!
const adult: GradePlayer = { division: "Men's", ageYears: 30, gender: 'male' }
/** A load-and-hold or load-and-reps score: round(kg × 100) × 10000 + seconds or reps. */
const packed = (kg: number, n: number) => Math.round(kg * 100) * 10000 + n
const row = (name: string, raw: number): GradeResultRow => ({ event_name: name, raw_score: raw, weight_kg: null, difficulty_tier: null })
const credit = (slug: string, mode: string, raw: number) => {
  const rung = rungForCompound(mode, raw, ladder(slug), 'Open')!
  return { rung, credit: halfStepCredit(mode, raw, ladder(slug), 'Open', rung) }
}

describe('halfStepCredit', () => {
  it('Glute Thrust 180kg for 25s: Taniwha\'s load, short of 30s, is Uenuku and a half', () => {
    const c = credit('glute-thrust', 'weight+time', packed(180, 25))
    expect(gradeForRung(c.rung).name).toBe('Kiwikiwi')
    expect(c.credit).toBe(11.5)
    expect(gradeForRung(c.credit).name).toBe('Uenuku')
  })

  it('needs at least half the time: 180kg for 10s earns no half', () => {
    expect(credit('glute-thrust', 'weight+time', packed(180, 10)).credit).toBe(0)
    expect(credit('glute-thrust', 'weight+time', packed(180, 15)).credit).toBe(11.5)
  })

  it('Toe Lift 5kg for 45s: Poroporo, and Parahi\'s 5kg short of 60s makes it Poroporo and a half', () => {
    const c = credit('toe-lift', 'weight+time', packed(5, 45))
    expect(gradeForRung(c.rung).name).toBe('Poroporo')
    expect(c.credit).toBe(7.5)
  })

  it('Tibialis Curl 10kg for 30 reps: the next colour\'s load, short of 35 reps', () => {
    expect(credit('tibialis-curl', 'weight+reps', packed(10, 30))).toEqual({ rung: 7, credit: 7.5 })
  })

  it('earns nothing short of every higher load: 5kg for 65s is Parahi, and Hiriwa asks for 7.5kg', () => {
    expect(credit('toe-lift', 'weight+time', packed(5, 65))).toEqual({ rung: 8, credit: 8 })
  })

  it('skips a bodyweight colour, which has no load to reach', () => {
    // Kiwikiwi by the 15s bodyweight hold; Hiriwa's 7.5kg reached for 20 of 30s.
    expect(credit('toe-lift', 'weight+time', packed(7.5, 20))).toEqual({ rung: 1, credit: 8.5 })
  })

  it('earns nothing at the top, or on a mode that is not compound', () => {
    expect(credit('toe-lift', 'weight+time', packed(15, 30))).toEqual({ rung: 12, credit: 12 })
    expect(halfStepCredit('reps', 50, [10, 20, 30], 'Open', 1)).toBe(1)
  })
})

describe('a half is credit, never a colour', () => {
  it('reads as the colour below it', () => {
    expect(gradeForRung(7.5).name).toBe('Poroporo')
    expect(gradeForRung(0.5).name).toBe('Mā')
  })

  it('eventGrade keeps the whole colour and carries the credit', () => {
    const g = eventGrade(glute, [row(glute.name, packed(180, 25))], adult)
    expect(g.rung).toBe(1)
    expect(g.credit).toBe(11.5)
    expect(eventCredit(g)).toBe(11.5)
  })

  it('takes the colour and the credit from whichever efforts earn them', () => {
    const g = eventGrade(tib, [row(tib.name, packed(7.5, 30)), row(tib.name, packed(10, 30))], adult)
    expect(g.rung).toBe(7)
    expect(g.credit).toBe(7.5)
    expect(g.best?.raw_score).toBe(packed(10, 30))
  })

  it('no credit field when it adds nothing', () => {
    expect(eventGrade(toe, [row(toe.name, packed(5, 65))], adult).credit).toBeUndefined()
  })

  it('counts in a game colour total', () => {
    expect(eventRungInGame(toe.name, [row(toe.name, packed(5, 45))], adult)).toBe(7.5)
    expect(eventRungInGame(glute.name, [row(glute.name, packed(180, 25))], adult)).toBe(11.5)
  })

  it('counts in the domain average, and can tip it', () => {
    const slugs = ['a', 'b', 'c', 'd', 'e', 'f']
    const at = (rungs: number[]) => domainGrade({ domainNumber: 1, eventSlugs: slugs, rungByEvent: new Map(slugs.map((s, i) => [s, rungs[i]])) }).rung
    expect(at([6, 6, 6, 6, 6, 5])).toBe(5)
    expect(at([6, 6, 6, 6, 6.5, 5.5])).toBe(6)
  })

  it('a new half step in a game is not a colour up', () => {
    const game = (id: string, closedAt: string, rung: number): GameScore =>
      ({ sessionId: id, date: closedAt.slice(0, 10), closedAt, closed: true, points: rung, rungs: new Map([[toe.name, rung]]) })
    const scores = new Map([
      ['g1', game('g1', '2026-10-01T05:00:00Z', 7)],
      ['g2', game('g2', '2026-10-03T05:00:00Z', 7.5)],
      ['g3', game('g3', '2026-10-05T05:00:00Z', 8)],
    ])
    expect(eventFlags(scores, 'g2').get(toe.name)?.colourUp).toBe(false)
    expect(eventFlags(scores, 'g3').get(toe.name)?.colourUp).toBe(true)
  })
})

describe('the database holds a half', () => {
  it('stores colour_total as numeric and keeps the season view', () => {
    const sql = readFileSync('supabase/migrations/20261010021800_half_step_colour_totals.sql', 'utf8')
    expect(sql).toMatch(/ALTER COLUMN colour_total TYPE numeric\(4,1\)/)
    expect(sql).toMatch(/RANK\(\) OVER \(PARTITION BY g\.session_id ORDER BY g\.colour_total DESC\)/)
    expect(sql).toMatch(/GRANT SELECT ON public\.season_points TO anon, authenticated/)
  })
})
