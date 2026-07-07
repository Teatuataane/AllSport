import { describe, it, expect } from 'vitest'
import { nextScheduledSession } from '@/lib/schedule'

// Fixed schedule: Tue & Thu 4:30pm, Sat 9:00am — Pacific/Auckland.
// July dates are NZST (UTC+12), so +12:00 offsets pin the NZ wall clock exactly.
// 2026-07-07 is a Tuesday.
const nz = (iso: string) => new Date(`${iso}+12:00`)

describe('nextScheduledSession', () => {
  it('picks Tuesday 4:30pm when it is Tuesday morning', () => {
    const r = nextScheduledSession(nz('2026-07-07T09:00:00'))
    expect(r.label).toBe('Tuesday 4:30pm')
    expect(r.relative).toBe('in 8 hours') // 7.5h rounds to 8
  })

  it('rolls to Thursday once the Tuesday session has started', () => {
    const r = nextScheduledSession(nz('2026-07-07T16:30:00'))
    expect(r.label).toBe('Thursday 4:30pm')
  })

  it('rolls to Thursday just after the Tuesday session start', () => {
    const r = nextScheduledSession(nz('2026-07-07T17:00:00'))
    expect(r.label).toBe('Thursday 4:30pm')
    expect(r.relative).toBe('in 48 hours') // 47.5h rounds to 48, still < 48h cutoff
  })

  it('picks Saturday 9:00am on Friday', () => {
    const r = nextScheduledSession(nz('2026-07-10T12:00:00'))
    expect(r.label).toBe('Saturday 9:00am')
    expect(r.relative).toBe('in 21 hours')
  })

  it('uses minutes under an hour out', () => {
    const r = nextScheduledSession(nz('2026-07-11T08:30:00'))
    expect(r.label).toBe('Saturday 9:00am')
    expect(r.relative).toBe('in 30 minutes')
  })

  it('uses singular forms for exactly one unit', () => {
    expect(nextScheduledSession(nz('2026-07-11T08:59:00')).relative).toBe('in 1 minute')
    expect(nextScheduledSession(nz('2026-07-11T08:00:00')).relative).toBe('in 1 hour')
  })

  it('wraps the week: Saturday after the session points at Tuesday in days', () => {
    const r = nextScheduledSession(nz('2026-07-11T10:00:00'))
    expect(r.label).toBe('Tuesday 4:30pm')
    expect(r.relative).toBe('in 3 days')
  })

  it('wraps the week from Sunday', () => {
    const r = nextScheduledSession(nz('2026-07-12T12:00:00'))
    expect(r.label).toBe('Tuesday 4:30pm')
    expect(r.relative).toBe('in 2 days')
  })

  it('never returns a session in the past (delta always positive)', () => {
    // Probe every hour across a full week — the label must always be a real slot
    const labels = new Set(['Tuesday 4:30pm', 'Thursday 4:30pm', 'Saturday 9:00am'])
    for (let h = 0; h < 7 * 24; h++) {
      const d = new Date(nz('2026-07-06T00:00:00').getTime() + h * 3600_000)
      const r = nextScheduledSession(d)
      expect(labels.has(r.label)).toBe(true)
      expect(r.relative).toMatch(/^in \d+ (minutes?|hours?|days)$/)
    }
  })
})
