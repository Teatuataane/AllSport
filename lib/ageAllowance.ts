// ─── The age allowance, by domain ────────────────────────────────────────────
// Approved by Tāne on 20 October 2026 (AGE_ALLOWANCE_REVIEW.md). It replaces
// the flat allowance (U12 and U14 +2, U16 +1, 40+ +1, 60+ +2 in every domain).
//
// An allowance is a number of colours the ladder moves for the player: with 1
// they earn each colour at the Open standard for the colour below it
// (lib/grading.ts, "Age SHIFTS THE LADDER"). Age hits domains very
// differently: Speed and Power fall away first, the skill domains barely, and
// children trail adults most on strength, power and speed but are usually more
// flexible. So each domain group has its own row.
//
// A half (½) is graded by lib/playerGrades.ts eventGrade: the exact score at
// the whole step below and at the whole step above, averaged. The colour held
// is the whole part of that average.
//
// The age is the one a player turns in the year being graded (ageInYear in
// lib/seasonYear.ts), never their division. Pure: no Supabase, no React.

import { AGE_SHIFT, ageBand } from './grading'

/** Which row of the table a domain reads. Indexed by domain number. */
export type AllowanceGroup = 'speedPower' | 'strength' | 'stamina' | 'skill' | 'flexibility'

const GROUP_BY_DOMAIN: Record<number, { adult: AllowanceGroup; junior: AllowanceGroup }> = {
  1: { adult: 'strength', junior: 'speedPower' },     // Maximal Strength
  2: { adult: 'strength', junior: 'strength' },       // Calisthenics
  3: { adult: 'speedPower', junior: 'speedPower' },   // Power
  4: { adult: 'speedPower', junior: 'speedPower' },   // Speed
  5: { adult: 'stamina', junior: 'stamina' },         // Stamina
  6: { adult: 'stamina', junior: 'stamina' },         // Endurance
  7: { adult: 'skill', junior: 'flexibility' },       // Flexibility
  8: { adult: 'skill', junior: 'skill' },             // Body Awareness
  9: { adult: 'skill', junior: 'skill' },             // Coordination
  10: { adult: 'skill', junior: 'skill' },            // Aim & Precision
}

/** Adults: the first age of each step, and the allowance from it. Under 35 is 0. */
export const ADULT_AGES = [35, 40, 45, 50, 55, 60, 65, 70, 75] as const

export const ADULT_ALLOWANCE: Record<Exclude<AllowanceGroup, 'flexibility'>, readonly number[]> = {
  speedPower: [0, 0.5, 1, 1, 1.5, 2, 2.5, 3, 3.5],
  strength:   [0, 0, 0.5, 1, 1, 1.5, 2, 2.5, 3],
  stamina:    [0, 0, 0.5, 0.5, 1, 1, 1.5, 2, 2.5],
  skill:      [0, 0, 0, 0, 0.5, 0.5, 1, 1, 1.5],
}

/** Juniors: under 12, 12 to 13, 14 to 16. Calisthenics is its own junior row. */
export const JUNIOR_ALLOWANCE: Record<AllowanceGroup, readonly [number, number, number]> = {
  speedPower:  [3, 2, 1],     // Maximal Strength, Power, Speed
  strength:    [2, 1.5, 0.5], // Calisthenics
  skill:       [2, 1.5, 0.5], // Body Awareness, Coordination, Aim & Precision
  stamina:     [1.5, 1, 0.5], // Stamina, Endurance
  flexibility: [0, 0, 0],     // Flexibility
}

/** The domain groups as the review sheet and /grades name them. */
export const ADULT_ROWS: readonly { label: string; group: keyof typeof ADULT_ALLOWANCE }[] = [
  { label: 'Speed, Power', group: 'speedPower' },
  { label: 'Maximal Strength, Calisthenics', group: 'strength' },
  { label: 'Stamina, Endurance', group: 'stamina' },
  { label: 'Flexibility, Body Awareness, Coordination, Aim & Precision', group: 'skill' },
]

export const JUNIOR_ROWS: readonly { label: string; group: AllowanceGroup }[] = [
  { label: 'Maximal Strength, Power, Speed', group: 'speedPower' },
  { label: 'Calisthenics', group: 'strength' },
  { label: 'Body Awareness, Coordination, Aim & Precision', group: 'skill' },
  { label: 'Stamina, Endurance', group: 'stamina' },
  { label: 'Flexibility', group: 'flexibility' },
]

/**
 * The allowance, in colours (halves allowed), for a player of `ageYears` (the
 * age they turn in the year graded) in domain `domainNumber`. With no age the
 * old flat allowance is read from the division, as before; every live player
 * has a date of birth (checked 20 Oct 2026).
 */
export function ageAllowance(
  player: { division: string | null; ageYears: number | null },
  domainNumber: number,
): number {
  const age = player.ageYears
  if (age == null || !Number.isFinite(age)) return AGE_SHIFT[ageBand(player.division, null)]
  const groups = GROUP_BY_DOMAIN[domainNumber]
  if (!groups) return 0
  if (age < 17) {
    const row = JUNIOR_ALLOWANCE[groups.junior]
    return age < 12 ? row[0] : age < 14 ? row[1] : row[2]
  }
  const row = ADULT_ALLOWANCE[groups.adult as keyof typeof ADULT_ALLOWANCE]
  let a = 0
  ADULT_AGES.forEach((from, i) => { if (age >= from) a = row[i] })
  return a
}

/** "1", "½", "1½": an allowance as players read it. */
export function formatAllowance(a: number): string {
  const whole = Math.floor(a)
  const half = a - whole >= 0.5
  if (!half) return String(whole)
  return whole === 0 ? '½' : `${whole}½`
}
