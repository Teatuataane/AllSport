// ─── AllSport grading ────────────────────────────────────────────────────────
// The twelve-colour grade ladder and the rules that turn results into a grade.
//
// This module is PURE — no React, no Supabase — so it can be unit tested and
// used from a server component. Same reason lib/percentile.ts and
// lib/judgeRoster.ts are pure.
//
// ── The three rules ─────────────────────────────────────────────────────────
//   1. A player holds a colour in each of the ten domains, earned against
//      published standards, not points.
//   2. Your colour in a domain is the highest grade whose standard you have met
//      in at least HALF of that domain's events.
//   3. Your overall grade is your LOWEST domain colour.
//
// Rule 3 is the whole point: AllSport is "one sport, every sport", so a grade
// set by your weakest domain says structurally that you are only as good as the
// thing you avoid. Average and maximum both reward specialists, which is the
// opposite of the sport. It also makes your worst domain the only thing worth
// training, which is a self-correcting coaching system.
//
// ── Why HALF the events, and why "of the events available to you" ───────────
// Requiring half a domain rather than one event is what stops a grade being
// won on a single favourable movement. But applied to all twelve events it
// would exclude the people the charity exists for: eight of Maximal Strength's
// twelve events load the shoulder, so a player whose shoulder will never press
// has four available and could never reach six — and under rule 3 that caps
// their overall grade forever.
//
// So the denominator is the events AVAILABLE to that player. A kaiwhakawā marks
// an event unavailable (injury, disability, permanent limitation) and the
// threshold moves with it: four available means two needed, not six. This is
// how a coach adapts a grading for an injured student, and it is the only way
// rule 2 keeps the promise the design makes — one joint costs you options,
// never a domain.
//
// ── What this module deliberately does NOT contain ──────────────────────────
// The standards themselves. Eight of the ten domains cannot reach six gradeable
// events until the event-difficulty overhaul lands (Calisthenics is 12/12
// tiered, Coordination 12/12 head-to-head), and that overhaul will change the
// tiers any standard would have to reference. The ladder and the rules are
// settled and overhaul-proof; the numbers are not, so they live in
// docs/designs/ until the tiers stop moving.

// ─── The ladder ──────────────────────────────────────────────────────────────
// Grades own colour. Domains are identified by name and icon only — colour
// cannot mean both "which domain" and "how good", which is the conflict that
// killed an earlier design.
//
// NEVER label these D1–D12. D1–D7 already means difficulty TIER inside an event
// (Pause Dips D1–D5, Planche D1–D7); a grade ladder on the same letters is
// unreadable on a scorecard. Use the colour names.

export type GradeRung = {
  /** 1–12. Rung 0 is Mā, the starting state, which is not an award. */
  rung: number
  /** Te reo name — the canonical label everywhere in the UI. */
  name: string
  /** English colour, for the legend only. */
  colour: string
  /**
   * Percentile of the GENERAL population this rung targets: "better than X%
   * of people". Null for Kiwikiwi, which anyone can reach.
   *
   * General population, not the AllSport player population, is deliberate. A
   * club-relative percentile moves when other people join, so a player could be
   * demoted by somebody else's arrival — which breaks "a colour once earned is
   * never lost" and punishes you for the club growing.
   */
  populationTarget: number | null
  /** Rendered as a gradient rather than a flat fill. */
  rainbow?: boolean
  /** Rendered as an inverted (black) card rather than a colour fill. */
  inverted?: boolean
}

/** The starting state. Not an award — every player begins here. */
export const MA: GradeRung = {
  rung: 0,
  name: 'Mā',
  colour: 'white',
  populationTarget: null,
}

export const GRADES: GradeRung[] = [
  { rung: 1, name: 'Kiwikiwi', colour: 'grey', populationTarget: null },
  { rung: 2, name: 'Whero', colour: 'red', populationTarget: 90 },
  { rung: 3, name: 'Karaka', colour: 'orange', populationTarget: 80 },
  { rung: 4, name: 'Kōwhai', colour: 'yellow', populationTarget: 70 },
  { rung: 5, name: 'Kākāriki', colour: 'green', populationTarget: 60 },
  { rung: 6, name: 'Kahurangi', colour: 'blue', populationTarget: 50 },
  { rung: 7, name: 'Poroporo', colour: 'purple', populationTarget: 40 },
  { rung: 8, name: 'Parahi', colour: 'bronze', populationTarget: 30 },
  { rung: 9, name: 'Hiriwa', colour: 'silver', populationTarget: 20 },
  { rung: 10, name: 'Kōura', colour: 'gold', populationTarget: 10 },
  { rung: 11, name: 'Uenuku', colour: 'rainbow', populationTarget: 5, rainbow: true },
  { rung: 12, name: 'Taniwha', colour: 'black', populationTarget: 1, inverted: true },
]

