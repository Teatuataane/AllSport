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
//   2. Your colour in a domain is the AVERAGE of your best SIX events there,
//      rounded down. An empty slot counts as Mā (Tāne, 26 September 2026 —
//      was "the highest grade met in half the domain's events").
//   3. Your overall grade is the AVERAGE of your ten domain colours, rounded
//      down, and CAPPED by official games played (GAMES_REQUIRED). It was the
//      LOWEST domain until 24 September 2026.
//
// Rule 2 is what makes going wide pay. Until you have six events on the
// board, every new one lifts the average from nothing; after six, a new event
// only counts if it beats one of the six. The half-the-domain rule it replaced
// scored your SIXTH-best event, so five brilliant events and a gap read as Mā.
//
// Rule 3 still says "one sport, every sport": the average is always over TEN,
// so a domain on Mā counts zero and drags it. The games cap is what stops a
// colour being built on solo logging alone: domain colours can be earned
// anywhere, but the overall needs the games in the room behind it.
//
// Training units were a third gate on every domain colour until 26 September
// 2026, and were removed from the app entirely on 27 September 2026.
//
// ── Why SIX, and why "of the events available to you" ───────────────────────
// Six is half of a twelve-event domain: enough that a colour is never won on a
// single favourable movement, and the point where three brilliant events and
// eight solid ones score the same. It never grows with a pool — Flexibility
// holds sixteen — because a pool is a menu, not a syllabus.
//
// Six of the events AVAILABLE to that player. A kaiwhakawā marks an event
// unavailable (injury, disability, permanent limitation) and it leaves the
// domain; a player with four available events averages over four. This is how
// a coach adapts a grading for an injured student: one joint costs you
// options, never a domain.
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

/**
 * Bumped whenever a rule here changes what colour the same evidence earns.
 *
 * A rules deploy writes no rows, so the recheck's cheap probe
 * (grades_need_recheck) sees nothing new and skips everyone whose watermark is
 * current: HOME would show the new computed colour while BOARD kept the old
 * conferred one. HOME forces one full recheck per player when this differs
 * from the version it last checked under (lib/useNewColours.ts).
 */
export const GRADING_RULES_VERSION = '2026-09-26-best-six'
export const DOMAIN_COUNT = 10

/**
 * A colour's ink on a dark page: Taniwha is black, so it reads as white, and
 * Mā reads as a muted grey. Pure, so server pages (the colours guide) can call it.
 */
export function gradeInk(g: GradeRung): string {
  return g.rung === 0 ? '#777' : g.inverted ? '#ffffff' : g.hex
}

/** Mā for 0, otherwise the rung. Out-of-range input is clamped, never thrown. */
export function gradeForRung(rung: number): GradeRung {
  if (rung <= 0) return MA
  return GRADES[Math.min(rung, TOP_RUNG) - 1]
}

// ─── Rule 2: the domain colour ───────────────────────────────────────────────

/**
 * How many of a domain's events are averaged into its colour. Tāne, 26
 * September 2026. Defined once; the guide and HOME read it from here.
 */
export const DOMAIN_TOP_EVENTS = 6

export type DomainGradeInput = {
  domainNumber: number
  /** Every event slug in the domain, from the canonical roster. */
  eventSlugs: string[]
  /**
   * Events in this domain that can never carry a standard, for everybody —
   * after the September 2026 difficulty overhaul, Wrestling alone.
   *
   * They leave the domain, not merely score 0: a win, draw or loss says
   * nothing about a population, so no drill can ever lift one off Mā.
   */
  ungradeable?: ReadonlySet<string>
  /**
   * eventSlug → highest rung whose standard the player has met in that event
   * (lifetime best). Absent means never played; 0 means played but below the
   * bottom rung. Both fill a slot as Mā.
   */
  rungByEvent: ReadonlyMap<string, number>
  /**
   * Coach-confirmed events this player cannot do. They leave the domain, so a
   * player with fewer than six available averages over what they have.
   */
  unavailable?: ReadonlySet<string>
  /**
   * Strength events this player has declared no bodyweight for.
   *
   * These STAY in the domain and score 0 — they are NOT removed the way
   * `ungradeable` is. Passing them here only lets the result say WHY the
   * domain has no colour.
   */
  bodyweightBlocked?: ReadonlySet<string>
}

export type DomainGradeResult = {
  domainNumber: number
  /** The average of the counted slots, rounded down. 0 = Mā. */
  rung: number
  /**
   * Events that count here — the domain's roster minus the events nobody can
   * be graded in, minus this player's own exemptions.
   */
  availableCount: number
  /** How many slots are averaged: six, or fewer when fewer are available. */
  slots: number
  /** The events filling those slots with a colour, best first. At most `slots`. */
  counted: string[]
  /** The exact average before rounding, e.g. 2.33. 0 when nothing can be graded. */
  average: number
  /** The rung above, or null at the top. */
  nextRung: number | null
  /**
   * Colours still to add across the slots to reach `nextRung`: one event up
   * one colour, or an empty slot filled at Kiwikiwi, is one. 0 at the top.
   */
  toNext: number
  /**
   * The domain has no colour AND at least one of its events is a strength
   * standard this player has not declared a bodyweight for. Display only: it
   * tells "not graded here yet" from "cannot be graded here until a number is
   * declared". Optional so a caller building a result by hand need not care.
   */
  blockedByBodyweight?: boolean
}

