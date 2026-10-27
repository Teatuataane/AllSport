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
   * Text colour when the name is written on a dark page, where `hex` itself is
   * too dark to read. Fills, borders and swatches keep `hex`.
   */
  ink?: string
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
  { rung: 2, name: 'Whero', colour: 'red', hex: '#EA4742', ink: '#EE625D', populationTarget: 90 },
  { rung: 3, name: 'Karaka', colour: 'orange', hex: '#F9B051', populationTarget: 80 },
  { rung: 4, name: 'Kōwhai', colour: 'yellow', hex: '#F9E051', populationTarget: 70 },
  { rung: 5, name: 'Kākāriki', colour: 'green', hex: '#4DB26E', populationTarget: 60 },
  { rung: 6, name: 'Kahurangi', colour: 'blue', hex: '#2371BB', ink: '#5A9BE0', populationTarget: 50 },
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
export const GRADING_RULES_VERSION = '2026-10-28-rating-to-kiwikiwi'
export const DOMAIN_COUNT = 10

/**
 * A colour's ink on a dark page: Taniwha is black, so it reads as white, and
 * Mā reads as a muted grey, and a colour too dark for small text on its own tint (Whero, Kahurangi)
 * uses its lighter `ink`. Pure, so server pages (the colours guide) can call it.
 */
export function gradeInk(g: GradeRung): string {
  return g.rung === 0 ? '#777' : g.inverted ? '#ffffff' : g.ink ?? g.hex
}

/**
 * One solid colour to stand for a grade where a rainbow or black will not do:
 * a ring, a track stop. Uenuku takes its pink, Taniwha white (black vanishes
 * on the dark theme), everything else its readable ink.
 */
export function gradeAccent(g: GradeRung): string {
  return g.rainbow ? '#F397C0' : gradeInk(g)
}

/**
 * Mā for 0, otherwise the rung. Out-of-range input is clamped, never thrown,
 * and a half step (5.5, see halfStepCredit) is the colour below it: a
 * half is credit toward a colour, never a colour.
 */
