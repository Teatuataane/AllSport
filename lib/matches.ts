// ─── Head-to-head matches ────────────────────────────────────────────────────
// Pure — no React, no Supabase — so it can be unit tested, the same reason
// lib/percentile.ts and lib/judgeRoster.ts are pure.
//
// Until September 2026 a game was recorded as HALF a match: each player wrote
// their own result, and the opponent was free text in `results.opponent_name`.
// A quarter of game results named anyone, and only 11 matches in history were
// recorded by both players. Tāne wants the upper colours on game events gated by
// player-to-player skill, which is impossible on free-text halves, so a match is
// now recorded by player id (migration 20260914020739, `record_match`).
//
// What this module owns:
//   · who can be picked as an opponent, by id, not by name;
//   · resolving an edited result's stored name back to an id;
//   · RECONCILING the two records one real game produces when both players log
//     it — without this, every game both sides record counts twice toward the
//     ten-game minimum.
//
// The rating those games feed lives in lib/headToHead.ts.

import type { EventData } from './eventData'
import { tierScoring } from './scoring'
import { MIN_RATED_GAMES } from './grading'

/**
 * Recorded games a player needs in a sport before a colour can be awarded on
 * head-to-head skill. Defined once, in lib/grading.ts beside the colours it
 * gates, and re-exported here where the games are counted.
 */
export { MIN_RATED_GAMES }

/** Relative to side 'a', which always holds the recording player. */
export type MatchOutcome = 'a' | 'b' | 'draw'

/** Mirrors the CASE in record_match(): the outcome comes from the score. */
export function outcomeFromResult(result: string | null | undefined): MatchOutcome | null {
  if (result === 'win') return 'a'
  if (result === 'loss') return 'b'
  if (result === 'draw') return 'draw'
  return null
}

/** Is this entry a win/draw/loss — a contest event, or a Game rung of a ladder? */
export function isGameEntry(mode: string, eventData: EventData | undefined, tierName: string | null | undefined): boolean {
  if (mode === 'sport') return true
  return !!tierName && tierScoring(eventData, { name: tierName }) === 'sport'
}

// ─── Picking an opponent ─────────────────────────────────────────────────────

type SessionRow = { player_id: string | null; player_name: string }

/**
 * Someone the player can name as their opponent. `id` null is a guest: recorded
 * by name only, exactly as before, and never rated — a guest has no stable
 * identity to rate.
 */
export type OpponentPick = { id: string | null; name: string }

/**
 * Opponents drawn from everyone else with a result in this session — the same
 * pool the name-only chips used — but keyed by player id, so two players who
 * share a display name stay two people, and one player never appears twice.
 * Order of first appearance is kept, so the chips do not reshuffle as scores
 * arrive.
 */
export function opponentPicks(rows: readonly SessionRow[], self: { id: string | null; name: string }, limit = 6): OpponentPick[] {
  const out: OpponentPick[] = []
  const seenIds = new Set<string>()
  const seenGuests = new Set<string>()
  for (const r of rows) {
    const name = (r.player_name ?? '').trim()
    if (!name) continue
    if (r.player_id) {
      if (r.player_id === self.id || seenIds.has(r.player_id)) continue
      seenIds.add(r.player_id)
      out.push({ id: r.player_id, name })
    } else {
      // A guest is only ever identified by name, so that is all we can dedupe on.
      if (name === self.name.trim() || seenGuests.has(name)) continue
      seenGuests.add(name)
      out.push({ id: null, name })
    }
    if (out.length >= limit) break
  }
  return out
}

/**
 * Resolves a stored opponent NAME back to a player id, for editing a result that
 * pre-dates the id being held in the form. Returns null unless exactly one
 * registered player in the session carries that name — an ambiguous name is not
 * guessed at, because a wrong guess records a match against the wrong person.
 */
export function resolveOpponentId(name: string | null | undefined, rows: readonly SessionRow[], selfId: string | null): string | null {
  const target = (name ?? '').trim()
  if (!target) return null
  const ids = new Set<string>()
  for (const r of rows) {
    if (r.player_id && r.player_id !== selfId && (r.player_name ?? '').trim() === target) ids.add(r.player_id)
  }
  return ids.size === 1 ? [...ids][0] : null
}

// ─── Reconciling the two halves of one game ──────────────────────────────────

export type MatchRow = {
  id: string
  /**
   * The official game, or null for a game played against the kaiwhakawā in a
   * training session (20261026220347), which hangs off a workout entry.
   */
  session_id: string | null
  /** The sport — `session_events.event_name`, so games group across sessions. */
  event_name: string
  outcome: MatchOutcome
  created_at: string
  players: { player_id: string; side: 'a' | 'b' }[]
  /**
   * Set by a kaiwhakawā through settle_dispute() on the record of a disputed
   * game that is right. record_match() replaces the row on every edit, so an
   * edit by either player wipes it and the game is judged afresh.
   *
   * Also set by record_entry_match() on a TRAINING game (no session): the
   * kaiwhakawā is the opponent and witnessed it, so it counts as agreed.
   */
  confirmed_at?: string | null
}