/** How many events are averaged for a player with `availableCount` available. */
export function slotsForDomain(availableCount: number): number {
  return Math.max(0, Math.min(availableCount, DOMAIN_TOP_EVENTS))
}

export function domainGrade(input: DomainGradeInput): DomainGradeResult {
  const unavailable = input.unavailable ?? new Set<string>()
  const ungradeable = input.ungradeable ?? new Set<string>()
  // NOT subtracted from `available`: a strength event with no declared
  // bodyweight stays in the domain and scores 0. Dropping it is what made
  // skipping the question the winning move.
  const blocked = input.bodyweightBlocked ?? new Set<string>()
  const available = input.eventSlugs.filter((s) => !unavailable.has(s) && !ungradeable.has(s))
  const slots = slotsForDomain(available.length)

  // A domain with nothing gradeable and available cannot be graded. Without
  // this guard the average divides by zero.
  if (slots === 0) {
    return {
      domainNumber: input.domainNumber, rung: 0, availableCount: 0, slots: 0,
      counted: [], average: 0, nextRung: 1, toNext: 0, blockedByBodyweight: false,
    }
  }

  // Best first; a tie keeps roster order, so `counted` is stable.
  const ranked = available
    .map((slug) => ({ slug, rung: Math.max(0, Math.min(TOP_RUNG, input.rungByEvent.get(slug) ?? 0)) }))
    .sort((a, b) => b.rung - a.rung)
    .slice(0, slots)
  const sum = ranked.reduce((t, e) => t + e.rung, 0)
  // Integer arithmetic, so no epsilon: 17 / 6 is 2 however it is rounded.
  const rung = Math.floor(sum / slots)
  const nextRung = rung >= TOP_RUNG ? null : rung + 1

  return {
    domainNumber: input.domainNumber,
    rung,
    availableCount: available.length,
    slots,
    counted: ranked.filter((e) => e.rung > 0).map((e) => e.slug),
    average: sum / slots,
    nextRung,
    toNext: nextRung === null ? 0 : nextRung * slots - sum,
    // Only when the domain has nothing at all: once a colour is held, a
    // missing bodyweight is holding it back rather than blocking it.
    blockedByBodyweight: rung === 0 && available.some((s) => blocked.has(s)),
  }
}

// ─── Rule 3: the overall grade ───────────────────────────────────────────────

/**
 * Cumulative OFFICIAL games needed to hold each OVERALL colour. Index = rung.
 * Tāne, 16 September 2026, when it gated each domain colour; since 26
 * September 2026 it caps the overall colour only.
 *
 * A game is a finished, unvoided official session with any result. A
 * personal-training session run by a kaiwhakawā is witnessed evidence but NOT
 * a game: the cap exists to bring people into the room.
 */
export const GAMES_REQUIRED: readonly number[] = [0, 1, 3, 5, 8, 12, 16, 20, 30, 40, 55, 75, 100]

/** The highest overall colour `games` official games allow. */
export function gamesCapRung(games: number): number {
  let r = 0
  while (r < TOP_RUNG && games >= GAMES_REQUIRED[r + 1]) r++
  return r
}

/**
 * The average of the ten domain colours, rounded down, BEFORE the games cap.
 * Always over DOMAIN_COUNT, never over the domains held, or holding one
 * Taniwha domain would make a player Taniwha overall.
 */
export function averageRung(rungs: Iterable<number>): number {
  let sum = 0
  for (const r of rungs) sum += Math.max(0, Math.min(TOP_RUNG, r))
  return Math.floor(sum / DOMAIN_COUNT + 1e-9)
}

/**
 * The overall colour: the AVERAGE of the ten domain colours, rounded down,
 * capped by official games played.
 *
 * An average so that raising ANY domain moves it (Tāne, 24 September 2026 —
 * was the lowest). A domain on Mā counts 0, so a gap still drags. The cap
 * (26 September 2026) is what stops a colour resting on solo logging alone.
 *
 * `games` is REQUIRED on purpose: every surface that shows an overall colour
 * must apply the same cap, or HOME and BOARD disagree. Defined ONCE, here:
 * lib/colourBoard.ts, HOME and the family chips call it.
 */
export function overallRung(rungs: Iterable<number>, games: number): number {
  return Math.min(averageRung(rungs), gamesCapRung(games))
}

export type OverallGradeResult = {
  /** The capped overall colour. 0 = Mā. */
  rung: number
  /** The average before the games cap. Above `rung` only when the cap binds. */
  average: number
  /** Domains still on Mā. Each one drags the average. */
  ungraded: number[]
  /** The domains sitting at the minimum — what to train next. */
  weakest: number[]
}

