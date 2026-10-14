// ─── What last year leaves behind ────────────────────────────────────────────
// Scoring v2 step 2 (decision 8, Tāne 15 Oct 2026). Colours reset every
// 1 January and that stays: a season with new prizes is the point. Two things
// soften it:
//
//   GHOST MARKER — on HOME, each domain shows last year's exact score faintly
//   beside this year's, so a player climbing back can see the line to beat.
//
//   HONOURS — on the profile, a lifetime list: each year's overall colour,
//   games played, PRs set and the highest domain colour held. Never reset.
//
// Pure: no React, no Supabase.

import { overallRung } from './grading'
import { heldByYear } from './seasonYear'
import { gradeStateFrom, type GradeInputs, type GradeAward } from './loadGrades'

/**
 * Last year's exact score per domain (the best-six average, the same number
 * HOME shows beside this year's colour), for the domains where there was one.
 */
export function ghostAverages(playerId: string, inputs: GradeInputs, year: number): Map<number, number> {
  const last = gradeStateFrom(playerId, inputs, { year: year - 1 })
  const out = new Map<number, number>()
  for (const d of last.grades.domains) if (d.average > 0) out.set(d.domainNumber, d.average)
  return out
}

export type YearHonours = {
  year: number
  /** The overall colour held that year, capped by that year's games. */
  overall: number
  games: number
  prs: number
  /** The highest domain colour held that year; the lowest domain number wins a tie. */
  best: { domainNumber: number; rung: number } | null
}

/** Every year the player played, logged a PR or held a colour in, newest first. */
export function honoursByYear(
  awards: readonly GradeAward[],
  gamesByYear: ReadonlyMap<number, number>,
  prsByYear: ReadonlyMap<number, number>,
): YearHonours[] {
  const held = new Map(heldByYear(awards).map(y => [y.year, y.held]))
  const years = new Set([...held.keys(), ...gamesByYear.keys(), ...prsByYear.keys()])
  return [...years].sort((a, b) => b - a).map(year => {
    const domains = held.get(year) ?? new Map<number, number>()
    const games = gamesByYear.get(year) ?? 0
    let best: YearHonours['best'] = null
    for (const [domainNumber, rung] of [...domains].sort((a, b) => a[0] - b[0])) {
      if (rung > 0 && (!best || rung > best.rung)) best = { domainNumber, rung }
    }
    return { year, overall: overallRung([...domains.values()], games), games, prs: prsByYear.get(year) ?? 0, best }
  })
}
