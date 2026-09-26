import { describe, it, expect } from 'vitest'
import {
  GRADES, MA, TOP_RUNG, DOMAIN_COUNT, gradeForRung,
  slotsForDomain, domainGrade, overallGrade, overallRung, averageRung, gamesCapRung,
  DOMAIN_TOP_EVENTS, GAMES_REQUIRED, colourGate,
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

describe('rule 2 — the domain colour is the average of your best six events', () => {
  const grade = (pairs: Record<string, number>, extra: Partial<Parameters<typeof domainGrade>[0]> = {}) =>
    domainGrade({ domainNumber: 1, eventSlugs: TWELVE, rungByEvent: ladder(pairs), ...extra })

  it('averages six slots, never more, however big the domain grows', () => {
    // Tāne, 26 Sept 2026. Flexibility holds sixteen and still averages six.
    expect(DOMAIN_TOP_EVENTS).toBe(6)
    expect(slotsForDomain(12)).toBe(6)
    expect(slotsForDomain(16)).toBe(6)
    expect(slotsForDomain(5)).toBe(5)
    expect(slotsForDomain(0)).toBe(0)
  })

  it('counts an unplayed slot as Mā, so a newcomer reads low', () => {
    // One Kahurangi event, five empty slots: 6 / 6 = 1, Kiwikiwi.
    const r = grade({ e1: 6 })
    expect(r.slots).toBe(6)
    expect(r.rung).toBe(1)
    expect(r.counted).toEqual(['e1'])
  })

  it('rounds the average down', () => {
    // Kōura, Hiriwa, Kahurangi, Karaka and two empty: 28 / 6 = 4.67 -> Kōwhai.
    const r = grade({ e1: 10, e2: 9, e3: 6, e4: 3 })
    expect(r.rung).toBe(4)
    expect(r.average).toBeCloseTo(28 / 6)
  })

  it('uses only the best six: a seventh event counts only when it beats one of them', () => {
    const six = grade(Object.fromEntries(TWELVE.slice(0, 6).map((s) => [s, 5])))
    expect(six.rung).toBe(5)
    // A weaker seventh changes nothing.
    expect(grade({ ...Object.fromEntries(TWELVE.slice(0, 6).map((s) => [s, 5])), e7: 2 }).rung).toBe(5)
    // A stronger one replaces the weakest of the six.
    const better = grade({ ...Object.fromEntries(TWELVE.slice(0, 6).map((s) => [s, 5])), e7: 11 })
    expect(better.average).toBeCloseTo(36 / 6)
    expect(better.rung).toBe(6)
    expect(better.counted).toHaveLength(6)
    expect(better.counted[0]).toBe('e7')
  })

  it('ties a specialist with a generalist at six', () => {
    // Three Taniwha events and nothing else, against eight at Kahurangi.
    const specialist = grade({ e1: 12, e2: 12, e3: 12 })
    const generalist = grade(Object.fromEntries(TWELVE.slice(0, 8).map((s) => [s, 6])))
    expect(specialist.rung).toBe(6)
    expect(generalist.rung).toBe(6)
  })

  it('never regresses when a player scores another event', () => {
    // Monotonicity matters: a player must never be demoted for competing more.
    const base = { e1: 7, e2: 7, e3: 4 }
    for (const add of [0, 1, 3, 7, 12]) {
      expect(grade({ ...base, e4: add }).rung, `adding a rung-${add} event`).toBeGreaterThanOrEqual(grade(base).rung)
    }
  })

  it('treats an unplayed event and a below-bottom-rung event alike', () => {
    expect(grade({ e1: 6, e2: 6, e3: 0, e4: 0 }).rung).toBe(grade({ e1: 6, e2: 6 }).rung)
  })

  it('reports how many steps the next colour is away', () => {
    // 28 across six slots; Kākāriki (5) needs 30, so two steps.
    const r = grade({ e1: 10, e2: 9, e3: 6, e4: 3 })
    expect(r.nextRung).toBe(5)
    expect(r.toNext).toBe(2)
  })

  it('has the top rung reachable, and nothing beyond it', () => {
    const top = grade(Object.fromEntries(TWELVE.slice(0, 6).map((s) => [s, TOP_RUNG])))
    expect(top.rung).toBe(TOP_RUNG)
    expect(top.nextRung).toBeNull()
    expect(top.toNext).toBe(0)
    // An out-of-range rung is clamped, so it cannot carry a weak slot.
    expect(grade({ e1: 99, e2: 99, e3: 99, e4: 99, e5: 99, e6: 99 }).rung).toBe(TOP_RUNG)
  })
})

describe('rule 2 — coach-confirmed exemptions', () => {
  // The real case: most of Maximal Strength loads the shoulder, so a player who
  // cannot press may have four available. They average over four, not six.
  it('averages over what is available when fewer than six are', () => {
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 6, e2: 6, e9: 6, e10: 6 }),
      unavailable: new Set(['e3', 'e4', 'e5', 'e6', 'e7', 'e8', 'e11', 'e12']),
    })
    expect(r.availableCount).toBe(4)
    expect(r.slots).toBe(4)
    expect(r.rung).toBe(6)
  })

  it('removes an exempt event entirely, so it cannot carry the average', () => {
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 12, e2: 12, e3: 3 }),
      unavailable: new Set(['e1', 'e2']),
    })
    expect(r.availableCount).toBe(10)
    expect(r.counted).toEqual(['e3'])
    expect(r.rung).toBe(0) // 3 / 6
  })

  it('cannot hand out a grade for a domain with nothing available', () => {
    const r = domainGrade({
      domainNumber: 1,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 12 }),
      unavailable: new Set(TWELVE),
    })
    expect(r.availableCount).toBe(0)
    expect(r.slots).toBe(0)
    expect(r.rung).toBe(0)
  })
})

