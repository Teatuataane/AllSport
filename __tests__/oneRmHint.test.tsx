// @vitest-environment jsdom
//
// ── The est. 1RM hint on the quick-entry sheet ───────────────────────────────
// An official lift now ranks on its estimated 1RM, so the sheet tells the
// player as they type. The live screen is behind a login; this is the only
// thing that would notice the hint going missing or showing on the wrong event.

import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import QuickEntrySheet from '@/components/play/QuickEntrySheet'
import { getEventBySlug } from '@/lib/eventData'
import type { PlayEvent } from '@/components/play/chrome'

afterEach(cleanup)

const asPlayEvent = (slug: string): PlayEvent => {
  const e = getEventBySlug(slug)!
  return {
    id: e.slug, domain_number: e.domainNumber, domain_name: e.domain,
    event_name: e.name, event_slug: e.slug, input_mode: e.inputMode,
  }
}

const props = (slug: string) => ({
  se: asPlayEvent(slug),
  eventData: getEventBySlug(slug)!,
  myResults: [],
  opponents: [],
  seasonPR: null,
  locked: false,
  onClose: vi.fn(),
  onSubmit: vi.fn(async () => ({ error: null, isPR: false })),
  onDelete: vi.fn(async () => null),
  onSubmitted: vi.fn(),
  onDeleted: vi.fn(),
})

describe('the est. 1RM hint', () => {
  it('explains the rule before anything is typed, with no number yet', () => {
    render(<QuickEntrySheet {...props('deadlift')} />)
    expect(screen.getByText(/ranks on its estimated 1RM/)).toBeTruthy()
    expect(screen.queryByText(/Est\. 1RM \d/)).toBeNull()
  })

  it('shows the estimate once a weight and more than one rep are entered', () => {
    render(<QuickEntrySheet {...props('deadlift')} />)
    const [weight, reps] = screen.getAllByPlaceholderText('0')
    fireEvent.change(weight, { target: { value: '35' } })
    fireEvent.change(reps, { target: { value: '5' } })
    expect(screen.getByText(/Est\. 1RM 39\.4kg/)).toBeTruthy()
  })

  it('shows no estimate for a single, which is the load itself', () => {
    render(<QuickEntrySheet {...props('deadlift')} />)
    const [weight, reps] = screen.getAllByPlaceholderText('0')
    fireEvent.change(weight, { target: { value: '35' } })
    fireEvent.change(reps, { target: { value: '1' } })
    expect(screen.queryByText(/Est\. 1RM \d/)).toBeNull()
  })

  it('never appears on Shoulder Dislocate, which stores a grip width', () => {
    render(<QuickEntrySheet {...props('shoulder-dislocate')} />)
    expect(screen.queryByText(/estimated 1RM/)).toBeNull()
  })

  it('counts reps past ten as ten', () => {
    render(<QuickEntrySheet {...props('deadlift')} />)
    const [weight, reps] = screen.getAllByPlaceholderText('0')
    fireEvent.change(weight, { target: { value: '60' } })
    fireEvent.change(reps, { target: { value: '15' } })
    expect(screen.getByText(/Est\. 1RM 80kg/)).toBeTruthy()
  })
})
