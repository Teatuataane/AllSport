// ─── AllSport division pools + session wins ──────────────────────────────────
// This file used to hold a multiplayer Elo engine. Session 24 replaced the
// player-facing skill score with a literal best-score percentile (lib/percentile.ts)
// and the Elo was kept "for sessionWins" — but sessionWins is a plain
// `placement = 1` count that never touched a rating, so computeRatings/eloTo100/
// domainRatings had zero call sites and were deleted in the August 2026
// performance pass. See PERF_AGGREGATION_PLAN.md.
//
// Percentiles are now the single ranking metric in the UI. Do not reintroduce a
// second one without deciding which is authoritative: the old pair exported
// `topDomain` from BOTH this file and percentile.ts, which is why the leaderboard
// still imports the surviving one as `pctTopDomain`.
//
// The `Rating*` row-type names are kept because they are referenced across the
// dashboard, leaderboard, percentile.ts and CLAUDE.md; they describe the shape
// of the rows those pages load, not a rating.

export type RatingResultRow = {
  player_id: string | null
  session_id: string
  event_id: string
  raw_score: number | null
}
export type RatingEventRow = { id: string; session_id: string; event_name: string }
export type RatingSessionRow = { id: string; session_date: string }
export type RatingPlayerRow = { id: string; division: string | null }

// Unified pools, matching the live session leaderboard
export function divisionPool(division: string | null | undefined): 'men' | 'women' | 'juniors' | null {
  switch (division) {
    case "Men's":
    case 'Masters Men':
    case 'Grandmaster Men':
      return 'men'
    case "Women's":
    case 'Masters Women':
    case 'Grandmaster Women':
      return 'women'
    case 'Juniors':
    case 'Youth': // legacy value, treated as Juniors everywhere
      return 'juniors'
    default:
      return null
  }
}

// ─── Wins ────────────────────────────────────────────────────────────────────
// A win = 1st overall in your division for a session. results.placement stores
// the division rank for the whole session on every row, so a session is won
// when any row for that (player, session) has placement 1.
export function sessionWins(
  rows: { player_id: string | null; session_id: string; placement: number | null }[]
): Map<string, number> {
  const wonSessions = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.player_id || r.placement !== 1) continue
    if (!wonSessions.has(r.player_id)) wonSessions.set(r.player_id, new Set())
    wonSessions.get(r.player_id)!.add(r.session_id)
  }
  return new Map([...wonSessions].map(([p, s]) => [p, s.size]))
}
