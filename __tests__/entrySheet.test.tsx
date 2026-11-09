// @vitest-environment jsdom
//
// ── The entry sheet, phase 2 of SCORING_UX_BUILD_PLAN.md (v0.49.0.0) ─────────
// What this pins:
//   1. A game sheet that opens filled in cannot be submitted until something
//      changes; a training sheet (natural) can, because the same set twice is
//      normal there.
//   2. A held stepper repeats; a tap is one step; a keyboard click is one step.
//   3. Delete asks first, in the row.
//   4. Enter in a number field submits.
//   5. The "Next" event after a score, wrapping round.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen, act } from '@testing-library/react'
import QuickEntrySheet from '@/components/play/QuickEntrySheet'
import { StepBtn, HOLD_DELAY_MS, HOLD_REPEAT_MS, type EntryRow, type PlayEvent } from '@/components/play/chrome'
import { getEventBySlug } from '@/lib/eventData'
import { nextUnscored } from '@/lib/nextEvent'

afterEach(() => { cleanup(); vi.useRealTimers() })

const deadlift = getEventBySlug('deadlift')!
const se: PlayEvent = {
  id: 'deadlift', domain_number: deadlift.domainNumber, domain_name: deadlift.domain,
  event_name: deadlift.name, event_slug: 'deadlift', input_mode: deadlift.inputMode,
}
const best: EntryRow = {
  id: 'r1', raw_score: 100, score_label: '100kg', difficulty_tier: null, weight_kg: 100, reps: 1,
  time_seconds: null, result_type: null, opponent_name: null, match_score: null,
}
const props = {
  se, eventData: deadlift, opponents: [], seasonPR: null, locked: false,
  onClose: vi.fn(), onDelete: vi.fn(async () => null), onSubmitted: vi.fn(), onDeleted: vi.fn(),
}
const ok = () => vi.fn(async () => ({ error: null, isPR: false }))

describe('filled in is not ready (a game)', () => {
  it('holds back Submit on a pre-filled game sheet until something changes', () => {
    const onSubmit = ok()
    render(<QuickEntrySheet {...props} myResults={[best]} onSubmit={onSubmit} />)
    const button = screen.getByText('Change something to submit')
    expect((button as HTMLButtonElement).disabled).toBe(true)
    fireEvent.click(button)
    expect(onSubmit).not.toHaveBeenCalled()
    // One step up from the last score is the common next entry.
    fireEvent.click(screen.getByLabelText('2.5kg more'))
    expect(screen.getByText(/Submit — 102.5kg/)).toBeTruthy()
  })

  it('lets a training sheet submit the same again', () => {
    render(<QuickEntrySheet {...props} natural myResults={[best]} onSubmit={ok()} />)
    expect(screen.queryByText('Change something to submit')).toBeNull()
  })

  it('does not hold back an empty sheet', () => {
    render(<QuickEntrySheet {...props} myResults={[]} onSubmit={ok()} />)
    expect(screen.getByText('Enter your score')).toBeTruthy()
  })
})

describe('fields', () => {
  it('submits on Enter, and the small steps move the weight', async () => {
    const onSubmit = ok()
    render(<QuickEntrySheet {...props} myResults={[]} onSubmit={onSubmit} />)
    const weight = screen.getAllByPlaceholderText('0')[0]
    fireEvent.change(weight, { target: { value: '100' } })
    fireEvent.click(screen.getByText('+5kg'))
    fireEvent.click(screen.getByText('−1kg'))
    expect(screen.getByText(/Submit — 104kg/)).toBeTruthy()
    await act(async () => { fireEvent.keyDown(weight, { key: 'Enter' }) })
    expect(onSubmit).toHaveBeenCalledTimes(1)
  })
})

