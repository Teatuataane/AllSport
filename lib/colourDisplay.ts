// ─── How colours are SHOWN on HOME ───────────────────────────────────────────
// The pure half of the YOUR COLOURS card and the colours radar (home colours
// rework, 24 September 2026; docs/designs/home-colours-rework-spec.md). Pure so
// the choices it makes — which domain is "best", what a score reads as — are
// tested rather than eyeballed in a login-gated page.

import { getEventBySlug } from './eventData'
import { formatPR } from './scoreFormat'
import { DOMAIN_COUNT, gradeForRung, type DomainGradeResult } from './grading'
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
 * Best and weakest domain by the colour HELD, with Top % (lower = stronger)
 * breaking a tie behind the scenes. Null when no domain holds a colour, so the
 * page says how to start rather than naming a "best" Mā.
 */
export function domainExtremesByColour(
  held: ReadonlyMap<number, number>,
  topPct: ReadonlyMap<number, number | null>,
): { best: { domainNumber: number; rung: number }; weakest: { domainNumber: number; rung: number } } | null {
  const rows = Array.from({ length: DOMAIN_COUNT }, (_, i) => ({
    domainNumber: i + 1,
    rung: held.get(i + 1) ?? 0,
    pct: topPct.get(i + 1) ?? null,
  }))
  if (!rows.some(r => r.rung > 0)) return null
  // Unrated counts as the weakest standing within a colour.
  const pct = (r: { pct: number | null }) => r.pct ?? 101
  const sorted = [...rows].sort((a, b) => b.rung - a.rung || pct(a) - pct(b) || a.domainNumber - b.domainNumber)
  return { best: sorted[0], weakest: sorted[sorted.length - 1] }
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
 * the computed ones before. One rule for the YOUR COLOURS list and the radar,
 * so the two can never disagree.
 */
export function shownDomainRungs(state: Pick<GradeState, 'grades' | 'held' | 'schemaReady'>): Map<number, number> {
  return new Map(state.grades.domains.map(d => [
    d.domainNumber,
    state.schemaReady ? (state.held.get(d.domainNumber) ?? 0) : d.rung,
  ]))
}

/**
 * What an overall colour MEANS: a punchy line and, from Whero up, how it
 * compares with the general population. Lines settled with Tāne 2026-09-27.
 *
 * The stat is read off `populationTarget`, never typed, so a re-calibrated
 * ladder cannot leave the line saying something the standards no longer do.
 * It is exact for a domain colour and approximate for the overall (an average
 * of ten); Tāne accepted that rather than hedging every line with "about".
 */
const COLOUR_LINES = [
  'Everyone starts here',
  'On the ladder',
  'Past the beginner stage',
  'Finding your feet',
  'Building a real base',
  'Nearly average across the board',
  'Better than average',
  'Above average everywhere',
  'Genuinely athletic',
  'Seriously well rounded',
  'Elite all-rounder',
  'Rare air',
  'One in a hundred',
] as const

export function colourBlurb(rung: number): { line: string; stat: string | null } {
  const g = gradeForRung(rung)
  const line = COLOUR_LINES[g.rung]
  const t = g.populationTarget
  if (t == null) return { line, stat: null }
  if (t <= 10) return { line, stat: `Top ${t}%` }
  if (t === 50) return { line, stat: 'Better than half of people' }
  const beaten = (100 - t) / 10
  if (!Number.isInteger(beaten)) return { line, stat: `Better than ${100 - t}% of people` }
  return { line, stat: `Better than ${beaten} in 10 people` }
}

/**
 * The colours of the events a domain's colour averages: best first, padded
 * with Mā up to the domain's slots. Read from `counted`, which the engine
 * built, so the squares on a row are exactly what its colour is the average of.
 */
export function topSlotRungs(
  d: Pick<DomainGradeResult, 'slots' | 'counted'>,
  events: ReadonlyMap<string, Pick<EventGrade, 'rung'>>,
): number[] {
  const rungs = d.counted.map(slug => events.get(slug)?.rung ?? 0)
  while (rungs.length < d.slots) rungs.push(0)
  return rungs.slice(0, d.slots)
}
