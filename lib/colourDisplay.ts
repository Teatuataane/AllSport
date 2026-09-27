// ─── How colours are SHOWN on HOME ───────────────────────────────────────────
// The pure half of the YOUR COLOURS card on HOME (home colours rework, 24
// September 2026; redesigned 28 September 2026). Pure so the choices it makes,
// what a score reads as and what a colour says about you, are tested rather
// than eyeballed in a login-gated page.

import { getEventBySlug } from './eventData'
import { formatPR } from './scoreFormat'
import { gradeForRung, overallRung, TOP_RUNG, type DomainGradeResult } from './grading'
import type { GradeState } from './loadGrades'
import type { EventGrade } from './playerGrades'

/**
 * The score beside an event's colour. The tier NAME replaces the bare "D3"
 * that formatPR writes, because HOME is read by players, not kaiwhakawā.
 * A rating-only sport shows its rating. Null when there is nothing to show.
 */
export function bestScoreLabel(eg: Pick<EventGrade, 'slug' | 'best' | 'rating'>): string | null {
  const ev = getEventBySlug(eg.slug)
  if (!ev) return null
  // The label written at the time wins: for a natural-format entry raw_score
  // is a conversion, and only the stored label says "est." (v0.13.0.0).
  if (eg.best?.score_label) return eg.best.score_label
  if (eg.best?.raw_score != null) {
    const label = formatPR(eg.best.raw_score, ev.inputMode, ev.slug, ev)
    const tier = eg.best.difficulty_tier
    return tier && /^D\d+ · /.test(label) ? label.replace(/^D\d+/, tier) : label
  }
  if (eg.rating) return `Rating ${Math.round(eg.rating.rating)} · ${eg.rating.games} game${eg.rating.games === 1 ? '' : 's'}`
  return null
}

/**
 * The event holding the highest colour, Top % breaking a tie. Null when no
 * event has reached Kiwikiwi.
 */
export function bestEventByColour(
  events: ReadonlyMap<string, Pick<EventGrade, 'slug' | 'rung'>>,
  topPctByName: ReadonlyMap<string, number | null> = new Map(),
): { slug: string; rung: number } | null {
  let best: { slug: string; rung: number; pct: number } | null = null
  for (const eg of events.values()) {
    if (eg.rung <= 0) continue
    const name = getEventBySlug(eg.slug)?.name ?? ''
    const pct = topPctByName.get(name) ?? 101
    if (!best || eg.rung > best.rung || (eg.rung === best.rung && pct < best.pct)) best = { slug: eg.slug, rung: eg.rung, pct }
  }
  return best && { slug: best.slug, rung: best.rung }
}

/**
 * The colour SHOWN for each domain: conferred colours once grading is live,
 * the computed ones before. One rule for the YOUR COLOURS list and the avatar ring,
 * so the two can never disagree.
 */
export function shownDomainRungs(state: Pick<GradeState, 'grades' | 'held' | 'schemaReady'>): Map<number, number> {
  return new Map(state.grades.domains.map(d => [
    d.domainNumber,
    state.schemaReady ? (state.held.get(d.domainNumber) ?? 0) : d.rung,
  ]))
}

/**
 * The overall colour SHOWN on HOME: the average of the shown domain colours,
 * capped by games. The colours card and the avatar ring both read it, so the
 * two can never disagree.
 */
export function shownOverallRung(state: Pick<GradeState, 'grades' | 'held' | 'schemaReady' | 'games'>): number {
  return overallRung([...shownDomainRungs(state).values()], state.games)
}

/**
 * What an overall colour MEANS: a proud headline, then a second line.
 * Headlines settled with Tāne 2026-09-28.
 *
 * Below Kahurangi the second line counts the climb, because "better than 1 in
 * 10 people" reads as a small number rather than a win. From Kahurangi up the
 * population stat is worth saying. It is read off `populationTarget`, never
 * typed, so a re-calibrated ladder cannot leave it saying something the
 * standards no longer do. It is approximate for the overall (an average of
 * ten); Tāne accepted that rather than hedging every line with "about".
 */
const COLOUR_HEADLINES = [
  'Everyone starts here. Your climb begins with your first game.',
  "You're on the ladder.",
  "Whero earned. You've made your start.",
  'Karaka earned. The habit is forming.',
  'Kōwhai earned. The work is showing.',
  'Kākāriki earned. Strong all round.',
  'Kahurangi. Better than most at most things.',
  'Poroporo. Few people get this far.',
  'Parahi. A genuine all-round athlete.',
  'Hiriwa. Elite across the board.',
  'Kōura. The gold standard.',
  'Uenuku. The full spectrum.',
  'Taniwha. The top of AllSport.',
] as const

/** The first colour whose second line is the population stat, not the climb. */
export const STAT_FROM_RUNG = 6

export function colourBlurb(rung: number): { line: string; sub: string } {
  const g = gradeForRung(rung)
  const line = COLOUR_HEADLINES[g.rung]
  if (g.rung === 0) return { line, sub: `${TOP_RUNG} colours to climb` }
  const t = g.populationTarget
  if (g.rung < STAT_FROM_RUNG || t == null) {
    return { line, sub: `${g.rung} ${g.rung === 1 ? 'colour' : 'colours'} climbed` }
  }
  if (t <= 10) return { line, sub: `Top ${t}%` }
  if (t === 50) return { line, sub: 'Better than half of people' }
  const beaten = (100 - t) / 10
  if (!Number.isInteger(beaten)) return { line, sub: `Better than ${100 - t}% of people` }
  return { line, sub: `Better than ${beaten} in 10 people` }
}

/**
 * The colours of the events a domain's colour averages: best first, padded
 * with Mā up to the domain's slots. Read from `counted`, which the engine
 * built, so the circles on a row are exactly what its colour is the average of.
 */
export function topSlotRungs(
  d: Pick<DomainGradeResult, 'slots' | 'counted'>,
  events: ReadonlyMap<string, Pick<EventGrade, 'rung'>>,
): number[] {
  const rungs = d.counted.map(slug => events.get(slug)?.rung ?? 0)
  while (rungs.length < d.slots) rungs.push(0)
  return rungs.slice(0, d.slots)
}
