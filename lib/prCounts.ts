// ─── Personal records, counted ───────────────────────────────────────────────
// Scoring v2 step 2 (decision 9, Tāne 15 Oct 2026): "N PRs today" on the game
// report and a season count on HOME, which also feeds the honours list. Display
// only: a PR never changes a colour or a place.
//
// Worked out from the scores themselves, in the order they were set, with the
// same rule the scoring screen uses to tag a PR (isNewPR in lib/prBoard.ts).
// Not from results.is_pr: that flag was written by the client at entry time,
// against the ladders of the day, and was FROZEN when lifts moved to estimated
// 1RM (20260928201510), so it no longer agrees with the records the player sees.
//
// One sitting is one unit: a game, or one logged workout. An event counts at
// most once per sitting, and only when the sitting's best beats every EARLIER
// sitting. So three attempts at a game are one PR, not three, and a first-ever
// attempt is never a PR (there is nothing to beat).
//
// Pure: no React, no Supabase.

import { getEventByName, getEventBySlug } from './eventData'
import { isGameTier } from './eventKinds'
import { isNewPR, type PRRow } from './prBoard'
import { voidedSessions } from './playerGrades'
import { toNZDateString } from './dates'
import { yearOfDay } from './seasonYear'
import type { GradeInputs } from './loadGrades'

/** One PR: an event beaten in one sitting. */
export type PRMoment = {
  eventName: string
  /** The NZ day it was set, YYYY-MM-DD. */
  day: string
  /** The game it was set at (an official event or one added there), else null. */
  sessionId: string | null
}

type Sitting = {
  key: string
  day: string
  /** Orders sittings on the same day. */
  at: string
  sessionId: string | null
  rows: Map<string, PRRow[]>
}

/** Every PR the player has set, oldest first. Voided games are left out. */
export function prMoments(inputs: Pick<GradeInputs, 'results' | 'entries' | 'voids'>): PRMoment[] {
  const sittings = new Map<string, Sitting>()
  const add = (key: string, base: Omit<Sitting, 'key' | 'rows'>, eventName: string, row: PRRow) => {
    const s = sittings.get(key) ?? { key, ...base, rows: new Map() }
    const list = s.rows.get(eventName) ?? []
    list.push(row)
    s.rows.set(eventName, list)
    sittings.set(key, s)
  }

  const sessions = [...new Map(inputs.results.filter(r => r.sessions).map(r => [r.session_id, {
    id: r.session_id, is_active: r.sessions!.is_active, points_awarded_at: r.sessions!.points_awarded_at,
  }])).values()]
  const voided = voidedSessions(inputs.voids, sessions, inputs.results)

  inputs.results.forEach((r, i) => {
    const name = r.session_events?.event_name
    const ev = name ? getEventByName(name) : undefined
    if (!ev || voided.has(r.session_id) || r.raw_score == null || isGameTier(ev, r.difficulty_tier)) return
    const at = r.sessions?.started_at ?? r.created_at
    const day = r.sessions?.session_date ?? toNZDateString(new Date(at))
    add(`g:${r.session_id}`, { day, at, sessionId: r.session_id }, ev.name, {
      id: `r:${i}`, raw_score: Number(r.raw_score), score_label: r.score_label ?? '',
      difficulty_tier: r.difficulty_tier, date: day, source: 'game',
      distance_m: r.distance_m, time_seconds: r.time_seconds, weight_kg: r.weight_kg,
    })
  })

  inputs.entries.forEach((e, i) => {
    const w = e.workouts
    const ev = e.event_slug ? getEventBySlug(e.event_slug) : undefined
    if (!w || !ev || isGameTier(ev, e.difficulty_tier)) return
    // A distance effort under the reference has no raw_score but is still a
    // record at its own distance (lib/prBoard.ts).
    if (e.raw_score == null && !(Number(e.distance_m) > 0)) return
    if (w.session_id && voided.has(w.session_id)) return
    // A workout has no id here; who logged it and when identifies it.
    add(`w:${w.performed_on}|${w.created_at}`, { day: w.performed_on, at: w.created_at, sessionId: w.session_id ?? null }, ev.name, {
      id: `e:${i}`, raw_score: e.raw_score == null ? null : Number(e.raw_score), score_label: e.score_label ?? '',
      difficulty_tier: e.difficulty_tier, date: w.performed_on, source: w.witnessed ? 'witnessed' : 'logged',
      distance_m: e.distance_m, time_seconds: e.time_seconds, weight_kg: e.weight_kg,
    })
  })

  const ordered = [...sittings.values()].sort((a, b) =>
    a.day.localeCompare(b.day) || Date.parse(a.at) - Date.parse(b.at) || a.key.localeCompare(b.key))

  const before = new Map<string, PRRow[]>()
  const out: PRMoment[] = []
  for (const s of ordered) {
    for (const [eventName, rows] of s.rows) {
      const prior = before.get(eventName) ?? []
      const ev = getEventByName(eventName)
      if (rows.some(r => isNewPR(ev, prior, r))) out.push({ eventName, day: s.day, sessionId: s.sessionId })
    }
    // Only after the whole sitting, so a second attempt never beats the first.
    for (const [eventName, rows] of s.rows) before.set(eventName, [...(before.get(eventName) ?? []), ...rows])
  }
  return out
}

/** Events PR'd at one game, by event name. */
export function prsAtGame(moments: readonly PRMoment[], sessionId: string): Set<string> {
  return new Set(moments.filter(m => m.sessionId === sessionId).map(m => m.eventName))
}

/** PRs set in each NZ year. */
export function prsByYear(moments: readonly PRMoment[]): Map<number, number> {
  const out = new Map<number, number>()
  for (const m of moments) {
    const y = yearOfDay(m.day)
    if (y != null) out.set(y, (out.get(y) ?? 0) + 1)
  }
  return out
}
