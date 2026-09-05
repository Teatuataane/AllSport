// Date helpers for AllSport.
//
// Postgres DATE columns (session_date, event_date, date_of_birth) arrive as
// 'YYYY-MM-DD' strings. `new Date('2026-06-19')` parses that as UTC midnight, so
// formatting it in any timezone behind UTC renders the *previous* day. parseLocalDate
// builds the date in the local timezone instead, so 19 June stays 19 June everywhere.

export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.slice(0, 10).split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1)
}

const DEFAULT_OPTS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' }

export function formatNZDate(
  dateStr: string | null | undefined,
  opts: Intl.DateTimeFormatOptions = DEFAULT_OPTS,
): string {
  if (!dateStr) return ''
  return parseLocalDate(dateStr).toLocaleDateString('en-NZ', opts)
}

// The mirror of parseLocalDate, for the write side.
//
// `toISOString().split('T')[0]` yields the UTC date, so any session starting
// before noon NZ is stamped with the *previous* day: a 9:00am Saturday is 21:00
// UTC Friday, and every Saturday game AllSport ran up to 2026-09 was stored, and
// displayed, as a Friday.
//
// This resolves the calendar day in Pacific/Auckland explicitly rather than in
// whatever zone the device happens to be set to, so the same instant answers the
// same day on any machine. Named zone, never a fixed +12, because NZDT is +13
// from late September.
export const NZ_TIME_ZONE = 'Pacific/Auckland'

const NZ_DATE_PARTS = new Intl.DateTimeFormat('en-NZ', {
  timeZone: NZ_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function toNZDateString(date: Date): string {
  const parts = NZ_DATE_PARTS.formatToParts(date)
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === t)?.value ?? ''
  return `${get('year')}-${get('month')}-${get('day')}`
}

// One derivation for both halves of a new session, so they cannot drift apart.
//
// `startTime` is a 'HH:MM' from the setup form and means wall-clock time on the
// device running it — the kaiwhakawa's phone, standing in the gym. That gives
// the instant the game starts. `sessionDate` is then that instant's NZ calendar
// day, so session_date always agrees with started_at by construction rather than
// by two callers happening to compute the same thing.
//
// Known limit, deliberately not fixed here: setHours resolves in the DEVICE's
// zone, so a phone set to something other than NZ produces a startedAt that is
// wrong by the offset — and sessionDate then faithfully reports the NZ day of
// that wrong instant. The pair stays self-consistent, which is the invariant
// the trigger also enforces, but neither is rescued from a mis-set clock. Every
// session is created in the room, on a NZ phone, so this is latent. Logged in
// TODOS.md rather than fixed, because interpreting the form's time as NZ
// wall-clock changes what started_at MEANS and needs its own decision.
//
// Returning the pair is the point: the bug this replaces existed because the
// page derived the date from `toISOString()` and the timestamp from `setHours`,
// and nothing made them answer the same question. The DB trigger added in
// 20260902020602 enforces the same invariant server-side.
export function sessionStart(
  startTime: string,
  now: Date = new Date(),
): { startedAt: Date; sessionDate: string } {
  const [h, m] = startTime.split(':').map(Number)
  const startedAt = new Date(now)
  startedAt.setHours(h || 0, m || 0, 0, 0)
  return { startedAt, sessionDate: toNZDateString(startedAt) }
}
