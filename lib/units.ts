// ─── Effort units ────────────────────────────────────────────────────────────
// The training currency inside colours (workout logging, September 2026).
// Every domain colour needs three things: the standards met in half the domain,
// the games quota, and a number of effort units in THAT domain since the last
// colour there (lib/grading.ts holds the numbers; this module says what one
// unit IS).
//
// Any completed unit counts. There is deliberately no intensity floor: the
// standards gate tests intensity, the training gate measures time on the mat,
// and an easy or injury-modified session still counts.
//
// What a unit is, per event, is COMPILED from WORKOUT_UNITS_REVIEW.md into
// lib/unitSheet.ts, the same way the standards are. Never hand-edit a unit
// size here or in the generated file; change the sheet and re-run
// scripts/apply-units-sheet.mjs.
//
// Pure: no React, no Supabase. Used by the grading engine, the logging page and
// the live session screen, so all three count the same way.

import { getEventBySlug, getEventByName, isTimedEffort, type EventData } from './eventData'
import { UNIT_SHEET, type UnitRule } from './unitSheet'

export type { UnitRule }

/** What one unit is, in words, for the log form and the sheet. */
export const RULE_WORDS: Record<UnitRule, { one: string; many: string }> = {
  set: { one: 'set', many: 'sets' },
  hold: { one: 'hold', many: 'holds' },
  distance: { one: 'metre', many: 'metres' },
  attempts: { one: 'attempt', many: 'attempts' },
  game: { one: 'game', many: 'games' },
  round: { one: 'round', many: 'rounds' },
}

/** Metres in a rung name: "250m", "1000m", "5kg — 200m", "1.5km". Null when there are none. */
export function metresIn(name: string): number | null {
  const m = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(km|m)\b/gi)].pop()
  return m ? Number(m[1]) * (m[2].toLowerCase() === 'km' ? 1000 : 1) : null
}

/** Is this rung a Game rung (a win, draw or loss) rather than a drill? */
export function isGameTier(ev: EventData, tierName: string | null | undefined): boolean {
  if (ev.inputMode === 'sport') return true
  return !!tierName && (ev.difficultyTiers ?? []).some(t => t.name === tierName && t.scoring === 'sport')
}

/**
 * The default rule for an event, before Tāne's review. Used ONLY to generate
 * the review sheet; the app reads the compiled sheet.
 *
 *   one working set    strength, reps, difficulty+reps, time, sprint
 *   one hold           hold, weight+time, a difficulty+time HOLD
 *   the top rung's     a difficulty+time TIMED EFFORT whose rungs are all
 *   distance           distances (Cycling's 1000m); otherwise one effort
 *   three attempts     distance, difficulty+distance (throws and jumps)
 *   one game           sport
 *   one round          score (four holes)
 *
 * A Game rung on a drill ladder always counts one game, whatever the rule.
 */
export function defaultRule(ev: EventData): { rule: UnitRule; per: number } {
  switch (ev.inputMode) {
    case 'sport': return { rule: 'game', per: 1 }
    case 'score': return { rule: 'round', per: 1 }
    case 'distance': case 'difficulty+distance': return { rule: 'attempts', per: 3 }
    case 'hold': case 'weight+time': return { rule: 'hold', per: 1 }
    case 'difficulty+time': {
      if (!isTimedEffort(ev.slug)) return { rule: 'hold', per: 1 }
      const drills = (ev.difficultyTiers ?? []).filter(t => t.scoring !== 'sport').map(t => metresIn(t.name))
      if (drills.length === 0 || drills.some(d => d == null)) return { rule: 'set', per: 1 }
      const top = Math.max(...(drills as number[]))
      // A ladder of LOADS over one distance (Weighted Carry) is one effort per carry.
      if (drills.every(d => d === top)) return { rule: 'set', per: 1 }
      return { rule: 'distance', per: top }
    }
    default: return { rule: 'set', per: 1 }
  }
}

