import { describe, it, expect } from 'vitest'
import {
  computePercentiles, eventPctLabel, domainPctLabel,
  domainPercentiles, strongestEvent, weakestEvent, topDomain,
  type PctResultRow,
} from '@/lib/percentile'
import type { RatingEventRow, RatingPlayerRow } from '@/lib/rating'

// Four men in one pool, one woman (separate pool), one junior (separate pool).
const players: RatingPlayerRow[] = [
  { id: 'm1', division: "Men's" },
  { id: 'm2', division: 'Masters Men' },   // same pool as m1
  { id: 'm3', division: "Men's" },
  { id: 'm4', division: 'Grandmaster Men' },// same pool as m1
  { id: 'w1', division: "Women's" },
  { id: 'j1', division: 'Juniors' },
]

// Deadlift appears across two sessions (lifetime best = max over both).
const sessionEvents: RatingEventRow[] = [
  { id: 'e_dl_1', session_id: 's1', event_name: 'Deadlift' },
  { id: 'e_dl_2', session_id: 's2', event_name: 'Deadlift' },
  { id: 'e_press', session_id: 's1', event_name: '1A Press' }, // domain 1
  { id: 'e_tennis', session_id: 's2', event_name: 'Tennis' },  // domain 9
  { id: 'e_solo', session_id: 's1', event_name: 'Javelin' },   // only m1 does it
]

// Map only the canonical events under test.
const EVENT_DOMAIN = new Map<string, number>([
  ['Deadlift', 1], ['1A Press', 1], ['Tennis', 9], ['Javelin', 3],
])
const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) =>
  ['Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Anaerobic Endurance',
   'Aerobic Endurance', 'Flexibility', 'Body Awareness', 'Coordination', 'Aim & Precision'][i])

const results: PctResultRow[] = [
  // Deadlift men's pool best: m1=200, m2=180, m3=160, m4=160 (m3/m4 tie at bottom)
  { player_id: 'm1', session_id: 's1', event_id: 'e_dl_1', raw_score: 190 },
  { player_id: 'm1', session_id: 's2', event_id: 'e_dl_2', raw_score: 200 }, // lifetime best = 200
  { player_id: 'm2', session_id: 's1', event_id: 'e_dl_1', raw_score: 180 },
  { player_id: 'm3', session_id: 's2', event_id: 'e_dl_2', raw_score: 160 },
  { player_id: 'm4', session_id: 's2', event_id: 'e_dl_2', raw_score: 160 },
  // Tennis men's pool: m1 and m2 tie for top at 3
  { player_id: 'm1', session_id: 's2', event_id: 'e_tennis', raw_score: 3 },
  { player_id: 'm2', session_id: 's2', event_id: 'e_tennis', raw_score: 3 },
  { player_id: 'm3', session_id: 's2', event_id: 'e_tennis', raw_score: 1 },
  // Javelin: only m1 → solo field
  { player_id: 'm1', session_id: 's1', event_id: 'e_solo', raw_score: 50 },
  // 1A Press women's pool: w1 only in her pool → solo. Junior j1 alone in his pool.
  { player_id: 'w1', session_id: 's1', event_id: 'e_press', raw_score: 40 },
  { player_id: 'j1', session_id: 's1', event_id: 'e_press', raw_score: 30 },
  // rows with no score / no player should be ignored
  { player_id: null, session_id: 's1', event_id: 'e_dl_1', raw_score: 999 },
  { player_id: 'm3', session_id: 's1', event_id: 'e_dl_1', raw_score: null },
]

const pct = computePercentiles(results, sessionEvents, players)

describe('computePercentiles — Deadlift (4-man pool)', () => {
  it('sole leader shows 1st, beats the whole field', () => {
    const dl = pct.get('m1')!.get('Deadlift')!
    expect(dl.field).toBe(3)
    expect(dl.beatPct).toBe(100)
    expect(dl.isLeader).toBe(true)
    expect(dl.topPct).toBe(1)          // leaders contribute 1 to domain averages
    expect(eventPctLabel(dl)).toBe('1st')
  })

  it('second place: beats 2 of 3 → Top 33%', () => {
    const dl = pct.get('m2')!.get('Deadlift')!
    expect(dl.beatPct).toBeCloseTo(66.667, 2)
    expect(dl.isLeader).toBe(false)
    expect(dl.topPct).toBe(33)
    expect(eventPctLabel(dl)).toBe('Top 33%')
  })

  it('bottom two tie: each beats 0 → Top 100%, not leaders', () => {
    const m3 = pct.get('m3')!.get('Deadlift')!
    const m4 = pct.get('m4')!.get('Deadlift')!
    expect(m3.beatPct).toBe(0)
    expect(m3.isLeader).toBe(false)
    expect(m3.topPct).toBe(100)
    expect(eventPctLabel(m3)).toBe('Top 100%')
    expect(m4.topPct).toBe(100)
  })
})

