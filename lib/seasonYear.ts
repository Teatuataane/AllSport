// ─── The colour year ─────────────────────────────────────────────────────────
// Colours are earned per calendar year, January to December, NZ time (Tāne,
// 13 Oct 2026). On 1 January every domain starts again on Mā, and last year's
// colours stay on record ("2026: Kōwhai"). The rules inside a year are
// unchanged; what changes is which evidence and which awards a year sees:
//
//   · a game result belongs to its session's NZ day (session_date), a logged
//     entry to the day it was trained (performed_on);
//   · an award belongs to grade_awards.season_year (20261012230318), or the NZ
//     year it was conferred in against a database that has not caught up;
//   · the games cap counts that year's official games, same table;
//   · a head-to-head rating stays lifetime, but its colour only counts in a
//     year the player played that sport (gradeStateFrom applies that).
//
// Pure: no Supabase, no React.

/** The NZ calendar year of an instant (default now). 1 January NZ is still 31 December in UTC. */
export function nzYear(at: Date | string | number = new Date()): number {
  const d = at instanceof Date ? at : new Date(at)
  return Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric' }).format(d))
}

/** The year of an NZ day string ("2026-12-31"), or null when there is none. */
export function yearOfDay(day: string | null | undefined): number | null {
  if (!day || !/^\d{4}-/.test(day)) return null
  return Number(day.slice(0, 4))
}

/** The year an award belongs to: its stored season_year, else the NZ year it was conferred. */
export function awardYear(a: { season_year?: number | null; conferred_at: string }): number {
  return a.season_year ?? nzYear(a.conferred_at)
}

/** Awards for one year. */
export function awardsInYear<T extends { season_year?: number | null; conferred_at: string }>(
  awards: readonly T[],
  year: number,
): T[] {
  return awards.filter(a => awardYear(a) === year)
}

/**
 * How long into January last year's colours can still be conferred. A game on
 * 31 December whose scores are typed in on 2 January, or a player who does not
 * open the app until the new year, must still get the 2026 colour that game
 * earned. Two weeks covers both; after that last year is closed.
 */
export const LATE_DAYS = 14

/**
 * The years a recheck grades at `at`: this year, and last year as well during
 * the first LATE_DAYS of January. This year comes first.
 */
export function yearsToGrade(at: Date | string | number = new Date()): number[] {
  const d = at instanceof Date ? at : new Date(at)
  const parts = new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(d)
  const get = (t: string) => Number(parts.find(p => p.type === t)?.value)
  const year = get('year')
  return get('month') === 1 && get('day') <= LATE_DAYS ? [year, year - 1] : [year]
}

/**
 * The highest colour held per domain in each year, newest year first. What
 * /profile lists and what HOME's "2026: Kōwhai" line is read from.
 */
export function heldByYear(
  awards: readonly { domain_number: number; rung: number; season_year?: number | null; conferred_at: string }[],
): { year: number; held: Map<number, number> }[] {
  const out = new Map<number, Map<number, number>>()
  for (const a of awards) {
    const y = awardYear(a)
    const m = out.get(y) ?? new Map<number, number>()
    m.set(a.domain_number, Math.max(m.get(a.domain_number) ?? 0, a.rung))
    out.set(y, m)
  }
  return [...out].sort((a, b) => b[0] - a[0]).map(([year, held]) => ({ year, held }))
}
