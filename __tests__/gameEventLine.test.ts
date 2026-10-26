// ── The rating line on a win/draw/loss button ───────────────────────────────
import { describe, it, expect } from 'vitest'
import { gameEventLine, gameEventLineText, isGameEvent } from '@/lib/gameEventLine'
import { liveEventRung } from '@/lib/scoreColour'
import { getEventBySlug } from '@/lib/eventData'
import { MIN_RATED_GAMES } from '@/lib/grading'
import type { SportRating } from '@/lib/headToHead'

const tennis = getEventBySlug('tennis')!
const player = { division: "Men's", ageYears: 30, gender: null }
const ratings = (r: SportRating) => new Map([[tennis.name, r]])

describe('gameEventLine', () => {
  it('asks for one game before there is a rating', () => {
    expect(gameEventLine(tennis, new Map())).toEqual({ gamesToRating: MIN_RATED_GAMES })
    expect(MIN_RATED_GAMES).toBe(1)
  })

  it('shows the rating from the first game, rounded, even below the first colour', () => {
    expect(gameEventLine(tennis, ratings({ rating: 1020, games: 1 }))).toEqual({ rating: 1020 })
    expect(gameEventLine(tennis, ratings({ rating: 1147.6, games: 10 }))).toEqual({ rating: 1148 })
    expect(gameEventLine(tennis, ratings({ rating: 1050, games: 12 }))).toEqual({ rating: 1050 })
  })

  it('says nothing for a drill event, or when the ratings could not be loaded', () => {
    expect(isGameEvent(getEventBySlug('deadlift'))).toBe(false)
    expect(gameEventLine(getEventBySlug('deadlift'), new Map())).toBeNull()
    expect(gameEventLine(tennis, null)).toBeNull()
  })

  it('treats a rating-only event as a game event', () => {
    expect(isGameEvent(getEventBySlug('wrestling'))).toBe(true)
  })

  it('words it', () => {
    expect(gameEventLineText({ gamesToRating: 7 })).toBe('7 games to a rating')
    expect(gameEventLineText({ gamesToRating: 1 })).toBe('1 game to a rating')
    expect(gameEventLineText({ rating: 1148 })).toBe('Rating 1,148')
  })
})

describe('the live button colour', () => {
  it('pays win Kahurangi, draw Kākāriki, loss Kōwhai', () => {
    const tiers = tennis.difficultyTiers!
    const game = tiers.findIndex(t => t.scoring === 'sport')
    const r = (term: number) => [{ raw_score: game * 10000 + term, weight_kg: null, difficulty_tier: tiers[game].name }]
    expect(liveEventRung(tennis, r(2), player, null)).toBe(6)
    expect(liveEventRung(tennis, r(1), player, null)).toBe(5)
    expect(liveEventRung(tennis, r(0), player, null)).toBe(4)
  })

  it('takes the rating colour when it is higher than the result', () => {
    const tiers = tennis.difficultyTiers!
    const game = tiers.findIndex(t => t.scoring === 'sport')
    const loss = [{ raw_score: game * 10000, weight_kg: null, difficulty_tier: tiers[game].name }]
    expect(liveEventRung(tennis, loss, player, null, { rating: 1250, games: 10 })).toBe(8.5)
    expect(liveEventRung(tennis, loss, player, null, { rating: 1250, games: 1 })).toBe(8.5)
    expect(liveEventRung(tennis, loss, player, null, { rating: 1250, games: 0 })).toBe(4)
  })
})
