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

import type { EventData } from '@/lib/eventData'
import { DT_CAP } from '@/lib/eventData'

export const TOP_N = 5

export type PRRow = {
  /** Stable across loads, so a row being edited can be left out of its own comparison. */
  id: string
  raw_score: number
  score_label: string
  difficulty_tier: string | null
  /** The NZ day, YYYY-MM-DD. */
  date: string
  /** Where it was set. */
  source: 'game' | 'logged' | 'witnessed'
}

export type LevelRecord = { index: number; name: string; best: PRRow | null }

export type PRBoard =
  | { kind: 'levels'; levels: LevelRecord[] }
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

/** Earlier wins a tie: the first person to set a score owns the record. */
const better = (a: PRRow, b: PRRow): boolean =>
  a.raw_score > b.raw_score || (a.raw_score === b.raw_score && a.date < b.date)

const usable = (rows: readonly PRRow[]): PRRow[] => rows.filter(r => Number.isFinite(r.raw_score))

export function buildPRBoard(ev: EventData | undefined, rows: readonly PRRow[]): PRBoard {
  if (!ev || ev.inputMode === 'sport') return { kind: 'none' }
  const all = usable(rows)
  if (isTiered(ev)) {
    const tiers = ev.difficultyTiers ?? []
    const levels: LevelRecord[] = tiers.map((t, index) => ({ index, name: t.name, best: null }))
    for (const r of all) {
      const i = levelOf(ev, r.raw_score)
      if (i === null) continue
      const cur = levels[i].best
      if (!cur || better(r, cur)) levels[i].best = r
    }
    return { kind: 'levels', levels }
  }
  const top = [...all].sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0)).slice(0, TOP_N)
  return { kind: 'top', top }
}

/**
 * Whether a score just entered is a new PR.
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
  raw: number,
  excludeId?: string | null,
): boolean {
  if (!ev || ev.inputMode === 'sport' || !Number.isFinite(raw)) return false
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
