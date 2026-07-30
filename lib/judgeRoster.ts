// Kaiwhakawā roster derivation for the live session screen.
//
// Judges score for anyone in the session — registered players (matched on
// player_id) and guests (matched on player_name, the key submitEntry writes
// guest rows under, since guest rows carry player_id = null).
//
// Pure functions so the live session screen can stay a thin render layer.

export type RosterResult = {
  player_id: string | null
  player_name: string
  event_id: string
}

export type RosterPlayer = { id: string; name: string }

export type RegisteredEntry = { key: string; id: string; name: string }
export type GuestEntry = { key: string; name: string }

export type JudgeRoster = {
  registered: RegisteredEntry[]
  guests: GuestEntry[]
  registeredIds: Set<string>
  guestNames: Set<string>
}

export type JudgeTarget = { id: string | null; name: string; isGuest: boolean }

/** First non-blank name. `??` isn't enough — player_name is NOT NULL, so a missing name arrives as ''. */
function firstName(...candidates: (string | null | undefined)[]): string {
  for (const c of candidates) {
    if (c && c.trim()) return c
  }
  return 'Unknown'
}

/**
 * Everyone holding a result in THIS session, split into registered players and
 * guests, each de-duplicated and sorted by name.
 *
 * A registered player's display name comes from the loaded player list; if they
 * aren't in it (loaded late, or deactivated), fall back to the name stored on
 * the result row, then to 'Unknown' — a judge must never see a blank chip.
 */
export function buildJudgeRoster(results: RosterResult[], sessionPlayers: RosterPlayer[]): JudgeRoster {
  const nameById = new Map(sessionPlayers.map(p => [p.id, p.name]))
  const registeredIds = new Set<string>()
  const guestNames = new Set<string>()
  const registered: RegisteredEntry[] = []
  const guests: GuestEntry[] = []

  results.forEach(r => {
    if (r.player_id) {
      if (registeredIds.has(r.player_id)) return
      registeredIds.add(r.player_id)
      registered.push({
        key: r.player_id,
        id: r.player_id,
        name: firstName(nameById.get(r.player_id), r.player_name),
      })
    } else if (r.player_name && r.player_name.trim()) {
      if (guestNames.has(r.player_name)) return
      guestNames.add(r.player_name)
      guests.push({ key: `guest:${r.player_name}`, name: r.player_name })
    }
  })

  registered.sort((a, b) => a.name.localeCompare(b.name))
  guests.sort((a, b) => a.name.localeCompare(b.name))
  return { registered, guests, registeredIds, guestNames }
}

/**
 * Resolve the judge's current scoring target. A selected registered player wins
 * over a typed guest name; a blank/whitespace guest name means nobody is
 * selected, which is what puts the roster view on screen.
 */
export function resolveJudgeTarget(
  judgeTargetId: string,
  judgeGuestName: string,
  sessionPlayers: RosterPlayer[],
  results: RosterResult[],
): JudgeTarget | null {
  if (judgeTargetId) {
    const name = firstName(
      sessionPlayers.find(p => p.id === judgeTargetId)?.name,
      results.find(r => r.player_id === judgeTargetId)?.player_name,
    )
    return { id: judgeTargetId, name, isGuest: false }
  }
  const guest = judgeGuestName.trim()
  if (guest) return { id: null, name: guest, isGuest: true }
  return null
}

/**
 * A target's result rows. Registered players match on id; guests match on name
 * AND a null player_id, so a guest never picks up a registered player's rows
 * (or vice versa) when the two happen to share a display name.
 */
export function resultsForTarget<T extends RosterResult>(results: T[], target: JudgeTarget): T[] {
  return target.id
    ? results.filter(r => r.player_id === target.id)
    : results.filter(r => !r.player_id && r.player_name === target.name)
}

/** Session events the target already has a result for — drives the progress bar. */
export function scoredEventIds(results: RosterResult[], eventIds: string[]): Set<string> {
  const inSession = new Set(eventIds)
  const scored = new Set<string>()
  for (const r of results) {
    if (inSession.has(r.event_id)) scored.add(r.event_id)
  }
  return scored
}

/**
 * The roster key a result row belongs to — the same key `buildJudgeRoster`
 * puts on its entries, so a roster entry can look itself up directly.
 */
export function rosterKeyFor(r: RosterResult): string {
  return r.player_id ? r.player_id : `guest:${r.player_name}`
}

/**
 * Scored-event sets for EVERY target in one pass, so rendering the roster stays
 * linear in results rather than players x events x results.
 */
export function scoredEventIdsByTarget(
  results: RosterResult[],
  eventIds: string[],
): Map<string, Set<string>> {
  const inSession = new Set(eventIds)
  const byTarget = new Map<string, Set<string>>()
  for (const r of results) {
    if (!inSession.has(r.event_id)) continue
    const key = rosterKeyFor(r)
    const set = byTarget.get(key)
    if (set) set.add(r.event_id)
    else byTarget.set(key, new Set([r.event_id]))
  }
  return byTarget
}

/** Shared empty set so roster rows with no results don't allocate one each render. */
export const NO_SCORES: ReadonlySet<string> = new Set<string>()
