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
import { rungForScore, ratioThresholdsKg, DRILL_CAP, TOP_RUNG, JUNIOR_BODYWEIGHT_KG } from '@/lib/grading'

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

  it('mark exactly the Game-rung events as game, and only Wrestling as rating-only', () => {
    for (const e of EVENTS) {
      const game = e.inputMode === 'sport' || (e.difficultyTiers ?? []).some(t => t.scoring === 'sport')
      expect(STANDARDS[e.slug].game, e.name).toBe(game)
    }
    expect(Object.entries(STANDARDS).filter(([, s]) => s.kind === 'rating').map(([slug]) => slug)).toEqual(['wrestling'])
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
      if (e.inputMode === 'strength' && e.slug !== 'shoulder-dislocate') expect(s.kind, e.name).toBe('ratio')
      else if (e.inputMode !== 'sport') expect(s.kind, e.name).toBe('raw')
    }
  })
})

describe('the standards approved in review come back out of the engine', () => {
  it('Pushup Contest: one 1-arm push-up is Parahi, and Hiriwa for a Master', () => {
    const M = std('Pushup Contest').M!
    const oneArmOne = 3 * 10000 + 1 // D4, one rep
    expect(rungForScore(oneArmOne, M, 'Open')).toBe(8)
    expect(rungForScore(oneArmOne, M, 'Masters')).toBe(9)
    expect(rungForScore(2 * 10000 + 49, M, 'Open')).toBe(8) // 49 push-ups
    expect(rungForScore(3 * 10000 + 5, M, 'Open')).toBe(9) // Hiriwa is five
  })

  it('Jump Rope: eight basic jumps is Kiwikiwi, and Karaka for an under-14', () => {
    const all = std('Jump Rope').all!
    expect(rungForScore(8, all, 'Open', { cap: DRILL_CAP })).toBe(1)
    expect(rungForScore(8, all, 'U14', { cap: DRILL_CAP })).toBe(3)
  })

  it('Bridge: a 31-second D4 bridge is Parahi, and Hiriwa for a Master', () => {
    const all = std('Bridge').all!
    expect(rungForScore(3 * 10000 + 31, all, 'Open')).toBe(8)
    expect(rungForScore(3 * 10000 + 31, all, 'Masters')).toBe(9)
  })

  // Approved in review as Weighted Carry; renamed Sandbag Carry in Sept 2026
  // with its numbers untouched, which is what the shared ladder below checks.
  it('Sandbag Carry: a bodyweight carry is Uenuku under 4:00 and Taniwha under 2:00', () => {
    const all = std('Sandbag Carry').all!
    const bodyweight = (secs: number) => 3 * 10000 + (10000 - secs)
    expect(rungForScore(bodyweight(119), all, 'Open')).toBe(12)
    expect(rungForScore(bodyweight(121), all, 'Open')).toBe(11)
    expect(rungForScore(bodyweight(241), all, 'Open')).toBe(10)
    for (const w of ['Farmer Carry', 'Weighted Drag']) expect(std(w).all).toEqual(all)
  })

  it('Climbing: the Game rung makes it a game event with six drill colours', () => {
    // Sept 2026: the Game rung on top means drills stop at Kahurangi and the
    // head-to-head rating gives Poroporo and above. D9 carries no threshold.
    const s = std('Climbing')
    expect(s.game).toBe(true)
    expect(s.all).toHaveLength(DRILL_CAP)
    expect(Math.max(...s.all!)).toBeLessThan(8 * 10000)
  })

  it('Vertical Jump: Taniwha is 64cm for men and 50cm for women', () => {
    const s = std('Vertical Jump')
    expect(s.M!.at(-1)).toBe(64)
    expect(s.F!.at(-1)).toBe(50)
    expect(rungForScore(52, s.M!, 'Open')).toBe(7)
  })

  it('Pause Bench: the approved ratios, and a 15kg junior lift is Karaka for an under-14', () => {
    const s = std('Pause Bench')
    expect(s.M!.slice(9)).toEqual([1.1, 1.25, 1.5])
    expect(s.F!.at(-1)).toBe(1)
    const junior = ratioThresholdsKg(s.M!.map(r => r || null), JUNIOR_BODYWEIGHT_KG)
    expect(rungForScore(15, junior, 'U14')).toBe(3)
  })
})
