// ─── Replaying history ───────────────────────────────────────────────────────
// Step 6 of docs/designs/auto-conferral-spec.md, decision 9.
//
// Nobody held a conferred colour when auto-conferral switched on. This walks a
// player's history in time order and confers each colour at the moment it
// would have landed, had auto-conferral always existed, so a colour's date is
// the day it was earned rather than the day the switch was thrown.
//
// It was essential while training units counted only AFTER a conferral (a
// naive first run would have discarded everyone's training). Units left
// grading on 26 September 2026, so today it only dates the awards.
//
// Pure. It computes through gradeStateFrom and awardsToConfer — the SAME path
// the live route takes — so the backfill and the app cannot disagree about a
// single colour. The I/O is scripts/replay-colours.ts.
//
// Known approximation, printed by the script: a player's AGE is today's age
// throughout. A junior who has since turned 17 is replayed on today's ladder.
// Ages are not stored historically, and the age shift changes by at most a
// couple of colours at a band boundary.

import { gradeStateFrom, closedAt, type GradeInputs, type GradeAward } from './loadGrades'
import { awardsToConfer, type PendingAward } from './autoConfer'

export type PlannedAward = PendingAward & { conferred_at: string }

/** A colour cannot climb more than twelve rungs, so no single moment can yield more. */
const MAX_PER_MOMENT = 12

/**
 * Every instant at which this player's colours could have changed, oldest
 * first, ending at `now`. Deduplicated as INSTANTS, not strings, because the
 * same moment arrives in two formats (see gradeStateFrom).
 */
export function replayMoments(playerId: string, inputs: GradeInputs, now: string): string[] {
  const nowMs = Date.parse(now)
  const ms = new Set<number>()
  const add = (t: string | null | undefined) => {
    if (!t) return
    const v = Date.parse(t)
    if (Number.isFinite(v) && v <= nowMs) ms.add(v)
  }
  // A game counts once it has CLOSED, so that is when it can change a colour.
  for (const r of inputs.results) add(closedAt(r))
  for (const e of inputs.entries) add(e.workouts?.created_at)
  // Only this player's games move this player's rating directly.
  for (const m of inputs.matches) if (m.players.some(p => p.player_id === playerId)) add(m.created_at)
  for (const x of inputs.exemptions) add(x.created_at)
  ms.add(nowMs)
  return [...ms].sort((a, b) => a - b).map(v => new Date(v).toISOString())
}

/**
 * The awards this player would hold today had auto-conferral always run, each
 * dated when it would have landed.
 *
 * At each moment it keeps asking until nothing more is due, rather than asking
 * once. Today one ask is enough (a domain confers its whole computed colour),
 * but a loop that relied on that would break silently if a gate ever returns.
 */
export function replayAwards(playerId: string, inputs: GradeInputs, now: string): PlannedAward[] {
  const planned: PlannedAward[] = []
  for (const t of replayMoments(playerId, inputs, now)) {
    for (let i = 0; i < MAX_PER_MOMENT; i++) {
      const awards: GradeAward[] = planned.map(a => ({
        domain_number: a.domain_number, rung: a.rung, grade_name: a.grade_name, conferred_at: a.conferred_at,
      }))
      const due = awardsToConfer(playerId, gradeStateFrom(playerId, inputs, { asOf: t, awards }))
      if (due.length === 0) break
      planned.push(...due.map(a => ({ ...a, conferred_at: t })))
    }
  }
  return planned
}
