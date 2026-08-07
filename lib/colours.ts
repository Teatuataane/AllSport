// ─── AllSport Colours ────────────────────────────────────────────────────────
// The single source of truth for the colour ladder.
//
// Colours are LIFETIME. Points accumulate for as long as a player plays and
// never reset. (They used to reset each January; the seasonal `rankings` table
// still drives the /leaderboard ranking, but it no longer drives colours.)
//
// 19 rungs:
//   1–10  cycle 1   Mā … Taniwha              (0 … 10,000)
//  11–18  cycle 2   Taniwha Kiwikiwi … Taniwha Uenuku  (+10,000 each)
//     19  peak      Ngā Taniwha               (100,000, hard cap)
//
// Cycle 2 repeats cycle 1's colours prefixed with "Taniwha", skipping Mā —
// "Taniwha Mā" would read as a demotion. There is no rung 20: Ngā Taniwha is
// the end of the ladder, so "Taniwha" never stacks into "Taniwha Taniwha".
//
// A colour, once earned, is never lost. A voided session or a deleted score can
// lower a player's lifetime total; `colour_awards` is append-only and display
// always reads the highest rung ever awarded, not the rung the current total
// implies. Use `colourForPoints` only for progress toward the NEXT rung.

import type { CSSProperties } from 'react'

export const RAINBOW =
  'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)'

/** The emblem shown on a colour card. See public/colour-emblems/. */
export type EmblemKind =
  | 'none'    // cycle 1 up to Uenuku — the colour carries it
  | 'single'  // one taniwha, tinted the accent colour — Taniwha and all of cycle 2
  | 'twin'    // the full crest, both taniwha — Ngā Taniwha only

export type ColourCycle = 1 | 2 | 'peak'

export type Colour = {
  /** 1..19, stable forever — `colour_awards.rung` stores this. */
  rung: number
  name: string
  /** English gloss, shown under the name in the Colour Key. */
  english: string
  /** Lifetime points required. */
  threshold: number
  cycle: ColourCycle
  /** Border, heading text and progress-bar fill. Hex, or RAINBOW. */
  accent: string
  /** Card background. Hex, or RAINBOW. */
  surface: string
  /** Text colour that sits on `surface`. */
  ink: string
  emblem: EmblemKind
}

export const PEAK_RUNG = 19
export const PEAK_POINTS = 100_000

/** Minimum placement award for anyone who takes part in a session. */
export const MIN_PLACEMENT_POINTS = 10
export const EFFORT_POINTS_PER_LEVEL = 5
export const MAX_EFFORT_LEVEL = 20
/** 100 placement + 100 effort. Nothing can score more in one session. */
export const MAX_SESSION_POINTS = 200

// ── Cycle 1 ──────────────────────────────────────────────────────────────────
// Hex values are the canonical brand palette from CLAUDE.md. Note Kōwhai is
// #F9E051: the dashboard's old GRADES array had #FFE566, which disagreed with
// every other surface in the app.

type Cycle1Seed = {
  name: string
  english: string
  threshold: number
  colour: string
  ink: string
}

const CYCLE_1: Cycle1Seed[] = [
  { name: 'Mā',        english: 'White',   threshold: 0,      colour: '#ffffff', ink: '#1a1a1a' },
  { name: 'Kiwikiwi',  english: 'Grey',    threshold: 500,    colour: '#888888', ink: '#ffffff' },
  { name: 'Whero',     english: 'Red',     threshold: 1_000,  colour: '#EA4742', ink: '#ffffff' },
  { name: 'Karaka',    english: 'Orange',  threshold: 2_000,  colour: '#F9B051', ink: '#000000' },
  { name: 'Kōwhai',    english: 'Yellow',  threshold: 3_000,  colour: '#F9E051', ink: '#000000' },
  { name: 'Kākāriki',  english: 'Green',   threshold: 4_000,  colour: '#4DB26E', ink: '#ffffff' },
  { name: 'Kahurangi', english: 'Blue',    threshold: 5_000,  colour: '#2371BB', ink: '#ffffff' },
  { name: 'Poroporo',  english: 'Purple',  threshold: 6_000,  colour: '#B87DB5', ink: '#ffffff' },
  { name: 'Uenuku',    english: 'Rainbow', threshold: 8_000,  colour: RAINBOW,   ink: '#ffffff' },
  { name: 'Taniwha',   english: 'Black',   threshold: 10_000, colour: '#F9B051', ink: '#F9B051' },
]