/**
 * `agreed`      — both sides recorded it and their outcomes match, or it is a
 *                 training game the kaiwhakawā played and confirmed.
 * `disputed`    — both sides recorded it and their outcomes contradict.
 * `settled`     — disputed, and a kaiwhakawā has marked one record as right.
 * `unconfirmed` — only one side recorded it.
 */
export type GameStatus = 'agreed' | 'disputed' | 'settled' | 'unconfirmed'

/**
 * One real game, made of one or two recorded matches. `sides` and `outcome` are
 * taken from the EARLIER record, so `outcome` is relative to its side 'a' — or,
 * for a settled game, from the record the kaiwhakawā marked as right. For a
 * disputed game the earlier record is only one side's claim: nothing rates a
 * disputed game until a kaiwhakawā settles it.
 */
export type Game = {
  matchIds: string[]
  event_name: string
  session_id: string | null
  status: GameStatus
  players: string[]
  sides: { a: string[]; b: string[] }
  outcome: MatchOutcome
}

const sideOf = (m: MatchRow, s: 'a' | 'b') => new Set(m.players.filter(p => p.side === s).map(p => p.player_id))

/** m2 is the same game recorded from the other side: each has the other's side as opponents. */
function isReciprocal(m1: MatchRow, m2: MatchRow): boolean {
  // A training game has no session and only ever one record (the player's
  // entry), so it never pairs, even with another training game.
  if (!m1.session_id || m1.session_id !== m2.session_id || m1.event_name !== m2.event_name) return false
  const a1 = sideOf(m1, 'a'), b1 = sideOf(m1, 'b'), a2 = sideOf(m2, 'a'), b2 = sideOf(m2, 'b')
  const overlaps = (x: Set<string>, y: Set<string>) => [...x].some(v => y.has(v))
  return overlaps(b1, a2) && overlaps(a1, b2)
}

/**
 * Seen from the other side, 'a' and 'b' swap and a draw is a draw. Mirrored by
 * the agreement check in settle_dispute(), which refuses to settle a pair that
 * already agrees.
 */
export function agrees(m1: Pick<MatchRow, 'outcome'>, m2: Pick<MatchRow, 'outcome'>): boolean {
  if (m1.outcome === 'draw') return m2.outcome === 'draw'
  return m2.outcome === (m1.outcome === 'a' ? 'b' : 'a')
}

/**
 * Collapses recorded matches into real games, in the order they were recorded.
 * When both players log a game there are two rows; counting them separately
 * would credit both players with two games toward MIN_RATED_GAMES for one game
 * played.
 *
 * Pairing is one-to-one and within a session and sport. AGREEING pairs are made
 * first, so two players who met twice — once agreed, once disputed — pair each
 * record with its true partner instead of whichever came first.
 */
export function reconcileGames(matches: readonly MatchRow[]): Game[] {
  const ordered = [...matches].sort((x, y) => x.created_at.localeCompare(y.created_at) || x.id.localeCompare(y.id))
  const paired = new Map<string, { partner: string; status: GameStatus }>()

  for (const pass of ['agreed', 'disputed'] as const) {
    for (const m1 of ordered) {
      if (paired.has(m1.id)) continue
      const m2 = ordered.find(c =>
        c.id !== m1.id && !paired.has(c.id) && isReciprocal(m1, c) && (pass === 'agreed' ? agrees(m1, c) : true))
      if (!m2) continue
      paired.set(m1.id, { partner: m2.id, status: pass })
      paired.set(m2.id, { partner: m1.id, status: pass })
    }
  }

  const games: Game[] = []
  const done = new Set<string>()
  for (const m of ordered) {
    if (done.has(m.id)) continue
    const p = paired.get(m.id)
    const rows = p ? [m, ordered.find(c => c.id === p.partner)!] : [m]
    rows.forEach(r => done.add(r.id))
    // A disputed game is settled when exactly one of its records is confirmed.
    // Both confirmed cannot come from settle_dispute(), which clears the other
    // record; if it happens anyway, nobody's word wins and it stays disputed.
    const confirmed = rows.filter(r => r.confirmed_at)
    const truth = p?.status === 'disputed' && confirmed.length === 1 ? confirmed[0] : null
    const from = truth ?? m
    // A training game against the kaiwhakawā: one record, stamped confirmed by
    // the kaiwhakawā who played it (record_entry_match). Only the server writes
    // matches, so the stamp cannot be forged from the browser.
    const training = !p && !m.session_id && !!m.confirmed_at
    games.push({
      matchIds: rows.map(r => r.id),
      event_name: m.event_name,
      session_id: m.session_id,
      status: truth ? 'settled' : p ? p.status : training ? 'agreed' : 'unconfirmed',
      players: [...new Set(rows.flatMap(r => r.players.map(x => x.player_id)))],
      sides: { a: [...sideOf(from, 'a')], b: [...sideOf(from, 'b')] },
      outcome: from.outcome,
    })
  }
  return games
}

