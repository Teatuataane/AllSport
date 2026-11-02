// ─── One list, scaled for sex and age ────────────────────────────────────────
// Since 3 Nov 2026 every event has one list (lib/standards.ts), and the level a
// player needs is scaled by sex and age (Tāne: "everybody operates off the same
// standards and the level required is scaled by age and sex"). Different domains
// need different scaling, so this file is the one place the numbers live.
// AGE_ALLOWANCE_REVIEW.md is the sheet; __tests__/scaling.test.ts pins the two.
//
// Why a percentage on an event with a number: a ladder is deliberately wide up
// to Kahurangi and tight to Taniwha, so a three colour shift on Pause Bench cuts
// 75% of the load at Kahurangi and 20% at Taniwha. A percentage is the same cut
// at every colour. An event with levels has no number to scale, so it keeps the
// colour shift in lib/ageAllowance.ts.
//
// Sex and age multiply: a 60-year-old woman deadlifts 80% × 85% of the list.
// Tāne wants to check these numbers again later. Change them here and on the
// sheet, then bump GRADING_RULES_VERSION in lib/grading.ts.
//
// Pure: no Supabase, no React.

import { BW_LOAD_SCALE } from './grading'
import { ageAllowance } from './ageAllowance'
import type { EventStandards } from './standards'
import type { EventData } from './eventData'

export const LOAD_LOWER = 0.8
export const LOAD_UPPER = 0.7
export const JUMP_SHARE = 0.8
export const TIME_EXTRA = 1.12
/** Colours an upper body event with levels moves for women and girls from 12. */
export const UPPER_LEVEL_COLOURS = 1

/** Lower body, the Olympic lifts, Arthur Lift, Tibialis, Toe Lift, Leg Extension Hold, Sandbag to Shoulder. */
export const LOWER_LOAD_SLUGS: ReadonlySet<string> = new Set([
  'deadlift', 'pause-squat', 'pause-front-squat', 'loaded-lunge', 'zercher-deadlift', 'steinborn', 'arthur-lift',
  'glute-thrust', 'leg-extension', 'tibialis-curl', 'toe-lift', 'sandbag-to-shoulder',
  'clean-and-jerk', 'snatch', 'kelly-snatch', 'one-arm-snatch',
])
/** Upper body and carries. Reps and times stay the same. */
export const UPPER_LOAD_SLUGS: ReadonlySet<string> = new Set([
  'pause-bench', 'overhead-press', 'pause-row', 'one-arm-press', 'turkish-get-up', 'plate-hold', 'weighted-tuck',
  'skullcrusher', 'strict-curl', 'overhead-tricep-extension', 'overhead-raise', 'wrist-extension',
  'sandbag-carry', 'farmer-carry', 'weighted-drag',
])
export const JUMP_SLUGS: ReadonlySet<string> = new Set([
  'vertical-jump', 'standing-broad-jump', 'triple-jump', 'high-jump',
])
/** Timed Endurance. The distance steps stay the same. */
export const TIMED_ENDURANCE_SLUGS: ReadonlySet<string> = new Set([
  'running', 'cycling', 'ski-erg', 'row-erg', 'swim', 'walking', 'scooting', 'burpee-broad-jump',
])
/** Upper body events with levels: one colour instead of a percentage. */
export const UPPER_LEVEL_SLUGS: ReadonlySet<string> = new Set([
  'pause-dips', 'clap-pushups', 'chin-up-contest', 'push-up-contest', 'finger-push-up', 'planche', 'front-lever',
  'back-lever', 'flag', 'iron-cross', 'reverse-maltese', 'hand-walk', 'chin-hang', 'hang', 'windshield-wipers',
  'wrestler-pullover',
])

/** Adults: the first age of each step, as lib/ageAllowance.ts ADULT_AGES. Under 35 is 0. */
export const PERCENT_AGES = [35, 40, 45, 50, 55, 60, 65, 70, 75] as const

export type PercentGroup = 'power' | 'strength' | 'stamina'

/** Which row a domain with number events reads. Other domains keep colours. */
const PERCENT_GROUP: Readonly<Record<number, PercentGroup>> = { 1: 'strength', 3: 'power', 5: 'stamina', 6: 'stamina' }

/** How much the standard eases, in percent. */
export const ADULT_PERCENT: Readonly<Record<PercentGroup, readonly number[]>> = {
  power:    [0, 5, 10, 10, 15, 20, 25, 30, 35],
  strength: [0, 0, 5, 10, 10, 15, 20, 25, 30],
  stamina:  [0, 0, 5, 5, 10, 10, 15, 20, 25],
}

/** Juniors: under 12, 12 to 13, 14 to 16. */
export const JUNIOR_PERCENT: Readonly<Record<PercentGroup, readonly [number, number, number]>> = {
  power:    [30, 20, 10],
  strength: [30, 20, 10],
  stamina:  [15, 10, 5],
}

export type ScalePlayer = { division: string | null; gender: string | null; ageYears: number | null }

/**
 * Whether the women's scaling applies. Under 12, boys and girls share the listed
 * standard (Tāne, 21 Oct 2026). A junior's division says nothing about sex, so
 * their registration answer decides. "Other" stays on the listed standard.
 */
export function scaledAsWoman(p: ScalePlayer): boolean {
  if (p.ageYears != null && p.ageYears < 12) return false
  const d = p.division ?? ''
  if (/Women/.test(d)) return true
  if (/Men/.test(d)) return false
  return /^f/i.test(p.gender ?? '')
}

