// ─── Season event records: the best man, woman and junior in each event ──────
// Tāne, 18 Nov 2026. Under the colour board, /leaderboard lists every event
// on the roster, grouped by domain, with the season's best Men's, Women's and
// Juniors score in it.
//
// Settled the same day:
//   • Official games only (results), the same evidence as the colour board.
//     Personal workouts, witnessed or not, are not records here.
//   • This season: the year tab's finished, unvoided games.
//   • RAW best within the division, never the colour. A colour is scaled for
//     age, so on colour the oldest player could top a lift with less on the
//     bar; a record is the number itself. raw_score is the one ranking number
//     (higher is always better, lib/scoring.ts), so the best row is the
//     highest one.
//   • Pure contests (Wrestling, Tennis, the races scored as a win) are left
//     out: a win has no size, and the head-to-head rating is not a score from
//     the game. A Game-rung row on a laddered event is left out for the same
//     reason; that event still shows its best drill.
//   • A tie goes to whoever did it first.
//
// No colour is shown beside a record: a lift's colour needs the lifter's
// bodyweight of the day, which is private.
//
// Imports lib/eventData.ts (the whole roster with its how-to prose), so the
// page loads the section that uses this as its own chunk.

import { EVENTS, DOMAIN_ORDER, DT_CAP, getEventBySlug, getEventByName, type EventData } from './eventData'
import { isGameTier } from './eventKinds'
import { tierScoring } from './scoring'
import { formatPR } from './scoreFormat'
import { divisionPool } from './rating'

export type Pool = 'men' | 'women' | 'juniors'
export const POOLS: readonly Pool[] = ['men', 'women', 'juniors']

export type RecordResultRow = {
  player_id: string | null
  raw_score: number | string | null
  difficulty_tier: string | null
  event_slug: string | null
  event_name: string | null
  /** When the game started, for ties. */
  at: string | null
}

export type EventRecord = {
  playerId: string
  name: string
  /** The score as a player reads it ("120 kg 1RM", "1:42"). */
  score: string
  /** The level, on an event with levels. */
  level: string | null
  raw: number
}

export type EventRecordRow = {
  slug: string
  name: string
  records: Record<Pool, EventRecord | null>
}

export type DomainRecords = {
  domainNumber: number
  domainName: string
  events: EventRecordRow[]
}

/** A pure contest: every score is a win, draw or loss. */
export const isPureContest = (ev: EventData) => ev.inputMode === 'sport'

/**
 * Can this row stand as a record? Mirrors the grading engine's guard on stale
 * ladders (onCurrentLadder in lib/playerGrades.ts): a row whose stored level is
 * not the ladder's level at its band was written for an older ladder and would
 * read as a different level now.
 */
function recordable(ev: EventData, row: RecordResultRow, raw: number): boolean {
  if (isPureContest(ev) || isGameTier(ev, row.difficulty_tier)) return false
  const tiers = ev.difficultyTiers ?? []
  const band = Math.floor(raw / DT_CAP)
  if (!tiers.length) return row.difficulty_tier == null
  if (tierScoring(ev, band) === 'sport') return false
  if (ev.inputMode === 'distance+time' && raw >= tiers.length * DT_CAP) return false
  return row.difficulty_tier == null || tiers[band]?.name === row.difficulty_tier
}

/** "D3 · 0:45" reads as level "Tuck" and score "0:45". */
function scoreParts(ev: EventData, raw: number): { score: string; level: string | null } {
  // formatPR says "1 reps"; a record reads better singular.
  const text = formatPR(raw, ev.inputMode, ev.slug, ev).replace(/(^|\D)1 reps$/, '$11 rep')
  const tiers = ev.difficultyTiers ?? []
  if (!tiers.length) return { score: text, level: null }
  const level = tiers[Math.floor(raw / DT_CAP)]?.name ?? null
  return { score: text.replace(/^D\d+ · /, ''), level }
}

/**
 * Every event on the roster but the pure contests, by domain, with the best
 * row per division. `players` maps an eligible player's id to their name and
 * division; a row from anyone else (a guest, a retired profile) is skipped.
 */
export function eventRecords(
  rows: readonly RecordResultRow[],
  players: ReadonlyMap<string, { name: string; division: string | null }>,
): DomainRecords[] {
  type Held = { rec: EventRecord; at: string }
  const best = new Map<string, Record<Pool, Held | null>>()

  for (const row of rows) {
    if (!row.player_id) continue
    const player = players.get(row.player_id)
    const pool = player ? divisionPool(player.division) : null
    if (!player || !pool) continue
    const raw = Number(row.raw_score)
    if (row.raw_score == null || !Number.isFinite(raw)) continue
    // Slug first: a renamed event keeps its slug. The name is a fallback for
    // rows written before session_events carried a slug.
    const ev = (row.event_slug && getEventBySlug(row.event_slug)) || (row.event_name && getEventByName(row.event_name)) || null
    if (!ev || !recordable(ev, row, raw)) continue

    const cell = best.get(ev.slug) ?? { men: null, women: null, juniors: null }
    const held = cell[pool]
    const at = row.at ?? ''
    if (!held || raw > held.rec.raw || (raw === held.rec.raw && at < held.at)) {
      cell[pool] = { at, rec: { playerId: row.player_id, name: player.name, raw, ...scoreParts(ev, raw) } }
    }
    best.set(ev.slug, cell)
  }

  return DOMAIN_ORDER.map((domainName, i) => ({
    domainNumber: i + 1,
    domainName,
    events: EVENTS.filter(e => e.domainNumber === i + 1 && !isPureContest(e)).map(e => {
      const cell = best.get(e.slug)
      return {
        slug: e.slug,
        name: e.name,
        records: { men: cell?.men?.rec ?? null, women: cell?.women?.rec ?? null, juniors: cell?.juniors?.rec ?? null },
      }
    }),
  }))
}
