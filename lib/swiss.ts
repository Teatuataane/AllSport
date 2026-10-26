// ─── One-on-one contests: Swiss pairing and the game-day score ──────────────
// Scoring v2 step 5 (Tāne, 15 Oct 2026; SCORING_V2_PLAN.md decisions 4, 13,
// 14 and 16).
//
//   PAIRING (redesigned 18 Oct 2026: no Ready button, no queue) — players
//   play their first match against anyone they like. After that the scoring
//   sheet suggests who to play next, so winners meet winners and the room
//   quickly finds out who beats everyone that day (suggestNext): the same
//   record today, not met yet today, safe, and seen recently in this contest.
//   It shows up to three names, because without a queue one of them may be
//   mid-match. "Unbeaten today" names whoever has not lost.
//   Suggestions read every recorded match at once, before the other side has
//   confirmed it, so they move as fast as the room; the SCORE below counts
//   only confirmed games.
//
//   SAFETY — contact events pair only within an age group (U12, 12–15, 16+),
//   within about 15% of the day's bodyweight, and the same sex except under 12
//   or where the kaiwhakawā allows mixed. Fencing and Tag pair by age group
//   only; Speed Chess has no limit. Ages, sexes and bodyweights stay in the
//   database: contest_safe_opponents() in
//   supabase/migrations/20261015011537_swiss_contests.sql returns only the
//   ids a player may meet, and the opponent picker greys out the rest.
//   canPair below mirrors it so the rule is tested.
//
//   GAME-DAY SCORE — the player's PERFORMANCE RATING in that contest that
//   game: the average rating of the opponents they met (as it stood before the
//   game) plus 400 × (wins − losses) / games. Put on the colour scale with
//   1,100 = Poroporo (7), 100 points a colour, 1,600 = Taniwha (12), and never
//   below 4, the old loss. It replaces win 6 / draw 5 / loss 4 for any contest
//   with at least one confirmed game; older games keep 6/5/4.
//   Conferred rating colours are unchanged: lifetime rating (from one game since 27 Oct 2026).
//
// Pure: no React, no Supabase.

import { RATING_START, RATING_FLOOR, RATING_STEP, DRILL_CAP, TOP_RUNG, exactFrom } from './grading'
import { rateGames, SCALE, type SportRating } from './headToHead'
import { reconcileGames, type MatchRow } from './matches'
import { getEventBySlug } from './eventData'

/** How closely a contest pairs. */
export type SafetyLevel = 'contact' | 'age' | 'open'

/** The one-on-one contests run as Swiss, by slug. Races and team games are step 6. */
export const SWISS_CONTESTS: Readonly<Record<string, SafetyLevel>> = {
  'wrestling': 'contact',
  'mas-wrestling': 'contact',
  'arm-wrestling': 'contact',
  'tae-kwon-do': 'contact',
  'fencing': 'age',
  'tag': 'age',
  'speed-chess': 'open',
}

/** The same contests by event name, the key matches and results group by. */
export const SWISS_EVENT_NAMES: ReadonlySet<string> = new Set(
  Object.keys(SWISS_CONTESTS).map(slug => getEventBySlug(slug)?.name).filter((n): n is string => !!n))

/** Bodyweights may differ by this share of the lighter player's. */
export const WEIGHT_SPREAD = 0.15

/** A bodyweight older than this is not "the day's". */
export const WEIGHT_FRESH_DAYS = 30

export type AgeGroup = 'U12' | '12-15' | '16+'

/** An unknown age pairs as an adult: juniors are registered with a birth date. */
export function ageGroup(age: number | null | undefined): AgeGroup {
  if (age == null) return '16+'
  return age < 12 ? 'U12' : age < 16 ? '12-15' : '16+'
}

/** The pool a player is paired in by sex: the same rule as ladderFor. */
export function sexClass(division: string | null | undefined, gender: string | null | undefined): 'M' | 'F' {
  const d = division ?? ''
  if (/Women/.test(d)) return 'F'
  if (/Men/.test(d)) return 'M'
  return /^f/i.test(gender ?? '') ? 'F' : 'M'
}

export type ContestPlayer = {
  id: string
  age: number | null
  division: string | null
  gender: string | null
  /** The day's bodyweight, or null when none was declared in the last 30 days. */
  kg: number | null
}

/** May these two meet in a contest of this safety level? */
export function canPair(a: ContestPlayer, b: ContestPlayer, level: SafetyLevel, mixedAllowed = false): boolean {
  if (a.id === b.id) return false
  if (level === 'open') return true
  const ga = ageGroup(a.age)
  if (ga !== ageGroup(b.age)) return false
  if (level === 'age') return true
  if (a.kg == null || b.kg == null) return false
  if (Math.max(a.kg, b.kg) > Math.min(a.kg, b.kg) * (1 + WEIGHT_SPREAD) + 1e-9) return false
  return ga === 'U12' || mixedAllowed || sexClass(a.division, a.gender) === sexClass(b.division, b.gender)
}

