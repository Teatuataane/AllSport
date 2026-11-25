// @vitest-environment jsdom
//
// ── Timesheets panel (multi-location step 12) ───────────────────────────────
// What this pins:
//   1. A Kaimahi sees their own lines and queries one with a note.
//   2. A Kaiwhakawā sees lines by person, decides a held line, and approves
//      only once the fortnight has ended.

import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup, screen, fireEvent } from '@testing-library/react'
import { TimesheetsView } from '@/app/components/TimesheetsPanel'
import type { TimesheetLine } from '@/lib/timesheets'

afterEach(cleanup)

const line = (over: Partial<TimesheetLine>): TimesheetLine => ({
  id: 'l1', player_id: 'a', name: 'Aroha', weekly_game_id: 'g', site_name: 'Hagley Park',
  programme_id: 'p', programme_name: 'Rangatahi', game_date: '2027-02-09', role: 'lead', minutes: 150,
  source: 'start', players: 8, held: null, decision: null, query_note: null, query_at: null, answer: null,
  settled_at: null, approved_at: null, ...over,
})

const props = (over: Partial<Parameters<typeof TimesheetsView>[0]> = {}) => ({
  start: '2027-02-08', today: '2027-02-23', lines: [line({})], head: false, busy: null, error: '',
  people: [], games: [], onPeriod: vi.fn(), onQuery: vi.fn(), onSettle: vi.fn(), onApprove: vi.fn(),
  onDownload: vi.fn(), onAdd: vi.fn(), ...over,
})

describe('TimesheetsView', () => {
  it('lets a Kaimahi query their line', () => {
    const p = props()
    render(<TimesheetsView {...p} />)
    expect(screen.getByText('8 Feb to 21 Feb')).toBeTruthy()
    expect(screen.getByText('9 Feb · Hagley Park · 2h 30m')).toBeTruthy()
    expect(screen.queryByRole('button', { name: /Approve/ })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Query' }))
    fireEvent.change(screen.getByLabelText('What is wrong with this line'), { target: { value: 'I was second, not lead' } })
    fireEvent.click(screen.getByRole('button', { name: 'Send query' }))
    expect(p.onQuery).toHaveBeenCalledWith('l1', 'I was second, not lead')
  })

  it('shows the answer and no Query once approved', () => {
    render(<TimesheetsView {...props({ lines: [line({ approved_at: 'x', answer: 'Fixed' })] })} />)
    expect(screen.getByText('Answer: Fixed')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'Query' })).toBeNull()
  })

  it('lets a Kaiwhakawā decide a held line and approve the rest', () => {
    const p = props({ head: true, lines: [line({}), line({ id: 'l2', player_id: 'b', name: 'Ben', held: 'no_players', players: 0 })] })
    render(<TimesheetsView {...p} />)
    expect(screen.getByText('No players')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Decide' }))
    fireEvent.click(screen.getByRole('button', { name: "Don't pay" }))
    expect(p.onSettle).toHaveBeenCalledWith('l2', false, null, '')
    fireEvent.click(screen.getByRole('button', { name: 'Approve 1 ready' }))
    expect(p.onApprove).toHaveBeenCalled()
  })

  it('waits for the fortnight to end before approving', () => {
    render(<TimesheetsView {...props({ head: true, today: '2027-02-15' })} />)
    expect((screen.getByRole('button', { name: 'Approve 1 ready' }) as HTMLButtonElement).disabled).toBe(true)
    expect(screen.getByText('Approve once the fortnight has ended.')).toBeTruthy()
  })
})
