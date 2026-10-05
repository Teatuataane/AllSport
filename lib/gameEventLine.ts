// ─── What a win/draw/loss event's button says about the rating ───────────────
// On an event topped by a Game rung (or graded on games alone) a button reads
// either "7 games to a rating" or "Rating 1,148". Pure, so the wording and the
// threshold are tested; the games and ratings come from lib/headToHead.ts
// (rateGames), which counts only games both players recorded or a kaiwhakawā
// settled. A game only one side has recorded does not count yet, and nothing
// here says anything about it (decided: no "waiting on your opponent" state).

import { STANDARDS } from './standards'
import { MIN_RATED_GAMES } from './grading'
import type { EventData } from './eventData'
import type { SportRating } from './headToHead'

export type GameEventLine = { gamesToRating: number } | { rating: number }

/** Is this event decided by games: topped by a Game rung, or graded on games alone? */
export function isGameEvent(ev: EventData | undefined): boolean {
  const s = ev ? STANDARDS[ev.slug] : undefined
  return !!s && (s.game || s.kind === 'rating')
}

/**
 * The line for one event, or null when it is not a game event or the ratings
 * could not be loaded (a failed read says nothing rather than a wrong count).
 * `ratings` is keyed by event name, as rateGames keys its sports.
 */
export function gameEventLine(
  ev: EventData | undefined,
  ratings: ReadonlyMap<string, SportRating> | null,
): GameEventLine | null {
  if (!ev || !ratings || !isGameEvent(ev)) return null
  const r = ratings.get(ev.name)
  const games = r?.games ?? 0
  if (r && games >= MIN_RATED_GAMES) return { rating: Math.round(r.rating) }
  return { gamesToRating: MIN_RATED_GAMES - games }
}

/** "7 games to a rating", "1 game to a rating" or "Rating 1,148". */
export function gameEventLineText(line: GameEventLine): string {
  if ('rating' in line) return `Rating ${line.rating.toLocaleString('en-NZ')}`
  return `${line.gamesToRating} game${line.gamesToRating === 1 ? '' : 's'} to a rating`
}
