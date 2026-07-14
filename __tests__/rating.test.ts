import { describe, it, expect } from 'vitest'
import {
  computeRatings, eloTo100, divisionPool, domainRatings, topEvent, topDomain,
  sessionWins, RATING_START,
} from '@/lib/rating'

const players = [
  { id: 'a', division: "Men's" },
  { id: 'b', division: 'Masters Men' },
  { id: 'c', division: "Women's" },
  { id: 'j', division: 'Juniors' },
]
const sessions = [
  { id: 's1', session_date: '2026-06-01' },
  { id: 's2', session_date: '2026-06-08' },
]
const sessionEvents = [
  { id: 'e1', session_id: 's1', event_name: 'Deadlift' },
  { id: 'e2', session_id: 's2', event_name: 'Deadlift' },
  { id: 'e3', session_id: 's2', event_name: 'Tennis' },
]

describe('divisionPool', () => {
  it('unifies masters/grandmasters into gender pools and treats Youth as Juniors', () => {
    expect(divisionPool("Men's")).toBe('men')
    expect(divisionPool('Grandmaster Men')).toBe('men')
    expect(divisionPool('Masters Women')).toBe('women')
    expect(divisionPool('Youth')).toBe('juniors')
    expect(divisionPool(null)).toBeNull()
  })
})

describe('eloTo100', () => {
  it('maps the starting rating to 50; 100 needs total dominance', () => {
    expect(eloTo100(RATING_START)).toBe(50)
    expect(eloTo100(RATING_START + 400)).toBe(91)
    expect(eloTo100(RATING_START + 800)).toBeLessThan(100)
    expect(eloTo100(RATING_START + 1200)).toBe(100)
    expect(eloTo100(RATING_START - 400)).toBe(9)
  })
})

describe('computeRatings', () => {
  it('winner gains, loser drops, same pool only', () => {
    const results = [
      { player_id: 'a', session_id: 's1', event_id: 'e1', raw_score: 180 },
      { player_id: 'b', session_id: 's1', event_id: 'e1', raw_score: 140 },
      { player_id: 'c', session_id: 's1', event_id: 'e1', raw_score: 200 }, // women's pool — no contest vs men
    ]
    const r = computeRatings(results, sessionEvents, sessions, players)
    const a = r.get('a')!.get('Deadlift')!
    const b = r.get('b')!.get('Deadlift')!
    const c = r.get('c')!.get('Deadlift')!
    expect(a.rating).toBeGreaterThan(RATING_START)
    expect(b.rating).toBeLessThan(RATING_START)
    expect(a.rating - RATING_START).toBeCloseTo(RATING_START - b.rating, 6)
    expect(c.rating).toBe(RATING_START) // solo in her pool: play counted, rating unmoved
    expect(c.plays).toBe(1)
  })

  it('uses the best submission per event and treats equal scores as a draw', () => {
    const results = [
      { player_id: 'a', session_id: 's1', event_id: 'e1', raw_score: 100 },
      { player_id: 'a', session_id: 's1', event_id: 'e1', raw_score: 140 }, // resubmission
      { player_id: 'b', session_id: 's1', event_id: 'e1', raw_score: 140 },
    ]
    const r = computeRatings(results, sessionEvents, sessions, players)
    expect(r.get('a')!.get('Deadlift')!.rating).toBeCloseTo(RATING_START, 6)
    expect(r.get('b')!.get('Deadlift')!.rating).toBeCloseTo(RATING_START, 6)
  })

  it('evolves across sessions: an upset moves ratings more than an expected win', () => {
    const results = [
      // s1: a beats b
      { player_id: 'a', session_id: 's1', event_id: 'e1', raw_score: 180 },
      { player_id: 'b', session_id: 's1', event_id: 'e1', raw_score: 140 },
      // s2: b beats a (upset)
      { player_id: 'a', session_id: 's2', event_id: 'e2', raw_score: 150 },
      { player_id: 'b', session_id: 's2', event_id: 'e2', raw_score: 160 },
    ]
    const r = computeRatings(results, sessionEvents, sessions, players)
    // After the upset, b overtakes a
    expect(r.get('b')!.get('Deadlift')!.rating).toBeGreaterThan(r.get('a')!.get('Deadlift')!.rating)
    expect(r.get('a')!.get('Deadlift')!.plays).toBe(2)
  })

  it('skips rows with no account or unknown division', () => {
    const results = [
      { player_id: null, session_id: 's1', event_id: 'e1', raw_score: 999 },
      { player_id: 'ghost', session_id: 's1', event_id: 'e1', raw_score: 999 },
      { player_id: 'a', session_id: 's1', event_id: 'e1', raw_score: 100 },
    ]
    const r = computeRatings(results, sessionEvents, sessions, players)
    expect(r.has('ghost')).toBe(false)
    expect(r.get('a')!.get('Deadlift')!.rating).toBe(RATING_START)
  })
})

describe('aggregations', () => {
  const eventDomain = new Map([['Deadlift', 1], ['Tennis', 9]])
  const domainNames = ['Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Anaerobic Endurance',
    'Aerobic Endurance', 'Flexibility', 'Body Awareness', 'Coordination', 'Aim & Precision']

  it('averages per domain and finds top event/domain', () => {
    const pr = new Map([
      ['Deadlift', { rating: 1700, plays: 3 }],
      ['Tennis', { rating: 1400, plays: 2 }],
    ])
    const dr = domainRatings(pr, eventDomain)
    expect(dr).toHaveLength(10)
    expect(dr[0].score).toBe(eloTo100(1700))
    expect(dr[8].score).toBe(eloTo100(1400))
    expect(dr[1].score).toBe(0) // unplayed domain

    expect(topEvent(pr)!.eventName).toBe('Deadlift')
    const td = topDomain(pr, eventDomain, domainNames)!
    expect(td.domainName).toBe('Maximal Strength')
  })

  it('handles empty ratings', () => {
    expect(topEvent(undefined)).toBeNull()
    expect(topDomain(new Map(), eventDomain, domainNames)).toBeNull()
    expect(domainRatings(undefined, eventDomain).every(d => d.score === 0)).toBe(true)
  })
})

describe('sessionWins', () => {
  it('counts each won session once, ignoring extra rows', () => {
    const rows = [
      { player_id: 'a', session_id: 's1', placement: 1 },
      { player_id: 'a', session_id: 's1', placement: 1 }, // second event row, same session
      { player_id: 'a', session_id: 's2', placement: 2 },
      { player_id: 'b', session_id: 's1', placement: 2 },
      { player_id: null, session_id: 's1', placement: 1 },
    ]
    const w = sessionWins(rows)
    expect(w.get('a')).toBe(1)
    expect(w.get('b')).toBeUndefined()
  })
})
