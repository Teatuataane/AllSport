// ─── Roster and cover ────────────────────────────────────────────────────────
// Who leads each game on each date, cover requests and claims, and the alerts
// for covers nobody has claimed (MULTI_LOCATION_PLAN.md §2 "Roster and cover";
// database: 20261123202226_roster_and_cover.sql).
//
// The game's REGULAR Kaiārahi leads every date unless game_roster says
// otherwise for that date: 'cover_needed' (nobody leads until someone claims),
// 'covered' (the claimer leads) or 'rostered' (a Kaiwhakawā put someone on).
// A community game with no regular is led by its creator.
//
// Alerts are shown in the app for now (Tāne, 24 Nov 2026); push and email will
// send the same ones once that branch lands.
//
// PURE: no Supabase, no React (__tests__/roster.test.ts). The database is the
// authority (rostered_lead, can_lead_game, can_start_game); this only decides
// what to show.

import { addDays, gameKind, nzWallClock, timeMins, type WeeklyGame } from '@/lib/weeklyGames'
import type { KaiarahiLevel } from '@/lib/kaiarahi'

export type RosterStatus = 'rostered' | 'cover_needed' | 'covered'

export type RosterRow = {
  id: string
  weekly_game_id: string
  game_date: string
  role: 'lead' | 'second'
  /** Who is rostered; for cover_needed, who asked. */
  player_id: string | null
  helper_name: string | null
  status: RosterStatus
  claimed_by: string | null
  claimed_at: string | null
  note: string | null
}

export type Me = { id: string; level: KaiarahiLevel | null; checksCurrent: boolean }

/** The lead row for a game and date, if any. */
export function leadRow(rows: readonly RosterRow[], gameId: string, date: string): RosterRow | null {
  return rows.find(r => r.weekly_game_id === gameId && r.game_date === date && r.role === 'lead') ?? null
}

/** Who leads this game on this date (mirrors public.rostered_lead). Null: nobody. */
export function leadFor(
  game: Pick<WeeklyGame, 'id' | 'kind' | 'regular_kaiarahi_id' | 'created_by'>,
  date: string,
  rows: readonly RosterRow[],
): string | null {
  const r = leadRow(rows, game.id, date)
  if (!r) return game.regular_kaiarahi_id ?? (gameKind(game) === 'community' ? game.created_by ?? null : null)
  if (r.status === 'covered') return r.claimed_by
  if (r.status === 'rostered') return r.player_id
  return null
}

/**
 * May this person lead this game (mirrors public.can_lead_game)? Any
 * Kaiārahi a community game; a Kaimahi or Kaiwhakawā with current vetting and
 * first aid a funded one.
 */
export function canLeadGame(me: Pick<Me, 'level' | 'checksCurrent'>, game: Pick<WeeklyGame, 'kind'>): boolean {
  if (!me.level) return false
  if (gameKind(game) === 'community') return true
  return (me.level === 'head' || me.level === 'staff') && me.checksCurrent
}

/**
 * Games this Kaiārahi may start today (mirrors public.can_start_game): a
 * Kaiwhakawā any; anyone else the game they lead today.
 */
export function startableToday(games: WeeklyGame[], me: Me, rows: readonly RosterRow[], today: string): WeeklyGame[] {
  if (!me.level) return []
  if (me.level === 'head') return games
  return games.filter(g => leadFor(g, today, rows) === me.id && canLeadGame(me, g))
}

