// ─── Head-to-head ratings ────────────────────────────────────────────────────
// One rating per player per sport, from the games match recording collects. It
// grades Poroporo and above on Game-rung events (lib/grading.ts ratingRung).
//
// Approved in review, rounds three and four:
//   · everyone starts at 1,000 in every sport;
//   · K is 40 for a player's first ten games in a sport, so a new rating finds
//     its level fast, then 20;
//   · 100 points is one colour, so the colour above you wins about two games in
//     three;
//   · a disputed game does not count until a kaiwhakawā settles it, and is then
//     rated on the record they marked as right; a game only one side logged
//     counts; a game both sides logged counts once.
//
// Deliberately NOT lib/rating.ts. That file once held a multiplayer Elo from
// session placements, deleted in August 2026 because nothing used it, and its
// name now describes row shapes. This is a different engine on different data:
// who actually played whom.
//
// Pure — no React, no Supabase — so it is unit tested and can run on a server.

import { RATING_START, MIN_RATED_GAMES } from './grading'
import { reconcileGames, type MatchRow } from './matches'

export const K_PROVISIONAL = 40
export const K_SETTLED = 20
/** The classic Elo scale: a 400-point gap is ten-to-one. */
export const SCALE = 400

/** The chance a player rated `rating` beats one rated `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / SCALE))
}

/** A player's K for their next game, given how many games they have played before it. */
export function kFactor(gamesBefore: number): number {
  return gamesBefore < MIN_RATED_GAMES ? K_PROVISIONAL : K_SETTLED
}

/** How far one game moves a rating. `score` is 1 for a win, 0.5 a draw, 0 a loss. */
export function ratingChange(rating: number, gamesBefore: number, opponent: number, score: number): number {
  return kFactor(gamesBefore) * (score - expectedScore(rating, opponent))
}

export type SportRating = { rating: number; games: number }

/**
 * Every player's rating in every sport, replaying games in the order they were
 * recorded. Keyed by sport (the event name), then player id.
 *
 * TEAMS: a side's strength is the mean of its players' ratings, and each player
 * on it moves by their own K times the side's surprise. A 1v1 is the one-player
 * case, and a player's first games on a team still move them twice as far as a
 * settled teammate's.
 */
export function rateGames(matches: readonly MatchRow[]): Map<string, Map<string, SportRating>> {
  const out = new Map<string, Map<string, SportRating>>()
  for (const g of reconcileGames(matches)) {
    // Only games resting on more than one side's word: both players recorded
    // it, or a kaiwhakawā settled it. Colours now confer themselves, and a game
    // only one side recorded let a player enter wins against anyone at an open
    // game and reach the top rating colours in a sitting, with nobody looking.
    // Decided with Tāne 2026-09-22. The 10-game minimum reads this count too.
    if (g.status !== 'agreed' && g.status !== 'settled') continue
    const { a, b } = g.sides
    // A side left empty, or one player on both sides, is not a game to rate.
    if (!a.length || !b.length || a.some(id => b.includes(id))) continue

    let sport = out.get(g.event_name)
    if (!sport) { sport = new Map(); out.set(g.event_name, sport) }
    const current = (id: string): SportRating => sport!.get(id) ?? { rating: RATING_START, games: 0 }
    const mean = (ids: string[]) => ids.reduce((s, id) => s + current(id).rating, 0) / ids.length

    const ra = mean(a), rb = mean(b)
    const scoreA = g.outcome === 'a' ? 1 : g.outcome === 'b' ? 0 : 0.5
    // Every change is computed before any is applied, so a side's mean is the
    // same for all of its players.
    const updates = [
      ...a.map(id => [id, ratingChange(ra, current(id).games, rb, scoreA)] as const),
      ...b.map(id => [id, ratingChange(rb, current(id).games, ra, 1 - scoreA)] as const),
    ].map(([id, delta]) => {
      // ratingChange takes the SIDE's rating but the PLAYER's games, so the
      // K comes from the player and the surprise from the side.
      const cur = current(id)
      return [id, { rating: cur.rating + delta, games: cur.games + 1 }] as const
    })
    for (const [id, next] of updates) sport.set(id, next)
  }
  return out
}
