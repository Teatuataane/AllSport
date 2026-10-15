import { describe, it, expect } from 'vitest'
import {
  ageGroup, canPair, pickOpponent, performanceRating, performanceExact, contestScores, swissStandings,
  SWISS_CONTESTS, type ContestPlayer, type Waiting,
} from '@/lib/swiss'
import { EVENTS } from '@/lib/eventData'
import type { MatchRow } from '@/lib/matches'

const p = (id: string, over: Partial<ContestPlayer> = {}): ContestPlayer =>
  ({ id, age: 30, division: "Men's", gender: 'Male', kg: 80, ...over })

describe('SWISS_CONTESTS', () => {
  it('names real one-on-one contest events', () => {
    for (const slug of Object.keys(SWISS_CONTESTS)) {
      const ev = EVENTS.find(e => e.slug === slug)
      expect(ev, slug).toBeDefined()
      expect(ev!.inputMode).toBe('sport')
    }
  })
})

describe('safety pairing', () => {
  it('groups ages U12, 12–15 and 16+', () => {
    expect([ageGroup(11), ageGroup(12), ageGroup(15), ageGroup(16), ageGroup(null)]).toEqual(['U12', '12-15', '12-15', '16+', '16+'])
  })
  it('contact: same age group, within 15% bodyweight, same sex', () => {
    expect(canPair(p('a'), p('b', { kg: 92 }), 'contact')).toBe(true)
    expect(canPair(p('a'), p('b', { kg: 93 }), 'contact')).toBe(false)
    expect(canPair(p('a'), p('b', { age: 15 }), 'contact')).toBe(false)
    expect(canPair(p('a'), p('b', { division: "Women's", gender: 'Female' }), 'contact')).toBe(false)
    expect(canPair(p('a'), p('b', { division: "Women's", gender: 'Female' }), 'contact', true)).toBe(true)
  })
  it('contact needs both bodyweights', () => {
    expect(canPair(p('a'), p('b', { kg: null }), 'contact')).toBe(false)
  })
  it('under 12s pair across sexes', () => {
    const boy = p('a', { age: 10, division: 'Juniors', gender: 'male', kg: 32 })
    const girl = p('b', { age: 11, division: 'Juniors', gender: 'female', kg: 34 })
    expect(canPair(boy, girl, 'contact')).toBe(true)
  })
  it('age-only and open events', () => {
    expect(canPair(p('a', { kg: null }), p('b', { kg: 200, gender: 'Female', division: "Women's" }), 'age')).toBe(true)
    expect(canPair(p('a', { age: 10 }), p('b'), 'age')).toBe(false)
    expect(canPair(p('a', { age: 10 }), p('b'), 'open')).toBe(true)
    expect(canPair(p('a'), p('a'), 'open')).toBe(false)
  })
})

describe('pickOpponent', () => {
  const w = (id: string, points: number, readyAt: string, over: Partial<ContestPlayer> = {}): Waiting =>
    ({ ...p(id, over), points, readyAt })
  it('picks the closest points, then the longest wait', () => {
    const me = { ...p('me'), points: 2 }
    const pick = pickOpponent(me, [w('x', 0, '10:00'), w('y', 2, '10:05'), w('z', 2, '10:01')], 'open')
    expect(pick?.id).toBe('z')
  })
  it('avoids a rematch while anyone else is free', () => {
    const me = { ...p('me'), points: 1 }
    const pick = pickOpponent(me, [w('x', 1, '10:00'), w('y', 0, '10:05')], 'open', { metToday: new Set(['x']) })
    expect(pick?.id).toBe('y')
    expect(pickOpponent(me, [w('x', 1, '10:00')], 'open', { metToday: new Set(['x']) })?.id).toBe('x')
  })
  it('waits when nobody is eligible', () => {
    expect(pickOpponent({ ...p('me'), points: 0 }, [w('x', 0, '10:00', { age: 10 })], 'contact')).toBeNull()
  })
})

describe('performance rating', () => {
  it('is average opponent plus 400 × (wins − losses) / games', () => {
    expect(performanceRating([])).toBeNull()
    expect(performanceRating([{ opponentRating: 1000, score: 1 }, { opponentRating: 1200, score: 1 }])).toBe(1500)
    expect(performanceRating([{ opponentRating: 1000, score: 1 }, { opponentRating: 1000, score: 0.5 }, { opponentRating: 1000, score: 0 }])).toBe(1000)
  })
  it('puts 1,100 at Poroporo, 1,600 at Taniwha, never below 4', () => {
    expect(performanceExact(1100)).toBe(7)
    expect(performanceExact(1150)).toBe(7.5)
    expect(performanceExact(1600)).toBe(12)
    expect(performanceExact(1900)).toBe(12)
    expect(performanceExact(1000)).toBe(6)
    expect(performanceExact(600)).toBe(4)
  })
  it('lets a newcomer who beats strong players reach Taniwha', () => {
    const perf = performanceRating([1200, 1250, 1150].map(r => ({ opponentRating: r, score: 1 })))!
    expect(performanceExact(perf)).toBe(12)
  })
})

const match = (id: string, session: string, a: string, b: string, outcome: MatchRow['outcome'], at: string, event = 'Wrestling'): MatchRow =>
  ({ id, session_id: session, event_name: event, outcome, created_at: at, players: [{ player_id: a, side: 'a' }, { player_id: b, side: 'b' }] })
// Both sides record each game: the second record is from the other side.
const both = (id: string, session: string, a: string, b: string, outcome: 'a' | 'b' | 'draw', at: string, event?: string) => [
  match(`${id}1`, session, a, b, outcome, at, event),
  match(`${id}2`, session, b, a, outcome === 'draw' ? 'draw' : outcome === 'a' ? 'b' : 'a', at.replace(/:00Z$/, ':30Z'), event),
]

describe('contestScores', () => {
  const swiss = new Set(['Wrestling'])
  it('scores a game on the performance rating, against ratings from before it', () => {
    const matches = [
      // An earlier game lifts B above 1,000.
      ...both('e', 's0', 'b', 'c', 'a', '2026-10-01T05:00:00Z'),
      ...both('g', 's1', 'a', 'b', 'a', '2026-10-08T05:00:00Z'),
    ]
    const s1 = contestScores(matches, swiss).get('s1')!.get('Wrestling')!
    // B was 1,020 before s1: A's performance is 1,420, 10.2; B's is 600, the floor.
    expect(s1.get('a')).toBe(10.2)
    expect(s1.get('b')).toBe(4)
  })
  it('ignores games only one side recorded, and non-Swiss events', () => {
    const matches = [match('x', 's1', 'a', 'b', 'a', '2026-10-08T05:00:00Z'), ...both('t', 's1', 'a', 'b', 'a', '2026-10-08T06:00:00Z', 'Tennis')]
    expect(contestScores(matches, swiss).get('s1')).toBeUndefined()
  })
  it('standings count points from confirmed games', () => {
    const matches = [
      ...both('1', 's1', 'a', 'b', 'a', '2026-10-08T05:00:00Z'),
      ...both('2', 's1', 'a', 'c', 'draw', '2026-10-08T05:10:00Z'),
    ]
    expect(swissStandings(matches, 's1', 'Wrestling')).toEqual([
      { playerId: 'a', points: 1.5, games: 2 },
      { playerId: 'c', points: 0.5, games: 1 },
      { playerId: 'b', points: 0, games: 1 },
    ])
  })
})
