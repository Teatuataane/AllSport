import { describe, it, expect } from 'vitest'
import {
  expectedScore, kFactor, ratingChange, rateGames, nextRating, K_PROVISIONAL, K_SETTLED, PROVISIONAL_GAMES,
} from '@/lib/headToHead'
import { gamesBySport, type MatchRow } from '@/lib/matches'
import { RATING_START, RATING_STEP, DRILL_CAP, TOP_RUNG, ratingRung, ratingForRung } from '@/lib/grading'

let n = 0
const match = (recorder: string, opp: string, outcome: MatchRow['outcome'], extra: Partial<MatchRow> = {}): MatchRow => ({
  id: `m${++n}`, session_id: 's1', event_name: 'Squash', outcome,
  created_at: `2026-09-14T10:${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}Z`,
  players: [{ player_id: recorder, side: 'a' }, { player_id: opp, side: 'b' }],
  ...extra,
})

// The same game as the OTHER player recorded it: sides swapped, the outcome
// flipped, a draw still a draw. Only games both sides recorded are rated
// (decided 2026-09-22), so rating-maths tests record every game twice.
const mirror = (m: MatchRow): MatchRow => ({
  ...m, id: `${m.id}r`,
  outcome: m.outcome === 'a' ? 'b' : m.outcome === 'b' ? 'a' : m.outcome,
  players: m.players.map(p => ({ ...p, side: p.side === 'a' ? 'b' as const : 'a' as const })),
})
const both = (ms: MatchRow[]) => ms.flatMap(m => [m, mirror(m)])

describe('the model approved in review', () => {
  it('starts everyone at 1,000', () => {
    expect(RATING_START).toBe(1000)
  })

  it('makes one colour, 100 points, a win about two games in three', () => {
    expect(RATING_STEP).toBe(100)
    expect(expectedScore(1100, 1000)).toBeCloseTo(0.64, 2)
    expect(expectedScore(1000, 1000)).toBe(0.5)
  })

  it('moves a rating twice as far for the first ten games', () => {
    expect(kFactor(0)).toBe(K_PROVISIONAL)
    expect(kFactor(9)).toBe(K_PROVISIONAL)
    expect(kFactor(10)).toBe(K_SETTLED)
    expect(PROVISIONAL_GAMES).toBe(10)
    expect(K_PROVISIONAL).toBe(2 * K_SETTLED)
  })

  it("reproduces the review page's table for a settled player rated 1,100", () => {
    // You win / draw / lose against someone weaker, level and stronger.
    expect(ratingChange(1100, 10, 900, 1)).toBeCloseTo(4.8, 1)
    expect(ratingChange(1100, 10, 900, 0.5)).toBeCloseTo(-5.2, 1)
    expect(ratingChange(1100, 10, 900, 0)).toBeCloseTo(-15.2, 1)
    expect(ratingChange(1100, 10, 1100, 1)).toBeCloseTo(10, 5)
    expect(ratingChange(1100, 10, 1100, 0.5)).toBeCloseTo(0, 5)
    expect(ratingChange(1100, 10, 1300, 1)).toBeCloseTo(15.2, 1)
    expect(ratingChange(1100, 10, 1300, 0)).toBeCloseTo(-4.8, 1)
  })

  it('makes a win over a stronger player worth three times a win over a weaker one', () => {
    expect(ratingChange(1100, 10, 1300, 1) / ratingChange(1100, 10, 900, 1)).toBeCloseTo(3.2, 1)
  })
})

