import { describe, it, expect } from 'vitest'
import {
  MIN_RATED_GAMES, outcomeFromResult, isGameEntry, opponentPicks, resolveOpponentId,
  reconcileGames, gamesBySport, disputedBySport, meetsGameMinimum, agrees, corroborate,
  type MatchRow, type PlainGameResult,
} from '@/lib/matches'
import { rateGames } from '@/lib/headToHead'
import { getEventByName } from '@/lib/eventData'

describe('the game minimum', () => {
  it('is one game, as Tāne decided on 27 Oct 2026 (it was ten)', () => {
    expect(MIN_RATED_GAMES).toBe(1)
  })
  it('is met at one, not none', () => {
    expect(meetsGameMinimum(0)).toBe(false)
    expect(meetsGameMinimum(1)).toBe(true)
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
    // Wrestling is the one pure contest left: every other gained a drill ladder.
    expect(isGameEntry('sport', getEventByName('Wrestling'), null)).toBe(true)
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

describe('settling a disputed game', () => {
  it('settles on the record the kaiwhakawā confirmed, even when it was the later one', () => {
    // A says A won, B says B won; the kaiwhakawā says B is right.
    const games = reconcileGames([match('A', 'B', 'a'), match('B', 'A', 'a', { confirmed_at: '2026-09-15T00:00:00Z' })])
    expect(games).toHaveLength(1)
    expect(games[0]).toMatchObject({ status: 'settled', sides: { a: ['B'], b: ['A'] }, outcome: 'a' })
  })
  it('stays disputed if both records somehow carry a confirmation', () => {
    const at = { confirmed_at: '2026-09-15T00:00:00Z' }
    expect(reconcileGames([match('A', 'B', 'a', at), match('B', 'A', 'a', at)])[0].status).toBe('disputed')
  })
  it('ignores a confirmation on a pair that already agrees', () => {
    const games = reconcileGames([match('A', 'B', 'a', { confirmed_at: '2026-09-15T00:00:00Z' }), match('B', 'A', 'b')])
    expect(games[0].status).toBe('agreed')
  })
  it('counts a settled game toward the minimum, and a disputed one as waiting', () => {
    const disputed = [match('A', 'B', 'a'), match('B', 'A', 'a')]
    const settled = [match('A', 'B', 'a', { session_id: 's2', confirmed_at: '2026-09-15T00:00:00Z' }), match('B', 'A', 'a', { session_id: 's2' })]
    expect(gamesBySport([...disputed, ...settled], 'A').get('Squash')).toEqual({ games: 1, agreed: 1 })
    expect(disputedBySport([...disputed, ...settled], 'A').get('Squash')).toBe(1)
    expect(disputedBySport([...disputed, ...settled], 'Z').size).toBe(0)
  })
  it('agrees exactly on a win against a loss, or a draw against a draw', () => {
    const outcomes = ['a', 'b', 'draw'] as const
    const agreeing = outcomes.flatMap(x => outcomes.filter(y => agrees({ outcome: x }, { outcome: y })).map(y => `${x}/${y}`))
    expect(agreeing.sort()).toEqual(['a/b', 'b/a', 'draw/draw'])
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
  it('reaches the minimum at one real game', () => {
    expect(meetsGameMinimum(gamesBySport([match('A', 'B', 'a')], 'A').get('Squash')!.games)).toBe(true)
  })
  it('gives nothing to a player who played none', () => {
    expect(gamesBySport([match('A', 'B', 'a')], 'Z').size).toBe(0)
  })
})

// ── A game against the kaiwhakawā in a training session ─────────────────────
// 20261026220347: one record, no session, stamped confirmed by the kaiwhakawā
// who played it. It counts as agreed; without the stamp it counts for nothing.
describe('a training game against the kaiwhakawā', () => {
  const training = (outcome: MatchRow['outcome'], extra: Partial<MatchRow> = {}) =>
    match('P', 'K', outcome, { session_id: null, confirmed_at: '2026-10-27T05:00:00Z', ...extra })

  it('is one agreed game', () => {
    const [g] = reconcileGames([training('a')])
    expect(g.status).toBe('agreed')
    expect(g.sides).toEqual({ a: ['P'], b: ['K'] })
    expect(gamesBySport([training('a')], 'K').get('Squash')).toEqual({ games: 1, agreed: 1 })
  })

  it('counts for nothing without the kaiwhakawā stamp', () => {
    expect(reconcileGames([training('a', { confirmed_at: null })])[0].status).toBe('unconfirmed')
  })

  it('never pairs two training games, even ones that look like two sides of one', () => {
    const games = reconcileGames([training('a'), match('K', 'P', 'b', { session_id: null, confirmed_at: '2026-10-27T05:00:00Z' })])
    expect(games).toHaveLength(2)
  })

  it('leaves a lone confirmed record at an official game unconfirmed, as before', () => {
    expect(reconcileGames([match('A', 'B', 'a', { confirmed_at: '2026-10-27T05:00:00Z' })])[0].status).toBe('unconfirmed')
  })
})

describe('a plain result backs the other side\'s record (corroborate, 28 Oct 2026)', () => {
  // The 22 Oct 2026 Teqball game: W named both opponents; L1 and L2 each
  // logged a plain Loss without naming W.
  const claim = (id: string, opp: string, outcome: MatchRow['outcome'] = 'a', session_id = 'g22'): MatchRow => ({
    id, session_id, event_name: 'Teqball', outcome, created_at: `2026-10-22T03:54:${id.slice(-1)}0Z`,
    players: [{ player_id: 'W', side: 'a' }, { player_id: opp, side: 'b' }],
  })
  const plain = (id: string, player_id: string, result_type: PlainGameResult['result_type'], session_id = 'g22'): PlainGameResult => ({
    id, player_id, session_id, event_name: 'Teqball', result_type, created_at: '2026-10-22T03:50:00Z',
  })

  it('makes the 22 Oct Teqball games agreed, so all three are rated', () => {
    const ms = corroborate([claim('m1', 'L1'), claim('m2', 'L2')], [plain('r1', 'L1', 'loss'), plain('r2', 'L2', 'loss')])
    expect(reconcileGames(ms).map(g => g.status)).toEqual(['agreed', 'agreed'])
    const rated = rateGames(ms).get('Teqball')!
    expect(rated.get('W')!.games).toBe(2)
    expect(rated.get('L1')!.games).toBe(1)
    expect(rated.get('L2')!.games).toBe(1)
  })

  it('needs the plain result to say the same thing', () => {
    // L1 says they WON: that is a disagreement, not backing.
    const ms = corroborate([claim('m1', 'L1')], [plain('r1', 'L1', 'win')])
    expect(reconcileGames(ms).map(g => g.status)).toEqual(['unconfirmed'])
    // A draw backs a draw.
    const d = corroborate([claim('m1', 'L1', 'draw')], [plain('r1', 'L1', 'draw')])
    expect(reconcileGames(d).map(g => g.status)).toEqual(['agreed'])
  })

  it('needs the same game and sport, and backs one record per result', () => {
    expect(reconcileGames(corroborate([claim('m1', 'L1')], [plain('r1', 'L1', 'loss', 'other')]))[0].status).toBe('unconfirmed')
    expect(reconcileGames(corroborate([claim('m1', 'L1')], [{ ...plain('r1', 'L1', 'loss'), event_name: 'Tennis' }]))[0].status).toBe('unconfirmed')
    // One logged loss cannot confirm two claimed wins over the same player.
    const two = reconcileGames(corroborate([claim('m1', 'L1'), claim('m2', 'L1')], [plain('r1', 'L1', 'loss')]))
    expect(two.map(g => g.status).sort()).toEqual(['agreed', 'unconfirmed'])
  })

  it('leaves a game both sides named, and a training game, alone', () => {
    const named: MatchRow = { ...claim('m9', 'L1'), id: 'm9r', outcome: 'b', players: [{ player_id: 'L1', side: 'a' }, { player_id: 'W', side: 'b' }] }
    const ms = corroborate([claim('m1', 'L1'), named], [plain('r1', 'L1', 'loss')])
    expect(ms).toHaveLength(2)
    const training: MatchRow = { ...claim('m1', 'L1'), session_id: null }
    expect(corroborate([training], [plain('r1', 'L1', 'loss')])).toHaveLength(1)
  })
})
