// ─── A player's grades ───────────────────────────────────────────────────────
// Joins the pieces for one player: the compiled standards (lib/standards.ts),
// the rules (lib/grading.ts) and the head-to-head rating (lib/headToHead.ts).
//
// Pure — no React, no Supabase — so the player's own view and the kaiwhakawā's
// release panel compute the same answer from the same rows, and so it is unit
// tested against the real roster and the real standards.

import { EVENTS, getEventByName, type EventData } from './eventData'
import { STANDARDS } from './standards'
import { isGameTier, unitsForResultRow } from './units'
import { toNZDateString } from './dates'
import {
  ageBand, rungForScore, ratioThresholdsKg, ratingRung, gameEventRung,
  domainGrade, overallGrade, colourGate, DRILL_CAP, DOMAIN_COUNT,
  type AgeBand, type DomainGradeResult, type OverallGradeResult, type ColourGate,
} from './grading'
import type { SportRating } from './headToHead'

export type GradePlayer = {
  division: string | null
  ageYears: number | null
  /** The registration answer. Only read for juniors, who share one division. */
  gender: string | null
}

/**
 * Where a result came from. A game result was played in an official session; a
 * logged workout is WITNESSED when a kaiwhakawā logged it for the player, and
 * SOLO otherwise. Every source counts toward the standards (workout logging,
 * decision 1); the release panel shows which, so the kaiwhakawā can moderate.
 */
export type EvidenceSource = 'game' | 'witnessed' | 'solo'

export type GradeResultRow = {
  event_name: string
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
  source?: EvidenceSource
  /**
   * The player's bodyweight in kilograms ON THE DAY this row was scored: their
   * most recent declaration at or before the row's own day, resolved in
   * lib/loadGrades.ts. Null or undefined means they had declared nothing by
   * then, so a ratio event this row belongs to cannot be graded.
   *
   * Per-row rather than per-player because a declaration is dated and pinned
   * server-side: grading an old lift against today's number would let one
   * entry re-price a whole domain, which is what the band on /profile allowed.
   */
  bodyweightKg?: number | null
  /**
   * The score as it was written at the time ("100kg × 5 · est. 1RM 112.5kg").
   * Display only: HOME prefers it over re-formatting raw_score, because for a
   * natural-format entry raw_score is a CONVERSION and must read as one.
   */
  score_label?: string | null
}

