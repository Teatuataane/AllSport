import { describe, it, expect } from 'vitest'
import {
  GRADES, MA, TOP_RUNG, DOMAIN_COUNT, gradeForRung,
  requiredForDomain, domainGrade, overallGrade,
  scaleStandard, meetsStandard, rungForPerformance, ageBand,
  type DomainGradeResult,
} from '@/lib/grading'

// A domain of twelve events, the roster's actual shape.
const TWELVE = Array.from({ length: 12 }, (_, i) => `e${i + 1}`)
const ladder = (pairs: Record<string, number>) => new Map(Object.entries(pairs))
/** n events all sitting at the same rung. */
const allAt = (rung: number, n = 12) =>
  ladder(Object.fromEntries(TWELVE.slice(0, n).map((s) => [s, rung])))

describe('the ladder', () => {
  it('has twelve rungs, numbered 1..12 in order', () => {
    expect(GRADES).toHaveLength(TOP_RUNG)
    expect(GRADES.map((g) => g.rung)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('is Mā at rung 0, and Mā is not an award on the ladder', () => {
    expect(MA.rung).toBe(0)
    expect(GRADES.some((g) => g.name === MA.name)).toBe(false)
  })

  it('has unique te reo names', () => {
    expect(new Set(GRADES.map((g) => g.name)).size).toBe(TOP_RUNG)
  })

  it('gets harder every rung — population targets strictly decrease', () => {
    const targets = GRADES.map((g) => g.populationTarget).filter((t): t is number => t !== null)
    for (let i = 1; i < targets.length; i++) expect(targets[i]).toBeLessThan(targets[i - 1])
    // Taniwha is the 1st percentile — the top of the ladder, not the 40th as
    // the earlier seven-grade draft had it.
    expect(GRADES[TOP_RUNG - 1].populationTarget).toBe(1)
  })

  it('never labels a grade D1–D12, which already means difficulty tier', () => {
    for (const g of GRADES) expect(g.name).not.toMatch(/^D\d+$/)
  })

  it('clamps out-of-range rungs instead of throwing', () => {
    expect(gradeForRung(0)).toBe(MA)
    expect(gradeForRung(-3)).toBe(MA)
    expect(gradeForRung(99).name).toBe('Taniwha')
  })
})

describe('rule 2 — the domain colour is the highest rung met in half your events', () => {
  it('needs half the events, rounded up', () => {
    expect(requiredForDomain(12)).toBe(6)
    expect(requiredForDomain(5)).toBe(3)
    expect(requiredForDomain(4)).toBe(2)
    expect(requiredForDomain(1)).toBe(1)
  })

  it('awards the highest rung met widely enough, not the best single event', () => {
    // Kōwhai (4) in six events, but Kahurangi (6) in only four.
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 6, e2: 6, e3: 6, e4: 6, e5: 4, e6: 4, e7: 0, e8: 0, e9: 0, e10: 0, e11: 0, e12: 0 }),
    })
    expect(r.required).toBe(6)
    expect(r.rung).toBe(4)
    expect(r.metAtRung).toBe(6)
  })

  it('is Mā when too few events meet even the bottom rung', () => {
    const r = domainGrade({ domainNumber: 1, eventSlugs: TWELVE, rungByEvent: allAt(5, 3) })
    expect(r.rung).toBe(0)
    expect(r.nextRung).toBe(1)
    expect(r.metAtNextRung).toBe(3)
  })

  it('reports progress toward the next rung', () => {
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 5, e2: 5, e3: 5, e4: 5, e5: 5, e6: 5, e7: 6, e8: 6, e9: 6, e10: 0, e11: 0, e12: 0 }),
    })
    expect(r.rung).toBe(5)
    expect(r.nextRung).toBe(6)
    expect(r.metAtNextRung).toBe(3) // three of the six needed for Kahurangi
  })

  it('never regresses when a player scores another event', () => {
    // Monotonicity matters: a player must never be demoted for competing more.
    const before = domainGrade({ domainNumber: 1, eventSlugs: TWELVE, rungByEvent: allAt(7, 6) })
    const after = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ ...Object.fromEntries(TWELVE.slice(0, 6).map((s) => [s, 7])), e7: 1 }),
    })
    expect(before.rung).toBe(7)
    expect(after.rung).toBeGreaterThanOrEqual(before.rung)
  })

  it('treats an unplayed event and a below-bottom-rung event alike', () => {
    const unplayed = domainGrade({ domainNumber: 1, eventSlugs: TWELVE, rungByEvent: allAt(3, 6) })
    const played0 = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ ...Object.fromEntries(TWELVE.slice(0, 6).map((s) => [s, 3])), e7: 0, e8: 0 }),
    })
    expect(played0.rung).toBe(unplayed.rung)
  })

  it('has the top rung reachable', () => {
    expect(domainGrade({ domainNumber: 1, eventSlugs: TWELVE, rungByEvent: allAt(TOP_RUNG) }).rung).toBe(TOP_RUNG)
  })
})

