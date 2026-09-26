// ─── Workout logging: the pure half ──────────────────────────────────────────
// Fitting what someone typed to an event, the dates a workout may carry, and
// turning logged entries into grading rows. No React, no
// Supabase — the log page, the grades loader and the tests all share it.
// (Same split as lib/activePlayer.ts and lib/useActivePlayer.ts.)

import { EVENTS, getEventBySlug, type EventData } from './eventData'
import { toNZDateString } from './dates'
import { isGameTier } from './eventKinds'
import type { GradeResultRow } from './playerGrades'

/** A workout_entries row as the grades loader reads it, with its workout. */
export type WorkoutEntryRow = {
  event_slug: string | null
  count: number | null
  volume_distance_m: number | null
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
  /** How the entry was written, estimate marker included. Display only. */
  score_label?: string | null
  /** The band of the day. Absent before 20260921232726. See GradeResultRow. */
  bodyweight_band?: string | null
  /**
   * The player's declared bodyweight on the day this was TRAINED
   * (workouts.performed_on), resolved by the caller. See GradeResultRow.
   */
  bodyweightKg?: number | null
  workouts: {
    player_id: string
    performed_on: string
    witnessed: boolean
    created_at: string
    /** The game it was done at (a swap or an extra). Absent before 20260920042215. */
    session_id?: string | null
  } | null
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
 * A logged entry's best effort as a grading row. Every logged workout counts
 * toward the standards (decision 1), marked witnessed or solo for the
 * kaiwhakawā. An entry not fitted to an event grades nothing until it is.
 */
export function workoutEvidence(entries: readonly WorkoutEntryRow[]): { rows: GradeResultRow[] } {
  const rows: GradeResultRow[] = []
  for (const e of entries) {
    if (!e.workouts) continue
    const ev = e.event_slug ? getEventBySlug(e.event_slug) : undefined
    // Postgres numeric accepts 'Infinity' and 'NaN'; either would grade as the
    // top rung (or break a comparison), so a non-finite score is never evidence.
    if (ev && e.raw_score != null && Number.isFinite(Number(e.raw_score))) {
      rows.push({
        event_name: ev.name,
        raw_score: Number(e.raw_score),
        weight_kg: e.weight_kg == null ? null : Number(e.weight_kg),
        difficulty_tier: e.difficulty_tier,
        // An entry made AT a game is `game` evidence: official scores are
        // entered by the players themselves too, in the same room, in front of
        // the same kaiwhakawā. The server only lets it be written while that
        // game is open (20260920042215), which is what makes the label safe.
        source: e.workouts.session_id ? 'game' : e.workouts.witnessed ? 'witnessed' : 'solo',
        bodyweightKg: e.bodyweightKg,
        ...(e.score_label ? { score_label: e.score_label } : {}),
      })
    }
  }
  return { rows }
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
    // Postgres numeric accepts 'Infinity' and 'NaN', and nothing in the
    // database checks a logged score against its ladder. Either would become a
    // permanent PB or break the sort, so they are dropped here.
    const raw = Number(e.raw_score)
    if (!Number.isFinite(raw)) continue
    // A logged workout never records a game: /log hides Game rungs, but a row
    // written straight to the API could carry one and be counted as a win.
    if (isGameTier(ev, e.difficulty_tier)) continue
    out.push({
      id: `logged:${e.id}`,
      score_label: e.score_label,
      raw_score: raw,
      difficulty_tier: e.difficulty_tier,
      session_date: e.workouts.performed_on,
      event_name: ev.name,
      domain_number: ev.domainNumber,
      witnessed: e.workouts.witnessed,
    })
  }
  return out
}

// ─── Training load ───────────────────────────────────────────────────────────
// How long and how hard (20260918023038). Minutes × effort (1 to 10) is session
// training load, Foster's session-RPE: it works for ANY activity, fitted to an
// event or not, which units cannot. Weekly active minutes is also what funders
// report against, so both are worked out here once, for /log and for the
// kaiwhakawā's activity report.

/** The effort scale, 1 to 10 (Foster CR-10), in words a player recognises. */
export const EFFORT_WORDS: readonly string[] = [
  '', 'Very easy', 'Easy', 'Moderate', 'Somewhat hard', 'Hard', 'Harder', 'Very hard', 'Very, very hard', 'Near max', 'Max',
]

/** NZ physical activity guidelines, minutes a week: adults 2.5 hours, under-18s an hour a day. */
export const GUIDELINE_MINUTES = { adult: 150, rangatahi: 420 } as const

/** A game is 100 minutes (the sport's own session length). */
export const GAME_MINUTES = 100

export type LoadWorkout = {
  performed_on: string
  duration_minutes: number | null
  effort_rating: number | null
  /** Per-entry durations, the fallback when the workout's own minutes were not given. */
  entry_seconds?: readonly (number | null)[]
}

/**
 * A workout's minutes: its own figure when given, otherwise the sum of what its
 * entries recorded, otherwise 0. Never both: an entry's time is part of the
 * workout's time, so adding them would count it twice.
 */
