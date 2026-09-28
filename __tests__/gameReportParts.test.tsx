// @vitest-environment jsdom
//
// ── The game report's parts ──────────────────────────────────────────────────
// Rendered on three pages that are all behind a login, so this is the only
// place they are seen in a test.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { ColourScore, NextTime, ReportEventRow, ScoreTrend, EarnedColours, PlacementHeader } from '@/components/GameReportParts'

afterEach(cleanup)

describe('ColourScore', () => {
  it('shows the score out of 120 and the colour it plays at', () => {
    render(<ColourScore points={74} average={66} />)
    const el = screen.getByTestId('colour-score')
    expect(el.textContent).toContain('74')
    expect(el.textContent).toContain('/ 120')
    expect(el.textContent).toContain('Played at Poroporo')
    expect(el.textContent).toContain('+8 on your average')
  })

  it('says nothing about an average on a first game', () => {
    render(<ColourScore points={20} average={null} />)
    expect(screen.getByTestId('colour-score').textContent).not.toContain('average')
  })
})

describe('ReportEventRow', () => {
  it('flags a PR and names the colour reached', () => {
    render(<ReportEventRow line={{ eventName: 'Deadlift', scoreLabel: '100kg', placement: 2, rung: 6, isPR: true }} />)
    const el = screen.getByTestId('report-event')
    expect(el.textContent).toContain('PR')
    expect(el.textContent).toContain('Kahurangi')
    expect(el.textContent).toContain('2nd')
  })

  it('says a missed event was ranked last', () => {
    render(<ReportEventRow line={{ eventName: 'Tennis', scoreLabel: null, placement: null, rung: 0 }} />)
    expect(screen.getByTestId('report-event').textContent).toContain('Not played · ranked last')
  })
})

describe('the rest', () => {
  it('writes the next step as one line', () => {
    render(<NextTime step={{ eventName: 'Deadlift', slug: 'deadlift', nextRung: 5, gap: '5kg more', progress: 0.8 }} />)
    expect(screen.getByTestId('next-time').textContent).toContain('Deadlift: 5kg more for Kākāriki')
  })

  it('draws a trend only from two games', () => {
    const { container, rerender } = render(<ScoreTrend points={[40]} />)
    expect(container.textContent).toBe('')
    rerender(<ScoreTrend points={[40, 52, 61]} />)
    expect(screen.getByTestId('score-trend').querySelectorAll('circle')).toHaveLength(3)
  })

  it('shows nothing when no colour was earned', () => {
    const { container } = render(<EarnedColours colours={[]} />)
    expect(container.textContent).toBe('')
  })
})

describe('PlacementHeader', () => {
  it('leads with the whole-game place and its points, the division place under it', () => {
    render(<PlacementHeader game={{ place: 3, of: 14, points: 98 }} division={{ rank: 2, of: 6, name: "Men's" }} />)
    const el = screen.getByTestId('placement')
    expect(el.textContent).toContain('3rd')
    expect(el.textContent).toContain('of 14 in the game · +98 season points')
    expect(el.textContent).toContain("2nd of 6 · Men's")
  })

  it('falls back to the division place alone', () => {
    render(<PlacementHeader game={null} division={{ rank: 2, of: 6, name: "Men's" }} />)
    const el = screen.getByTestId('placement')
    expect(el.textContent).toContain('2nd')
    expect(el.textContent).not.toContain('season points')
  })
})
