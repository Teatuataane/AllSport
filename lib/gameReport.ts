// ─── A player's own game report ──────────────────────────────────────────────
// Settled with Tāne on 2026-09-28. After a game a player sees, in this order:
// their placement, the game's COLOUR SCORE, then each event with the colour it
// reached and any PR. Only their own: the colour score needs their private
// bodyweight, so nobody else's is ever computed in a browser.
//
//   COLOUR SCORE — every official event scores the rung its result reached
//   (Kiwikiwi 1 … Taniwha 12), so a game is worth up to 120. The SAME function
//   behind the colour total the leaderboard publishes (eventRungInGame), so the
//   two always agree. Game-rung results score win 6 / draw 5 /
//   loss 4, or the rating colour if higher (Tāne confirmed 6/5/4 the same day).
//
//   GAME COLOUR — the score divided by ten events, rounded down: 74 plays at
//   Kākāriki. One colour for the day, on the ladder the player already knows.
//
//   NEXT TIME — the one event from this game closest to its next colour, said
//   in the event's own units ("5kg more", "3s faster").
//
//   COLOURS EARNED — domain colours conferred during or just after the game.
//
// Pure: no React, no Supabase. The takeover, the game report and play history
// all compute through here, so the three can never show different numbers.

import { getEventByName, isTimedEffort, DT_CAP, type EventData } from './eventData'
import { STANDARDS } from './standards'
import { tierScoring, fmtTime } from './scoring'
import { eventRungInGame, placePoints, MAX_GAME_COLOUR_TOTAL } from './leaderboardScores'
import { ladderFor, liftKg, type PlayerGrades, type GradePlayer } from './playerGrades'
import {
  ageBand, rungForScore, thresholdFor, ratioThresholdsKg, bodyweightOn, gradeForRung,
  AGE_SHIFT, DOMAIN_COUNT, DRILL_CAP, TOP_RUNG, type BodyweightDeclaration,
} from './grading'
import { seasonRowsFrom, ratingsAtClose, gradePlayerOf, type GradeInputs, type GradeAward } from './loadGrades'
import { GAME_MINUTES } from './workouts'

/** One official game, scored on the colour ladder. */
export type GameScore = {
  sessionId: string
  /** The NZ day it was played, YYYY-MM-DD. */
  date: string
  /** When it closed (or will: started + 100 minutes). Orders games. */
  closedAt: string | null
  closed: boolean
  /** Sum of the rungs, 0 to 120. */
  points: number
  /** The rung each event reached, by event name. */
  rungs: Map<string, number>
}

/** A game's colour: the score averaged over ten events, rounded down. */
export function gameColourRung(points: number): number {
  return Math.max(0, Math.min(TOP_RUNG, Math.floor(points / DOMAIN_COUNT)))
}

/**
 * Every official game the player has a result in, voided games dropped, scored
 * exactly as the leaderboard's colour total (gameColourTotals). A game still in progress is included
 * (the session-end screen opens before the database has closed it) and marked
 * `closed: false`.
 */
export function gameScores(playerId: string, inputs: GradeInputs): Map<string, GameScore> {
  const rows = seasonRowsFrom(inputs)
  const ratingAt = ratingsAtClose(playerId, inputs, rows)
  const player = gradePlayerOf(inputs)

  const bySession = new Map<string, { date: string; closedAt: string | null; closed: boolean; events: Map<string, typeof rows> }>()
  for (const r of rows) {
    const g = bySession.get(r.session_id)
      ?? { date: r.session_date, closedAt: r.closedAt, closed: r.closed, events: new Map() }
    const list = g.events.get(r.event_name) ?? []
    list.push(r)
    g.events.set(r.event_name, list)
    bySession.set(r.session_id, g)
  }

  const out = new Map<string, GameScore>()
  for (const [sessionId, g] of bySession) {
    const ratings = ratingAt(sessionId)
    const rungs = new Map<string, number>()
    let points = 0
    for (const [name, list] of g.events) {
      const rung = eventRungInGame(name, list, player, ratings.get(name))
      rungs.set(name, rung)
      points += rung
    }
    points = Math.min(points, MAX_GAME_COLOUR_TOTAL)
    out.set(sessionId, { sessionId, date: g.date, closedAt: g.closedAt, closed: g.closed, points, rungs })
  }
  return out
}

/** Games in the order they were played. */
export function gamesInOrder(scores: ReadonlyMap<string, GameScore>): GameScore[] {
  const key = (g: GameScore) => (g.closedAt ? Date.parse(g.closedAt) : Infinity)
  return [...scores.values()].sort((a, b) => key(a) - key(b) || a.date.localeCompare(b.date))
}

