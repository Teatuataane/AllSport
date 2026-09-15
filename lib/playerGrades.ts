// ─── A player's grades ───────────────────────────────────────────────────────
// Joins the pieces for one player: the compiled standards (lib/standards.ts),
// the rules (lib/grading.ts) and the head-to-head rating (lib/headToHead.ts).
//
// Pure — no React, no Supabase — so the player's own view and the kaiwhakawā's
// release panel compute the same answer from the same rows, and so it is unit
// tested against the real roster and the real standards.

import { EVENTS, getEventByName, type EventData } from './eventData'
import { STANDARDS } from './standards'
import {
  ageBand, rungForScore, ratioThresholdsKg, strengthBodyweight, ratingRung, gameEventRung,
  domainGrade, overallGrade, DRILL_CAP, DOMAIN_COUNT,
  type AgeBand, type DomainGradeResult, type OverallGradeResult,
} from './grading'
import type { SportRating } from './headToHead'

export type GradePlayer = {
  division: string | null
  ageYears: number | null
  /** The registration answer. Only read for juniors, who share one division. */
  gender: string | null
  /** One of BODYWEIGHT_BANDS' labels, or null when the player has not picked one. */
  bodyweightBand: string | null
}

export type GradeResultRow = {
  event_name: string
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
}

export type EventGrade = {
  slug: string
  /** 0 = below Kiwikiwi, or never played. */
  rung: number
  /** False when this player cannot be graded in it — a lift with no band. */
  gradeable: boolean
  played: boolean
}

export type PlayerGrades = {
  band: AgeBand
  ladder: 'M' | 'F'
  events: Map<string, EventGrade>
  domains: DomainGradeResult[]
  overall: OverallGradeResult
}

/**
 * Which of an event's two ladders applies. Adults take it from their division.
 * Juniors all play in one division, so their registration answer decides.
 *
 * OPEN, for Tāne: a junior who answered "Other" has neither, and is graded on
 * the men's ladder until that is decided.
 */
export function ladderFor(p: Pick<GradePlayer, 'division' | 'gender'>): 'M' | 'F' {
  const d = p.division ?? ''
  if (/Women/.test(d)) return 'F'
  if (/Men/.test(d)) return 'M'
  return /^f/i.test(p.gender ?? '') ? 'F' : 'M'
}

/** Is this row a Game-rung result (a win, draw or loss) rather than a drill? */
function isGameRow(ev: EventData, row: GradeResultRow): boolean {
  if (ev.inputMode === 'sport') return true
  return !!row.difficulty_tier &&
    (ev.difficultyTiers ?? []).some(t => t.name === row.difficulty_tier && t.scoring === 'sport')
}

/** The colour one player's rows earn in one event. */
export function eventGrade(
  ev: EventData,
  rows: readonly GradeResultRow[],
  p: GradePlayer,
  rating?: SportRating,
): EventGrade {
  const s = STANDARDS[ev.slug]
  const band = ageBand(p.division, p.ageYears)
  const rated = rating ? ratingRung(rating.rating, rating.games) : 0
  const drillRows = rows.filter(r => r.raw_score != null && !isGameRow(ev, r))
  const played = rows.length > 0 || !!rating

  if (!s) return { slug: ev.slug, rung: 0, gradeable: false, played }
  // Wrestling: no fair solo drill, so its only colours are rating colours.
  if (s.kind === 'rating') return { slug: ev.slug, rung: rated, gradeable: true, played }

  const ladder = s.all ?? s[ladderFor(p)] ?? []
  let drill = 0
  if (s.kind === 'ratio') {
    const bw = strengthBodyweight(band, p.bodyweightBand)
    if (bw == null) return { slug: ev.slug, rung: 0, gradeable: false, played }
    const best = Math.max(0, ...drillRows.map(r => r.weight_kg ?? 0))
    // The empty bar is Kiwikiwi, and it means a lift that happened: never a 0.
    if (best > 0) drill = rungForScore(best, ratioThresholdsKg(ladder.map(r => r || null), bw), band)
  } else if (drillRows.length) {
    const best = Math.max(...drillRows.map(r => r.raw_score!))
    drill = rungForScore(best, ladder, band, s.game ? { cap: DRILL_CAP } : {})
  }

  return { slug: ev.slug, rung: s.game ? gameEventRung(drill, rated) : drill, gradeable: true, played }
}

