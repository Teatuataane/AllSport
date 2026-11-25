// ── What success means (multi-location step 13) ─────────────────────────────
// What this pins:
//   1. Terms are the Ministry's, holidays counting toward the next term.
//   2. Bands: Sport NZ ages, NZDep quintiles, ethnicity by total response,
//      and 1 to 4 shown as "fewer than 5".
//   3. Each measure on a small made-up history: turn-up and trend, regulars,
//      comebacks, show-up, this term's held and cancelled, new players, reach.
//   4. Who sees which games: a head all, anyone else the games they lead.

import { describe, it, expect } from 'vitest'
import {
  ageBand, ageOn, attendance, ethnicGroups, gamesFor, newThisTerm, percent, quintile, reach, scorecard, shown,
  termOf, type Booking, type Person, type Played, type ScoredSession,
} from '@/lib/successMeasures'

describe('terms', () => {
  it('end on the Ministry\'s dates, holidays joining the next term', () => {
    expect(termOf('2026-11-26')).toEqual({ year: 2026, term: 4, start: '2026-09-26', end: '2026-12-18' })
    expect(termOf('2026-12-25')).toEqual({ year: 2027, term: 1, start: '2026-12-19', end: '2027-04-09' })
    expect(termOf('2027-02-08').term).toBe(1)
    expect(termOf('2027-04-20')).toEqual({ year: 2027, term: 2, start: '2027-04-10', end: '2027-07-02' })
  })

  it('fall back to quarters for a year not listed yet', () => {
    expect(termOf('2031-05-01')).toEqual({ year: 2031, term: 2, start: '2031-04-01', end: '2031-06-30' })
  })
})

describe('bands', () => {
  it('ages Sport NZ style', () => {
    expect([4, 5, 11, 12, 17, 18, 24, 25, 44, 45, 64, 65].map(ageBand)).toEqual(
      ['Unknown', '5-11', '5-11', '12-17', '12-17', '18-24', '18-24', '25-44', '25-44', '45-64', '45-64', '65+'])
    expect(ageOn('2010-12-01', '2026-11-26')).toBe(15)
    expect(ageOn('2010-11-26', '2026-11-26')).toBe(16)
  })

  it('deprivation in quintiles, Q5 the most deprived', () => {
    expect([1, 2, 3, 6, 9, 10].map(quintile)).toEqual(['Q1', 'Q1', 'Q2', 'Q3', 'Q5', 'Q5'])
    expect(quintile(null)).toBe('Unknown')
  })

  it('ethnicity by total response', () => {
    expect(ethnicGroups(['maori', 'nz_european', 'samoan', 'tongan'])).toEqual(['European', 'Māori', 'Pacific'])
    expect(ethnicGroups([])).toEqual(['Not stated'])
    expect(ethnicGroups(['prefer_not'])).toEqual(['Not stated'])
  })

  it('hides 1 to 4', () => {
    expect([0, 1, 4, 5].map(shown)).toEqual(['0', 'fewer than 5', 'fewer than 5', '5'])
    expect(percent({ of: 3, yes: 2 })).toBe('67%')
    expect(percent({ of: 0, yes: 0 })).toBe('–')
  })
})

// A Tuesday game at HQ and a Saturday game at a park, judge K. Today Thu 26 Nov 2026.
const today = '2026-11-26'
const s = (id: string, game: string, date: string, voided = false): ScoredSession =>
  ({ id, weekly_game_id: game, session_date: date, judge_id: 'K', voided_at: voided ? 'x' : null })
const sessions: ScoredSession[] = [
  s('t1', 'tue', '2026-09-01'), s('t2', 'tue', '2026-10-06'), s('t3', 'tue', '2026-10-13'),
  s('t4', 'tue', '2026-10-20'), s('t5', 'tue', '2026-11-03'), s('t6', 'tue', '2026-11-10'),
  s('t7', 'tue', '2026-11-17'), s('t8', 'tue', '2026-11-24'), s('tv', 'tue', '2026-11-25', true),
  s('s1', 'sat', '2026-11-21'),
]
const p = (session: string, ...players: string[]): Played[] => players.map(player_id => ({ session_id: session, player_id }))
const played: Played[] = [
  ...p('t1', 'A', 'B'),
  ...p('t2', 'A', 'B', 'C', 'K'), // the Kaiārahi is not counted
  ...p('t3', 'A', 'C'), ...p('t4', 'A', 'C'), ...p('t5', 'A', 'D'),
  ...p('t6', 'A', 'B', 'D'), ...p('t7', 'A', 'E'), ...p('t8', 'A', 'B', 'D', 'E'),
  ...p('tv', 'A', 'B', 'C', 'D', 'E', 'F'), // voided: never counts
  ...p('s1', 'D', 'F'),
]
const att = attendance(sessions, played)

describe('attendance', () => {
  it('leaves out the Kaiārahi and voided games', () => {
    expect(att.players.get('t2')?.size).toBe(3)
    expect(att.players.has('tv')).toBe(false)
    expect(att.first.get('F')).toEqual({ date: '2026-11-21', gameId: 'sat' })
  })
})

