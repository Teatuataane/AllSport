// ─── Taniwha alerts ──────────────────────────────────────────────────────────
// Tells the kaiwhakawā that a crown is landing WHILE the player is still in the
// room. Replaces lib/colourAlerts.ts's colour predicates; the ranking helpers
// there (divisionRanks, projectedPlacementPoints) are generic and reused.
//
// WHY IT HAS TO BE PREDICTIVE
// Points are only written when a session closes, and event placements are only
// written by the same trigger, so an alert built on stored data fires after
// everyone has packed up. The coach has to be told during the game.
//
// WHY CROWNS AND NOT PARTS
// A part lands every 1,000 points — roughly every seven sessions per player,
// 110 of them over a career. "You earned a left leg" is not an announcement.
// The crown is the moment, there are only eleven, and it is the thing the
// player cannot get by turning up. Parts show on the player's own card.
//
// THE TWO STATES, AND WHY THE STRICT ONE IS SAFE
// A crown needs BOTH crown room (points) and its act, so both halves have to
// hold at the worst case before anything is said out loud:
//
//   room   lifetime + guaranteedSessionPoints(effort) >= (crownsHeld + 1) × 10,000
//          The guaranteed floor uses the minimum placement award and banked
//          effort only — no placement ranking at all — so no other player's
//          result can take it back.
//
//   act    BANKED wins only, from player_event_wins, which the close trigger
//          writes. A win happening RIGHT NOW is not banked: another player can
//          still beat that score before the session ends. So a 9th win landing
//          today can only ever make the softer "on track" state.
//
// `on-track` may retract. Never announce it as a result.

import { divisionRanks, projectedPlacementPoints, type AlertResultRow } from './colourAlerts'
import {
  WIN_TARGET,
  crownPoints,
  guaranteedSessionPoints,
  taniwhaBySlug,
  type Taniwha,
} from './taniwha'

export type { AlertResultRow }

/** One player's progression, as the live session sees it. */
export type TaniwhaProgress = {
  /** Rows from player_taniwha. */
  taniwha: {
    taniwha_slug: string
    domain_number: number | null
    body_parts: number
    is_building: boolean
    crowned_at: string | null
  }[]
  lifetimePoints: number
  /** Distinct BANKED wins per domain number, from player_event_wins. */
  bankedWinsByDomain: Record<number, number>
  /**
   * Event NAMES already banked. Needed so a repeat win today is not counted a
   * second time on top of the banked one — the target is DISTINCT events.
   */
  bankedEventNames?: Set<string>
  /** Qualified referrals, for the whānau crown. */
  qualifiedReferrals: number
}

export type TaniwhaAlert = {
  playerId: string
  playerName: string
  taniwha: Taniwha
  state: 'earned' | 'on-track'
  /** Which crown this would be: 1st, 2nd… Drives the points threshold. */
  crownOrdinal: number
  lifetimePoints: number
  guaranteed: number
  projected: number
  /** Points still needed on the guaranteed floor. 0 once the room is certain. */
  pointsShortfall: number
  /** Distinct wins still needed. 0 once the act is done. */
  winsShortfall: number
}

export type TaniwhaAlertInput = {
  results: AlertResultRow[]
  eventIds: string[]
  /** Registered players only — a guest has no progression to add to. */
  playerIds: string[]
  nameOf: (playerId: string) => string
  divisionOf: (playerId: string) => string | null | undefined
  effortLevelOf: (playerId: string) => number
  progressOf: (playerId: string) => TaniwhaProgress | undefined
  /**
   * Distinct wins the player looks like taking TODAY, per domain, from the live
   * standings. Provisional by definition, so it only ever feeds `on-track`.
   */
  provisionalWinsOf?: (playerId: string) => Record<number, number>
}

/**
 * Everyone in this session whose next crown has landed, or is about to.
 * Earned first, then on-track, each ordered by who is closest.
 */
