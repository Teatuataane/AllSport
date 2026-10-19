import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { STANDARDS } from '@/lib/standards'
import { EVENTS, getEventByName, TIMED_EFFORT_SLUGS } from '@/lib/eventData'

describe('scripts that read TIMED_EFFORT_SLUGS out of the source', () => {
  it('see exactly the real set', () => {
    // gen-difficulty-migration.mjs, gen-difficulty-review.mjs and the standards
    // scripts parse the set by pulling out quoted names, comments included. An
    // apostrophe in a comment pairs with the next quote and misreads every slug
    // after it; this is the check that caught one.
    const src = readFileSync('lib/eventData.ts', 'utf8')
    const block = src.match(/TIMED_EFFORT_SLUGS = new Set<string>\(\[([\s\S]*?)\]\)/)!
    const naive = [...block[1].matchAll(/'([^']+)'/g)].map(m => m[1])
    expect(naive.sort()).toEqual([...TIMED_EFFORT_SLUGS].sort())
  })
})
import { rungForScore, rungForCarry, ratioThresholdsKg, DRILL_CAP, TOP_RUNG, JUNIOR_BODYWEIGHT_KG, compoundLadderAt, halfStepCredit } from '@/lib/grading'
import { eventGrade } from '@/lib/playerGrades'

// lib/standards.ts is COMPILED from GRADING_STANDARDS_REVIEW.md. These tests
// prove the two agree, that every ladder is well formed, and that the numbers
// Tāne approved in review come back out of the engine exactly as the review
// page showed them.

const std = (name: string) => {
  const e = getEventByName(name)
  if (!e) throw new Error(`${name} is not on the roster`)
  const s = STANDARDS[e.slug]
  if (!s) throw new Error(`${name} has no standards`)
  return s
}
const ladders = (s: (typeof STANDARDS)[string]) =>
  Object.entries({ all: s.all, M: s.M, F: s.F }).filter(([, v]) => v) as [string, readonly number[]][]

describe('the compiled standards', () => {
  it('match the reviewed sheet: re-running the compiler changes nothing', () => {
    const out = execFileSync('node', ['scripts/apply-standards-sheet.mjs', '--dry'], { encoding: 'utf8' })
    expect(out).toContain('lib/standards.ts is up to date')
  })

  it('cover every event on the roster, and nothing else', () => {
    expect(Object.keys(STANDARDS).sort()).toEqual(EVENTS.map(e => e.slug).sort())
  })

  it('mark exactly the Game-rung events as game, and only the pure contests as rating-only', () => {
    for (const e of EVENTS) {
      const game = e.inputMode === 'sport' || (e.difficultyTiers ?? []).some(t => t.scoring === 'sport')
      expect(STANDARDS[e.slug].game, e.name).toBe(game)
    }
    // Wrestling, and since 5 Oct 2026 the thirteen contests that lost their drills.
    expect(Object.entries(STANDARDS).filter(([, s]) => s.kind === 'rating').map(([slug]) => slug).sort())
      .toEqual(EVENTS.filter(e => e.inputMode === 'sport').map(e => e.slug).sort())
  })

  it('give every ladder twelve colours, or six on a Game-rung event, Kabaddi excepted', () => {
    for (const e of EVENTS) {
      const s = STANDARDS[e.slug]
      if (s.kind === 'rating') continue
      for (const [key, l] of ladders(s)) {
        const want = s.game ? DRILL_CAP : TOP_RUNG
        // Five cones make five colours: Kabaddi's drill stops at Kākāriki.
        if (e.name === 'Kabaddi') expect(l.length, `${e.name} ${key}`).toBe(5)
        else expect(l.length, `${e.name} ${key}`).toBe(want)
      }
    }
  })

  it('get harder at every colour', () => {
    for (const e of EVENTS) {
      for (const [key, l] of ladders(STANDARDS[e.slug])) {
        for (let i = 1; i < l.length; i++) expect(l[i], `${e.name} ${key} colour ${i + 1}`).toBeGreaterThan(l[i - 1])
      }
    }
  })

  it('grade strength as a ratio and everything else against raw_score', () => {
    for (const e of EVENTS) {
      const s = STANDARDS[e.slug]
      if (e.inputMode === 'strength') expect(s.kind, e.name).toBe('ratio')
      else if (e.inputMode !== 'sport') expect(s.kind, e.name).toBe('raw')
    }
  })
})

