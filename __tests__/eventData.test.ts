import { describe, it, expect } from 'vitest'
import {
  EVENTS,
  DOMAIN_ORDER,
  getEventBySlug,
  getEventByName,
  getEventsByDomain,
  getBonusTargets,
  isTimedEffort,
  TIMED_EFFORT_SLUGS,
  encodeDiffTime,
  decodeDiffTime,
} from '@/lib/eventData'

// ─── EVENTS array integrity ───────────────────────────────────────────────────

describe('EVENTS array', () => {
  it('contains exactly 120 events', () => {
    expect(EVENTS).toHaveLength(120)
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
    expect(getEventBySlug('animal-crawl')).toBeDefined()
    // Duck Walk was REPLACED, not renamed — its slug must not resolve.
    expect(getEventBySlug('duck-walk')).toBeUndefined()
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

  // ─── Aug 2026 roster update (120 events) ───────────────────────────────────
  // Renames keep their slug so historical results stay linked.
  it.each([
    ['Pause Back Squat', 'pause-squat'],
    ['Pause Chinup', 'pause-chin-up'],
    ['Turkish Getup', 'turkish-get-up'],
    ['Human Flag', 'flag'],
    ['Finger Pushup', 'finger-push-up'],
    ['Hamstring Curl', 'hamstring-curl'],
    ['Foot Behind Head Pose', 'foot-behind-head'],
    ['Leg Ext Hold', 'leg-extension'],
  ])('renamed %s keeps slug %s', (name, slug) => {
    const e = getEventByName(name)
    expect(e).toBeDefined()
    expect(e!.slug).toBe(slug)
  })

  it.each([
    ['Headstand', 'Calisthenics', 2],
    ['L-Sit Hold', 'Calisthenics', 2],
    ['Toe Lift', 'Anaerobic Endurance', 5],
    ['American Football', 'Speed', 4],
  ])('moved %s now sits in %s', (name, domain, domainNumber) => {
    const e = getEventByName(name)
    expect(e).toBeDefined()
    expect(e!.domain).toBe(domain)
    expect(e!.domainNumber).toBe(domainNumber)
  })

  it.each([
    'Arm Wrestling', 'Tug of War', 'Capture the Flag', 'Kabaddi',
    'Wheelbarrow Push', 'Wheelbarrow Pull', 'Kubb',
  ])('new event %s is defined with real content', (name) => {
    const e = getEventByName(name)
    expect(e).toBeDefined()
    expect(e!.howToPerform).not.toContain('coming soon')
    expect(e!.rules).not.toContain('coming soon')
  })

  it.each([
    'Reverse Hyper', 'Triple Jump', '400m Race', '50m Sprint',
    'Football Dribble', 'Hockey Dribble', 'Walking', 'Backwards Walk', 'Airsoft',
    // Replaced by Lunges, August 2026. A different movement, so its history is
    // deliberately NOT swept onto the new slug — see the Lunges test below.
    'Toe Squat',
  ])('removed event %s is gone from the roster', (name) => {
    expect(getEventByName(name)).toBeUndefined()
  })

  it('Lunges replaced Toe Squat without inheriting its slug', () => {
    const e = getEventByName('Lunges')!
    expect(e.slug).toBe('lunges')
    // The whole point: a squat on your toes and a lunge are different
    // movements, so reusing `toe-balance` would credit every Toe Squat score
    // ever set to a lift nobody did. Same rule that kept OHP off Clean & Press.
    expect(e.slug).not.toBe('toe-balance')
    expect(e.domain).toBe('Anaerobic Endurance')
    expect(e.domainNumber).toBe(5)
    expect(e.inputMode).toBe('difficulty+reps')
    // Gained a 5th rung (Jumping Bulgarian) in the Sept 2026 difficulty review.
    expect(e.difficultyTiers).toHaveLength(5)
    expect(e.howToPerform).not.toContain('coming soon')
    expect(e.rules).not.toContain('coming soon')
  })

  it('Leg Ext Hold is a loaded hold with no ladder', () => {
    // The Sept 2026 difficulty review removed the load ladder: the weight IS the
    // difficulty, so it is entered rather than picked. Heavier wins, hold time
    // breaks the tie.
    const e = getEventByName('Leg Ext Hold')!
    expect(e.inputMode).toBe('weight+time')
    expect(e.hasDifficultyTiers).toBe(false)
    expect(e.difficultyTiers).toBeUndefined()
    expect(isTimedEffort(e.slug)).toBe(false)
  })

  it('wheelbarrow events extend Weighted Carry and rank fastest-first', () => {
    const carry = getEventByName('Weighted Carry')!
    for (const name of ['Wheelbarrow Push', 'Wheelbarrow Pull']) {
      const e = getEventByName(name)!
      // The Sept 2026 review added a 200kg rung to both wheelbarrows and not to
      // Weighted Carry, so they share a prefix rather than the whole ladder.
      const names = e.difficultyTiers!.map(t => t.name)
      expect(names.slice(0, carry.difficultyTiers!.length))
        .toEqual(carry.difficultyTiers!.map(t => t.name))
      expect(names.at(-1)).toBe('200kg — 200m')
      expect(isTimedEffort(e.slug)).toBe(true)
    }
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

  it('every domain holds exactly 12 events', () => {
    const map = getEventsByDomain()
    for (const [domain, events] of Object.entries(map)) {
      expect(events.length, `${domain} should have 12 events`).toBe(12)
    }
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
    expect(slugs).toContain('animal-crawl')
    expect(slugs).not.toContain('duck-walk')
    expect(slugs).toContain('breath-hold')
    expect(slugs).toContain('bronco')
    expect(slugs).toContain('wheelbarrow-push')
    expect(slugs).toContain('wheelbarrow-pull')
    expect(slugs).not.toContain('1k-run')
    expect(slugs).not.toContain('sprint-repeats')
    expect(slugs).not.toContain('30-15-test')
    // Retired Aug 2026 — still in TIMED_EFFORT_SLUGS for historical decode
    expect(slugs).not.toContain('walking')
    expect(slugs).not.toContain('backwards-walk')
  })

  // Guards a deliberate decision that reads like dead config: 'walking' and
  // 'backwards-walk' are retired events kept in TIMED_EFFORT_SLUGS on purpose.
  // Their historical raw_scores are inverted-encoded, so dropping them would
  // make every archived Walking row decode backwards (a 4:00 reading as 2:40)
  // wherever a past session is rendered.
  it.each(['walking', 'backwards-walk'])(
    'retired event %s still decodes as a timed effort',
    (slug) => {
      expect(getEventBySlug(slug)).toBeUndefined() // gone from the roster
      expect(isTimedEffort(slug)).toBe(true)       // but still decodes correctly

      const raw = encodeDiffTime(1, 240, true)
      expect(decodeDiffTime(raw, isTimedEffort(slug)).secs).toBe(240)
    }
  )
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
    // Tennis became difficulty+reps in the Sept 2026 review (drill ladder topped
    // by a Game rung). Tag is one of the events that kept plain win/draw/loss.
    const tag = EVENTS.find(e => e.slug === 'tag')!
    expect(tag.inputMode).toBe('sport')
    const targets = getBonusTargets(tag, null)
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('sport')
    expect(targets[0].points).toBe(5)
  })

  it('the score and sprint branches still work, though no event uses them now', () => {
    // The Sept 2026 review moved Golf and Disc Golf onto a putt ladder and both
    // sprints onto a distance ladder, so nothing on the roster is `score` or
    // `sprint` any more. The branches stay because historical sessions still
    // render rows written under those modes.
    expect(EVENTS.filter(e => e.inputMode === 'score')).toHaveLength(0)
    expect(EVENTS.filter(e => e.inputMode === 'sprint')).toHaveLength(0)

    const asScore = { ...golf, inputMode: 'score' as const }
    const scoreTargets = getBonusTargets(asScore, null)
    expect(scoreTargets).toHaveLength(1)
    expect(scoreTargets[0].label).toBe('Complete an additional 4 holes')

    const asSprint = { ...sprint100, inputMode: 'sprint' as const }
    const sprintTargets = getBonusTargets(asSprint, -6000)
    expect(sprintTargets).toHaveLength(1)
    expect(sprintTargets[0].inputMode).toBe('sprint')
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

  it('100m Sprint is now a distance ladder, timed fastest-first', () => {
    expect(sprint100.inputMode).toBe('difficulty+time')
    expect(isTimedEffort(sprint100.slug)).toBe(true)
    // D1 (20m) at 4s → raw = 0*10000 + (10000 - 4)
    const targets = getBonusTargets(sprint100, 9996)
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('difficulty+time')
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
    expect(targets[0].label).toBe('16 reps at High Ring Row')
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

// ─── TIMED_EFFORT_SLUGS integrity ─────────────────────────────────────────────
// The set is keyed on SLUG, and an entry matching no event does nothing at all:
// no error, no warning. That is how 'climbing' sat there for three months while
// the event's slug was 'rope-climb', ranking a race as a hold. This is the test
// that would have caught it.

describe('TIMED_EFFORT_SLUGS', () => {
  // Retired events kept on purpose: their historical raw_scores are
  // inverted-encoded, so decodeDiffTime must keep reading them as timed efforts
  // wherever an old session is rendered.
  const RETIRED = new Set(['walking', 'backwards-walk', 'duck-walk'])

  it('every entry either names a real event or is a declared retired slug', () => {
    for (const slug of TIMED_EFFORT_SLUGS) {
      if (RETIRED.has(slug)) {
        expect(getEventBySlug(slug), `${slug} is on the retired list but still on the roster`).toBeUndefined()
        continue
      }
      expect(getEventBySlug(slug), `TIMED_EFFORT_SLUGS has "${slug}", which matches no event`).toBeDefined()
    }
  })

  it('every live entry is a difficulty+time event', () => {
    for (const slug of TIMED_EFFORT_SLUGS) {
      const e = getEventBySlug(slug)
      if (!e) continue
      expect(e.inputMode, `${slug} is a timed effort but scored as ${e.inputMode}`).toBe('difficulty+time')
    }
  })

  it('Climbing is a timed effort under its real slug', () => {
    const climbing = getEventByName('Climbing')!
    expect(climbing.slug).toBe('rope-climb')
    expect(isTimedEffort(climbing.slug)).toBe(true)
    expect(isTimedEffort('climbing')).toBe(false)
  })
})

// ─── Judge prose must not name a level that does not exist ────────────────────
describe('howToPerform / rules stay in step with the ladder', () => {
  it('never names a level that disagrees with the ladder at that position', () => {
    // Catches the drift a range check misses: "D4 (GHD Situp) is scored by added
    // weight" stayed put while the review moved the weighted rung to D5, so a
    // judge following the rules would score the wrong movement.
    const bad: string[] = []
    for (const e of EVENTS) {
      const tiers = e.difficultyTiers ?? []
      for (const field of ['howToPerform', 'rules'] as const) {
        for (const m of (e[field] ?? '').matchAll(/\bD(\d+) \(([^)]+)\)/g)) {
          const at = tiers[Number(m[1]) - 1]
          if (at && at.name !== m[2]) bad.push(`${e.name}.${field}: "D${m[1]} (${m[2]})" but D${m[1]} is "${at.name}"`)
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })

  it('never references a D-number past the end of its own ladder', () => {
    const bad: string[] = []
    for (const e of EVENTS) {
      const highest = e.difficultyTiers?.length ?? 0
      for (const field of ['howToPerform', 'rules'] as const) {
        for (const m of (e[field] ?? '').matchAll(/\bD(\d+)\b/g)) {
          const n = Number(m[1])
          if (n < 1 || n > highest) bad.push(`${e.name}.${field} names D${n} (ladder has ${highest})`)
        }
      }
    }
    expect(bad, bad.join('\n')).toEqual([])
  })
})

// ─── getBonusTargets on the rungs that are not scored by reps ─────────────────
// The within-tier term is only a rep count on an ordinary rung. Reading it as
// reps on a weight rung produced "1600 reps at Weighted RTO Dip".

describe('getBonusTargets: rungs with their own scoring', () => {
  it('a weight-rung PR becomes a load target, not a rep target', () => {
    const ev = getEventBySlug('pause-dips')!
    const idx = ev.difficultyTiers!.findIndex(t => t.scoring === 'weight')
    const targets = getBonusTargets(ev, idx * 10000 + 2000) // 20kg
    expect(targets).toHaveLength(1)
    expect(targets[0].label).toBe(`16kg at ${ev.difficultyTiers![idx].name}`)
    expect(targets[0].label).not.toMatch(/reps/)
  })

  it('a Game-rung PR becomes a play-again target, not a 2-rep target', () => {
    const ev = getEventBySlug('volleyball')!
    const idx = ev.difficultyTiers!.findIndex(t => t.scoring === 'sport')
    const targets = getBonusTargets(ev, idx * 10000 + 2) // a win
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('sport')
    expect(targets[0].label).not.toBe('2 reps at Game')
  })

  it('difficulty+distance targets 80% of the PR throw on the same implement', () => {
    const ev = getEventBySlug('javelin-throw')!
    const targets = getBonusTargets(ev, 2 * 10000 + 314) // D3, 31.4m
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('difficulty+distance')
    expect(targets[0].label).toContain('25.1m')
    expect(targets[0].label).toContain(ev.difficultyTiers![2].name)
    expect(getBonusTargets(ev, 0)).toEqual([])
    expect(getBonusTargets(ev, null)).toEqual([])
  })

  it('weight+time targets 80% of both the load and the hold', () => {
    const ev = getEventBySlug('leg-extension')!
    const targets = getBonusTargets(ev, 1200 * 10000 + 100) // 12kg, 100s
    expect(targets).toHaveLength(1)
    expect(targets[0].inputMode).toBe('weight+time')
    expect(targets[0].label).toContain('9.6kg')
    expect(getBonusTargets(ev, null)).toEqual([])
  })
})
