import { describe, it, expect } from 'vitest'
import {
  GRADES, MA, TOP_RUNG, DOMAIN_COUNT, gradeForRung,
  requiredForDomain, domainGrade, overallGrade, DOMAIN_REQUIRED_CAP,
  AGE_SHIFT, thresholdFor, rungForScore, ageBand,
  DRILL_CAP, MIN_RATED_GAMES, ratingRung, gameEventRung,
  BODYWEIGHT_BANDS, JUNIOR_BODYWEIGHT_KG, ratioThresholdsKg, bandMidpointKg, bodyweightOn,
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

  it('caps the ask at six however big the domain grows', () => {
    // Sept 2026: Flexibility went to sixteen and Tāne held the bar at six.
    expect(DOMAIN_REQUIRED_CAP).toBe(6)
    expect(requiredForDomain(16)).toBe(6)
    expect(requiredForDomain(14)).toBe(6)
    expect(requiredForDomain(13)).toBe(6)
    expect(requiredForDomain(11)).toBe(6)
    expect(requiredForDomain(100)).toBe(6)
  })

  it('never asks a player for more events than they have available', () => {
    // The cap is a CAP, not a flat 6: exemptions shrink the pool, and a flat
    // six would ask a five-event player for six of five.
    for (let n = 1; n <= 20; n++) expect(requiredForDomain(n), `${n} available`).toBeLessThanOrEqual(n)
  })

  it('awards the colour on six of a sixteen-event domain, not eight', () => {
    const SIXTEEN = Array.from({ length: 16 }, (_, i) => `f${i + 1}`)
    const six = new Map(SIXTEEN.slice(0, 6).map((s) => [s, 5]))
    const r = domainGrade({ domainNumber: 7, eventSlugs: SIXTEEN, rungByEvent: six })
    expect(r.availableCount).toBe(16)
    expect(r.required).toBe(6)
    expect(r.rung).toBe(5)
    const five = new Map(SIXTEEN.slice(0, 5).map((s) => [s, 5]))
    expect(domainGrade({ domainNumber: 7, eventSlugs: SIXTEEN, rungByEvent: five }).rung).toBe(0)
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

describe('standards and the age shift', () => {
  const vjump = [10, 20, 28, 35, 42, 50, 60] // an Open reference, cm
  const twelve = Array.from({ length: 12 }, (_, i) => (i + 1) * 10)

  it('shifts two colours under 14 and for Grandmasters, one for 14 to 16 and Masters', () => {
    expect(AGE_SHIFT).toEqual({ U12: 2, U14: 2, U16: 1, Open: 0, Masters: 1, Grandmaster: 2 })
  })

  it('grades the Open band against the ladder as written', () => {
    expect(rungForScore(52, vjump, 'Open')).toBe(6)
    expect(rungForScore(9, vjump, 'Open')).toBe(0)
    expect(rungForScore(60, vjump, 'Open')).toBe(7)
    // Exactly on the standard counts as met.
    expect(rungForScore(42, vjump, 'Open')).toBe(5)
  })

  it("moves the ladder rather than scaling the value: a Masters Taniwha is an Open Uenuku", () => {
    expect(rungForScore(110, twelve, 'Open')).toBe(11)
    expect(rungForScore(110, twelve, 'Masters')).toBe(12)
    expect(rungForScore(100, twelve, 'Grandmaster')).toBe(12)
    expect(rungForScore(52, vjump, 'Masters')).toBe(7)
  })

  it('never goes past Taniwha, however far the shift', () => {
    expect(rungForScore(1000, twelve, 'U12')).toBe(12)
  })

  it('extrapolates below the Open floor by the ladder\'s first step', () => {
    // D1 · 1 rep, then D1 · 10: one step is 9 raw points.
    const rope = [1, 10, 10010, 20010, 30010, 40010]
    expect(thresholdFor(rope, 1)).toBe(1)
    expect(thresholdFor(rope, 0)).toBe(-8)
    expect(thresholdFor(rope, -1)).toBe(-17)
    // Eight basic jumps: Open Kiwikiwi, and two colours up for an under-14.
    expect(rungForScore(8, rope, 'Open')).toBe(1)
    expect(rungForScore(8, rope, 'U14')).toBe(3)
    // A one-rung ladder has no step to extrapolate by, so its floor holds.
    expect(thresholdFor([5], 0)).toBe(5)
  })

  it('reads a timed effort off raw_score, where a faster time is already a bigger number', () => {
    // Bodyweight carry is rung index 3: raw = 3 * 10000 + (10000 - seconds).
    const raw = (secs: number) => 3 * 10000 + (10000 - secs)
    const carry = [...Array.from({ length: 10 }, (_, i) => i + 1), raw(240), raw(120)]
    expect(rungForScore(raw(180), carry, 'Open')).toBe(11) // under 4:00 is Uenuku
    expect(rungForScore(raw(119), carry, 'Open')).toBe(12) // under 2:00 is Taniwha
    expect(rungForScore(raw(241), carry, 'Open')).toBe(10)
  })

  it('accepts a partial ladder, so an event can grade before all twelve exist', () => {
    expect(rungForScore(100, [10, 20], 'Open')).toBe(2)
    expect(rungForScore(100, [10, 20], 'Masters')).toBe(3)
    expect(rungForScore(100, [], 'Open')).toBe(0)
  })

  it('caps a drill at Kahurangi AFTER the shift, so age never lifts a drill into a won colour', () => {
    const drills = [10, 20, 30, 40, 50, 60]
    expect(rungForScore(60, drills, 'Open', { cap: DRILL_CAP })).toBe(6)
    expect(rungForScore(60, drills, 'U12', { cap: DRILL_CAP })).toBe(6)
    expect(rungForScore(40, drills, 'U12', { cap: DRILL_CAP })).toBe(6)
    expect(rungForScore(30, drills, 'U12', { cap: DRILL_CAP })).toBe(5)
  })
})

describe('Game-rung events', () => {
  it('gives no rating colour below Poroporo or before ten games', () => {
    expect(MIN_RATED_GAMES).toBe(10)
    expect(ratingRung(1099, 30)).toBe(0)
    expect(ratingRung(1500, 9)).toBe(0)
  })

  it('gives Poroporo at 1,100 and a colour per 100 points up to Taniwha at 1,600', () => {
    expect(ratingRung(1100, 10)).toBe(7)
    expect(ratingRung(1199, 10)).toBe(7)
    expect(ratingRung(1200, 10)).toBe(8)
    expect(ratingRung(1600, 10)).toBe(12)
    expect(ratingRung(2100, 10)).toBe(12)
  })

  it('shows the higher of the capped drill colour and the rating colour', () => {
    expect(gameEventRung(5, 0)).toBe(5)
    expect(gameEventRung(6, 8)).toBe(8)
    expect(gameEventRung(9, 0)).toBe(DRILL_CAP)
  })
})

describe('strength is a ratio of bodyweight', () => {
  it('bands are 10kg, contiguous, and taken at their middle', () => {
    BODYWEIGHT_BANDS.forEach((b, i) => {
      if (i > 0) expect(b.min).toBe(BODYWEIGHT_BANDS[i - 1].max)
      if (b.max != null) {
        expect(b.max - b.min).toBe(b.min === 0 ? 50 : 10)
        if (b.min > 0) expect(b.mid).toBe((b.min + b.max) / 2)
      }
    })
    expect(BODYWEIGHT_BANDS.at(-1)!.max).toBeNull()
  })

  const benchMen = [null, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.93, 1, 1.1, 1.25, 1.5]

  it('rounds each standard to the nearest 2.5kg plate', () => {
    // Kōura 1.1x, Uenuku 1.25x, Taniwha 1.5x for a 70 to 80kg man.
    expect(ratioThresholdsKg(benchMen, 75).slice(9)).toEqual([82.5, 95, 112.5])
  })

  it('grades juniors as a 50kg lifter, the ladder shown in review', () => {
    expect(JUNIOR_BODYWEIGHT_KG).toBe(50)
    expect(ratioThresholdsKg(benchMen, 50))
      .toEqual([0, 17.5, 22.5, 27.5, 32.5, 37.5, 42.5, 47.5, 50, 55, 62.5, 75])
  })

  it('makes the empty bar Kiwikiwi, then shifts a junior by age', () => {
    const junior = ratioThresholdsKg(benchMen, 50)
    // 15kg is under the second rung: the empty bar, then two colours for an under-14.
    expect(rungForScore(15, junior, 'Open')).toBe(1)
    expect(rungForScore(15, junior, 'U14')).toBe(3)
  })

  it('reads a stored band back as its midpoint, and nothing else', () => {
    // The legacy bridge: bodyweight is declared as an exact number now, and
    // this only exists so a band stored before 20260922213125 still resolves.
    expect(bandMidpointKg('70 to 80kg')).toBe(75)
    expect(bandMidpointKg('90 to 100kg')).toBe(95)
    expect(bandMidpointKg('not a band')).toBeNull()
    expect(bandMidpointKg(null)).toBeNull()
    expect(bandMidpointKg(undefined)).toBeNull()
  })
})

describe('resolving a bodyweight to the day a lift was done', () => {
  const d = (measured_on: string, kg: number) => ({ measured_on, kg })

  it('takes the most recent declaration at or before the day', () => {
    const rows = [d('2026-01-01', 70), d('2026-06-01', 80), d('2026-09-01', 90)]
    expect(bodyweightOn(rows, '2026-07-15')).toBe(80)
    expect(bodyweightOn(rows, '2026-06-01')).toBe(80)   // inclusive
    expect(bodyweightOn(rows, '2026-05-31')).toBe(70)
  })

  it('carries the last declaration forward indefinitely', () => {
    // Deliberate and provisional: an expiry would retroactively un-grade the
    // history seeded from the old bands. See bodyweightOn's comment.
    expect(bodyweightOn([d('2026-01-01', 70)], '2030-01-01')).toBe(70)
  })

  it('never reaches forward for a declaration made later', () => {
    // The whole point of dating them: a weight declared today cannot re-price
    // a lift done last year.
    expect(bodyweightOn([d('2026-09-01', 60)], '2026-08-31')).toBeNull()
  })

  it('has nothing to say without a day or a declaration', () => {
    expect(bodyweightOn([], '2026-09-01')).toBeNull()
    expect(bodyweightOn([d('2026-01-01', 70)], null)).toBeNull()
    expect(bodyweightOn([d('2026-01-01', 70)], undefined)).toBeNull()
  })

  it('refuses a nonsense weight rather than dividing by it', () => {
    expect(bodyweightOn([d('2026-01-01', 0)], '2026-02-01')).toBeNull()
  })

  it('does not assume the rows arrive in order', () => {
    const rows = [d('2026-09-01', 90), d('2026-01-01', 70), d('2026-06-01', 80)]
    expect(bodyweightOn(rows, '2026-07-15')).toBe(80)
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
