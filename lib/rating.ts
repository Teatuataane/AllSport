// ─── AllSport skill ratings ──────────────────────────────────────────────────
// Multiplayer Elo computed from per-event session results.
//
// Every session-event is treated as a mini tournament inside each unified
// division pool (Men's + Masters Men + Grandmaster Men together, same for
// Women's; Juniors separate — matching the live leaderboard pools). Each pair
// of players who both scored the event exchanges a pairwise Elo update
// (win/draw/loss by raw_score, which every ranker already sorts DESC), with
// the K-factor split across the field so one session-event moves a rating by
// roughly one game's worth regardless of field size.
//
// Ratings are ALWAYS recomputed from full history (idempotent — never an
// incremental "+X on close" update, so they can never double-count). At
// AllSport's data size this is milliseconds in the browser.
//
// Display: the internal Elo number is never shown. `eloTo100` maps a rating to
// a 0–100 skill score = expected score (win probability) against an average
// AllSport player × 100. 50 = average, 90+ = dominant, 100 only after
// sustained total dominance. Unplayed events have no rating and display as 0.

export const RATING_START = 1500
// Base K — high because AllSport fields are small (2–5 per pool) and ratings
// should converge within a handful of sessions.
export const RATING_K = 64

export type RatingResultRow = {
  player_id: string | null
  session_id: string
  event_id: string
  raw_score: number | null
}
export type RatingEventRow = { id: string; session_id: string; event_name: string }
export type RatingSessionRow = { id: string; session_date: string }
export type RatingPlayerRow = { id: string; division: string | null }

export type EventRating = { rating: number; plays: number }
export type PlayerRatings = Map<string, EventRating> // key = event name

// Unified pools, matching the live session leaderboard
export function divisionPool(division: string | null | undefined): 'men' | 'women' | 'juniors' | null {
  switch (division) {
    case "Men's":
    case 'Masters Men':
    case 'Grandmaster Men':
      return 'men'
    case "Women's":
    case 'Masters Women':
    case 'Grandmaster Women':
      return 'women'
    case 'Juniors':
    case 'Youth': // legacy value, treated as Juniors everywhere
      return 'juniors'
    default:
      return null
  }
}

export function eloTo100(rating: number): number {
  return Math.round(100 / (1 + Math.pow(10, (RATING_START - rating) / 400)))
}

export function computeRatings(
  results: RatingResultRow[],
  sessionEvents: RatingEventRow[],
  sessions: RatingSessionRow[],
  players: RatingPlayerRow[]
): Map<string, PlayerRatings> {
  const eventById = new Map(sessionEvents.map(e => [e.id, e]))
  const poolByPlayer = new Map(players.map(p => [p.id, divisionPool(p.division)]))

  // Chronological session order so ratings evolve through the season
  const sessionOrder = new Map(
    [...sessions]
      .sort((a, b) => a.session_date.localeCompare(b.session_date) || a.id.localeCompare(b.id))
      .map((s, i) => [s.id, i])
  )

  // Best raw_score per (session, event, player)
  const best = new Map<string, { sessionId: string; eventId: string; playerId: string; raw: number }>()
  for (const r of results) {
    if (!r.player_id || r.raw_score == null) continue
    if (!eventById.has(r.event_id)) continue
    if (!poolByPlayer.get(r.player_id)) continue
    const key = `${r.event_id}|${r.player_id}`
    const prev = best.get(key)
    if (!prev || r.raw_score > prev.raw) {
      best.set(key, { sessionId: r.session_id, eventId: r.event_id, playerId: r.player_id, raw: r.raw_score })
    }
  }

  // Group into per-(session-event, pool) fields
  const fields = new Map<string, { playerId: string; raw: number }[]>()
  for (const b of best.values()) {
    const pool = poolByPlayer.get(b.playerId)
    const fieldKey = `${b.eventId}|${pool}`
    if (!fields.has(fieldKey)) fields.set(fieldKey, [])
    fields.get(fieldKey)!.push({ playerId: b.playerId, raw: b.raw })
  }

  // Order fields chronologically (then by event id for stability)
  const orderedFields = [...fields.entries()].sort((a, b) => {
    const ea = eventById.get(a[0].split('|')[0])!
    const eb = eventById.get(b[0].split('|')[0])!
    return (
      (sessionOrder.get(ea.session_id) ?? 0) - (sessionOrder.get(eb.session_id) ?? 0) ||
      ea.id.localeCompare(eb.id)
    )
  })

  const ratings = new Map<string, PlayerRatings>()
  const get = (playerId: string, eventName: string): EventRating => {
    if (!ratings.has(playerId)) ratings.set(playerId, new Map())
    const pr = ratings.get(playerId)!
    if (!pr.has(eventName)) pr.set(eventName, { rating: RATING_START, plays: 0 })
    return pr.get(eventName)!
  }

  for (const [fieldKey, entrants] of orderedFields) {
    if (entrants.length < 2) {
      // Solo fields still count as a play (coverage) but move no rating
      const eventName = eventById.get(fieldKey.split('|')[0])!.event_name
      for (const e of entrants) get(e.playerId, eventName).plays += 1
      continue
    }
    const eventName = eventById.get(fieldKey.split('|')[0])!.event_name
    const kPair = RATING_K / (entrants.length - 1)
    const startRatings = new Map(entrants.map(e => [e.playerId, get(e.playerId, eventName).rating]))
    const deltas = new Map(entrants.map(e => [e.playerId, 0]))

    for (let i = 0; i < entrants.length; i++) {
      for (let j = i + 1; j < entrants.length; j++) {
        const a = entrants[i], b = entrants[j]
        const sA = a.raw > b.raw ? 1 : a.raw < b.raw ? 0 : 0.5
        const rA = startRatings.get(a.playerId)!
        const rB = startRatings.get(b.playerId)!
        const eA = 1 / (1 + Math.pow(10, (rB - rA) / 400))
        deltas.set(a.playerId, deltas.get(a.playerId)! + kPair * (sA - eA))
        deltas.set(b.playerId, deltas.get(b.playerId)! + kPair * ((1 - sA) - (1 - eA)))
      }
    }
    for (const e of entrants) {
      const er = get(e.playerId, eventName)
      er.rating += deltas.get(e.playerId)!
      er.plays += 1
    }
  }

  return ratings
}

