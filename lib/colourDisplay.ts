// ─── How colours are SHOWN on HOME ───────────────────────────────────────────
// The pure half of the YOUR COLOURS card and the colours radar (home colours
// rework, 24 September 2026; docs/designs/home-colours-rework-spec.md). Pure so
// the choices it makes — which domain is "best", what a score reads as — are
// tested rather than eyeballed in a login-gated page.

import { getEventBySlug } from './eventData'
import { unitFacts } from './units'
import { formatPR } from './scoreFormat'
import { DOMAIN_COUNT } from './grading'
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
 * The one line at the top of YOUR COLOURS that says what a unit is. Its numbers
 * come from unitFacts, the same source How to Play and the guide use.
 */
export function unitLine(): string {
  const { rideKm, throws } = unitFacts()
  return `1 unit = one set, one hold, one game, ${throws} throws or jumps, or ${rideKm}km of distance work, in that domain's events.`
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
