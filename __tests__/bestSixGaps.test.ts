import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { colourGate, domainGrade, TOP_RUNG } from '@/lib/grading'
import { eventsBehind, type PlayerGrades } from '@/lib/playerGrades'
import { nextDomainColour } from '@/lib/colourDisplay'
import { EVENTS } from '@/lib/eventData'

// Gaps the best-six / games-cap change left untested (26 September 2026).

describe('colourGate never offers a colour past the top of the ladder', () => {
  it('clamps an out-of-range standards rung to Taniwha', () => {
    expect(colourGate({ domainNumber: 1, standardsRung: TOP_RUNG + 3, held: 4 }).releasable).toBe(TOP_RUNG)
  })
  it('offers nothing once Taniwha is held and the standards read Taniwha', () => {
    expect(colourGate({ domainNumber: 1, standardsRung: TOP_RUNG, held: TOP_RUNG }).releasable).toBe(0)
    // Clamped before the comparison, so an above-ladder rung cannot re-offer it.
    expect(colourGate({ domainNumber: 1, standardsRung: TOP_RUNG + 2, held: TOP_RUNG }).releasable).toBe(0)
  })
  it('domainGrade never reports above Taniwha, so the gate is only ever fed an in-range rung', () => {
    const slugs = Array.from({ length: 6 }, (_, i) => `e${i}`)
    const d = domainGrade({ domainNumber: 1, eventSlugs: slugs, rungByEvent: new Map(slugs.map(s => [s, 99])) })
    expect(d.rung).toBe(TOP_RUNG)
  })
})

describe('eventsBehind', () => {
  it('is empty for a domain the grades do not carry, rather than throwing', () => {
    const grades = { domains: [], events: new Map() } as unknown as PlayerGrades
    expect(eventsBehind(grades, 3)).toEqual([])
  })
})

describe('nextDomainColour agrees with domainGrade', () => {
  // HOME reads steps from nextDomainColour; the engine reports toNext. With
  // nothing held they must say the same thing, including when fewer than six
  // events are available and the average is not a whole number.
  const slugs = (n: number) => Array.from({ length: n }, (_, i) => `e${i + 1}`)
  const cases: [number, number[]][] = [
    [12, [10, 9, 6, 3]],
    [12, [1]],
    [12, []],
    [4, [7, 5, 2]],
    [5, [12, 12, 11, 12, 12]],
    [3, [2, 2, 1]],
  ]
  for (const [available, rungs] of cases) {
    it(`${available} available, rungs ${JSON.stringify(rungs)}`, () => {
      const eventSlugs = slugs(available)
      const d = domainGrade({
        domainNumber: 1,
        eventSlugs,
        rungByEvent: new Map(rungs.map((r, i) => [eventSlugs[i], r])),
      })
      const n = nextDomainColour(d, 0)
      if (d.nextRung === null) {
        expect(n).toBeNull()
      } else {
        expect(n).not.toBeNull()
        expect(n!.next).toBe(d.nextRung)
        expect(n!.steps).toBe(d.toNext)
        expect(n!.progress).toBeGreaterThanOrEqual(0)
        expect(n!.progress).toBeLessThan(1)
      }
    })
  }
})

describe('training units are gone from grading copy', () => {
  it('no event rules text still promises a training unit toward colours', () => {
    const offenders = EVENTS.filter(e => /training unit/i.test(e.rules) || /training unit/i.test(e.howToPerform))
    expect(offenders.map(e => e.slug)).toEqual([])
  })
})

describe('the games cap is counted the same way on every surface', () => {
  // countGames is tested pure; these pin that the two pages feeding it
  // actually exclude the sessions HOME's gameEvidence does not count.
  const src = (p: string) => readFileSync(join(process.cwd(), p), 'utf8')

  it('the leaderboard caps the overall colour by LIFETIME games, through the shared counter', () => {
    const s = src('app/leaderboard/page.tsx')
    expect(s).toMatch(/loadGameCounts\(supabase, null\)/)
    expect(s).toMatch(/colourStanding\(held\.get\(p\.id\), gamesPlayed/)
  })

  it('the family chips and the kaiwhakawā list count games through the shared paged counter', () => {
    // The exclusion and paging rules themselves are tested in gameCounts.test.ts.
    expect(src('components/PlayerTabs.tsx')).toMatch(/loadGameCounts\(supabase, missing\)/)
    expect(src('app/components/JudgeCard.tsx')).toMatch(/loadGameCounts\(supabase, null\)/)
    expect(src('app/components/JudgeCard.tsx')).not.toMatch(/from\('session_player_summary'\)\.select\('player_id'\)/)
  })
})

describe('switching to best-six demotes nobody on a full domain', () => {
  // The old rule: the highest rung met in min(ceil(n / 2), 6) events.
  const oldRule = (rungs: number[]) => {
    const need = Math.min(Math.ceil(rungs.length / 2), 6)
    for (let r = TOP_RUNG; r >= 1; r--) if (rungs.filter(x => x >= r).length >= need) return r
    return 0
  }
  it('is never below the old half-the-domain colour, for 12- and 16-event domains', () => {
    let seed = 7
    const rand = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
    for (const n of [12, 16]) {
      const slugs = Array.from({ length: n }, (_, i) => `x${i}`)
      for (let t = 0; t < 400; t++) {
        const rungs = slugs.map(() => Math.floor(rand() * (TOP_RUNG + 1)))
        const now = domainGrade({ domainNumber: 1, eventSlugs: slugs, rungByEvent: new Map(slugs.map((s, i) => [s, rungs[i]])) }).rung
        expect(now, rungs.join(',')).toBeGreaterThanOrEqual(oldRule(rungs))
      }
    }
  })
})

describe('nextDomainColour when the colour held is above the scores', () => {
  it('aims above the held colour with fewer than six slots and a fractional average', () => {
    // Held Kahurangi (6); 17 over five slots is 3.4. Poroporo needs 35.
    expect(nextDomainColour({ slots: 5, average: 17 / 5 }, 6)).toEqual({ next: 7, steps: 18, progress: 0 })
    // Held Karaka (3); 11 over four is 2.75. Kōwhai needs 16.
    expect(nextDomainColour({ slots: 4, average: 11 / 4 }, 3)).toEqual({ next: 4, steps: 5, progress: 0 })
  })
})
