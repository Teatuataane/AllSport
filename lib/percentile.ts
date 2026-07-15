// ─── AllSport best-score percentiles ─────────────────────────────────────────
// The player-facing ranking metric (replaces the internal Elo "skill" score in
// the UI). For each event, a player's best-ever raw_score is compared against
// every OTHER player IN THE SAME unified division pool (men / women / juniors,
// reusing divisionPool() — same pools as the live leaderboard and rating.ts)
// who has also played that event.
//
//   beat  = other pool players whose best raw_score is STRICTLY lower than yours
//   field = other pool players who have played the event (the denominator)
//   beatPct = beat / field × 100          (ties never count as "beaten")
//   topPct  = max(1, round(100 − beatPct))  → shown as "Top X%", floored at 1
//
// raw_score DESC is uniformly "better" for every input mode (time / timed-effort
// / score / grip-width are all encoded so a higher raw_score wins), so a single
// strict-greater comparison is correct for all events — no per-mode branching.
//
// Leader ("1st"): you lead the pool when NO other player has a strictly higher
// best (sole OR shared top). This matches AllSport's own rule ("Ties: shared
// placement awarded") and avoids a 2-way tie-for-top reading as "Top 100%".
// Leader events contribute topPct = 1 to domain averages (they are the strongest
// you can be), while their label is rendered as "1st".
//
// Solo field (you are the only player who has done the event): field = 0, no
// comparison exists — shown as "No comparison yet" and excluded from averages.
//
// Everything is lifetime best (no season split) and computed for ALL players in
// one pass (the leaderboard needs every player's top domain/event), reusing the
// results / session_events / players already loaded on the page — no new query.

import { divisionPool, type RatingEventRow, type RatingPlayerRow } from './rating'

export type PctResultRow = {
  player_id: string | null
  session_id: string
  event_id: string
  raw_score: number | null
}

// Per (player, event). Present only for events the player has played; absent
// means "Not played". field === 0 means solo / no comparison (beatPct/topPct null).
export type EventPercentile = {
  field: number
  beatPct: number | null
  topPct: number | null
  isLeader: boolean
}

export type PlayerPercentiles = Map<string, EventPercentile> // key = event name

// Compute best-score percentiles for every player, keyed by event NAME (an event
// is the same event across sessions, so lifetime best = max raw_score over all
// the player's rows for that name within their pool).
export function computePercentiles(
  results: PctResultRow[],
  sessionEvents: RatingEventRow[],
  players: RatingPlayerRow[]
): Map<string, PlayerPercentiles> {
  const nameByEventId = new Map(sessionEvents.map(e => [e.id, e.event_name]))
  const poolByPlayer = new Map(players.map(p => [p.id, divisionPool(p.division)]))

  // best[eventName][playerId] = lifetime best raw_score (players in a pool only)
  const best = new Map<string, Map<string, number>>()
  for (const r of results) {
    if (!r.player_id || r.raw_score == null) continue
    if (!poolByPlayer.get(r.player_id)) continue
    const eventName = nameByEventId.get(r.event_id)
    if (!eventName) continue
    let perEvent = best.get(eventName)
    if (!perEvent) { perEvent = new Map(); best.set(eventName, perEvent) }
    const prev = perEvent.get(r.player_id)
    if (prev == null || r.raw_score > prev) perEvent.set(r.player_id, r.raw_score)
  }

  const out = new Map<string, PlayerPercentiles>()
  const put = (playerId: string, eventName: string, ep: EventPercentile) => {
    let pm = out.get(playerId)
    if (!pm) { pm = new Map(); out.set(playerId, pm) }
    pm.set(eventName, ep)
  }

  for (const [eventName, perEvent] of best) {
    // Split the event's entrants into their pools; percentile is within-pool.
    const byPool = new Map<'men' | 'women' | 'juniors', { playerId: string; raw: number }[]>()
    for (const [playerId, raw] of perEvent) {
      const pool = poolByPlayer.get(playerId)!
      if (!byPool.has(pool)) byPool.set(pool, [])
      byPool.get(pool)!.push({ playerId, raw })
    }
    for (const entrants of byPool.values()) {
      const poolMax = Math.max(...entrants.map(e => e.raw))
      for (const me of entrants) {
        const field = entrants.length - 1 // other players who played it
        if (field === 0) {
          put(me.playerId, eventName, { field: 0, beatPct: null, topPct: null, isLeader: false })
          continue
        }
        let beat = 0
        for (const other of entrants) {
          if (other.playerId === me.playerId) continue
          if (other.raw < me.raw) beat++
        }
        const isLeader = me.raw === poolMax // nobody strictly above → sole/shared 1st
        const beatPct = (beat / field) * 100
        const topPct = isLeader ? 1 : Math.max(1, Math.round(100 - beatPct))
        put(me.playerId, eventName, { field, beatPct, topPct, isLeader })
      }
    }
  }

  return out
}

