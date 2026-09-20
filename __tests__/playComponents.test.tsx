// @vitest-environment jsdom
//
// ── The shared play components ───────────────────────────────────────────────
// The quick-entry sheet, the event row and the plan picker were lifted out of
// app/scoring/[sessionId]/page.tsx so a PERSONAL GAME draws with exactly the
// same pieces. Those screens are behind a login, so nothing else in the suite
// would notice if the extraction quietly broke.
//
// What this pins:
//   1. The sheet submits through its `onSubmit` prop rather than writing to a
//      table itself — that is the whole point of the extraction.
//   2. `allowGames={false}` (a personal game) never offers a win/draw/loss,
//      because the database refuses a logged Game-rung result.
//   3. `locked` closes scoring, which is how a finished workout and an ended
//      game both behave.
//   4. Official mode in the picker holds ONE event per domain; personal mode
//      holds as many as the player taps.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen, waitFor } from '@testing-library/react'
import QuickEntrySheet from '@/components/play/QuickEntrySheet'
import EventListRow from '@/components/play/EventListRow'
import EventPlanPicker from '@/components/play/EventPlanPicker'
import { getEventBySlug, EVENTS } from '@/lib/eventData'
import type { PlayEvent } from '@/components/play/chrome'

afterEach(cleanup)

const deadlift = getEventBySlug('deadlift')!
const asPlayEvent = (slug: string): PlayEvent => {
  const e = getEventBySlug(slug)!
  return {
    id: e.slug, domain_number: e.domainNumber, domain_name: e.domain,
    event_name: e.name, event_slug: e.slug, input_mode: e.inputMode,
  }
}

const sheetProps = {
  se: asPlayEvent('deadlift'),
  eventData: deadlift,
  myResults: [],
  opponents: [],
  seasonPR: null,
  locked: false,
  onClose: vi.fn(),
  onDelete: vi.fn(async () => null),
  onSubmitted: vi.fn(),
  onDeleted: vi.fn(),
}

describe('the quick-entry sheet', () => {
  it('submits through the caller, so one sheet serves results and workout entries', async () => {
    const onSubmit = vi.fn(async () => ({ error: null, isPR: false, units: 1 }))
    const onSubmitted = vi.fn()
    render(<QuickEntrySheet {...sheetProps} onSubmit={onSubmit} onSubmitted={onSubmitted} />)

    // Two fields share the '0' placeholder on a strength event: weight, then reps.
    fireEvent.change(screen.getAllByPlaceholderText('0')[0], { target: { value: '100' } })
    fireEvent.click(screen.getByText(/Submit — 100kg/))

    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1))
    const [vals, editingId] = onSubmit.mock.calls[0] as unknown as [{ weightKg: string }, string | null]
    expect(vals.weightKg).toBe('100')
    expect(editingId).toBeNull()
    await waitFor(() => expect(onSubmitted).toHaveBeenCalled())
  })

  it('offers no win, draw or loss when games are off (a personal game)', () => {
    const gameEvent = EVENTS.find(e => e.inputMode === 'sport')!
    const { rerender } = render(
      <QuickEntrySheet {...sheetProps} se={asPlayEvent(gameEvent.slug)} eventData={gameEvent}
        onSubmit={vi.fn(async () => ({ error: null, isPR: false, units: 1 }))} allowGames={false} />)
    expect(screen.queryByText('WIN')).toBeNull()

    rerender(
      <QuickEntrySheet {...sheetProps} se={asPlayEvent(gameEvent.slug)} eventData={gameEvent}
        onSubmit={vi.fn(async () => ({ error: null, isPR: false, units: 1 }))} allowGames />)
    expect(screen.getByText('WIN')).toBeTruthy()
  })

  it('closes scoring when locked', () => {
    render(<QuickEntrySheet {...sheetProps} locked onSubmit={vi.fn(async () => ({ error: null, isPR: false, units: 0 }))} />)
    expect(screen.getByText('Scoring is closed')).toBeTruthy()
    expect(screen.queryByText(/Submit —/)).toBeNull()
  })

  it('renames its two hint tiles for a workout', () => {
    render(<QuickEntrySheet {...sheetProps} bestLabel="Best today" prLabel="Your best"
      onSubmit={vi.fn(async () => ({ error: null, isPR: false, units: 0 }))} />)
    expect(screen.getByText('Best today')).toBeTruthy()
    expect(screen.getByText('Your best')).toBeTruthy()
  })
})

describe('the event row', () => {
  const row = { id: 'r1', raw_score: 100, score_label: '100kg × 3', difficulty_tier: null, weight_kg: 100, reps: 3, time_seconds: null, result_type: null, opponent_name: null, match_score: null }

  it('asks to be scored when nothing has been', () => {
    render(<EventListRow se={asPlayEvent('deadlift')} eventData={deadlift} myResults={[]} onOpen={vi.fn()} />)
    expect(screen.getByText('Tap to score')).toBeTruthy()
  })

  it('shows the best score and whatever note the screen passes', () => {
    render(<EventListRow se={asPlayEvent('deadlift')} eventData={deadlift} myResults={[row]}
      note={{ label: '1st in event', color: '#F9B051' }} onOpen={vi.fn()} />)
    expect(screen.getByText('100kg × 3')).toBeTruthy()
    expect(screen.getByText('1st in event')).toBeTruthy()
  })
})

describe('the plan picker', () => {
  it('holds one event per domain in official mode', () => {
    const onChange = vi.fn()
    render(<EventPlanPicker mode="official" plan={['deadlift']} onChange={onChange} />)
    // Domain 1 opens by default in official mode.
    fireEvent.click(screen.getByText('Pause Bench'))
    expect(onChange).toHaveBeenCalledWith(['pause-bench'])
  })

  it('adds alongside in personal mode', () => {
    const onChange = vi.fn()
    render(<EventPlanPicker mode="personal" plan={['deadlift']} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: 'pause bench' } })
    fireEvent.click(screen.getByText('Pause Bench'))
    expect(onChange).toHaveBeenCalledWith(['deadlift', 'pause-bench'])
  })
})
