// @vitest-environment jsdom
//
// ── Find a game: the cards (multi-location step 10) ─────────────────────────
// What this pins:
//   1. A logged-out visitor sees the game and "Register to play", never the
//      Kaiārahi or the count (Tāne, 24 Nov 2026: signed-in only).
//   2. A signed-in player sees both, joins a weekly game, says Coming to a one-off.
//   3. Near me is a button; the page never asks for location by itself.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { FindAGameView } from '@/components/FindAGame'
import { findCards } from '@/lib/findGame'
import type { Site, WeeklyGame } from '@/lib/weeklyGames'

afterEach(cleanup)

const now = new Date('2026-11-24T10:00:00+13:00')
const hq: Site = { id: 'hq', name: 'AllSport HQ', address: '26 Carbine Place', map_url: null, is_active: true, lat: -43.5, lng: 172.5 }
const tue: WeeklyGame = { id: 'tue', site_id: 'hq', dow: 2, start_time: '16:30:00', is_active: true, listed: true }
const popup: WeeklyGame = { id: 'pop', site_id: 'hq', dow: 6, start_time: '09:00:00', is_active: true, listed: true, one_off_date: '2026-11-28' }
const cards = findCards({ games: [tue, popup], sites: [hq], notices: [], now })
const counts = new Map([['tue|2026-11-24', { coming: 6, notComing: 1, unanswered: 3 }]])
const leads = new Map([['tue|2026-11-24', { id: 'k', name: 'Aroha' }]])

const props = (over: Partial<Parameters<typeof FindAGameView>[0]> = {}) => ({
  cards, signedIn: false, mine: new Set<string>(), coming: new Set<string>(), counts, leads,
  near: 'off' as const, busy: null, error: '', onNear: vi.fn(), onJoin: vi.fn(), onComing: vi.fn(), now, ...over,
})

describe('FindAGameView', () => {
  it('shows a logged-out visitor the games without the Kaiārahi or count', () => {
    render(<FindAGameView {...props()} />)
    expect(screen.getAllByText('AllSport HQ').length).toBe(2)
    expect(screen.getByText(/every Tuesday/)).toBeTruthy()
    expect(screen.queryByText(/Aroha/)).toBeNull()
    expect(screen.queryByText(/6 coming/)).toBeNull()
    expect(screen.getAllByRole('link', { name: 'Register to play' }).length).toBe(2)
  })

  it('shows a signed-in player the Kaiārahi and count, and joins', () => {
    const p = props({ signedIn: true })
    render(<FindAGameView {...p} />)
    expect(screen.getByText('Kaiārahi: Aroha')).toBeTruthy()
    expect(screen.getByText("6 coming · 1 not · 3 haven't said")).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Join this game' }))
    expect(p.onJoin).toHaveBeenCalledWith('tue')
    fireEvent.click(screen.getByRole('button', { name: "I'm coming" }))
    expect(p.onComing).toHaveBeenCalledWith('pop', '2026-11-28', true)
  })

  it('says Registered for a joined game', () => {
    render(<FindAGameView {...props({ signedIn: true, mine: new Set(['tue']) })} />)
    expect(screen.getByText('REGISTERED')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Join this game' })).toBeNull()
  })

  it('asks for location only from the Near me button', () => {
    const p = props()
    render(<FindAGameView {...p} />)
    expect(screen.getByText('Soonest first.')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Near me' }))
    expect(p.onNear).toHaveBeenCalled()
  })
})
