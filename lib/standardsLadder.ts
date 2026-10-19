// ─── The colour standards, as one player reads them ──────────────────────────
// Which score earns which colour on one event, on the PLAYER'S OWN ladder: their
// sex's thresholds, moved up the ladder by their age allowance for the event's
// domain exactly as grading moves them (rungForScore; a half shows as the whole
// step below). No switching between divisions (Tāne, 5 Oct 2026).
//
// Pure, with no React or Supabase, and it reads STANDARDS and the lib/grading.ts
// helpers rather than copying a threshold, so it cannot drift from grading. The
// loop below is rungForScore's own loop: a rung is listed when grading could
// award it.
//
// A Game-rung event stops its drills at Kahurangi; Poroporo to Taniwha come from
// a head-to-head rating, which is not age-shifted. A rating-only event (Wrestling)
// has only those rows.

import { STANDARDS } from './standards'
import {
  DRILL_CAP, RATING_FLOOR, RATING_STEP, TOP_RUNG,
  gradeForRung, ratioThresholdsKg, thresholdFor, bwLoadKg,
} from './grading'
import { ladderFor, type GradePlayer } from './playerGrades'
import { ageAllowance, formatAllowance } from './ageAllowance'
import { formatPR } from './scoreFormat'
import { decodeCarry, fmtDistance, fmtTime } from './scoring'
import { isTimedEffort, type EventData } from './eventData'

export type LadderRow = {
  rung: number
  /** The colour's name. */
  name: string
  /** What it takes, in the event's own units. */
  label: string
  kind: 'drill' | 'ratio' | 'rating'
}

const trim = (n: number) => String(Math.round(n * 100) / 100)

/** The line a rating-only event carries above its rating rows. */
export const RATING_ONLY_NOTE = 'No drill colours: this event is graded on games.'

/** Who each band is, in the age a player turns this year. */
/**
 * The line under a ladder that says it is already shifted for age, or null
 * when no shift applies. Without it a player comparing standards with a friend
 * sees different numbers and no reason (Tāne, 20 Oct 2026). Rating colours are
 * never shifted, so a rating-only event says nothing. The allowance is per
 * domain (lib/ageAllowance.ts); a half is shown on the ladder as the whole step
 * below, and the line says where the other half goes.
 */
export function ageAllowanceNote(ev: EventData, player: GradePlayer): string | null {
  if (STANDARDS[ev.slug]?.kind === 'rating') return null
  const a = ageAllowance(player, ev.domainNumber)
  if (!a) return null
  const age = player.ageYears != null ? ` at ${player.ageYears} this year` : ''
  const colours = `+${formatAllowance(a)} colour${a > 1 ? 's' : ''}`
  if (a === Math.floor(a)) return `Includes your ${ev.domain} age allowance: ${colours}${age}.`
  const shown = Math.floor(a)
  return `Your ${ev.domain} age allowance is ${colours}${age}. `
    + (shown ? `These are the +${shown} standards; the extra half counts in your exact score.`
             : 'These are the Open standards; the half counts in your exact score.')
}

/** Does this event's ladder need a bodyweight to read in kilograms? */
export function needsBodyweight(ev: EventData): boolean {
  const s = STANDARDS[ev.slug]
  return s?.kind === 'ratio' || !!s?.bwLoad
}

/**
 * A threshold whose load is a share of bodyweight (12 Oct 2026): "0.25×
 * bodyweight · 30s", with the kilograms once a bodyweight is known. The load
 * key holds thousandths of bodyweight (lib/grading.ts bwLoadThresholds).
 */
function bwLoadLabel(ev: EventData, t: number, bodyweightKg: number | null): string {
  const carry = ev.inputMode === 'weight+distance+time'
  const key = carry ? 1e9 : 10000
  const share = Math.floor(t / key) / 1000, rest = t % key
  const kg = bodyweightKg != null && bodyweightKg > 0 && share > 0 ? ` (${trim(bwLoadKg(share * 1000, bodyweightKg))} kg)` : ''
  const load = share > 0 ? `${trim(share)}× bodyweight${kg}` : 'Bodyweight'
  if (carry) {
    const metres = Math.floor(rest / 10000), term = rest % 10000
    return `${load} · ${fmtDistance(metres)} · ${term > 1 ? `≤ ${fmtTime(10000 - term)}` : 'any time'}`
  }
  if (ev.inputMode === 'weight+reps') return `${load} · ${rest} reps`
  return `${load} · ${rest >= 60 ? fmtTime(rest) : `${rest}s`}`
}

