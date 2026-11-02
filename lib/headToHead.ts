// ─── Head-to-head ratings ────────────────────────────────────────────────────
// One rating per player per sport, from the games match recording collects. It
// grades Kiwikiwi to Taniwha on Game-rung events (lib/grading.ts ratingRung;
// Poroporo and above only, until 28 Oct 2026).
//
// Approved in review, rounds three and four:
//   · everyone starts at 1,000 in every sport;
//   · K is 40 for a player's first ten games in a sport, so a new rating finds
//     its level fast, then 20 (PROVISIONAL_GAMES; once the same number as the
//     colour minimum, which dropped to one game on 27 Oct 2026);
//   · 100 points is one colour, so the colour above you wins about two games in
//     three;
//   · a disputed game does not count until a kaiwhakawā settles it, and is then
//     rated on the record they marked as right; a game both sides logged
//     counts once.
//
// And since 28 Oct 2026 (Tāne): a new player who beats someone rated above
// them takes that rating. Beat a Taniwha in your first game and you are a
// Taniwha. Plain Elo moved a 1,000 newcomer about 39 points for it, and a
// rating that cannot see a result like that is not measuring the player.
// It holds through a player's provisional games (PROVISIONAL_GAMES), the
// stretch in which a rating is still finding its level, so a newcomer who lost
// their first game to a friend and then beats a Taniwha gets there too. A
// settled player wins points the usual way. Only a WIN does it: a draw, or a
// loss to a strong player, says less, and moves the rating by Elo alone. The
// opponent loses what Elo says they lose against the newcomer's old rating.
//
// And since 3 Nov 2026 (Tāne), two more rules, so that nobody is put off entering:
//   · A LOSS NEVER COSTS A PLAYER ANYTHING THEY CAN SEE. The working rating still
//     falls, because the next opponent's reward has to be honest, but the rating
//     a player is shown and given a colour on is the best it has been since their
//     first game. The working rating is never shown.
//   · AGE AND SEX ARE IN THE GAME. A game is played on rating minus handicap
//     (lib/contestHandicap.ts), so a child, a woman or an older player who beats
//     someone with the natural edge gets a bigger reward, and "take their rating"
//     takes the rating that means the same for who they are.
//
// Deliberately NOT lib/rating.ts. That file once held a multiplayer Elo from
// session placements, deleted in August 2026 because nothing used it, and its
// name now describes row shapes. This is a different engine on different data:
// who actually played whom.
//
// Pure — no React, no Supabase — so it is unit tested and can run on a server.

import { RATING_START } from './grading'
import { reconcileGames, type MatchRow } from './matches'
import { contestProfilesOf, handicapPoints } from './contestHandicap'
import { nzYear } from './seasonYear'

export const K_PROVISIONAL = 40
export const K_SETTLED = 20
/** Games in a sport that move at K_PROVISIONAL before K_SETTLED takes over. */
export const PROVISIONAL_GAMES = 10
/** The classic Elo scale: a 400-point gap is ten-to-one. */
export const SCALE = 400

/** The chance a player rated `rating` beats one rated `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / SCALE))
}

/** A player's K for their next game, given how many games they have played before it. */
export function kFactor(gamesBefore: number): number {
  return gamesBefore < PROVISIONAL_GAMES ? K_PROVISIONAL : K_SETTLED
}

/** How far one game moves a rating. `score` is 1 for a win, 0.5 a draw, 0 a loss. */
export function ratingChange(rating: number, gamesBefore: number, opponent: number, score: number): number {
  return kFactor(gamesBefore) * (score - expectedScore(rating, opponent))
}

export type SportRating = { rating: number; games: number }

/**
 * A player's rating after one game: Elo, except that a provisional player who
 * WINS takes the beaten side's rating when it is higher (see the header).
 */
export function nextRating(cur: SportRating, delta: number, score: number, opponent: number): number {
  const elo = cur.rating + delta
  if (score === 1 && cur.games < PROVISIONAL_GAMES) return Math.max(elo, opponent)
  return elo
}

