// ─── What kind of event this is ──────────────────────────────────────────────
// Small structural questions about an event, answered from its ladder. They
// survived the training units, which were removed from the app on 27 September
// 2026 (lib/units.ts and its compiled sheet are gone): the natural input
// formats and the grading engine still need to know which rung is a game and
// which events are raced over distance.
//
// Pure: no React, no Supabase.

import { isTimedEffort, type EventData } from './eventData'

/** Metres in a rung name: "250m", "1000m", "5kg — 200m", "1.5km". Null when there are none. */
export function metresIn(name: string): number | null {
  const m = [...name.matchAll(/(\d+(?:\.\d+)?)\s*(km|m)\b/gi)].pop()
  return m ? Number(m[1]) * (m[2].toLowerCase() === 'km' ? 1000 : 1) : null
}

/** Is this rung a Game rung (a win, draw or loss) rather than a drill? */
export function isGameTier(ev: EventData, tierName: string | null | undefined): boolean {
  if (ev.inputMode === 'sport') return true
  return !!tierName && (ev.difficultyTiers ?? []).some(t => t.name === tierName && t.scoring === 'sport')
}

/**
 * A timed effort raced over a ladder of DISTANCES (Running, Cycling, Row Erg):
 * every drill rung names a distance, and they are not all the same one. A ladder
 * of loads over one distance (Sandbag Carry) is not one: its rungs differ by
 * weight, so a distance entered on it would mean nothing.
 *
 * This is the rule the retired units sheet used for its 'distance' events, and
 * on 27 September 2026 it picked out exactly the same seven.
 */
export function isDistanceEvent(ev: EventData): boolean {
  if (ev.inputMode !== 'difficulty+time' || !isTimedEffort(ev.slug)) return false
  const drills = (ev.difficultyTiers ?? []).filter(t => t.scoring !== 'sport').map(t => metresIn(t.name))
  if (drills.length === 0 || drills.some(d => d == null)) return false
  return !drills.every(d => d === drills[0])
}