/** An event with a number to scale, in a domain that scales numbers. */
export function usesPercent(ev: Pick<EventData, 'domainNumber' | 'difficultyTiers'>): boolean {
  return !ev.difficultyTiers?.length && PERCENT_GROUP[ev.domainNumber] != null
}

/** The percent the standard eases for age on this event. 0 with no date of birth. */
export function agePercent(p: Pick<ScalePlayer, 'ageYears'>, ev: Pick<EventData, 'domainNumber' | 'difficultyTiers'>): number {
  if (!usesPercent(ev)) return 0
  const age = p.ageYears
  if (age == null || !Number.isFinite(age)) return 0
  const group = PERCENT_GROUP[ev.domainNumber]
  if (age < 17) {
    const row = JUNIOR_PERCENT[group]
    return age < 12 ? row[0] : age < 14 ? row[1] : row[2]
  }
  let pct = 0
  PERCENT_AGES.forEach((from, i) => { if (age >= from) pct = ADULT_PERCENT[group][i] })
  return pct
}

/** The share of the listed load, height or distance for sex alone. 1 when none applies. */
export function sexShare(p: ScalePlayer, slug: string): number {
  if (!scaledAsWoman(p)) return 1
  if (LOWER_LOAD_SLUGS.has(slug)) return LOAD_LOWER
  if (UPPER_LOAD_SLUGS.has(slug)) return LOAD_UPPER
  if (JUMP_SLUGS.has(slug)) return JUMP_SHARE
  return 1
}

/** How many times the listed time, for sex and age together. Only timed Endurance has one. */
export function timeFactor(p: ScalePlayer, ev: Pick<EventData, 'slug' | 'domainNumber' | 'difficultyTiers'>): number {
  const sex = scaledAsWoman(p) && TIMED_ENDURANCE_SLUGS.has(ev.slug) ? TIME_EXTRA : 1
  return sex * (1 + agePercent(p, ev) / 100)
}

/** The share of the listed number, for sex and age together. */
export function numberShare(p: ScalePlayer, ev: Pick<EventData, 'slug' | 'domainNumber' | 'difficultyTiers'>): number {
  return sexShare(p, ev.slug) * (1 - agePercent(p, ev) / 100)
}

/**
 * Colours the ladder moves for this player on this event, halves allowed: the
 * age table on an event graded in colours, none on a percentage event, plus
 * one for an upper body event with levels for a woman or girl from 12.
 */
export function colourAllowance(p: ScalePlayer, ev: EventData): number {
  const age = usesPercent(ev) && p.ageYears != null ? 0 : ageAllowance(p, ev.domainNumber)
  return age + (scaledAsWoman(p) && UPPER_LEVEL_SLUGS.has(ev.slug) ? UPPER_LEVEL_COLOURS : 0)
}

const TIME_BAND = 10000
const LOAD_KEY = 10000
const CARRY_KEY = 1e9

/**
 * This player's list for one event, on the same scale as lib/standards.ts. Only
 * the number that eases moves: a hold's or a carry's time and a set's reps stay.
 * A floor of "any" stays "any".
 */
export function scaledLadder(ev: EventData, s: EventStandards, p: ScalePlayer): readonly number[] {
  const ladder = s.all ?? []
  if (ev.inputMode === 'distance+time' && !ev.difficultyTiers?.length) {
    const f = timeFactor(p, ev)
    if (f === 1) return ladder
    const steps = s.steps?.length ?? 1
    return ladder.map((t, i) => (i < steps ? t : TIME_BAND - Math.round((TIME_BAND - t) * f)))
  }
  const share = numberShare(p, ev)
  if (share === 1) return ladder
  if (s.kind === 'ratio') return ladder.map(t => Math.round(t * share * BW_LOAD_SCALE) / BW_LOAD_SCALE)
  if (ev.inputMode === 'weight+time' || ev.inputMode === 'weight+reps') {
    return ladder.map(t => Math.round(Math.floor(t / LOAD_KEY) * share) * LOAD_KEY + t % LOAD_KEY)
  }
  if (ev.inputMode === 'weight+distance+time') {
    return ladder.map(t => Math.round(Math.floor(t / CARRY_KEY) * share) * CARRY_KEY + t % CARRY_KEY)
  }
  if (ev.inputMode === 'distance' || ev.inputMode === 'hold') {
    return ladder.map(t => (t <= 1 ? t : Math.round(t * share)))
  }
  return ladder
}

/** "80%": a share for the note under a ladder. */
const pct = (share: number) => `${Math.round(share * 100)}%`

/**
 * The line under a ladder that says it is already scaled, or null when nothing
 * applies. Without it two players comparing standards see different numbers and
 * no reason (Tāne, 20 Oct 2026). Null on a rating-only event.
 */
export function scalingNote(ev: EventData, p: ScalePlayer): string | null {
  const ageText = p.ageYears != null ? ` at ${p.ageYears} this year` : ''
  if (usesPercent(ev)) {
    const age = agePercent(p, ev)
    if (ev.inputMode === 'distance+time') {
      const f = timeFactor(p, ev)
      if (f === 1) return null
      return `Times include your scaling: ${pct(f)} of the listed time${age ? `${ageText}` : ''}.`
    }
    const share = numberShare(p, ev)
    if (share === 1) return null
    return `Includes your scaling: ${pct(share)} of the listed standard${age ? `${ageText}` : ''}.`
  }
  return null
}