/** Mā is index 0 and is skipped by cycle 2. */
const CYCLE_2_SEEDS = CYCLE_1.slice(1, 9) // Kiwikiwi … Uenuku

export const COLOURS: Colour[] = [
  // Rungs 1–9: the colour is the card.
  ...CYCLE_1.slice(0, 9).map((c, i) => ({
    rung: i + 1,
    name: c.name,
    english: c.english,
    threshold: c.threshold,
    cycle: 1 as const,
    accent: c.colour,
    // Pure white is unusable as a card surface on a dark theme.
    surface: c.name === 'Mā' ? '#f0f0f0' : c.colour,
    ink: c.ink,
    emblem: 'none' as const,
  })),

  // Rung 10: black card, amber accent, one taniwha.
  {
    rung: 10,
    name: 'Taniwha',
    english: 'Black',
    threshold: 10_000,
    cycle: 1,
    accent: '#F9B051',
    surface: '#000000',
    ink: '#F9B051',
    emblem: 'single',
  },

  // Rungs 11–18: black card, the cycle colour as accent, one taniwha.
  ...CYCLE_2_SEEDS.map((c, i) => ({
    rung: 11 + i,
    name: `Taniwha ${c.name}`,
    english: c.english,
    threshold: (11 + i - 9) * 10_000, // 20,000 … 90,000
    cycle: 2 as const,
    accent: c.colour,
    surface: '#000000',
    // Rainbow can't be a text colour, so Taniwha Uenuku letters stay white and
    // the rainbow lives on the border and progress bar.
    ink: c.colour === RAINBOW ? '#ffffff' : c.colour,
    emblem: 'single' as const,
  })),

  // Rung 19: the whole crest. Hard cap.
  {
    rung: PEAK_RUNG,
    name: 'Ngā Taniwha',
    english: 'The Taniwha',
    threshold: PEAK_POINTS,
    cycle: 'peak',
    accent: '#F9B051',
    surface: '#000000',
    ink: '#F9B051',
    emblem: 'twin',
  },
]

// ── Lookups ──────────────────────────────────────────────────────────────────

export function colourByRung(rung: number): Colour | null {
  return COLOURS.find(c => c.rung === rung) ?? null
}

/**
 * The colour a lifetime total earns. Clamps to Ngā Taniwha above 100,000 —
 * the ladder has no rung 20.
 */
export function colourForPoints(points: number): Colour {
  let found = COLOURS[0]
  for (const c of COLOURS) if (points >= c.threshold) found = c
  return found
}

/** The next rung up, or null once Ngā Taniwha is reached. */
export function nextColour(points: number): Colour | null {
  return COLOURS.find(c => points < c.threshold) ?? null
}

/**
 * The next rung to aim for, given both the points total AND the highest rung
 * already awarded.
 *
 * These can disagree. When a kaiwhakawā taps "Celebrated" mid-session the award
 * row (and `highest_rung`) is written immediately, but `lifetime_points` only
 * catches up when the session closes. Without this, a player who has just been
 * given Whero in front of the room would see "Whero — 60 pts to go" on their
 * own dashboard.
 */
export function nextColourFrom(points: number, highestRung: number): Colour | null {
  const byPoints = nextColour(points)
  const byRung = colourByRung(highestRung + 1)
  if (!byPoints) return null
  if (!byRung) return null
  return byPoints.rung > byRung.rung ? byPoints : byRung
}

/** Percentage progress from the current rung toward the next (0–100). */
export function progressToNext(points: number): number {
  const current = colourForPoints(points)
  const next = nextColour(points)
  if (!next) return 100
  const span = next.threshold - current.threshold
  return Math.min(Math.max(((points - current.threshold) / span) * 100, 0), 100)
}

/**
 * Every rung crossed by moving from `before` to `after` points, lowest first.
 *
 * The smallest gap on the ladder (500) is larger than MAX_SESSION_POINTS (200),
 * so in practice this returns at most one colour per session. It returns a list
 * anyway so a backfill replay, or any future change to the points formula,
 * can't silently skip an award.
 */
export function crossedRungs(before: number, after: number): Colour[] {
  if (after <= before) return []
  return COLOURS.filter(c => c.threshold > before && c.threshold <= after)
}

