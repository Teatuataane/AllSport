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
//   so one game is worth up to 120. High scores earn more per game; turning up
//   earns more games. Resets each January by being keyed on the year.
//
// Pure, so it is tested, and so the route and the backfill script cannot
// disagree about what a player scored. Computed on the SERVER only: strength
// rungs need the player's declared bodyweight, which is private. Only the
// resulting numbers are published (player_domain_colours, player_season_points).

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

/** The most one game can be worth: the top colour in each of ten events. */
export const MAX_GAME_POINTS = TOP_RUNG * DOMAIN_COUNT

// ─── Domain colours ──────────────────────────────────────────────────────────

/** One rung per domain, in domain order. 0 = no colour by the standards. */
export function domainRungsOf(domains: readonly DomainGradeResult[]): number[] {
  return Array.from({ length: DOMAIN_COUNT }, (_, i) =>
    domains.find(d => d.domainNumber === i + 1)?.rung ?? 0)
}

// ─── Season points ───────────────────────────────────────────────────────────

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

export type SeasonPoints = { points: number; games: number }

/**
 * A player's season points in `year`. `ratingAt` returns the player's ratings
 * as they stood at the end of one game; omit it to score game events on their
 * result alone.
 */
export function seasonPoints(
  rows: readonly SeasonRow[],
  player: GradePlayer,
  year: number,
  ratingAt?: (sessionId: string) => ReadonlyMap<string, SportRating>,
): SeasonPoints {
  const prefix = `${year}-`
  const bySession = new Map<string, Map<string, GradeResultRow[]>>()
  for (const r of rows) {
    if (!r.closed || !r.session_date.startsWith(prefix)) continue
    const events = bySession.get(r.session_id) ?? new Map<string, GradeResultRow[]>()
    const list = events.get(r.event_name) ?? []
    list.push(r)
    events.set(r.event_name, list)
    bySession.set(r.session_id, events)
  }
  let points = 0
  for (const [sessionId, events] of bySession) {
    const ratings = ratingAt?.(sessionId)
    for (const [name, list] of events) points += eventRungInGame(name, list, player, ratings?.get(name))
  }
  return { points, games: bySession.size }
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
