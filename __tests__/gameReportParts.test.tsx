// @vitest-environment jsdom
//
// ── The game report's parts ──────────────────────────────────────────────────
// Rendered on three pages that are all behind a login, so this is the only
// place they are seen in a test.

import { describe, it, expect, afterEach } from 'vitest'
import { fireEvent, render, cleanup, screen } from '@testing-library/react'
import { ColourScore, NextTime, ReportEventRow, ScoreTrend, EarnedColours, PlacementHeader } from '@/components/GameReportParts'
import { GameBoardList } from '@/components/GameBoardList'
import { gradeForRung } from '@/lib/grading'
import { gameColourRung } from '@/lib/gameReport'

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

  it('counts the PRs set today, and says nothing with none', () => {
    render(<ColourScore points={74} average={66} prs={3} />)
    expect(screen.getByTestId('prs-today').textContent).toBe('3 PRs today')
    cleanup()
    render(<ColourScore points={74} average={66} prs={1} />)
    expect(screen.getByTestId('prs-today').textContent).toBe('1 PR today')
    cleanup()
    render(<ColourScore points={74} average={66} />)
    expect(screen.queryByTestId('prs-today')).toBeNull()
  })

  it('says nothing about an average on a first game', () => {
    render(<ColourScore points={20} average={null} />)
    expect(screen.getByTestId('colour-score').textContent).not.toContain('average')
  })
})

describe('ReportEventRow', () => {
  it('shows the exact score beside the colour (Scoring v2)', () => {
    render(<ReportEventRow line={{ eventName: 'Deadlift', scoreLabel: '100kg', rung: 7.28 }} />)
    const el = screen.getByTestId('report-event')
    expect(el.textContent).toContain('Poroporo 7.2')
    expect(el.textContent).not.toContain('½')
  })

  it('flags a PR and names the colour reached', () => {
    render(<ReportEventRow line={{ eventName: 'Deadlift', scoreLabel: '100kg', rung: 6, isPR: true }} />)
    const el = screen.getByTestId('report-event')
    expect(el.textContent).toContain('PR')
    expect(el.textContent).toContain('Kahurangi')
  })

  it('says a missed event scored nothing', () => {
    render(<ReportEventRow line={{ eventName: 'Tennis', scoreLabel: null, rung: 0 }} />)
    expect(screen.getByTestId('report-event').textContent).toContain('Not played · no colour score')
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

  it('names the latest colour in the trend, never a number', () => {
    render(<ScoreTrend points={[40, 52, 61]} />)
    const t = screen.getByTestId('score-trend').textContent ?? ''
    expect(t).toContain(gradeForRung(gameColourRung(61)).name)
    expect(t).not.toMatch(/\b61\b/)
  })

  it('shows nothing when no colour was earned', () => {
    const { container } = render(<EarnedColours colours={[]} />)
    expect(container.textContent).toBe('')
  })
})

describe('PlacementHeader', () => {
  it('leads with the whole-game place and its points, and no division place', () => {
    render(<PlacementHeader game={{ place: 3, of: 14, points: 98 }} />)
    const el = screen.getByTestId('placement')
    expect(el.textContent).toContain('3rd')
    expect(el.textContent).toContain('of 14 in the game · +98 season points')
    expect(el.textContent).not.toContain("Men's")
  })

  it('shows no place until the colour scores are in', () => {
    render(<PlacementHeader game={null} />)
    const el = screen.getByTestId('placement')
    expect(el.textContent).toContain('—')
    expect(el.textContent).not.toContain('season points')
  })
})

describe('GameBoardList', () => {
  const entries = [
    { key: 'a', name: 'Aroha', place: 1, isMe: true, events: [{ eventName: 'Deadlift', scoreLabel: '120kg' }] },
    { key: 'g', name: 'Guest', place: null },
  ]

  it('shows places and no one\'s colour score, and a guest holds no place', () => {
    render(<GameBoardList entries={entries} />)
    const rows = screen.getAllByTestId('game-board-row')
    expect(rows[0].textContent).toContain('1st')
    expect(rows[1].textContent).toContain('—')
    expect(screen.getByTestId('game-board').textContent).not.toMatch(/colour|season points/i)
  })

  it('opens a row to what the player did', () => {
    render(<GameBoardList entries={entries} />)
    fireEvent.click(screen.getByText('Aroha'))
    expect(screen.getByTestId('game-board').textContent).toContain('120kg')
  })
})
