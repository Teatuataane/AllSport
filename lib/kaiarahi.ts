// ─── Kaiārahi levels ─────────────────────────────────────────────────────────
// Who may run a game, and who may do everything (MULTI_LOCATION_PLAN.md §2,
// agreed with Tāne 23 Nov 2026; database: 20261123024501_kaiarahi_levels.sql).
//
// Kaiārahi is the general word for whoever runs a game. Three levels, stored as
// plain words so the display names can change without a migration:
//
//   head       Kaiwhakawā  head staff: everything a judge could do before
//   staff      Kaimahi     paid staff: run the games they are running
//   community  Kaiako      weekend course: run the games they are running
//
// "Kaiwhakawā" used to mean anyone who ran a game. It now means head staff only.
//
// PURE: no Supabase, no React. The database is the authority (is_judge() means
// a head, runs_session() a head or the game's own Kaiārahi); this file only
// decides what the app SHOWS, so a wrong answer here hides a button, never
// grants a power.

export const KAIARAHI_LEVELS = ['head', 'staff', 'community'] as const
export type KaiarahiLevel = (typeof KAIARAHI_LEVELS)[number]

export const LEVEL_NAME: Record<KaiarahiLevel, string> = {
  head: 'Kaiwhakawā',
  staff: 'Kaimahi',
  community: 'Kaiako',
}

/** The general word for whoever runs a game, at any level. */
export const KAIARAHI = 'Kaiārahi'

export function isKaiarahiLevel(v: unknown): v is KaiarahiLevel {
  return typeof v === 'string' && (KAIARAHI_LEVELS as readonly string[]).includes(v)
}

/**
 * A player's level from what was read.
 *
 * `row` is the player's own kaiarahi row: an object when they have one, null
 * when the table is live and they have none, and undefined when the table is
 * not live yet (before the migration). Only then does the old players.role
 * decide, and a judge reads as a head, exactly what the migration backfills.
 * A suspended Kaiārahi holds no level.
 */
export function levelFrom(
  row: { level?: unknown; suspended_at?: unknown } | null | undefined,
  role: string | null | undefined,
): KaiarahiLevel | null {
  if (row === undefined) return role === 'judge' ? 'head' : null
  if (!row || row.suspended_at) return null
  return isKaiarahiLevel(row.level) ? row.level : null
}

export function isHead(level: KaiarahiLevel | null | undefined): boolean {
  return level === 'head'
}

export function isKaiarahi(level: KaiarahiLevel | null | undefined): boolean {
  return level != null
}

/**
 * May this person run (score, edit, end) this game? A head may run any game;
 * any other Kaiārahi only the one they started (sessions.judge_id). Mirrors
 * public.runs_session().
 */
export function runsSession(
  level: KaiarahiLevel | null | undefined,
  me: string | null | undefined,
  sessionJudgeId: string | null | undefined,
): boolean {
  if (isHead(level)) return true
  return isKaiarahi(level) && !!me && sessionJudgeId === me
}
