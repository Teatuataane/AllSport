import { describe, it, expect } from 'vitest'
import { parseLocalDate, formatNZDate, toNZDateString, sessionStart } from '@/lib/dates'

describe('parseLocalDate', () => {
  it('keeps the calendar day a DATE column meant, in any timezone behind UTC', () => {
    const d = parseLocalDate('2026-06-19')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(19)
  })

  it('tolerates a full timestamp by slicing to the date part', () => {
    expect(parseLocalDate('2026-06-19T21:00:00+00:00').getDate()).toBe(19)
  })

  // The `m || 1` / `d || 1` fallbacks. A truncated DATE string must still yield
  // a real Date rather than NaN, because every caller formats the result
  // straight into the UI and an Invalid Date renders as literal "Invalid Date".
  it('falls back to the first month/day when the string is truncated', () => {
    const monthOnly = parseLocalDate('2026-06')
    expect(monthOnly.getMonth()).toBe(5)
    expect(monthOnly.getDate()).toBe(1)
    const yearOnly = parseLocalDate('2026')
    expect(yearOnly.getMonth()).toBe(0)
    expect(yearOnly.getDate()).toBe(1)
  })
})

describe('formatNZDate', () => {
  it('renders empty for a missing date rather than "Invalid Date"', () => {
    expect(formatNZDate(null)).toBe('')
    expect(formatNZDate(undefined)).toBe('')
    expect(formatNZDate('')).toBe('')
  })

  // The positive path had no assertion at all: every "does it render empty"
  // test would still pass if the formatter emitted the wrong day.
  it('renders the calendar day the DATE column meant, in NZ format', () => {
    expect(formatNZDate('2026-08-29')).toBe('29 Aug 2026')
  })

  it('honours caller-supplied options, as /games/[sessionId] passes', () => {
    expect(formatNZDate('2026-08-29', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
      .toBe('Saturday, 29 August 2026')
  })
})

describe('toNZDateString', () => {
  // The regression this exists for. A 9:00am NZST Saturday is 21:00 UTC on the
  // Friday, so toISOString() stamps the session with the wrong calendar day —
  // which is why every Saturday game in production reads as a Friday.
  it('stamps a 9am NZ Saturday as the Saturday, where toISOString says Friday', () => {
    const nzSaturday9am = new Date('2026-08-29T09:00:00+12:00')
    expect(nzSaturday9am.toISOString().split('T')[0]).toBe('2026-08-28')
    expect(toNZDateString(nzSaturday9am)).toBe('2026-08-29')
  })

  it('agrees with toISOString for an afternoon session, which never shifted', () => {
    const nzTuesday430pm = new Date('2026-08-25T16:30:00+12:00')
    expect(nzTuesday430pm.toISOString().split('T')[0]).toBe('2026-08-25')
    expect(toNZDateString(nzTuesday430pm)).toBe('2026-08-25')
  })

  it('zero-pads month and day so the string is always a valid DATE literal', () => {
    expect(toNZDateString(new Date(2027, 0, 5, 9, 0))).toBe('2027-01-05')
  })

  // NZDT starts on the last Sunday of September (2am -> 3am on 27 Sep 2026), so
  // a session on the transition day itself runs at +13. The migration uses the
  // named zone 'Pacific/Auckland' for exactly this reason; these two cases are
  // what a hardcoded +12 would silently get wrong every summer.
  it('stamps a 9am session on the DST transition day as that day (+13)', () => {
    const dstDay9am = new Date('2026-09-27T09:00:00+13:00')
    expect(dstDay9am.toISOString().split('T')[0]).toBe('2026-09-26')
    expect(toNZDateString(dstDay9am)).toBe('2026-09-27')
  })

  it('tracks the UTC day boundary moving from noon (NZST) to 1pm (NZDT)', () => {
    // NZST: local noon is 00:00 UTC the same day, so toISOString agrees.
    const nzstNoon = new Date('2026-08-10T12:00:00+12:00')
    expect(nzstNoon.toISOString().split('T')[0]).toBe('2026-08-10')
    expect(toNZDateString(nzstNoon)).toBe('2026-08-10')
    // NZDT: local noon is 23:00 UTC the day BEFORE, so toISOString does not.
    const nzdtNoon = new Date('2026-10-10T12:00:00+13:00')
    expect(nzdtNoon.toISOString().split('T')[0]).toBe('2026-10-09')
    expect(toNZDateString(nzdtNoon)).toBe('2026-10-10')
  })

  // The worst version of the bug: a New Year's Day morning game filed under the
  // previous YEAR, which /prs and /leaderboard both slice out of session_date
  // to decide which season a result belongs to.
  it('keeps a New Years Day morning session in the right year', () => {
    const nyd9am = new Date('2027-01-01T09:00:00+13:00')
    expect(nyd9am.toISOString().split('T')[0]).toBe('2026-12-31')
    expect(toNZDateString(nyd9am)).toBe('2027-01-01')
  })

  it('round-trips through parseLocalDate', () => {
    const d = new Date(2026, 8, 1, 9, 0)
    expect(toNZDateString(parseLocalDate(toNZDateString(d)))).toBe('2026-09-01')
  })
})

describe('toNZDateString is anchored to NZ, not the device', () => {
  // The defect the ship review caught. The first version of this helper read
  // getFullYear/getMonth/getDate, so it answered in whatever zone the machine
  // was set to — correct in Christchurch, and quietly reproducing the original
  // bug on a laptop set to UTC. These cases are built from absolute instants,
  // so they assert the NZ day no matter where the test runs.
  it('reads an absolute instant as its NZ calendar day, not its UTC one', () => {
    const instant = new Date('2026-08-28T21:00:00Z') // 9:00am Sat 29 Aug NZST
    expect(instant.toISOString().slice(0, 10)).toBe('2026-08-28')
    expect(toNZDateString(instant)).toBe('2026-08-29')
  })

  it('handles NZDT (+13), where the UTC day is behind from 11am not noon', () => {
    const instant = new Date('2026-10-09T23:00:00Z') // 12:00pm Sat 10 Oct NZDT
    expect(instant.toISOString().slice(0, 10)).toBe('2026-10-09')
    expect(toNZDateString(instant)).toBe('2026-10-10')
  })

  it('agrees with UTC for an instant that falls on the same day in both', () => {
    const instant = new Date('2026-08-25T04:30:00Z') // 4:30pm Tue 25 Aug NZST
    expect(toNZDateString(instant)).toBe('2026-08-25')
  })
})

describe('sessionStart', () => {
  // The derivation that used to live inline in app/scoring/page.tsx, where the
  // date came from toISOString() and the timestamp from setHours — two answers
  // to one question, which is how they drifted for four months.
  const at = (iso: string) => new Date(iso)

  // Zone-independent: this compares the two halves against each other rather
  // than against a hardcoded string, so it holds on any runner and is the
  // invariant that actually matters.
  it('always returns a sessionDate that is the NZ day of its own startedAt', () => {
    for (const t of ['09:00', '16:30', '00:05', '23:55']) {
      for (const d of ['2026-08-29', '2026-10-10', '2026-12-31', '2027-01-01']) {
        const r = sessionStart(t, at(`${d}T12:00:00+12:00`))
        expect(r.sessionDate).toBe(toNZDateString(r.startedAt))
      }
    }
  })

  it('stamps a 9:00am Saturday game as the Saturday, not the Friday', () => {
    const r = sessionStart('09:00', at('2026-08-29T02:00:00+12:00'))
    expect(r.startedAt.toISOString().slice(0, 10)).toBe('2026-08-28')
    expect(r.sessionDate).toBe('2026-08-29')
  })

  it('stamps a 4:30pm Tuesday game as the Tuesday', () => {
    expect(sessionStart('16:30', at('2026-08-25T10:00:00+12:00')).sessionDate).toBe('2026-08-25')
  })

  it('follows the start time, not the moment the judge opened the form', () => {
    const r = sessionStart('09:00', at('2026-08-29T08:40:00+12:00'))
    expect(r.startedAt.getHours()).toBe(9)
    expect(r.startedAt.getMinutes()).toBe(0)
  })

  it('survives the NZDT transition day', () => {
    expect(sessionStart('09:00', at('2026-09-27T09:00:00+13:00')).sessionDate).toBe('2026-09-27')
  })

  it('treats a malformed start time as midnight rather than NaN', () => {
    const r = sessionStart('', at('2026-08-29T10:00:00+12:00'))
    expect(Number.isNaN(r.startedAt.getTime())).toBe(false)
    expect(r.sessionDate).toBe('2026-08-29')
  })
})
