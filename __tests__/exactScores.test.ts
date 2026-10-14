import { describe, it, expect } from 'vitest'
import {
  exactFrom, exactForScore, exactForCompound, ratingExact, formatExact, domainGrade, rungForCompound,
  compoundLadderAt, gradeForRung,
} from '@/lib/grading'
import { gameTotalOf } from '@/lib/leaderboardScores'
import { getEventBySlug } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'

// Scoring v2 (Tāne, 15 Oct 2026, SCORING_V2_PLAN.md): an exact score is the
// colour plus how far toward the next line, on the same 0–12 scale.

describe('exact score of a one-number score', () => {
  const ladder = [10, 20, 30, 40]
  it('sits between two lines: 35 between 30 and 40 is 3.5', () => {
    expect(exactForScore(35, ladder, 'Open')).toBe(3.5)
  })
  it('its whole part is always the colour', () => {
    for (let s = 0; s <= 45; s += 0.7) expect(Math.floor(exactForScore(s, ladder, 'Open'))).toBe(
      s >= 40 ? 4 : s >= 30 ? 3 : s >= 20 ? 2 : s >= 10 ? 1 : 0)
  })
  it('never reads as the next colour, and stops at the top line', () => {
    expect(exactForScore(39.999, ladder, 'Open')).toBe(3.99)
    expect(exactForScore(99, ladder, 'Open')).toBe(4)
  })
  it('stops a capped drill at the cap', () => {
    expect(exactForScore(35, ladder, 'Open', { cap: 3 })).toBe(3)
  })
  it('follows the age shift: a Master earns one colour higher on the same score', () => {
    expect(exactForScore(35, [10, 20, 30, 40, 50], 'Masters')).toBe(4.5)
  })
  it('across levels: one rep on the next colour\'s level counts its share of that colour\'s reps', () => {
    // Kōura D3·40, Uenuku D4·20: one D4 rep is 1/20 of the way.
    expect(exactForScore(40001, [30040, 40020], 'Open', { tiered: true })).toBe(1.05)
    // Still on D3: twice Kōura's 40 reps would reach the next.
    expect(exactForScore(30060, [30040, 40020], 'Open', { tiered: true })).toBe(1.5)
    // A timed effort across levels counts none.
    expect(exactForScore(40001, [30040, 40020], 'Open', { tiered: true, timed: true })).toBe(1)
  })
})

describe('exact score of a two-part score', () => {
  const packed = (kg: number, n: number) => Math.round(kg * 100) * 10000 + n
  // 10kg·20s, 20kg·30s, 30kg·40s
  const ladder = [packed(10, 20), packed(20, 30), packed(30, 40)]
  it('takes the weaker part\'s progress toward the next colour', () => {
    // Colour 1; toward 20kg·30s the load is 80% there (18kg), the time 50% (25s).
    expect(exactForCompound('weight+time', packed(18, 25), ladder, 'Open')).toBe(1.5)
    expect(exactForCompound('weight+time', packed(12, 30), ladder, 'Open')).toBe(1.2)
  })
  it('keeps the half step as a floor where the time is the cliff', () => {
    const glute = getEventBySlug('glute-thrust')!
    const at80 = compoundLadderAt(glute.inputMode, STANDARDS['glute-thrust'].all!, STANDARDS['glute-thrust'].bwLoad, 80)!
    // Taniwha's 160kg for 25s of 30: no colour by both keys, Uenuku and a half by the half step.
    expect(rungForCompound('weight+time', packed(160, 25), at80, 'Open')).toBe(0)
    expect(exactForCompound('weight+time', packed(160, 25), at80, 'Open')).toBe(11.5)
  })
})

describe('exact rating colour', () => {
  it('is 100 points a colour from Poroporo at 1,100', () => {
    expect(ratingExact(1150, 10)).toBe(7.5)
    expect(ratingExact(1399, 10)).toBe(9.99)
    expect(ratingExact(1700, 10)).toBe(12)
  })
  it('is nothing before ten games or under Poroporo', () => {
    expect(ratingExact(1500, 9)).toBe(0)
    expect(ratingExact(1050, 20)).toBe(0)
  })
})

describe('averages and totals', () => {
  it('a domain\'s colour is its exact average rounded down, with no float drift', () => {
    const slugs = ['a', 'b', 'c', 'd', 'e', 'f']
    const d = domainGrade({ domainNumber: 1, eventSlugs: slugs, rungByEvent: new Map(slugs.map((s, i) => [s, [5.1, 4.9, 5.3, 4.7, 5.05, 4.95][i]])) })
    expect(d.rung).toBe(5)
    expect(d.average).toBeCloseTo(5)
  })
  it('a game total is floored to the tenths the database holds, and capped at 120', () => {
    expect(gameTotalOf(51.29)).toBe(51.2)
    expect(gameTotalOf(0.1 + 0.2)).toBe(0.3)
    expect(gameTotalOf(130)).toBe(120)
  })
  it('reads as one decimal, rounded down, so it never shows the next colour', () => {
    expect(formatExact(4.99)).toBe('4.9')
    expect(formatExact(5)).toBe('5.0')
    expect(gradeForRung(4.99).name).toBe(gradeForRung(4).name)
  })
  it('exactFrom never reaches the next whole number', () => {
    expect(exactFrom(3, 1)).toBe(3.99)
    expect(exactFrom(3, -1)).toBe(3)
    expect(exactFrom(3, NaN)).toBe(3)
  })
})
