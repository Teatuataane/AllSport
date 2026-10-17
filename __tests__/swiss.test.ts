import { describe, it, expect } from 'vitest'
import {
  ageGroup, canPair, performanceRating, performanceExact, contestScores, contestTable, suggestNext, unbeaten, recordLabel,
  SWISS_CONTESTS, type ContestPlayer,
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
})

describe('who to play next', () => {
  const S = 's1', at = (m: number) => `2026-10-18T05:${String(m).padStart(2, '0')}:00Z`
  const now = new Date('2026-10-18T05:30:00Z')
  // Round 1: a beat b, c beat d, e beat f. Only one side recorded each.
  const round1 = [
    match('1', S, 'a', 'b', 'a', at(20)), match('2', S, 'c', 'd', 'a', at(21)), match('3', S, 'e', 'f', 'a', at(22)),
  ]
  const all = new Set(['a', 'b', 'c', 'd', 'e', 'f'])

  it('builds the day\'s table as soon as one side records', () => {
    const t = contestTable(round1, S, 'Wrestling')
    expect(t.get('a')).toMatchObject({ wins: 1, losses: 0, points: 1, games: 1 })
    expect(t.get('b')).toMatchObject({ wins: 0, losses: 1, points: 0 })
    expect([...t.get('a')!.met]).toEqual(['b'])
  })
  it('leaves out disputed games and other contests', () => {
    const t = contestTable([
      match('x1', S, 'a', 'b', 'a', at(20)), match('x2', S, 'b', 'a', 'a', at(21)),
      match('y', S, 'a', 'c', 'a', at(22), 'Fencing'),
    ], S, 'Wrestling')
    expect(t.size).toBe(0)
  })
  it('suggests nobody before the first match', () => {
    expect(suggestNext('z', contestTable(round1, S, 'Wrestling'), all, now)).toEqual([])
  })
  it('puts winners with winners and losers with losers', () => {
    const t = contestTable(round1, S, 'Wrestling')
    expect(suggestNext('a', t, all, now).map(r => r.playerId)).toEqual(['e', 'c', 'f'])
    expect(suggestNext('b', t, all, now).map(r => r.playerId)).toEqual(['f', 'd', 'e'])
  })
  it('skips anyone not safe to meet', () => {
    const t = contestTable(round1, S, 'Wrestling')
    expect(suggestNext('a', t, new Set(['b', 'd', 'f']), now).map(r => r.playerId)).toEqual(['f', 'd'])
  })
  it('avoids a rematch unless everyone safe has been met', () => {
    const t = contestTable(round1, S, 'Wrestling')
    expect(suggestNext('a', t, new Set(['b', 'c']), now).map(r => r.playerId)).toEqual(['c'])
    expect(suggestNext('a', t, new Set(['b']), now).map(r => r.playerId)).toEqual(['b'])
  })
  it('prefers someone seen recently', () => {
    const t = contestTable([...round1, match('4', S, 'g', 'h', 'a', '2026-10-18T04:30:00Z')], S, 'Wrestling')
    expect(suggestNext('a', t, new Set([...all, 'g', 'h']), now).map(r => r.playerId)).toEqual(['e', 'c', 'f'])
  })
  it('names the unbeaten, most wins first', () => {
    const t = contestTable([...round1, match('5', S, 'a', 'c', 'a', at(25)), match('6', S, 'e', 'b', 'draw', at(26))], S, 'Wrestling')
    expect(unbeaten(t).map(r => [r.playerId, recordLabel(r)])).toEqual([['a', '2–0'], ['e', '1–0–1']])
  })
})
