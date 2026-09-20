// ─── Personal games ──────────────────────────────────────────────────────────
// A player plans a workout in the same setup screen a kaiwhakawā uses for an
// official game, then plays it on the same live screen. It is stored as a
// WORKOUT carrying a plan (`workouts.planned_events`), never a `sessions` row:
// sessions are ranked, carry the placement and award triggers and appear in the
// public game report, and a personal game is training.
//
// Pure: no React, no Supabase, so the setup screen, the play screen and the
// tests all agree on what a plan is and what one submission stores.

import { EVENTS, getEventBySlug, type EventData } from './eventData'
import { scoreColumns, type EntryVals } from './scoring'
import { estimateFromSets, estimateFromDistance, takesSets, takesDistance } from './naturalFormats'
import { isGameTier, metresIn, unitRule, unitsForVolume } from './units'
import { nzDay } from './workouts'

/** The database CHECK. A plan is a workout, not a programme. */
export const PLAN_MAX = 30

/** Ten domains, one event drawn from each. `pick` is injectable so a test is not random. */
export function drawPlan(pick: (n: number) => number = n => Math.floor(Math.random() * n)): string[] {
  const out: string[] = []
  for (let domain = 1; domain <= 10; domain++) {
    const pool = EVENTS.filter(e => e.domainNumber === domain)
    if (pool.length === 0) continue
    out.push(pool[Math.min(pool.length - 1, Math.max(0, pick(pool.length)))].slug)
  }
  return out
}

/**
 * The plan behind "copy today's official ten". Session events carry NAMES, and
 * a name that no longer matches the roster (a retired or renamed event) is
 * dropped rather than guessed at.
 */
export function planFromEventNames(names: readonly string[]): string[] {
  const bySlug = new Map(EVENTS.map(e => [e.name, e.slug]))
  return names.map(n => bySlug.get(n)).filter((s): s is string => !!s)
}

/** Add or remove a slug, keeping play order and the size cap. */
export function togglePlanned(plan: readonly string[], slug: string): string[] {
  return plan.includes(slug)
    ? plan.filter(s => s !== slug)
    : plan.length >= PLAN_MAX ? [...plan] : [...plan, slug]
}

/** Plan slugs in the roster's own order, so a drawn plan and a hand-built one read the same. */
export function sortPlan(plan: readonly string[]): string[] {
  const order = new Map(EVENTS.map((e, i) => [e.slug, i]))
  return [...plan].sort((a, b) => (order.get(a) ?? 1e9) - (order.get(b) ?? 1e9))
}

/** The events of a plan, dropping any slug the roster no longer has. */
export function planEvents(plan: readonly string[]): EventData[] {
  return plan.map(s => getEventBySlug(s)).filter((e): e is EventData => !!e)
}

// ─── One submission ──────────────────────────────────────────────────────────

/** A workout_entries row, as a personal game writes one. */
export type EntryPayload = {
  activity: string
  event_slug: string
  count: number | null
  volume_distance_m: number | null
  raw_score?: number
  score_label?: string
  difficulty_tier?: string | null
  exercise_variation?: string | null
  weight_kg?: number | null
  reps?: number | null
  time_seconds?: number | null
  distance_m?: number | null
}

/**
 * The VOLUME one completion earns, shaped so `unitsForVolume` returns exactly
 * what `unitsForResult` gives the same score at a game: a distance event stores
 * the rung's metres, everything else stores one completion.
 */
export function volumeFor(ev: EventData, tierName: string | null | undefined): Pick<EntryPayload, 'count' | 'volume_distance_m'> {
  if (unitRule(ev).rule === 'distance' && !isGameTier(ev, tierName)) {
    const m = tierName ? metresIn(tierName) : null
    // A distance ladder with an unreadable rung still earns its completion, the
    // same fallback unitsForResult takes.
    return m ? { count: null, volume_distance_m: m } : { count: 1, volume_distance_m: null }
  }
  return { count: 1, volume_distance_m: null }
}

/**
 * The sets a player typed, as numbers. A half-filled row is dropped rather than
 * counted as a zero-weight set.
 */
function validSets(v: EntryVals) {
  return (v.setRows ?? [])
    .map(r => ({ weightKg: parseFloat(r.weightKg) || 0, reps: parseInt(r.reps) || 0 }))
    .filter(r => r.weightKg > 0 && r.reps > 0)
}