export const TOP_RUNG = 12
export const DOMAIN_COUNT = 10

/** Mā for 0, otherwise the rung. Out-of-range input is clamped, never thrown. */
export function gradeForRung(rung: number): GradeRung {
  if (rung <= 0) return MA
  return GRADES[Math.min(rung, TOP_RUNG) - 1]
}

// ─── Rule 2: the domain colour ───────────────────────────────────────────────

/**
 * The fraction of a domain's available events whose standard must be met.
 * Half, rounded up: 12 available needs 6, 5 available needs 3.
 */
export const DOMAIN_FRACTION = 0.5

export type DomainGradeInput = {
  domainNumber: number
  /** Every event slug in the domain, from the canonical roster. */
  eventSlugs: string[]
  /**
   * eventSlug → highest rung whose standard the player has met in that event
   * (lifetime best). Absent means never played; 0 means played but below the
   * bottom rung. Both count as "not met" for every rung.
   */
  rungByEvent: ReadonlyMap<string, number>
  /**
   * Coach-confirmed events this player cannot do. Removed from BOTH the
   * numerator and the denominator, so exempting an event never helps or hurts
   * beyond shrinking the domain.
   */
  unavailable?: ReadonlySet<string>
}

export type DomainGradeResult = {
  domainNumber: number
  /** 0 = Mā. */
  rung: number
  /** Events counted — the domain's roster minus this player's exemptions. */
  availableCount: number
  /** How many of those must meet a rung for it to be held. */
  required: number
  /** How many available events currently meet `rung`. */
  metAtRung: number
  /** The rung above, or null at the top. */
  nextRung: number | null
  /** How many available events already meet `nextRung` — progress. */
  metAtNextRung: number
}

/** How many of a player's available events must meet a rung to hold it. */
export function requiredForDomain(availableCount: number): number {
  return Math.ceil(availableCount * DOMAIN_FRACTION)
}

export function domainGrade(input: DomainGradeInput): DomainGradeResult {
  const unavailable = input.unavailable ?? new Set<string>()
  const available = input.eventSlugs.filter((s) => !unavailable.has(s))
  const required = requiredForDomain(available.length)

  // A domain with nothing available cannot be graded. Without this guard
  // `required` is 0 and every rung is trivially "met", which would hand out
  // Taniwha for an empty domain.
  if (available.length === 0) {
    return {
      domainNumber: input.domainNumber,
      rung: 0,
      availableCount: 0,
      required: 0,
      metAtRung: 0,
      nextRung: 1,
      metAtNextRung: 0,
    }
  }

  const countAtLeast = (rung: number) =>
    available.filter((s) => (input.rungByEvent.get(s) ?? 0) >= rung).length

  // Walk DOWN from the top: the domain colour is the highest rung met widely
  // enough. Counting up and stopping at the first failure would be wrong if the
  // counts were ever non-monotonic; walking down is correct regardless.
  let rung = 0
  for (let r = TOP_RUNG; r >= 1; r--) {
    if (countAtLeast(r) >= required) {
      rung = r
      break
    }
  }

  const nextRung = rung >= TOP_RUNG ? null : rung + 1
  return {
    domainNumber: input.domainNumber,
    rung,
    availableCount: available.length,
    required,
    metAtRung: rung === 0 ? 0 : countAtLeast(rung),
    nextRung,
    metAtNextRung: nextRung === null ? 0 : countAtLeast(nextRung),
  }
}

// ─── Rule 3: the overall grade ───────────────────────────────────────────────

export type OverallGradeResult = {
  /** null until every domain holds a colour — see below. */
  rung: number | null
  /** Domains still on Mā. These are what the overall grade is waiting on. */
  ungraded: number[]
  /** The domains sitting at the minimum — what to train next. */
  weakest: number[]
}

/**
 * The lowest domain colour, once there is one in every domain.
 *
 * Null rather than Mā while any domain is ungraded, because the two mean
 * different things to a player: "you have not been graded in Flexibility yet"
 * is progress, "you are Mā" is a verdict. The UI leads with the ten domain
 * colours and only shows an overall grade once all ten exist.
 */
