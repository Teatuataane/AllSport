// ─── Official games per player, read from the database ───────────────────────
// The games count caps the overall colour (overallRung in lib/grading.ts), so
// every surface that shows one must count the same way. HOME counts through
// gameEvidence; /leaderboard counts the rows its RPC payload already carries;
// the family chips and the kaiwhakawā Players tab count through here. All three
// use countGames (lib/colourBoard.ts): distinct sessions with a result, less the
// game still running and every voided one.
//
// PAGED, because PostgREST caps a response at the project's max_rows (1000),
// and `.range()` cannot lift a server-side cap. `results` passed 1000 rows in
// September 2026, so a single request silently undercounted, and an
// undercounted games total shows a LOWER overall colour than the board.
//
// Takes its client as an argument, like lib/loadGrades.ts, so it has no
// opinion about browser or server.

import type { SupabaseClient } from '@supabase/supabase-js'
import { countGames } from './colourBoard'

const PAGE = 1000
/** A backstop against a runaway loop, far above any real history. */
const MAX_PAGES = 100

/**
 * Games per player, or null when the count could not be read in full. Null
 * means UNKNOWN: a caller must not treat it as zero games, or a failed read
 * would show every player Mā overall.
 *
 * `playerIds` narrows the read to those players (a household); null reads all.
 */
export async function loadGameCounts(
  db: SupabaseClient,
  playerIds: readonly string[] | null,
): Promise<Map<string, number> | null> {
  if (playerIds && playerIds.length === 0) return new Map()

  const rows: { player_id: string | null; session_id: string }[] = []
  // KEYSET, not offset: a score written or deleted mid-scan (a live game)
  // would shift an offset page and skip a row.
  let after: string | null = null
  for (let page = 0; page < MAX_PAGES; page++) {
    let q = db.from('results').select('id, player_id, session_id')
    if (playerIds) q = q.in('player_id', [...playerIds])
    if (after) q = q.gt('id', after)
    const { data, error } = await q.order('id', { ascending: true }).limit(PAGE)
    if (error) return null
    const got = (data ?? []) as (typeof rows[number] & { id: string })[]
    rows.push(...got)
    if (got.length < PAGE) break
    after = got[got.length - 1].id
    if (page === MAX_PAGES - 1) return null
  }

  // A failed read here only ever OVER-counts (a voided game counts), which is
  // the survivable direction: the domains still have to be earned.
  const { data: notGames, error } = await db.from('sessions').select('id').or('is_active.eq.true,voided_at.not.is.null')
  const excluded = new Set(((error ? [] : notGames) ?? []).map(r => r.id as string))
  return countGames(rows, excluded)
}
