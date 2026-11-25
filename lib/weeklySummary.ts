// ─── HOME: which weekly games show while the card is folded ──────────────────
// The weekly games card used to open in full and push the player's colours
// below the fold (Tāne, 26 Nov 2026). Folded, it shows only what the household
// needs today: the next game anyone in it is registered to, plus any other of
// their games whose next date has news (cancelled, moved, a note) or an open
// "Coming?" question nobody has answered. Everything else waits behind
// "All games". Pure, so it is tested without React.

import { dayStatus, nextGameDate, timeMins, type GameNotice, type WeeklyGame } from '@/lib/weeklyGames'
import { answerKey, askOpen, canAnswer, type Answer } from '@/lib/bookings'

export type PinInput = {
  games: WeeklyGame[]
  notices: GameNotice[]
  /** Game ids the household answers for, by player id (the player and any children). */
  household: { id: string; games: Set<string> }[]
  answers: Map<string, Answer>
  bookingsLive: boolean
  now: Date
}

/** The next date's sort key: date, then start time. */
function soonKey(g: WeeklyGame, now: Date): string {
  return `${nextGameDate(g, now)} ${String(timeMins(g.start_time)).padStart(4, '0')}`
}

/** Has this game's next date got anything the household should see? */
export function hasNews(g: WeeklyGame, notices: GameNotice[], now: Date): boolean {
  const s = dayStatus(g.id, nextGameDate(g, now), notices)
  return s.cancelled || s.venue !== null || s.notices.length > 0
}

/** Is "Coming?" open for this game with someone in the household still to answer? */
export function stillToAnswer(g: WeeklyGame, input: PinInput): boolean {
  const { notices, household, answers, bookingsLive, now } = input
  if (!bookingsLive) return false
  const date = nextGameDate(g, now)
  if (dayStatus(g.id, date, notices).cancelled) return false
  if (!canAnswer(g, date, now) || !askOpen(g, date, now)) return false
  return household.some(p => p.games.has(g.id) && !answers.has(answerKey(g.id, date, p.id)))
}

/**
 * The games to show folded, soonest first: the household's next game, then
 * any other household game with news or an unanswered question. Empty when
 * nobody in the household is registered to any.
 */
export function pinnedGames(input: PinInput): WeeklyGame[] {
  const { games, household, notices, now } = input
  const ours = games
    .filter(g => household.some(p => p.games.has(g.id)))
    .sort((a, b) => (soonKey(a, now) < soonKey(b, now) ? -1 : soonKey(a, now) > soonKey(b, now) ? 1 : 0))
  return ours.filter((g, i) => i === 0 || hasNews(g, notices, now) || stillToAnswer(g, input))
}

/** The soonest of any games, for a player registered to none. */
export function soonestGame(games: WeeklyGame[], now: Date): WeeklyGame | null {
  let best: WeeklyGame | null = null
  for (const g of games) if (!best || soonKey(g, now) < soonKey(best, now)) best = g
  return best
}