export function overallGrade(domains: readonly DomainGradeResult[]): OverallGradeResult {
  const ungraded = domains.filter((d) => d.rung === 0).map((d) => d.domainNumber)
  if (domains.length < DOMAIN_COUNT || ungraded.length > 0) {
    return { rung: null, ungraded, weakest: [] }
  }
  const min = Math.min(...domains.map((d) => d.rung))
  return {
    rung: min,
    ungraded: [],
    weakest: domains.filter((d) => d.rung === min).map((d) => d.domainNumber),
  }
}

// ─── Standards scaling ───────────────────────────────────────────────────────
// Standards are written once for a reference group (Open, 17–39) and every
// other age band is a FACTOR on that reference. Athletics age-grading works
// this way: it is revisable in one place, and hand-setting a number for every
// band and sex across 120 events guarantees inconsistency.

export type AgeBand = 'U12' | 'U14' | 'U16' | 'Open' | 'Masters' | 'Grandmaster'
export type StandardCategory = 'strength' | 'power' | 'speed' | 'endurance' | 'flexibility' | 'skill'
/** Whether a bigger number is better (weight, reps, distance, hold) or smaller (times, strokes). */
export type StandardDirection = 'higher' | 'lower'

export const AGE_FACTORS: Record<AgeBand, Record<StandardCategory, number>> = {
  U12:         { strength: 0.45, power: 0.45, speed: 0.70, endurance: 0.70, flexibility: 1.10, skill: 0.55 },
  U14:         { strength: 0.60, power: 0.60, speed: 0.80, endurance: 0.80, flexibility: 1.10, skill: 0.70 },
  U16:         { strength: 0.80, power: 0.80, speed: 0.90, endurance: 0.90, flexibility: 1.05, skill: 0.85 },
  Open:        { strength: 1.00, power: 1.00, speed: 1.00, endurance: 1.00, flexibility: 1.00, skill: 1.00 },
  Masters:     { strength: 0.88, power: 0.88, speed: 0.88, endurance: 0.90, flexibility: 0.90, skill: 1.00 },
  Grandmaster: { strength: 0.72, power: 0.72, speed: 0.75, endurance: 0.78, flexibility: 0.80, skill: 0.95 },
}

/**
 * Apply an age factor to a reference standard.
 *
 * DIRECTION MATTERS AND IS EASY TO GET BACKWARDS. Multiply for higher-is-better
 * standards; DIVIDE for lower-is-better ones. A Grandmaster's 100m standard is
 * slower than Open, so 13.8s ÷ 0.75 = 18.4s. Multiplying would demand 10.35s and
 * make the standard harder with age.
 *
 * Flexibility factors above 1.0 for juniors are deliberate: children are more
 * mobile than adults, so their standard is harder, not easier.
 */
export function scaleStandard(
  reference: number,
  band: AgeBand,
  category: StandardCategory,
  direction: StandardDirection
): number {
  const factor = AGE_FACTORS[band][category]
  return direction === 'higher' ? reference * factor : reference / factor
}

/** Whether a performance meets a standard, honouring the standard's direction. */
export function meetsStandard(value: number, standard: number, direction: StandardDirection): boolean {
  return direction === 'higher' ? value >= standard : value <= standard
}

/**
 * The highest rung a single performance reaches, given that event's reference
 * standards (index 0 = rung 1 … index 11 = rung 12). Returns 0 for a
 * performance below the bottom rung.
 *
 * Accepts a partial ladder so an event can be graded before all twelve
 * standards are written.
 */
export function rungForPerformance(
  value: number,
  referenceLadder: readonly number[],
  band: AgeBand,
  category: StandardCategory,
  direction: StandardDirection
): number {
  let rung = 0
  referenceLadder.forEach((reference, i) => {
    const standard = scaleStandard(reference, band, category, direction)
    if (meetsStandard(value, standard, direction)) rung = i + 1
  })
  return rung
}

/** Age band from a player's division and age. Mirrors the division rules. */
export function ageBand(division: string | null, ageYears: number | null): AgeBand {
  const d = division ?? ''
  if (/Grandmaster/.test(d)) return 'Grandmaster'
  if (/Masters/.test(d)) return 'Masters'
  // 'Youth' is the legacy value for Juniors and still appears on old rows.
  if (/Junior|Youth/.test(d)) {
    if (ageYears == null) return 'U14'
    if (ageYears < 12) return 'U12'
    if (ageYears < 14) return 'U14'
    return 'U16'
  }
  return 'Open'
}
