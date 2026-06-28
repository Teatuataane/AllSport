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
