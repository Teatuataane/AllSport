// ─── Workout logging: the pure half ──────────────────────────────────────────
// Fitting what someone typed to an event, the dates a workout may carry, and
// turning logged entries into grading rows and effort units. No React, no
// Supabase — the log page, the grades loader and the tests all share it.
// (Same split as lib/activePlayer.ts and lib/useActivePlayer.ts.)

import { EVENTS, getEventBySlug, type EventData } from './eventData'
import { toNZDateString } from './dates'
import { unitsForEntryRow } from './units'
import type { GradeResultRow, UnitEvent } from './playerGrades'

/** A workout_entries row as the grades loader reads it, with its workout. */
export type WorkoutEntryRow = {
  event_slug: string | null
  count: number | null
  volume_distance_m: number | null
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
  workouts: { player_id: string; performed_on: string; witnessed: boolean; created_at: string } | null
}

/** Lower case, trimmed, single spaces: the SAME rule as the database's public.normalise_activity(). */
export function normaliseActivity(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/**
 * The event an activity fits, by alias or by the event's own name. Exact
 * matches only: a guess that fits a jog to the 100m sprint would put a score
 * on the wrong ladder, and an unfitted entry costs nothing but a moment.
 */
export function fitActivity(text: string, aliases: ReadonlyMap<string, string>): EventData | null {
  const t = normaliseActivity(text)
  if (!t) return null
  const viaAlias = aliases.get(t)
  if (viaAlias) return getEventBySlug(viaAlias) ?? null
  return EVENTS.find(e => normaliseActivity(e.name) === t) ?? null
}

/** Events to offer while typing: names and aliases containing the text, best first. */
export function suggestEvents(text: string, aliases: ReadonlyMap<string, string>, limit = 6): EventData[] {
  const t = normaliseActivity(text)
  if (t.length < 2) return []
  const score = new Map<string, number>()
  const bump = (slug: string, s: number) => score.set(slug, Math.max(score.get(slug) ?? 0, s))
  for (const e of EVENTS) {
    const n = normaliseActivity(e.name)
    if (n === t) bump(e.slug, 3)
    else if (n.startsWith(t)) bump(e.slug, 2)
    else if (n.includes(t)) bump(e.slug, 1)
  }
  for (const [alias, slug] of aliases) {
    if (alias === t) bump(slug, 3)
    else if (alias.startsWith(t)) bump(slug, 2)
    else if (alias.includes(t)) bump(slug, 1)
  }
  return [...score.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([slug]) => getEventBySlug(slug))
    .filter((e): e is EventData => !!e)
}

// ─── Dates ───────────────────────────────────────────────────────────────────

/** How far back a workout may be dated (decision 17). The database enforces it too. */
export const BACKDATE_DAYS = 7

/** The NZ calendar day of an instant, YYYY-MM-DD. */
export function nzDay(at: Date | string = new Date()): string {
  return toNZDateString(new Date(at))
}

/** The window the log page's week view covers, today included. */
export const RECENT_DAYS = 7

/** A YYYY-MM-DD day moved by whole days. Calendar arithmetic, no time zones. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + n))
  return t.toISOString().slice(0, 10)
}

/** The days a workout logged now may carry, today first. */
export function allowedDays(now: Date = new Date()): string[] {
  const today = nzDay(now)
  return Array.from({ length: BACKDATE_DAYS + 1 }, (_, i) => addDays(today, -i))
}

// ─── Entries into grading ────────────────────────────────────────────────────

/**
 * A logged entry's best effort as a grading row, and its volume as units.
 * Every logged workout counts toward the standards (decision 1), marked
 * witnessed or solo for the kaiwhakawā. Units need an event, so an entry that
 * is not fitted yet earns nothing until it is.
 */
export function workoutEvidence(entries: readonly WorkoutEntryRow[]): { rows: GradeResultRow[]; units: UnitEvent[] } {
  const rows: GradeResultRow[] = []
  const units: UnitEvent[] = []
  for (const e of entries) {
    if (!e.workouts) continue
    const ev = e.event_slug ? getEventBySlug(e.event_slug) : undefined
    if (ev && e.raw_score != null) {
      rows.push({
        event_name: ev.name,
        raw_score: Number(e.raw_score),
        weight_kg: e.weight_kg == null ? null : Number(e.weight_kg),
        difficulty_tier: e.difficulty_tier,
        source: e.workouts.witnessed ? 'witnessed' : 'solo',
      })
    }
    const u = unitsForEntryRow({
      event_slug: e.event_slug,
      count: e.count,
      volume_distance_m: e.volume_distance_m == null ? null : Number(e.volume_distance_m),
    })
    if (u && u.units > 0) units.push({ domain: u.domain, units: u.units, at: e.workouts.created_at, day: e.workouts.performed_on })
  }
  return { rows, units }
}

/** Units per domain trained in the last `days` days, today included. For the log page's week view. */
export function recentUnitsByDomain(units: readonly UnitEvent[], days: number, now: Date = new Date()): Map<number, number> {
  const from = addDays(nzDay(now), -(days - 1))
  const out = new Map<number, number>()
  for (const u of units) {
    if ((u.day ?? nzDay(u.at)) < from) continue
    out.set(u.domain, (out.get(u.domain) ?? 0) + u.units)
  }
  return out
}

// ─── Logged bests on My Events ───────────────────────────────────────────────

/** A workout_entries row as /prs reads it, with the day it was trained. */
export type LoggedBestEntry = {
  id: string
  event_slug: string | null
  raw_score: number | null
  score_label: string | null
  difficulty_tier: string | null
  workouts: { performed_on: string; witnessed: boolean } | null
}

/** A logged best effort shaped like a game result, so /prs can rank the two together. */
export type LoggedBestRow = {
  id: string
  score_label: string
  raw_score: number
  difficulty_tier: string | null
  /** The NZ day it was trained: /prs files it under that year. */
  session_date: string
  event_name: string
  domain_number: number
  witnessed: boolean
}

/**
 * The logged entries that are a best effort on a CURRENT event (decision 16:
 * solo bests show in your own PRs, marked, and never in public rankings).
 * Volume-only entries, unfitted entries and retired events are dropped. Their
 * raw_score is on the same scale as a game result (lib/scoring.ts
 * scoreColumns), so the page can sort both in one list.
 */
export function loggedBestRows(entries: readonly LoggedBestEntry[]): LoggedBestRow[] {
  const out: LoggedBestRow[] = []
  for (const e of entries) {
    if (!e.workouts || e.raw_score == null || !e.score_label || !e.event_slug) continue
    const ev = getEventBySlug(e.event_slug)
    if (!ev) continue
    out.push({
      id: `logged:${e.id}`,
      score_label: e.score_label,
      raw_score: Number(e.raw_score),
      difficulty_tier: e.difficulty_tier,
      session_date: e.workouts.performed_on,
      event_name: ev.name,
      domain_number: ev.domainNumber,
      witnessed: e.workouts.witnessed,
    })
  }
  return out
}
