// ─── Live colour alerts for the kaiwhakawā ───────────────────────────────────
//
// Points are only written when a session CLOSES, so an alert built on stored
// data fires after everyone has packed up. These helpers let the coach be told
// DURING the session, while the player is still standing in front of them.
//
// Two states, and the difference between them matters:
//
//   'earned'    safe to announce out loud. Counts only what the player is
//               GUARANTEED to bank — the minimum placement award (10) plus
//               effort already earned — and uses NO placement ranking, so
//               another player finishing strongly can never take it back.
//               Mirrored exactly by the claim_colour_award RPC.
//
//   'on-track'  the optimistic projection, using the player's CURRENT
//               provisional division placement. Can retract if they slip.
//               Never announce this one as a result.

import {
  MIN_PLACEMENT_POINTS,
  EFFORT_POINTS_PER_LEVEL,
  guaranteedSessionPoints,
  hasEarnedDuringSession,
  isOnTrackDuringSession,
  nextColourFrom,
  type Colour,
} from './colours'

export type AlertResultRow = {
  player_id: string | null
  event_id: string
  raw_score: number
}

export type DivisionRank = {
  rank: number
  divisionName: string
  /** Players in this division with at least one result this session. */
  playerCount: number
  /** Sum of per-event placements. Lower is better. */
  totalPlacement: number
}

/**
 * Provisional division rank for EVERY player with a result in the session.
 *
 * Same maths the live leaderboard and the session-end takeover use: within a
 * division, a player's score for each event is ranked against the others who
 * scored it, a missed event counts as one worse than the whole field, and the
 * lowest total wins. Extracted here so the judge banner and the player banner
 * cannot drift apart — this codebase has already been bitten by six copies of
 * the colour ladder.
 */
export function divisionRanks(
  results: AlertResultRow[],
  eventIds: string[],
  divisionOf: (playerId: string) => string | null | undefined,
): Map<string, DivisionRank> {
  const out = new Map<string, DivisionRank>()

  const byDivision = new Map<string, AlertResultRow[]>()
  for (const r of results) {
    if (!r.player_id) continue
    const div = divisionOf(r.player_id)
    if (!div) continue
    const bucket = byDivision.get(div)
    if (bucket) bucket.push(r)
    else byDivision.set(div, [r])
  }

  for (const [divisionName, divResults] of byDivision) {
    const playerIds = [...new Set(divResults.map(r => r.player_id!))]

    // Best raw_score per (event, player) — one pass, not events × players.
    const bestByEvent = new Map<string, Map<string, number>>()
    for (const r of divResults) {
      let evt = bestByEvent.get(r.event_id)
      if (!evt) { evt = new Map(); bestByEvent.set(r.event_id, evt) }
      const existing = evt.get(r.player_id!)
      if (existing === undefined || r.raw_score > existing) evt.set(r.player_id!, r.raw_score)
    }

    const totals = playerIds.map(pid => {
      let total = 0
      for (const eventId of eventIds) {
        const evt = bestByEvent.get(eventId)
        const scores = evt ? [...evt.values()] : []
        const mine = evt?.get(pid)
        // Missed the event: one worse than everyone who did score it.
        if (mine === undefined) total += scores.length + 1
        else total += 1 + scores.filter(s => s > mine).length
      }
      return { pid, total }
    })

    for (const { pid, total } of totals) {
      out.set(pid, {
        rank: 1 + totals.filter(t => t.total < total).length,
        divisionName,
        playerCount: playerIds.length,
        totalPlacement: total,
      })
    }
  }

  return out
}

/** The placement award a rank would earn if the session closed right now. */
export function projectedPlacementPoints(rank: number, playerCount: number): number {
  if (playerCount <= 0) return MIN_PLACEMENT_POINTS
  const gap = 100 / playerCount
  return Math.max(100 - gap * (rank - 1), MIN_PLACEMENT_POINTS)
}

export type ColourAlert = {
  playerId: string
  playerName: string
  colour: Colour
  state: 'earned' | 'on-track'
  /** Committed lifetime points, before anything from this session. */
  lifetimePoints: number
  /** Points banked no matter what happens next. */
  guaranteed: number
  /** Points on the current provisional placement. */
  projected: number
  /** Still needed, on the guaranteed floor. 0 once earned. */
  shortfall: number
}

export type ColourAlertInput = {
  results: AlertResultRow[]
  eventIds: string[]
  /** Registered players only — guests have no lifetime total to add to. */
  playerIds: string[]
  nameOf: (playerId: string) => string
  divisionOf: (playerId: string) => string | null | undefined
  effortLevelOf: (playerId: string) => number
  totalsOf: (playerId: string) => { lifetime_points: number; highest_rung: number } | undefined
}

/**
 * Everyone in this session who has just crossed a colour, or is about to.
 * Earned first, then on-track, each ordered by who is closest.
 */
