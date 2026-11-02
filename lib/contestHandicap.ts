// ─── The head-to-head handicap ───────────────────────────────────────────────
// Tāne, 3 Nov 2026: a player who beats someone they "shouldn't" (a child beating
// an adult, a woman beating a man, the old beating the young) earns a relative
// bonus, and a loss to someone with the natural edge costs next to nothing.
//
// So a rating measures skill for who you are, and the handicap is what your age
// and sex take off it in a game: a 10-year-old rated 1,000 plays like a 700 in
// Tag. Elo then expects them to lose to an adult rated 1,000, a win over that
// adult pays nearly the full amount, and a loss barely moves them. The adult who
// loses to them is the one Elo was surprised by.
//
// One colour is 100 rating points (RATING_STEP), and the age half is the colour
// table the rest of the game already reads (lib/ageAllowance.ts), so it cannot
// drift from the drills. The sex half is its own row below, because the drills'
// one colour only covers upper body events with levels.
//
// A junior's sex is private, and ratings are worked out in the browser from
// public data: their handicap is by age alone. An adult's comes from their
// division, which is public. Bodyweight never plays a part: contact contests
// already pair by it. Speed Chess has no handicap: it sits in Speed by its clock,
// and neither age nor sex slows a move.
//
// Tāne wants to check these numbers. Change them here and on
// AGE_ALLOWANCE_REVIEW.md, then bump GRADING_RULES_VERSION in lib/grading.ts.
//
// Pure: no Supabase, no React.

import { getEventByName } from './eventData'
import { ageAllowance } from './ageAllowance'
import { RATING_STEP } from './grading'
import { ageInYear } from './seasonYear'

/** What a player's handicap is read from: players_public, so it is public already. */
export type ContestProfile = { division: string | null; birth_year: number | null }

/** Colours a woman's handicap adds, by domain. Domains with no head-to-head event are absent. */
export const WOMEN_CONTEST_COLOURS: Readonly<Record<number, number>> = {
  3: 2, // Power
  4: 2, // Speed
  6: 2, // Endurance
  8: 1, // Control
  9: 1, // Coordination
  10: 0.5, // Aim
}

/** Head-to-head events no handicap applies to, by slug. */
export const NO_HANDICAP_SLUGS: ReadonlySet<string> = new Set(['speed-chess'])

/**
 * The rating points age and sex take off a player in a game of this sport in
 * this year. 0 for a sport off the roster, or a player we hold nothing for, so
 * a rating read without profiles is plain Elo.
 */
export function handicapPoints(profile: ContestProfile | undefined, eventName: string, year: number): number {
  if (!profile) return 0
  const ev = getEventByName(eventName)
  if (!ev || NO_HANDICAP_SLUGS.has(ev.slug)) return 0
  const ageYears = ageInYear({ birthYear: profile.birth_year, ageYears: null }, year)
  const age = ageAllowance({ division: profile.division, ageYears }, ev.domainNumber)
  const sex = /Women/.test(profile.division ?? '') ? WOMEN_CONTEST_COLOURS[ev.domainNumber] ?? 0 : 0
  return (age + sex) * RATING_STEP
}

/** Every profile the recorded matches carry, by player id. */
export function contestProfilesOf(
  matches: readonly { players: readonly { player_id: string; profile?: ContestProfile }[] }[],
): Map<string, ContestProfile> {
  const out = new Map<string, ContestProfile>()
  for (const m of matches) for (const p of m.players) if (p.profile) out.set(p.player_id, p.profile)
  return out
}