// ─── Labels (one vocabulary for card, modal, and leaderboard) ────────────────

export function eventPctLabel(ep: EventPercentile | undefined): string {
  if (!ep) return 'Not played'
  if (ep.field === 0 || ep.topPct == null) return 'No comparison yet'
  if (ep.isLeader) return '1st'
  return `Top ${ep.topPct}%`
}

export function domainPctLabel(d: DomainPercentile | undefined): string {
  if (!d || d.topPct == null) return '—'
  return `Top ${d.topPct}%`
}

// ─── Domain aggregation ──────────────────────────────────────────────────────
// Domain percentile = average of the player's played-event topPct within the
// domain (leader events count as 1). Solo events (no comparison) are excluded.
// Coverage (events played / total) is tracked separately by the caller.

export type DomainPercentile = { domainNumber: number; topPct: number | null; eventsRanked: number }

export function domainPercentiles(
  playerPct: PlayerPercentiles | undefined,
  eventDomain: Map<string, number> // event name → domainNumber
): DomainPercentile[] {
  const byDomain = new Map<number, number[]>()
  if (playerPct) {
    for (const [eventName, ep] of playerPct) {
      if (ep.topPct == null) continue // solo / no comparison
      const dn = eventDomain.get(eventName)
      if (!dn) continue // legacy orphan names don't map to a domain — by design
      if (!byDomain.has(dn)) byDomain.set(dn, [])
      byDomain.get(dn)!.push(ep.topPct)
    }
  }
  return Array.from({ length: 10 }, (_, i) => {
    const vals = byDomain.get(i + 1) ?? []
    return {
      domainNumber: i + 1,
      topPct: vals.length ? Math.max(1, Math.round(vals.reduce((s, x) => s + x, 0) / vals.length)) : null,
      eventsRanked: vals.length,
    }
  })
}

// ─── Strongest / weakest / top selections ────────────────────────────────────
// Only canonical events (those in eventDomain, so they have an icon + domain)
// with an actual comparison (field > 0) are eligible. Strength is ranked by the
// displayed topPct first (so a shared "1st" (topPct 1) always outranks a sole
// 2nd), then by beatPct as the finer tiebreak, then by a larger field.

export type EventPick = { eventName: string; ep: EventPercentile }

function pickEvent(
  playerPct: PlayerPercentiles | undefined,
  eventDomain: Map<string, number>,
  strongest: boolean
): EventPick | null {
  if (!playerPct) return null
  let best: EventPick | null = null
  for (const [eventName, ep] of playerPct) {
    if (ep.topPct == null || ep.beatPct == null || ep.field === 0) continue
    if (!eventDomain.has(eventName)) continue
    if (!best) { best = { eventName, ep }; continue }
    const b = best.ep
    // Compare on topPct (strongest = lowest), then beatPct (strongest = highest),
    // then field size. Flip the primary/secondary direction for "weakest".
    const better = strongest
      ? ep.topPct < b.topPct! ||
        (ep.topPct === b.topPct && ep.beatPct > b.beatPct!) ||
        (ep.topPct === b.topPct && ep.beatPct === b.beatPct && ep.field > b.field)
      : ep.topPct > b.topPct! ||
        (ep.topPct === b.topPct && ep.beatPct < b.beatPct!) ||
        (ep.topPct === b.topPct && ep.beatPct === b.beatPct && ep.field > b.field)
    if (better) best = { eventName, ep }
  }
  return best
}

export function strongestEvent(playerPct: PlayerPercentiles | undefined, eventDomain: Map<string, number>): EventPick | null {
  return pickEvent(playerPct, eventDomain, true)
}

export function weakestEvent(playerPct: PlayerPercentiles | undefined, eventDomain: Map<string, number>): EventPick | null {
  return pickEvent(playerPct, eventDomain, false)
}

export type DomainPick = { domainNumber: number; domainName: string; topPct: number }

// Top domain = the ranked domain with the lowest topPct (strongest standing).
export function topDomain(
  playerPct: PlayerPercentiles | undefined,
  eventDomain: Map<string, number>,
  domainNames: string[] // index 0 = domain 1
): DomainPick | null {
  const ranked = domainPercentiles(playerPct, eventDomain).filter(d => d.topPct != null)
  if (ranked.length === 0) return null
  const best = ranked.reduce((a, b) => (b.topPct! < a.topPct! ? b : a))
  return { domainNumber: best.domainNumber, domainName: domainNames[best.domainNumber - 1] ?? '', topPct: best.topPct! }
}
