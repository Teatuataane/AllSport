// ── The 6 Oct 2026 roster: 144 events ────────────────────────────────────────
// 20261005222950 moves Cornhole's four old win/draw/loss results onto its new
// Game rung by a hard-coded band (30000). If the ladder ever changes length,
// that number is wrong and old games would land on a drill rung. This pins it.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EVENTS, getEventBySlug, DT_CAP } from '@/lib/eventData'

const SQL = readFileSync('supabase/migrations/20261005222950_roster_144.sql', 'utf8')

describe('the 6 Oct 2026 roster migration', () => {
  it('moves Cornhole games onto the band of its Game rung', () => {
    const tiers = getEventBySlug('cornhole')!.difficultyTiers!
    const game = tiers.findIndex(t => t.scoring === 'sport')
    expect(tiers[game].name).toBe('Game')
    expect(SQL).toContain(`SET raw_score = ${game * DT_CAP} + r.raw_score, difficulty_tier = 'Game'`)
  })

  it('lists every plain win/draw/loss event as a pure contest in both functions', () => {
    const want = EVENTS.filter(e => e.inputMode === 'sport').map(e => e.slug).sort()
    const lists = [...SQL.matchAll(/event_slug IN \(([^)]*)\)/g)].map(m => [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]).sort())
    expect(lists).toHaveLength(2)
    for (const l of lists) expect(l).toEqual(want)
  })

  it('brings back Triple Jump on the encoding its old results use (cm, furthest wins)', () => {
    expect(getEventBySlug('triple-jump')!.inputMode).toBe('distance')
  })

  it('moves Wrestling to Power and Australian Football to Speed', () => {
    expect(getEventBySlug('wrestling')!.domainNumber).toBe(3)
    expect(getEventBySlug('australian-football')!.domainNumber).toBe(4)
    expect(SQL).toContain("('Wrestling', 3, 'wrestling')")
    expect(SQL).toContain("('Australian Football', 4, 'australian-football')")
  })
})