describe('rating the games match recording collects', () => {
  it('rates a game both players logged once, not twice', () => {
    const r = rateGames([match('A', 'B', 'a'), match('B', 'A', 'b')]).get('Squash')!
    expect(r.get('A')).toEqual({ rating: 1020, games: 1 })
    expect(r.get('B')).toEqual({ rating: 980, games: 1 })
  })

  it('does NOT rate a game only one side recorded', () => {
    // One player's word alone let them enter wins against anyone at an open
    // game and reach the top rating colours in a sitting, with nobody looking.
    expect(rateGames([match('B', 'A', 'b')]).get('Squash')).toBeUndefined()
  })

  it('rates it once the other side records it too', () => {
    const r = rateGames(both([match('B', 'A', 'b')])).get('Squash')!
    expect(r.get('A')!.rating).toBe(1020)
    expect(r.get('A')!.games).toBe(1)   // one game, not two, for two records
  })

  it('leaves a disputed game unrated, and out of the ten-game count', () => {
    const disputed = [match('A', 'B', 'a'), match('B', 'A', 'a')]
    expect(rateGames(disputed).get('Squash')).toBeUndefined()
    expect(gamesBySport(disputed, 'A').has('Squash')).toBe(false)
  })

  it('rates a settled game on the record the kaiwhakawā marked right', () => {
    // Both claimed the win; B's record is confirmed, so B won.
    const r = rateGames([match('A', 'B', 'a'), match('B', 'A', 'a', { confirmed_at: '2026-09-15T00:00:00Z' })]).get('Squash')!
    expect(r.get('B')!.rating).toBe(1020)
    expect(r.get('A')!.rating).toBe(980)
  })

  it('keeps a separate rating in every sport', () => {
    const r = rateGames(both([match('A', 'B', 'a'), match('B', 'A', 'a', { event_name: 'Tennis' })]))
    expect(r.get('Squash')!.get('A')!.rating).toBe(1020)
    expect(r.get('Tennis')!.get('A')!.rating).toBe(980)
  })

  it('rates a draw between equals as no change', () => {
    const r = rateGames(both([match('A', 'B', 'draw')])).get('Squash')!
    expect(r.get('A')!.rating).toBe(1000)
    expect(r.get('B')!.games).toBe(1)
  })

  it('rates a team game by each side\'s mean, moving every player', () => {
    const players = [
      { player_id: 'A', side: 'a' as const }, { player_id: 'A2', side: 'a' as const },
      { player_id: 'B', side: 'b' as const }, { player_id: 'B2', side: 'b' as const },
    ]
    const r = rateGames(both([match('A', 'B', 'a', { players })])).get('Squash')!
    for (const id of ['A', 'A2']) expect(r.get(id)!.rating).toBe(1020)
    for (const id of ['B', 'B2']) expect(r.get(id)!.rating).toBe(980)
  })

  it('refuses a game with a player on both sides', () => {
    const players = [{ player_id: 'A', side: 'a' as const }, { player_id: 'A', side: 'b' as const }]
    expect(rateGames([match('A', 'A', 'a', { players })]).get('Squash')).toBeUndefined()
  })

  it('gives a colour from the first game, Kahurangi for a win and Kākāriki for a loss', () => {
    // Since 28 Oct 2026 the rating reaches down to Kiwikiwi and the start,
    // 1,000, is Kahurangi.
    const wins = Array.from({ length: 10 }, (_, i) => match('A', `P${i}`, 'a', { session_id: `s${i}` }))
    const first = rateGames(both(wins.slice(0, 1))).get('Squash')!
    const one = first.get('A')!
    expect(one.games).toBe(1)
    expect(one.rating).toBe(1020)
    expect(ratingRung(one.rating, one.games)).toBe(DRILL_CAP)
    expect(ratingRung(first.get('P0')!.rating, 1)).toBe(DRILL_CAP - 1)
    // Beating a string of new players, Poroporo comes only by winning on.
    const a = rateGames(both(wins)).get('Squash')!.get('A')!
    expect(a.rating).toBeGreaterThan(ratingForRung(DRILL_CAP + 1))
    expect(ratingRung(a.rating, a.games)).toBeGreaterThanOrEqual(7)
  })
})

describe('beat them, take their rating (Tāne, 28 Oct 2026)', () => {
  // T wins forty games over new players, then N, new to the sport, beats T.
  // Elo against newcomers stalls T at Parahi; the rule is the same at any
  // height, and nextRating below shows it at Taniwha's 1,600.
  const taniwha = (): MatchRow[] => {
    const ms: MatchRow[] = []
    for (let i = 0; i < 40; i++) ms.push(match('T', `Q${i}`, 'a', { session_id: `t${i}` }))
    return ms
  }
  const rated = (ms: MatchRow[]) => rateGames(both(ms)).get('Squash')!

  it('a first game win over a stronger player takes their rating and colour', () => {
    const before = rated(taniwha()).get('T')!
    expect(ratingRung(before.rating, before.games)).toBeGreaterThan(DRILL_CAP)
    const after = rated([...taniwha(), match('N', 'T', 'a', { session_id: 'n1' })])
    const n = after.get('N')!
    expect(n.games).toBe(1)
    expect(n.rating).toBeCloseTo(before.rating, 6)
    expect(ratingRung(n.rating, n.games)).toBe(ratingRung(before.rating, before.games))
    // The beaten player loses what Elo says, against the newcomer's 1,000.
    expect(after.get('T')!.rating).toBeCloseTo(before.rating + ratingChange(before.rating, before.games, RATING_START, 0), 6)
  })

  it('holds through the provisional games, after a first loss too', () => {
    const t = rated(taniwha()).get('T')!
    const n = rated([...taniwha(), match('N', 'Z', 'b', { session_id: 'n0' }), match('N', 'T', 'a', { session_id: 'n1' })]).get('N')!
    expect(n.games).toBe(2)
    expect(n.rating).toBeCloseTo(t.rating, 6)
  })

  it('never lowers a win, and does nothing for a settled player, a draw or a loss', () => {
    // A win over someone rated BELOW you is plain Elo.
    expect(nextRating({ rating: 1200, games: 0 }, 10, 1, 1000)).toBe(1210)
    // A settled player wins points the usual way.
    expect(nextRating({ rating: 1000, games: PROVISIONAL_GAMES }, 19, 1, 1600)).toBe(1019)
    // A draw or a loss against a stronger player is plain Elo.
    expect(nextRating({ rating: 1000, games: 0 }, 30, 0.5, 1600)).toBe(1030)
    expect(nextRating({ rating: 1000, games: 0 }, -1, 0, 1600)).toBe(999)
    // A provisional win over a stronger player takes their rating: beat a
    // Taniwha and you are one.
    expect(nextRating({ rating: 1000, games: 0 }, 39, 1, 1600)).toBe(1600)
    expect(ratingRung(nextRating({ rating: 1000, games: 0 }, 39, 1, 1600), 1)).toBe(TOP_RUNG)
    expect(nextRating({ rating: 1000, games: 3 }, 39, 1, 1600)).toBe(1600)
  })
})