export type EventGrade = {
  slug: string
  /** 0 = below Kiwikiwi, or never played. */
  rung: number
  /**
   * False when this event leaves the domain's denominator entirely: it has no
   * standard, or it is rating-only and the player holds no rating colour yet.
   *
   * A strength event with no declared bodyweight is NOT one of these. It stays
   * gradeable, scores 0, and sets `bodyweightBlocked` instead.
   */
  gradeable: boolean
  /**
   * A ratio standard the player has declared no bodyweight for. Counts as
   * unmet, stays in the denominator, and tells the domain why it has no colour.
   */
  bodyweightBlocked?: boolean
  played: boolean
  /** Where the result behind `rung` came from. Absent when nothing earns a colour, or the rows carry no source. */
  source?: EvidenceSource
  /**
   * The drill score shown beside the colour on HOME: the row that earned
   * `rung`, or the best row when none earns anything. Display only — nothing
   * grades on it.
   */
  best?: Pick<GradeResultRow, 'raw_score' | 'weight_kg' | 'difficulty_tier' | 'score_label'>
  /** The head-to-head rating, when the player has one in this sport. */
  rating?: SportRating
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
 * A junior who answered "Other" has neither, and takes the boys' standards
 * (Tāne, 16 September 2026).
 */
export function ladderFor(p: Pick<GradePlayer, 'division' | 'gender'>): 'M' | 'F' {
  const d = p.division ?? ''
  if (/Women/.test(d)) return 'F'
  if (/Men/.test(d)) return 'M'
  return /^f/i.test(p.gender ?? '') ? 'F' : 'M'
}

/** Is this row a Game-rung result (a win, draw or loss) rather than a drill? */
const isGameRow = (ev: EventData, row: GradeResultRow) => isGameTier(ev, row.difficulty_tier)

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

  const pick = (r: GradeResultRow | undefined) =>
    r ? { best: { raw_score: r.raw_score, weight_kg: r.weight_kg, difficulty_tier: r.difficulty_tier, ...(r.score_label ? { score_label: r.score_label } : {}) } } : {}
  const topRow = maxBy(drillRows, r => r.raw_score!)
  const withRating = rating ? { rating } : {}
  if (!s) return { slug: ev.slug, rung: 0, gradeable: false, played, ...pick(topRow), ...withRating }
  // Wrestling: no fair solo drill, so its only colours are rating colours,
  // and a rating only comes from matches recorded in official sessions.
  if (s.kind === 'rating') return { slug: ev.slug, rung: rated, gradeable: true, played, ...withRating, ...(rated ? { source: 'game' as const } : {}) }

  const ladder = s.all ?? s[ladderFor(p)] ?? []
  let drill = 0
  let bestRow: GradeResultRow | undefined
  if (s.kind === 'ratio') {
    // Each lift is graded against ITS OWN bodyweight, so the heaviest lift is
    // no longer necessarily the best one: 95kg at 70kg bodyweight beats 100kg
    // at 100kg. Rank by the rung each row reaches, earliest winning a tie,
    // which is what maxBy did before.
    const ratios = ladder.map(r => r || null)
    let anyBw = false
    for (const r of drillRows) {
      const bw = r.bodyweightKg
      if (bw == null || !(bw > 0)) continue
      anyBw = true
      const kg = r.weight_kg ?? 0
      // The empty bar is Kiwikiwi, and it means a lift that happened: never a 0.
      if (kg <= 0) continue
      const rung = rungForScore(kg, ratioThresholdsKg(ratios, bw), band)
      if (rung > drill) { drill = rung; bestRow = r }
    }
    // They lifted, and NOTHING they lifted carries a bodyweight. The event
    // counts as UNMET and stays in the domain's denominator — it does not leave
    // it. Dropping it is what made skipping the question the winning move: 12
    // of Maximal Strength's 14 events are ratio standards, so an undeclared
    // player had the domain judged on 2 events needing 1, against a declared
    // player's 6 of 14.
    //
    // Only when they have actually lifted. An event nobody has played is not
    // blocked by anything, it is unplayed, and saying otherwise would tell a
    // brand new player their strength domain is waiting on a number when it is
    // waiting on them turning up.
    if (!anyBw && drillRows.length > 0) {
      return { slug: ev.slug, rung: 0, gradeable: true, bodyweightBlocked: true, played, ...pick(topRow) }
    }
  } else if (drillRows.length) {
    bestRow = maxBy(drillRows, r => r.raw_score!)
    drill = rungForScore(bestRow!.raw_score!, ladder, band, s.game ? { cap: DRILL_CAP } : {})
  }

  const rung = s.game ? gameEventRung(drill, rated) : drill
  // The rating comes from recorded matches, which only official sessions hold.
  const source = rung === 0 ? undefined : s.game && rated >= rung && rated > Math.min(drill, DRILL_CAP) ? 'game' : bestRow?.source
  // A lift's best is the row that reached the highest rung, not the heaviest,
  // since each is graded against its own bodyweight. With no rung, the best
  // raw_score, the same order /prs sorts on: the heaviest LOAD is not the best
  // estimated 1RM once natural formats convert sets (100kg × 1 vs 90kg × 8).
  const shown = bestRow ?? topRow
  return { slug: ev.slug, rung, gradeable: true, played, ...pick(shown), ...withRating, ...(source ? { source } : {}) }
}