describe('rule 2 — coach-confirmed exemptions', () => {
  // The real case: eight of Maximal Strength's twelve events load the shoulder,
  // so a player who cannot press has four available. Without exemptions they
  // could never reach six, and rule 3 would cap their overall grade forever.
  it('shrinks the threshold with the available events', () => {
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 6, e2: 6, e9: 0, e10: 0 }),
      unavailable: new Set(['e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e11', 'e12']),
    })
    expect(r.availableCount).toBe(4)
    expect(r.required).toBe(2)
    expect(r.rung).toBe(6) // two of four is enough
  })

  it('removes an exempt event from the numerator as well as the denominator', () => {
    // Exempting an event you had already met must not count toward the grade.
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: allAt(8, 4),
      unavailable: new Set(['e1', 'e2']),
    })
    expect(r.availableCount).toBe(10)
    expect(r.required).toBe(5)
    expect(r.metAtRung).toBe(0)
    expect(r.rung).toBe(0) // only e3, e4 remain at rung 8 — short of five
  })

  it('cannot hand out a grade for a domain with nothing available', () => {
    // Guard against the empty case: required would be 0 and every rung
    // trivially "met", which would award Taniwha for an empty domain.
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: new Map(),
      unavailable: new Set(TWELVE),
    })
    expect(r.availableCount).toBe(0)
    expect(r.rung).toBe(0)
  })
})

describe('rule 2 — events nobody can be graded in', () => {
  // The September 2026 difficulty overhaul rebuilt every ladder so a drill rung
  // sits under the contest, taking pure `sport` events from 38 down to 11. Six
  // of the survivors are in Speed.
  const SPEED_SPORT = new Set(['e7', 'e8', 'e9', 'e10', 'e11', 'e12'])

  it('leaves the denominator, so half means half of what CAN be graded', () => {
    const r = domainGrade({
      domainNumber: 4,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 5, e2: 5, e3: 5, e4: 0, e5: 0, e6: 0 }),
      ungradeable: SPEED_SPORT,
    })
    expect(r.availableCount).toBe(6)
    expect(r.required).toBe(3) // NOT 6 — that would be 100% of the gradeable six
    expect(r.rung).toBe(5)
  })

  it('would otherwise demand every gradeable event in Speed', () => {
    // The same player, counting the six contests in the denominator: three of
    // twelve falls short of six and the domain reads Ma.
    const counted = domainGrade({
      domainNumber: 4,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 5, e2: 5, e3: 5, e4: 0, e5: 0, e6: 0 }),
    })
    expect(counted.required).toBe(6)
    expect(counted.rung).toBe(0)
  })

  it('stacks with a player exemption without double-counting', () => {
    const r = domainGrade({
      domainNumber: 4,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 8, e2: 8 }),
      ungradeable: SPEED_SPORT,
      unavailable: new Set(['e6', 'e12']), // e12 is already ungradeable
    })
    expect(r.availableCount).toBe(5) // 12 - 6 ungradeable - 1 further exemption
    expect(r.required).toBe(3)
  })

  it('cannot grade a domain where nothing carries a standard', () => {
    const r = domainGrade({
      domainNumber: 4,
      eventSlugs: TWELVE,
      rungByEvent: new Map(),
      ungradeable: new Set(TWELVE),
    })
    expect(r.availableCount).toBe(0)
    expect(r.rung).toBe(0)
  })
})

