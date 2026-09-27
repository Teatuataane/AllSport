// @vitest-environment jsdom
//
// ── YOUR COLOURS (HOME) and the public colours guide ─────────────────────────
// Since the home colours rework, GradesCard is the ONLY place a player's own
// colour detail lives, and it is behind a login. These pin what it says:
//   1. The overall colour is the AVERAGE of the ten (Mā when nothing is held).
//   2. A domain row expands to Event · Your best · Colour.
//   3. The overall carries a proud headline and a second line, and says when
//      the games cap is holding it back. Domain rows carry almost no text.
//   4. No provisional note and no separate bodyweight prompt: grading is live,
//      and a blocked lift says so on its own row (redesign, 2026-09-28).
// And that /grades is a plain server component carrying the whole ladder.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen, within } from '@testing-library/react'
import GradesCard from '@/components/GradesCard'
import ColoursGuide from '@/app/grades/page'
import { computePlayerGrades, colourGates, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import { GRADES, gradeForRung } from '@/lib/grading'
import { topSlotRungs, colourBlurb } from '@/lib/colourDisplay'
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
  it('shows Mā overall, what it means, and the ladder marked at colour 1 of 13', () => {
    render(<GradesCard state={state()} />)
    expect(screen.getByText('MĀ')).toBeTruthy()
    expect(screen.getByText(colourBlurb(0).line)).toBeTruthy()
    expect(screen.getByText('12 colours to climb')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Colour 1 of 13: Mā' })).toBeTruthy()
    // The old title and explainer are gone.
    expect(screen.queryByText(/Your colours/i)).toBeNull()
    expect(screen.queryByText(/the average of your best/i)).toBeNull()
  })

  it('names the average of the ten domains, rounded down', () => {
    // 5 × 6 + 5 × 3 = 45 -> 4 (Kōwhai).
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, i < 5 ? 6 : 3]))
    render(<GradesCard state={state({ held, games: 100 })} />)
    expect(screen.getByText(GRADES[3].name.toUpperCase())).toBeTruthy()
    expect(screen.getByText('Kōwhai earned. The work is showing.')).toBeTruthy()
    expect(screen.getByText('4 colours climbed')).toBeTruthy()
    expect(screen.queryByText(/unlocks at/)).toBeNull()
  })

  it('caps the overall by games, and says what the games would unlock', () => {
    // Kōwhai (4) on the domains, but 7 games only allows Karaka (3).
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, 4]))
    render(<GradesCard state={state({ held, games: 7 })} />)
    expect(screen.getByText(GRADES[2].name.toUpperCase())).toBeTruthy()
    expect(screen.getByText(/Kōwhai unlocks at 8 games · you've played 7/)).toBeTruthy()
  })

  it('says one game, not one games, when nobody has played', () => {
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, 2]))
    render(<GradesCard state={state({ held, games: 0 })} />)
    expect(screen.getByText(/Kiwikiwi unlocks at 1 game · you've played 0/)).toBeTruthy()
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

  it('never says it is provisional, even on a database without grading', () => {
    const results = [row('Pushup Contest', 30001, { difficulty_tier: '1 Arm Pushup' })]
    render(<GradesCard state={state({ results, schemaReady: false })} />)
    expect(screen.queryByText(/Provisional/)).toBeNull()
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

  it('keeps domain rows to a name and a colour, and never mentions units', () => {
    render(<GradesCard state={state({ held: new Map([[pushupDomain, 2]]) })} />)
    expect(screen.queryByText(/units/)).toBeNull()
    expect(screen.queryByText(/steps to go|Next /)).toBeNull()
    expect(screen.getByRole('button', { name: `${domainName}, Whero` })).toBeTruthy()
  })

  it('has no separate bodyweight note, and no links of its own', () => {
    render(<GradesCard state={state({ hasBand: false })} />)
    expect(screen.queryByText(/need your bodyweight/)).toBeNull()
    expect(screen.queryByText(/Colours guide|Log a workout/)).toBeNull()
  })

  it('names the best event with its colour when given one', () => {
    const slug = getEventByName('Pushup Contest')!.slug
    render(<GradesCard state={state()} bestEvent={{ slug, rung: 6 }} />)
    expect(screen.getByText('Pushup Contest')).toBeTruthy()
    expect(screen.getByText(/Best event/)).toBeTruthy()
  })
})

describe('GradesCard — the ladder and the domain rows', () => {
  /** The thirteen ladder circles, Mā first. */
  const ladderCircles = () => {
    const ladder = screen.getByRole('img', { name: /^Colour \d+ of 13/ })
    return Array.from(ladder.querySelectorAll<HTMLElement>('[data-rung]'))
      .map(c => c.querySelector<HTMLElement>('[data-colour]')!)
  }

  it('marks the current colour big, reached colours solid and the rest as rings', () => {
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, 3]))
    render(<GradesCard state={state({ held, games: 100 })} />)
    expect(screen.getByRole('img', { name: `Colour 4 of 13: ${GRADES[2].name}` })).toBeTruthy()
    const c = ladderCircles()
    expect(c.length).toBe(13)
    expect(c[3].style.width).toBe('24px')
    expect(c[2].style.width).toBe('15px')
    expect(c[0].dataset.colour).toBe('reached')
    expect(c[2].dataset.colour).toBe('reached')
    expect(c[4].dataset.colour).toBe('ahead')
    // A colour ahead is a ring in its OWN colour, not a dimmed grey.
    expect(c[4].style.border).toMatch(/2px solid (#F9E051|rgb\(249, 224, 81\))/i)
    // Mā is a solid white rung on the ladder, never the empty outline.
    expect(c[0].style.background).not.toBe('transparent')
    // Every circle is round.
    expect(c.every(x => x.style.borderRadius === '50%')).toBe(true)
  })

  it('draws Uenuku as the rainbow and Taniwha black with a white rim', () => {
    const held = new Map(Array.from({ length: 10 }, (_, i) => [i + 1, 12]))
    render(<GradesCard state={state({ held, games: 100 })} />)
    expect(screen.getByRole('img', { name: 'Colour 13 of 13: Taniwha' })).toBeTruthy()
    expect(screen.getByText('Taniwha. The top of AllSport.')).toBeTruthy()
    expect(screen.getByText('Top 1%')).toBeTruthy()
    const c = ladderCircles()
    expect(c[11].style.background).toContain('conic-gradient')
    expect(c[12].style.border).toMatch(/solid (#fff|rgb\(255, 255, 255\))/)
    expect(c.every(x => x.dataset.colour === 'reached')).toBe(true)
  })

  it('never paints a row, and puts a colour circle beside the colour name', () => {
    render(<GradesCard state={state({ held: new Map([[pushupDomain, 2]]) })} />)
    const btn = screen.getByRole('button', { name: `${domainName}, Whero` })
    expect(btn.parentElement!.style.border).toBe('')
    expect(btn.parentElement!.style.background).toBe('')
    const name = within(btn).getByText('Whero')
    const dot = name.querySelector<HTMLElement>('[data-colour="reached"]')!
    expect(dot.style.background).toBe('rgb(234, 71, 66)')
    const ma = screen.getAllByRole('button').find(b => b.getAttribute('aria-label')?.endsWith(', Mā'))!
    expect(within(ma).getByText('Mā').querySelector('[data-colour="empty"]')).toBeTruthy()
  })

  it('shows six circles per row, filled best first from the counted events', () => {
    const results = [row('Pushup Contest', 30001, { difficulty_tier: '1 Arm Pushup' })]
    const st = state({ results })
    const d = st.grades.domains.find(x => x.domainNumber === pushupDomain)!
    render(<GradesCard state={st} />)
    const btn = screen.getByRole('button', { name: new RegExp(`^${domainName},`) })
    const squares = btn.querySelector('[aria-hidden="true"]')!.children
    expect(squares.length).toBe(d.slots)
    const filled = Array.from(squares).filter(s => (s as HTMLElement).style.background !== 'transparent')
    expect(filled.length).toBe(d.counted.length)
    // Each square is the colour of its slot, best first.
    const rgb = (hex: string) => `rgb(${[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)).join(', ')})`
    topSlotRungs(d, st.grades.events).forEach((r, i) => {
      const bg = (squares[i] as HTMLElement).style.background
      if (r === 0) expect(bg).toBe('transparent')
      else expect(bg).toBe(rgb(gradeForRung(r).hex))
    })
  })

  it('says "Needs bodyweight" on the row instead of circles when a lift is blocked', () => {
    const st = state()
    st.grades.domains[0].blockedByBodyweight = true
    render(<GradesCard state={st} />)
    const btn = screen.getByRole('button', { name: /^Maximal Strength,/ })
    expect(within(btn).getByText('Needs bodyweight')).toBeTruthy()
    expect(btn.getAttribute('aria-label')).toMatch(/, needs bodyweight$/)
    expect(btn.querySelector('[aria-hidden="true"] > span')).toBeNull()
  })

  it('shows circles, not the bodyweight notice, on a row that already holds a colour', () => {
    const st = state({ held: new Map([[1, 2]]) })
    st.grades.domains[0].blockedByBodyweight = true
    render(<GradesCard state={st} />)
    const btn = screen.getByRole('button', { name: 'Maximal Strength, Whero' })
    expect(within(btn).queryByText('Needs bodyweight')).toBeNull()
  })

  it('says "Nothing to grade" on a domain with no gradeable event', () => {
    const st = state()
    st.grades.domains[1] = { ...st.grades.domains[1], slots: 0, counted: [] }
    render(<GradesCard state={st} />)
    const btn = screen.getByRole('button', { name: /, nothing to grade$/ })
    expect(within(btn).getByText('Nothing to grade')).toBeTruthy()
  })

  it('draws no circles for a domain with nothing gradeable', () => {
    const st = state()
    st.grades.domains[1].slots = 0
    st.grades.domains[1].counted = []
    render(<GradesCard state={st} />)
    const name = getEventByName('Handstand')!.domain
    const btn = screen.getByRole('button', { name: new RegExp(`^${name},`) })
    expect(within(btn).queryByText('Needs bodyweight')).toBeNull()
    expect(btn.querySelectorAll('[aria-hidden="true"]').length).toBe(1) // only the chevron
  })

  it('tints every domain icon grey rather than its domain colour', () => {
    const { container } = render(<GradesCard state={state()} />)
    const masks = Array.from(container.querySelectorAll<HTMLElement>('[style*="mask-image"]'))
    expect(masks.length).toBe(10)
    for (const m of masks) expect(m.style.background).toBe('rgb(187, 187, 187)')
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
