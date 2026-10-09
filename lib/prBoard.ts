// ─── A player's records on one event ─────────────────────────────────────────
// A tiered event keeps one best PER LEVEL: beating your D2 best is a PR even if
// you have already done D4. An event without levels keeps the top five scores
// (for a lift that is estimated 1RM, for a hold the longest, for a throw the
// furthest). Both are DERIVED from the scores on every read, never stored: a
// stored PR goes wrong the moment a score is edited or deleted, which is the
// same reason colours and ratings are computed.
//
// `raw_score` is the one number, because a higher raw_score is always better
// (lib/eventData.ts encodes every mode that way). A level is the band of the
// raw_score, NOT a match on the tier's name, so a renamed rung cannot orphan a
// record (the Pause Chin Up lesson in CLAUDE.md).
//
// A distance event (8 Oct 2026, Tāne) keeps one best PER DISTANCE instead:
// 250m, 500m, 1km, 2km, 5km and longer for the runs, rides and ergs; 25m, 50m,
// 100m, 200m, 500m and longer for the crawls, carries and the swim
// (`recordDistances` in lib/eventData.ts). These are read off the distance and
// time actually done, not raw_score, because raw_score only knows the one
// reference distance colours rank on. So a training effort under the
// reference (raw_score null) still sets a record at its own distance.

import type { EventData } from '@/lib/eventData'
import { DT_CAP, RIEGEL_EXPONENT, decodeDistanceEffort } from '@/lib/eventData'
import { decodeCarry, fmtDistance, fmtTime } from '@/lib/scoring'

export const TOP_N = 5

export type PRRow = {
  /** Stable across loads, so a row being edited can be left out of its own comparison. */
  id: string
  /** Null only for a training distance effort under the reference distance. */
  raw_score: number | null
  score_label: string
  difficulty_tier: string | null
  /** The NZ day, YYYY-MM-DD. */
  date: string
  /** Where it was set. */
  source: 'game' | 'logged' | 'witnessed'
  /** What was actually done, on a distance event. Older loads leave them out. */
  distance_m?: number | null
  time_seconds?: number | null
  weight_kg?: number | null
}

export type LevelRecord = { index: number; name: string; best: PRRow | null }

export type DistanceRecord = {
  /** The crawl level on a laddered distance event, else null. */
  level: number | null
  levelName: string | null
  /** The distance; for the open record, the top distance it is longer than. */
  metres: number
  /** The "and longer" record. */
  open: boolean
  best: PRRow | null
  /** How the best reads at this distance ("1:40 · est. from 700m 2:20"). */
  label: string | null
}

export type PRBoard =
  | { kind: 'levels'; levels: LevelRecord[] }
  | { kind: 'distances'; records: DistanceRecord[] }
  | { kind: 'top'; top: PRRow[] }
  /** A win/draw/loss event has no scale to hold a record on. */
  | { kind: 'none' }

const isTiered = (ev: EventData): boolean => !!ev.hasDifficultyTiers && (ev.difficultyTiers?.length ?? 0) > 0

/** The level a score sits on, or null when it is off the ladder (a legacy row). */
export function levelOf(ev: EventData, raw: number): number | null {
  if (!isTiered(ev) || !Number.isFinite(raw)) return null
  const band = Math.floor(raw / DT_CAP)
  return band >= 0 && band < (ev.difficultyTiers?.length ?? 0) ? band : null
}

type ScoredRow = PRRow & { raw_score: number }

/** Earlier wins a tie: the first person to set a score owns the record. */
const better = (a: ScoredRow, b: ScoredRow): boolean =>
  a.raw_score > b.raw_score || (a.raw_score === b.raw_score && a.date < b.date)

const usable = (rows: readonly PRRow[]): ScoredRow[] =>
  rows.filter((r): r is ScoredRow => r.raw_score !== null && Number.isFinite(r.raw_score))

// ─── Records per distance ────────────────────────────────────────────────────

const hasDistanceRecords = (ev: EventData): boolean =>
  (ev.inputMode === 'distance+time' || ev.inputMode === 'weight+distance+time') && (ev.recordDistances?.length ?? 0) > 0

type Effort = { metres: number; secs: number; kg: number; level: number | null }