export function taniwhaAlerts(input: TaniwhaAlertInput): TaniwhaAlert[] {
  const ranks = divisionRanks(input.results, input.eventIds, input.divisionOf)
  const out: TaniwhaAlert[] = []

  for (const playerId of input.playerIds) {
    const p = input.progressOf(playerId)
    if (!p) continue

    // Only the taniwha under construction can be crowned next, and only once
    // its body is finished. A half-built one is not a candidate.
    const building = p.taniwha.find(t => t.is_building && !t.crowned_at)
    if (!building || building.body_parts < 9) continue

    const t = taniwhaBySlug(building.taniwha_slug)
    if (!t) continue

    const crownsHeld = p.taniwha.filter(x => x.crowned_at).length
    const crownOrdinal = crownsHeld + 1
    const threshold = crownPoints(crownOrdinal)

    const effort = input.effortLevelOf(playerId)
    const guaranteed = guaranteedSessionPoints(effort)
    const rank = ranks.get(playerId)
    const projected = rank
      ? projectedPlacementPoints(rank.rank, rank.playerCount) + guaranteed - 10
      : guaranteed

    const pointsShortfall = Math.max(threshold - (p.lifetimePoints + guaranteed), 0)
    const roomOnProjection = p.lifetimePoints + projected >= threshold

    // The act. Whānau is a referral, which is already a committed fact — a
    // referral cannot un-qualify — so it is safe in either state.
    let bankedOk: boolean
    let provisionalOk: boolean
    let winsShortfall = 0

    if (t.kind === 'whanau') {
      bankedOk = p.qualifiedReferrals >= 1
      provisionalOk = bankedOk
      winsShortfall = bankedOk ? 0 : 1
    } else {
      const dn = building.domain_number as number
      const banked = p.bankedWinsByDomain[dn] ?? 0
      const today = input.provisionalWinsOf?.(playerId)?.[dn] ?? 0
      bankedOk = banked >= WIN_TARGET
      provisionalOk = banked + today >= WIN_TARGET
      winsShortfall = Math.max(WIN_TARGET - banked, 0)
    }

    const base = {
      playerId,
      playerName: input.nameOf(playerId),
      taniwha: t,
      crownOrdinal,
      lifetimePoints: p.lifetimePoints,
      guaranteed,
      projected,
      pointsShortfall,
      winsShortfall,
    }

    if (bankedOk && pointsShortfall === 0) {
      out.push({ ...base, state: 'earned' })
    } else if (provisionalOk && roomOnProjection) {
      out.push({ ...base, state: 'on-track' })
    }
  }

  return out.sort((a, b) => {
    if (a.state !== b.state) return a.state === 'earned' ? -1 : 1
    if (a.winsShortfall !== b.winsShortfall) return a.winsShortfall - b.winsShortfall
    return a.pointsShortfall - b.pointsShortfall
  })
}

// ── The standing watchlist (/judge) ──────────────────────────────────────────
// Planning, not celebration: who is approaching a crown, and WHAT IS ACTUALLY
// HOLDING THEM UP. That last part is the whole value. Under the colour ladder
// there was one axis and "2 sessions away" said everything. A crown has two,
// and telling a coach "2 sessions away" when the player is really 4 wins short
// would send them to coach the wrong thing entirely.

export const WATCHLIST_FORM_SESSIONS = 10

export type TaniwhaWatchEntry = {
  playerId: string
  playerName: string
  taniwha: Taniwha
  crownOrdinal: number
  /** What the player actually has to do next. */
  blocker: 'body' | 'wins' | 'points' | 'ready'
  /** Body parts still to place before the crown is even in question. */
  partsToGo: number
  winsToGo: number
  pointsToGo: number
  avgPointsPerSession: number
  /** Rounded up, from their own recent form. Null when points are not the blocker. */
  sessionsAway: number | null
}

