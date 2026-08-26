import { describe, it, expect } from 'vitest'
import {
  PARTS,
  PART_POINTS,
  PARTS_PER_TANIWHA,
  CROWN_PART,
  BUILT_TANIWHA,
  TOTAL_TANIWHA,
  PEAK_POINTS,
  WIN_TARGET,
  EVENTS_PER_DOMAIN,
  WIN_MIN_FIELD,
  MAX_SESSION_POINTS,
  MAX_EFFORT_LEVEL,
  EFFORT_POINTS_PER_LEVEL,
  MIN_PLACEMENT_POINTS,
  TANIWHA,
  WHANAU,
  KAHUI,
  DOMAIN_TANIWHA,
  partByNumber,
  partFor,
  IMPLEMENT_PART,
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
import { readFileSync, readdirSync } from 'node:fs'

describe('shape', () => {
  it('has twelve taniwha: whānau, ten domains, te kāhui', () => {
    expect(TANIWHA).toHaveLength(TOTAL_TANIWHA)
    expect(TOTAL_TANIWHA).toBe(12)
    expect(DOMAIN_TANIWHA).toHaveLength(10)
    expect(TANIWHA[0]).toBe(WHANAU)
    expect(TANIWHA[TANIWHA.length - 1]).toBe(KAHUI)
  })

  it('builds eleven of them from ten body parts and a crown', () => {
    expect(BUILT_TANIWHA).toBe(11)
    expect(PARTS).toHaveLength(PARTS_PER_TANIWHA)
    expect(PARTS_PER_TANIWHA).toBe(11)
    expect(BODY_PARTS_PER_TANIWHA).toBe(10)
    expect(TOTAL_BODY_PARTS).toBe(110)
    // Te Kāhui is what holding all eleven looks like, not a twelfth build.
    expect(partAssetSrc(KAHUI, PARTS[0])).toBeNull()
  })

  it('lands the peak on 110,000', () => {
    expect(PEAK_POINTS).toBe(110_000)
    expect(crownPoints(BUILT_TANIWHA)).toBe(PEAK_POINTS)
  })

  it('numbers the parts 1..11, implement tenth and crown last', () => {
    expect(PARTS.map(p => p.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
    expect(CROWN_PART).toBe(11)
    expect(IMPLEMENT_PART).toBe(10)
    expect(PARTS[CROWN_PART - 1].english).toBe('crown')
    expect(PARTS[IMPLEMENT_PART - 1].english).toBe('implement')
    expect(partByNumber(1)?.name).toBe('Pane')
    expect(partByNumber(12)).toBeNull()
  })

  it('merged neck into head — a neck was never worth an unlock on its own', () => {
    expect(PARTS.map(p => p.english)).not.toContain('neck')
  })

  it('leads with the head, so the first award already looks like a taniwha', () => {
    expect(partByNumber(1)?.english).toBe('head')
    expect(partByNumber(2)?.english).toBe('body')
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
  it('costs a flat 1,000 per part, including the first taniwha', () => {
    expect(PART_POINTS).toBe(1_000)
    expect(slotAt(1)).toMatchObject({ points: 1_000 })
    expect(slotAt(10)).toMatchObject({ points: 10_000 })
    expect(slotAt(TOTAL_BODY_PARTS)).toMatchObject({ points: PEAK_POINTS })
  })

  it('puts every crown on a round ten thousand', () => {
    for (let i = 1; i <= MAX_CROWNS; i++) {
      expect(crownPoints(i)).toBe(i * 10_000)
    }
    expect(crownPoints(MAX_CROWNS)).toBe(PEAK_POINTS)
  })

  it('prices every part on the ladder, and nothing outside it', () => {
    for (let s = 1; s <= TOTAL_BODY_PARTS; s++) {
      expect(slotAt(s)?.points).toBe(s * PART_POINTS)
    }
    expect(slotAt(0)).toBeNull()
    expect(slotAt(TOTAL_BODY_PARTS + 1)).toBeNull()
    expect(slotAt(1.5)).toBeNull()
  })

  it('splits the ladder into a body-part budget and a crown capacity', () => {
    // Neither depends on which taniwha the player chose, or how often they
    // switched. Crowns are a separate track and consume no part slot.
    expect(bodyPartBudget(0)).toBe(0)
    expect(bodyPartBudget(999)).toBe(0)
    expect(bodyPartBudget(10_000)).toBe(10)   // one full body
    expect(bodyPartBudget(PEAK_POINTS)).toBe(TOTAL_BODY_PARTS)
    expect(bodyPartBudget(PEAK_POINTS * 3)).toBe(TOTAL_BODY_PARTS)
    expect(TOTAL_BODY_PARTS).toBe(BUILT_TANIWHA * BODY_PARTS_PER_TANIWHA)
    expect(TOTAL_BODY_PARTS).toBe(110)

    expect(crownCapacity(9_999)).toBe(0)
    expect(crownCapacity(10_000)).toBe(1)
    expect(crownCapacity(PEAK_POINTS)).toBe(MAX_CROWNS)
    expect(crownCapacity(PEAK_POINTS * 2)).toBe(MAX_CROWNS)
  })

  it('gives one body part per 1,000 points, all the way up', () => {
    for (let p = 0; p <= PEAK_POINTS; p += 250) {
      expect(bodyPartBudget(p)).toBe(Math.min(Math.floor(p / PART_POINTS), TOTAL_BODY_PARTS))
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
    expect(slotsReached(PEAK_POINTS)).toBe(TOTAL_BODY_PARTS)
    expect(slotsReached(-5)).toBe(0)
    expect(slotsReached(NaN)).toBe(0)
  })

  it('reports the next slot and how far off it is', () => {
    expect(nextSlot(0)).toMatchObject({ slot: 1, pointsToGo: 1_000 })
    expect(nextSlot(9_400)).toMatchObject({ slot: 10, pointsToGo: 600 })
    expect(nextSlot(10_000)).toMatchObject({ slot: 11 })
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
    for (let p = 0; p <= PEAK_POINTS; p += 250) {
      expect(slotsReached(p)).toBe(Math.min(Math.floor(p / PART_POINTS), TOTAL_BODY_PARTS))
    }
  })

  it('owns the points economy, and it still matches the award trigger', () => {
    // These moved here from lib/colours.ts when the colour ladder was retired.
    // award_session_points() is the other half of this contract: 1st place is
    // 100, effort is level x 5 capped at level 20, and the minimum award is 10.
    // Change one and the other must change with it.
    expect(MIN_PLACEMENT_POINTS).toBe(10)
    expect(EFFORT_POINTS_PER_LEVEL).toBe(5)
    expect(MAX_EFFORT_LEVEL).toBe(20)
    expect(MAX_SESSION_POINTS).toBe(200)
    expect(guaranteedSessionPoints(MAX_EFFORT_LEVEL)).toBe(110)
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
    expect(bodyPartBudget(points)).toBe(24)
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
    expect(partAssetSrc(WHANAU, PARTS[0])).toBe('/taniwha/whanau/pane.png')
    expect(partAssetSrc(taniwhaForDomain(3)!, PARTS[CROWN_PART - 1])).toBe('/taniwha/hiko/tikitiki.png')
    // Part ten resolves to the taniwha's OWN implement, not a generic slug.
    expect(partAssetSrc(taniwhaForDomain(3)!, PARTS[IMPLEMENT_PART - 1])).toBe('/taniwha/hiko/javelin.png')
    expect(partAssetSrc(taniwhaForDomain(10)!, PARTS[IMPLEMENT_PART - 1])).toBe('/taniwha/tika/bow.png')
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

// The ladder arithmetic moved to its own migration when the parts were re-cut
// to ten. Read whichever file currently defines taniwha_body_budget.
const ladderSql = (() => {
  const dir = 'supabase/migrations'
  const f = readdirSync(dir).sort().reverse()
    .find(n => /function public\.taniwha_body_budget/i.test(readFileSync(`${dir}/${n}`, 'utf8')))
  if (!f) throw new Error('taniwha_body_budget migration not found')
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
    // SQL cannot import the module, so the constants are inlined there.
    // 20260825 re-cut the ladder to ten body parts, so the budget is a plain
    // floor(p/1000) — the crown no longer consumes a part slot.
    expect(ladderSql).toContain('/ 1000, 110')
    expect(ladderSql).toContain('/ 10000, 11')
    expect(TOTAL_BODY_PARTS).toBe(110)
    expect(MAX_CROWNS).toBe(11)
  })

  it('caps body_parts at ten and requires ten for a crown', () => {
    expect(ladderSql).toContain('body_parts BETWEEN 0 AND 10')
    expect(ladderSql).toContain('pt.body_parts = 10')
    expect(BODY_PARTS_PER_TANIWHA).toBe(10)
    expect(WIN_TARGET).toBe(9)
  })
})


describe('the implement — part ten', () => {
  it('gives every taniwha one, and no two domains share a slug', () => {
    for (const tw of TANIWHA) {
      expect(tw.implement.name.length).toBeGreaterThan(0)
      expect(tw.implement.slug).toMatch(/^[a-z-]+$/)
      expect(tw.implement.from.length).toBeGreaterThan(0)
    }
    const domainSlugs = DOMAIN_TANIWHA.map(t => t.implement.slug)
    expect(new Set(domainSlugs).size).toBe(10)
  })

  it('names it per taniwha, never the generic placeholder', () => {
    // partByNumber(10) is a stand-in that must never reach a player.
    expect(partByNumber(IMPLEMENT_PART)?.name).toBe('Taputapu')
    expect(partFor(taniwhaForDomain(1)!, IMPLEMENT_PART)?.english).toBe('barbell')
    expect(partFor(taniwhaForDomain(10)!, IMPLEMENT_PART)?.english).toBe('bow')
    expect(partFor(WHANAU, IMPLEMENT_PART)?.english).toBe('many hands')
    expect(partFor(KAHUI, IMPLEMENT_PART)?.english).toBe('the other eleven')
  })

  it('leaves every other part identical across taniwha', () => {
    for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, CROWN_PART]) {
      expect(partFor(taniwhaForDomain(1)!, n)).toEqual(partByNumber(n))
      expect(partFor(KAHUI, n)).toEqual(partByNumber(n))
    }
  })

  it('draws each implement from a real event in its own domain', () => {
    // The two domains with no obvious equipment are the point of this test:
    // Speed and Flexibility get theirs from Beach Flags and the split block.
    expect(taniwhaForDomain(4)!.implement.from).toMatch(/Flags/)
    expect(taniwhaForDomain(7)!.implement.from).toMatch(/Split/)
    for (const tw of DOMAIN_TANIWHA) {
      const domainEvents = EVENTS.filter(e => e.domainNumber === tw.domainNumber)
      const named = tw.implement.from.split(/,\s*/)
      const real = named.filter(n => domainEvents.some(e => e.name === n))
      expect(real.length, `${tw.name}: "${tw.implement.from}" names no event in domain ${tw.domainNumber}`)
        .toBeGreaterThan(0)
    }
  })
})

describe('the art checker mirrors the ladder', () => {
  // scripts/check-taniwha-art.mjs cannot import a TS module, so it carries its
  // own copy of the part slugs and the implement map. That is the same
  // duplication the SQL guards above exist for: if the ladder changes and the
  // checker does not, it will happily pass an export that is missing a piece.
  const checker = readFileSync('scripts/check-taniwha-art.mjs', 'utf8')

  const arrayIn = (name: string) => {
    const m = checker.match(new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`))
    if (!m) throw new Error(`${name} not found in check-taniwha-art.mjs`)
    return [...m[1].matchAll(/'([a-z-]+)'/g)].map(x => x[1])
  }

  it('lists the nine body slugs, in assembly order', () => {
    // The tenth body part is the implement and is resolved per taniwha, so the
    // checker's BODY array stops at nine.
    const expected = PARTS.slice(0, IMPLEMENT_PART - 1).map(p => p.slug)
    expect(arrayIn('BODY')).toEqual(expected)
    expect(expected[0]).toBe('pane')
  })

  it('maps every taniwha to its own implement slug', () => {
    const block = checker.slice(checker.indexOf('const IMPLEMENTS'))
    for (const tw of TANIWHA) {
      const re = new RegExp(`['"]?${tw.slug}['"]?\\s*:\\s*'${tw.implement.slug}'`)
      expect(re.test(block), `${tw.slug} -> ${tw.implement.slug} missing from IMPLEMENTS`).toBe(true)
    }
  })

  it('knows the crown, and every taniwha accent', () => {
    expect(checker).toContain("'tikitiki'")
    const block = checker.slice(checker.indexOf('const ACCENT'))
    for (const tw of TANIWHA) {
      expect(new RegExp(`['"]?${tw.slug}['"]?\\s*:`).test(block), `${tw.slug} missing from ACCENT`).toBe(true)
    }
  })
})
