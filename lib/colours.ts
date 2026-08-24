// ─── AllSport Colours — RETIRED, kept for history ────────────────────────────
//
// The colour ladder was the grading system until v0.6.0.0, when it was replaced
// by the twelve taniwha (lib/taniwha.ts). This module is no longer a ladder: it
// is a lookup table so the dashboard's points-history modal can still render the
// colours players genuinely earned, on the dates they earned them.
//
// WHY THIS STILL EXISTS AT ALL
// `colour_awards` holds ~19 rows recording colours really awarded and really
// celebrated. Rewriting them as taniwha parts would fabricate history, and the
// numbers do not even line up: Kahurangi was rung 7 at 5,000 points, and 5,000
// points is 5 taniwha parts. So the table stays and the timeline keeps showing
// it as the colours era.
//
// WHAT WAS DELETED WITH THE LADDER
// Everything that computed a player's CURRENT standing: colourForPoints,
// nextColour, nextColourFrom, progressToNext, crossedRungs, the live-session
// predicates, colourCardStyle and emblemSrc. Nothing derives a colour from a
// points total any more — taniwha.ts does that job now. The points-economy
// constants (MIN_PLACEMENT_POINTS and friends) moved to lib/taniwha.ts because
// they describe the session-to-points contract, which outlives any grading
// system built on it.
//
// DO NOT ADD TO THIS FILE. A new rung, a new threshold or a new predicate here
// means two grading systems are live at once, which is exactly the confusion
// the taniwha rework existed to end.

import type { CSSProperties } from 'react'
import { RAINBOW } from './domainColours'

export { RAINBOW }

export type Colour = {
  /** 1..19, stable forever — `colour_awards.rung` stores this. */
  rung: number
  name: string
  /** English gloss. */
  english: string
  /** Lifetime points it required, at the time. Historical record only. */
  threshold: number
  /** Border, heading text, chip edge. Hex, or RAINBOW. */
  accent: string
  /** Card background at the time. Hex, or RAINBOW. */
  surface: string
}

type Seed = { name: string; english: string; threshold: number; colour: string }

const CYCLE_1: Seed[] = [
  { name: 'Mā',        english: 'White',   threshold: 0,      colour: '#ffffff' },
  { name: 'Kiwikiwi',  english: 'Grey',    threshold: 500,    colour: '#888888' },
  { name: 'Whero',     english: 'Red',     threshold: 1_000,  colour: '#EA4742' },
  { name: 'Karaka',    english: 'Orange',  threshold: 2_000,  colour: '#F9B051' },
  { name: 'Kōwhai',    english: 'Yellow',  threshold: 3_000,  colour: '#F9E051' },
  { name: 'Kākāriki',  english: 'Green',   threshold: 4_000,  colour: '#4DB26E' },
  { name: 'Kahurangi', english: 'Blue',    threshold: 5_000,  colour: '#2371BB' },
  { name: 'Poroporo',  english: 'Purple',  threshold: 6_000,  colour: '#B87DB5' },
  { name: 'Uenuku',    english: 'Rainbow', threshold: 8_000,  colour: RAINBOW   },
]

/** Cycle 2 repeated cycle 1 prefixed "Taniwha", skipping Mā. */
const CYCLE_2 = CYCLE_1.slice(1, 9)

export const COLOURS: Colour[] = [
  ...CYCLE_1.map((c, i) => ({
    rung: i + 1,
    name: c.name,
    english: c.english,
    threshold: c.threshold,
    accent: c.colour,
    // Pure white was unusable as a card surface on the dark theme.
    surface: c.name === 'Mā' ? '#f0f0f0' : c.colour,
  })),
  { rung: 10, name: 'Taniwha', english: 'Black', threshold: 10_000, accent: '#F9B051', surface: '#000000' },
  ...CYCLE_2.map((c, i) => ({
    rung: 11 + i,
    name: `Taniwha ${c.name}`,
    english: c.english,
    threshold: (11 + i - 9) * 10_000, // 20,000 … 90,000
    accent: c.colour,
    surface: '#000000',
  })),
  { rung: 19, name: 'Ngā Taniwha', english: 'The Taniwha', threshold: 100_000, accent: '#F9B051', surface: '#000000' },
]

export function colourByRung(rung: number): Colour | null {
  return COLOURS.find(c => c.rung === rung) ?? null
}

const isGradient = (v: string) => v.startsWith('linear-gradient')

/**
 * The colour to render a colour's NAME in, on a dark page. Distinct from the
 * card ink it used to have: Mā's ink was near-black and is invisible here.
 */
export function colourOnDark(c: Colour): string {
  if (isGradient(c.accent)) return '#F9B051' // rainbow cannot be a text colour
  if (c.name === 'Mā') return '#e8e8e8'      // pure white is too loud
  return c.accent
}

/**
 * The small chip on the colour timeline. Fill and edge only; sizing is the
 * caller's business.
 *
 * The black-card family gets an accent EDGE so Taniwha and cycle 2 stay
 * distinguishable at 22-28px. A gradient edge needs the two-layer
 * background-clip trick — CSS `border` only accepts a solid colour and
 * otherwise falls back silently, which shipped as a real bug twice.
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
