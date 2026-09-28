// ─── What the leaderboard publishes ──────────────────────────────────────────
// Settled with Tāne on 2026-09-25. The board exists so players who could never
// play together (a Grandmaster woman, a U14 boy, a Men's player) can compete
// anyway, so it prices every score on the COLOUR LADDER, which already shifts
// for age and sex and scales strength by bodyweight: Kōwhai is the same
// achievement whoever earned it.
//
//   DOMAIN COLOURS — lifetime. The colour the STANDARDS give a player in each
//   of the ten domains (the same best-six average as a colour; domain colours
//   have had no games or training gate since 26 September 2026). Shown on each card as best and worst domain.
//   A lifetime Skill board ranked on their average and was removed the same
//   day (Tāne, 2026-09-25): one board, Season.
//
//   SEASON POINTS — this calendar year. Every official event in every finished
//   game scores the rung that game's result reached (Kiwikiwi 1 … Taniwha 12),
//   so a player's colour total in one game is up to 120. Everyone in the game
//   is then ranked on that total and places pay 100, 99, 98 … (since
//   2026-09-28; see "Season points" below). Resets each January.
//
// Pure, so it is tested, and so the route and the backfill script cannot
// disagree about what a player scored. Computed on the SERVER only: strength
// rungs need the player's declared bodyweight, which is private. Only the
// resulting numbers are published (player_domain_colours, player_game_colours).

import { getEventByName } from './eventData'
import { STANDARDS } from './standards'
import { sportTermOf } from './scoring'
import { eventGrade, type GradePlayer, type GradeResultRow } from './playerGrades'
import { DOMAIN_COUNT, DRILL_CAP, TOP_RUNG, type DomainGradeResult } from './grading'
import type { SportRating } from './headToHead'

/**
 * What playing the real contest on a Game-rung event is worth in one game, by
 * result. A drill on these events stops at Kahurangi (DRILL_CAP), so a win is
 * worth the top drill colour, a draw one below and a loss two below. Without a
 * floor, playing the actual sport scored 0 until a player had ten rated games,
 * and doing a drill instead would always pay better.
 *
 * A PROVISIONAL call, flagged to Tāne: it is the one number here the colour
 * standards do not already decide.
 */
export const GAME_RESULT_RUNG: Record<0 | 1 | 2, number> = {
  2: DRILL_CAP,
  1: DRILL_CAP - 1,
  0: DRILL_CAP - 2,
}

/** The highest colour total in one game: the top colour in each of ten events. */
export const MAX_GAME_COLOUR_TOTAL = TOP_RUNG * DOMAIN_COUNT

// ─── Domain colours ──────────────────────────────────────────────────────────

/** One rung per domain, in domain order. 0 = no colour by the standards. */
export function domainRungsOf(domains: readonly DomainGradeResult[]): number[] {
  return Array.from({ length: DOMAIN_COUNT }, (_, i) =>
    domains.find(d => d.domainNumber === i + 1)?.rung ?? 0)
}

// ─── Colour total in a game ─────────────────────────────────────────────────

/** One of the player's own rows from an official game, bodyweight already resolved. */
export type SeasonRow = GradeResultRow & {
  session_id: string
  /** The NZ day the game was played, YYYY-MM-DD. */
  session_date: string
  /** The game has finished. A game in progress scores nothing yet. */
  closed: boolean
}

/**
 * The rung one event reached in one game. `rows` are that event's rows from
 * that game only. `rating` is the player's rating in that sport as it stood
 * when the game closed, so a later run of wins never re-prices an old game.
 */
export function eventRungInGame(
  eventName: string,
  rows: readonly GradeResultRow[],
  player: GradePlayer,
  rating?: SportRating,
): number {
  const ev = getEventByName(eventName)
  if (!ev) return 0
  // The standards' own answer: drills (capped on a Game-rung event) and the
  // rating colour, exactly as a colour would be judged.
  let rung = STANDARDS[ev.slug] ? eventGrade(ev, rows, player, rating).rung : 0
  // The real contest, which the standards deliberately never grade from a single result.
  for (const r of rows) {
    if (r.raw_score == null) continue
    const term = sportTermOf(ev, { raw_score: r.raw_score, difficulty_tier: r.difficulty_tier })
    if (term != null) rung = Math.max(rung, GAME_RESULT_RUNG[term])
  }
  return rung
}

/** One player's colour total in one finished game: the rungs of its events, summed. */
export type GameColours = { session_id: string; session_date: string; total: number }

