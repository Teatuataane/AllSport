// @vitest-environment jsdom
//
// ── The finish pass, phase 4 of SCORING_UX_BUILD_PLAN.md (v0.50.0.0) ─────────
// What this pins:
//   1. The game list has ONE "Tap to score": the first unscored event. The
//      other unscored rows wear a quiet ring, still named for a screen reader.
//   2. A row rendered alone keeps the pill (quiet is opt-in), as the personal
//      workout screen draws it.
//   3. The toast is a status, and a failed save is an alert.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import GameEventList from '@/components/play/GameEventList'
import EventListRow from '@/components/play/EventListRow'
import Toast, { ToastButton, ToastText } from '@/components/play/Toast'
import { getEventBySlug } from '@/lib/eventData'
import type { EntryRow, PlayEvent } from '@/components/play/chrome'

afterEach(cleanup)

const asPlayEvent = (slug: string): PlayEvent => {
  const e = getEventBySlug(slug)!
  return { id: e.slug, domain_number: e.domainNumber, domain_name: e.domain, event_name: e.name, event_slug: e.slug, input_mode: e.inputMode }
}
const scored: EntryRow = {
  id: 'r1', raw_score: 100, score_label: '100kg', difficulty_tier: null, weight_kg: 100, reps: 1,
  time_seconds: null, result_type: null, opponent_name: null, match_score: null,
}

function list(scoredIds: string[]) {
  const events = ['deadlift', '1-leg-squat', 'kelly-snatch'].map(asPlayEvent)
  return render(<GameEventList
    events={events} chosen={[]} eventDataFor={s => getEventBySlug(s.se.event_slug)}
    rowsFor={s => scoredIds.includes(s.se.id) ? [scored] : []}
    noteFor={() => undefined} rungFor={() => 0} canAdd={false} scoredSlugs={new Set()}
    onOpen={vi.fn()} onAdd={vi.fn()} onRemove={vi.fn()} />)
}

describe('one call to action in the game list', () => {
  it('puts "Tap to score" on the first unscored event only', () => {
    list([])
    expect(screen.getAllByText('Tap to score')).toHaveLength(1)
    expect(screen.getAllByText('Not scored')).toHaveLength(2)
  })

  it('moves the pill on once the first event is scored', () => {
    list(['deadlift'])
    const pill = screen.getByText('Tap to score')
    expect(pill.closest('button')!.textContent).not.toContain(getEventBySlug('deadlift')!.name)
    expect(screen.getAllByText('Not scored')).toHaveLength(1)
  })

  it('keeps the pill on a row drawn alone', () => {
    render(<EventListRow se={asPlayEvent('deadlift')} eventData={getEventBySlug('deadlift')} myResults={[]} onOpen={vi.fn()} />)
    expect(screen.getByText('Tap to score')).toBeTruthy()
  })
})

describe('the toast', () => {
  it('is a status, with its action', () => {
    const go = vi.fn()
    render(<Toast tone="done" actions={<ToastButton onClick={go}>Next: Kelly Snatch</ToastButton>}><ToastText>Score in</ToastText></Toast>)
    expect(screen.getByRole('status').textContent).toContain('Score in')
    screen.getByText('Next: Kelly Snatch').click()
    expect(go).toHaveBeenCalledTimes(1)
  })

  it('is an alert when a save failed', () => {
    render(<Toast tone="error"><ToastText>Not saved</ToastText></Toast>)
    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.queryByRole('status')).toBeNull()
  })
})
