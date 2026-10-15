// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { honoursByYear, ghostAverages } from '@/lib/honours'
import { HonoursList } from '@/components/HonoursCard'
import type { GradeAward, GradeInputs, ResultRow } from '@/lib/loadGrades'

afterEach(cleanup)

const award = (year: number, domain: number, rung: number): GradeAward => ({
  domain_number: domain, rung, grade_name: '', conferred_at: `${year}-06-01T00:00:00Z`, season_year: year,
} as GradeAward)

describe('honoursByYear', () => {
  it('keeps every year, newest first, with its own games cap', () => {
    const awards = [
      ...Array.from({ length: 10 }, (_, i) => award(2026, i + 1, 4)),
      award(2026, 3, 6),
      award(2027, 1, 2),
    ]
    const years = honoursByYear(awards, new Map([[2026, 40], [2027, 1]]), new Map([[2026, 12]]))
    expect(years.map(y => y.year)).toEqual([2027, 2026])
    // 2026: nine domains at 4 and one at 6 average 4.2, so Kōwhai.
    expect(years[1]).toMatchObject({ overall: 4, games: 40, prs: 12, best: { domainNumber: 3, rung: 6 } })
    // 2027: one Whero over ten domains averages under 1.
    expect(years[0]).toMatchObject({ overall: 0, games: 1, prs: 0, best: { domainNumber: 1, rung: 2 } })
  })

  it('a year of PRs alone still counts', () => {
    expect(honoursByYear([], new Map(), new Map([[2025, 2]]))).toEqual([
      { year: 2025, overall: 0, games: 0, prs: 2, best: null },
    ])
  })
})

describe('ghostAverages', () => {
  const result = (day: string, event: string, raw: number): ResultRow => ({
    raw_score: raw, weight_kg: null, difficulty_tier: null, session_id: `g-${day}`, points_earned: null,
    created_at: `${day}T05:00:00Z`, session_events: { event_name: event },
    sessions: { is_active: false, points_awarded_at: null, started_at: `${day}T04:30:00Z`, session_date: day },
  })
  const inputs = (results: ResultRow[]): GradeInputs => ({
    profile: { division: 'Open Men', age_years: 30 }, gender: 'Male', band: null, bodyweights: [], bodyweightsLive: true,
    results, entries: [], exemptions: [], awards: [], matches: [], voids: new Set(), schemaReady: true, workoutsReady: true, complete: true,
  })

  it('reads last year only', () => {
    const ghost = ghostAverages('p', inputs([result('2026-05-01', 'Pushups', 40030)]), 2027)
    expect(ghost.size).toBe(1)
    expect([...ghost.values()][0]).toBeGreaterThan(0)
    expect(ghostAverages('p', inputs([result('2027-05-01', 'Pushups', 40030)]), 2027).size).toBe(0)
  })
})

describe('HonoursList', () => {
  it('names each year\'s colour, games, PRs and best domain', () => {
    render(<HonoursList thisYear={2027} years={[
      { year: 2027, overall: 2, games: 3, prs: 1, best: null },
      { year: 2026, overall: 4, games: 40, prs: 12, best: { domainNumber: 1, rung: 6 } },
    ]} />)
    const rows = screen.getAllByTestId('honours-year')
    expect(rows[0].textContent).toContain('Whero so far')
    expect(rows[0].textContent).toContain('3 games · 1 PR')
    expect(rows[1].textContent).toContain('Kōwhai')
    expect(rows[1].textContent).not.toContain('so far')
    expect(rows[1].textContent).toContain('best Maximal Strength Kahurangi')
  })
})
