// @vitest-environment jsdom
//
// ── The records list in the entry sheet and on My Events ─────────────────────
// Both screens are behind a login, so this is the only thing that would notice
// the list showing the wrong rows, or a tap no longer pre-filling.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import PRBoardView from '@/components/play/PRBoardView'
import { getEventBySlug } from '@/lib/eventData'
import type { PRRow } from '@/lib/prBoard'

afterEach(cleanup)

const row = (id: string, raw: number, label: string, date = '2026-09-01', source: PRRow['source'] = 'game'): PRRow => ({
  id, raw_score: raw, score_label: label, difficulty_tier: null, date, source,
})

describe('PRBoardView', () => {
  it('lists a best per level played, plus the level about to be scored', () => {
    const dips = getEventBySlug('pause-dips')!
    render(<PRBoardView ev={dips} currentLevel={2} rows={[row('a', 10005, '5 reps'), row('b', 3, '3 reps')]} />)
    expect(screen.getByText('5 reps')).toBeTruthy()
    expect(screen.getByText('3 reps')).toBeTruthy()
    expect(screen.getByText('D1')).toBeTruthy()
    expect(screen.getByText('D2')).toBeTruthy()
    expect(screen.getByText('D3')).toBeTruthy()
    expect(screen.getByText('No record yet')).toBeTruthy()
    expect(screen.queryByText('D4')).toBeNull()
  })

  it('lists every level with its name when asked, and says so where nothing is recorded', () => {
    const dips = getEventBySlug('pause-dips')!
    const tiers = dips.difficultyTiers!
    render(<PRBoardView ev={dips} showAllLevels rows={[row('a', 10005, '5 reps')]} />)
    expect(screen.getByText(`D${tiers.length}`)).toBeTruthy()
    expect(screen.getByText(tiers[0].name)).toBeTruthy()
    expect(screen.getByText(tiers[tiers.length - 1].name)).toBeTruthy()
    expect(screen.getAllByText('No record yet')).toHaveLength(tiers.length - 1)
  })

  it('lists the top five in order on an event without levels', () => {
    const dl = getEventBySlug('deadlift')!
    const rows = [100, 140, 120, 110, 130, 90].map((v, i) => row(`r${i}`, v, `${v}kg`))
    render(<PRBoardView ev={dl} rows={rows} />)
    expect(screen.getAllByText(/^#\d$/).map(e => e.textContent)).toEqual(['#1', '#2', '#3', '#4', '#5'])
    expect(screen.queryByText('90kg')).toBeNull()
    expect(screen.getByText('140kg')).toBeTruthy()
  })

  it('marks a logged or witnessed record so it is not mistaken for a game score', () => {
    const dl = getEventBySlug('deadlift')!
    render(<PRBoardView ev={dl} rows={[row('a', 100, '100kg', '2026-09-01', 'witnessed'), row('b', 90, '90kg', '2026-08-01', 'logged')]} />)
    expect(screen.getByText('WITNESSED')).toBeTruthy()
    expect(screen.getByText('LOGGED')).toBeTruthy()
  })

  it('hands the tapped record back, and is read-only without onPick', () => {
    const dl = getEventBySlug('deadlift')!
    const onPick = vi.fn()
    const { unmount } = render(<PRBoardView ev={dl} rows={[row('a', 100, '100kg')]} onPick={onPick} />)
    fireEvent.click(screen.getByText('100kg'))
    expect(onPick).toHaveBeenCalledTimes(1)
    expect(onPick.mock.calls[0][0].id).toBe('a')
    unmount()
    render(<PRBoardView ev={dl} rows={[row('a', 100, '100kg')]} />)
    expect(document.querySelector('button')).toBeNull()
  })

  it('renders nothing for a win/draw/loss event or with no scores', () => {
    const { container, rerender } = render(<PRBoardView ev={getEventBySlug('wrestling')!} rows={[row('a', 2, 'Win')]} />)
    expect(container.innerHTML).toBe('')
    rerender(<PRBoardView ev={getEventBySlug('deadlift')!} rows={[]} />)
    expect(container.innerHTML).toBe('')
  })
})

// ── Inside the entry sheet ───────────────────────────────────────────────────
import QuickEntrySheet from '@/components/play/QuickEntrySheet'

describe('records in the entry sheet', () => {
  const base = () => {
    const e = getEventBySlug('deadlift')!
    return {
      se: { id: e.slug, domain_number: e.domainNumber, domain_name: e.domain, event_name: e.name, event_slug: e.slug, input_mode: e.inputMode },
      eventData: e, myResults: [], opponents: [], seasonPR: null, locked: false,
      onClose: vi.fn(), onSubmit: vi.fn(async () => ({ error: null, isPR: false })),
      onDelete: vi.fn(async () => null), onSubmitted: vi.fn(), onDeleted: vi.fn(),
    }
  }

  it('shows the player\'s top scores when prRows are passed', () => {
    render(<QuickEntrySheet {...base()} prRows={[row('a', 132.5, '132.5 kg 1RM')]} />)
    expect(screen.getByText('Your top scores')).toBeTruthy()
    expect(screen.getByText('132.5 kg 1RM')).toBeTruthy()
  })

  it('shows no records section when there are none', () => {
    render(<QuickEntrySheet {...base()} />)
    expect(screen.queryByText('Your top scores')).toBeNull()
  })
})