/**
 * A win, draw or loss someone logged at an official game WITHOUT naming an
 * opponent: a results row with a result_type and no match of its own.
 */
export type PlainGameResult = {
  id: string
  player_id: string
  session_id: string
  event_name: string
  result_type: 'win' | 'draw' | 'loss'
  created_at: string
}

/** What a player on side `side` of a match logged, if they agree with it. */
const resultFor = (outcome: MatchOutcome, side: 'a' | 'b'): PlainGameResult['result_type'] =>
  outcome === 'draw' ? 'draw' : outcome === side ? 'win' : 'loss'

/**
 * The matches, plus the other side's record of each game it is missing where
 * that side's own result backs it up.
 *
 * Why (Tāne, 28 Oct 2026): at the 22 Oct game the Teqball winner named both
 * opponents, and both logged a plain Loss without naming the winner. Each game
 * rested on one side's word, so nobody was rated. But the loser DID say they
 * lost: a plain loss in the same game and sport, against a record that says
 * they lost, is the second word a game needs. It is not a way to beat someone
 * without them: their own result has to say the same thing.
 *
 * One plain result backs at most one record, so a player who logged one loss
 * cannot confirm two claimed wins over them. The record made for it is a
 * mirror of the claim (sides swapped), so reconcileGames pairs the two as an
 * agreed game exactly as if both sides had named each other. Its id starts
 * "plain:" and it is never written anywhere.
 */
export function corroborate(matches: readonly MatchRow[], plain: readonly PlainGameResult[]): MatchRow[] {
  const used = new Set<string>()
  const mirrors: MatchRow[] = []
  for (const g of reconcileGames(matches)) {
    if (g.status !== 'unconfirmed' || !g.session_id) continue
    // The opponent is side b: side a always holds the recorder.
    const want = resultFor(g.outcome, 'b')
    const backing = plain.find(r => !used.has(r.id) && r.session_id === g.session_id
      && r.event_name === g.event_name && r.result_type === want && g.sides.b.includes(r.player_id)
      && !g.sides.a.includes(r.player_id))
    if (!backing) continue
    used.add(backing.id)
    mirrors.push({
      id: `plain:${backing.id}`,
      session_id: g.session_id,
      event_name: g.event_name,
      outcome: g.outcome === 'draw' ? 'draw' : g.outcome === 'a' ? 'b' : 'a',
      created_at: backing.created_at,
      confirmed_at: null,
      players: [
        ...g.sides.b.map(player_id => ({ player_id, side: 'a' as const })),
        ...g.sides.a.map(player_id => ({ player_id, side: 'b' as const })),
      ],
    })
  }
  return mirrors.length ? [...matches, ...mirrors] : [...matches]
}

/**
 * Disputed games per sport for one player: the games a kaiwhakawā still has to
 * settle before they count. Shown to the player, so someone stuck on nine of
 * ten games can see why.
 */
export function disputedBySport(matches: readonly MatchRow[], playerId: string): Map<string, number> {
  const out = new Map<string, number>()
  for (const g of reconcileGames(matches)) {
    if (g.status !== 'disputed' || !g.players.includes(playerId)) continue
    out.set(g.event_name, (out.get(g.event_name) ?? 0) + 1)
  }
  return out
}

/**
 * Real games per sport for one player — the count MIN_RATED_GAMES is measured
 * against. A DISPUTED game is left out, as approved in review: it does not count
 * until a kaiwhakawā settles it, and then it does. A game only one side logged
 * counts, the same way every other score in AllSport does. `agreed` counts games
 * resting on more than one side's word: agreed by both, or settled.
 */
export function gamesBySport(matches: readonly MatchRow[], playerId: string): Map<string, { games: number; agreed: number }> {
  const out = new Map<string, { games: number; agreed: number }>()
  for (const g of reconcileGames(matches)) {
    if (g.status === 'disputed' || !g.players.includes(playerId)) continue
    const cur = out.get(g.event_name) ?? { games: 0, agreed: 0 }
    cur.games++
    if (g.status === 'agreed' || g.status === 'settled') cur.agreed++
    out.set(g.event_name, cur)
  }
  return out
}

export function meetsGameMinimum(games: number): boolean {
  return games >= MIN_RATED_GAMES
}
