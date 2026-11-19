// ─── The season board, ranked on colour ──────────────────────────────────────
// Tāne, 18 Nov 2026: the season board ranks on each player's top colour, the
// way HOME shows it: the OVERALL colour, the average of the ten domain colours
// conferred this year, rounded down and capped by this year's games
// (overallRung in lib/grading.ts, colourStanding in lib/colourBoard.ts).
// Ties break the way rankByColours does (lib/colourBoard.ts): the sum of the
// ten domain colours, then domains held; then the season's COLOUR SCORE, then
// games played.
//
// The colour score is every colour total the player scored in this season's
// finished, unvoided official games (player_game_colours, up to 120 a game),
// added up. It is shown on each row with the average and the best single game.
// It replaced the place points (100, 99, 98 …, 28 Sept 2026) as the season's
// number, and breaks a tie on colour.
//
// The board lists the players with a game this season. There is no movement
// arrow: a colour is conferred when a recheck runs, not per game, so there is
// no "board as it stood before the latest game" to compare with.
//
// Pure, so it is tested; the page only reads rows and hands them in.

import { rankBy } from './leaderboardScores'

export type SeasonGame = { id: string; started_at: string | null; session_date: string | null }
export type GameColourRow = { player_id: string; session_id: string; colour_total: number }
export type BoardPlayer = { name: string; division: string | null }
/** A player's colour this year, from colourStanding (lib/colourBoard.ts). */
export type PlayerColour = { overall: number; colourSum: number; domainsHeld: number }

export type ColourStanding = PlayerColour & {
  playerId: string
  name: string
  division: string | null
  /** The season's colour score: every game's colour total, summed. */
  total: number
  games: number
  /** Total over games, to one decimal. */
  average: number
  /** The best single game's colour total. */
  best: number
  rank: number
}

/** Sums float colour totals without drifting off tenths (4.5 + 3.1 ≠ 7.6 in floats). */
const tenths = (n: number) => Math.round(n * 10) / 10

const NO_COLOUR: PlayerColour = { overall: 0, colourSum: 0, domainsHeld: 0 }

/**
 * The season board. `games` are the year's finished, unvoided official games;
 * `rows` their published colour totals; `players` the board's eligible
 * players (not guests, not retired), already filtered to the division shown;
 * `colourOf` each player's colour this year. A row whose game or player is not
 * listed is ignored.
 */
export function seasonColourBoard(
  games: readonly SeasonGame[],
  rows: readonly GameColourRow[],
  players: ReadonlyMap<string, BoardPlayer>,
  colourOf: (playerId: string) => PlayerColour | undefined,
): ColourStanding[] {
  const ids = new Set(games.map(g => g.id))
  const by = new Map<string, { total: number; games: number; best: number }>()
  for (const r of rows) {
    if (!ids.has(r.session_id) || !players.has(r.player_id)) continue
    const s = by.get(r.player_id) ?? { total: 0, games: 0, best: 0 }
    const t = Number(r.colour_total) || 0
    s.total = tenths(s.total + t)
    s.games += 1
    s.best = Math.max(s.best, t)
    by.set(r.player_id, s)
  }
  const list = [...by].map(([playerId, s]) => {
    const p = players.get(playerId)!
    return {
      playerId, name: p.name, division: p.division,
      ...(colourOf(playerId) ?? NO_COLOUR),
      ...s, average: tenths(s.total / s.games),
    }
  })
  return rankBy(list, r => [r.overall, r.colourSum, r.domainsHeld, r.total, r.games])
}

/**
 * A game's colour total as the colour it was played at: ten events, each up to
 * Taniwha (12), so a tenth of the total, rounded down, capped at Taniwha.
 * 0 is Mā. The leaderboard card shows the best game this way, not as a number
 * (Tāne, 19 Nov 2026).
 */
export function bestGameRung(total: number): number {
  if (!(total > 0)) return 0
  return Math.min(12, Math.floor(tenths(total) / 10 + 1e-9))
}
