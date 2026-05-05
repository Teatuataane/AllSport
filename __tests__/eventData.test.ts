import { describe, it, expect } from 'vitest'
import {
  EVENTS,
  DOMAIN_ORDER,
  getEventBySlug,
  getEventByName,
  getEventsByDomain,
  getBonusTargets,
} from '@/lib/eventData'

// ─── EVENTS array integrity ───────────────────────────────────────────────────

describe('EVENTS array', () => {
  it('contains exactly 100 events', () => {
    expect(EVENTS).toHaveLength(100)
  })

  it('every event has a unique slug', () => {
    const slugs = EVENTS.map(e => e.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(slugs.length)
  })

  it('every event has a unique name', () => {
    const names = EVENTS.map(e => e.name)
    const unique = new Set(names)
    expect(unique.size).toBe(names.length)
  })

  it('every event has a non-empty emoji string', () => {
    for (const e of EVENTS) {
      expect(typeof e.emoji).toBe('string')
      expect(e.emoji.length).toBeGreaterThan(0)
    }
  })

  it('all domainNumbers are between 1 and 10', () => {
    for (const e of EVENTS) {
      expect(e.domainNumber).toBeGreaterThanOrEqual(1)
      expect(e.domainNumber).toBeLessThanOrEqual(10)
    }
  })

  it('exactly 10 events per domain (10 domains × 10 events = 100)', () => {
    const counts: Record<number, number> = {}
    for (const e of EVENTS) {
      counts[e.domainNumber] = (counts[e.domainNumber] ?? 0) + 1
    }
    for (let d = 1; d <= 10; d++) {
      expect(counts[d]).toBe(10)
    }
  })

  it('events with hasDifficultyTiers=true have a non-empty difficultyTiers array', () => {
    const tiered = EVENTS.filter(e => e.hasDifficultyTiers)
    for (const e of tiered) {
      expect(e.difficultyTiers).toBeDefined()
      expect(e.difficultyTiers!.length).toBeGreaterThan(0)
    }
  })

  it('events with hasDifficultyTiers=false have no difficultyTiers', () => {
    const flat = EVENTS.filter(e => !e.hasDifficultyTiers)
    for (const e of flat) {
      // difficultyTiers should be undefined (or absent) when hasDifficultyTiers is false
      expect(e.difficultyTiers).toBeUndefined()
    }
  })

})

// ─── DOMAIN_ORDER ─────────────────────────────────────────────────────────────

describe('DOMAIN_ORDER', () => {
  it('contains exactly 10 domains', () => {
    expect(DOMAIN_ORDER).toHaveLength(10)
  })

  it('first domain is Maximal Strength', () => {
    expect(DOMAIN_ORDER[0]).toBe('Maximal Strength')
  })

  it('last domain is Aim & Precision', () => {
    expect(DOMAIN_ORDER[9]).toBe('Aim & Precision')
  })

  it('matches the domain names present in EVENTS', () => {
    const domainsInEvents = new Set(EVENTS.map(e => e.domain))
    for (const d of DOMAIN_ORDER) {
      expect(domainsInEvents.has(d)).toBe(true)
    }
  })
})

// ─── getEventBySlug ───────────────────────────────────────────────────────────

describe('getEventBySlug', () => {
  it('finds deadlift by slug', () => {
    const e = getEventBySlug('deadlift')
    expect(e).toBeDefined()
    expect(e!.name).toBe('Deadlift')
  })

  it('finds 1-leg-squat by slug', () => {
    const e = getEventBySlug('1-leg-squat')
    expect(e).toBeDefined()
    expect(e!.domainNumber).toBe(2)
  })

  it('returns undefined for unknown slug', () => {
    expect(getEventBySlug('not-a-real-event')).toBeUndefined()
  })

  it('returns undefined for empty string', () => {
    expect(getEventBySlug('')).toBeUndefined()
  })
})

// ─── getEventByName ───────────────────────────────────────────────────────────

describe('getEventByName', () => {
  it('finds Deadlift by name', () => {
    const e = getEventByName('Deadlift')
    expect(e).toBeDefined()
    expect(e!.slug).toBe('deadlift')
  })

  it('finds 1 Arm Press by exact name', () => {
    const e = getEventByName('1 Arm Press')
    expect(e).toBeDefined()
    expect(e!.domainNumber).toBe(1)
  })

  it('returns undefined for unknown name', () => {
    expect(getEventByName('Completely Made Up Event')).toBeUndefined()
  })

  it('is case-sensitive (wrong case returns undefined)', () => {
    expect(getEventByName('deadlift')).toBeUndefined()
  })
})

// ─── getEventsByDomain ────────────────────────────────────────────────────────

describe('getEventsByDomain', () => {
  it('returns a record with all 10 domains as keys', () => {
    const map = getEventsByDomain()
    expect(Object.keys(map)).toHaveLength(10)
  })

  it('Maximal Strength has 10 events', () => {
    const map = getEventsByDomain()
    expect(map['Maximal Strength']).toHaveLength(10)
  })

  it('every event appears in exactly one domain bucket', () => {
    const map = getEventsByDomain()
    const total = Object.values(map).reduce((sum, arr) => sum + arr.length, 0)
    expect(total).toBe(100)
  })

  it('domain buckets contain the correct event objects (spot-check Deadlift)', () => {
    const map = getEventsByDomain()
    const maxStr = map['Maximal Strength']
    expect(maxStr.some(e => e.slug === 'deadlift')).toBe(true)
  })
})


// ─── getBonusTargets ──────────────────────────────────────────────────────────

describe('getBonusTargets', () => {
  const deadlift = EVENTS.find(e => e.slug === 'deadlift')!
  const sprint100 = EVENTS.find(e => e.slug === '100m-sprint')!
  const lSitHold = EVENTS.find(e => e.slug === 'l-sit-hold')! // domain 3, hold, tiered → flex path
  const tennis = EVENTS.find(e => e.slug === 'tennis')!
  const chinupContest = EVENTS.find(e => e.slug === 'chin-up-contest')!

  it('sport events → 4 targets regardless of PR', () => {
    const targets = getBonusTargets(tennis, null)
    expect(targets).toHaveLength(4)
    expect(targets.every(t => t.inputMode === 'sport')).toBe(true)
    expect(targets.every(t => t.points === 15)).toBe(true)
    expect(targets.map(t => t.tier)).toEqual([1, 2, 3, 4])
  })

  it('non-sport event with null PR → []', () => {
    expect(getBonusTargets(deadlift, null)).toEqual([])
    expect(getBonusTargets(sprint100, null)).toEqual([])
    expect(getBonusTargets(lSitHold, null)).toEqual([])
  })

  it('strength event with valid PR → 4 weight targets', () => {
    const targets = getBonusTargets(deadlift, 100)
    expect(targets).toHaveLength(4)
    expect(targets[0].label).toBe('90kg × 3 reps')
    expect(targets[1].label).toBe('80kg × 5 reps')
    expect(targets[2].label).toBe('70kg × 8 reps')
    expect(targets[3].label).toBe('60kg × 12 reps')
    expect(targets.every(t => t.points === 15)).toBe(true)
    expect(targets.every(t => t.inputMode === 'strength')).toBe(true)
  })

  it('strength event with zero PR → []', () => {
    expect(getBonusTargets(deadlift, 0)).toEqual([])
  })

  it('strength event with NaN string PR → []', () => {
    expect(getBonusTargets(deadlift, 'bad')).toEqual([])
  })

  it('time/sprint event with valid PR → 4 efforts under time targets', () => {
    // raw_score for a sprint is stored negative; -6000 = 60 seconds
    const targets = getBonusTargets(sprint100, -6000)
    expect(targets).toHaveLength(4)
    expect(targets[0].tier).toBe(1)
    expect(targets[0].label).toContain('1 effort')
    expect(targets[1].label).toContain('2 efforts')
    expect(targets.every(t => t.points === 15)).toBe(true)
  })

  it('time/sprint event with NaN PR → []', () => {
    expect(getBonusTargets(sprint100, NaN)).toEqual([])
  })

  it('flex/tiered-hold event at D5 → 4 targets (hold D5 + 3x below)', () => {
    const targets = getBonusTargets(lSitHold, 'D5')
    expect(targets).toHaveLength(4)
    expect(targets[0].label).toBe('Hold D5 for 1 min')
    expect(targets[1].label).toBe('Hold D4 for 2 min')
    expect(targets[2].label).toBe('Hold D4 for 4 min')
    expect(targets[3].label).toBe('Hold D4 for 6 min')
  })

  it('flex/tiered-hold event at D1 → 1 target only (no tier below)', () => {
    const targets = getBonusTargets(lSitHold, 'D1')
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toBe('Hold D1 for 1 min')
  })

  it('flex/tiered-hold event with invalid PR string → []', () => {
    expect(getBonusTargets(lSitHold, 'invalid')).toEqual([])
    expect(getBonusTargets(lSitHold, '')).toEqual([])
  })

  it('reps-mode event with valid PR → [] (fallback, no bonus targets)', () => {
    // chin-up-contest is domain 3, reps mode, no difficulty tiers — hits fallback
    expect(getBonusTargets(chinupContest, 20)).toEqual([])
  })
})

// ─── tier-based score formula ─────────────────────────────────────────────────
// Mirrors computeScore tier path: tierIdx * 10000 + time_seconds

describe('tier-based score formula', () => {
  function tierScore(tierIdx: number, timeSeconds: number): number {
    return tierIdx * 10000 + timeSeconds
  }

  it('tier 0 with no time = 0', () => {
    expect(tierScore(0, 0)).toBe(0)
  })

  it('tier 1 with no time = 10000', () => {
    expect(tierScore(1, 0)).toBe(10000)
  })

  it('tier 0 with 30 seconds beats no score but loses to tier 1', () => {
    expect(tierScore(0, 30)).toBe(30)
    expect(tierScore(0, 30)).toBeLessThan(tierScore(1, 0))
  })

  it('higher tier always beats lower tier regardless of time (within 10000s)', () => {
    // Tier 1 at 0 secs (10000) > Tier 0 at 9999 secs (9999)
    expect(tierScore(1, 0)).toBeGreaterThan(tierScore(0, 9999))
  })

  it('within same tier, more time = higher score', () => {
    expect(tierScore(2, 60)).toBeGreaterThan(tierScore(2, 30))
  })
})