/** The compiled rule for an event. Falls back to the default for an event the sheet has not caught up with. */
export function unitRule(ev: EventData): { rule: UnitRule; per: number } {
  return UNIT_SHEET[ev.slug] ?? defaultRule(ev)
}

/**
 * Units one game RESULT earns: one row is one completion. A distance rung earns
 * its share of the unit distance (a 250m row on a 1000m unit is a quarter).
 */
export function unitsForResult(ev: EventData, tierName: string | null | undefined): number {
  if (isGameTier(ev, tierName)) return 1
  const { rule, per } = unitRule(ev)
  if (rule === 'distance') {
    const m = tierName ? metresIn(tierName) : null
    return m ? m / per : 1
  }
  return 1 / per
}

/**
 * Units a logged VOLUME earns: `count` completions (sets, holds, attempts,
 * games, rounds), or `distanceM` on a distance event. Whichever the rule does
 * not use is ignored, so a ride logged as "25km" and a ride logged as "1 ride"
 * never both count.
 */
export function unitsForVolume(ev: EventData, v: { count?: number | null; distanceM?: number | null }): number {
  const { rule, per } = unitRule(ev)
  if (rule === 'distance') return Math.max(0, v.distanceM ?? 0) / per
  return Math.max(0, v.count ?? 0) / per
}

/** Units for a results row identified by event name. Retired events earn nothing. */
export function unitsForResultRow(row: { event_name: string; difficulty_tier: string | null }): { domain: number; units: number } | null {
  const ev = getEventByName(row.event_name)
  if (!ev) return null
  return { domain: ev.domainNumber, units: unitsForResult(ev, row.difficulty_tier) }
}

/** Units for a logged entry identified by slug. An entry not fitted to an event earns nothing yet. */
export function unitsForEntryRow(row: { event_slug: string | null; count: number | null; volume_distance_m: number | null }): { domain: number; units: number } | null {
  const ev = row.event_slug ? getEventBySlug(row.event_slug) : undefined
  if (!ev) return null
  return { domain: ev.domainNumber, units: unitsForVolume(ev, { count: row.count, distanceM: row.volume_distance_m }) }
}

/** Units a set of game results earned on one event. */
export function unitsIn(ev: EventData | undefined, rows: readonly { difficulty_tier: string | null }[]): number {
  return ev ? rows.reduce((sum, r) => sum + unitsForResult(ev, r.difficulty_tier), 0) : 0
}

/**
 * Rounded DOWN for display, so a player is never shown a unit they have not
 * finished: whole units, or one decimal under ten. The tolerance matches the
 * training gate's (lib/grading.ts UNIT_EPSILON), so a gate that is met never
 * reads as "2.9 of 3".
 */
export function fmtUnits(u: number): string {
  if (u >= 10) return String(Math.floor(u + 1e-6))
  const t = Math.floor(u * 10 + 1e-6) / 10
  return Number.isInteger(t) ? String(t) : t.toFixed(1)
}

/** "3 units", "1 unit", "2.5 units": plural from what is SHOWN, not the raw float. */
export function fmtUnitsLabel(u: number): string {
  const n = fmtUnits(u)
  return `${n} unit${n === '1' ? '' : 's'}`
}

/**
 * What a unit is, in five plain lines, for readers rather than the engine.
 * Read from the compiled sheet, never typed: if the sheet changes a unit, every
 * page that explains units follows it (How To Play and /grades both use this).
 */
export function unitRulesSummary(): { label: string; rule: string }[] {
  const per = (slug: string) => { const e = getEventBySlug(slug); return e ? unitRule(e).per : 1 }
  const rideKm = per('cycling') / 1000
  const throws = per('javelin-throw')
  return [
    { label: 'Lifts and reps', rule: 'Every working set is 1 unit' },
    { label: 'Holds', rule: 'Every hold is 1 unit' },
    { label: 'Rides, runs, rows', rule: `${rideKm}km is 1 unit, so a 25km ride is ${25 / rideKm}` },
    { label: 'Throws and jumps', rule: `Every ${throws} attempts is 1 unit` },
    { label: 'Games', rule: 'Every game is 1 unit' },
  ]
}
