import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { liveOnly, orderLiveGames, navGame, gameAlreadyLive, type LiveGameRow } from '@/lib/liveGames'

const NOW = Date.parse('2026-11-24T03:00:00Z')
const mins = (m: number) => new Date(NOW - m * 60_000).toISOString()
const row = (id: string, over: Partial<LiveGameRow> = {}): LiveGameRow =>
  ({ id, started_at: mins(10), is_active: true, location: id, weekly_game_id: `g-${id}`, judge_id: null, ...over })

describe('liveOnly', () => {
  it('drops closed games and games past their 100 minutes', () => {
    const rows = [row('a'), row('b', { is_active: false }), row('c', { started_at: mins(101) })]
    expect(liveOnly(rows, NOW).map(r => r.id)).toEqual(['a'])
  })
})

describe('orderLiveGames (Tāne, 24 Nov 2026: all, theirs first)', () => {
  const hq = row('hq', { started_at: mins(30) })
  const burnside = row('burnside', { started_at: mins(5) })
  it('puts the game the player is registered to first', () => {
    expect(orderLiveGames([hq, burnside], new Set(['g-burnside'])).map(r => r.id)).toEqual(['burnside', 'hq'])
  })
  it('otherwise orders by start, earliest first', () => {
    expect(orderLiveGames([burnside, hq], new Set()).map(r => r.id)).toEqual(['hq', 'burnside'])
  })
})

describe('navGame', () => {
  const hq = row('hq')
  const burnside = row('burnside', { judge_id: 'kaiako' })
  it('opens the game a Kaiārahi is running, whatever else is live', () => {
    expect(navGame([hq, burnside], { id: 'kaiako', registered: new Set(['g-hq']) })).toBe('burnside')
  })
  it('opens the only live game', () => {
    expect(navGame([hq], { id: 'p', registered: new Set() })).toBe('hq')
  })
  it('opens the player own game when several are live', () => {
    expect(navGame([hq, burnside], { id: 'p', registered: new Set(['g-hq']) })).toBe('hq')
  })
  it('opens none when several are live and none is clearly theirs', () => {
    expect(navGame([hq, burnside], { id: 'p', registered: new Set() })).toBeNull()
    expect(navGame([hq, burnside], { id: 'p', registered: new Set(['g-hq', 'g-burnside']) })).toBeNull()
  })
  it('opens none when nothing is live', () => {
    expect(navGame([], { id: 'p', registered: new Set() })).toBeNull()
  })
})

describe('gameAlreadyLive', () => {
  it('refuses a second session of one game, not of another', () => {
    expect(gameAlreadyLive([row('hq')], 'g-hq')).toBe(true)
    expect(gameAlreadyLive([row('hq')], 'g-burnside')).toBe(false)
    expect(gameAlreadyLive([row('hq')], null)).toBe(false)
  })
})

describe('no screen assumes one live game', () => {
  const files = ['app/dashboard/page.tsx', 'lib/useNavState.ts', 'app/leaderboard/page.tsx', 'app/scoring/page.tsx']
  it.each(files)('%s reads every live session, not one', f => {
    const src = readFileSync(f, 'utf8')
    // A read of active sessions that expects a single row.
    expect(src).not.toMatch(/\.eq\('is_active', true\)\s*(\.limit\(1\))?\s*\.maybeSingle\(\)/)
    expect(src).not.toMatch(/A session is already active/)
  })
})