/**
 * One submission in a NATURAL format, where the event takes one: sets of
 * weight × reps on a lift, or a distance and a time on a raced distance event.
 * The columns store what was actually done; `raw_score` carries the estimate it
 * converts to, and the label says so.
 *
 * Volume is the real work: five sets is five completions, and a 5km run is
 * 5000m — so a long run earns the units it deserves, not the units of the rung
 * it converts to.
 *
 * Returns null when the event has no natural format, or nothing usable was
 * typed, so the caller falls through to the official fields.
 */
export function naturalPayload(ev: EventData, v: EntryVals): EntryPayload | null {
  if (takesSets(ev)) {
    const sets = validSets(v)
    if (sets.length === 0) return null
    const est = estimateFromSets(sets)
    if (!est) return null
    return {
      activity: ev.name, event_slug: ev.slug,
      count: sets.length, volume_distance_m: null,
      raw_score: est.raw_score, score_label: est.score_label,
      difficulty_tier: null, exercise_variation: null,
      weight_kg: est.weight_kg ?? null, reps: est.reps ?? null,
      time_seconds: null, distance_m: null,
    }
  }
  if (takesDistance(ev)) {
    const metres = Math.round((parseFloat(v.distanceKm ?? '') || 0) * 1000)
    const secs = (parseFloat(v.timeMins) || 0) * 60 + (parseFloat(v.timeSecs) || 0)
    if (metres <= 0 || secs <= 0) return null
    const est = estimateFromDistance(ev, metres, secs)
    if (!est) return null
    return {
      activity: ev.name, event_slug: ev.slug,
      count: null, volume_distance_m: metres,
      raw_score: est.raw_score, score_label: est.score_label,
      difficulty_tier: est.difficulty_tier ?? null, exercise_variation: null,
      weight_kg: null, reps: null,
      time_seconds: est.time_seconds ?? null, distance_m: metres,
    }
  }
  return null
}

/**
 * One scored submission as a workout entry: a natural format where the event
 * takes one, the official fields otherwise. Returns null when the score is not
 * complete, exactly as the game path does.
 *
 * A GAME rung stores no score: the database refuses a logged Game-rung result
 * (20260916211643), because a game is a match between players and belongs to an
 * official session. It is still recorded as volume, so playing counts as
 * training — and rating it is a later piece of work (the match can hang off the
 * entry once `matches.workout_entry_id` exists).
 */
export function entryPayload(ev: EventData, v: EntryVals): EntryPayload | null {
  const natural = naturalPayload(ev, v)
  if (natural) return natural
  const scored = scoreColumns(ev.inputMode, ev, v)
  if (!scored) return null
  const tier = v.difficultyTier || null
  const base = { activity: ev.name, event_slug: ev.slug, ...volumeFor(ev, tier) }
  if (isGameTier(ev, tier)) return base
  return {
    ...base,
    raw_score: scored.raw_score,
    score_label: scored.score_label,
    difficulty_tier: scored.difficulty_tier ?? null,
    exercise_variation: scored.exercise_variation ?? null,
    weight_kg: scored.weight_kg ?? null,
    reps: scored.reps ?? null,
    time_seconds: scored.time_seconds ?? null,
    distance_m: scored.distance_m ?? null,
  }
}

/**
 * The units one submission earns, read off the payload it stored — NOT off the
 * rung. A natural entry records the real work (five sets, 5000m), and reading
 * the rung instead would pay a 5km run the units of a 1000m.
 */
export function unitsForPayload(ev: EventData, p: EntryPayload): number {
  return unitsForVolume(ev, { count: p.count, distanceM: p.volume_distance_m })
}

// ─── Lifecycle ───────────────────────────────────────────────────────────────

export type PersonalGame = {
  planned_events: string[] | null
  performed_on: string
  finished_at: string | null
}

/** A workout is a personal game when it carries a plan. */
export function isPersonalGame(w: { planned_events?: string[] | null }): boolean {
  return (w.planned_events?.length ?? 0) > 0
}

/**
 * Still being played: not finished, and performed today. There is no timer and
 * nothing sweeps it — the NZ day closes it, so a game left open overnight is
 * simply over in the morning. Entries stay editable for 7 days either way; that
 * window is the database's, not this.
 */
export function isOpen(w: PersonalGame, now: Date = new Date()): boolean {
  return !w.finished_at && w.performed_on === nzDay(now)
}
