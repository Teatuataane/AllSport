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
import GameEventList from '@/components/play/GameEventList'
import AddEventsSheet from '@/components/play/AddEventsSheet'
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

describe('the live game list', () => {
  const official = [asPlayEvent('deadlift'), asPlayEvent('tennis')]
  const scored = { id: 'r1', raw_score: 140, score_label: '140kg × 1', difficulty_tier: null, weight_kg: 140, reps: 1, time_seconds: null, result_type: null, opponent_name: null, match_score: null }
  const base = {
    events: official,
    chosen: ['pause-row'],
    eventDataFor: (sl: { se: PlayEvent }) => getEventBySlug(sl.se.event_slug),
    rowsFor: () => [],
    noteFor: () => undefined,
    rungFor: () => 0,
    scoredSlugs: new Set<string>(),
    onOpen: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(),
  }

  it('titles each domain and puts the added event under it', () => {
    render(<GameEventList {...base} canAdd />)
    expect(screen.getByText('1 · Maximal Strength')).toBeTruthy()
    expect(screen.getByText('9 · Coordination')).toBeTruthy()
    const order = screen.getAllByText(/^(Deadlift|Pause Row|Tennis)$/).map(n => n.textContent)
    expect(order).toEqual(['Deadlift', 'Pause Row', 'Tennis'])
  })

  it('opens the domain from the + on its official event', () => {
    const onAdd = vi.fn()
    render(<GameEventList {...base} canAdd onAdd={onAdd} />)
    fireEvent.click(screen.getByLabelText('Add Maximal Strength events'))
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ domainNumber: 1 }))
  })

  it('removes an unscored added event, and keeps a scored one', () => {
    const onRemove = vi.fn()
    const { unmount } = render(<GameEventList {...base} canAdd onRemove={onRemove} />)
    fireEvent.click(screen.getByLabelText('Remove Pause Row'))
    expect(onRemove).toHaveBeenCalledWith('pause-row')
    unmount()
    render(<GameEventList {...base} canAdd scoredSlugs={new Set(['pause-row'])} />)
    expect(screen.queryByLabelText('Remove Pause Row')).toBeNull()
  })

  it('offers no + and no ✕ to a guest or after the game', () => {
    render(<GameEventList {...base} canAdd={false} />)
    expect(screen.queryByLabelText('Add Maximal Strength events')).toBeNull()
    expect(screen.queryByLabelText('Remove Pause Row')).toBeNull()
  })

  it('names the colour a score reached beside its rank', () => {
    render(<GameEventList {...base} canAdd rowsFor={sl => sl.se.event_slug === 'deadlift' ? [scored] : []}
      rungFor={sl => sl.se.event_slug === 'deadlift' ? 7 : 0}
      noteFor={() => ({ label: '2nd in event', color: '#F9B051' })} />)
    expect(screen.getByText('Poroporo')).toBeTruthy()
    expect(screen.getByText('2nd in event')).toBeTruthy()
  })
})

describe('the add events sheet', () => {
  it('lists only that domain, minus what is in play, and adds several at once', () => {
    const onAdd = vi.fn()
    render(<AddEventsSheet domainName="Maximal Strength" domainNumber={1}
      exclude={['deadlift', 'pause-row']} onAdd={onAdd} onClose={vi.fn()} />)
    expect(screen.queryByText('Deadlift')).toBeNull()
    expect(screen.queryByText('Pause Row')).toBeNull()
    expect(screen.queryByText('Tennis')).toBeNull()
    fireEvent.click(screen.getByText('Pause Bench'))
    fireEvent.click(screen.getByText('Arthur Lift'))
    fireEvent.click(screen.getByText('Add 2 events'))
    expect(onAdd).toHaveBeenCalledWith(['pause-bench', 'arthur-lift'])
  })

  it('adds nothing until something is ticked', () => {
    const onAdd = vi.fn()
    render(<AddEventsSheet domainName="Maximal Strength" domainNumber={1} exclude={[]} onAdd={onAdd} onClose={vi.fn()} />)
    fireEvent.click(screen.getByText('Choose events to add'))
    expect(onAdd).not.toHaveBeenCalled()
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

describe('natural formats in the sheet', () => {
  const running = getEventBySlug('running')!

  it('offers sets on a lift, and only when natural is on', () => {
    const { rerender } = render(<QuickEntrySheet {...sheetProps}
      onSubmit={vi.fn(async () => ({ error: null, isPR: false, units: 0 }))} />)
    expect(screen.queryByText('Sets')).toBeNull()

    rerender(<QuickEntrySheet {...sheetProps} natural
      onSubmit={vi.fn(async () => ({ error: null, isPR: false, units: 0 }))} />)
    expect(screen.getByText('Sets')).toBeTruthy()
  })

  it('shows the estimate beside what was lifted, and submits it', async () => {
    const onSubmit = vi.fn(async () => ({ error: null, isPR: false, units: 5 }))
    render(<QuickEntrySheet {...sheetProps} natural onSubmit={onSubmit} />)

    fireEvent.change(screen.getByLabelText('Set 1 weight'), { target: { value: '100' } })
    fireEvent.change(screen.getByLabelText('Set 1 reps'), { target: { value: '5' } })
    expect(screen.getByText('Best set — 100kg × 5 · est. 1RM 112.5kg')).toBeTruthy()

    fireEvent.click(screen.getByText(/Submit — 100kg × 5/))
    await waitFor(() => expect(onSubmit).toHaveBeenCalled())
    const [vals] = onSubmit.mock.calls[0] as unknown as [{ setRows: { weightKg: string; reps: string }[] }]
    expect(vals.setRows[0]).toEqual({ weightKg: '100', reps: '5' })
  })

  it('takes a distance and a time on a run, with the pace and the converted rung', () => {
    render(<QuickEntrySheet {...sheetProps} natural se={asPlayEvent('running')} eventData={running}
      onSubmit={vi.fn(async () => ({ error: null, isPR: false, units: 5 }))} />)

    fireEvent.change(screen.getByLabelText('Distance in kilometres'), { target: { value: '5' } })
    fireEvent.change(screen.getByLabelText('Minutes'), { target: { value: '26' } })
    fireEvent.change(screen.getByLabelText('Seconds'), { target: { value: '10' } })
    // The pace line carries the estimate; the submit button restates it.
    expect(screen.getByText(/5:14\/km · 5km · 26:10 · est\. 1000m/)).toBeTruthy()
    expect(screen.getByText(/Submit — 5km · 26:10 · est\. 1000m/)).toBeTruthy()
  })
})