// ─── Aggregations ────────────────────────────────────────────────────────────

export type DomainRating = { domainNumber: number; score: number; eventsRated: number }

// Average 0–100 score across the player's rated events in each domain.
export function domainRatings(
  playerRatings: PlayerRatings | undefined,
  eventDomain: Map<string, number> // event name → domainNumber
): DomainRating[] {
  const byDomain = new Map<number, number[]>()
  if (playerRatings) {
    for (const [eventName, er] of playerRatings) {
      const dn = eventDomain.get(eventName)
      if (!dn) continue // legacy orphan event names don't rate — by design
      if (!byDomain.has(dn)) byDomain.set(dn, [])
      byDomain.get(dn)!.push(eloTo100(er.rating))
    }
  }
  return Array.from({ length: 10 }, (_, i) => {
    const scores = byDomain.get(i + 1) ?? []
    return {
      domainNumber: i + 1,
      score: scores.length ? Math.round(scores.reduce((s, x) => s + x, 0) / scores.length) : 0,
      eventsRated: scores.length,
    }
  })
}

export function topEvent(playerRatings: PlayerRatings | undefined): { eventName: string; score: number } | null {
  if (!playerRatings || playerRatings.size === 0) return null
  let bestName: string | null = null
  let bestRating = -Infinity
  for (const [eventName, er] of playerRatings) {
    if (er.rating > bestRating) { bestRating = er.rating; bestName = eventName }
  }
  return bestName ? { eventName: bestName, score: eloTo100(bestRating) } : null
}

export function topDomain(
  playerRatings: PlayerRatings | undefined,
  eventDomain: Map<string, number>,
  domainNames: string[] // index 0 = domain 1
): { domainNumber: number; domainName: string; score: number } | null {
  const rated = domainRatings(playerRatings, eventDomain).filter(d => d.eventsRated > 0)
  if (rated.length === 0) return null
  const best = rated.reduce((a, b) => (b.score > a.score ? b : a))
  return { domainNumber: best.domainNumber, domainName: domainNames[best.domainNumber - 1] ?? '', score: best.score }
}

// ─── Wins ────────────────────────────────────────────────────────────────────
// A win = 1st overall in your division for a session. results.placement stores
// the division rank for the whole session on every row, so a session is won
// when any row for that (player, session) has placement 1.
export function sessionWins(
  rows: { player_id: string | null; session_id: string; placement: number | null }[]
): Map<string, number> {
  const wonSessions = new Map<string, Set<string>>()
  for (const r of rows) {
    if (!r.player_id || r.placement !== 1) continue
    if (!wonSessions.has(r.player_id)) wonSessions.set(r.player_id, new Set())
    wonSessions.get(r.player_id)!.add(r.session_id)
  }
  return new Map([...wonSessions].map(([p, s]) => [p, s.size]))
}