// ─── The game-day score ──────────────────────────────────────────────────────

/** One confirmed game: the opponent's rating before the game, and 1 / 0.5 / 0. */
export type ContestGame = { opponentRating: number; score: number }

/** The performance rating: average opponent + 400 × (wins − losses) / games. */
export function performanceRating(games: readonly ContestGame[]): number | null {
  if (games.length === 0) return null
  const avg = games.reduce((s, g) => s + g.opponentRating, 0) / games.length
  const net = games.reduce((s, g) => s + (g.score === 1 ? 1 : g.score === 0 ? -1 : 0), 0)
  return avg + (SCALE * net) / games.length
}

/** The lowest game-day score: what a loss scored before. */
export const CONTEST_FLOOR = DRILL_CAP - 2

/** A performance rating on the colour scale: 1,100 = 7, 100 a colour, 4 to 12. */
export function performanceExact(perf: number): number {
  const colours = DRILL_CAP + 1 + (perf - RATING_FLOOR) / RATING_STEP
  if (colours >= TOP_RUNG) return TOP_RUNG
  if (colours <= CONTEST_FLOOR) return CONTEST_FLOOR
  const rung = Math.floor(colours + 1e-9)
  return exactFrom(rung, colours - rung)
}

/** Is this event a Swiss one-on-one contest? */
export function isSwissContest(slug: string | null | undefined): boolean {
  return !!slug && slug in SWISS_CONTESTS
}

/**
 * Every player's game-day score in every Swiss contest of one game: session →
 * event name → player → exact score. Only confirmed games count (both sides
 * recorded it, or a kaiwhakawā settled it), one-on-one only. Opponents are
 * rated as they stood before the game: every game from other sessions
 * recorded before this one's first.
 */
export function contestScores(
  matches: readonly MatchRow[],
  swissNames: ReadonlySet<string> = SWISS_EVENT_NAMES,
): Map<string, Map<string, Map<string, number>>> {
  const games = reconcileGames(matches).filter(g =>
    // A training game (no session) is not a contest day, so it has no
    // game-day performance rating; it still counts in the lifetime rating.
    !!g.session_id && swissNames.has(g.event_name) && (g.status === 'agreed' || g.status === 'settled')
    && g.sides.a.length === 1 && g.sides.b.length === 1 && g.sides.a[0] !== g.sides.b[0])
  const firstAt = new Map<string, string>()
  const byId = new Map(matches.map(m => [m.id, m]))
  for (const g of games) {
    const at = g.matchIds.map(id => byId.get(id)!.created_at).sort()[0]
    const cur = firstAt.get(g.session_id!)
    if (!cur || at < cur) firstAt.set(g.session_id!, at)
  }

  const out = new Map<string, Map<string, Map<string, number>>>()
  for (const [sessionId, start] of firstAt) {
    const before = rateGames(matches.filter(m => m.session_id !== sessionId && m.created_at < start))
    const ratingOf = (sport: string, id: string): number =>
      (before.get(sport)?.get(id) as SportRating | undefined)?.rating ?? RATING_START
    const played = new Map<string, Map<string, ContestGame[]>>()
    for (const g of games) {
      if (g.session_id !== sessionId) continue
      const [a, b] = [g.sides.a[0], g.sides.b[0]]
      const scoreA = g.outcome === 'a' ? 1 : g.outcome === 'b' ? 0 : 0.5
      const ev = played.get(g.event_name) ?? new Map<string, ContestGame[]>()
      ev.set(a, [...(ev.get(a) ?? []), { opponentRating: ratingOf(g.event_name, b), score: scoreA }])
      ev.set(b, [...(ev.get(b) ?? []), { opponentRating: ratingOf(g.event_name, a), score: 1 - scoreA }])
      played.set(g.event_name, ev)
    }
    const session = new Map<string, Map<string, number>>()
    for (const [event, players] of played) {
      session.set(event, new Map([...players].map(([id, list]) => [id, performanceExact(performanceRating(list)!)])))
    }
    out.set(sessionId, session)
  }
  return out
}

/**
 * One player's game-day contest scores, for gameColourTotals: session → event
 * name → exact score. Empty for a game with no confirmed Swiss games.
 */
export function contestScoresFor(playerId: string, matches: readonly MatchRow[]): (sessionId: string) => ReadonlyMap<string, number> {
  const all = contestScores(matches)
  return sessionId => {
    const out = new Map<string, number>()
    for (const [event, players] of all.get(sessionId) ?? []) {
      const v = players.get(playerId)
      if (v != null) out.set(event, v)
    }
    return out
  }
}

