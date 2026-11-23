// ─── Bookings: "Coming?" per game and date ───────────────────────────────────
// MULTI_LOCATION_PLAN.md §2 "Players and bookings", step 8; database:
// 20261123214052_bookings.sql. A player (or their parent) answers Yes or Not
// this time for one date of a game. Booking is never required: walk-ups play.
//
// In the app only for now (Tāne, 24 Nov 2026): HOME asks from 4pm the day
// before, and the Kaiārahi sees "Only 2 coming. Still on?" two hours out. Push,
// email and the signed email links come with the push and email branch, and
// will send these same questions at these same times.
//
// PURE: no Supabase, no React (__tests__/bookings.test.ts).

import { addDays, dateLabel, nzWallClock, type WeeklyGame } from '@/lib/weeklyGames'
import { minutesUntil } from '@/lib/roster'

export type Answer = 'yes' | 'no'

export type BookingCounts = { coming: number; notComing: number; unanswered: number }

/** One player's answer for one date of one game. */
export const answerKey = (gameId: string, date: string, playerId: string) => `${gameId}|${date}|${playerId}`

/** Counts are per game and date. */
export const countsKey = (gameId: string, date: string) => `${gameId}|${date}`

/** The question goes out at 4pm NZ the day before (no notices 9pm to 7am). */
export const ASK_HOUR = 16

/**
 * Is it time to ask? From 4pm the day before until the game starts. Before
 * that a player may still answer; HOME just does not press them.
 */
export function askOpen(game: Pick<WeeklyGame, 'start_time'>, date: string, now: Date): boolean {
  if (minutesUntil(game, date, now) <= 0) return false
  const wall = nzWallClock(now)
  if (wall.date === date) return true
  return wall.date === addDays(date, -1) && wall.mins >= ASK_HOUR * 60
}

/** Can an answer still change? Until the game starts (set_booking refuses after). */
export function canAnswer(game: Pick<WeeklyGame, 'start_time'>, date: string, now: Date): boolean {
  return minutesUntil(game, date, now) > 0
}

/** "Coming today?", "Coming tomorrow?", "Coming Sat 21 Nov?" */
export function questionLabel(date: string, now: Date): string {
  const day = dateLabel(date, now)
  return `Coming ${day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day}?`
}

/** "6 coming · 3 not · 11 haven't said". Zero parts are left out; null when nothing to say. */
export function countsLine(c: BookingCounts | null | undefined): string | null {
  if (!c) return null
  const parts: string[] = []
  if (c.coming > 0) parts.push(`${c.coming} coming`)
  if (c.notComing > 0) parts.push(`${c.notComing} not`)
  if (c.unanswered > 0) parts.push(`${c.unanswered} haven't said`)
  return parts.length > 0 ? parts.join(' · ') : null
}

/** Fewer than this many coming, two hours out, and the Kaiārahi is asked "Still on?". */
export const FEW_COMING = 4
export const FEW_HOURS = 2

/**
 * "Only 2 coming. Still on?" for the Kaiārahi leading the date: within two
 * hours of the start, not started, not cancelled, and fewer than four said Yes.
 * Null when there is nothing to ask.
 */
export function fewComingPrompt(
  game: Pick<WeeklyGame, 'start_time'>, date: string, counts: BookingCounts | null | undefined, now: Date,
  cancelled = false,
): string | null {
  if (!counts || cancelled) return null
  const minutes = minutesUntil(game, date, now)
  if (minutes <= 0 || minutes > FEW_HOURS * 60) return null
  if (counts.coming >= FEW_COMING) return null
  return counts.coming === 0 ? 'Nobody has said they are coming. Still on?' : `Only ${counts.coming} coming. Still on?`
}

/** A tap on the answer already chosen takes it back. */
export function nextAnswer(current: Answer | undefined, tapped: Answer): Answer | null {
  return current === tapped ? null : tapped
}

/** The counts after one answer changes, so the card moves at once. */
export function adjustCounts(c: BookingCounts, before: Answer | undefined, after: Answer | null, registered: boolean): BookingCounts {
  const out = { ...c }
  const take = (a: Answer | undefined | null, d: number) => {
    if (a === 'yes') out.coming += d
    else if (a === 'no') out.notComing += d
    else if (registered) out.unanswered += d
  }
  take(before, -1)
  take(after, 1)
  out.coming = Math.max(0, out.coming)
  out.notComing = Math.max(0, out.notComing)
  out.unanswered = Math.max(0, out.unanswered)
  return out
}
