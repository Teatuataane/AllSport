// ─── Active player — the pure half ───────────────────────────────────────────
// Types and decisions with no React and no Supabase, so they can be unit tested.
// `lib/useActivePlayer.ts` builds the hook on top and re-exports these.
//
// This split is not tidiness. `useActivePlayer.ts` calls `createClient()` at
// module scope, so importing it from a test throws before a single assertion
// runs — the same reason lib/judgeRoster.ts and lib/percentile.ts are pure.

export const ACTIVE_PLAYER_KEY = 'allsport_active_player_id'

export type ActivePlayerRow = {
  id: string
  full_name: string | null
  display_name: string | null
  username: string | null
  division: string | null
  date_of_birth: string | null
  icon: string | null
  role?: string | null
}

/**
 * The stored id is only honoured when it names someone in this household.
 * Anything else — a stale id from a removed family member, a hand-edited value,
 * another player's uuid — falls back to the signed-in user.
 *
 * This is a real guard, not a formality. localStorage is editable from any
 * console, and RLS on `players` fails SILENTLY: a query for a stranger's row
 * returns zero rows rather than an error, so without this the page would render
 * empty under someone else's name instead of refusing.
 */
export function resolveActiveId(
  stored: string | null,
  selfId: string,
  family: ActivePlayerRow[],
): string {
  if (!stored || stored === selfId) return selfId
  return family.some(m => m.id === stored) ? stored : selfId
}

/**
 * Display name, never blank. Mirrors `players_public.display_name`'s coalesce
 * order — and treats whitespace as missing, because a blank display_name once
 * shipped as an empty chip in the kaiwhakawā roster: `??` does not catch `''`.
 */
export function playerLabel(p: ActivePlayerRow | null | undefined): string {
  if (!p) return '—'
  const name = p.display_name?.trim() || p.username?.trim() || p.full_name?.trim()
  return name || '—'
}
