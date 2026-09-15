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
// The standards themselves. They are numbers per event, sex and rung, compiled
// from a reviewed sheet the same way the difficulty ladders are, so a change to
// one event's standard never touches the rules here. This module knows how a
// threshold is met, shifted for age and capped; never what any threshold is.

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
  /** The display colour. */
  hex: string
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
  hex: '#ffffff',
  populationTarget: null,
}

// `hex` is the display colour: the brand palette where a grade shares a colour
// with it (the globals.css --grade-* tokens), and bronze, silver and gold from
// the standards review for the three rungs the old ladder never had. Uenuku is
// drawn as the rainbow and Taniwha as a black card, so their hex is the fallback.
export const GRADES: GradeRung[] = [
  { rung: 1, name: 'Kiwikiwi', colour: 'grey', hex: '#888888', populationTarget: null },
  { rung: 2, name: 'Whero', colour: 'red', hex: '#EA4742', populationTarget: 90 },
  { rung: 3, name: 'Karaka', colour: 'orange', hex: '#F9B051', populationTarget: 80 },
  { rung: 4, name: 'Kōwhai', colour: 'yellow', hex: '#F9E051', populationTarget: 70 },
  { rung: 5, name: 'Kākāriki', colour: 'green', hex: '#4DB26E', populationTarget: 60 },
  { rung: 6, name: 'Kahurangi', colour: 'blue', hex: '#2371BB', populationTarget: 50 },
  { rung: 7, name: 'Poroporo', colour: 'purple', hex: '#B87DB5', populationTarget: 40 },
  { rung: 8, name: 'Parahi', colour: 'bronze', hex: '#CD7F32', populationTarget: 30 },
  { rung: 9, name: 'Hiriwa', colour: 'silver', hex: '#B8C0CC', populationTarget: 20 },
  { rung: 10, name: 'Kōura', colour: 'gold', hex: '#D4AF37', populationTarget: 10 },
  { rung: 11, name: 'Uenuku', colour: 'rainbow', hex: '#B87DB5', populationTarget: 5, rainbow: true },
  { rung: 12, name: 'Taniwha', colour: 'black', hex: '#000000', populationTarget: 1, inverted: true },
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
   * Events in this domain that can never carry a standard, for everybody.
   * After the September 2026 difficulty overhaul that is the eleven remaining
   * pure `sport` events — a win, draw or loss says nothing about a population,
   * so no percentile can be attached to one.
   *
   * They must leave the DENOMINATOR, not merely fail to count. Speed holds six
   * of the eleven, so counting them would ask a Speed player to meet the
   * standard in all six of the events that can be graded — a 100% requirement
   * where every other domain asks 50%. Half of what can be graded is the rule;
   * half of the roster is an accident of which events happen to be contests.
   */
  ungradeable?: ReadonlySet<string>
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
  /**
   * Events counted — the domain's roster minus the events nobody can be graded
   * in, minus this player's own exemptions.
   */
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
  const ungradeable = input.ungradeable ?? new Set<string>()
  const available = input.eventSlugs.filter((s) => !unavailable.has(s) && !ungradeable.has(s))
  const required = requiredForDomain(available.length)

  // A domain with nothing gradeable and available cannot be graded. Without
  // this guard `required` is 0 and every rung is trivially "met", which would
  // hand out Taniwha for an empty domain.
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

// ─── The two gates beside the standards ──────────────────────────────────────
// Workout logging (September 2026) made every logged workout count toward the
// standards, on trust. Two gates came with it, so a colour still needs the room
// and still needs the work:
//
//   GAMES — cumulative OFFICIAL games. A kaiwhakawā moderates in person at
//     games, so earning colours includes playing them. A personal-training
//     session run by a kaiwhakawā is witnessed evidence but NOT a game: the
//     quota exists to bring people into the room. One count for the player,
//     not per domain, because every game draws an event from every domain.
//
//   TRAINING — effort units in THAT domain since the last colour there
//     (lib/units.ts says what a unit is). The count starts again at each
//     colour: a set amount of volume at every colour, the way a belt asks for
//     time at grade. Official game results earn units too, so a player who only
//     comes to games is never blocked, only slower.
//
// Colours move ONE at a time: the training count restarts at each conferral,
// so the colour above needs its own units before it can follow.
//
// The units ladder is the games ladder's steps × UNIT_MULTIPLIER. Calibrated
// on 16 September 2026 against every game on record: a game earns about 0.83
// units per domain (one event per domain, 1.5 submissions each), so at 1.5 a
// player who only plays games needs somewhat more than the quota's games to
// clear the training gate, and any logged training closes the gap. At 1.0 the
// gate barely binds; at 2.0 it held back 43% of the colours players had earned
// on the standards. At 1.5 it holds back 35%.

/** Cumulative official games needed to hold each colour. Index = rung. Tāne, 16 September 2026. */
export const GAMES_REQUIRED: readonly number[] = [0, 1, 3, 5, 8, 12, 16, 20, 30, 40, 55, 75, 100]

/** Training units per games-quota step. See above; one number to change. */
export const UNIT_MULTIPLIER = 1.5

/** Units needed in a domain, since its last colour, to hold each colour. Index = rung. Kiwikiwi needs none. */
export const UNITS_REQUIRED: readonly number[] = GAMES_REQUIRED.map((g, r) =>
  r <= 1 ? 0 : Math.round(UNIT_MULTIPLIER * (g - GAMES_REQUIRED[r - 1])))

/** Absorbs floating-point noise in a unit sum, and nothing more. */
export const UNIT_EPSILON = 1e-6

export type ColourGate = {
  domainNumber: number
  /** The colour held (conferred), 0 = Mā. */
  held: number
  /** The colour above, or null at the top. */
  next: number | null
  standardsMet: boolean
  gamesMet: boolean
  trainingMet: boolean
  games: number
  gamesNeeded: number
  units: number
  unitsNeeded: number
  /** `next` when all three gates pass, otherwise 0. */
  releasable: number
}

/** The three gates on a domain's next colour. */
export function colourGate(input: {
  domainNumber: number
  /** The colour the standards give today (domainGrade's rung). */
  standardsRung: number
  held: number
  games: number
  /** Units in this domain since `held` was conferred. */
  unitsSinceHeld: number
}): ColourGate {
  const next = input.held >= TOP_RUNG ? null : input.held + 1
  const gamesNeeded = next == null ? 0 : GAMES_REQUIRED[next]
  const unitsNeeded = next == null ? 0 : UNITS_REQUIRED[next]
  const standardsMet = next != null && input.standardsRung >= next
  const gamesMet = next != null && input.games >= gamesNeeded
  // A tolerance, not rounding: floating-point quarters summing to 2.9999…
  // are 3, but a real 2.95 is still short.
  const trainingMet = next != null && input.unitsSinceHeld + UNIT_EPSILON >= unitsNeeded
  return {
    domainNumber: input.domainNumber, held: input.held, next,
    standardsMet, gamesMet, trainingMet,
    games: input.games, gamesNeeded, units: input.unitsSinceHeld, unitsNeeded,
    releasable: standardsMet && gamesMet && trainingMet ? next! : 0,
  }
}

// ─── Standards and the age shift ─────────────────────────────────────────────
// A standard is a THRESHOLD on a scale where a higher number is always better.
// For a tiered event that scale is results.raw_score itself — tierIdx * 10000
// plus the within-rung term, with timed efforts already inverted — so "D4 · 5
// reps" and "a bodyweight carry in 2:00" are each one number and every check is
// `>=`. Strength standards are kilograms. One direction is deliberate: the
// value-scaling design this replaces multiplied some standards and divided
// others, and getting that backwards made a standard HARDER with age.
//
// Age SHIFTS THE LADDER; it does not scale the value (settled in review). A band
// that shifts one colour earns colour c at the Open standard for colour c - 1,
// so a Masters player's Taniwha is an Open player's Uenuku. Below the Open floor
// the ladder is extrapolated by its own first step, so the youngest players can
// earn the bottom colours for a performance under the Open Kiwikiwi.

export type AgeBand = 'U12' | 'U14' | 'U16' | 'Open' | 'Masters' | 'Grandmaster'

/**
 * Colours each band moves up the ladder. Under 14 and Grandmasters two; 14 to
 * 16 and Masters one. U14 was raised to two in review so that no child gets
 * less help than an older one.
 */
export const AGE_SHIFT: Record<AgeBand, number> = {
  U12: 2, U14: 2, U16: 1, Open: 0, Masters: 1, Grandmaster: 2,
}

/**
 * The Open threshold for rung `r`. Rungs at or below 0 lie under the Open floor
 * and are extrapolated by the ladder's first step (rung 1 to rung 2). A one-rung
 * ladder has no step, so its floor holds.
 */
export function thresholdFor(thresholds: readonly number[], r: number): number {
  if (r >= 1) return thresholds[r - 1]
  if (thresholds.length < 2) return thresholds[0]
  return thresholds[0] - (1 - r) * (thresholds[1] - thresholds[0])
}

/**
 * The highest rung a score earns for a band. `thresholds[i]` is the Open
 * standard for rung i + 1, strictly increasing; a partial ladder grades up to
 * its own top plus the band's shift, so an event can grade before all twelve
 * standards exist.
 *
 * `cap` stops a drill at Kahurangi on a Game-rung event. It applies AFTER the
 * shift, so no age allowance lifts a drill into a colour earned by winning.
 */
export function rungForScore(
  score: number,
  thresholds: readonly number[],
  band: AgeBand,
  { cap = TOP_RUNG }: { cap?: number } = {}
): number {
  if (thresholds.length === 0) return 0
  const shift = AGE_SHIFT[band]
  const top = Math.min(TOP_RUNG, thresholds.length + shift)
  let rung = 0
  for (let c = 1; c <= top; c++) {
    if (score >= thresholdFor(thresholds, c - shift)) rung = c
  }
  return Math.min(rung, cap)
}

// ─── Game-rung events: drills below, the rating above ────────────────────────
// On an event topped by a Game rung, the drills grade Kiwikiwi to Kahurangi and
// a head-to-head rating grades Poroporo to Taniwha: 1,100 to 1,600, one colour
// per 100 points, so the colour above you wins about two games in three. A
// rating colour needs ten recorded games in that sport. The colour shown is the
// higher of the two, and like every colour it is never taken back when the
// rating later falls.
//
// The rating is NOT age-shifted. It already measures you against the people you
// actually play, of every age; shifting it would turn a Masters player's 1,500
// into a Taniwha.

/** Kahurangi: the highest colour a drill can give on a Game-rung event. */
export const DRILL_CAP = 6
export const RATING_START = 1000
/** Poroporo, the first colour a rating gives. */
export const RATING_FLOOR = 1100
export const RATING_STEP = 100
/**
 * Recorded games a player needs in a sport before its rating gives a colour.
 * Tāne, 14 September 2026. Simulated at AllSport's real volumes, a sport rating
 * tracks true skill at about 0.55 correlation after one to four games and about
 * 0.83 after ten to nineteen (scripts/sim-skill-rating.mjs). The games only make
 * a player ELIGIBLE; the colour still depends on winning them, so the grade
 * stays failable. Defined once, here, and re-exported by lib/matches.ts.
 */
export const MIN_RATED_GAMES = 10

/** The colour a rating gives, or 0 below Poroporo or before ten games. */
export function ratingRung(rating: number, games: number): number {
  if (games < MIN_RATED_GAMES || rating < RATING_FLOOR) return 0
  return Math.min(TOP_RUNG, DRILL_CAP + 1 + Math.floor((rating - RATING_FLOOR) / RATING_STEP))
}

/** A Game-rung event's colour: the higher of the capped drill colour and the rating colour. */
export function gameEventRung(drillRung: number, ratingColour: number): number {
  return Math.max(Math.min(drillRung, DRILL_CAP), ratingColour)
}

// ─── Strength: a ratio of bodyweight ─────────────────────────────────────────
// The player picks an optional 10kg band, never a number, and the ratio is
// taken against the band's MIDDLE: the bottom edge would flatter everyone in
// the band and the top edge would punish them, and the middle halves the worst
// case. No band means no strength grade: the event is ungradeable for that
// player, not failed. Juniors are never asked; they are graded as a 50kg
// lifter, then shifted by age like any other standard.

export type BodyweightBand = { label: string; min: number; max: number | null; mid: number }

export const BODYWEIGHT_BANDS: readonly BodyweightBand[] = [
  { label: 'Under 50kg', min: 0, max: 50, mid: 45 },
  { label: '50 to 60kg', min: 50, max: 60, mid: 55 },
  { label: '60 to 70kg', min: 60, max: 70, mid: 65 },
  { label: '70 to 80kg', min: 70, max: 80, mid: 75 },
  { label: '80 to 90kg', min: 80, max: 90, mid: 85 },
  { label: '90 to 100kg', min: 90, max: 100, mid: 95 },
  { label: '100 to 110kg', min: 100, max: 110, mid: 105 },
  { label: '110kg and over', min: 110, max: null, mid: 115 },
]

export const JUNIOR_BODYWEIGHT_KG = 50
export const PLATE_KG = 2.5

/**
 * Kilogram thresholds for a ratio ladder at a bodyweight, rounded to the nearest
 * 2.5kg plate. A null ratio is the empty bar, Kiwikiwi on every strength event,
 * which any recorded lift meets: pass only lifts that actually happened.
 */
export function ratioThresholdsKg(ratios: readonly (number | null)[], bodyweightKg: number): number[] {
  return ratios.map((r) => (r == null ? 0 : Math.round((r * bodyweightKg) / PLATE_KG) * PLATE_KG))
}

/**
 * The bodyweight a strength standard is taken against: the fixed junior weight,
 * or the middle of the player's band. Null means the player has no band, so
 * their strength events are ungradeable rather than failed.
 */
export function strengthBodyweight(band: AgeBand, bandLabel: string | null): number | null {
  if (band === 'U12' || band === 'U14' || band === 'U16') return JUNIOR_BODYWEIGHT_KG
  return BODYWEIGHT_BANDS.find((b) => b.label === bandLabel)?.mid ?? null
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
