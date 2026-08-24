import { describe, it, expect } from 'vitest'
import {
  PARTS,
  PART_POINTS,
  PARTS_PER_TANIWHA,
  CROWN_PART,
  BUILT_TANIWHA,
  TOTAL_TANIWHA,
  TOTAL_SLOTS,
  PEAK_POINTS,
  WIN_TARGET,
  EVENTS_PER_DOMAIN,
  WIN_MIN_FIELD,
  MAX_SESSION_POINTS,
  MAX_EFFORT_LEVEL,
  EFFORT_POINTS_PER_LEVEL,
  TANIWHA,
  WHANAU,
  KAHUI,
  DOMAIN_TANIWHA,
  partByNumber,
  taniwhaForDomain,
  taniwhaBySlug,
  slotAt,
  crownPoints,
  slotsReached,
  bodyPartBudget,
  crownCapacity,
  hasCrownRoom,
  TOTAL_BODY_PARTS,
  MAX_CROWNS,
  BODY_PARTS_PER_TANIWHA,
  nextSlot,
  progressToNextSlot,
  whanauCrownEarned,
  domainCrownEarned,
  kahuiEarned,
  winsToGo,
  guaranteedSessionPoints,
  hasEarnedDuringSession,
  isOnTrackDuringSession,
  rankLabel,
  taniwhaCardStyle,
  taniwhaOnDark,
  taniwhaChipStyle,
  partAssetSrc,
} from '@/lib/taniwha'
import { DOMAIN_COLORS } from '@/lib/domainColours'
import { EVENTS, DOMAIN_ORDER } from '@/lib/eventData'
import * as colours from '@/lib/colours'
import { readFileSync, readdirSync } from 'node:fs'