/** The row with the highest key; the earliest on a tie. */
function maxBy<T>(rows: readonly T[], key: (r: T) => number): T | undefined {
  let best: T | undefined
  for (const r of rows) if (best === undefined || key(r) > key(best)) best = r
  return best
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
    // Kept OUT of `ungradeable` on purpose: these stay in the denominator.
    const bodyweightBlocked = new Set(
      inDomain.filter(e => events.get(e.slug)!.bodyweightBlocked).map(e => e.slug),
    )
    domains.push(domainGrade({
      domainNumber: d,
      eventSlugs: inDomain.map(e => e.slug),
      ungradeable,
      bodyweightBlocked,
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
 * Sessions whose results must not grade anyone: VOIDED ones.
 *
 * LEGACY RULE, kept only as the fallback in `voidedSessions` below. A void
 * closes the session and stamps points_awarded_at together, and the award
 * trigger then writes nothing, so a voided session is closed, stamped, and has
 * no row carrying points. Once points stopped being written (September 2026)
 * EVERY finished game fits that description, so this rule is only correct
 * against a database from before `sessions.voided_at` existed.
 */
export function voidedSessionIds(
  sessions: readonly { id: string; is_active: boolean; points_awarded_at: string | null }[],
  pointRows: readonly { session_id: string; points_earned: number | null }[],
): Set<string> {
  const paid = new Set(pointRows.filter(r => r.points_earned != null).map(r => r.session_id))
  return new Set(sessions.filter(s => !s.is_active && s.points_awarded_at != null && !paid.has(s.id)).map(s => s.id))
}

/**
 * The voided sessions, from the explicit record when the database has one.
 *
 * `recorded` is every session with `voided_at` set, or null when that column
 * does not exist yet (the query fails with 42703). Null falls back to the
 * legacy inference, which is still right for a database that writes points.
 * Never mix the two: after the migration a finished game carries no points, and
 * the legacy rule would call it voided.
 */
export function voidedSessions(
  recorded: ReadonlySet<string> | null,
  sessions: readonly { id: string; is_active: boolean; points_awarded_at: string | null }[],
  pointRows: readonly { session_id: string; points_earned: number | null }[],
): Set<string> {
  return recorded ? new Set(recorded) : voidedSessionIds(sessions, pointRows)
}

/** The highest colour already conferred in each domain. */
export function heldRungs(awards: readonly { domain_number: number; rung: number }[]): Map<number, number> {
  const held = new Map<number, number>()
  for (const a of awards) held.set(a.domain_number, Math.max(held.get(a.domain_number) ?? 0, a.rung))
  return held
}

/**
 * Domains whose next colour passes all three gates — standards, games and
 * training — which is what auto-conferral writes (lib/autoConfer.ts), and what
 * the release panel offers as its fallback. ONE colour per domain at
 * a time: the training count restarts at each conferral, so the colour above
 * needs its own units first.
 */
export function releasable(gates: readonly ColourGate[]): ColourGate[] {
  return gates.filter(g => g.releasable > 0)
}

// ─── The games and training gates ────────────────────────────────────────────

/** One thing that earned effort units: a game result, or a logged workout entry. */
export type UnitEvent = {
  domain: number
  units: number
  /** When it counted: the session's start for a game result, the log time for a workout. */
  at: string
  /** For a workout, the NZ day it was trained (YYYY-MM-DD). */
  day?: string
}

const nzDay = (iso: string) => toNZDateString(new Date(iso))

/** A player's own result row from an official session, as the grades loader reads it. */
export type GameResultRow = {
  session_id: string
  event_name: string
  raw_score: number | null
  weight_kg: number | null
  difficulty_tier: string | null
  /** As written at the time. Display only. */
  score_label?: string | null
  /** When it counts for the training gate: the session's start. */
  at: string
  /** The player's declared bodyweight on this game's day. See GradeResultRow. */
  bodyweightKg?: number | null
  /** The session has finished. A game still in progress is not yet a game. */
  closed: boolean
}

/**
 * What a player's game results give the grades: rows for the standards, and
 * the games and units for the two gates. The gates count only CLOSED
 * sessions: a colour released on a game still in progress could rest on a
 * session a kaiwhakawā later voids. Voided sessions are already filtered out
 * by the caller (voidedSessionIds).
 */
export function gameEvidence(rows: readonly GameResultRow[]): { rows: GradeResultRow[]; units: UnitEvent[]; games: number } {
  const out: GradeResultRow[] = []
  const units: UnitEvent[] = []
  const games = new Set<string>()
  for (const r of rows) {
    out.push({
      event_name: r.event_name, raw_score: r.raw_score, weight_kg: r.weight_kg,
      difficulty_tier: r.difficulty_tier, source: 'game', bodyweightKg: r.bodyweightKg,
      ...(r.score_label ? { score_label: r.score_label } : {}),
    })
    if (!r.closed) continue
    games.add(r.session_id)
    const u = unitsForResultRow({ event_name: r.event_name, difficulty_tier: r.difficulty_tier })
    if (u) units.push({ domain: u.domain, units: u.units, at: r.at })
  }
  return { rows: out, units, games: games.size }
}

/**
 * Units per domain since the last colour conferred there — the training gate's
 * count. A colour's units start again from its conferral: something counts
 * only if it happened after it. A workout must also be TRAINED on or after the
 * conferral day, so a week of logs saved up and entered after a conferral
 * cannot rush the next colour through (decision 17).
 */
export function unitsSinceConferral(
  events: readonly UnitEvent[],
  awards: readonly { domain_number: number; conferred_at: string }[],
): Map<number, number> {
  const last = new Map<number, string>()
  for (const a of awards) {
    const cur = last.get(a.domain_number)
    if (!cur || a.conferred_at > cur) last.set(a.domain_number, a.conferred_at)
  }
  const out = new Map<number, number>()
  for (const e of events) {
    const since = last.get(e.domain)
    if (since) {
      if (new Date(e.at).getTime() <= new Date(since).getTime()) continue
      if (e.day && e.day < nzDay(since)) continue
    }
    out.set(e.domain, (out.get(e.domain) ?? 0) + e.units)
  }
  return out
}

/** The three gates on every domain's next colour. */
export function colourGates(
  domains: readonly DomainGradeResult[],
  held: ReadonlyMap<number, number>,
  games: number,
  unitsByDomain: ReadonlyMap<number, number>,
): ColourGate[] {
  return domains.map(d => colourGate({
    domainNumber: d.domainNumber,
    standardsRung: d.rung,
    held: held.get(d.domainNumber) ?? 0,
    games,
    unitsSinceHeld: unitsByDomain.get(d.domainNumber) ?? 0,
  }))
}

/**
 * The event slugs standing behind a colour in a domain: everything already at
 * that rung or above. Stored on the award as its evidence, and shown by the
 * release panel as what the colour rests on.
 *
 * Shared because BOTH writers must record the same thing — a kaiwhakawā
 * releasing by hand and the server conferring automatically — and an award
 * whose evidence disagreed with the panel would be impossible to audit.
 */
export function eventsBehind(grades: PlayerGrades, domainNumber: number, rung: number): string[] {
  return EVENTS
    .filter(e => e.domainNumber === domainNumber && (grades.events.get(e.slug)?.rung ?? 0) >= rung)
    .map(e => e.slug)
}

/** What is holding a domain's next colour back, in a few words. Null when it is ready, or at the top. */
export function gateBlocker(g: ColourGate): string | null {
  if (g.next == null || g.releasable) return null
  const parts: string[] = []
  if (!g.standardsMet) parts.push('the standards')
  if (!g.gamesMet) { const n = g.gamesNeeded - g.games; parts.push(`${n} more game${n === 1 ? '' : 's'}`) }
  if (!g.trainingMet) { const n = Math.ceil(g.unitsNeeded - g.units); parts.push(`${n} more unit${n === 1 ? '' : 's'}`) }
  return parts.join(' · ')
}

/** The colour to show for a domain: conferred colours never drop. */
export function shownRung(computed: number, held: number | undefined): number {
  return Math.max(computed, held ?? 0)
}
