// @vitest-environment jsdom
//
// ── YOUR COLOURS (HOME) and the public colours guide ─────────────────────────
// Since the home colours rework, GradesCard is the ONLY place a player's own
// colour detail lives, and it is behind a login. These pin what it says:
//   1. The overall colour is the AVERAGE of the ten (Mā when nothing is held).
//   2. A domain row expands to Event · Your best · Colour.
//   3. Each domain row says how many steps its next colour is, and the overall
//      says when the games cap is holding it back.
//   4. The provisional note and the bodyweight prompt appear only when due.
// And that /grades is a plain server component carrying the whole ladder.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react'
import GradesCard from '@/components/GradesCard'
import ColoursGuide from '@/app/grades/page'
import { computePlayerGrades, colourGates, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import { GRADES } from '@/lib/grading'
import { getEventByName } from '@/lib/eventData'
import type { GradeState } from '@/lib/loadGrades'

afterEach(cleanup)

const master: GradePlayer = { division: 'Masters Men', ageYears: 45, gender: 'Male' }
const row = (event_name: string, raw_score: number, extra: Partial<GradeResultRow> = {}): GradeResultRow =>
  ({ event_name, raw_score, weight_kg: null, difficulty_tier: null, ...extra })

function state(opts: {
  held?: Map<number, number>
  results?: GradeResultRow[]
  schemaReady?: boolean
  hasBand?: boolean
  games?: number
} = {}): GradeState {
  const games = opts.games ?? 0
  const grades = computePlayerGrades({
    player: master, results: opts.results ?? [], ratings: new Map(), exemptions: new Set(), games,
  })
  const held = opts.held ?? new Map()
  return {
    grades, awards: [], held, exemptions: new Set(), hasBand: opts.hasBand ?? true,
    schemaReady: opts.schemaReady ?? true, games,
    gates: colourGates(grades.domains, held),
    workoutsReady: true, disputed: new Map(), complete: true,
  }
}

const pushupDomain = getEventByName('Pushup Contest')!.domainNumber
const domainName = getEventByName('Pushup Contest')!.domain

describe('GradesCard', () => {
  it('shows Mā overall and 0 of 10 for a player holding nothing', () => {
    render(<GradesCard state={state()} />)
    expect(screen.getByText('MĀ')).toBeTruthy()
    expect(screen.getByText(/0 of 10 hold a colour/)).toBeTruthy()
  })

  it('names the average of the ten domains, rounded down', () => {
    // 5 × 6 + 5 × 3 = 45 -> 4 (Kōwhai).
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 6 : 3]))
    render(<GradesCard state={state({ held, games: 100 })} />)
    expect(screen.getByText(GRADES[3].name.toUpperCase())).toBeTruthy()
    expect(screen.getByText(/10 of 10 hold a colour/)).toBeTruthy()
    expect(screen.queryByText(/Your domains average/)).toBeNull()
  })

  it('caps the overall by games, and says what the games would unlock', () => {
    // Kōwhai (4) on the domains, but 7 games only allows Karaka (3).
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, 4]))
    render(<GradesCard state={state({ held, games: 7 })} />)
    expect(screen.getByText(GRADES[2].name.toUpperCase())).toBeTruthy()
    expect(screen.getByText(/Your domains average Kōwhai\. Kōwhai needs 8 games, and you have played 7/)).toBeTruthy()
  })

  it('expands a domain row to Event · Your best · Colour with the tier name', () => {
    const results = [row('Pushup Contest', 30001, { difficulty_tier: '1 Arm Pushup' })]
    render(<GradesCard state={state({ results })} />)
    const btn = screen.getAllByRole('button').find(b => b.textContent?.includes(domainName))!
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Your best')).toBeNull()
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Event')).toBeTruthy()
    expect(screen.getByText('Your best')).toBeTruthy()
    expect(screen.getByText('Colour')).toBeTruthy()
    expect(screen.getByText('1 Arm Pushup · 1 reps')).toBeTruthy()
    // An unplayed event in the same domain says so rather than showing Mā.
    expect(screen.getAllByText('Not played').length).toBeGreaterThan(0)
    fireEvent.click(btn)
    expect(btn.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Your best')).toBeNull()
  })

  it('says it is provisional before grading is live', () => {
    const results = [row('Pushup Contest', 30001, { difficulty_tier: '1 Arm Pushup' })]
    render(<GradesCard state={state({ results, schemaReady: false })} />)
    expect(screen.getByText(/Provisional: worked out from your scores/)).toBeTruthy()
  })

  it('shows the COMPUTED colours before grading is live, and the conferred ones after', () => {
    // Every domain computes to Kākāriki (5) and nothing has been conferred.
    const pre = state({ schemaReady: false, games: 100 })
    pre.grades.domains.forEach(d => { d.rung = 5 })
    render(<GradesCard state={pre} />)
    expect(screen.getByText(GRADES[4].name.toUpperCase())).toBeTruthy()
    cleanup()
    const live = state({ schemaReady: true, games: 100 })
    live.grades.domains.forEach(d => { d.rung = 5 })
    render(<GradesCard state={live} />)
    expect(screen.getByText('MĀ')).toBeTruthy()
  })

  it('has no provisional note once grading is live', () => {
    render(<GradesCard state={state()} />)
    expect(screen.queryByText(/Provisional/)).toBeNull()
  })

  it('says how many steps the next colour is, and never mentions units', () => {
    const { unmount } = render(<GradesCard state={state()} />)
    expect(screen.queryByText(/units/)).toBeNull()
    // Nothing played: Kiwikiwi is six steps away in every six-slot domain.
    expect(screen.getAllByText(/Next Kiwikiwi:/).length).toBe(10)
    expect(screen.getAllByText(/6 steps to go · 0 of 6 events hold a colour/).length).toBeGreaterThan(0)
    unmount()
    // Held above the scores: the row aims at the colour above the one held.
    render(<GradesCard state={state({ held: new Map([[pushupDomain, 2]]) })} />)
    expect(screen.getByText(/Next Karaka:/)).toBeTruthy()
  })

  it('asks for a bodyweight only when askBand is set and none is declared', () => {
    const { unmount } = render(<GradesCard state={state({ hasBand: false })} askBand />)
    expect(screen.getByText(/Lifts and loaded carries need your bodyweight/)).toBeTruthy()
    unmount()
    const r2 = render(<GradesCard state={state({ hasBand: true })} askBand />)
    expect(within(r2.container).queryByText(/need your bodyweight/)).toBeNull()
    r2.unmount()
    render(<GradesCard state={state({ hasBand: false })} />)
    expect(screen.queryByText(/need your bodyweight/)).toBeNull()
  })
})

describe('the colours guide (/grades)', () => {
  it('renders as a plain server component with the headline and all twelve colours', () => {
    const { container } = render(ColoursGuide())
    expect(container.textContent).toContain('MĀ TO TANIWHA')
    for (const g of GRADES) expect(container.textContent).toContain(g.name)
    expect(container.textContent).toContain('the average of your best 6 events')
    expect(container.textContent).not.toMatch(/training units|What is a unit/i)
  })
})
