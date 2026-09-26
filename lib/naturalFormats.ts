// ─── Natural input formats ───────────────────────────────────────────────────
// How people actually train, converted into the score AllSport ranks.
//
// Two families clash with the official formats, and only two (the September
// 2026 research pass): strength, which people log as sets of weight × reps
// while the official score is a heaviest single; and distance efforts, which
// people log as "5km in 26:10" while the official score is a fixed rung.
// Everything else — reps, holds, throws, games — is already logged the way it
// is scored.
//
// Both conversions are published formulas, used only inside the range they are
// reliable in, and the result is always shown as an ESTIMATE beside what was
// actually done: "100kg × 5 · est. 1RM 112.5kg". Outside the range the effort
// is still recorded; it just does not touch the standards.
//
// ONLY for swapped, extra and personal-game events. An official event keeps the
// official format, so a prediction can never beat a measured result in a game.
//
// Pure: no React, no Supabase.

import { encodeDiffTime, isTimedEffort, type EventData } from './eventData'
import { metresIn, unitRule } from './units'
import { fmtTime } from './scoring'

// ─── Strength: Brzycki ───────────────────────────────────────────────────────

/** Reps Brzycki is trusted within. Past 10 the estimate drifts badly (±5% becomes anyone's guess). */
export const MAX_ESTIMATED_REPS = 10

/**
 * Brzycki: 1RM = w × 36 / (37 − r). Chosen over Epley because between 2 and 10
 * reps it always gives the LOWER number (100kg × 5 is 112.5 rather than 116.7),
 * and a number that can only be wrong should be wrong low — the same reasoning
 * as `GOOD_SESSION_POINTS_LOW`. They agree exactly at 10.
 *
 * Returns null outside 1–10 reps, or on a non-positive load.
 */
export function brzycki(weightKg: number, reps: number): number | null {
  if (!(weightKg > 0) || !Number.isFinite(reps)) return null
  if (reps < 1 || reps > MAX_ESTIMATED_REPS) return null
  if (reps === 1) return weightKg
  return Math.round((weightKg * 36) / (37 - reps) * 10) / 10
}

/** One set as a player logs it. */
export type SetRow = { weightKg: number; reps: number }

/**
 * The best set of a workout, by estimated 1RM — NOT by load. Five reps at 100kg
 * is a better lift than one at 105kg, and the official score is a 1RM, so the
 * set that predicts the highest 1RM is the one that counts.
 */
export function bestSet(sets: readonly SetRow[]): { set: SetRow; oneRm: number } | null {
  let best: { set: SetRow; oneRm: number } | null = null
  for (const s of sets) {
    const e = brzycki(s.weightKg, s.reps)
    if (e === null) continue
    if (!best || e > best.oneRm) best = { set: s, oneRm: e }
  }
  return best
}

// ─── Distance: Riegel ────────────────────────────────────────────────────────

/**
 * How much longer than the rung an effort may be and still predict it. Riegel
 * holds across a wide range, but a marathon predicting a 1km says more about
 * the formula than about the runner.
 */
export const MAX_DISTANCE_RATIO = 10

/**
 * Riegel: T2 = T1 × (D2/D1)^1.06. Validated for running, cycling and rowing,
 * which is why it is used for every distance event rather than Paul's law
 * (rowing only, and calibrated on 2k rowers).
 *
 * SHORTENS only: predicting a longer distance from a shorter one would invent
 * an endurance the player has not shown. Returns null outside the range.
 */
export function riegel(t1Secs: number, d1Metres: number, d2Metres: number): number | null {
  if (!(t1Secs > 0) || !(d1Metres > 0) || !(d2Metres > 0)) return null
  if (d2Metres > d1Metres) return null
  if (d1Metres > d2Metres * MAX_DISTANCE_RATIO) return null
  return Math.round(t1Secs * Math.pow(d2Metres / d1Metres, 1.06))
}

/** The drill rungs of a distance ladder, with the metres each one covers. */
export function distanceRungs(ev: EventData): { level: number; name: string; metres: number }[] {
  return (ev.difficultyTiers ?? [])
    .filter(t => t.scoring !== 'sport')
    .map(t => ({ level: t.level, name: t.name, metres: metresIn(t.name) ?? 0 }))
    .filter(t => t.metres > 0)
}

/** Whether an event can take "distance + time" instead of a rung and a time. */
export function takesDistance(ev: EventData): boolean {
  return unitRule(ev).rule === 'distance' && isTimedEffort(ev.slug) && distanceRungs(ev).length > 0
}

/** Whether an event can take sets of weight × reps instead of a single lift. */
export function takesSets(ev: EventData): boolean {
  return ev.inputMode === 'strength' && ev.slug !== 'shoulder-dislocate'
}

// ─── What one natural entry becomes ──────────────────────────────────────────

export type Estimate = {
  /** The official score this predicts, on the event's own scale. */
  raw_score: number
  /** What was done, then the estimate: "100kg × 5 · est. 1RM 112.5kg". */
  score_label: string
  difficulty_tier?: string
  weight_kg?: number
  reps?: number
  time_seconds?: number
  distance_m?: number
}

/** Sets of weight × reps as a strength score. Null when no set is inside Brzycki's range. */
export function estimateFromSets(sets: readonly SetRow[]): Estimate | null {
  const best = bestSet(sets)
  if (!best) return null
  const { set, oneRm } = best
  const label = set.reps === 1
    ? `${set.weightKg}kg × 1`
    : `${set.weightKg}kg × ${set.reps} · est. 1RM ${oneRm}kg`
  return { raw_score: oneRm, score_label: label, weight_kg: set.weightKg, reps: set.reps }
}

/**
 * A distance and a time as a rung score: the HIGHEST rung the effort covers,
 * with the time Riegel predicts over it. A 5km run becomes a predicted 1000m;
 * a 700m row becomes a predicted 500m, never an extrapolated 1000m.
 */
export function estimateFromDistance(ev: EventData, metres: number, secs: number): Estimate | null {
  if (!(metres > 0) || !(secs > 0)) return null
  const rungs = distanceRungs(ev).sort((a, b) => a.metres - b.metres)
  const covered = rungs.filter(r => r.metres <= metres)
  if (covered.length === 0) return null
  const rung = covered[covered.length - 1]
  const predicted = rung.metres === metres ? Math.round(secs) : riegel(secs, metres, rung.metres)
  if (predicted === null || predicted <= 0) return null
  const tierIdx = (ev.difficultyTiers ?? []).findIndex(t => t.name === rung.name)
  if (tierIdx < 0) return null
  const raw = encodeDiffTime(tierIdx, predicted, isTimedEffort(ev.slug))
  const done = metres >= 1000 ? `${(metres / 1000).toFixed(2).replace(/\.?0+$/, '')}km` : `${Math.round(metres)}m`
  const label = rung.metres === metres
    ? `${done} · ${fmtTime(Math.round(secs))}`
    : `${done} · ${fmtTime(Math.round(secs))} · est. ${rung.name} ${fmtTime(predicted)}`
  return {
    raw_score: raw, score_label: label, difficulty_tier: rung.name,
    time_seconds: predicted, distance_m: metres,
  }
}

/** Pace, for the line under a distance entry: "5:14/km". */
export function paceLabel(metres: number, secs: number): string {
  if (!(metres > 0) || !(secs > 0)) return ''
  return `${fmtTime(Math.round(secs / (metres / 1000)))}/km`
}