describe('the stepper', () => {
  it('steps once on a tap, and the click after it does not step again', () => {
    const step = vi.fn()
    render(<StepBtn label="More" onClick={step}>+</StepBtn>)
    const b = screen.getByLabelText('More')
    fireEvent.pointerDown(b, { button: 0 })
    fireEvent.pointerUp(b)
    fireEvent.click(b)
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('repeats while held and stops on release', () => {
    vi.useFakeTimers()
    const step = vi.fn()
    render(<StepBtn label="More" onClick={step}>+</StepBtn>)
    const b = screen.getByLabelText('More')
    fireEvent.pointerDown(b, { button: 0 })
    act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS - 1) })
    expect(step).toHaveBeenCalledTimes(1)
    act(() => { vi.advanceTimersByTime(1 + HOLD_REPEAT_MS * 5) })
    expect(step).toHaveBeenCalledTimes(6)
    fireEvent.pointerUp(b)
    act(() => { vi.advanceTimersByTime(HOLD_REPEAT_MS * 10) })
    expect(step).toHaveBeenCalledTimes(6)
  })

  it('stops when the finger slides off', () => {
    vi.useFakeTimers()
    const step = vi.fn()
    render(<StepBtn label="More" onClick={step}>+</StepBtn>)
    const b = screen.getByLabelText('More')
    fireEvent.pointerDown(b, { button: 0 })
    fireEvent.pointerLeave(b)
    act(() => { vi.advanceTimersByTime(HOLD_DELAY_MS * 3) })
    expect(step).toHaveBeenCalledTimes(1)
  })

  it('still steps from the keyboard', () => {
    const step = vi.fn()
    render(<StepBtn label="More" onClick={step}>+</StepBtn>)
    fireEvent.click(screen.getByLabelText('More'))
    expect(step).toHaveBeenCalledTimes(1)
  })
})

describe('delete asks first', () => {
  it('confirms in the row, and Keep leaves the score alone', async () => {
    const onDelete = vi.fn(async () => null)
    render(<QuickEntrySheet {...props} myResults={[best]} onSubmit={ok()} onDelete={onDelete} />)
    fireEvent.click(screen.getByLabelText('Delete 100kg'))
    expect(onDelete).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText('Keep'))
    expect(screen.queryByText('Delete?')).toBeNull()
    fireEvent.click(screen.getByLabelText('Delete 100kg'))
    expect(screen.getByText('Delete?')).toBeTruthy()
    await act(async () => { fireEvent.click(screen.getByText('Delete')) })
    expect(onDelete).toHaveBeenCalledWith('r1')
  })

  it('shows no Edit or Delete on a score still saving', () => {
    render(<QuickEntrySheet {...props} myResults={[{ ...best, pending: true }]} onSubmit={ok()} />)
    expect(screen.getByText('Saving')).toBeTruthy()
    expect(screen.queryByText('Edit')).toBeNull()
  })
})

describe('levels', () => {
  it('labels the row Level and spells out the chosen one', () => {
    const dips = getEventBySlug('pause-dips')!
    const tier = dips.difficultyTiers![1]
    render(<QuickEntrySheet {...props} se={{ ...se, id: 'pause-dips', event_slug: 'pause-dips', event_name: dips.name, input_mode: dips.inputMode }}
      eventData={dips} myResults={[]} onSubmit={ok()} />)
    expect(screen.getByText('Level')).toBeTruthy()
    fireEvent.click(screen.getByText(`D${tier.level}`))
    expect(screen.getByText(`D${tier.level} ${tier.name}`)).toBeTruthy()
  })
})

describe('nextUnscored', () => {
  const ids = ['a', 'b', 'c', 'd']
  it('takes the next unscored event after the one just scored', () => {
    expect(nextUnscored(ids, new Set(['a', 'b']), 'b')).toBe('c')
    expect(nextUnscored(ids, new Set(['b', 'c']), 'b')).toBe('d')
  })
  it('wraps round to the top', () => {
    expect(nextUnscored(ids, new Set(['c', 'd']), 'd')).toBe('a')
  })
  it('never offers the event just scored, and is null when all are done', () => {
    expect(nextUnscored(ids, new Set(['a', 'c', 'd']), 'b')).toBeNull()
    expect(nextUnscored(ids, new Set(ids), 'a')).toBeNull()
  })
})