describe('rule 2 — events nobody can be graded in', () => {
  const CONTESTS = new Set(['e7', 'e8', 'e9', 'e10', 'e11', 'e12'])

  it('leaves the domain, so a small gradeable pool averages over itself', () => {
    const r = domainGrade({
      domainNumber: 4,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 5, e2: 5, e3: 5, e4: 5 }),
      ungradeable: new Set([...CONTESTS, 'e5', 'e6']),
    })
    expect(r.availableCount).toBe(4)
    expect(r.rung).toBe(5)
  })

  it('stacks with a player exemption without double-counting', () => {
    const r = domainGrade({
      domainNumber: 4,
      eventSlugs: TWELVE,
      rungByEvent: ladder({ e1: 8, e2: 8 }),
      ungradeable: CONTESTS,
      unavailable: new Set(['e6', 'e12']), // e12 is already ungradeable
    })
    expect(r.availableCount).toBe(5)
    expect(r.slots).toBe(5)
  })

  it('cannot grade a domain where nothing carries a standard', () => {
    const r = domainGrade({ domainNumber: 4, eventSlugs: TWELVE, rungByEvent: new Map(), ungradeable: new Set(TWELVE) })
    expect(r.availableCount).toBe(0)
    expect(r.rung).toBe(0)
  })
})

describe('rule 3 — the overall grade is the average domain, capped by games', () => {
  const domains = (rungs: number[]): DomainGradeResult[] =>
    rungs.map((rung, i) => ({
      domainNumber: i + 1, rung, availableCount: 12, slots: 6, counted: [],
      average: rung, nextRung: rung + 1, toNext: 6,
    }))
  const LOTS = 1000

  it('takes the average rounded down, not the minimum or the best', () => {
    // 9 × 9 + 3 = 84, over ten = 8.4 -> Parahi (8).
    const r = overallGrade(domains([9, 9, 9, 9, 9, 9, 9, 9, 9, 3]), LOTS)
    expect(r.rung).toBe(8)
    expect(r.weakest).toEqual([10])
  })

  it('names every domain sitting at the minimum', () => {
    expect(overallGrade(domains([5, 5, 8, 8, 8, 8, 8, 8, 8, 8]), LOTS).weakest).toEqual([1, 2])
  })

  it('counts a Mā domain as zero, so a gap drags but never blocks', () => {
    const r = overallGrade(domains([7, 7, 7, 7, 7, 7, 7, 7, 7, 0]), LOTS)
    expect(r.rung).toBe(6)
    expect(r.ungraded).toEqual([10])
  })

  it('always divides by ten, so a few strong domains do not carry the overall', () => {
    expect(overallGrade(domains([12, 12, 12]), LOTS).rung).toBe(3)
    expect(overallRung([12], LOTS)).toBe(1)
  })

  it('is Mā with nothing held', () => {
    expect(overallGrade(domains(Array(DOMAIN_COUNT).fill(0)), LOTS).rung).toBe(0)
    expect(overallRung([], LOTS)).toBe(0)
  })

  it('caps the overall by official games played', () => {
    // Tāne, 26 Sept 2026: the games ladder moved from each domain to the overall.
    expect(GAMES_REQUIRED).toEqual([0, 1, 3, 5, 8, 12, 16, 20, 30, 40, 55, 75, 100])
    expect(gamesCapRung(0)).toBe(0)
    expect(gamesCapRung(1)).toBe(1)
    expect(gamesCapRung(7)).toBe(3)
    expect(gamesCapRung(8)).toBe(4)
    expect(gamesCapRung(52)).toBe(9)
    expect(gamesCapRung(100)).toBe(12)
    const tens = Array(10).fill(10)
    expect(averageRung(tens)).toBe(10)
    expect(overallRung(tens, 52)).toBe(9)
    const r = overallGrade(domains(tens), 7)
    expect(r.rung).toBe(3)
    expect(r.average).toBe(10)
  })

  it('never lets the cap LIFT a player above their average', () => {
    expect(overallRung(Array(10).fill(2), 100)).toBe(2)
  })
})

describe('what confers', () => {
  it('offers the colour the standards give whenever it is above the one held', () => {
    // No one-at-a-time rule any more: Whero straight to Kahurangi.
    expect(colourGate({ domainNumber: 1, standardsRung: 6, held: 2 }).releasable).toBe(6)
    expect(colourGate({ domainNumber: 1, standardsRung: 1, held: 0 }).releasable).toBe(1)
  })

  it('offers nothing at or below the colour held', () => {
    expect(colourGate({ domainNumber: 1, standardsRung: 4, held: 4 }).releasable).toBe(0)
    expect(colourGate({ domainNumber: 1, standardsRung: 3, held: 5 }).releasable).toBe(0)
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