/**
 * A player's colour total in every finished game they played, every year.
 * Priced on the player's CURRENT division, age and bodyweight rules, like
 * their colours, so crossing an age band re-prices past games, and with it
 * the places of everyone they played. Accepted: it is the same ladder HOME
 * shows them today.
 * `ratingAt` returns the player's ratings as they stood at the end of one
 * game; omit it to score game events on their result alone.
 */
export function gameColourTotals(
  rows: readonly SeasonRow[],
  player: GradePlayer,
  ratingAt?: (sessionId: string) => ReadonlyMap<string, SportRating>,
): GameColours[] {
  const bySession = new Map<string, { date: string; events: Map<string, GradeResultRow[]> }>()
  for (const r of rows) {
    if (!r.closed) continue
    const game = bySession.get(r.session_id) ?? { date: r.session_date, events: new Map<string, GradeResultRow[]>() }
    const list = game.events.get(r.event_name) ?? []
    list.push(r)
    game.events.set(r.event_name, list)
    bySession.set(r.session_id, game)
  }
  return [...bySession].map(([sessionId, { date, events }]) => {
    const ratings = ratingAt?.(sessionId)
    let total = 0
    for (const [name, list] of events) total += eventRungInGame(name, list, player, ratings?.get(name))
    // A game holds ten events (verified: no session has more). Capped anyway,
    // because the stored CHECK would otherwise refuse every game in the batch.
    return { session_id: sessionId, session_date: date, total: Math.min(total, MAX_GAME_COLOUR_TOTAL) }
  })
}

// ─── Season points ───────────────────────────────────────────────────────────
// Settled with Tāne on 2026-09-28. Everyone in a game is ranked together on
// their colour total, whatever their division (the ladder already adjusts for
// age, sex and bodyweight). 1st scores 100, 2nd 99, 3rd 98, and ties share
// the higher place. The one-point gap is deliberate: the board rewards
// turning up. In any game of 50 or fewer, one more game is worth more than
// the whole gap between 1st and last.
//
// The database computes this (the season_points view, 20260928011813), because
// a player's points move whenever anyone else in their games is rescored.
// seasonPointsFromGames is the same rule in TypeScript, and the test pins the
// two together.

/** What 1st place in a game is worth. */
export const WINNER_POINTS = 100

/** Points for a place in one game: 100, 99, 98 …, never below 1. */
export const placePoints = (place: number): number => Math.max(WINNER_POINTS + 1 - place, 1)

export type GameTotalRow = { player_id: string; session_id: string; total: number }
export type SeasonPoints = { points: number; games: number }

/** Season points per player from every player's game totals for one season. */
export function seasonPointsFromGames(rows: readonly GameTotalRow[]): Map<string, SeasonPoints> {
  // One total per player per game, as the table's primary key guarantees.
  const bySession = new Map<string, Map<string, number>>()
  for (const r of rows) {
    const game = bySession.get(r.session_id) ?? new Map<string, number>()
    game.set(r.player_id, r.total)
    bySession.set(r.session_id, game)
  }
  const out = new Map<string, SeasonPoints>()
  for (const game of bySession.values()) {
    const totals = [...game.values()]
    for (const [playerId, total] of game) {
      // RANK(): one more than the number who scored strictly higher.
      const place = 1 + totals.filter(t => t > total).length
      const s = out.get(playerId) ?? { points: 0, games: 0 }
      out.set(playerId, { points: s.points + placePoints(place), games: s.games + 1 })
    }
  }
  return out
}

// ─── A player's card ─────────────────────────────────────────────────────────

/** Best and worst domain by the standards: highest and lowest rung, earliest domain on a tie. */
export function bestAndWorst(rungs: readonly number[]): { best: number; worst: number } {
  let best = 0, worst = 0
  rungs.forEach((r, i) => {
    if (r > rungs[best]) best = i
    if (r < rungs[worst]) worst = i
  })
  return { best, worst }
}


// ─── Ranking ─────────────────────────────────────────────────────────────────

export type Ranked<T> = T & { rank: number }

/**
 * Highest first on each key in turn; players level on every key share a rank.
 * Names only break DISPLAY order, never the rank.
 */
export function rankBy<T extends { name: string }>(rows: readonly T[], keys: (r: T) => number[]): Ranked<T>[] {
  const sorted = [...rows].sort((a, b) => {
    const ka = keys(a), kb = keys(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return a.name.localeCompare(b.name)
  })
  const out: Ranked<T>[] = []
  sorted.forEach((r, i) => {
    const prev = out[i - 1]
    const same = prev && keys(prev).every((v, j) => v === keys(r)[j])
    out.push({ ...r, rank: same ? prev.rank : i + 1 })
  })
  return out
}
