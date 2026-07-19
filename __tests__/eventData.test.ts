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
  it('contains exactly 122 events', () => {
    expect(EVENTS).toHaveLength(122)
  })

  it('every event has a unique slug', () => {
    const slugs = EVENTS.map(e => e.slug)
    const unique = new Set(slugs)
    expect(unique.size).toBe(EVENTS.length)
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
    expect(getEventBySlug('bronco')).toBeDefined()
  })

  it('returns undefined for old domain 6 slugs (replaced)', () => {
    expect(getEventBySlug('1k-run')).toBeUndefined()
    expect(getEventBySlug('sprint-repeats')).toBeUndefined()
    expect(getEventBySlug('30-15-test')).toBeUndefined()
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

  it('finds Handstand (slug still hand-walk after rename from Handbalance)', () => {
    const e = getEventByName('Handstand')
    expect(e).toBeDefined()
    expect(e!.slug).toBe('hand-walk')
    expect(e!.domain).toBe('Calisthenics')
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

  it('Maximal Strength has 12 events', () => {
    const map = getEventsByDomain()
    expect(map['Maximal Strength']).toHaveLength(12)
  })

  it('every event appears in exactly one domain bucket', () => {
    const map = getEventsByDomain()
    const total = Object.values(map).reduce((sum, arr) => sum + arr.length, 0)
    expect(total).toBe(EVENTS.length)
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
    expect(slugs).toContain('bronco')
    expect(slugs).toContain('walking')
    expect(slugs).not.toContain('1k-run')
    expect(slugs).not.toContain('sprint-repeats')
    expect(slugs).not.toContain('30-15-test')
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
  const golf = EVENTS.find(e => e.slug === 'golf')!
  const running = EVENTS.find(e => e.slug === 'running')!

  it('sport events → 1 target regardless of PR', () => {
    const targets = getBonusTargets(tennis, null)
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('sport')
    expect(targets[0].points).toBe(5)
  })

  it('score events (Golf) → 1 target regardless of PR', () => {
    const targets = getBonusTargets(golf, null)
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toBe('Complete an additional 4 holes')
    expect(targets[0].points).toBe(5)
  })

  it('non-sport/non-score event with null PR → []', () => {
    expect(getBonusTargets(deadlift, null)).toEqual([])
    expect(getBonusTargets(sprint100, null)).toEqual([])
    expect(getBonusTargets(lSitHold, null)).toEqual([])
  })

  it('strength event with valid PR → 1 weight target at 80%×5', () => {
    const targets = getBonusTargets(deadlift, 100)
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toBe('80kg × 5 reps')
    expect(targets[0].points).toBe(5)
    expect(targets[0].inputMode).toBe('strength')
  })

  it('strength event with zero PR → []', () => {
    expect(getBonusTargets(deadlift, 0)).toEqual([])
  })

  it('sprint event with valid PR → 1 time target', () => {
    const targets = getBonusTargets(sprint100, -6000)
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('sprint')
    expect(targets[0].points).toBe(5)
  })

  it('difficulty+time event at D5 (raw_score=40060) → 1 hold target at D4', () => {
    // D5 = tierIdx 4 (0-based); L-Sit Hold is non-D6
    const targets = getBonusTargets(lSitHold, 40060)
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('difficulty+time')
    expect(targets[0].points).toBe(5)
  })

  it('difficulty+time event at D1 (raw_score=30) → 1 hold target at D1', () => {
    const targets = getBonusTargets(lSitHold, 30)
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toContain('2 min')
    expect(targets[0].points).toBe(5)
  })

  it('difficulty+reps event (chin-up-contest) with PR raw_score 20 → 1 rep target', () => {
    // D1, 20 reps → 80% = 16 reps
    const targets = getBonusTargets(chinupContest, 20)
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toBe('16 reps at Ring Row')
    expect(targets[0].points).toBe(5)
  })

  it('D6 difficulty+time at D3 → target uses half distance (tier below)', () => {
    // Running D3 (1000m) at 180s → raw = 2*10000 + 180 = 20180
    const targets = getBonusTargets(running, 20180)
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toContain('500m')
    expect(targets[0].points).toBe(5)
  })

  it('D6 difficulty+time at D1 → target uses same distance, 1.2x time', () => {
    // Running D1 (250m) at 60s → raw = 0*10000 + 60 = 60
    const targets = getBonusTargets(running, 60)
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toContain('250m')
    expect(targets[0].points).toBe(5)
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
