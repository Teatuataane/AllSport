// ─── Weekly games: the pure half ─────────────────────────────────────────────
// A player registers once to a weekly game (a site, a weekday, a start time)
// and hears about every date of it (Tāne, 18 Nov 2026). There are no dated
// rows: which date is "next", and whether that date is on, cancelled or moved,
// are worked out here from the weekly game and its notices. See migration
// 20261118010039_weekly_games.sql for the tables.
//
// No Supabase or React imports, so it is unit-tested (__tests__/weeklyGames.test.ts).
// Every clock reading is NZ wall-clock time through Intl, so a phone set to
// another zone still gets the right day.

import { NZ_TIME_ZONE } from '@/lib/dates'

export type Site = {
  id: string
  name: string
  address: string | null
  map_url: string | null
  is_active: boolean
}

export type WeeklyGame = {
  id: string
  site_id: string
  /** 0 = Sunday … 6 = Saturday, NZ time. */
  dow: number
  /** Postgres time, 'HH:MM:SS' (or 'HH:MM'). */
  start_time: string
  is_active: boolean
}

export type NoticeKind = 'cancelled' | 'on' | 'moved' | 'message'

export type GameNotice = {
  id: string
  weekly_game_id: string
  /** 'YYYY-MM-DD', NZ. */
  game_date: string
  kind: NoticeKind
  message: string | null
  created_at: string
}

/** A game runs 100 minutes; until then it is still "today's game". */
export const GAME_MINUTES = 100

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const WALL = new Intl.DateTimeFormat('en-NZ', {
  timeZone: NZ_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
})
const SHORT_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** The NZ calendar day, weekday and minute of the day at `now`. */
export function nzWallClock(now: Date): { date: string; dow: number; mins: number } {
  const parts = WALL.formatToParts(now)
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value ?? '0'
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    dow: SHORT_DAYS.indexOf(get('weekday')),
    mins: parseInt(get('hour')) * 60 + parseInt(get('minute')),
  }
}

/** Minutes past midnight of a 'HH:MM[:SS]' time. */
export function timeMins(t: string): number {
  const [h, m] = t.split(':')
  return parseInt(h) * 60 + parseInt(m)
}

/** Calendar arithmetic on a 'YYYY-MM-DD' string (no time zone involved). */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/**
 * The date of this weekly game's next game: today while today's has not yet
 * finished (start + 100 minutes), otherwise the next matching weekday.
 */
export function nextGameDate(game: Pick<WeeklyGame, 'dow' | 'start_time'>, now: Date = new Date()): string {
  const wall = nzWallClock(now)
  let ahead = (game.dow - wall.dow + 7) % 7
  if (ahead === 0 && wall.mins >= timeMins(game.start_time) + GAME_MINUTES) ahead = 7
  return addDays(wall.date, ahead)
}

/** '16:30:00' → '4:30pm', '09:00' → '9:00am'. */
export function formatTime(t: string): string {
  const mins = timeMins(t)
  const h = Math.floor(mins / 60)
  const m = mins % 60
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}:${m.toString().padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`
}

/** 'Saturday 9:00am'. */
export function slotLabel(game: Pick<WeeklyGame, 'dow' | 'start_time'>): string {
  return `${DAY_NAMES[game.dow]} ${formatTime(game.start_time)}`
}

/** 'Today', 'Tomorrow', or 'Sat 21 Nov'. */
export function dateLabel(date: string, now: Date = new Date()): string {
  const today = nzWallClock(now).date
  if (date === today) return 'Today'
  if (date === addDays(today, 1)) return 'Tomorrow'
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d))
  const month = t.toLocaleString('en-NZ', { month: 'short', timeZone: 'UTC' })
  return `${SHORT_DAYS[t.getUTCDay()]} ${d} ${month}`
}

export type DayStatus = {
  /** The newest 'cancelled' or 'on' notice decides it; none = on. */
  cancelled: boolean
  /** The newest 'moved' notice's text. A move says where, not whether, so a cancel does not clear it. */
  venue: string | null
  /** Every notice with words, newest first, for the list under the game. */
  notices: GameNotice[]
}

/**
 * What one date of one weekly game looks like, from that date's notices.
 * `notices` may hold other games or dates; they are ignored.
 */
export function dayStatus(gameId: string, date: string, notices: GameNotice[]): DayStatus {
  const mine = notices
    .filter(n => n.weekly_game_id === gameId && n.game_date === date)
    .sort((a, b) => (a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0))
  const switchNotice = mine.find(n => n.kind === 'cancelled' || n.kind === 'on')
  const moved = mine.find(n => n.kind === 'moved')
  return {
    cancelled: switchNotice?.kind === 'cancelled',
    venue: moved?.message?.trim() || null,
    notices: mine.filter(n => n.kind === 'cancelled' || (n.message ?? '').trim() !== ''),
  }
}

/**
 * The weekly game a game started at `startedAt` belongs to: same NZ weekday,
 * start within 90 minutes, nearest wins. Used to pre-select it on the New Game
 * screen; the kaiwhakawā can change it.
 */
export function matchWeeklyGame(games: WeeklyGame[], startedAt: Date): WeeklyGame | null {
  const wall = nzWallClock(startedAt)
  let best: { game: WeeklyGame; gap: number } | null = null
  for (const g of games) {
    if (!g.is_active || g.dow !== wall.dow) continue
    const gap = Math.abs(timeMins(g.start_time) - wall.mins)
    if (gap > 90) continue
    if (!best || gap < best.gap) best = { game: g, gap }
  }
  return best?.game ?? null
}

/** Weekly games in week order: Sunday first, then by start time. */
export function sortWeekly<T extends Pick<WeeklyGame, 'dow' | 'start_time'>>(games: T[]): T[] {
  return [...games].sort((a, b) => a.dow - b.dow || timeMins(a.start_time) - timeMins(b.start_time))
}