export type TaniwhaWatchInput = {
  players: { id: string; name: string }[]
  progressOf: (playerId: string) => TaniwhaProgress | undefined
  /** Points earned per session, most recent first. */
  recentPointsOf: (playerId: string) => number[]
  /** Hide anyone further off than this, when points are the blocker. Default 3. */
  maxSessionsAway?: number
}

export function taniwhaWatchlist(input: TaniwhaWatchInput): TaniwhaWatchEntry[] {
  const limit = input.maxSessionsAway ?? 3
  const out: TaniwhaWatchEntry[] = []

  for (const player of input.players) {
    const p = input.progressOf(player.id)
    if (!p) continue

    const building = p.taniwha.find(t => t.is_building && !t.crowned_at)
    if (!building) continue

    const t = taniwhaBySlug(building.taniwha_slug)
    if (!t) continue

    const crownsHeld = p.taniwha.filter(x => x.crowned_at).length
    const crownOrdinal = crownsHeld + 1
    const partsToGo = Math.max(9 - building.body_parts, 0)

    const winsToGo = t.kind === 'whanau'
      ? (p.qualifiedReferrals >= 1 ? 0 : 1)
      : Math.max(WIN_TARGET - (p.bankedWinsByDomain[building.domain_number as number] ?? 0), 0)

    const pointsToGo = Math.max(crownPoints(crownOrdinal) - p.lifetimePoints, 0)

    const recent = input.recentPointsOf(player.id).slice(0, WATCHLIST_FORM_SESSIONS)
    const avg = recent.length ? recent.reduce((s, n) => s + n, 0) / recent.length : 0
    const sessionsAway = avg > 0 && pointsToGo > 0 ? Math.ceil(pointsToGo / avg) : null

    // Ordered by what the coach can do something about first. A player who
    // still has body parts to place cannot be coached toward a crown at all.
    const blocker: TaniwhaWatchEntry['blocker'] =
      partsToGo > 0 ? 'body'
      : winsToGo > 0 ? 'wins'
      : pointsToGo > 0 ? 'points'
      : 'ready'

    // Only the points blocker is filtered by distance — "4 wins away" is
    // actionable however many sessions it takes, and 'ready' must never be
    // hidden.
    if (blocker === 'points' && (sessionsAway === null || sessionsAway > limit)) continue
    if (blocker === 'body' && partsToGo > 2) continue

    out.push({
      playerId: player.id,
      playerName: player.name,
      taniwha: t,
      crownOrdinal,
      blocker,
      partsToGo,
      winsToGo,
      pointsToGo,
      avgPointsPerSession: Math.round(avg),
      sessionsAway,
    })
  }

  const order = { ready: 0, points: 1, wins: 2, body: 3 } as const
  return out.sort((a, b) =>
    order[a.blocker] - order[b.blocker] ||
    (a.sessionsAway ?? 99) - (b.sessionsAway ?? 99) ||
    a.winsToGo - b.winsToGo ||
    a.playerName.localeCompare(b.playerName)
  )
}


// ── Provisional wins, from the live standings ────────────────────────────────
// Which events a player looks like WINNING today, before anything is banked.
//
// Must agree exactly with compute_event_placements() in 20260824220633, or the
// banner promises a win the close trigger then disagrees with:
//   · rank within the UNIFIED division pool (men / women / juniors)
//   · at least WIN_MIN_FIELD players from that pool scored the event
//   · ties are shared, so two players on the same top score both win
//   · guests and unscored rows are excluded
//
// Deliberately only ever feeds the `on-track` state. A score can still be
// beaten before the session closes, which is exactly why a win landing today
// can never make "earned".

import { divisionPool } from './rating'
import { EVENTS } from './eventData'
import { WIN_MIN_FIELD } from './taniwha'

export type ProvisionalWinInput = {
  results: { player_id: string | null; event_id: string; raw_score: number | null }[]
  /** Domain number for each session event, from the CURRENT roster. */
  domainOfEvent: (eventId: string) => number | null | undefined
  divisionOf: (playerId: string) => string | null | undefined
  /** Events the player has ALREADY banked, so a repeat does not double-count. */
  alreadyWon: (playerId: string, eventId: string) => boolean
}