/** What a row did, or null when it cannot be read (no distance or time, or no level on a ladder). */
function effortOf(ev: EventData, r: Pick<PRRow, 'raw_score' | 'distance_m' | 'time_seconds' | 'weight_kg' | 'difficulty_tier'>): Effort | null {
  const raw = r.raw_score !== null && Number.isFinite(r.raw_score) ? r.raw_score : null
  let metres = Number(r.distance_m)
  let secs = Number(r.time_seconds)
  let kg = Number(r.weight_kg)
  const carry = ev.inputMode === 'weight+distance+time'
  // A row loaded without its source columns still holds them in raw_score: a
  // carry packs all three, and a distance effort ranks on its reference time.
  if (!(metres > 0) || !(secs > 0) || (carry && !(kg > 0))) {
    if (raw === null) return null
    if (carry) ({ weightKg: kg, metres, secs } = decodeCarry(raw))
    else if (ev.referenceMetres) {
      // An estimate did not cover the reference, and without its source
      // columns what it did cover is unknown: no record.
      const d = decodeDistanceEffort(raw)
      if (d.estimated) return null
      metres = ev.referenceMetres; secs = d.secs
    }
  }
  if (!(metres > 0) || !(secs > 0) || (carry && !(kg > 0))) return null
  let level: number | null = null
  if (isTiered(ev)) {
    level = raw !== null
      ? levelOf(ev, raw)
      : (ev.difficultyTiers ?? []).findIndex(t => t.name === r.difficulty_tier)
    if (level === null || level < 0) return null
  }
  return { metres, secs, kg: carry ? kg : 0, level }
}

type Slot = { metres: number; open: boolean }

/**
 * The records an effort competes for: the longest record distance it covered
 * (a 700m row is a 500m record, on the time it predicts for 500m) and, past the
 * top distance, the open record as well. Under the shortest, none.
 */
function slotsFor(ev: EventData, metres: number): Slot[] {
  const ds = ev.recordDistances ?? []
  const m = Math.round(metres)
  const out: Slot[] = []
  const below = ds.filter(d => d <= m)
  if (below.length) out.push({ metres: below[below.length - 1], open: false })
  if (ds.length && m > ds[ds.length - 1]) out.push({ metres: ds[ds.length - 1], open: true })
  return out
}

/** Riegel down to the record distance; exact when the effort was that distance. */
const predictedAt = (e: Effort, d: number): number =>
  Math.round(e.metres) === d ? e.secs : e.secs * Math.pow(d / e.metres, RIEGEL_EXPONENT)

/**
 * The effort's standing at a record, as keys compared most significant first,
 * higher better. A carry is heavier first (8 Oct 2026, Tāne), then faster; the
 * open record is the longest, then faster.
 */
function valueAt(e: Effort, slot: Slot, carry: boolean): number[] {
  const head = carry ? [e.kg] : []
  return slot.open ? [...head, e.metres, -e.secs] : [...head, -Math.round(predictedAt(e, slot.metres))]
}

const cmp = (a: number[], b: number[]): number => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function labelAt(e: Effort, slot: Slot, carry: boolean): string {
  const load = carry ? `${e.kg}kg · ` : ''
  const done = `${fmtDistance(e.metres)} ${fmtTime(e.secs)}`
  if (slot.open || Math.round(e.metres) === slot.metres) return `${load}${fmtDistance(e.metres)} · ${fmtTime(e.secs)}`
  return `${load}${fmtTime(predictedAt(e, slot.metres))} · est. from ${done}`
}

const slotKey = (level: number | null, s: Slot) => `${level ?? ''}|${s.open ? '+' : s.metres}`

function buildDistanceBoard(ev: EventData, rows: readonly PRRow[]): PRBoard {
  const carry = ev.inputMode === 'weight+distance+time'
  const ds = ev.recordDistances ?? []
  const levels: (number | null)[] = isTiered(ev) ? (ev.difficultyTiers ?? []).map((_, i) => i) : [null]
  const records: DistanceRecord[] = []
  const byKey = new Map<string, { rec: DistanceRecord; value: number[] | null }>()
  for (const level of levels) {
    const slots: Slot[] = [...ds.map(d => ({ metres: d, open: false })), { metres: ds[ds.length - 1], open: true }]
    for (const s of slots) {
      const rec: DistanceRecord = {
        level, levelName: level === null ? null : ev.difficultyTiers![level].name,
        metres: s.metres, open: s.open, best: null, label: null,
      }
      records.push(rec)
      byKey.set(slotKey(level, s), { rec, value: null })
    }
  }
  for (const r of rows) {
    const e = effortOf(ev, r)
    if (!e) continue
    for (const s of slotsFor(ev, e.metres)) {
      const cur = byKey.get(slotKey(e.level, s))
      if (!cur) continue
      const v = valueAt(e, s, carry)
      const c = cur.value === null ? 1 : cmp(v, cur.value)
      if (c > 0 || (c === 0 && cur.rec.best && r.date < cur.rec.best.date)) {
        cur.value = v
        cur.rec.best = r
        cur.rec.label = labelAt(e, s, carry)
      }
    }
  }
  return { kind: 'distances', records }
}

