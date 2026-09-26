// ─── The colours leaderboard ─────────────────────────────────────────────────
// Points retired in September 2026, so the board ranks on colours. Pure, so it
// can be tested, and so the ordering rule lives in exactly one place.
//
// The order, most important first:
//   1. The overall colour (the average of the ten domains, rounded down and
//      capped by games played; overallRung in lib/grading.ts).
//   2. The sum of the ten domain colours held — progress toward the overall.
//   3. Domains holding any colour.
//   4. Games played. Nobody held a conferred colour at launch, so without this
//      the whole board would tie at 1st; it is also the honest tie-break, since
//      a colour needs games in the room.
//
// Ties on all four share a rank, like a tied event.

import { overallRung } from './grading'

export type BoardInput = {
  playerId: string
  name: string
  /** Domain number -> highest conferred colour. */
  held: Map<number, number> | undefined
  /**
   * Official games: finished, unvoided sessions with a result. It CAPS the
   * overall colour as well as breaking ties, so it must be counted the way
   * HOME counts it (gameEvidence) — see countGames.
   */
  games: number
}

export type BoardRow = BoardInput & {
  rank: number
  /** The average domain colour, rounded down and capped by games. 0 = Mā. */
  overall: number
  domainsHeld: number
  colourSum: number
}

export function colourStanding(held: Map<number, number> | undefined, games: number) {
  const rungs = held ? [...held.values()].filter(r => r > 0) : []
  const domainsHeld = rungs.length
  return {
    domainsHeld,
    colourSum: rungs.reduce((s, r) => s + r, 0),
    overall: overallRung(rungs, games),
  }
}

/**
 * Official games per player from public result rows: distinct sessions, less
 * the ones that do not count yet or ever — the game still running and every
 * voided one. The same definition gameEvidence applies on HOME, so the games
 * cap on the overall colour lands on the same colour everywhere.
 */
export function countGames(
  rows: readonly { player_id: string | null; session_id: string }[],
  excluded: ReadonlySet<string>,
): Map<string, number> {
  const seen = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.player_id || excluded.has(r.session_id)) continue
    const s = seen.get(r.player_id) ?? new Set<string>()
    s.add(r.session_id)
    seen.set(r.player_id, s)
  }
  return new Map([...seen].map(([id, s]) => [id, s.size]))
}

/**
 * What a board cell shows as the overall colour: the rung, or null while it is
 * still Mā, so the cell can count domains instead. One rule for the leaderboard
 * and the kaiwhakawā Players tab.
 */
export function displayOverall(r: Pick<BoardRow, 'overall'>): number | null {
  return r.overall > 0 ? r.overall : null
}

// overall = floor(colourSum / 10), so it never reorders anything colourSum
// would not; it leads the key because it is what the board SHOWS, and a tie
// on it is then broken by the finer sum. Depth beats breadth here on purpose:
// that is what an average means (one Taniwha domain outranks ten Kiwikiwi).
const keyOf = (r: BoardRow) => [r.overall, r.colourSum, r.domainsHeld, r.games]

export function rankByColours(players: readonly BoardInput[]): BoardRow[] {
  const rows: BoardRow[] = players.map(p => ({ ...p, rank: 0, ...colourStanding(p.held, p.games) }))
  rows.sort((a, b) => {
    const ka = keyOf(a), kb = keyOf(b)
    for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return a.name.localeCompare(b.name)
  })
  rows.forEach((r, i) => {
    const prev = rows[i - 1]
    r.rank = prev && keyOf(prev).every((v, j) => v === keyOf(r)[j]) ? prev.rank : i + 1
  })
  return rows
}
