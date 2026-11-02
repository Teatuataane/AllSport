import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { handicapPoints, WOMEN_CONTEST_COLOURS, contestProfilesOf, type ContestProfile } from '@/lib/contestHandicap'
import { rateGames, workingRatings } from '@/lib/headToHead'
import { bestPerformanceExact, performanceExact, performanceRating, CONTEST_FLOOR } from '@/lib/swiss'
import { computePlayerGrades } from '@/lib/playerGrades'
import { EVENTS, getEventBySlug } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'
import { RATING_START, RATING_STEP } from '@/lib/grading'
import type { MatchRow } from '@/lib/matches'

// Tāne, 3 Nov 2026: losses are not punished, and a player who beats someone they
// "shouldn't" (a child an adult, a woman a man, the old the young) earns a bonus.

const YEAR = 2026
const boy10: ContestProfile = { division: 'Juniors', birth_year: 2016 }
const man30: ContestProfile = { division: "Men's", birth_year: 1996 }
const woman30: ContestProfile = { division: "Women's", birth_year: 1996 }
const man70: ContestProfile = { division: "Men's", birth_year: 1956 }

let n = 0
/** One game of Tag, a won by the first player named, recorded by both. */
const game = (a: string, b: string, profiles: Record<string, ContestProfile> = {}): MatchRow[] => {
  n++
  const base = { session_id: `s${n}`, event_name: 'Tag', created_at: `2026-10-01T10:${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}Z` }
  const pl = (id: string, side: 'a' | 'b') => ({ player_id: id, side, profile: profiles[id] })
  return [
    { ...base, id: `m${n}`, outcome: 'a', players: [pl(a, 'a'), pl(b, 'b')] },
    { ...base, id: `m${n}r`, outcome: 'b', players: [pl(b, 'a'), pl(a, 'b')] },
  ]
}
const shown = (ms: MatchRow[], id: string) => rateGames(ms).get('Tag')!.get(id)!.rating
const working = (ms: MatchRow[], id: string) => workingRatings(ms).get('Tag')!.get(id)!.rating

describe('handicapPoints', () => {
  it('reads age and sex, one colour being one rating step', () => {
    expect(handicapPoints(man30, 'Tag', YEAR)).toBe(0)
    expect(handicapPoints(boy10, 'Tag', YEAR)).toBeGreaterThan(0)
    expect(handicapPoints(man70, 'Tag', YEAR)).toBeGreaterThan(0)
    expect(handicapPoints(woman30, 'Tag', YEAR)).toBe(WOMEN_CONTEST_COLOURS[4] * RATING_STEP)
  })

  it('is nothing with no profile, off the roster, or in Speed Chess', () => {
    expect(handicapPoints(undefined, 'Tag', YEAR)).toBe(0)
    expect(handicapPoints(boy10, 'Not An Event', YEAR)).toBe(0)
    expect(handicapPoints(boy10, 'Speed Chess', YEAR)).toBe(0)
    expect(handicapPoints(woman30, 'Speed Chess', YEAR)).toBe(0)
  })

  it('gives a woman a row for every domain with a head-to-head event', () => {
    const domains = new Set(EVENTS.filter(e => STANDARDS[e.slug]?.kind === 'rating').map(e => e.domainNumber))
    for (const d of domains) expect(WOMEN_CONTEST_COLOURS[d], `domain ${d}`).toBeGreaterThan(0)
  })

  it('finds the profiles on the matches', () => {
    expect(contestProfilesOf(game('a', 'b', { a: boy10 })).get('a')).toEqual(boy10)
  })
})

describe('a relative bonus for an upset', () => {
  const profiles = { child: boy10, woman: woman30, old: man70, young: man30, peer: man30, rival: man30 }
  const gainOf = (winner: string, loser: string) => shown(game(winner, loser, profiles), winner) - RATING_START

  it('pays a child, a woman and an older player more than a level win', () => {
    const level = gainOf('peer', 'rival')
    expect(gainOf('child', 'young')).toBeGreaterThan(level)
    expect(gainOf('woman', 'young')).toBeGreaterThan(level)
    expect(gainOf('old', 'young')).toBeGreaterThan(level)
  })

  it('takes a provisional winner to the rating that beat them, plus their handicap', () => {
    expect(shown(game('child', 'young', profiles), 'child')).toBeCloseTo(RATING_START + handicapPoints(boy10, 'Tag', YEAR), 6)
  })

  it('is plain Elo where the read of profiles failed', () => {
    expect(gainOf('peer', 'rival')).toBeLessThanOrEqual(40)
  })
})

describe('a loss is never punished', () => {
  it('a later loss never lowers the shown rating, and the working rating still falls', () => {
    const won = game('p', 'q')
    const lost = [...won, ...game('r', 'p')]
    expect(shown(lost, 'p')).toBe(shown(won, 'p'))
    expect(working(lost, 'p')).toBeLessThan(working(won, 'p'))
  })

  it('a child loses far less to an adult than an adult to an adult', () => {
    const profiles = { child: boy10, a: man30, b: man30, c: man30 }
    const child = RATING_START - shown(game('a', 'child', profiles), 'child')
    const adult = RATING_START - shown(game('b', 'c', profiles), 'c')
    expect(child).toBeGreaterThanOrEqual(0)
    expect(child).toBeLessThan(adult)
  })

  it('another game never lowers a contest score for the day', () => {
    const win = { opponentRating: 1200, score: 1 }
    const loss = { opponentRating: 800, score: 0 }
    const once = performanceExact(performanceRating([win])!)
    expect(bestPerformanceExact([win])).toBe(once)
    expect(bestPerformanceExact([win, loss, loss])).toBe(once)
    expect(bestPerformanceExact([])).toBe(CONTEST_FLOOR)
  })

  it('a rated game cannot pull a domain colour down', () => {
    const player = { division: "Men's", ageYears: 30, gender: 'Male' }
    const none = { exemptions: new Set<string>(), games: 100 }
    // The Speed events open to everyone, each at its Kahurangi standard.
    const results = ['touch-rugby', 'repeat-high-jump', 'american-football', 'australian-football'].map(slug => {
      const ev = getEventBySlug(slug)!
      const score = STANDARDS[slug].all![5]
      return {
        event_name: ev.name, raw_score: score, weight_kg: null,
        difficulty_tier: ev.difficultyTiers?.[Math.floor(score / 10000)]?.name ?? null,
      }
    })
    const without = computePlayerGrades({ player, results, ratings: new Map(), ...none }).domains[3]
    expect(without.rung).toBe(6)
    const weak = new Map([['Tag', { rating: 760, games: 1 }]])
    expect(computePlayerGrades({ player, results, ratings: weak, ...none }).domains[3].rung).toBe(6)
    const strong = new Map([['Tag', { rating: 1600, games: 20 }]])
    expect(computePlayerGrades({ player, results, ratings: strong, ...none }).domains[3].average).toBeGreaterThan(without.average)
  })
})

describe('the family form', () => {
  it('saves the sex it asks for, in the words the column allows', () => {
    const page = readFileSync('app/profile/page.tsx', 'utf8')
    expect(page).toMatch(/gender: memberForm\.gender === 'female' \? 'Female' : 'Male'/)
  })
})
