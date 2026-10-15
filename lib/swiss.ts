// ─── One-on-one contests: Swiss pairing and the game-day score ──────────────
// Scoring v2 step 5 (Tāne, 15 Oct 2026; SCORING_V2_PLAN.md decisions 4, 13,
// 14 and 16).
//
//   PAIRING — each one-on-one contest in a game runs as a Swiss tournament,
//   paired on demand: a player taps Ready and is paired with the best free
//   opponent who is waiting (closest Swiss points in this contest today, not
//   someone already met today if anyone else is free, then whoever has waited
//   longest). The app says whom to find. Both record the result, as before;
//   a kaiwhakawā settles a dispute and can pair any two players by hand.
//   The pairing itself runs in the database (contest_ready() in
//   supabase/migrations/20261015011537_swiss_contests.sql), atomically, so two
//   players can never both be handed the same opponent. This file mirrors its
//   rules so they are tested.
//
//   SAFETY — contact events pair only within an age group (U12, 12–15, 16+),
//   within about 15% of the day's bodyweight, and the same sex except under 12
//   or where the kaiwhakawā allows mixed. Fencing and Tag pair by age group
//   only; Speed Chess has no limit. With nobody eligible in the game, a player
//   takes a bye, recorded as a draw.
//
//   GAME-DAY SCORE — the player's PERFORMANCE RATING in that contest that
//   game: the average rating of the opponents they met (as it stood before the
//   game) plus 400 × (wins − losses) / games. Put on the colour scale with
//   1,100 = Poroporo (7), 100 points a colour, 1,600 = Taniwha (12), and never
//   below 4, the old loss. It replaces win 6 / draw 5 / loss 4 for any contest
//   with at least one confirmed game; older games and byes keep 6/5/4.
//   Conferred rating colours are unchanged: lifetime rating, 10 games.
//
//   MATCHES — the kaiwhakawā sets how many each player plays per contest, 3
//   unless changed. Extra matches are allowed and count.
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

export const DEFAULT_CONTEST_MATCHES = 3

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

/** May these two be paired automatically? A kaiwhakawā can pair anyone by hand. */
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

/** Someone waiting to be paired. `points` is their Swiss score in this contest today. */
export type Waiting = ContestPlayer & { points: number; readyAt: string }

/**
 * The opponent the database pairs `me` with, or null to wait. Mirrors the
 * ORDER BY in contest_ready(): never a rematch while anyone else is free,
 * then the closest points, then the longest wait.
 */
export function pickOpponent(
  me: ContestPlayer & { points: number },
  waiting: readonly Waiting[],
  level: SafetyLevel,
  opts: { mixedAllowed?: boolean; metToday?: ReadonlySet<string> } = {},
): Waiting | null {
  const met = opts.metToday ?? new Set<string>()
  const eligible = waiting.filter(w => canPair(me, w, level, opts.mixedAllowed))
  if (eligible.length === 0) return null
  return [...eligible].sort((x, y) =>
    Number(met.has(x.id)) - Number(met.has(y.id))
    || Math.abs(x.points - me.points) - Math.abs(y.points - me.points)
    || x.readyAt.localeCompare(y.readyAt))[0]
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
    swissNames.has(g.event_name) && (g.status === 'agreed' || g.status === 'settled')
    && g.sides.a.length === 1 && g.sides.b.length === 1 && g.sides.a[0] !== g.sides.b[0])
  const firstAt = new Map<string, string>()
  const byId = new Map(matches.map(m => [m.id, m]))
  for (const g of games) {
    const at = g.matchIds.map(id => byId.get(id)!.created_at).sort()[0]
    const cur = firstAt.get(g.session_id)
    if (!cur || at < cur) firstAt.set(g.session_id, at)
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

/** Swiss standings in one contest of one game: points (win 1, draw ½), most first. */
export function swissStandings(
  matches: readonly MatchRow[],
  sessionId: string,
  eventName: string,
): { playerId: string; points: number; games: number }[] {
  const tally = new Map<string, { points: number; games: number }>()
  for (const g of reconcileGames(matches)) {
    if (g.session_id !== sessionId || g.event_name !== eventName) continue
    if (g.status !== 'agreed' && g.status !== 'settled') continue
    if (g.sides.a.length !== 1 || g.sides.b.length !== 1) continue
    const scoreA = g.outcome === 'a' ? 1 : g.outcome === 'b' ? 0 : 0.5
    for (const [id, s] of [[g.sides.a[0], scoreA], [g.sides.b[0], 1 - scoreA]] as const) {
      const t = tally.get(id) ?? { points: 0, games: 0 }
      tally.set(id, { points: t.points + s, games: t.games + 1 })
    }
  }
  return [...tally].map(([playerId, t]) => ({ playerId, ...t }))
    .sort((x, y) => y.points - x.points || x.playerId.localeCompare(y.playerId))
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