describe('the standards approved in review come back out of the engine', () => {
  // 12 Oct 2026 review: men's Kōura is 40 push-ups, Uenuku 20 one-arm.
  it('Pushups: one 1-arm push-up is Kōura, and Uenuku for a Master', () => {
    const M = std('Pushups').M!
    const oneArmOne = 4 * 10000 + 1 // D5, one rep
    expect(rungForScore(oneArmOne, M, 'Open')).toBe(10)
    expect(rungForScore(oneArmOne, M, 'Over40')).toBe(11)
    expect(rungForScore(3 * 10000 + 39, M, 'Open')).toBe(9) // 39 push-ups
    expect(rungForScore(3 * 10000 + 40, M, 'Open')).toBe(10) // Kōura is forty
  })

  it('Jump Rope: eight basic jumps is Kiwikiwi, and Karaka for an under-14', () => {
    const all = std('Jump Rope').all!
    expect(rungForScore(8, all, 'Open', { cap: DRILL_CAP })).toBe(1)
    expect(rungForScore(8, all, 'U14', { cap: DRILL_CAP })).toBe(3)
  })

  // 12 Oct 2026 review: Kahurangi is any D4 bridge, Poroporo 30s, Parahi 1:00.
  it('Bridge: a 31-second D4 bridge is Poroporo, and Parahi for a Master', () => {
    const all = std('Bridge').all!
    expect(rungForScore(3 * 10000 + 1, all, 'Open')).toBe(6)
    expect(rungForScore(3 * 10000 + 31, all, 'Open')).toBe(7)
    expect(rungForScore(3 * 10000 + 31, all, 'Over40')).toBe(8)
  })

  // 12 Oct 2026: a carry colour is a share of bodyweight carried the official
  // 200m inside a time. A colour asks for the load AND the 200m AND the time.
  it('Sandbag Carry: a colour needs its load, the full 200m and its time', () => {
    const s = std('Sandbag Carry')
    expect(s.bwLoad).toBe(true)
    const m = compoundLadderAt('weight+distance+time', s.M!, s.bwLoad, 80)! // Taniwha: 80kg in 2:00
    const carry = (kg: number, metres: number, secs: number) => Math.round(kg * 10) * 1e9 + metres * 1e4 + (1e4 - secs)
    expect(rungForCarry(carry(80, 200, 120), m, 'Open')).toBe(12)
    expect(rungForCarry(carry(80, 200, 121), m, 'Open')).toBe(11) // Uenuku: 80kg in 3:00
    expect(rungForCarry(carry(79, 200, 100), m, 'Open')).toBe(9) // Hiriwa: 0.75× = 60kg in 2:00
    // Every load and time, but 199m: not the official distance, no colour.
    expect(rungForCarry(carry(200, 199, 30), m, 'Open')).toBe(0)
    // Kōura's 80kg in 4:00, and Taniwha's load inside twice its time: a half.
    expect(halfStepCredit('weight+distance+time', carry(80, 200, 200), m, 'Open', 10)).toBe(11.5)
    // 4:01 misses every timed colour but Kiwikiwi; Uenuku's 3:00 doubled covers it.
    const slow = carry(80, 200, 241)
    expect(rungForCarry(slow, m, 'Open')).toBe(1)
    expect(halfStepCredit('weight+distance+time', slow, m, 'Open', 1)).toBe(10.5)
  })

  it('a bodyweight-share ladder with no bodyweight declared is unmet, not dropped', () => {
    const ev = getEventByName('Glute Thrust')!
    const row = { event_name: ev.name, raw_score: 160 * 100 * 10000 + 30, weight_kg: null, difficulty_tier: null }
    const man = { division: "Men's", ageYears: 30, gender: 'male' }
    expect(eventGrade(ev, [row], man)).toMatchObject({ rung: 0, gradeable: true, bodyweightBlocked: true })
    expect(eventGrade(ev, [{ ...row, bodyweightKg: 80 }], man).rung).toBe(12)
  })

  it('Running: the colour reads the predicted 1000m time', () => {
    const m = std('Running').M!
    expect(rungForScore(10000 - 210, m, 'Open')).toBe(12) // 3:30
    expect(rungForScore(10000 - 211, m, 'Open')).toBe(11)
    expect(rungForScore(10000 - 3600, m, 'Open')).toBe(1)
  })

  it('Climbing: the Game rung makes it a game event with six drill colours', () => {
    // Sept 2026: the Game rung on top means drills stop at Kahurangi and the
    // head-to-head rating gives Poroporo and above. D6 (D9 until 5 Oct 2026)
    // carries no threshold.
    const s = std('Climbing')
    expect(s.game).toBe(true)
    expect(s.all).toHaveLength(DRILL_CAP)
    expect(Math.max(...s.all!)).toBeLessThan(5 * 10000)
  })

  it('Vertical Jump: Taniwha is 62cm for men and 48cm for women', () => {
    const s = std('Vertical Jump')
    expect(s.M!.at(-1)).toBe(62)
    expect(s.F!.at(-1)).toBe(48)
    expect(rungForScore(51, s.M!, 'Open')).toBe(7)
  })

  it('Pause Bench: the approved ratios, and a 15kg junior lift is Kākāriki for an under-14', () => {
    const s = std('Pause Bench')
    expect(s.M!.slice(9)).toEqual([1.3, 1.4, 1.5])
    expect(s.F!.at(-1)).toBe(1)
    const junior = ratioThresholdsKg(s.M!.map(r => r || null), JUNIOR_BODYWEIGHT_KG)
    expect(rungForScore(15, junior, 'U14')).toBe(5)
  })
})