export function overallGrade(domains: readonly DomainGradeResult[], games: number): OverallGradeResult {
  const rungs = domains.map((d) => d.rung)
  const min = rungs.length ? Math.min(...rungs) : 0
  return {
    rung: overallRung(rungs, games),
    average: averageRung(rungs),
    ungraded: domains.filter((d) => d.rung === 0).map((d) => d.domainNumber),
    weakest: domains.filter((d) => d.rung === min).map((d) => d.domainNumber),
  }
}

// ─── What confers ────────────────────────────────────────────────────────────
// A domain colour confers as soon as the standards give a colour above the one
// held. There is no games or training check on a domain any more, and no
// one-at-a-time rule: that rule only existed because the units count restarted
// at each conferral. A domain can now jump several colours in one session.

export type ColourGate = {
  domainNumber: number
  /** The colour held (conferred), 0 = Mā. */
  held: number
  /** The colour the standards give today (domainGrade's rung). */
  standardsRung: number
  /** `standardsRung` when it is above `held`, otherwise 0. */
  releasable: number
}

/** What a domain has waiting to be conferred. */
export function colourGate(input: { domainNumber: number; standardsRung: number; held: number }): ColourGate {
  // Clamp BEFORE comparing, or a rung above the ladder would re-offer a held Taniwha.
  const rung = Math.min(input.standardsRung, TOP_RUNG)
  return {
    domainNumber: input.domainNumber,
    held: input.held,
    standardsRung: rung,
    releasable: rung > input.held ? rung : 0,
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
// rating colour needs ten games in that sport recorded by both sides (or settled by
// a kaiwhakawā; see rateGames). The colour shown is the
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
// The player declares an exact bodyweight on the day they score, at the top of
// the scoring screen (player_bodyweights, 20260922213125). A lift grades against
// the most recent declaration at or before its own day.
//
// It used to be an optional 10kg band on /profile, graded against the band's
// MIDDLE. One player in 27 ever set one, and the midpoint over-graded the heavy
// half of every band by about a rung on the main lifts. BODYWEIGHT_BANDS and
// bandMidpointKg survive only to read those stored labels back.
//
// No declaration means the lift cannot be graded, but the event STAYS in its
// domain's denominator and scores 0 — see domainGrade. Dropping it made
// skipping the question the winning move: 12 of Maximal Strength's 14 events
// are ratio standards, so an undeclared player had the domain judged on 2
// events needing 1, while a declared player needed 6 of 14.
//
// Juniors declare too (Tāne, 23 September 2026). JUNIOR_BODYWEIGHT_KG is no
// longer a grading input; it is kept as the reference weight the junior
// standards were calibrated against.

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
 * The middle of a 10kg band, in kilograms. Null for anything that is not one
 * of BODYWEIGHT_BANDS' labels.
 *
 * LEGACY BRIDGE ONLY. Bodyweight is declared as an exact number on the day
 * (player_bodyweights, 20260922213125) and the engine works in kilograms.
 * This survives so lib/loadGrades.ts can synthesise a declaration from a stored
 * band while the old columns still exist, and so the seed in that migration has
 * a single definition of the midpoints to agree with. Do not reach for it when
 * grading: take the kilograms off the row.
 */
export function bandMidpointKg(bandLabel: string | null | undefined): number | null {
  return BODYWEIGHT_BANDS.find((b) => b.label === bandLabel)?.mid ?? null
}

/** A bodyweight a player declared on a given NZ day. */
export type BodyweightDeclaration = {
  /** 'YYYY-MM-DD', the NZ day, pinned server-side. */
  measured_on: string
  kg: number
  /** When the row was written. Only the history replay reads it. */
  created_at?: string | null
}

/**
 * The bodyweight a score scored on `day` is graded against: the most recent
 * declaration made on or before that day.
 *
 * CARRY-FORWARD IS UNLIMITED, deliberately and provisionally. A declaration
 * grades every later lift until the next one, so a player who declares once and
 * gains 15kg keeps being graded at the old number. An expiry was considered and
 * NOT added, because adding one now would retroactively un-grade the history
 * seeded from the old bands, and because the scoring screen prompts each
 * session, so in practice the number refreshes. If an expiry is ever wanted it
 * is one constant here plus a decision about what it does to history — it is
 * not a free change.
 *
 * Days are compared as 'YYYY-MM-DD' strings, which sort correctly and are
 * already how both sides store them (sessions.session_date and
 * workouts.performed_on are DATE columns; toNZDateString writes the same shape).
 * These are dates, not instants, so the timestamp trap in gradeStateFrom does
 * not apply.
 */
export function bodyweightOn(
  declarations: readonly BodyweightDeclaration[],
  day: string | null | undefined,
): number | null {
  if (!day) return null
  let best: BodyweightDeclaration | null = null
  for (const d of declarations) {
    if (d.measured_on > day) continue
    if (best === null || d.measured_on > best.measured_on) best = d
  }
  return best && best.kg > 0 ? best.kg : null
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