/** Minutes from `now` until the game starts on `date` (negative once started). */
export function minutesUntil(game: Pick<WeeklyGame, 'start_time'>, date: string, now: Date): number {
  const wall = nzWallClock(now)
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${wall.date}T00:00:00Z`)) / 86_400_000)
  return days * 1440 + timeMins(game.start_time) - wall.mins
}

export type OpenCover = { game: WeeklyGame; date: string; row: RosterRow; minutes: number }

/**
 * Covers this Kaiārahi could claim: open, not yet started, a game they may
 * lead, and not their own request (they withdraw that instead). Soonest first.
 */
export function openCovers(games: WeeklyGame[], rows: readonly RosterRow[], me: Me, now: Date): OpenCover[] {
  const byId = new Map(games.map(g => [g.id, g]))
  const out: OpenCover[] = []
  for (const r of rows) {
    if (r.role !== 'lead' || r.status !== 'cover_needed' || r.player_id === me.id) continue
    const game = byId.get(r.weekly_game_id)
    if (!game || !canLeadGame(me, game)) continue
    const minutes = minutesUntil(game, r.game_date, now)
    if (minutes <= 0) continue
    out.push({ game, date: r.game_date, row: r, minutes })
  }
  return out.sort((a, b) => a.minutes - b.minutes)
}

/** Hours before the start at which an open cover alerts the Kaiwhakawā. */
export const ALERT_HOURS = { warn: 48, decide: 4 } as const

export type UnfilledAlert = OpenCover & { stage: 'warn' | 'decide' }

/**
 * Covers nobody has claimed, for a Kaiwhakawā: 48 hours out a warning, 4 hours
 * out a decision (roster someone or cancel). Includes the head's own requests.
 */
export function unfilledAlerts(games: WeeklyGame[], rows: readonly RosterRow[], now: Date): UnfilledAlert[] {
  const byId = new Map(games.map(g => [g.id, g]))
  const out: UnfilledAlert[] = []
  for (const r of rows) {
    if (r.role !== 'lead' || r.status !== 'cover_needed') continue
    const game = byId.get(r.weekly_game_id)
    if (!game) continue
    const minutes = minutesUntil(game, r.game_date, now)
    if (minutes <= 0 || minutes > ALERT_HOURS.warn * 60) continue
    out.push({ game, date: r.game_date, row: r, minutes, stage: minutes <= ALERT_HOURS.decide * 60 ? 'decide' : 'warn' })
  }
  return out.sort((a, b) => a.minutes - b.minutes)
}

/** "in 3 hours", "in 2 days". */
export function untilLabel(minutes: number): string {
  if (minutes < 60) return `in ${Math.max(1, Math.round(minutes))} min`
  const h = Math.round(minutes / 60)
  if (h < 48) return `in ${h} hour${h === 1 ? '' : 's'}`
  const d = Math.round(h / 24)
  return `in ${d} days`
}

/** How far ahead the roster is read. */
export const ROSTER_DAYS = 28

export function rosterWindow(now: Date): { from: string; to: string } {
  const today = nzWallClock(now).date
  return { from: today, to: addDays(today, ROSTER_DAYS) }
}

// ── Cancelling and moving need a reason (game_notices.reason) ───────────────
export const NOTICE_REASONS = ['weather', 'no_kaiarahi', 'few_players', 'venue', 'other'] as const
export type NoticeReason = (typeof NOTICE_REASONS)[number]

export const REASON_LABEL: Record<NoticeReason, string> = {
  weather: 'Weather',
  no_kaiarahi: 'No Kaiārahi',
  few_players: 'Not enough players',
  venue: 'Venue unavailable',
  other: 'Other',
}

/** A cancel or move is ready to send: a reason, and a note when it is Other. */
export function reasonReady(reason: NoticeReason | null, message: string): boolean {
  if (!reason) return false
  return reason !== 'other' || message.trim().length > 0
}

// ── Second adult (20261123205536, step 7b) ───────────────────────────────────
// A game with two_adults needs a second adult recorded before it starts; a
// Kaiako under 18 needs an ADULT second (a Kaiārahi 18 or over, or a helper
// they confirm is 18 or over). The database decides (session_start_blocker);
// this decides what New Game asks for.

export type SecondAdult =
  | { kind: 'kaiarahi'; playerId: string }
  | { kind: 'helper'; name: string; adult: boolean }
  | null

/** Whole years from a date of birth ('YYYY-MM-DD') to `today` ('YYYY-MM-DD'). Null when unknown. */
export function ageOn(dob: string | null | undefined, today: string): number | null {
  if (!dob) return null
  const [by, bm, bd] = dob.slice(0, 10).split('-').map(Number)
  const [ty, tm, td] = today.split('-').map(Number)
  if (!by || !ty) return null
  return ty - by - (tm < bm || (tm === bm && td < bd) ? 1 : 0)
}

export function secondAdultRule(
  game: { two_adults?: boolean | null } | null,
  me: { level: KaiarahiLevel | null; age: number | null },
): { needed: boolean; mustBeAdult: boolean } {
  const young = me.level === 'community' && me.age != null && me.age < 18
  return { needed: !!game?.two_adults || young, mustBeAdult: young }
}

/** Is the second adult filled in well enough to try starting? */
export function secondReady(second: SecondAdult, mustBeAdult: boolean): boolean {
  if (!second) return false
  if (second.kind === 'kaiarahi') return !!second.playerId
  return second.name.trim().length > 0 && (!mustBeAdult || second.adult)
}
