// ─── The colour a score reaches ──────────────────────────────────────────────
// On the live screen a scored event's button takes the colour its score meets
// on the grading standards (Tāne, 26 Sept 2026), so a player sees what a lift
// was worth the moment they enter it.
//
// This is the SAME calculation HOME grades on — eventGrade() in
// lib/playerGrades.ts, fed only today's rows — so the button can never promise
// a colour the standards would not give. Two consequences of reusing it:
//   · a Game-rung result (a win, draw or loss) earns no drill colour, and a
//     rating colour needs recorded games, so a game played today stays neutral;
//   · a strength lift with no bodyweight declared stays neutral, because a
//     ratio standard cannot be graded without one.
//
// Pure — no React, no Supabase.

import type { EventData } from './eventData'
import { eventGrade, type GradePlayer } from './playerGrades'
import { GRADES, gradeForRung, gradeInk } from './grading'
import { RAINBOW } from './domainColours'

export type ScoreRow = {
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
}

/**
 * The highest colour today's rows reach on this event, 0 when none.
 *
 * `bodyweightKg` is the declaration in force today. Every row on this screen is
 * from the same day, so one number serves them all.
 */
export function scoreRung(
  ev: EventData | undefined,
  rows: readonly ScoreRow[],
  player: GradePlayer | null,
  bodyweightKg: number | null,
): number {
  if (!ev || !player || rows.length === 0) return 0
  return eventGrade(ev, rows.map(r => ({
    event_name: ev.name,
    raw_score: r.raw_score,
    weight_kg: r.weight_kg,
    difficulty_tier: r.difficulty_tier,
    bodyweightKg,
  })), player).rung
}

export type RungPaint = {
  name: string
  /** The row's CSS background (and, for Uenuku, the rainbow border). */
  background: string
  border: string
  /** Colour the score is written in. */
  ink: string
  rainbow: boolean
}

/**
 * How a button looks at a rung, or null for no colour. Uenuku draws a rainbow
 * border (CSS `border` cannot take a gradient, hence the two-layer
 * background-clip) and Taniwha a black card with a white border, as on HOME.
 */
export function rungPaint(rung: number): RungPaint | null {
  if (rung < 1 || rung > GRADES.length) return null
  const g = gradeForRung(rung)
  if (g.rainbow) {
    return {
      name: g.name, rainbow: true, ink: '#F397C0',
      background: `linear-gradient(#17121c, #17121c) padding-box, ${RAINBOW} border-box`,
      border: '1.5px solid transparent',
    }
  }
  if (g.inverted) return { name: g.name, rainbow: false, ink: '#ffffff', background: '#000', border: '1.5px solid #ffffff' }
  return { name: g.name, rainbow: false, ink: gradeInk(g), background: `${g.hex}1f`, border: `1.5px solid ${g.hex}` }
}

/** A progress-bar segment's fill at a rung. Taniwha is white: black vanishes on the dark theme. */
export function rungSegment(rung: number): string | null {
  if (rung < 1 || rung > GRADES.length) return null
  const g = gradeForRung(rung)
  return g.rainbow ? RAINBOW : g.inverted ? '#ffffff' : g.hex
}