// ── Live-session alert predicates ────────────────────────────────────────────
// Points are only written when a session closes, so an alert built on stored
// data fires after everyone has gone home. These let the kaiwhakawā be told
// during the session instead. Mirrored exactly by the claim_colour_award RPC.

/**
 * Points a player is guaranteed to bank from a session already in progress,
 * whatever happens next: the minimum placement award plus effort already
 * earned. Uses NO placement ranking, so another player finishing strongly can
 * never invalidate it.
 */
export function guaranteedSessionPoints(effortLevel: number): number {
  const level = Math.min(Math.max(effortLevel, 0), MAX_EFFORT_LEVEL)
  return MIN_PLACEMENT_POINTS + level * EFFORT_POINTS_PER_LEVEL
}

/**
 * "Has earned it" — safe to announce out loud. True only when the crossing
 * holds at the player's guaranteed worst case.
 */
export function hasEarnedDuringSession(
  lifetimePoints: number,
  effortLevel: number,
  threshold: number,
): boolean {
  return lifetimePoints + guaranteedSessionPoints(effortLevel) >= threshold
}

/**
 * "On track for it today" — uses the player's current provisional placement, so
 * it can retract if they slip. Never announce this one as a result.
 */
export function isOnTrackDuringSession(
  lifetimePoints: number,
  projectedSessionPoints: number,
  threshold: number,
): boolean {
  return lifetimePoints + projectedSessionPoints >= threshold
}

// ── Styling ──────────────────────────────────────────────────────────────────

const isGradient = (v: string) => v.startsWith('linear-gradient')

/**
 * Full-bleed colour card (dashboard Colours card, session-end takeover).
 *
 * Includes the border, so call sites don't each re-derive it. The black-card
 * family carries an accent edge; when that accent is the rainbow it needs the
 * two-layer background-clip trick, because CSS `border` only takes a solid
 * colour and would otherwise silently fall back to amber.
 */
export function colourCardStyle(c: Colour): CSSProperties {
  if (c.surface === '#000000') {
    return isGradient(c.accent)
      ? {
          background: '#000000',
          color: c.ink,
          border: '2px solid transparent',
          backgroundImage: `linear-gradient(#000,#000), ${c.accent}`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }
      : { background: '#000000', color: c.ink, border: `2px solid ${c.accent}` }
  }
  return isGradient(c.surface)
    ? { backgroundImage: c.surface, color: c.ink }
    : { background: c.surface, color: c.ink }
}

/**
 * The colour to render the colour's NAME in, on a dark page (leaderboard rows,
 * key, timeline). Distinct from `ink`, which is text ON the card: Mā's ink is
 * near-black, which is invisible against the dark theme.
 */
export function colourOnDark(c: Colour): string {
  if (isGradient(c.accent)) return '#F9B051' // rainbow can't be a text colour
  if (c.name === 'Mā') return '#e8e8e8'      // pure white is too loud for rung 1
  return c.accent
}

/**
 * The small colour chip used by the leaderboard key, the colour timeline, the
 * /judge watchlist and the live alert banner. Sizing is the caller's business;
 * this is fill and edge only.
 *
 * The black-card family gets an accent EDGE so Taniwha and cycle 2 stay
 * distinguishable at 22-28px. A gradient edge needs the two-layer
 * background-clip trick — `border` only accepts a solid colour and otherwise
 * falls back silently (this shipped as a real bug twice before it was caught).
 */
export function colourChipStyle(c: Colour): CSSProperties {
  const FILL = '#111111'
  if (c.surface === '#000000') {
    return isGradient(c.accent)
      ? {
          background: FILL,
          border: '2px solid transparent',
          backgroundImage: `linear-gradient(${FILL},${FILL}), ${c.accent}`,
          backgroundOrigin: 'border-box',
          backgroundClip: 'padding-box, border-box',
        }
      : { background: FILL, border: `2px solid ${c.accent}` }
  }
  return isGradient(c.surface)
    ? { backgroundImage: c.surface }
    : { background: c.surface, boxShadow: `0 0 5px ${c.accent}44` }
}

/**
 * Path to the emblem watermark, or null when the rung has none.
 * Rendered as a CSS mask tinted `accent`, same pipeline as EventIcon.
 */
export function emblemSrc(c: Colour): string | null {
  if (c.emblem === 'none') return null
  return `/colour-emblems/${c.emblem === 'twin' ? 'nga-taniwha' : 'taniwha'}.png`
}
