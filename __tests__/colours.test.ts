import { describe, it, expect } from 'vitest'
import {
  COLOURS,
  RAINBOW,
  PEAK_RUNG,
  PEAK_POINTS,
  MAX_SESSION_POINTS,
  MAX_EFFORT_LEVEL,
  colourByRung,
  colourForPoints,
  nextColour,
  nextColourFrom,
  progressToNext,
  crossedRungs,
  guaranteedSessionPoints,
  hasEarnedDuringSession,
  isOnTrackDuringSession,
  colourCardStyle,
  colourOnDark,
  colourChipStyle,
  emblemSrc,
} from '@/lib/colours'

// Replaces the old __tests__/grades.test.ts, which kept its own copy of the
// 10-rung ladder inline and asserted that Taniwha was the top of it.

describe('ladder shape', () => {
  it('has 19 rungs', () => {
    expect(COLOURS).toHaveLength(19)
  })

  it('numbers rungs 1..19 in order', () => {
    expect(COLOURS.map(c => c.rung)).toEqual(Array.from({ length: 19 }, (_, i) => i + 1))
  })

  it('has strictly increasing thresholds', () => {
    for (let i = 1; i < COLOURS.length; i++) {
      expect(COLOURS[i].threshold).toBeGreaterThan(COLOURS[i - 1].threshold)
    }
  })

  it('has unique names', () => {
    expect(new Set(COLOURS.map(c => c.name)).size).toBe(19)
  })

  it('starts at Mā on 0 and ends at Ngā Taniwha on 100,000', () => {
    expect(COLOURS[0]).toMatchObject({ name: 'Mā', threshold: 0 })
    expect(COLOURS[18]).toMatchObject({ name: 'Ngā Taniwha', threshold: PEAK_POINTS, cycle: 'peak' })
  })

  it('keeps the canonical Kōwhai hex (#F9E051, not the dashboard’s old #FFE566)', () => {
    expect(COLOURS.find(c => c.name === 'Kōwhai')!.accent).toBe('#F9E051')
  })
})

describe('cycle 2', () => {
  const cycle2 = COLOURS.filter(c => c.cycle === 2)

  it('is 8 rungs, 11 to 18', () => {
    expect(cycle2.map(c => c.rung)).toEqual([11, 12, 13, 14, 15, 16, 17, 18])
  })

  it('repeats cycle 1 prefixed with "Taniwha", skipping Mā', () => {
    expect(cycle2.map(c => c.name)).toEqual([
      'Taniwha Kiwikiwi',
      'Taniwha Whero',
      'Taniwha Karaka',
      'Taniwha Kōwhai',
      'Taniwha Kākāriki',
      'Taniwha Kahurangi',
      'Taniwha Poroporo',
      'Taniwha Uenuku',
    ])
    expect(cycle2.some(c => c.name.includes('Mā'))).toBe(false)
  })

  it('steps +10,000 from Taniwha, 20,000 through 90,000', () => {
    expect(cycle2.map(c => c.threshold)).toEqual([
      20_000, 30_000, 40_000, 50_000, 60_000, 70_000, 80_000, 90_000,
    ])
  })

  it('is black-carded with the cycle colour as accent', () => {
    for (const c of cycle2) expect(c.surface).toBe('#000000')
    expect(colourByRung(12)!.accent).toBe('#EA4742')   // Taniwha Whero
    expect(colourByRung(18)!.accent).toBe(RAINBOW)     // Taniwha Uenuku
  })

  it('never stacks Taniwha onto itself', () => {
    expect(COLOURS.some(c => c.name.startsWith('Taniwha Taniwha'))).toBe(false)
  })
})

describe('colourForPoints', () => {
  const cases: [number, string][] = [
    [0, 'Mā'],
    [499, 'Mā'],
    [500, 'Kiwikiwi'],
    [999, 'Kiwikiwi'],
    [1_000, 'Whero'],
    [7_999, 'Poroporo'],
    [8_000, 'Uenuku'],
    [9_999, 'Uenuku'],
    [10_000, 'Taniwha'],
    [19_999, 'Taniwha'],
    [20_000, 'Taniwha Kiwikiwi'],
    [89_999, 'Taniwha Poroporo'],
    [90_000, 'Taniwha Uenuku'],
    [99_999, 'Taniwha Uenuku'],
    [100_000, 'Ngā Taniwha'],
  ]
  it.each(cases)('%i points → %s', (points, name) => {
    expect(colourForPoints(points).name).toBe(name)
  })

  it('clamps above the peak — there is no rung 20', () => {
    expect(colourForPoints(250_000).rung).toBe(PEAK_RUNG)
    expect(colourForPoints(9_999_999).name).toBe('Ngā Taniwha')
  })
})