/**
 * One drill threshold in the event's own units. On a raced event a within-level
 * term of 1 is the sheet's "just finish it" (10000 minus 1 would read as nearly
 * three hours), so it says so.
 */
function drillLabel(ev: EventData, t: number): string {
  const raced = ev.inputMode === 'distance+time' || (ev.inputMode === 'difficulty+time' && isTimedEffort(ev.slug))
  if (raced && t % 10000 <= 1) {
    return ev.difficultyTiers?.length ? `D${Math.floor(t / 10000) + 1} · any time` : 'Any time'
  }
  // "D3 · any" (12 Oct 2026): the level done at all. A within-level term of 1
  // would otherwise read as "1 reps" or "1s".
  const tiered = !!ev.difficultyTiers?.length && ev.inputMode.startsWith('difficulty+')
  if (tiered && t % 10000 === 1) {
    const idx = Math.floor(t / 10000)
    if (ev.difficultyTiers![idx]?.scoring !== 'weight') return `D${idx + 1} · any`
  }
  if (ev.inputMode === 'weight+distance+time') {
    // A loaded carry's time is raced too: 10000 minus the seconds, so a floor
    // standard with no time attached would read as nearly three hours.
    const d = decodeCarry(t)
    if (d.secs >= 6000) return `${d.weightKg}kg · ${fmtDistance(d.metres)} · any time`
  }
  return formatPR(t, ev.inputMode, ev.slug, ev)
}

export function standardsLadder(
  ev: EventData,
  player: GradePlayer,
  bodyweightKg: number | null,
): LadderRow[] {
  const s = STANDARDS[ev.slug]
  if (!s) return []
  const shift = Math.floor(ageAllowance(player, ev.domainNumber))
  const rows: LadderRow[] = []
  const row = (rung: number, label: string, kind: LadderRow['kind']) =>
    rows.push({ rung, name: gradeForRung(rung).name, label, kind })

  const ratingRows = () => {
    for (let r = DRILL_CAP + 1; r <= TOP_RUNG; r++) {
      row(r, `Rating ${(RATING_FLOOR + (r - DRILL_CAP - 1) * RATING_STEP).toLocaleString('en-NZ')}`, 'rating')
    }
  }
  if (s.kind === 'rating') { ratingRows(); return rows }

  const ladder = s.all ?? s[ladderFor(player)] ?? []
  if (ladder.length === 0) return []
  const top = Math.min(s.game ? DRILL_CAP : TOP_RUNG, ladder.length + shift, TOP_RUNG)

  if (s.kind === 'ratio') {
    const ratios = ladder.map(r => r || null)
    const kgs = bodyweightKg != null && bodyweightKg > 0 ? ratioThresholdsKg(ratios, bodyweightKg) : null
    for (let r = 1; r <= top; r++) {
      const ratio = Math.max(0, thresholdFor(ladder, r - shift))
      if (ratio <= 0) { row(r, 'Any lift', 'ratio'); continue }
      const kg = kgs ? Math.max(0, thresholdFor(kgs, r - shift)) : null
      row(r, `${trim(ratio)}× bodyweight${kg != null ? ` · ${trim(kg)} kg` : ''}`, 'ratio')
    }
    return rows
  }

  for (let r = 1; r <= top; r++) {
    const t = thresholdFor(ladder, r - shift)
    // Below the Open floor the ladder is extrapolated; at or under zero that
    // is "any score".
    row(r, t > 0 ? (s.bwLoad ? bwLoadLabel(ev, t, bodyweightKg) : drillLabel(ev, t)) : 'Any score', 'drill')
  }
  if (s.game) ratingRows()
  return rows
}
