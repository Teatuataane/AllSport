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
import { eventRungInGame } from './leaderboardScores'
import { gameColourRung } from './gameReport'

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

/**
 * The grey an icon takes where colour means grade, so the icon never reads as
 * one. A hex, not a CSS var: the icons append alpha to it for their tile.
 */
export const NEUTRAL_ICON_TINT = '#bbbbbb'

/**
 * What one official event adds to this game's colour, live: the same rung the
 * game report and the Season board count (eventRungInGame), so the colour on
 * the game screen is the one the report shows afterwards. A game result pays
 * its floor (win 6, draw 5, loss 4); a rating colour above that is only known
 * at close, so the live figure can only ever be low, never high.
 */
export function liveEventRung(
  ev: EventData | undefined,
  rows: readonly ScoreRow[],
  player: GradePlayer | null,
  bodyweightKg: number | null,
): number {
  if (!ev || !player || rows.length === 0) return 0
  return eventRungInGame(ev.name, rows.map(r => ({
    event_name: ev.name,
    raw_score: r.raw_score,
    weight_kg: r.weight_kg,
    difficulty_tier: r.difficulty_tier,
    bodyweightKg,
  })), player)
}

/**
 * This game's colour so far, as a rung: the official events' rungs summed and
 * divided by ten (gameColourRung), exactly as the game report and /history
 * count it. Added and swapped events never count, as on the Season board.
 */
export function liveGameColourRung(
  slots: readonly { official: boolean; ev: EventData | undefined; rows: readonly ScoreRow[] }[],
  player: GradePlayer | null,
  bodyweightKg: number | null,
): number {
  if (!player) return 0
  const total = slots
    .filter(s => s.official)
    .reduce((t, s) => t + liveEventRung(s.ev, s.rows, player, bodyweightKg), 0)
  return gameColourRung(total)
}

/**
 * The events a workout is scored over: every planned event, plus any scored
 * event no longer in the plan (a plan edited after scoring must not hide a
 * score). In plan order, then entry order. Game-linked workouts are never
 * passed here: their events belong to the game.
 */
export function workoutSlugs(
  planned: readonly string[] | null | undefined,
  entrySlugs: readonly (string | null)[],
): string[] {
  const out = [...(planned ?? [])]
  for (const s of entrySlugs) if (s && !out.includes(s)) out.push(s)
  return out
}

/**
 * A workout's colour (Tāne, 30 Sept 2026: "every input workout should be
 * scored"). Each event takes the colour its best score reaches (scoreRung, the
 * same grading HOME uses), an event planned but not scored counts as Mā, and
 * the workout is the average, rounded down.
 *
 * The same rule a game follows: a game's colour is its ten events' rungs summed
 * and divided by ten, a missed event counting nothing. So "played at Karaka"
 * means the same thing on a game row and a workout row in play history. A
 * workout divides by its own event count rather than ten, because it can hold
 * one event or thirty.
 */
export function workoutColourRung(
  slots: readonly { ev: EventData | undefined; rows: readonly ScoreRow[] }[],
  player: GradePlayer | null,
  bodyweightKg: number | null,
): number {
  if (!player || slots.length === 0) return 0
  const total = slots.reduce((t, s) => t + scoreRung(s.ev, s.rows, player, bodyweightKg), 0)
  return Math.max(0, Math.min(GRADES.length, Math.floor(total / slots.length)))
}
