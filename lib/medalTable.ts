// ─── The season medal table ──────────────────────────────────────────────────
// A player's 1st, 2nd and 3rd finishes in a calendar year, ranked Olympic
// style: most 1sts, then most 2nds, then most 3rds. Players level on all three
// share a place. Pure, so it can be tested and the rule lives in one place.
//
// The placement is `results.placement`: the player's rank in their EXACT
// division for the whole game, written on every one of their rows when the
// game closes (award_session_points). Only the official events decide it.
//
// Decided with Tāne on 2026-09-19: every placement counts, including a game
// where the player was the only one in their division. Most divisions have one
// player on the day, and that is accepted, not filtered.
//
// Games that were voided, or never closed, carry no placement, so they add a
// game to nobody's medal count and are not counted as a game either.

export type MedalResultRow = { player_id: string | null; session_id: string; placement: number | null }
export type MedalSessionRow = { id: string; session_date: string }

export type MedalCount = { gold: number; silver: number; bronze: number; games: number }

export type MedalRow = MedalCount & { playerId: string; name: string; rank: number }

/** Each player's medals and placed games in `year`, keyed by player id. */
export function seasonMedals(
  results: readonly MedalResultRow[],
  sessions: readonly MedalSessionRow[],
  year: number,
): Map<string, MedalCount> {
  const prefix = `${year}-`
  const inYear = new Set(sessions.filter(s => s.session_date?.startsWith(prefix)).map(s => s.id))
  // One placement per (player, game): every row of a player carries the same one.
  const placed = new Map<string, number>()
  for (const r of results) {
    if (!r.player_id || r.placement == null || !inYear.has(r.session_id)) continue
    const key = `${r.player_id}|${r.session_id}`
    const prev = placed.get(key)
    if (prev == null || r.placement < prev) placed.set(key, r.placement)
  }
  const out = new Map<string, MedalCount>()
  for (const [key, placement] of placed) {
    const playerId = key.slice(0, key.indexOf('|'))
    const c = out.get(playerId) ?? { gold: 0, silver: 0, bronze: 0, games: 0 }
    c.games++
    if (placement === 1) c.gold++
    else if (placement === 2) c.silver++
    else if (placement === 3) c.bronze++
    out.set(playerId, c)
  }
  return out
}

const keyOf = (r: MedalCount) => [r.gold, r.silver, r.bronze]

/** Olympic order. Ties on gold, silver and bronze share a rank; names break display order only. */
export function rankMedals(players: readonly (MedalCount & { playerId: string; name: string })[]): MedalRow[] {
  const rows: MedalRow[] = players.map(p => ({ ...p, rank: 0 }))
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
