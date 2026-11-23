// ─── More than one live game at once ─────────────────────────────────────────
// Since multi-location games (MULTI_LOCATION_PLAN.md step 6) HQ and a school
// can be live at the same moment, so nothing reads "the" active session any
// more. Tāne, 24 Nov 2026: HOME shows a Join card for EVERY live game, the
// player's own (a game they are registered to) first.
//
// PURE: no Supabase, no React (__tests__/liveGames.test.ts).

import { isLiveSession } from '@/lib/livePoll'

export type LiveGameRow = {
  id: string
  started_at: string | null
  is_active?: boolean | null
  location: string | null
  weekly_game_id?: string | null
  /** Who started it (stamped by the server since 20261123024501). */
  judge_id?: string | null
  is_championship?: boolean | null
}

/** The columns every live-game read asks for. */
export const LIVE_GAME_COLUMNS = 'id, started_at, is_active, location, weekly_game_id, judge_id, is_championship'

/** Open games still inside their 100 minutes. */
export function liveOnly<T extends LiveGameRow>(rows: T[], now: number = Date.now()): T[] {
  return rows.filter(r => isLiveSession(r, now))
}

/**
 * Live games in the order HOME shows them: the player's own games first (the
 * weekly games they are registered to), then the rest, each group by start
 * time, earliest first, so the cards do not shuffle between polls.
 */
export function orderLiveGames<T extends LiveGameRow>(rows: T[], registered: ReadonlySet<string>): T[] {
  const own = (r: T) => (r.weekly_game_id && registered.has(r.weekly_game_id) ? 0 : 1)
  return [...rows].sort((a, b) =>
    own(a) - own(b)
    || (a.started_at ?? '').localeCompare(b.started_at ?? '')
    || a.id.localeCompare(b.id))
}

/**
 * The game the nav's PLAY / RUN button opens, or null for none (it then goes
 * to the panel or to HOME's Join cards, where every live game is listed).
 *   - a Kaiārahi running a live game: that game;
 *   - otherwise the only live game, when there is one;
 *   - otherwise the player's own: the one game they are registered to;
 *   - otherwise none: several are live and none is clearly theirs.
 */
export function navGame(
  rows: LiveGameRow[],
  me: { id: string | null; registered: ReadonlySet<string> },
): string | null {
  if (rows.length === 0) return null
  const running = me.id ? rows.filter(r => r.judge_id === me.id) : []
  if (running.length > 0) return orderLiveGames(running, me.registered)[0].id
  if (rows.length === 1) return rows[0].id
  const own = rows.filter(r => r.weekly_game_id && me.registered.has(r.weekly_game_id))
  return own.length === 1 ? own[0].id : null
}

/** Is this game already live? New Game refuses a second session of one game. */
export function gameAlreadyLive(rows: LiveGameRow[], weeklyGameId: string | null): boolean {
  return !!weeklyGameId && rows.some(r => r.weekly_game_id === weeklyGameId)
}
