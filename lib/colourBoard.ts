// ─── The colours leaderboard ─────────────────────────────────────────────────
// Points retired in September 2026, so the board ranks on colours. Pure, so it
// can be tested, and so the ordering rule lives in exactly one place.
//
// The order, most important first:
//   1. The overall colour (the average of the ten domains, rounded down;
//      overallRung in lib/grading.ts).
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
  games: number
}

export type BoardRow = BoardInput & {
  rank: number
  /** The average domain colour, rounded down. 0 = Mā. */
  overall: number
  domainsHeld: number
  colourSum: number
}

export function colourStanding(held: Map<number, number> | undefined) {
  const rungs = held ? [...held.values()].filter(r => r > 0) : []
  const domainsHeld = rungs.length
  return {
    domainsHeld,
    colourSum: rungs.reduce((s, r) => s + r, 0),
    overall: overallRung(rungs),
  }
}

const keyOf = (r: BoardRow) => [r.overall, r.colourSum, r.domainsHeld, r.games]

export function rankByColours(players: readonly BoardInput[]): BoardRow[] {
  const rows: BoardRow[] = players.map(p => ({ ...p, rank: 0, ...colourStanding(p.held) }))
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