/** What was new about one event in this game, against every earlier game. */
export type EventFlags = {
  /** Never played in an earlier official game. */
  firstTime: boolean
  /** Reached a colour no earlier game reached on this event. Never set with firstTime. */
  colourUp: boolean
}

/** Flags for each event of `sessionId`, keyed by event name. */
export function eventFlags(scores: ReadonlyMap<string, GameScore>, sessionId: string): Map<string, EventFlags> {
  const ordered = gamesInOrder(scores)
  const at = ordered.findIndex(g => g.sessionId === sessionId)
  const out = new Map<string, EventFlags>()
  if (at < 0) return out
  const earlierBest = new Map<string, number>()
  for (const g of ordered.slice(0, at)) {
    for (const [name, rung] of g.rungs) earlierBest.set(name, Math.max(earlierBest.get(name) ?? 0, rung))
  }
  for (const [name, rung] of ordered[at].rungs) {
    const before = earlierBest.get(name)
    const firstTime = before === undefined
    out.set(name, { firstTime, colourUp: !firstTime && rung > 0 && rung > before })
  }
  return out
}

/** The player's average colour score over the games before this one. Null for a first game. */
export function averageBefore(scores: ReadonlyMap<string, GameScore>, sessionId: string): number | null {
  const ordered = gamesInOrder(scores).filter(g => g.closed || g.sessionId === sessionId)
  const at = ordered.findIndex(g => g.sessionId === sessionId)
  if (at <= 0) return null
  const earlier = ordered.slice(0, at)
  return earlier.reduce((s, g) => s + g.points, 0) / earlier.length
}

// ─── Colours earned in a game ────────────────────────────────────────────────

/** How long after a game closes an award still counts as that game's. */
export const AWARD_WINDOW_MS = 12 * 60 * 60 * 1000
const GAME_MS = GAME_MINUTES * 60 * 1000

/**
 * The domain colours conferred during a game or soon after it: from the start
 * of the game to 12 hours after it closed, and never past the start of the
 * player's next game. Auto-conferral runs as the game ends (the session-end
 * screen and the kaiwhakawā's live screen both force it) or on the player's
 * next visit to HOME, which is usually the same day.
 */
export function awardsForGame(
  awards: readonly GradeAward[],
  scores: ReadonlyMap<string, GameScore>,
  sessionId: string,
): GradeAward[] {
  const ordered = gamesInOrder(scores)
  const at = ordered.findIndex(g => g.sessionId === sessionId)
  if (at < 0) return []
  const closeMs = ordered[at].closedAt ? Date.parse(ordered[at].closedAt!) : NaN
  if (!Number.isFinite(closeMs)) return []
  const from = closeMs - GAME_MS
  let to = closeMs + AWARD_WINDOW_MS
  const next = ordered[at + 1]
  if (next?.closedAt) to = Math.min(to, Date.parse(next.closedAt) - GAME_MS)
  return awards
    .filter(a => { const t = Date.parse(a.conferred_at); return t >= from && t < to })
    .sort((a, b) => a.domain_number - b.domain_number)
}

// ─── Next time ───────────────────────────────────────────────────────────────

