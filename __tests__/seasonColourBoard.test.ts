import { describe, it, expect } from 'vitest'
import { seasonColourBoard, type SeasonGame, type GameColourRow } from '@/lib/seasonColourBoard'

const games: SeasonGame[] = [
  { id: 'g1', started_at: '2026-11-03T03:30:00Z', session_date: '2026-11-03' },
  { id: 'g2', started_at: '2026-11-10T03:30:00Z', session_date: '2026-11-10' },
]
const players = new Map([
  ['a', { name: 'Aroha', division: "Women's" }],
  ['b', { name: 'Bryn', division: "Men's" }],
  ['c', { name: 'Cam', division: 'Juniors' }],
])
const row = (player_id: string, session_id: string, colour_total: number): GameColourRow => ({ player_id, session_id, colour_total })

const none = () => undefined
const colour = (overall: number, colourSum = overall * 10, domainsHeld = 10) => ({ overall, colourSum, domainsHeld })

describe('seasonColourBoard', () => {
  it('shows the season colour score, games, average and best', () => {
    const board = seasonColourBoard(games, [row('a', 'g1', 50), row('a', 'g2', 55.5), row('b', 'g1', 70)], players, none)
    expect(board.map(r => [r.name, r.total, r.games, r.average, r.best])).toEqual([
      ['Aroha', 105.5, 2, 52.8, 55.5],
      ['Bryn', 70, 1, 70, 70],
    ])
  })

  it('ranks on overall colour first, the way HOME shows it', () => {
    const colours = new Map([['a', colour(3)], ['b', colour(5)], ['c', colour(4)]])
    const board = seasonColourBoard(games, [row('a', 'g1', 100), row('b', 'g1', 10), row('c', 'g1', 50)], players, id => colours.get(id))
    expect(board.map(r => [r.name, r.overall, r.rank])).toEqual([['Bryn', 5, 1], ['Cam', 4, 2], ['Aroha', 3, 3]])
  })

  it('breaks a colour tie on the domain sum, then domains held, then colour score', () => {
    const colours = new Map([['a', colour(4, 45, 10)], ['b', colour(4, 47, 10)], ['c', colour(4, 45, 9)]])
    const board = seasonColourBoard(games, [row('a', 'g1', 20), row('b', 'g1', 10), row('c', 'g1', 90)], players, id => colours.get(id))
    expect(board.map(r => r.name)).toEqual(['Bryn', 'Aroha', 'Cam'])
    const same = seasonColourBoard(games, [row('a', 'g1', 20), row('c', 'g1', 90)], players, () => colour(4))
    expect(same.map(r => [r.name, r.rank])).toEqual([['Cam', 1], ['Aroha', 2]])
  })

  it('shares a place when everything ties, and a player with no colour is Mā', () => {
    const board = seasonColourBoard(games, [row('b', 'g1', 60), row('c', 'g1', 60)], players, none)
    expect(board.map(r => [r.name, r.rank, r.overall])).toEqual([['Bryn', 1, 0], ['Cam', 1, 0]])
  })

  it('sums tenths without float drift', () => {
    const board = seasonColourBoard(games, [row('a', 'g1', 4.5), row('a', 'g2', 3.1)], players, none)
    expect(board[0].total).toBe(7.6)
  })

  it('lists only players with a game this season on the board', () => {
    const board = seasonColourBoard(games, [row('a', 'other', 99), row('z', 'g1', 99), row('b', 'g1', 10)], players, () => colour(6))
    expect(board.map(r => [r.name, r.total])).toEqual([['Bryn', 10]])
  })
})
