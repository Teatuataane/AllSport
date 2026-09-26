// ─── What to confer ──────────────────────────────────────────────────────────
// The decision half of auto-conferral, kept pure so it can be tested without a
// database: given a grade state the engine has already computed, which colours
// should be written?
//
// The route does the I/O. This decides. Splitting them is what lets the rule
// "confer the colour the best-six average gives, when it beats the colour
// held" be asserted directly rather than inferred from what landed in a table.
//
// Since 26 September 2026 a domain confers whatever colour its standards give
// (the average of its best six events), with no games or training check and no
// one-at-a-time rule. The games count caps the OVERALL colour only, which is
// derived and never stored.

import { releasable, eventsBehind } from './playerGrades'
import { gradeForRung } from './grading'
import type { GradeAward, GradeState } from './loadGrades'

export type PendingAward = {
  player_id: string
  domain_number: number
  rung: number
  grade_name: string
  events: string[]
  /** Null is the point: nobody conferred it. See the migration. */
  conferred_by: null
}

/**
 * The awards to write for a player right now. Empty when nothing is due, which
 * is the normal answer.
 *
 * At most ONE row per domain: the colour the standards now give. A jump from
 * Whero to Kahurangi writes Kahurangi alone, since what a player holds is the
 * highest award in the domain (heldRungs).
 */
export function awardsToConfer(playerId: string, state: GradeState): PendingAward[] {
  // Before the grading migration, nothing has been conferred and nothing can
  // be: `held` is empty, so every domain would look like it owed Kiwikiwi.
  // Writing those would be conferring against a schema that cannot record it.
  if (!state.schemaReady) return []

  return releasable(state.gates).map(g => ({
    player_id: playerId,
    domain_number: g.domainNumber,
    rung: g.releasable,
    grade_name: gradeForRung(g.releasable).name,
    events: eventsBehind(state.grades, g.domainNumber),
    conferred_by: null,
  }))
}

// ─── What to take back ───────────────────────────────────────────────────────
// Spec decision 5: evidence can drop a colour; RULES cannot.
//
// The route never calls this on an ordinary recheck. It runs ONLY when a
// kaiwhakawā has just deleted a logged entry from the audit panel, and only in
// that entry's domain. That scoping is the whole of "rules cannot drop it": a
// revised standards sheet is picked up by rechecks that can only ever confer,
// so no one is demoted by a threshold they had no part in. What removes a
// colour is a person removing the evidence it stood on.
//
// Known edge, accepted and written down: if the sheet HAS been tightened since
// a colour was conferred, a deletion in that domain re-judges its awards against
// today's standards, so it can take back more than the deleted row alone would
// have. It is kaiwhakawā-initiated, scoped to one domain, and logged.


export type WithdrawnAward = Required<Pick<GradeAward, 'id'>> & GradeAward

/**
 * Awards in `domainNumber` the player's current evidence no longer supports:
 * everything above the rung the standards now give them there.
 *
 * Returns nothing when the domain cannot be graded for this player at all
 * (every event exempt or ungradeable). That is "we cannot tell", not "the
 * evidence is gone", and the safe answer to "we cannot tell" is to leave a
 * colour alone.
 */
export function awardsToWithdraw(state: GradeState, domainNumber: number): WithdrawnAward[] {
  if (!state.schemaReady) return []
  const d = state.grades.domains.find(x => x.domainNumber === domainNumber)
  if (!d || d.availableCount === 0) return []
  return state.awards
    .filter((a): a is WithdrawnAward => a.domain_number === domainNumber && a.rung > d.rung && !!a.id)
    .sort((a, b) => b.rung - a.rung)
}

/**
 * The colour to confer straight after a withdrawal, or null.
 *
 * A jump writes ONE row, the new top (Whero held, then Kahurangi conferred,
 * with nothing in between). So withdrawing Kahurangi after the domain re-judges
 * to Kākāriki would drop the player to Whero, below what their remaining
 * evidence supports, and nothing would put Kākāriki back until the next forced
 * recheck. This returns the colour the remaining evidence gives when it is
 * above the highest award left standing.
 */
export function awardAfterWithdraw(
  playerId: string,
  state: GradeState,
  domainNumber: number,
  withdrawnIds: ReadonlySet<string>,
): PendingAward | null {
  if (!state.schemaReady) return null
  const d = state.grades.domains.find(x => x.domainNumber === domainNumber)
  if (!d || d.availableCount === 0 || d.rung <= 0) return null
  const left = state.awards
    .filter(a => a.domain_number === domainNumber && !(a.id && withdrawnIds.has(a.id)))
    .reduce((m, a) => Math.max(m, a.rung), 0)
  if (d.rung <= left) return null
  return {
    player_id: playerId,
    domain_number: domainNumber,
    rung: d.rung,
    grade_name: gradeForRung(d.rung).name,
    events: eventsBehind(state.grades, domainNumber),
    conferred_by: null,
  }
}