export function workoutMinutes(w: LoadWorkout): number {
  if (w.duration_minutes != null && w.duration_minutes > 0) return w.duration_minutes
  const secs = (w.entry_seconds ?? []).reduce<number>((s, x) => s + (x != null && x > 0 ? x : 0), 0)
  return Math.round(secs / 60)
}

/** Session training load (minutes × effort), or null when either is missing. */
export function sessionLoad(w: LoadWorkout): number | null {
  const m = workoutMinutes(w)
  if (!m || w.effort_rating == null) return null
  return m * w.effort_rating
}

export type WeekLoad = { minutes: number; load: number; rated: number; workouts: number }

/** Minutes and load over the last `days` days, today included. Load sums only the rated workouts. */
export function recentLoad(workouts: readonly LoadWorkout[], days: number, now: Date = new Date()): WeekLoad {
  const from = addDays(nzDay(now), -(days - 1))
  const out: WeekLoad = { minutes: 0, load: 0, rated: 0, workouts: 0 }
  for (const w of workouts) {
    if (w.performed_on < from) continue
    out.workouts++
    out.minutes += workoutMinutes(w)
    const l = sessionLoad(w)
    if (l != null) { out.load += l; out.rated++ }
  }
  return out
}

/** The Monday (NZ calendar) that starts a day's week, YYYY-MM-DD. */
export function weekStart(day: string): string {
  const [y, m, d] = day.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = Sunday
  return addDays(day, -((dow + 6) % 7))
}

export type ActivityInput = {
  playerId: string
  rangatahi: boolean
  /** Logged workouts: day and minutes. */
  logged: readonly { day: string; minutes: number }[]
  /** Days this player played a game (one per session). */
  games: readonly string[]
}

export type ActivityRow = {
  week: string
  cohort: 'all' | 'rangatahi' | 'adults'
  players: number
  medianMinutes: number
  meetingGuideline: number
  loggedMinutes: number
  gameMinutes: number
}

/** Cohorts smaller than this are suppressed, as the wellbeing report does. */
export const MIN_COHORT = 3

/**
 * Weekly active minutes by cohort for the kaiwhakawā's report. A player is
 * counted in a week when they logged or played anything that week; their
 * minutes are logged minutes plus GAME_MINUTES per game. Meeting the guideline
 * uses their own cohort's figure, so the 'all' row mixes the two honestly.
 * Weeks are Monday-start, NZ calendar; rows with fewer than MIN_COHORT players
 * are dropped so no individual can be read off the report, and the 'all' row
 * goes with them when a sub-cohort is small, so the two cannot be subtracted.
 */
export function weeklyActivity(inputs: readonly ActivityInput[]): ActivityRow[] {
  type P = { rangatahi: boolean; logged: number; games: number }
  const weeks = new Map<string, Map<string, P>>()
  const at = (week: string, i: ActivityInput) => {
    let w = weeks.get(week)
    if (!w) { w = new Map(); weeks.set(week, w) }
    let p = w.get(i.playerId)
    if (!p) { p = { rangatahi: i.rangatahi, logged: 0, games: 0 }; w.set(i.playerId, p) }
    return p
  }
  for (const i of inputs) {
    for (const l of i.logged) at(weekStart(l.day), i).logged += Math.max(0, l.minutes)
    for (const g of i.games) at(weekStart(g), i).games += GAME_MINUTES
  }
  const median = (xs: number[]) => {
    const s = [...xs].sort((a, b) => a - b)
    const n = s.length
    return n % 2 ? s[(n - 1) / 2] : Math.round((s[n / 2 - 1] + s[n / 2]) / 2)
  }
  const rows: ActivityRow[] = []
  for (const [week, ps] of [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    const all = [...ps.values()]
    const young = all.filter(p => p.rangatahi).length
    // A small sub-cohort is suppressed, and so is the 'all' row beside it:
    // otherwise all minus adults gives the one rangatahi's minutes exactly.
    const small = (n: number) => n > 0 && n < MIN_COHORT
    const differenceable = small(young) || small(all.length - young)
    for (const cohort of ['all', 'rangatahi', 'adults'] as const) {
      const group = cohort === 'all' ? all : all.filter(p => p.rangatahi === (cohort === 'rangatahi'))
      if (group.length < MIN_COHORT || (cohort === 'all' && differenceable)) continue
      const totals = group.map(p => p.logged + p.games)
      rows.push({
        week, cohort,
        players: group.length,
        medianMinutes: median(totals),
        meetingGuideline: group.filter(p => p.logged + p.games >= (p.rangatahi ? GUIDELINE_MINUTES.rangatahi : GUIDELINE_MINUTES.adult)).length,
        loggedMinutes: group.reduce((s, p) => s + p.logged, 0),
        gameMinutes: group.reduce((s, p) => s + p.games, 0),
      })
    }
  }
  return rows
}