// ─── Who to play next ────────────────────────────────────────────────────────

/** A player is "around" if they recorded a match in this contest this recently. */
export const RECENT_MINUTES = 15

/** How many names "Play next" shows. */
export const SUGGEST_LIMIT = 3

/** One player's record in one contest of one game. */
export type ContestRecord = {
  playerId: string
  wins: number
  draws: number
  losses: number
  /** Win 1, draw ½. */
  points: number
  games: number
  /** Opponents already met today. */
  met: ReadonlySet<string>
  /** When they last recorded a match here (ISO). */
  lastAt: string
}

/**
 * Everyone's record in one contest of one game, from the matches recorded so
 * far. A game counts as soon as either side records it; a disputed game counts
 * for neither until a kaiwhakawā settles it. One-on-one games only.
 */
export function contestTable(matches: readonly MatchRow[], sessionId: string, eventName: string): Map<string, ContestRecord> {
  const mine = matches.filter(m => m.session_id === sessionId && m.event_name === eventName)
  const byId = new Map(mine.map(m => [m.id, m]))
  const out = new Map<string, { wins: number; draws: number; losses: number; met: Set<string>; lastAt: string }>()
  const row = (id: string) => {
    let r = out.get(id)
    if (!r) { r = { wins: 0, draws: 0, losses: 0, met: new Set(), lastAt: '' }; out.set(id, r) }
    return r
  }
  for (const g of reconcileGames(mine)) {
    if (g.status === 'disputed') continue
    if (g.sides.a.length !== 1 || g.sides.b.length !== 1 || g.sides.a[0] === g.sides.b[0]) continue
    const [a, b] = [g.sides.a[0], g.sides.b[0]]
    const at = g.matchIds.map(id => byId.get(id)!.created_at).sort().at(-1)!
    for (const [me, them, res] of [
      [a, b, g.outcome === 'a' ? 'w' : g.outcome === 'b' ? 'l' : 'd'],
      [b, a, g.outcome === 'b' ? 'w' : g.outcome === 'a' ? 'l' : 'd'],
    ] as const) {
      const r = row(me)
      if (res === 'w') r.wins++; else if (res === 'l') r.losses++; else r.draws++
      r.met.add(them)
      if (at > r.lastAt) r.lastAt = at
    }
  }
  return new Map([...out].map(([id, r]) => [id, {
    playerId: id, wins: r.wins, draws: r.draws, losses: r.losses,
    points: r.wins + r.draws / 2, games: r.wins + r.draws + r.losses, met: r.met, lastAt: r.lastAt,
  }]))
}

/**
 * Who `meId` should play next: nobody before their first match (that one is
 * anyone they like). Otherwise players already in this contest today who are
 * safe to meet, preferring someone not met yet (a rematch only when everyone
 * safe has been met), then someone seen in the last RECENT_MINUTES (they are
 * probably nearby), then the closest record, then a similar number of games,
 * then whoever played most recently.
 */
export function suggestNext(
  meId: string,
  table: ReadonlyMap<string, ContestRecord>,
  safe: ReadonlySet<string>,
  now: Date = new Date(),
  limit = SUGGEST_LIMIT,
): ContestRecord[] {
  const me = table.get(meId)
  if (!me || me.games === 0) return []
  const cutoff = new Date(now.getTime() - RECENT_MINUTES * 60_000).toISOString()
  const pool = [...table.values()].filter(r => r.playerId !== meId && safe.has(r.playerId))
  const fresh = pool.filter(r => !me.met.has(r.playerId))
  const from = fresh.length > 0 ? fresh : pool
  return [...from].sort((x, y) =>
    Number(y.lastAt >= cutoff) - Number(x.lastAt >= cutoff)
    || Math.abs(x.points - me.points) - Math.abs(y.points - me.points)
    || Math.abs(x.games - me.games) - Math.abs(y.games - me.games)
    || y.lastAt.localeCompare(x.lastAt)
    || x.playerId.localeCompare(y.playerId)).slice(0, limit)
}

/** Who has won and not lost today, most wins first. */
export function unbeaten(table: ReadonlyMap<string, ContestRecord>): ContestRecord[] {
  return [...table.values()].filter(r => r.losses === 0 && r.wins > 0)
    .sort((x, y) => y.wins - x.wins || y.points - x.points || x.lastAt.localeCompare(y.lastAt))
}

/** A record the way players say it: "3–0", or "3–0–1" with draws. */
export function recordLabel(r: Pick<ContestRecord, 'wins' | 'losses' | 'draws'>): string {
  return r.draws > 0 ? `${r.wins}–${r.losses}–${r.draws}` : `${r.wins}–${r.losses}`
}
