import { describe, it, expect } from 'vitest'
import {
  MIN_RATED_GAMES, outcomeFromResult, isGameEntry, opponentPicks, resolveOpponentId,
  reconcileGames, gamesBySport, meetsGameMinimum, type MatchRow,
} from '@/lib/matches'
import { getEventByName } from '@/lib/eventData'

describe('the ten-game minimum', () => {
  it('is ten, as Tāne decided', () => {
    expect(MIN_RATED_GAMES).toBe(10)
  })
  it('is met at ten, not nine', () => {
    expect(meetsGameMinimum(9)).toBe(false)
    expect(meetsGameMinimum(10)).toBe(true)
  })
})

describe('outcome from the score', () => {
  // Must mirror the CASE in record_match(): production stores exactly these.
  it('maps win, loss and draw relative to the recorder', () => {
    expect(outcomeFromResult('win')).toBe('a')
    expect(outcomeFromResult('loss')).toBe('b')
    expect(outcomeFromResult('draw')).toBe('draw')
  })
  it('is null for anything that is not a result', () => {
    expect(outcomeFromResult('')).toBeNull()
    expect(outcomeFromResult(null)).toBeNull()
    expect(outcomeFromResult('Win')).toBeNull()
  })
})

describe('which entries are games', () => {
  it('treats a pure contest as a game', () => {
    expect(isGameEntry('sport', getEventByName('Tag'), null)).toBe(true)
  })
  it('treats the Game rung of a ladder as a game, and a drill rung as not', () => {
    const bb = getEventByName('Basketball')
    expect(isGameEntry('difficulty+reps', bb, 'Game')).toBe(true)
    expect(isGameEntry('difficulty+reps', bb, 'Bounce Ball')).toBe(false)
  })
  it('never treats an untiered measured event as a game', () => {
    expect(isGameEntry('strength', getEventByName('Deadlift'), null)).toBe(false)
  })
})

describe('opponent picks', () => {
  const rows = [
    { player_id: 'p1', player_name: 'Aroha' },
    { player_id: 'me', player_name: 'Me' },
    { player_id: 'p1', player_name: 'Aroha' },
    { player_id: 'p2', player_name: 'Sam' },
    { player_id: 'p3', player_name: 'Sam' },
    { player_id: null, player_name: 'Guest Kim' },
    { player_id: null, player_name: 'Guest Kim' },
  ]

  it('keys registered players by id, so a repeated player appears once', () => {
    const picks = opponentPicks(rows, { id: 'me', name: 'Me' })
    expect(picks.filter(p => p.id === 'p1')).toHaveLength(1)
  })
  it('keeps two players who share a display name as two people', () => {
    const sams = opponentPicks(rows, { id: 'me', name: 'Me' }).filter(p => p.name === 'Sam')
    expect(sams.map(p => p.id)).toEqual(['p2', 'p3'])
  })
  it('never offers the player themselves', () => {
    expect(opponentPicks(rows, { id: 'me', name: 'Me' }).some(p => p.id === 'me')).toBe(false)
  })
  it('keeps guests, by name only, with no id — they are never rated', () => {
    const guests = opponentPicks(rows, { id: 'me', name: 'Me' }).filter(p => p.id === null)
    expect(guests).toEqual([{ id: null, name: 'Guest Kim' }])
  })
  it('keeps the order players first appeared, so chips do not reshuffle', () => {
    expect(opponentPicks(rows, { id: 'me', name: 'Me' }).map(p => p.name)).toEqual(['Aroha', 'Sam', 'Sam', 'Guest Kim'])
  })
  it('caps the list', () => {
    const many = Array.from({ length: 10 }, (_, i) => ({ player_id: `x${i}`, player_name: `P${i}` }))
    expect(opponentPicks(many, { id: 'me', name: 'Me' })).toHaveLength(6)
  })
  it('lets a guest recorder see registered players', () => {
    expect(opponentPicks(rows, { id: null, name: 'Guest Kim' }).some(p => p.name === 'Guest Kim')).toBe(false)
  })
})

describe('resolving a stored name back to an id', () => {
  const rows = [
    { player_id: 'p1', player_name: 'Aroha' },
    { player_id: 'p2', player_name: 'Sam' },
    { player_id: 'p3', player_name: 'Sam' },
    { player_id: null, player_name: 'Guest Kim' },
  ]
  it('resolves a name exactly one registered player carries', () => {
    expect(resolveOpponentId('Aroha', rows, 'me')).toBe('p1')
    expect(resolveOpponentId('  Aroha ', rows, 'me')).toBe('p1')
  })
  it('refuses to guess between two players with the same name', () => {
    expect(resolveOpponentId('Sam', rows, 'me')).toBeNull()
  })
  it('does not resolve guests, unknowns, or blanks', () => {
    expect(resolveOpponentId('Guest Kim', rows, 'me')).toBeNull()
    expect(resolveOpponentId('Nobody', rows, 'me')).toBeNull()
    expect(resolveOpponentId('', rows, 'me')).toBeNull()
  })
  it('never resolves to the player themselves', () => {
    expect(resolveOpponentId('Aroha', rows, 'p1')).toBeNull()
  })
})