/**
 * Every colour a player holds by the standards: per event, per domain, overall.
 *
 * `results` must be the player's own rows from sessions that count — see
 * voidedSessionIds. `ratings` is the player's rating per sport (event name).
 * `exemptions` are coach-confirmed event slugs, removed from both sides of the
 * half-the-domain rule.
 */
export function computePlayerGrades(input: {
  player: GradePlayer
  results: readonly GradeResultRow[]
  ratings: ReadonlyMap<string, SportRating>
  exemptions: ReadonlySet<string>
}): PlayerGrades {
  const byEvent = new Map<string, GradeResultRow[]>()
  for (const r of input.results) {
    // Resolved by name, like /prs: a retired event's rows match nothing and are skipped.
    const ev = getEventByName(r.event_name)
    if (!ev) continue
    const list = byEvent.get(ev.slug) ?? []
    list.push(r)
    byEvent.set(ev.slug, list)
  }

  const events = new Map<string, EventGrade>()
  for (const ev of EVENTS) {
    events.set(ev.slug, eventGrade(ev, byEvent.get(ev.slug) ?? [], input.player, input.ratings.get(ev.name)))
  }

  const domains: DomainGradeResult[] = []
  for (let d = 1; d <= DOMAIN_COUNT; d++) {
    const inDomain = EVENTS.filter(e => e.domainNumber === d)
    // An event leaves the denominator when this player cannot be graded in it
    // (a lift with no band), or when it is rating-only and the player holds no
    // rating colour there yet: without that, a player who never wrestles would
    // carry a zero in Body Awareness that no drill could ever lift.
    const ungradeable = new Set(inDomain.filter(e => {
      const g = events.get(e.slug)!
      return !g.gradeable || (STANDARDS[e.slug]?.kind === 'rating' && g.rung === 0)
    }).map(e => e.slug))
    domains.push(domainGrade({
      domainNumber: d,
      eventSlugs: inDomain.map(e => e.slug),
      ungradeable,
      unavailable: input.exemptions,
      rungByEvent: new Map(inDomain.map(e => [e.slug, events.get(e.slug)!.rung])),
    }))
  }

  return {
    band: ageBand(input.player.division, input.player.ageYears),
    ladder: ladderFor(input.player),
    events,
    domains,
    overall: overallGrade(domains),
  }
}

/**
 * Sessions whose results must not grade anyone: VOIDED ones. A void closes the
 * session and stamps points_awarded_at together, and the award trigger then
 * writes nothing, so a voided session is closed, stamped, and has no row
 * carrying points. The same discriminator the placement replays use.
 */
export function voidedSessionIds(
  sessions: readonly { id: string; is_active: boolean; points_awarded_at: string | null }[],
  pointRows: readonly { session_id: string; points_earned: number | null }[],
): Set<string> {
  const paid = new Set(pointRows.filter(r => r.points_earned != null).map(r => r.session_id))
  return new Set(sessions.filter(s => !s.is_active && s.points_awarded_at != null && !paid.has(s.id)).map(s => s.id))
}

/** The highest colour already conferred in each domain. */
export function heldRungs(awards: readonly { domain_number: number; rung: number }[]): Map<number, number> {
  const held = new Map<number, number>()
  for (const a of awards) held.set(a.domain_number, Math.max(held.get(a.domain_number) ?? 0, a.rung))
  return held
}

/**
 * Domains where the standards now give a higher colour than the kaiwhakawā has
 * conferred — what the release panel offers. A colour once conferred is never
 * taken back, so a computed colour BELOW the held one is simply not shown.
 */
export function releasable(domains: readonly DomainGradeResult[], held: ReadonlyMap<number, number>): DomainGradeResult[] {
  return domains.filter(d => d.rung > (held.get(d.domainNumber) ?? 0))
}

/** The colour to show for a domain: conferred colours never drop. */
export function shownRung(computed: number, held: number | undefined): number {
  return Math.max(computed, held ?? 0)
}