export function gradeForRung(rung: number): GradeRung {
  if (rung < 1) return MA
  return GRADES[Math.min(Math.floor(rung), TOP_RUNG) - 1]
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
   * (lifetime best), or more when a half step credits it (halfStepCredit). Absent means never played; 0 means played but below
   * the bottom rung. Both fill a slot as Mā.
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
  /** The average of the counted slots, rounded down. 0 = Mā. Always whole. */
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
   * Fractional when counted events hold exact scores (hundredths).
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
  // Exact scores (hundredths) do not sum exactly in binary floating point, so
  // a sum that should be exactly 30.00 / 6 must not read as 4.999….
  const rung = Math.floor(sum / slots + 1e-9)
  const nextRung = rung >= TOP_RUNG ? null : rung + 1

  return {
    domainNumber: input.domainNumber,
    rung,
    availableCount: available.length,
    slots,
    counted: ranked.filter((e) => e.rung > 0).map((e) => e.slug),
    average: sum / slots,
    nextRung,
    toNext: nextRung === null ? 0 : Math.round((nextRung * slots - sum) * 100) / 100,
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
  /**
   * The exact overall (Scoring v2): the average of the ten domains' exact
   * averages, floored to hundredths, before the games cap. Display only; the
   * colour stays the average of the whole domain colours, the same rule the
   * published board applies.
   */
  exact: number
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
    exact: Math.floor(domains.reduce((t, d) => t + d.average, 0) / DOMAIN_COUNT * 100 + 1e-9) / 100,
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
// Age SHIFTS THE LADDER; it does not scale the value (settled in review). An
// allowance of one colour earns colour c at the Open standard for colour c - 1,
// so with it a Taniwha is an Open player's Uenuku. How many colours a player
// gets is per domain and per age (lib/ageAllowance.ts, Tāne 20 Oct 2026); the
// functions here take a whole number of colours, or a band for the flat
// allowance a player with no date of birth still gets. Below the Open floor
// the ladder is extrapolated by its own first step, so the youngest players can
// earn the bottom colours for a performance under the Open Kiwikiwi.

export type AgeBand = 'U12' | 'U14' | 'U16' | 'Open' | 'Over40' | 'Over60'

/**
 * The flat allowance before the domain table (lib/ageAllowance.ts): under 14
 * and 60 or over two colours, 14 to 16 and 40 to 59 one, in every domain. Only
 * a player with no date of birth is still graded on it.
 */
export const AGE_SHIFT: Record<AgeBand, number> = {
  U12: 2, U14: 2, U16: 1, Open: 0, Over40: 1, Over60: 2,
}

/**
 * Colours a ladder moves: a band's flat shift, or a whole number of colours
 * given directly. lib/ageAllowance.ts works out the number per domain; a half
 * is never passed here (lib/playerGrades.ts grades it as two whole steps).
 */
export function shiftOf(band: AgeBand | number): number {
  return typeof band === 'number' ? Math.max(0, Math.floor(band)) : AGE_SHIFT[band]
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
  band: AgeBand | number,
  { cap = TOP_RUNG }: { cap?: number } = {}
): number {
  if (thresholds.length === 0) return 0
  const shift = shiftOf(band)
  const top = Math.min(TOP_RUNG, thresholds.length + shift)
  let rung = 0
  for (let c = 1; c <= top; c++) {
    if (score >= thresholdFor(thresholds, c - shift)) rung = c
  }
  return Math.min(rung, cap)
}

// ─── Load-and-hold events: both halves of the standard count ─────────────────
// A weight+time score is `round(kg × 100) × 10000 + secs`, so a heavier load
// outranks any lighter one whatever the time. That order is right for RANKING
// a game (heaviest wins, the hold breaks the tie) and wrong for a COLOUR: read
// as one number, "5kg · 30s" is passed by 15kg held for one second, and the
// top of Toe Lift's ladder by 15.01kg for a second. Decided with Tāne 29 Sept
// 2026: a colour asks for at least the load AND at least the time.

const LOAD_HOLD_BAND = 10000

/** Whether a load-and-hold score meets one threshold: load at least, and hold at least. */
export function meetsLoadHold(score: number, threshold: number): boolean {
  // Below the Open floor the ladder extends by its own first step, which is a
  // bodyweight hold, so the extension is seconds alone (or nothing at all).
  if (threshold <= 0) return score >= threshold
  const kg = Math.floor(score / LOAD_HOLD_BAND), secs = score % LOAD_HOLD_BAND
  const tKg = Math.floor(threshold / LOAD_HOLD_BAND), tSecs = threshold % LOAD_HOLD_BAND
  return kg >= tKg && secs >= tSecs
}

/** rungForScore for a load-and-hold ladder: each colour checks its load and its time. */
export function rungForLoadHold(score: number, thresholds: readonly number[], band: AgeBand | number): number {
  if (thresholds.length === 0) return 0
  const shift = shiftOf(band)
  const top = Math.min(TOP_RUNG, thresholds.length + shift)
  let rung = 0
  for (let c = 1; c <= top; c++) {
    if (meetsLoadHold(score, thresholdFor(thresholds, c - shift))) rung = c
  }
  return rung
}

// ─── Load-and-reps and load-distance-time (5 Oct 2026) ──────────────────────
// Tibialis Curl ('weight+reps') packs `round(kg × 100) × 10000 + reps`, the same
// shape as a load-and-hold, so the same rule holds: at least the load AND at
// least the reps. The carries ('weight+distance+time') pack load, distance and
// time (lib/scoring.ts encodeCarry). Read as one number, "40kg · 100m" would be
// passed by 40.1kg carried a single metre, so each key is checked on its own.
//
// Since the 12 Oct 2026 review a carry colour is a fixed 200m in a time ("0.5×
// BW · ≤ 2:00"), so the time is a key too: at least the load, at least the
// distance, and no slower than the time. A standard with no time ("any", or a
// pre-review "40kg · 100m") carries a time term of 0 or 1, which every carry
// meets, so the older form still reads as load and distance alone.

const CARRY_KG_KEY = 1e9
const CARRY_M_KEY = 1e4

/** A carry score or threshold's keys: load (0.1kg), metres, and the time term (10000 − secs). */
function carryKeys(v: number) {
  return { kg: Math.floor(v / CARRY_KG_KEY), m: Math.floor((v % CARRY_KG_KEY) / CARRY_M_KEY), term: v % CARRY_M_KEY }
}

/** Whether a carry meets one threshold: load, distance and time each at least as good. */
export function meetsCarry(score: number, threshold: number): boolean {
  if (threshold <= 0) return score >= threshold
  const s = carryKeys(score), t = carryKeys(threshold)
  return s.kg >= t.kg && s.m >= t.m && s.term >= t.term
}

/** rungForScore for a carry ladder: each colour checks its load and its distance. */
export function rungForCarry(score: number, thresholds: readonly number[], band: AgeBand | number): number {
  if (thresholds.length === 0) return 0
  const shift = shiftOf(band)
  const top = Math.min(TOP_RUNG, thresholds.length + shift)
  let rung = 0
  for (let c = 1; c <= top; c++) {
    if (meetsCarry(score, thresholdFor(thresholds, c - shift))) rung = c
  }
  return rung
}

// ─── Half steps (10 Oct 2026) ────────────────────────────────────────────────
// Tāne, 10 Oct 2026: a player who lifts the LOAD of a higher colour but falls
// short of its time, reps or distance earns half a colour below that colour.
// Without it, both-keys grading is a cliff: every Glute Thrust colour from
// Kōwhai up asks for 30s, so 180kg held for 25s (Taniwha's load) earned only
// Kiwikiwi. With it, that effort is worth Uenuku and a half (11.5), and Toe
// Lift 5kg for 45s, one step short of Parahi's 5kg for 60s, Poroporo and a half.
//
// The highest colour whose load is reached counts, not only the next one,
// because the cliff is not one step deep: Glute Thrust's next colour above
// Kiwikiwi is a bodyweight hold with no load to reach at all.
//
// A floor: the other key must reach at least HALF of that colour's, or one
// second under 180kg would be worth Uenuku. 25s of a 30s hold passes.
//
// The half is CREDIT, not a colour. It counts in the domain average (best six)
// and in a game's colour total (so on the season board), but no event is ever
// conferred at it: the colour held stays the both-keys rung, and gradeForRung
// reads 11.5 as Uenuku.
//
// Only the load earns it. The other way round (the time, reps or distance of
// a higher colour at a lighter load) would credit almost everyone on a ladder
// whose every rung asks for the same 30s.

/** What reaching part of a colour is worth: half a colour below it. */
export const HALF_STEP = 0.5

/** The share of a colour's time, reps or distance a half step still needs. */
export const HALF_STEP_FLOOR = 0.5

/**
 * What a compound score at `rung` (from rungForCompound) is worth in an
 * average or a total: `rung`, or half a colour below the highest colour whose
 * LOAD it reaches with at least half that colour's other key, whichever is
 * more. Bodyweight rungs (no load to reach) never count; a mode that is not
 * compound is worth its rung.
 */
export function halfStepCredit(mode: string, score: number, thresholds: readonly number[], band: AgeBand | number, rung: number): number {
  const loadHold = mode === 'weight+time' || mode === 'weight+reps'
  if ((!loadHold && mode !== 'weight+distance+time') || thresholds.length === 0) return rung
  const shift = shiftOf(band)
  const top = Math.min(TOP_RUNG, thresholds.length + shift)
  for (let c = top; c > rung; c--) {
    const tv = thresholdFor(thresholds, c - shift)
    if (loadHold) {
      const load = Math.floor(score / LOAD_HOLD_BAND), other = score % LOAD_HOLD_BAND
      const tLoad = Math.floor(tv / LOAD_HOLD_BAND), tOther = tv % LOAD_HOLD_BAND
      if (tLoad <= 0) continue
      if (load >= tLoad && other >= tOther * HALF_STEP_FLOOR) return c - HALF_STEP
    } else {
      // A carry: the colour's load. Before the 12 Oct 2026 review the short key
      // was the distance (half of it); since then a colour is the full 200m in
      // a time, so the short key is the time: no slower than twice it.
      const s = carryKeys(score), t = carryKeys(tv)
      if (t.kg <= 0 || s.kg < t.kg) continue
      const timed = t.term > 1
      if (!timed && s.m >= t.m * HALF_STEP_FLOOR) return c - HALF_STEP
      if (timed && s.m >= t.m && (CARRY_M_KEY - s.term) * HALF_STEP_FLOOR <= CARRY_M_KEY - t.term) return c - HALF_STEP
    }
  }
  return rung
}

// ─── Exact scores (Scoring v2, Tāne 15 Oct 2026) ────────────────────────────
// A colour is a whole step; the EXACT score says how far between two colour
// lines an effort sits, on the same 0–12 scale: 35 reps between Kōwhai's 30
// and Kākāriki's 40 is 4.5. The whole part is always the colour held, so
// colours, standards and the age shift are unchanged. The exact score is what
// counts in the domain average (best six) and a game's colour total, so
// progress inside a colour shows and games rarely tie. Never conferred.
//
// Floored to hundredths, and never 1 or more past the colour, so it can never
// read as the colour above. At the top of a ladder it is the colour itself.
// SCORING_V2_PLAN.md has the decisions.

/**
 * An exact score as players read it: one decimal, rounded DOWN so 4.99 never
 * shows as 5.0 while the colour is still Kōwhai. "4.5".
 */
export function formatExact(exact: number): string {
  return (Math.floor(exact * 10 + 1e-9) / 10).toFixed(1)
}

/** The most an exact score sits above its colour: just under the next one. */
const EXACT_CEILING = 0.99

/** An exact score: `rung` plus progress (0–1) toward the next colour, floored to hundredths. */
export function exactFrom(rung: number, progress: number): number {
  const p = Math.max(0, Math.min(EXACT_CEILING, Number.isFinite(progress) ? progress : 0))
  return Math.floor((rung + p) * 100 + 1e-9) / 100
}

/**
 * Progress between two lines on one key, higher always better. Across a gap
 * that does not climb (a flat 30s on every colour, or a ladder alternating 5s
 * and 15s holds) the share of the next line's own value stands in.
 */
function keyProgress(score: number, from: number, to: number): number {
  if (score >= to) return 1
  if (to > from) return (score - from) / (to - from)
  return to > 0 ? score / to : 0
}

/** Within-level term of a tiered raw score (tier × 10000 + term). */
const TIER_BAND = 10000

/**
 * The exact score of a one-number score: its colour (rungForScore) plus how far
 * it sits toward the next line. Where the two lines are on DIFFERENT levels
 * of a tiered event, reps on one level are not on a line with another's, so: a
 * score already on the next colour's level counts its share of that colour's
 * reps or seconds (1 one-arm push-up of 20 is .05); one still on this colour's
 * level counts its reps again (twice the colour's reaches the next); a level
 * between is halfway; a timed effort (faster wins) counts none.
 */
export function exactForScore(
  score: number,
  thresholds: readonly number[],
  band: AgeBand | number,
  { cap = TOP_RUNG, tiered = false, timed = false }: { cap?: number; tiered?: boolean; timed?: boolean } = {},
): number {
  if (thresholds.length === 0) return 0
  const rung = rungForScore(score, thresholds, band, { cap })
  const shift = shiftOf(band)
  const top = Math.min(TOP_RUNG, thresholds.length + shift, cap)
  if (rung >= top) return rung
  const from = thresholdFor(thresholds, rung - shift)
  const to = thresholdFor(thresholds, rung + 1 - shift)
  const tier = (v: number) => Math.floor(v / TIER_BAND)
  if (tiered && tier(from) !== tier(to)) {
    // Reps or seconds on one level are not on the same line as another's.
    if (timed) return rung
    // Already on the next colour's level: the share of its reps or seconds.
    if (tier(score) === tier(to)) return exactFrom(rung, (score % TIER_BAND) / Math.max(1, to % TIER_BAND))
    // Still on this colour's level: twice its reps or seconds reaches the next.
    if (tier(score) === tier(from)) {
      const base = from % TIER_BAND
      return exactFrom(rung, (score % TIER_BAND - base) / Math.max(1, base))
    }
    // On a level between the two: halfway.
    return exactFrom(rung, 0.5)
  }
  return exactFrom(rung, keyProgress(score, from, to))
}

/** A packed compound score's keys, each higher-better: [load, time/reps or metres, time term]. */
function compoundKeys(mode: string, v: number): number[] {
  if (mode === 'weight+distance+time') { const k = carryKeys(v); return [k.kg, k.m, k.term] }
  return [Math.floor(v / LOAD_HOLD_BAND), v % LOAD_HOLD_BAND]
}

/**
 * The exact score of a two-part score (load and time, load and reps, a carry):
 * its both-keys colour plus its progress toward the next, which is the WEAKER
 * part's progress (Tāne, 15 Oct 2026: "the lower of the two"). The half step
 * stays as a floor: on a ladder whose every colour asks for the same 30s, the
 * weaker part is the time however heavy the load, and the half step is what
 * stops a Taniwha load held 25s reading as Kiwikiwi.
 */
export function exactForCompound(mode: string, score: number, thresholds: readonly number[], band: AgeBand | number): number {
  const rung = rungForCompound(mode, score, thresholds, band) ?? 0
  if (thresholds.length === 0) return rung
  const half = halfStepCredit(mode, score, thresholds, band, rung)
  const shift = shiftOf(band)
  const top = Math.min(TOP_RUNG, thresholds.length + shift)
  if (rung >= top) return Math.max(rung, half)
  const s = compoundKeys(mode, score)
  const to = compoundKeys(mode, Math.max(0, thresholdFor(thresholds, rung + 1 - shift)))
  const from = rung > 0 ? compoundKeys(mode, Math.max(0, thresholdFor(thresholds, rung - shift))) : to.map(() => 0)
  const progress = Math.min(...s.map((v, i) => keyProgress(v, from[i], to[i])))
  return Math.max(exactFrom(rung, progress), half)
}

// ─── Loads as a share of bodyweight (12 Oct 2026) ───────────────────────────
// Glute Thrust, Leg Ext Hold, Tibialis Curl, Reverse Wrist Ext and the three
// carries write their loads as a share of bodyweight ("0.25× BW · 30s"), like
// the lifts. lib/standards.ts stores those ladders (`bwLoad`) with the load key
// in THOUSANDTHS of bodyweight where a score holds kilograms, and this turns
// one into kilograms at the bodyweight on the row's own day, so the packed
// comparisons above work unchanged. Loads round to the nearest 0.5kg: these are
// small plates and dumbbells, where the lifts' 2.5kg plate step is too coarse.

/**
 * A compound ladder ready to compare with a score: itself, or for a `bwLoad`
 * ladder its loads in kilograms at `bodyweightKg`. Null when the ladder needs
 * a bodyweight and there is none, which the caller treats as unmet.
 */
export function compoundLadderAt(
  mode: string, ladder: readonly number[], bwLoad: boolean | undefined, bodyweightKg: number | null | undefined,
): readonly number[] | null {
  if (!bwLoad) return ladder
  if (bodyweightKg == null || !(bodyweightKg > 0)) return null
  return bwLoadThresholds(mode, ladder, bodyweightKg)
}

/** The load key of a bodyweight ladder: thousandths of bodyweight. */
export const BW_LOAD_SCALE = 1000
export const BW_LOAD_STEP_KG = 0.5

/** A share of bodyweight as kilograms, to the nearest 0.5kg. */
export function bwLoadKg(thousandths: number, bodyweightKg: number): number {
  return Math.round((thousandths / BW_LOAD_SCALE) * bodyweightKg / BW_LOAD_STEP_KG) * BW_LOAD_STEP_KG
}

/**
 * A compound ladder whose loads are shares of bodyweight, in kilograms at
 * `bodyweightKg`: the same packed shape as a score, so rungForCompound and
 * halfStepCredit read it directly. A zero load (a bodyweight hold) stays zero.
 */
export function bwLoadThresholds(mode: string, thresholds: readonly number[], bodyweightKg: number): number[] {
  const key = mode === 'weight+distance+time' ? CARRY_KG_KEY : LOAD_HOLD_BAND
  // A score's load key: 0.1kg on a carry, 0.01kg on a hold or reps.
  const perKg = mode === 'weight+distance+time' ? 10 : 100
  return thresholds.map(t => {
    const th = Math.floor(t / key), rest = t % key
    return Math.round(bwLoadKg(th, bodyweightKg) * perKg) * key + rest
  })
}

/**
 * The rung for a mode whose score packs two keys a colour must BOTH meet, or
 * null for an ordinary one-number mode (use rungForScore). One place, so the
 * grading engine and the game report cannot disagree about which modes these are.
 */
export function isCompoundMode(mode: string): boolean {
  return mode === 'weight+time' || mode === 'weight+reps' || mode === 'weight+distance+time'
}

export function rungForCompound(mode: string, score: number, thresholds: readonly number[], band: AgeBand | number): number | null {
  if (mode === 'weight+time' || mode === 'weight+reps') return rungForLoadHold(score, thresholds, band)
  if (mode === 'weight+distance+time') return rungForCarry(score, thresholds, band)
  return null
}

// ─── Game-rung events: drills and the rating ─────────────────────────────────
// On an event topped by a Game rung, the drills grade Kiwikiwi to Kahurangi and
// a head-to-head rating grades Kiwikiwi to Taniwha: one colour per 100 points,
// Kiwikiwi at 500, Kahurangi at 1,000 (where everyone starts), Poroporo at
// 1,100 and Taniwha at 1,600, so the colour above you wins about two games in
// three. A rating counts from a player's first game in that sport recorded by
// both sides (or settled by a kaiwhakawā, or backed by the other side's own
// result; see rateGames). The colour shown is the higher of the two, and like
// every colour it is never taken back when the rating later falls.
//
// The rating gave only Poroporo and above until 28 Oct 2026, when Tāne asked
// for it to reach down to Kiwikiwi: a player who only plays the game, and
// never the drills, had no colour from it until 1,100. The scale was extended
// downwards rather than moved, so 1,100 is still Poroporo and every existing
// rating keeps its colour.
//
// The rating is NOT age-shifted. It already measures you against the people you
// actually play, of every age; shifting it would turn a 1,500 rating of a
// player over 40 into a Taniwha.

/** Kahurangi: the highest colour a drill can give on a Game-rung event. */
export const DRILL_CAP = 6
export const RATING_START = 1000
/** Poroporo: the rating the scale is anchored on, 1,100. */
export const RATING_POROPORO = 1100
export const RATING_STEP = 100
/** Kiwikiwi, the lowest colour a rating gives: 500. Below it, no colour. */
export const RATING_FLOOR = RATING_POROPORO - DRILL_CAP * RATING_STEP
/** The rating a colour starts at: 500 for Kiwikiwi, 1,100 for Poroporo, 1,600 for Taniwha. */
export function ratingForRung(rung: number): number {
  return RATING_POROPORO + (rung - DRILL_CAP - 1) * RATING_STEP
}
/**
 * Recorded games a player needs in a sport before its rating shows and gives a
 * colour. ONE since 27 Oct 2026 (Tāne: ten games in every sport took far too
 * long). It was ten from 14 Sept 2026, when the simulation
 * (scripts/sim-skill-rating.mjs) put a rating's match to true skill at about
 * 0.55 after one to four games and 0.83 after ten to nineteen.
 *
 * Since 28 Oct 2026 one game always gives a colour: the start (1,000) is
 * Kahurangi, so a first win sits at about Kahurangi and a first loss at about
 * Kākāriki, and a first win over a stronger player takes their rating
 * (lib/headToHead.ts). The guard is that only a game resting on both sides'
 * word is rated, not a game count. Defined once, here, and re-exported by
 * lib/matches.ts.
 */
export const MIN_RATED_GAMES = 1

/** The colour a rating gives, or 0 below Kiwikiwi or before the first game. */
export function ratingRung(rating: number, games: number): number {
  if (games < MIN_RATED_GAMES || rating < RATING_FLOOR) return 0
  return Math.min(TOP_RUNG, DRILL_CAP + 1 + Math.floor((rating - RATING_POROPORO) / RATING_STEP))
}

/**
 * The exact score a rating gives (Scoring v2): 1,150 is Poroporo and a half,
 * 7.5; 950 is Kākāriki and a half, 5.5. 0 wherever ratingRung is 0; Taniwha
 * (12) at 1,600 and above.
 */
export function ratingExact(rating: number, games: number): number {
  const rung = ratingRung(rating, games)
  if (rung === 0 || rung >= TOP_RUNG) return rung
  return exactFrom(rung, (rating - ratingForRung(rung)) / RATING_STEP)
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

/**
 * Age band from the age a player turns in the year being graded (Tāne, 20 Oct
 * 2026: one age for the whole colour year, so a birthday in June never moves a
 * colour mid-season). `ageYears` is that age; lib/seasonYear.ts ageInYear
 * works it out from the birth year.
 *
 * The age decides, not the division. The band used to be read from the
 * division name, and a division is only ever changed by hand: a player who
 * turned 40 kept the Open ladder until a kaiwhakawā moved them, and a junior
 * who turned 17 kept the U16 allowance. The division is only a fallback for a
 * player with no date of birth.
 */
export function ageBand(division: string | null, ageYears: number | null): AgeBand {
  if (ageYears != null && Number.isFinite(ageYears)) {
    if (ageYears < 12) return 'U12'
    if (ageYears < 14) return 'U14'
    if (ageYears < 17) return 'U16'
    if (ageYears >= 60) return 'Over60'
    if (ageYears >= 40) return 'Over40'
    return 'Open'
  }
  // No date of birth: a junior is taken as U14, everyone else as Open. The
  // Masters and Grandmaster divisions this once read are gone (20261019214532).
  return division === 'Juniors' ? 'U14' : 'Open'
}