describe('nextColour', () => {
  it('points at the rung above', () => {
    expect(nextColour(0)!.name).toBe('Kiwikiwi')
    expect(nextColour(500)!.name).toBe('Whero')
    expect(nextColour(10_000)!.name).toBe('Taniwha Kiwikiwi')
    expect(nextColour(89_999)!.name).toBe('Taniwha Uenuku')
  })

  it('returns null at and above Ngā Taniwha', () => {
    expect(nextColour(PEAK_POINTS)).toBeNull()
    expect(nextColour(500_000)).toBeNull()
  })
})

describe('nextColourFrom', () => {
  it('agrees with nextColour when points and rung are in step', () => {
    expect(nextColourFrom(600, 2)!.name).toBe('Whero')   // holds Kiwikiwi, next is Whero
    expect(nextColourFrom(0, 1)!.name).toBe('Kiwikiwi')
  })

  it('skips a rung already awarded mid-session before the points land', () => {
    // Judge tapped "Celebrated" for Whero (rung 3) at 940 lifetime points; the
    // session has not closed so the points have not caught up yet.
    expect(nextColour(940)!.name).toBe('Whero')            // naive: already held
    expect(nextColourFrom(940, 3)!.name).toBe('Karaka')    // correct target
  })

  it('returns null once the ladder is finished by either measure', () => {
    expect(nextColourFrom(PEAK_POINTS, PEAK_RUNG)).toBeNull()
    expect(nextColourFrom(0, PEAK_RUNG)).toBeNull()
  })
})

describe('progressToNext', () => {
  it('is 0 at a threshold and 50 halfway to the next', () => {
    expect(progressToNext(0)).toBe(0)
    expect(progressToNext(250)).toBe(50)
    expect(progressToNext(15_000)).toBe(50) // Taniwha 10k → Taniwha Kiwikiwi 20k
  })

  it('is 100 once the ladder is finished', () => {
    expect(progressToNext(PEAK_POINTS)).toBe(100)
  })
})

describe('crossedRungs', () => {
  it('returns the colour crossed', () => {
    expect(crossedRungs(400, 600).map(c => c.name)).toEqual(['Kiwikiwi'])
    expect(crossedRungs(9_900, 10_050).map(c => c.name)).toEqual(['Taniwha'])
  })

  it('returns nothing when no threshold is passed', () => {
    expect(crossedRungs(600, 700)).toEqual([])
    expect(crossedRungs(500, 500)).toEqual([])
  })

  it('never awards on a decrease (a voided session must not un-award)', () => {
    expect(crossedRungs(10_000, 200)).toEqual([])
  })

  it('does not re-award the rung already held', () => {
    // Sitting exactly on Kiwikiwi and earning more must not re-emit Kiwikiwi.
    expect(crossedRungs(500, 900)).toEqual([])
  })

  it('handles a full-ladder replay (used by the backfill)', () => {
    // Every rung above Mā, which the player starts on.
    expect(crossedRungs(0, PEAK_POINTS)).toHaveLength(18)
  })
})

describe('no session can skip a rung', () => {
  // The live alert assumes it only ever has to announce one colour at a time.
  // If the points formula ever changes so a session can out-earn the smallest
  // gap on the ladder, this fails loudly rather than the alert going quiet.
  it('smallest gap exceeds the maximum single-session award', () => {
    const gaps = COLOURS.slice(1).map((c, i) => c.threshold - COLOURS[i].threshold)
    expect(Math.min(...gaps)).toBeGreaterThan(MAX_SESSION_POINTS)
  })
})

describe('live-session alert predicates', () => {
  it('guarantees the placement floor plus banked effort', () => {
    expect(guaranteedSessionPoints(0)).toBe(10)   // 10 + 0
    expect(guaranteedSessionPoints(6)).toBe(40)   // 10 + 30
    expect(guaranteedSessionPoints(20)).toBe(110) // 10 + 100, the cap
  })

  it('clamps effort level to the 0..20 range', () => {
    expect(guaranteedSessionPoints(-5)).toBe(10)
    expect(guaranteedSessionPoints(99)).toBe(guaranteedSessionPoints(MAX_EFFORT_LEVEL))
  })

  it('only says "earned" when the crossing survives the worst case', () => {
    // 60 points short of Whero, effort level 6 banks a guaranteed 40. Not safe.
    expect(hasEarnedDuringSession(940, 6, 1_000)).toBe(false)
    // Effort level 12 banks a guaranteed 70. Safe regardless of placement.
    expect(hasEarnedDuringSession(940, 12, 1_000)).toBe(true)
  })

  it('says "on track" on the optimistic projection', () => {
    expect(isOnTrackDuringSession(940, 150, 1_000)).toBe(true)
    expect(isOnTrackDuringSession(940, 40, 1_000)).toBe(false)
  })

  it('is strictly more conservative than "on track"', () => {
    // Anything safe at the guaranteed floor is also on track at any projection
    // at least as large — the banner can never regress from earned to on-track.
    for (let level = 0; level <= MAX_EFFORT_LEVEL; level++) {
      const guaranteed = guaranteedSessionPoints(level)
      for (const projected of [guaranteed, guaranteed + 1, 200]) {
        if (hasEarnedDuringSession(900, level, 1_000)) {
          expect(isOnTrackDuringSession(900, projected, 1_000)).toBe(true)
        }
      }
    }
  })
})