describe('tie for the top → shared 1st (AllSport shared-placement rule)', () => {
  it('both tied-top players read as 1st, the loser gets Top 100%', () => {
    expect(eventPctLabel(pct.get('m1')!.get('Tennis')!)).toBe('1st')
    expect(eventPctLabel(pct.get('m2')!.get('Tennis')!)).toBe('1st')
    // m3 is last of 3, beats nobody
    const m3 = pct.get('m3')!.get('Tennis')!
    expect(m3.isLeader).toBe(false)
    expect(m3.topPct).toBe(100)
  })
})

describe('solo fields', () => {
  it('an event only one player in the pool has done shows No comparison yet', () => {
    const jav = pct.get('m1')!.get('Javelin')!
    expect(jav.field).toBe(0)
    expect(jav.beatPct).toBeNull()
    expect(jav.topPct).toBeNull()
    expect(eventPctLabel(jav)).toBe('No comparison yet')
  })

  it('players alone in their own division pool also get no comparison', () => {
    expect(eventPctLabel(pct.get('w1')!.get('1A Press')!)).toBe('No comparison yet')
    expect(eventPctLabel(pct.get('j1')!.get('1A Press')!)).toBe('No comparison yet')
  })
})

describe('labels for absent events', () => {
  it('an event the player never played is Not played', () => {
    expect(eventPctLabel(pct.get('m3')?.get('Javelin'))).toBe('Not played')
    expect(eventPctLabel(undefined)).toBe('Not played')
  })
})

describe('domainPercentiles', () => {
  it('averages played-event topPct within a domain, excluding solo events', () => {
    // m1: Deadlift (domain 1) topPct 1, Javelin (domain 3) is solo → excluded.
    const doms = domainPercentiles(pct.get('m1'), EVENT_DOMAIN)
    expect(doms[0].topPct).toBe(1)        // domain 1 = Deadlift only
    expect(doms[0].eventsRanked).toBe(1)
    expect(doms[2].topPct).toBeNull()     // domain 3 Javelin solo → nothing ranked
    expect(doms[2].eventsRanked).toBe(0)
  })

  it('m2 domain 1 averages Deadlift(33) → Top 33%; domain 9 Tennis(1) → 1st→1', () => {
    const doms = domainPercentiles(pct.get('m2'), EVENT_DOMAIN)
    expect(doms[0].topPct).toBe(33)       // just Deadlift
    expect(doms[8].topPct).toBe(1)        // Tennis, leader
  })

  it('domainPctLabel renders — for unranked domains', () => {
    const doms = domainPercentiles(pct.get('m1'), EVENT_DOMAIN)
    expect(domainPctLabel(doms[0])).toBe('Top 1%')
    expect(domainPctLabel(doms[2])).toBe('—')
    expect(domainPctLabel(undefined)).toBe('—')
  })
})

describe('strongest / weakest / topDomain', () => {
  it('m2 strongest = Tennis (leader), weakest = Deadlift', () => {
    expect(strongestEvent(pct.get('m2'), EVENT_DOMAIN)?.eventName).toBe('Tennis')
    expect(weakestEvent(pct.get('m2'), EVENT_DOMAIN)?.eventName).toBe('Deadlift')
  })

  it('solo events are never picked as strongest/weakest', () => {
    // m1: Deadlift (leader) and Tennis (leader) both eligible; Javelin solo excluded.
    const s = strongestEvent(pct.get('m1'), EVENT_DOMAIN)
    expect(s?.eventName === 'Deadlift' || s?.eventName === 'Tennis').toBe(true)
    expect(s?.eventName).not.toBe('Javelin')
  })

  it('topDomain picks the lowest domain topPct', () => {
    const td = topDomain(pct.get('m2'), EVENT_DOMAIN, DOMAIN_NAMES)
    expect(td?.domainNumber).toBe(9) // Tennis domain, topPct 1 beats Deadlift's 33
    expect(td?.domainName).toBe('Coordination')
    expect(td?.topPct).toBe(1)
  })

  it('returns null when the player has no ranked events', () => {
    expect(strongestEvent(pct.get('w1'), EVENT_DOMAIN)).toBeNull()
    expect(topDomain(pct.get('w1'), EVENT_DOMAIN, DOMAIN_NAMES)).toBeNull()
  })
})
