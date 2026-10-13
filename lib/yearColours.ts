// ─── Conferred colours per player, for one year ──────────────────────────────
// The kaiwhakawā Players tab, the family chips and /leaderboard show many
// players' overall colours at once. Colours are per NZ calendar year
// (lib/seasonYear.ts), so each reads the awards of ONE year, and pairs them
// with that year's games count (loadGameCounts with a year), which caps the
// overall colour.
//
// Takes its client as an argument, like lib/loadGrades.ts.

import type { SupabaseClient } from '@supabase/supabase-js'
import { awardYear } from './seasonYear'

export type AwardRow = {
  player_id: string
  domain_number: number
  rung: number
  conferred_at: string
  season_year?: number | null
}

const PAGE = 1000
const MAX_PAGES = 100

/**
 * Every award of the given players (all when null). Paged by keyset: one row
 * per colour per year adds up. season_year arrived with 20261012230318; a
 * missing COLUMN is 42703 and takes the whole read down, so it is asked for and
 * the read re-run without it (awardYear then reads the year from conferred_at).
 * Null when the read failed.
 */
export async function loadAwardRows(
  db: SupabaseClient,
  playerIds: readonly string[] | null,
): Promise<AwardRow[] | null> {
  if (playerIds && playerIds.length === 0) return []
  const read = async (cols: string) => {
    const rows: (AwardRow & { id: string })[] = []
    let after: string | null = null
    for (let page = 0; page < MAX_PAGES; page++) {
      let q = db.from('grade_awards').select(cols)
      if (playerIds) q = q.in('player_id', [...playerIds])
      if (after) q = q.gt('id', after)
      const { data, error } = await q.order('id', { ascending: true }).limit(PAGE)
      if (error) return { rows: null, code: error.code }
      const got = (data ?? []) as unknown as (AwardRow & { id: string })[]
      rows.push(...got)
      if (got.length < PAGE) return { rows, code: null }
      after = got[got.length - 1].id
    }
    return { rows: null, code: null }
  }
  const base = 'id, player_id, domain_number, rung, conferred_at'
  const withYear = await read(`${base}, season_year`)
  if (withYear.code !== '42703') return withYear.rows
  return (await read(base)).rows
}

/** Highest colour per domain, per player, in `year`. */
export function heldInYear(rows: readonly AwardRow[], year: number): Map<string, Map<number, number>> {
  const held = new Map<string, Map<number, number>>()
  for (const a of rows) {
    if (awardYear(a) !== year) continue
    const m = held.get(a.player_id) ?? new Map<number, number>()
    m.set(a.domain_number, Math.max(m.get(a.domain_number) ?? 0, a.rung))
    held.set(a.player_id, m)
  }
  return held
}