describe('styling', () => {
  it('uses backgroundImage for the rainbow and background for hex', () => {
    expect(colourCardStyle(colourByRung(9)!)).toHaveProperty('backgroundImage', RAINBOW)
    expect(colourCardStyle(colourByRung(3)!)).toHaveProperty('background', '#EA4742')
  })

  it('substitutes a usable surface for Mā (pure white is unreadable here)', () => {
    const ma = colourByRung(1)!
    expect(ma.accent).toBe('#ffffff')
    expect(ma.surface).toBe('#f0f0f0')
  })

  it('gives every rung a name colour that is legible on the dark theme', () => {
    for (const c of COLOURS) {
      const onDark = colourOnDark(c)
      expect(onDark.startsWith('#')).toBe(true)
      expect(onDark).not.toBe('#1a1a1a') // Mā's card ink would vanish on dark
      expect(onDark).not.toBe('#000000')
    }
    expect(colourOnDark(colourByRung(1)!)).toBe('#e8e8e8')  // Mā
    expect(colourOnDark(colourByRung(9)!)).toBe('#F9B051')  // Uenuku, rainbow
    expect(colourOnDark(colourByRung(18)!)).toBe('#F9B051') // Taniwha Uenuku
    expect(colourOnDark(colourByRung(12)!)).toBe('#EA4742') // Taniwha Whero
  })

  it('gives the black-card family a chip with an accent edge', () => {
    const chip = colourChipStyle(colourByRung(12)!) // Taniwha Whero
    expect(chip.background).toBe('#111111')
    expect(chip.border).toBe('2px solid #EA4742')
  })

  it('uses the two-layer clip trick for a rainbow edge, never a solid fallback', () => {
    // CSS `border` cannot take a gradient; a naive implementation silently
    // renders grey or amber. This shipped as a real bug twice.
    const chip = colourChipStyle(colourByRung(18)!) // Taniwha Uenuku
    expect(chip.border).toBe('2px solid transparent')
    expect(String(chip.backgroundImage)).toContain('linear-gradient(90deg')
    expect(chip.backgroundClip).toBe('padding-box, border-box')
  })

  it('fills a cycle-1 chip with its own colour', () => {
    expect(colourChipStyle(colourByRung(3)!).background).toBe('#EA4742')
    expect(colourChipStyle(colourByRung(9)!).backgroundImage).toBe(RAINBOW)
  })
})

describe('emblems', () => {
  it('shows none below Taniwha', () => {
    for (const c of COLOURS.filter(c => c.rung <= 9)) expect(emblemSrc(c)).toBeNull()
  })

  it('shows one taniwha for Taniwha and all of cycle 2', () => {
    for (const c of COLOURS.filter(c => c.rung >= 10 && c.rung <= 18)) {
      expect(emblemSrc(c)).toBe('/colour-emblems/taniwha.png')
    }
  })

  it('shows the full crest only for Ngā Taniwha', () => {
    expect(emblemSrc(colourByRung(PEAK_RUNG)!)).toBe('/colour-emblems/nga-taniwha.png')
    expect(COLOURS.filter(c => c.emblem === 'twin')).toHaveLength(1)
  })
})

describe('points formula', () => {
  // Migrated from grades.test.ts, with the gap floor removed. The old copy used
  // `Math.max(100 / playerCount, 10)`, which is the bug fixed in May 2026: the
  // minimum of 10 applies to the AWARD, never to the gap. See CLAUDE.md.
  function calculatePoints(placement: number, playerCount: number): number {
    const gap = 100 / playerCount
    return Math.max(100 - gap * (placement - 1), 10)
  }

  it('5 players: 100/80/60/40/20', () => {
    expect([1, 2, 3, 4, 5].map(p => calculatePoints(p, 5))).toEqual([100, 80, 60, 40, 20])
  })

  it('10 players: 100/90/…/10', () => {
    expect(calculatePoints(1, 10)).toBe(100)
    expect(calculatePoints(2, 10)).toBe(90)
    expect(calculatePoints(10, 10)).toBe(10)
  })

  it('has no floor on the gap — 10th of 20 is 55, not 10', () => {
    expect(calculatePoints(10, 20)).toBe(55)
  })

  it('floors the award at 10 for the tail of a big field', () => {
    expect(calculatePoints(20, 20)).toBe(10)
    expect(calculatePoints(100, 100)).toBe(10)
  })

  it('a solo player takes 100', () => {
    expect(calculatePoints(1, 1)).toBe(100)
  })

  it('cannot exceed the ladder’s single-session maximum', () => {
    // 100 placement + 100 effort. The "no session can skip a rung" test above
    // depends on this ceiling holding.
    expect(calculatePoints(1, 1) + MAX_EFFORT_LEVEL * 5).toBe(MAX_SESSION_POINTS)
  })
})
