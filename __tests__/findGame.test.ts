// ── Find a game (multi-location step 10) ────────────────────────────────────
// What this pins:
//   1. Listed, active, upcoming games only; a one-off within four weeks.
//   2. Soonest first; nearest first after Near me, unpinned sites last.
//   3. Status of the next date from its notices.
//   4. The migration: anon reads listed games and their notices only; leads
//      are for signed-in players, ids only.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { findCards, mapLink, nextListedGame, statusLabel } from '@/lib/findGame'
import type { GameNotice, Site, WeeklyGame } from '@/lib/weeklyGames'

// Tuesday 24 Nov 2026, 10am NZDT.
const now = new Date('2026-11-24T10:00:00+13:00')
const hq: Site = { id: 'hq', name: 'AllSport HQ', address: '26 Carbine Place, Sockburn', map_url: null, is_active: true, lat: -43.535, lng: 172.555 }
const park: Site = { id: 'park', name: 'Hagley Park', address: null, map_url: null, is_active: true, lat: -43.53, lng: 172.62 }
const school: Site = { id: 'school', name: 'A school', address: null, map_url: null, is_active: true }
const g = (over: Partial<WeeklyGame>): WeeklyGame => ({
  id: Math.random().toString(36), site_id: 'hq', dow: 2, start_time: '16:30:00', is_active: true, listed: true, ...over,
})

describe('which games show', () => {
  it('leaves out unlisted, inactive, finished and far-off one-offs', () => {
    const cards = findCards({
      games: [
        g({ id: 'tue' }),
        g({ id: 'unlisted', site_id: 'school', listed: false }),
        g({ id: 'off', is_active: false }),
        g({ id: 'past', one_off_date: '2026-11-20', dow: 5 }),
        g({ id: 'soon', one_off_date: '2026-12-12', dow: 6, start_time: '09:00:00', site_id: 'park' }),
        g({ id: 'far', one_off_date: '2027-01-30', dow: 6 }),
      ],
      sites: [hq, park, school], notices: [], now,
    })
    expect(cards.map(c => c.game.id)).toEqual(['tue', 'soon'])
  })

  it('shows today\'s game until it ends, then next week\'s', () => {
    const after = new Date('2026-11-24T18:15:00+13:00')
    expect(findCards({ games: [g({ id: 'tue' })], sites: [hq], notices: [], now })[0].date).toBe('2026-11-24')
    expect(findCards({ games: [g({ id: 'tue' })], sites: [hq], notices: [], now: after })[0].date).toBe('2026-12-01')
  })
})

describe('order', () => {
  const games = [
    g({ id: 'sat', dow: 6, start_time: '09:00:00' }),
    g({ id: 'thu', dow: 4, site_id: 'park' }),
    g({ id: 'tue', site_id: 'school' }),
  ]

  it('is soonest first', () => {
    expect(findCards({ games, sites: [hq, park, school], notices: [], now }).map(c => c.game.id)).toEqual(['tue', 'thu', 'sat'])
  })

  it('is nearest first after Near me, unpinned sites last', () => {
    const nearPark = { lat: -43.531, lng: 172.619 }
    const cards = findCards({ games, sites: [hq, park, school], notices: [], now, here: nearPark })
    expect(cards.map(c => c.game.id)).toEqual(['thu', 'sat', 'tue'])
    expect(cards[0].metres).toBeLessThan(200)
    expect(cards[2].metres).toBeNull()
  })
})

describe('status', () => {
  const n = (over: Partial<GameNotice>): GameNotice => ({
    id: Math.random().toString(36), weekly_game_id: 'tue', game_date: '2026-11-24', kind: 'message', message: null,
    created_at: '2026-11-24T08:00:00Z', ...over,
  })

  it('reads On, Cancelled or Moved for the next date', () => {
    const one = (notices: GameNotice[]) => findCards({ games: [g({ id: 'tue' })], sites: [hq], notices, now })[0].status
    expect(statusLabel(one([]))).toBe('On')
    expect(statusLabel(one([n({ kind: 'cancelled', message: 'Rain' })]))).toBe('Cancelled')
    expect(statusLabel(one([n({ kind: 'moved', message: 'Hagley Park' })]))).toBe('Moved: Hagley Park')
  })

  it('skips a cancelled game for the homepage line', () => {
    const cards = findCards({
      games: [g({ id: 'tue' }), g({ id: 'thu', dow: 4 })], sites: [hq],
      notices: [n({ kind: 'cancelled' })], now,
    })
    expect(nextListedGame(cards)?.game.id).toBe('thu')
  })

  it('links a map from the link, else the pin, else the address', () => {
    expect(mapLink({ ...hq, map_url: 'https://maps.example/x' })).toBe('https://maps.example/x')
    expect(mapLink(hq)).toContain('-43.535,172.555')
    expect(mapLink({ ...school, address: '1 Main St' })).toContain('1%20Main%20St')
    expect(mapLink(school)).toBeNull()
  })
})

describe('find a game migration', () => {
  const sql = readFileSync('supabase/migrations/20261123234843_find_a_game.sql', 'utf8')

  it('lets a logged-out visitor read listed games and their notices only', () => {
    expect(sql).toMatch(/CREATE POLICY weekly_games_read_listed ON public\.weekly_games FOR SELECT TO anon USING \(listed\);/)
    expect(sql).toMatch(/CREATE POLICY game_notices_read_listed ON public\.game_notices FOR SELECT TO anon\s+USING \(EXISTS[^;]*g\.listed\)\);/)
    expect(sql).not.toMatch(/TO anon(, authenticated)? USING \(true\)/)
  })

  it('gives leads to signed-in players only, as ids', () => {
    expect(sql).toMatch(/RETURNS TABLE \(weekly_game_id uuid, game_date date, lead_id uuid\)/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.game_leads\(uuid\[\], date\[\]\) FROM PUBLIC, anon;/)
  })
})