/** "500m", or "5km+" for the open record. */
export function distanceRecordName(rec: Pick<DistanceRecord, 'metres' | 'open'>): string {
  return `${fmtDistance(rec.metres)}${rec.open ? '+' : ''}`
}

export function buildPRBoard(ev: EventData | undefined, rows: readonly PRRow[]): PRBoard {
  if (!ev || ev.inputMode === 'sport') return { kind: 'none' }
  if (hasDistanceRecords(ev)) return buildDistanceBoard(ev, rows)
  const all = usable(rows)
  if (isTiered(ev)) {
    const tiers = ev.difficultyTiers ?? []
    const levels: LevelRecord[] = tiers.map((t, index) => ({ index, name: t.name, best: null }))
    const bestAt: (ScoredRow | null)[] = tiers.map(() => null)
    for (const r of all) {
      const i = levelOf(ev, r.raw_score)
      if (i === null) continue
      const cur = bestAt[i]
      if (!cur || better(r, cur)) { bestAt[i] = r; levels[i].best = r }
    }
    return { kind: 'levels', levels }
  }
  const top = [...all].sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0)).slice(0, TOP_N)
  return { kind: 'top', top }
}

/** A score just entered: its raw_score, or the whole row on a distance event. */
export type PRCandidate = Pick<PRRow, 'raw_score' | 'difficulty_tier'> & Partial<Pick<PRRow, 'distance_m' | 'time_seconds' | 'weight_kg'>>

/**
 * Whether a score just entered is a new PR.
 *   · a distance event: a new best at any distance it counts for, including a
 *     distance not done before, as long as the event has been played;
 *   · tiered: a new best AT ITS LEVEL, including the first score at a level you
 *     have not tried, as long as you have played the event before;
 *   · untiered: a new number one only. Entering the top five without beating the
 *     best updates the list quietly, or early on nearly every score would be
 *     "a PR" and the tag would stop meaning anything.
 * A player's very first score on an event is not a PR (nothing to beat), the
 * rule a game has always used. `excludeId` leaves out the row being edited.
 */
export function isNewPR(
  ev: EventData | undefined,
  rows: readonly PRRow[],
  entry: number | PRCandidate,
  excludeId?: string | null,
): boolean {
  if (!ev || ev.inputMode === 'sport') return false
  const cand: PRCandidate = typeof entry === 'number' ? { raw_score: entry, difficulty_tier: null } : entry
  if (hasDistanceRecords(ev)) {
    const e = effortOf(ev, cand)
    if (!e) return false
    const prior = rows.filter(r => r.id !== excludeId)
      .map(r => effortOf(ev, r)).filter((p): p is Effort => p !== null)
    if (prior.length === 0) return false
    const carry = ev.inputMode === 'weight+distance+time'
    return slotsFor(ev, e.metres).some(s => {
      const at = prior.filter(p => p.level === e.level && slotsFor(ev, p.metres).some(ps => slotKey(p.level, ps) === slotKey(e.level, s)))
      if (at.length === 0) return true
      const v = valueAt(e, s, carry)
      return at.every(p => cmp(v, valueAt(p, s, carry)) > 0)
    })
  }
  const raw = cand.raw_score
  if (raw === null || !Number.isFinite(raw)) return false
  const prior = usable(rows).filter(r => r.id !== excludeId)
  if (prior.length === 0) return false
  if (isTiered(ev)) {
    const lvl = levelOf(ev, raw)
    if (lvl === null) return false
    const atLevel = prior.filter(r => levelOf(ev, r.raw_score) === lvl)
    return atLevel.length === 0 || raw > Math.max(...atLevel.map(r => r.raw_score))
  }
  return raw > Math.max(...prior.map(r => r.raw_score))
}

/** Loaded rows plus rows saved since the load, one per id (the live copy wins). */
export function mergeRows(loaded: readonly PRRow[], live: readonly PRRow[]): PRRow[] {
  const byId = new Map<string, PRRow>()
  for (const r of loaded) byId.set(r.id, r)
  for (const r of live) byId.set(r.id, r)
  return [...byId.values()]
}