/** playerId -> domainNumber -> distinct events they are currently winning. */
export function provisionalWins(input: ProvisionalWinInput): Map<string, Record<number, number>> {
  // Best score per (player, event), and the pool each player sits in.
  const best = new Map<string, number>() // `${eventId}|${playerId}`
  const poolOf = new Map<string, string>()

  for (const r of input.results) {
    if (!r.player_id || r.raw_score === null) continue
    const pool = divisionPool(input.divisionOf(r.player_id))
    if (!pool) continue
    poolOf.set(r.player_id, pool)
    const k = `${r.event_id}|${r.player_id}`
    const cur = best.get(k)
    if (cur === undefined || r.raw_score > cur) best.set(k, r.raw_score)
  }

  // Group by (event, pool) so the field and the ranking use the same set.
  const fields = new Map<string, { playerId: string; score: number }[]>()
  for (const [k, score] of best) {
    const [eventId, playerId] = k.split('|')
    const key = `${eventId}|${poolOf.get(playerId)}`
    const arr = fields.get(key) ?? []
    arr.push({ playerId, score })
    fields.set(key, arr)
  }

  const out = new Map<string, Record<number, number>>()
  for (const [key, entries] of fields) {
    if (entries.length < WIN_MIN_FIELD) continue
    const eventId = key.slice(0, key.lastIndexOf('|'))
    const domain = input.domainOfEvent(eventId)
    if (!domain) continue

    const top = Math.max(...entries.map(e => e.score))
    for (const e of entries) {
      if (e.score !== top) continue                      // ties share the win
      if (input.alreadyWon(e.playerId, eventId)) continue
      const g = out.get(e.playerId) ?? {}
      g[domain] = (g[domain] ?? 0) + 1
      out.set(e.playerId, g)
    }
  }
  return out
}


// ── The in-session crown hint ────────────────────────────────────────────────
// "A win here takes you to 7 of 9", shown on an event the player is about to
// play. The whole point of the system in one line, at the moment they can act
// on it.
//
// Four guards, and every one of them matters:
//   · nothing under construction, or a whānau taniwha  → no domain to win in
//   · the event is in a different domain               → irrelevant
//   · they have already banked a win on this event     → a repeat adds nothing,
//     because the crown counts DISTINCT events
//   · the target is already met                        → the crown is waiting
//     on points, not on them
export function crownHint(
  progress: TaniwhaProgress | undefined,
  eventName: string,
  /** From the CURRENT roster, never session_events.domain_number. */
  eventDomain: number | null | undefined,
): string | null {
  if (!progress) return null
  const building = progress.taniwha.find(x => x.is_building && !x.crowned_at)
  if (!building || building.domain_number == null) return null
  if (eventDomain !== building.domain_number) return null
  if (progress.bankedEventNames?.has(eventName)) return null
  const banked = progress.bankedWinsByDomain[building.domain_number] ?? 0
  if (banked >= WIN_TARGET) return null
  return `A win here takes you to ${banked + 1} of ${WIN_TARGET}`
}


// ── Wins per domain ──────────────────────────────────────────────────────────
// Rolls a player's won EVENTS up into domain counts.
//
// The mapping runs through EVENTS — the current roster — and never through
// session_events.domain_number, which records the numbering of the day and was
// renumbered in June 2026 (Power was #5, is now #3). Getting this wrong credits
// an old Power win to Anaerobic Endurance and releases the wrong crown, which
// is why the SQL side deliberately has no domain column either. See the long
// note in migration 20260824220633 part 6.
export function winsByDomain(winsByEvent: Record<string, number>): Record<number, number> {
  const out: Record<number, number> = {}
  for (const e of EVENTS) {
    if (winsByEvent[e.name]) out[e.domainNumber] = (out[e.domainNumber] ?? 0) + 1
  }
  return out
}