describe('rule 3 — the overall grade is the lowest domain', () => {
  const domains = (rungs: number[]): DomainGradeResult[] =>
    rungs.map((rung, i) => ({
      domainNumber: i + 1, rung, availableCount: 12, required: 6,
      metAtRung: 6, nextRung: rung + 1, metAtNextRung: 0,
    }))

  it('takes the minimum, not the average or the best', () => {
    const r = overallGrade(domains([9, 9, 9, 9, 9, 9, 9, 9, 9, 3]))
    expect(r.rung).toBe(3)
    expect(r.weakest).toEqual([10])
  })

  it('names every domain sitting at the minimum', () => {
    expect(overallGrade(domains([5, 5, 8, 8, 8, 8, 8, 8, 8, 8])).weakest).toEqual([1, 2])
  })

  it('withholds an overall grade while any domain is ungraded', () => {
    // Null rather than Mā: "not graded in Flexibility yet" is progress,
    // "you are Mā" is a verdict, and the difference matters to a player.
    const r = overallGrade(domains([7, 7, 7, 7, 7, 7, 7, 7, 7, 0]))
    expect(r.rung).toBeNull()
    expect(r.ungraded).toEqual([10])
  })

  it('withholds an overall grade when fewer than ten domains are supplied', () => {
    expect(overallGrade(domains([7, 7, 7])).rung).toBeNull()
  })

  it('grades a player whose every domain is graded', () => {
    expect(overallGrade(domains(Array(DOMAIN_COUNT).fill(6))).rung).toBe(6)
  })
})

describe('standards scaling', () => {
  it('multiplies for higher-is-better and DIVIDES for lower-is-better', () => {
    // The trap: a Grandmaster's 100m standard must be SLOWER, not faster.
    expect(scaleStandard(50, 'U12', 'power', 'higher')).toBeCloseTo(22.5)
    expect(scaleStandard(13.8, 'Grandmaster', 'speed', 'lower')).toBeCloseTo(18.4, 1)
    expect(scaleStandard(13.8, 'Grandmaster', 'speed', 'lower')).toBeGreaterThan(13.8)
  })

  it('makes flexibility standards HARDER for juniors, who are more mobile', () => {
    expect(scaleStandard(60, 'U12', 'flexibility', 'higher')).toBeGreaterThan(60)
  })

  it('leaves the Open reference group untouched', () => {
    for (const cat of ['strength', 'power', 'speed', 'endurance', 'flexibility', 'skill'] as const) {
      expect(scaleStandard(100, 'Open', cat, 'higher')).toBe(100)
      expect(scaleStandard(100, 'Open', cat, 'lower')).toBe(100)
    }
  })

  it('honours direction when checking a performance', () => {
    expect(meetsStandard(50, 42, 'higher')).toBe(true)
    expect(meetsStandard(50, 42, 'lower')).toBe(false)
    expect(meetsStandard(13.5, 13.8, 'lower')).toBe(true)
    // Exactly on the standard counts as met, both ways.
    expect(meetsStandard(42, 42, 'higher')).toBe(true)
    expect(meetsStandard(42, 42, 'lower')).toBe(true)
  })

  it('finds the highest rung a performance reaches', () => {
    const vjump = [10, 20, 28, 35, 42, 50, 60] // Open male reference, cm
    expect(rungForPerformance(52, vjump, 'Open', 'power', 'higher')).toBe(6)
    expect(rungForPerformance(9, vjump, 'Open', 'power', 'higher')).toBe(0)
    expect(rungForPerformance(60, vjump, 'Open', 'power', 'higher')).toBe(7)
  })

  it('grades a faster time as a higher rung', () => {
    const sprint = [22, 18.5, 17, 15.8, 14.8, 13.8, 12.8]
    expect(rungForPerformance(11.59, sprint, 'Open', 'speed', 'lower')).toBe(7)
    expect(rungForPerformance(35.1, sprint, 'Open', 'speed', 'lower')).toBe(0)
  })

  it('accepts a partial ladder, so an event can grade before all twelve exist', () => {
    expect(rungForPerformance(100, [10, 20], 'Open', 'power', 'higher')).toBe(2)
  })
})

describe('age bands', () => {
  it('maps divisions to bands', () => {
    expect(ageBand("Men's", 30)).toBe('Open')
    expect(ageBand('Masters Women', 45)).toBe('Masters')
    expect(ageBand('Grandmaster Men', 65)).toBe('Grandmaster')
  })

  it('splits juniors by age', () => {
    expect(ageBand('Juniors', 9)).toBe('U12')
    expect(ageBand('Juniors', 13)).toBe('U14')
    expect(ageBand('Juniors', 15)).toBe('U16')
  })

  it("still understands the legacy 'Youth' division value", () => {
    // 'Youth' predates the Juniors rename and still appears on old rows.
    expect(ageBand('Youth', 11)).toBe('U12')
  })

  it('falls back to a middle junior band when the birth date is missing', () => {
    expect(ageBand('Juniors', null)).toBe('U14')
  })
})