export type NextStep = {
  eventName: string
  slug: string
  /** The colour one step up. */
  nextRung: number
  /** What it takes, in the event's own units: "5kg more", "3s faster", "move up to Wall Handstand". */
  gap: string
  /** How far between this colour and the next the best already sits, 0 to 1. Chooses the event. */
  progress: number
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
const trim = (n: number) => String(Math.round(n * 10) / 10)
const secsText = (s: number) => (s >= 60 ? fmtTime(Math.ceil(s)) : `${trim(s)}s`)

/**
 * What it takes to move a raw score from `best` to `target`, in the event's
 * units. Null for a mode this cannot put into words, which leaves the event out.
 */
export function describeRawGap(ev: EventData, best: number, target: number): string | null {
  const diff = target - best
  if (!(diff > 0)) return null
  const tiered = ev.inputMode.startsWith('difficulty+') || (ev.inputMode === 'hold' && !!ev.difficultyTiers?.length)
  if (tiered) {
    const needTier = Math.floor(target / DT_CAP)
    const bestTier = Math.floor(best / DT_CAP)
    if (needTier > bestTier) {
      const name = ev.difficultyTiers?.[needTier]?.name
      return name ? `move up to ${name}` : null
    }
    const d = (target - needTier * DT_CAP) - (best - needTier * DT_CAP)
    if (ev.inputMode === 'difficulty+time') return `${secsText(d)} ${isTimedEffort(ev.slug) ? 'faster' : 'longer'}`
    if (ev.inputMode === 'hold') return `${secsText(d)} longer`
    if (ev.inputMode === 'difficulty+distance') return `${trim(d / 10)}m further`
    if (ev.inputMode === 'difficulty+reps') {
      if (tierScoring(ev, needTier) === 'weight') return `${trim(d / 100)}kg more`
      if (tierScoring(ev, needTier) === 'sport') return null
      return plural(Math.ceil(d), 'more rep', 'more reps')
    }
    return null
  }
  if (ev.inputMode === 'hold') return `${secsText(diff)} longer`
  if (ev.inputMode === 'reps') return plural(Math.ceil(diff), 'more rep', 'more reps')
  if (ev.inputMode === 'distance') return `${Math.ceil(diff)}cm more`
  return null
}

/**
 * The event from this game closest to its next colour, judged on the player's
 * lifetime best and, for a lift, their most recent bodyweight — the weight they
 * will lift at next time. Events at the top colour, drills already at the
 * Kahurangi cap on a Game-rung event (the next colour there comes from a rating)
 * and lifts with no bodyweight are left out. Null when nothing qualifies.
 */
export function nextStep(
  eventNames: readonly string[],
  grades: PlayerGrades,
  player: GradePlayer,
  declarations: readonly BodyweightDeclaration[],
  today: string,
): NextStep | null {
  const band = ageBand(player.division, player.ageYears)
  const shift = AGE_SHIFT[band]
  const bw = bodyweightOn(declarations, today)
  let pick: NextStep | null = null

  for (const name of new Set(eventNames)) {
    const ev = getEventByName(name)
    if (!ev) continue
    const s = STANDARDS[ev.slug]
    const eg = grades.events.get(ev.slug)
    if (!s || s.kind === 'rating' || !eg?.best) continue
    const ladder = s.all ?? s[ladderFor(player)] ?? []
    if (ladder.length === 0) continue
    const cap = s.game ? DRILL_CAP : TOP_RUNG

    let cur: number, from: number, to: number, bestVal: number, gap: string | null
    if (s.kind === 'ratio') {
      const kg = liftKg(eg.best)
      if (bw == null || kg == null || !(kg > 0)) continue
      const kgs = ratioThresholdsKg(ladder.map(r => r || null), bw)
      cur = rungForScore(kg, kgs, band)
      if (cur + 1 > cap) continue
      from = cur > 0 ? thresholdFor(kgs, cur - shift) : 0
      to = thresholdFor(kgs, cur + 1 - shift)
      bestVal = kg
      gap = to > kg ? `${trim(to - kg)}kg more` : null
    } else {
      const raw = eg.best.raw_score
      if (raw == null) continue
      cur = rungForScore(raw, ladder, band, { cap })
      if (cur + 1 > cap) continue
      to = thresholdFor(ladder, cur + 1 - shift)
      from = cur > 0 ? thresholdFor(ladder, cur - shift) : Math.min(raw, to)
      bestVal = raw
      gap = describeRawGap(ev, raw, to)
    }
    if (!gap || !(to > bestVal)) continue
    const span = to - from
    const progress = span > 0 ? Math.max(0, Math.min(1, (bestVal - from) / span)) : 0
    const step: NextStep = { eventName: ev.name, slug: ev.slug, nextRung: cur + 1, gap, progress }
    if (!pick || step.progress > pick.progress) pick = step
  }
  return pick
}

/** "Deadlift: 5kg more for Kākāriki". */
export function nextStepLine(step: NextStep): string {
  return `${step.eventName}: ${step.gap} for ${gradeForRung(step.nextRung).name}`
}

// ─── Place in the whole game ─────────────────────────────────────────────────
// Since v0.22.0.0 season points come from a player's place among EVERYONE in
// the game, ranked on colour total (player_game_colours, ranked by the
// season_points view). The report leads with that place and the points it
// paid, with the division place under it (Tāne, 2026-09-28).

export type GamePlace = { place: number; of: number; points: number }

/**
 * The player's place in one game from every published colour total, by the
 * same rule as the season_points view: RANK() on the total, ties share the
 * higher place, erased profiles and guests hold no place. Null when the
 * player has no published total yet.
 */
export function placeInGame(
  rows: readonly { player_id: string; colour_total: number }[],
  eligible: (playerId: string) => boolean,
  playerId: string,
): GamePlace | null {
  const field = rows.filter(r => eligible(r.player_id))
  const mine = field.find(r => r.player_id === playerId)
  if (!mine) return null
  const place = 1 + field.filter(r => r.colour_total > mine.colour_total).length
  return { place, of: field.length, points: placePoints(place) }
}