describe('the scorecard', () => {
  const bookings: Booking[] = [
    { weekly_game_id: 'tue', game_date: '2026-11-24', player_id: 'A', answer: 'yes' },
    { weekly_game_id: 'tue', game_date: '2026-11-24', player_id: 'C', answer: 'yes' }, // said yes, did not play
    { weekly_game_id: 'tue', game_date: '2026-11-24', player_id: 'B', answer: 'no' },
    { weekly_game_id: 'tue', game_date: '2026-12-01', player_id: 'A', answer: 'yes' }, // not played yet
  ]
  const cancellations = [
    { weekly_game_id: 'tue', game_date: '2026-10-27', kind: 'cancelled', reason: 'weather' },
    { weekly_game_id: 'tue', game_date: '2026-10-27', kind: 'cancelled', reason: 'weather' }, // same date twice
    { weekly_game_id: 'sat', game_date: '2026-11-14', kind: 'cancelled', reason: 'venue' },
    { weekly_game_id: 'tue', game_date: '2026-11-03', kind: 'moved', reason: 'venue' },
  ]
  const tue = scorecard({ gameId: 'tue', att, bookings, cancellations, today })

  it('averages turn-up over eight weeks, with a weekly trend', () => {
    // t2..t8 fall in the last 8 weeks (from 2 Oct): 3,2,2,2,3,2,4 = 18 over 7.
    expect(tue.sessions8).toBe(7)
    expect(tue.turnUp).toBeCloseTo(18 / 7)
    expect(tue.trend).toHaveLength(8)
    expect(tue.trend[7]).toBe(4)
    expect(tue.trend.filter(t => t === null)).toHaveLength(1) // the week of 27 Oct, cancelled
  })

  it('counts regulars over the last six games', () => {
    // t3..t8: A 6, C 2, D 3, B 2, E 2.
    expect(tue.regulars).toBe(2)
  })

  it('counts comebacks among first-timers whose six weeks have passed', () => {
    // Started at Tuesday by 15 Oct: A and B on 1 Sep, C on 6 Oct. Within six weeks
    // A came back 6 and 13 Oct (yes), B only 6 Oct (no), C 13 and 20 Oct (yes).
    // D and E started 3 and 17 Nov: their six weeks have not run yet.
    expect(tue.comeback).toEqual({ of: 3, yes: 2 })
  })

  it('reads show-up from Coming answers on dates played', () => {
    expect(tue.showUp).toEqual({ of: 2, yes: 1 })
  })

  it('counts this term\'s games and cancellations by reason', () => {
    // Term 4 2026 from 26 Sep: t2..t8 held.
    expect(tue.held).toBe(7)
    expect(tue.cancelled).toEqual([{ reason: 'weather', count: 1 }])
    const all = scorecard({ gameId: null, att, bookings, cancellations, today })
    expect(all.held).toBe(8)
    expect(all.cancelled).toHaveLength(2)
  })

  it('counts new players this term at the game they started', () => {
    expect(newThisTerm(att, 'tue', today).sort()).toEqual(['C', 'D', 'E'])
    expect(newThisTerm(att, 'sat', today)).toEqual(['F'])
    expect(tue.newPlayers).toBe(3)
  })

  it('breaks reach down by age, sex, ethnicity and deprivation', () => {
    const people = new Map<string, Person>([
      ['C', { id: 'C', dob: '2012-03-01', gender: 'Female', ethnicity: ['maori', 'samoan'], decile: 10 }],
      ['D', { id: 'D', dob: '1990-01-01', gender: 'Male', ethnicity: ['nz_european'], decile: 3 }],
    ])
    const r = reach(att, 'tue', people, today)
    expect(r.total).toBe(3)
    expect(r.age.get('12-17')).toBe(1)
    expect(r.age.get('25-44')).toBe(1)
    expect(r.age.get('Unknown')).toBe(1)
    expect(r.ethnicity.get('Māori')).toBe(1)
    expect(r.ethnicity.get('Pacific')).toBe(1)
    expect(r.ethnicity.get('Not stated')).toBe(1)
    expect(r.deprivation.get('Q5')).toBe(1)
    expect(r.sex.get('Unknown')).toBe(1)
  })
})

describe('who sees which games', () => {
  const games = [{ id: 'tue', regular_kaiarahi_id: 'R' }, { id: 'sat', regular_kaiarahi_id: null }]
  it('a head sees all; anyone else their regular games and games they ran lately', () => {
    expect(gamesFor({ me: 'H', head: true, games, sessions, today })).toEqual(['tue', 'sat'])
    expect(gamesFor({ me: 'R', head: false, games, sessions, today })).toEqual(['tue'])
    expect(gamesFor({ me: 'K', head: false, games, sessions, today })).toEqual(['tue', 'sat'])
    expect(gamesFor({ me: 'X', head: false, games, sessions, today })).toEqual([])
  })
})