describe('shape', () => {
  it('has twelve taniwha: whānau, ten domains, te kāhui', () => {
    expect(TANIWHA).toHaveLength(TOTAL_TANIWHA)
    expect(TOTAL_TANIWHA).toBe(12)
    expect(DOMAIN_TANIWHA).toHaveLength(10)
    expect(TANIWHA[0]).toBe(WHANAU)
    expect(TANIWHA[TANIWHA.length - 1]).toBe(KAHUI)
  })

  it('builds eleven of them from ten parts each, and awards the twelfth', () => {
    expect(BUILT_TANIWHA).toBe(11)
    expect(PARTS).toHaveLength(PARTS_PER_TANIWHA)
    expect(TOTAL_SLOTS).toBe(110)
    // Te Kāhui is what holding all eleven looks like, not a twelfth build.
    expect(partAssetSrc(KAHUI, PARTS[0])).toBeNull()
  })

  it('lands the peak on 110,000', () => {
    expect(PEAK_POINTS).toBe(110_000)
    expect(crownPoints(BUILT_TANIWHA)).toBe(PEAK_POINTS)
  })

  it('numbers the parts 1..10 with the crown last', () => {
    expect(PARTS.map(p => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    expect(CROWN_PART).toBe(10)
    expect(PARTS[CROWN_PART - 1].english).toBe('crown')
    expect(partByNumber(1)?.name).toBe('Tinana')
    expect(partByNumber(11)).toBeNull()
  })

  it('gives every part and every taniwha a unique name and slug', () => {
    for (const list of [PARTS.map(p => p.name), PARTS.map(p => p.slug)]) {
      expect(new Set(list).size).toBe(PARTS.length)
    }
    expect(new Set(TANIWHA.map(t => t.name)).size).toBe(TOTAL_TANIWHA)
    expect(new Set(TANIWHA.map(t => t.slug)).size).toBe(TOTAL_TANIWHA)
  })
})

describe('domains', () => {
  it('covers all ten domain numbers, in canonical order', () => {
    expect(DOMAIN_TANIWHA.map(t => t.domainNumber)).toEqual([1,2,3,4,5,6,7,8,9,10])
    expect(DOMAIN_ORDER).toHaveLength(10)
  })

  it('takes its colours from the one palette, and they are all distinct', () => {
    for (const t of DOMAIN_TANIWHA) {
      expect(t.accent).toBe(DOMAIN_COLORS[(t.domainNumber as number) - 1])
    }
    expect(new Set(DOMAIN_TANIWHA.map(t => t.accent)).size).toBe(10)
  })

  it('only Pango inverts, and only whānau + kāhui wear the crest', () => {
    expect(DOMAIN_TANIWHA.filter(t => t.inverted).map(t => t.colourName)).toEqual(['Pango'])
    expect(TANIWHA.filter(t => t.crest).map(t => t.slug)).toEqual(['whanau', 'kahui'])
  })

  it('resolves by domain number and by slug', () => {
    expect(taniwhaForDomain(1)?.name).toBe('Te Taniwha ō te Kaha')
    expect(taniwhaForDomain(11)).toBeNull()
    expect(taniwhaBySlug('kahui')).toBe(KAHUI)
    expect(taniwhaBySlug('nope')).toBeNull()
  })

  it('assumes twelve events per domain, which the roster still holds', () => {
    // WIN_TARGET is 9 OF 12. If a domain ever holds a different number the
    // crown condition silently changes difficulty, so pin it here.
    expect(EVENTS_PER_DOMAIN).toBe(12)
    for (let d = 1; d <= 10; d++) {
      expect(EVENTS.filter(e => e.domainNumber === d)).toHaveLength(EVENTS_PER_DOMAIN)
    }
    expect(WIN_TARGET).toBeLessThan(EVENTS_PER_DOMAIN)
  })
})

describe('the points map', () => {
  it('costs a flat 1,000 per slot, including the first taniwha', () => {
    expect(PART_POINTS).toBe(1_000)
    expect(slotAt(1)).toMatchObject({ points: 1_000, isCrown: false })
    expect(slotAt(10)).toMatchObject({ points: 10_000, isCrown: true, crownOrdinal: 1 })
    expect(slotAt(11)).toMatchObject({ points: 11_000, isCrown: false })
  })

  it('puts every crown on a round ten thousand', () => {
    for (let i = 1; i <= MAX_CROWNS; i++) {
      expect(crownPoints(i)).toBe(i * 10_000)
    }
    expect(crownPoints(MAX_CROWNS)).toBe(PEAK_POINTS)
  })

  it('marks exactly eleven crown slots on the ladder, every tenth one', () => {
    const crowns: number[] = []
    for (let s = 1; s <= TOTAL_SLOTS; s++) {
      const slot = slotAt(s)
      expect(slot).not.toBeNull()
      expect(slot!.points).toBe(s * PART_POINTS)
      if (slot!.isCrown) crowns.push(slot!.crownOrdinal as number)
    }
    expect(crowns).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(slotAt(0)).toBeNull()
    expect(slotAt(TOTAL_SLOTS + 1)).toBeNull()
    expect(slotAt(1.5)).toBeNull()
  })

  it('splits the ladder into a body-part budget and a crown capacity', () => {
    // The whole point of the budget model: neither depends on which taniwha
    // the player chose, or on how often they switched.
    expect(bodyPartBudget(0)).toBe(0)
    expect(bodyPartBudget(9_000)).toBe(9)     // a full body, no crown yet
    expect(bodyPartBudget(10_000)).toBe(9)    // the 10,000th point buys the CROWN slot
    expect(bodyPartBudget(11_000)).toBe(10)   // next taniwha's first body part
    expect(bodyPartBudget(PEAK_POINTS)).toBe(TOTAL_BODY_PARTS)
    expect(TOTAL_BODY_PARTS).toBe(BUILT_TANIWHA * BODY_PARTS_PER_TANIWHA)
    expect(TOTAL_BODY_PARTS).toBe(99)

    expect(crownCapacity(9_999)).toBe(0)
    expect(crownCapacity(10_000)).toBe(1)
    expect(crownCapacity(PEAK_POINTS)).toBe(MAX_CROWNS)
    expect(crownCapacity(PEAK_POINTS * 2)).toBe(MAX_CROWNS)
  })

  it('accounts for every point: budget + capacity = slots reached', () => {
    for (let p = 0; p <= PEAK_POINTS; p += 500) {
      expect(bodyPartBudget(p) + crownCapacity(p)).toBe(slotsReached(p))
    }
  })

  it('opens crown room strictly by points', () => {
    expect(hasCrownRoom(10_000, 0)).toBe(true)
    expect(hasCrownRoom(10_000, 1)).toBe(false)
    expect(hasCrownRoom(19_999, 1)).toBe(false)
    expect(hasCrownRoom(20_000, 1)).toBe(true)
  })

  it('counts slots reached, and caps at the peak', () => {
    expect(slotsReached(0)).toBe(0)
    expect(slotsReached(999)).toBe(0)
    expect(slotsReached(1_000)).toBe(1)
    expect(slotsReached(10_500)).toBe(10)
    expect(slotsReached(PEAK_POINTS)).toBe(TOTAL_SLOTS)
    expect(slotsReached(PEAK_POINTS * 3)).toBe(TOTAL_SLOTS)
    expect(slotsReached(-5)).toBe(0)
    expect(slotsReached(NaN)).toBe(0)
  })

  it('reports the next slot and how far off it is', () => {
    expect(nextSlot(0)).toMatchObject({ slot: 1, isCrown: false, pointsToGo: 1_000 })
    expect(nextSlot(9_400)).toMatchObject({ isCrown: true, crownOrdinal: 1, pointsToGo: 600 })
    // Straight over a crown boundary: back to body parts.
    expect(nextSlot(10_000)).toMatchObject({ slot: 11, isCrown: false })
    expect(nextSlot(PEAK_POINTS)).toBeNull()
  })

  it('fills the progress bar between slots', () => {
    expect(progressToNextSlot(0)).toBe(0)
    expect(progressToNextSlot(500)).toBe(50)
    expect(progressToNextSlot(1_000)).toBe(0)
    expect(progressToNextSlot(PEAK_POINTS)).toBe(100)
  })
})

describe('invariants that must never quietly break', () => {
  // TANIWHA_SYSTEM_PLAN.md §3.2. The kaiwhakawā alert announces one thing at a
  // time, and the session-end takeover shows one new part. Both assume a single
  // session can never fill two slots.
  it('cannot fill two slots in one session', () => {
    expect(MAX_SESSION_POINTS).toBeLessThan(PART_POINTS)
    // The theoretical maximum for one session: 1st place plus effort at the
    // cap. NOT guaranteedSessionPoints + 100 — that floor already contains the
    // MINIMUM placement award, so adding a full 100 counts placement twice.
    const MAX_PLACEMENT = 100
    expect(MAX_PLACEMENT + MAX_EFFORT_LEVEL * EFFORT_POINTS_PER_LEVEL).toBe(MAX_SESSION_POINTS)
  })

  it('places exactly one part per 1,000 points, all the way up', () => {
    // The ladder has no gaps and no double steps, so total parts placed is
    // always floor(points / 1000) — the property the whole progress UI leans on.
    for (let p = 0; p <= PEAK_POINTS; p += 250) {
      expect(slotsReached(p)).toBe(Math.min(Math.floor(p / PART_POINTS), TOTAL_SLOTS))
    }
  })

  it('keeps the points economy in step with lib/colours.ts while both exist', () => {
    // These four move here when colours.ts is deleted. Until then they are
    // re-exported, so a drift is impossible — this asserts that stays true.
    expect(MAX_SESSION_POINTS).toBe(colours.MAX_SESSION_POINTS)
    expect(MAX_EFFORT_LEVEL).toBe(colours.MAX_EFFORT_LEVEL)
    expect(guaranteedSessionPoints(4)).toBe(colours.guaranteedSessionPoints(4))
  })
})

describe('crowns', () => {
  it('needs crown room AND a qualified referral for whānau', () => {
    expect(whanauCrownEarned(10_000, 0, 1)).toBe(true)
    expect(whanauCrownEarned(9_999, 0, 1)).toBe(false)   // no room yet
    expect(whanauCrownEarned(50_000, 0, 0)).toBe(false)  // no referral, ever
  })

  it('needs crown room AND 9 of 12 for a domain', () => {
    expect(domainCrownEarned(10_000, 0, 9)).toBe(true)
    expect(domainCrownEarned(10_000, 0, 8)).toBe(false)
    expect(domainCrownEarned(9_999, 0, 12)).toBe(false)
  })

  it('lets a domain be crowned BEFORE whānau, and charges the next threshold', () => {
    // 9 wins arrive before a referral does. The domain takes crown one at
    // 10,000; whānau then waits for crown two at 20,000. Crowns are fungible.
    expect(domainCrownEarned(10_000, 0, 9)).toBe(true)
    expect(whanauCrownEarned(10_000, 1, 1)).toBe(false)
    expect(whanauCrownEarned(20_000, 1, 1)).toBe(true)
  })

  it('parks a taniwha whose crown never comes, without blocking the next', () => {
    // 24,000 points with only 6 wins: no crown, but the budget keeps flowing —
    // 21 body parts earned, enough for two full bodies and a third started.
    const points = 24_000
    expect(domainCrownEarned(points, 0, 6)).toBe(false)
    expect(bodyPartBudget(points)).toBe(22)
    expect(crownCapacity(points)).toBe(2) // room reserved, unclaimed
  })

  it('awards te kāhui only for all eleven', () => {
    expect(kahuiEarned(PEAK_POINTS, 11)).toBe(true)
    expect(kahuiEarned(PEAK_POINTS, 10)).toBe(false)
    expect(kahuiEarned(PEAK_POINTS - 1, 11)).toBe(false)
  })

  it('counts the wins still to go', () => {
    expect(winsToGo(0)).toBe(WIN_TARGET)
    expect(winsToGo(9)).toBe(0)
    expect(winsToGo(12)).toBe(0)
    expect(WIN_MIN_FIELD).toBe(3)
  })
})

describe('live-session predicates', () => {
  it('guarantees the minimum placement plus banked effort, and nothing else', () => {
    expect(guaranteedSessionPoints(0)).toBe(10)
    expect(guaranteedSessionPoints(4)).toBe(30)
    expect(guaranteedSessionPoints(999)).toBe(guaranteedSessionPoints(MAX_EFFORT_LEVEL))
    expect(guaranteedSessionPoints(-3)).toBe(10)
  })

  it('only says "has earned" when it holds at the worst case', () => {
    // 9,975 + guaranteed 10 clears 10,000 whatever anyone else does.
    expect(hasEarnedDuringSession(9_975, 0, 10_000)).toBe(false)
    expect(hasEarnedDuringSession(9_990, 0, 10_000)).toBe(true)
    expect(hasEarnedDuringSession(9_900, 20, 10_000)).toBe(true)
  })

  it('lets "on track" lean on a provisional placement', () => {
    expect(isOnTrackDuringSession(9_900, 149, 10_000)).toBe(true)
    expect(isOnTrackDuringSession(9_900, 50, 10_000)).toBe(false)
  })
})

describe('rank and styling', () => {
  it('reads rank as crowned taniwha plus parts', () => {
    expect(rankLabel(0, 0)).toBe('0 taniwha')
    expect(rankLabel(4, 6)).toBe('4 taniwha, 6 parts')
    expect(rankLabel(1, 1)).toBe('1 taniwha, 1 part')
  })

  it('gives every taniwha a card, a chip and a legible name colour', () => {
    for (const t of TANIWHA) {
      const card = taniwhaCardStyle(t)
      expect(card.background ?? card.backgroundImage).toBeTruthy()
      expect(taniwhaChipStyle(t)).toBeTruthy()
      const ink = taniwhaOnDark(t)
      expect(ink.startsWith('#')).toBe(true) // never a gradient
    }
  })

  it('inverts pango rather than painting black on black', () => {
    const pango = taniwhaForDomain(10)!
    const card = taniwhaCardStyle(pango)
    expect(card.background).toBe('#F2F2F2')
    expect(card.color).toBe('#0a0a0a')
  })

  it('gives te kāhui a gradient edge, not a gradient border', () => {
    // CSS `border` cannot take a gradient and falls back silently.
    const card = taniwhaCardStyle(KAHUI)
    expect(card.border).toBe('2px solid transparent')
    expect(card.backgroundClip).toBe('padding-box, border-box')
  })

  it('points every part at a slug-named asset', () => {
    expect(partAssetSrc(WHANAU, PARTS[0])).toBe('/taniwha/whanau/tinana.png')
    expect(partAssetSrc(taniwhaForDomain(3)!, PARTS[9])).toBe('/taniwha/hiko/tikitiki.png')
  })
})


// ── The SQL mirrors ──────────────────────────────────────────────────────────
// Migration 20260824222612 has to duplicate two things that live in TypeScript,
// because the server must be able to award a crown without trusting the client:
// the event-to-domain roster, and the domain slugs. Duplication is how this
// codebase ended up with six disagreeing copies of the colour ladder, so both
// copies are pinned here. If you change the roster or a slug and this goes red,
// the migration is what needs updating — not this test.

const migrationSql = (() => {
  const dir = 'supabase/migrations'
  const f = readdirSync(dir).find(n => n.endsWith('_player_taniwha.sql'))
  if (!f) throw new Error('player_taniwha migration not found')
  return readFileSync(`${dir}/${f}`, 'utf8')
})()

describe('event_domains mirrors lib/eventData.ts', () => {
  const seeded = [...migrationSql.matchAll(/^ {2}\('(.+?)', (\d+), '(.+?)'\)/gm)]
    .map(m => ({ name: m[1], domainNumber: Number(m[2]), slug: m[3] }))

  it('seeds every event, and only real events', () => {
    expect(seeded).toHaveLength(EVENTS.length)
    expect(seeded).toHaveLength(120)
    expect(new Set(seeded.map(s => s.name)).size).toBe(seeded.length)
  })

  it('agrees with the roster on every event\'s domain and slug', () => {
    const byName = new Map(EVENTS.map(e => [e.name, e]))
    for (const s of seeded) {
      const e = byName.get(s.name)
      expect(e, `event_domains has "${s.name}", which is not in eventData`).toBeDefined()
      expect(e!.domainNumber, `domain for ${s.name}`).toBe(s.domainNumber)
      expect(e!.slug, `slug for ${s.name}`).toBe(s.slug)
    }
  })

  it('contains no apostrophes, which the seed does not escape', () => {
    for (const e of EVENTS) expect(e.name).not.toContain("'")
  })
})

describe('choose_taniwha slug list mirrors DOMAIN_TANIWHA', () => {
  it('maps every domain number to the same slug the module does', () => {
    const block = migrationSql.slice(migrationSql.indexOf('FUNCTION public.choose_taniwha'))
    const pairs = [...block.matchAll(/\((\d+),\s*'([a-z-]+)'\)/g)]
      .map(m => ({ n: Number(m[1]), slug: m[2] }))
      .filter(x => x.n >= 1 && x.n <= 10)
    expect(pairs).toHaveLength(10)
    for (const { n, slug } of pairs) {
      expect(taniwhaForDomain(n)?.slug, `domain ${n}`).toBe(slug)
    }
  })
})

describe('the migration keeps the ladder numbers it hardcodes', () => {
  it('uses the same budget arithmetic as bodyPartBudget/crownCapacity', () => {
    // SQL cannot import the module, so the constants are inlined there. These
    // are the exact literals the two IMMUTABLE functions carry.
    expect(migrationSql).toContain('/ 1000 - GREATEST(p_points, 0) / 10000')
    expect(migrationSql).toContain('99')
    expect(migrationSql).toContain('/ 10000, 11')
    expect(TOTAL_BODY_PARTS).toBe(99)
    expect(MAX_CROWNS).toBe(11)
  })

  it('caps body_parts at nine and requires nine for a crown', () => {
    expect(migrationSql).toContain('body_parts BETWEEN 0 AND 9')
    expect(migrationSql).toContain('pt.body_parts = 9')
    expect(BODY_PARTS_PER_TANIWHA).toBe(9)
    expect(WIN_TARGET).toBe(9)
  })
})
