// ─── Hapū: schools, clubs and whānau (Scoring v2 step 4) ────────────────────
// Called hapū everywhere a player sees them (Tāne, 15 Oct 2026); the database
// keeps the English names (groups, group_members, group_board()).
// The rule behind the group board, mirrored from group_member_progress() and
// group_board() in supabase/migrations/20261015004143_scoring_v2_groups.sql.
// __tests__/groupBoard.test.ts pins the two together.
//
// Improvement (Tāne, 15 Oct 2026): a member's game colour score, the average
// of their last three games this season after their first, minus their first,
// in colours (a total of 120 is 12). Game score, not the exact overall: the
// overall also rises just from trying more events. Active = 3+ games this
// season. A group ranks by the average improvement of its active members.
//
// Pure: no React, no Supabase.

export type GroupKind = 'school' | 'club' | 'whanau'

export const GROUP_KINDS: readonly GroupKind[] = ['school', 'club', 'whanau']

export const GROUP_KIND_NAMES: Record<GroupKind, string> = { school: 'School', club: 'Club', whanau: 'Whānau' }

/** Games this season before a member counts on the board. */
export const ACTIVE_GAMES = 3

/** How many recent games are averaged against the first. */
export const RECENT_GAMES = 3

/**
 * One member's improvement from their game colour totals this season, in the
 * order played. Null until they are active.
 */
export function memberImprovement(totals: readonly number[]): number | null {
  if (totals.length < ACTIVE_GAMES) return null
  const recent = totals.slice(1).slice(-RECENT_GAMES)
  const avg = recent.reduce((s, t) => s + t, 0) / recent.length
  return Math.round(((avg - totals[0]) / 10) * 100) / 100
}

/** A row of group_board(). */
export type GroupBoardRow = {
  group_id: string
  name: string
  kind: GroupKind
  active_members: number
  games: number
  improvement: number | null
  place: number | null
}

/** A row of group_detail(). */
export type GroupMemberRow = {
  player_id: string
  name: string
  status: 'pending' | 'invited' | 'member'
  games: number
  improvement: number | null
}

/** "+1.4 colours", "−0.3 colours", "Not yet active". */
export function improvementLabel(improvement: number | null): string {
  if (improvement == null) return 'Not yet active'
  const v = Math.round(improvement * 10) / 10
  const n = Math.abs(v).toFixed(1)
  return `${v > 0 ? '+' : v < 0 ? '−' : ''}${n} ${n === '1.0' ? 'colour' : 'colours'}`
}

/** A Postgres error as a short sentence a player can act on. */
export function groupErrorMessage(err: { code?: string; message?: string } | null | undefined): string | null {
  if (!err) return null
  if (err.code === '23505') {
    return err.message?.includes('player_id_kind')
      ? 'Already in a hapū of that kind. Leave it first.'
      : 'A hapū of that kind already has that name.'
  }
  if (err.code === '23514') return 'Names are 2 to 60 characters.'
  if (err.code === '42501') return 'Only the hapū leader can do that.'
  return err.message ?? 'Something went wrong.'
}

/** The tables or functions are not in the database yet (the migration has not run). */
export function groupsNotLive(err: { code?: string } | null | undefined): boolean {
  return !!err && (err.code === 'PGRST202' || err.code === 'PGRST205' || err.code === '42P01' || err.code === '42883')
}