export function colourAlerts(input: ColourAlertInput): ColourAlert[] {
  const ranks = divisionRanks(input.results, input.eventIds, input.divisionOf)
  const alerts: ColourAlert[] = []

  for (const playerId of input.playerIds) {
    const totals = input.totalsOf(playerId)
    // No player_totals row yet means no logged history: they sit on Mā with 0.
    const lifetimePoints = totals?.lifetime_points ?? 0
    const highestRung = totals?.highest_rung ?? 1

    const colour = nextColourFrom(lifetimePoints, highestRung)
    if (!colour) continue // already holds Ngā Taniwha

    const effortLevel = input.effortLevelOf(playerId)
    const guaranteed = guaranteedSessionPoints(effortLevel)

    const rank = ranks.get(playerId)
    const projected = rank
      ? projectedPlacementPoints(rank.rank, rank.playerCount) + effortLevel * EFFORT_POINTS_PER_LEVEL
      : guaranteed

    const earned = hasEarnedDuringSession(lifetimePoints, effortLevel, colour.threshold)
    const onTrack = isOnTrackDuringSession(lifetimePoints, projected, colour.threshold)
    if (!earned && !onTrack) continue

    alerts.push({
      playerId,
      playerName: input.nameOf(playerId),
      colour,
      state: earned ? 'earned' : 'on-track',
      lifetimePoints,
      guaranteed,
      projected,
      shortfall: Math.max(0, colour.threshold - (lifetimePoints + guaranteed)),
    })
  }

  return alerts.sort((a, b) => {
    if (a.state !== b.state) return a.state === 'earned' ? -1 : 1
    return a.shortfall - b.shortfall
  })
}

export type PlayerTotals = { lifetime_points: number; highest_rung: number }

/**
 * State update after the kaiwhakawā taps "Celebrated".
 *
 * Bumps `highest_rung` only. `lifetime_points` is deliberately left alone:
 * the RPC awards the colour immediately, but the points genuinely do not move
 * until the session closes. Because `nextColourFrom` reads the awarded rung,
 * the alert retires itself on the next render with no round trip.
 */
export function applyClaimedRung(
  prev: Record<string, PlayerTotals>,
  playerId: string,
  rung: number,
  fallbackLifetime: number,
): Record<string, PlayerTotals> {
  const existing = prev[playerId]
  return {
    ...prev,
    [playerId]: {
      lifetime_points: existing?.lifetime_points ?? fallbackLifetime,
      // max(), not assignment: a stale render must never lower a held rung.
      highest_rung: Math.max(existing?.highest_rung ?? 1, rung),
    },
  }
}

/**
 * Groups session summaries into per-player points-per-session arrays for
 * `colourWatchlist`. Rows must already be newest-first (the query orders by
 * `created_at` descending) because the watchlist only averages the most recent
 * WATCHLIST_FORM_SESSIONS entries.
 */
export function buildRecentPointsMap(
  rows: { player_id: string; total_placement_points: number | null; effort_points: number | null }[],
): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const r of rows) {
    if (!r.player_id) continue
    const pts = (r.total_placement_points ?? 0) + (r.effort_points ?? 0)
    ;(out[r.player_id] ??= []).push(pts)
  }
  return out
}

// ── Standing watchlist (the /judge planning view) ────────────────────────────
// Not live: this is the "who is close?" list a coach checks on a Monday.
// Measured in SESSIONS away rather than points, because "Meredith: Whero in ~2
// sessions" is actionable and "Meredith: 190 points to Whero" is not.

/** How many recent sessions the average is taken over. */
export const WATCHLIST_FORM_SESSIONS = 10

export type WatchlistEntry = {
  playerId: string
  playerName: string
  colour: Colour
  pointsToGo: number
  /** Mean points per session over their last WATCHLIST_FORM_SESSIONS. */
  avgPointsPerSession: number
  /** Rounded up. Always ≥ 1 when a colour is still outstanding. */
  sessionsAway: number
}

export type WatchlistInput = {
  players: { id: string; name: string }[]
  totalsOf: (playerId: string) => { lifetime_points: number; highest_rung: number } | undefined
  /** Points earned per session, most recent first. */
  recentPointsOf: (playerId: string) => number[]
  /** Only list players within this many sessions. Defaults to 3. */
  maxSessionsAway?: number
}

export function colourWatchlist(input: WatchlistInput): WatchlistEntry[] {
  const limit = input.maxSessionsAway ?? 3
  const out: WatchlistEntry[] = []

  for (const player of input.players) {
    const totals = input.totalsOf(player.id)
    const lifetimePoints = totals?.lifetime_points ?? 0
    const highestRung = totals?.highest_rung ?? 1

    const colour = nextColourFrom(lifetimePoints, highestRung)
    if (!colour) continue // holds Ngā Taniwha

    // A player with no finished sessions has no form to extrapolate from.
    // They are also 500 points from their first colour, so nothing is lost.
    const recent = input.recentPointsOf(player.id).slice(0, WATCHLIST_FORM_SESSIONS)
    if (recent.length === 0) continue

    const avg = recent.reduce((s, p) => s + p, 0) / recent.length
    if (avg <= 0) continue

    // nextColourFrom always returns a rung strictly ahead of the player: either
    // it beat the points (threshold > lifetime by definition) or it beat the
    // awarded rung (which is already higher than the points imply). So this is
    // always > 0 and sessionsAway is always ≥ 1 — no floor needed.
    const pointsToGo = colour.threshold - lifetimePoints
    const sessionsAway = Math.ceil(pointsToGo / avg)
    if (sessionsAway > limit) continue

    out.push({
      playerId: player.id,
      playerName: player.name,
      colour,
      pointsToGo,
      avgPointsPerSession: Math.round(avg),
      sessionsAway,
    })
  }

  return out.sort((a, b) =>
    a.sessionsAway !== b.sessionsAway
      ? a.sessionsAway - b.sessionsAway
      : a.pointsToGo - b.pointsToGo)
}