// ─── Reconciliation ──────────────────────────────────────────────────────────

let n = 0
const match = (recorder: string, opp: string, outcome: MatchRow['outcome'], extra: Partial<MatchRow> = {}): MatchRow => ({
  id: `m${++n}`, session_id: 's1', event_name: 'Squash', outcome,
  created_at: `2026-09-14T10:00:${String(n).padStart(2, '0')}Z`,
  players: [{ player_id: recorder, side: 'a' }, { player_id: opp, side: 'b' }],
  ...extra,
})

describe('reconciling the two records of one game', () => {
  it('collapses an agreeing pair into ONE agreed game', () => {
    // A says A won; B says B lost.
    const games = reconcileGames([match('A', 'B', 'a'), match('B', 'A', 'b')])
    expect(games).toHaveLength(1)
    expect(games[0].status).toBe('agreed')
  })
  it('treats two draws as agreeing', () => {
    expect(reconcileGames([match('A', 'B', 'draw'), match('B', 'A', 'draw')])[0].status).toBe('agreed')
  })
  it('collapses a contradicting pair into ONE disputed game', () => {
    // Both claim the win.
    const games = reconcileGames([match('A', 'B', 'a'), match('B', 'A', 'a')])
    expect(games).toHaveLength(1)
    expect(games[0].status).toBe('disputed')
  })
  it('leaves a one-sided record as an unconfirmed game', () => {
    const games = reconcileGames([match('A', 'B', 'a')])
    expect(games).toEqual([expect.objectContaining({ status: 'unconfirmed', players: ['A', 'B'] })])
  })
  it('counts two meetings in one session as two games', () => {
    const games = reconcileGames([
      match('A', 'B', 'a'), match('B', 'A', 'b'),
      match('A', 'B', 'b'), match('B', 'A', 'a'),
    ])
    expect(games).toHaveLength(2)
    expect(games.every(g => g.status === 'agreed')).toBe(true)
  })
  it('pairs agreeing records first, so a disputed game cannot steal an agreed partner', () => {
    // Game 1: A won, both agree. Game 2: disputed. Recorded out of order.
    const games = reconcileGames([
      match('A', 'B', 'a'),       // A: I won game 1
      match('A', 'B', 'a'),       // A: I won game 2
      match('B', 'A', 'a'),       // B: I won game 2   (dispute)
      match('B', 'A', 'b'),       // B: I lost game 1  (agrees with the first)
    ])
    expect(games.map(g => g.status).sort()).toEqual(['agreed', 'disputed'])
  })
  it('never pairs across sessions or sports', () => {
    expect(reconcileGames([match('A', 'B', 'a'), match('B', 'A', 'b', { session_id: 's2' })])).toHaveLength(2)
    expect(reconcileGames([match('A', 'B', 'a'), match('B', 'A', 'b', { event_name: 'Tennis' })])).toHaveLength(2)
  })
  it('never pairs two records from the same side', () => {
    expect(reconcileGames([match('A', 'B', 'a'), match('A', 'B', 'a')])).toHaveLength(2)
  })
  it('recognises a team game recorded from each side', () => {
    const teamA = [{ player_id: 'A', side: 'a' as const }, { player_id: 'A2', side: 'a' as const }]
    const teamB = [{ player_id: 'B', side: 'b' as const }, { player_id: 'B2', side: 'b' as const }]
    const flip = (ps: { player_id: string; side: 'a' | 'b' }[]) => ps.map(p => ({ ...p, side: (p.side === 'a' ? 'b' : 'a') as 'a' | 'b' }))
    const games = reconcileGames([
      match('A', 'B', 'a', { players: [...teamA, ...teamB] }),
      match('B', 'A', 'b', { players: [...flip(teamB), ...flip(teamA)] }),
    ])
    expect(games).toHaveLength(1)
    expect(games[0].status).toBe('agreed')
  })
})

describe('games toward the minimum', () => {
  it('counts real games, not recorded rows', () => {
    // Both logged it: one game each, not two.
    const counts = gamesBySport([match('A', 'B', 'a'), match('B', 'A', 'b')], 'A')
    expect(counts.get('Squash')).toEqual({ games: 1, agreed: 1 })
  })
  it('credits a player for a game only their opponent recorded', () => {
    expect(gamesBySport([match('B', 'A', 'b')], 'A').get('Squash')).toEqual({ games: 1, agreed: 0 })
  })
  it('keeps sports separate', () => {
    const counts = gamesBySport([match('A', 'B', 'a'), match('A', 'C', 'a', { event_name: 'Tennis' })], 'A')
    expect(counts.get('Squash')?.games).toBe(1)
    expect(counts.get('Tennis')?.games).toBe(1)
  })
  it('reaches the minimum at ten real games', () => {
    const ten = Array.from({ length: 10 }, (_, i) => match('A', 'B', 'a', { session_id: `s${i}` }))
    expect(meetsGameMinimum(gamesBySport(ten, 'A').get('Squash')!.games)).toBe(true)
  })
  it('gives nothing to a player who played none', () => {
    expect(gamesBySport([match('A', 'B', 'a')], 'Z').size).toBe(0)
  })
})