/** One player in one sport while games replay. `best` stays null until their first game. */
type Working = { live: number; best: number | null; games: number }

/**
 * Replays every rated game in the order it was recorded. Keyed by sport (the
 * event name), then player id.
 *
 * TEAMS: a side's strength is the mean of its players' ratings less their
 * handicaps, and each player on it moves by their own K times the side's
 * surprise. A 1v1 is the one-player case, and a player's first games on a team
 * still move them twice as far as a settled teammate's.
 */
function replay(matches: readonly MatchRow[]): Map<string, Map<string, Working>> {
  const profiles = contestProfilesOf(matches)
  const byId = new Map(matches.map(m => [m.id, m]))
  const out = new Map<string, Map<string, Working>>()
  for (const g of reconcileGames(matches)) {
    // Only games resting on more than one side's word: both players recorded
    // it, or a kaiwhakawā settled it. Colours now confer themselves, and a game
    // only one side recorded let a player enter wins against anyone at an open
    // game and reach the top rating colours in a sitting, with nobody looking.
    // Decided with Tāne 2026-09-22. MIN_RATED_GAMES reads this count too.
    // The other side's plain win, draw or loss, logged without naming anyone,
    // is their word too (corroborate in lib/matches.ts, 28 Oct 2026).
    if (g.status !== 'agreed' && g.status !== 'settled') continue
    const { a, b } = g.sides
    // A side left empty, or one player on both sides, is not a game to rate.
    if (!a.length || !b.length || a.some(id => b.includes(id))) continue

    let sport = out.get(g.event_name)
    if (!sport) { sport = new Map(); out.set(g.event_name, sport) }
    const current = (id: string): Working => sport!.get(id) ?? { live: RATING_START, best: null, games: 0 }
    // Aged as they turn in the year of the game, like every other score.
    const year = nzYear(byId.get(g.matchIds[0])!.created_at)
    const handicap = (id: string) => handicapPoints(profiles.get(id), g.event_name, year)
    const level = (ids: string[]) => ids.reduce((s, id) => s + current(id).live - handicap(id), 0) / ids.length

    const la = level(a), lb = level(b)
    const scoreA = g.outcome === 'a' ? 1 : g.outcome === 'b' ? 0 : 0.5
    // Every change is computed before any is applied, so a side's level is the
    // same for all of its players.
    const updates = [
      ...a.map(id => [id, la, lb, scoreA] as const),
      ...b.map(id => [id, lb, la, 1 - scoreA] as const),
    ].map(([id, mine, theirs, score]) => {
      // ratingChange takes the SIDE's level but the PLAYER's games, so the
      // K comes from the player and the surprise from the side.
      const cur = current(id)
      const delta = ratingChange(mine, cur.games, theirs, score)
      // Taking the beaten side's rating means taking the rating that plays at
      // their level for this player: their level plus this player's handicap.
      const live = nextRating({ rating: cur.live, games: cur.games }, delta, score, theirs + handicap(id))
      return [id, { live, best: Math.max(cur.best ?? live, live), games: cur.games + 1 }] as const
    })
    for (const [id, next] of updates) sport.set(id, next)
  }
  return out
}

const shape = (matches: readonly MatchRow[], pick: (w: Working) => number): Map<string, Map<string, SportRating>> =>
  new Map([...replay(matches)].map(([sport, players]) => [sport, new Map(
    [...players].map(([id, w]) => [id, { rating: pick(w), games: w.games }]),
  )]))

/**
 * Every player's rating in every sport: the best each has reached since their
 * first game, the one number players see and colours are given on. A first loss
 * sets it just under the start; no later game takes it down.
 */
export function rateGames(matches: readonly MatchRow[]): Map<string, Map<string, SportRating>> {
  return shape(matches, w => w.best ?? w.live)
}

/**
 * The working ratings, which do fall with a loss: how strong a player is right
 * now, so what beating them is worth. Never shown to anyone.
 */
export function workingRatings(matches: readonly MatchRow[]): Map<string, Map<string, SportRating>> {
  return shape(matches, w => w.live)
}
