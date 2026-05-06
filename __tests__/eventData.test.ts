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
    expect(unique.size).toBe(100)
  })

  it('every event has a non-empty name', () => {
    for (const e of EVENTS) {
      expect(e.name.length).toBeGreaterThan(0)
    }
  })

  it('every event has a domainNumber between 1 and 10', () => {
    for (const e of EVENTS) {
      expect(e.domainNumber).toBeGreaterThanOrEqual(1)
      expect(e.domainNumber).toBeLessThanOrEqual(10)
    }
  })

  it('every event with hasDifficultyTiers=true has a non-empty difficultyTiers array', () => {
    const tiered = EVENTS.filter(e => e.hasDifficultyTiers)
    for (const e of tiered) {
      expect(e.difficultyTiers).toBeDefined()
      expect(e.difficultyTiers!.length).toBeGreaterThan(0)
    }
  })

  it('every event with hasDifficultyTiers=false has no difficultyTiers', () => {
    const flat = EVENTS.filter(e => !e.hasDifficultyTiers)
    for (const e of flat) {
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

  it('finds new domain 6 events by slug', () => {
    expect(getEventBySlug('running')).toBeDefined()
    expect(getEventBySlug('duck-walk')).toBeDefined()
    expect(getEventBySlug('breath-hold')).toBeDefined()
    expect(getEventBySlug('30-15-test')).toBeDefined()
  })

  it('returns undefined for old domain 6 slugs (replaced)', () => {
    expect(getEventBySlug('1k-run')).toBeUndefined()
    expect(getEventBySlug('bronco')).toBeUndefined()
    expect(getEventBySlug('200m-burpee-broad-jump')).toBeUndefined()
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

  it('finds 1A Press by exact name', () => {
    const e = getEventByName('1A Press')
    expect(e).toBeDefined()
    expect(e!.domainNumber).toBe(1)
  })

  it('finds Hand Walk (renamed from 50m Hand Walk)', () => {
    const e = getEventByName('Hand Walk')
    expect(e).toBeDefined()
    expect(e!.slug).toBe('hand-walk')
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

  it('Aerobic Endurance contains new domain 6 events', () => {
    const map = getEventsByDomain()
    const aerobic = map['Aerobic Endurance']
    const slugs = aerobic.map(e => e.slug)
    expect(slugs).toContain('running')
    expect(slugs).toContain('duck-walk')
    expect(slugs).toContain('breath-hold')
    expect(slugs).toContain('30-15-test')
    expect(slugs).not.toContain('1k-run')
    expect(slugs).not.toContain('bronco')
  })
})

// ─── effectiveScore helper (pure logic) ──────────────────────────────────────

describe('effectiveScore logic', () => {
  function effectiveScore(r: { raw_score: number; adjusted_score?: number | null }): number {
    return r.adjusted_score != null ? r.adjusted_score : r.raw_score
  }

  it('returns adjusted_score when set', () => {
    expect(effectiveScore({ raw_score: 1.0, adjusted_score: 1.2 })).toBe(1.2)
  })

  it('returns raw_score when adjusted_score is null', () => {
    expect(effectiveScore({ raw_score: 0.8, adjusted_score: null })).toBe(0.8)
  })

  it('returns raw_score when adjusted_score is undefined', () => {
    expect(effectiveScore({ raw_score: 0.5 })).toBe(0.5)
  })

  it('returns adjusted_score of 0 when explicitly set to 0', () => {
    expect(effectiveScore({ raw_score: 1.0, adjusted_score: 0 })).toBe(0)
  })
})

// ─── getBonusTargets ──────────────────────────────────────────────────────────

describe('getBonusTargets', () => {
  const deadlift = EVENTS.find(e => e.slug === 'deadlift')!
  const sprint100 = EVENTS.find(e => e.slug === '100m-sprint')!
  const lSitHold = EVENTS.find(e => e.slug === 'l-sit-hold')!
  const tennis = EVENTS.find(e => e.slug === 'tennis')!
  const chinupContest = EVENTS.find(e => e.slug === 'chin-up-contest')!

  it('sport events → 3 targets regardless of PR', () => {
    const targets = getBonusTargets(tennis, null)
    expect(targets).toHaveLength(3)
    expect(targets.every(t => t.inputMode === 'sport')).toBe(true)
    expect(targets.every(t => t.points === 15)).toBe(true)
    expect(targets.map(t => t.tier)).toEqual([1, 2, 3])
  })

  it('non-sport event with null PR → []', () => {
    expect(getBonusTargets(deadlift, null)).toEqual([])
    expect(getBonusTargets(sprint100, null)).toEqual([])
    expect(getBonusTargets(lSitHold, null)).toEqual([])
  })

  it('strength event with valid PR → 3 weight targets', () => {
    const targets = getBonusTargets(deadlift, 100)
    expect(targets).toHaveLength(3)
    expect(targets[0].label).toBe('90kg × 3 reps')
    expect(targets[1].label).toBe('80kg × 5 reps')
    expect(targets[2].label).toBe('70kg × 8 reps')
    expect(targets.every(t => t.points === 15)).toBe(true)
    expect(targets.every(t => t.inputMode === 'strength')).toBe(true)
  })

  it('strength event with zero PR → []', () => {
    expect(getBonusTargets(deadlift, 0)).toEqual([])
  })

  it('strength event with NaN string PR → []', () => {
    expect(getBonusTargets(deadlift, 'bad')).toEqual([])
  })

  it('time/sprint event with valid PR → 3 efforts under time targets', () => {
    // raw_score for a sprint is stored negative; -6000 cs = 60 seconds
    const targets = getBonusTargets(sprint100, -6000)
    expect(targets).toHaveLength(3)
    expect(targets[0].tier).toBe(1)
    expect(targets[0].label).toContain('1 effort')
    expect(targets[1].label).toContain('2 efforts')
    expect(targets.every(t => t.points === 15)).toBe(true)
  })

  it('time/sprint event with NaN PR → []', () => {
    expect(getBonusTargets(sprint100, NaN)).toEqual([])
  })

  it('difficulty+time event at D5 (raw_score=40060) → 3 targets', () => {
    // D5 = tierIdx 4 (0-based); 40000 + 60 secs = 40060
    const targets = getBonusTargets(lSitHold, 40060)
    expect(targets).toHaveLength(3)
    expect(targets[0].label).toBe('Hold D5 for 1 min')
    expect(targets[1].label).toBe('Hold D4 for 2 min')
    expect(targets[2].label).toBe('Hold D4 for 4 min')
  })

  it('difficulty+time event at D1 (raw_score=30) → 3 targets all at D1', () => {
    // D1 = tierIdx 0; 0 + 30 secs = 30
    const targets = getBonusTargets(lSitHold, 30)
    expect(targets).toHaveLength(3)
    expect(targets[0].label).toBe('Hold D1 for 1 min')
    expect(targets[1].label).toBe('Hold D1 for 2 min')
    expect(targets[2].label).toBe('Hold D1 for 4 min')
  })

  it('difficulty+reps event (chin-up-contest) with PR raw_score 20 → 3 rep targets at D1', () => {
    // chinupContest is difficulty+reps; raw_score 20 → tierIdx=0 (D1), prReps=20
    const targets = getBonusTargets(chinupContest, 20)
    expect(targets).toHaveLength(3)
    expect(targets[0].label).toBe('18 reps at D1')
    expect(targets[1].label).toBe('16 reps at D1')
    expect(targets[2].label).toBe('14 reps at D1')
  })
})

// ─── tier-based score formula ─────────────────────────────────────────────────

describe('tier-based score formula', () => {
  function tierScore(tierIdx: number, value: number): number {
    return tierIdx * 10000 + value
  }

  it('tier 0 with no value = 0', () => {
    expect(tierScore(0, 0)).toBe(0)
  })

  it('tier 1 with no value = 10000', () => {
    expect(tierScore(1, 0)).toBe(10000)
  })

  it('tier 0 with 30 beats zero but loses to tier 1 at 0', () => {
    expect(tierScore(0, 30)).toBe(30)
    expect(tierScore(0, 30)).toBeLessThan(tierScore(1, 0))
  })

  it('higher tier always beats lower tier regardless of value (within 10000)', () => {
    expect(tierScore(1, 0)).toBeGreaterThan(tierScore(0, 9999))
  })

  it('within same tier, higher value = higher score', () => {
    expect(tierScore(2, 60)).toBeGreaterThan(tierScore(2, 30))
  })
})
