// ─── Timesheets ──────────────────────────────────────────────────────────────
// MULTI_LOCATION_PLAN.md §2 "Pay", step 12; database:
// 20261124223426_timesheets.sql. Agreed with Tāne, 24 to 25 Nov 2026:
//
//   · Hours and approvals only; rates, bank accounts and tax stay in payroll.
//   · A funded game makes a line for its lead and second adult when it starts,
//     each the game's fixed block. Only a Kaimahi or a Kaiwhakawā gets one.
//   · Fortnights from Monday 8 Feb 2027.
//   · Nobody scored (or the game was voided or deleted): held until the
//     Kaiwhakawā chooses Pay or Don't pay. A query holds a line until settled.
//   · Approve once the fortnight has ended; held lines wait.
//   · Export: two CSVs, hours per Kaiārahi and hours per programme.
//
// PURE: no Supabase, no React (__tests__/timesheets.test.ts).

import { addDays } from '@/lib/weeklyGames'

/** The first day of the first pay fortnight (a Monday). Mirrors pay_period_start. */
export const PAY_ANCHOR = '2027-02-08'

const dayNumber = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / 86_400_000)

/** The Monday that starts the fortnight holding `date`. */
export function periodStart(date: string): string {
  const offset = dayNumber(date) - dayNumber(PAY_ANCHOR)
  return addDays(PAY_ANCHOR, 14 * Math.floor(offset / 14))
}

/** The Sunday that ends the fortnight starting `start`. */
export function periodEnd(start: string): string {
  return addDays(start, 13)
}

/** Whether the fortnight has ended by `today` (NZ date), so it can be approved. */
export function periodEnded(start: string, today: string): boolean {
  return addDays(start, 14) <= today
}

/**
 * The fortnight the panel opens on: the latest one that has ended, so the one
 * to approve; before the first fortnight ends, the first one.
 */
export function defaultPeriod(today: string): string {
  const current = periodStart(today)
  const last = addDays(current, -14)
  return last < PAY_ANCHOR ? PAY_ANCHOR : last
}

export type HeldReason = 'query' | 'no_game' | 'voided' | 'no_players'
export type Role = 'lead' | 'second'

export type TimesheetLine = {
  id: string
  player_id: string
  name: string | null
  weekly_game_id: string | null
  site_name: string | null
  programme_id: string | null
  programme_name: string | null
  game_date: string
  role: Role
  minutes: number
  source: 'start' | 'manual'
  players: number
  held: HeldReason | null
  decision: 'pay' | 'no_pay' | null
  query_note: string | null
  query_at: string | null
  answer: string | null
  settled_at: string | null
  approved_at: string | null
}

export type LineStatus = 'approved' | 'unpaid' | 'held' | 'ready'

/** Where a line stands. 'unpaid' is a Don't pay decision (never exported). */
export function lineStatus(l: Pick<TimesheetLine, 'approved_at' | 'held' | 'decision'>): LineStatus {
  if (l.decision === 'no_pay') return 'unpaid'
  if (l.approved_at) return 'approved'
  if (l.held) return 'held'
  return 'ready'
}

export const HELD_LABEL: Record<HeldReason, string> = {
  query: 'Queried',
  no_game: 'Game deleted',
  voided: 'Game voided',
  no_players: 'No players',
}

export const STATUS_LABEL: Record<LineStatus, string> = {
  approved: 'Approved',
  unpaid: "Don't pay",
  held: 'Held',
  ready: 'Ready',
}

/** Whether the Kaimahi may still query this line. */
export function canQuery(l: Pick<TimesheetLine, 'approved_at'>): boolean {
  return !l.approved_at
}

/** "1h 30m", "2h", "45m". */
export function formatMinutes(mins: number): string {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

/** Hours to two decimals, as payroll takes them. */
export const hours = (mins: number) => (mins / 60).toFixed(2)

/** Approved and paid: what the export carries. */
export function paidLines(lines: readonly TimesheetLine[]): TimesheetLine[] {
  return lines.filter(l => lineStatus(l) === 'approved')
}

export type Summary = { ready: number; held: number; approved: number; unpaid: number; minutes: number }

/** Counts for the panel's heading; minutes are the paid or payable ones. */
export function summarise(lines: readonly TimesheetLine[]): Summary {
  const s: Summary = { ready: 0, held: 0, approved: 0, unpaid: 0, minutes: 0 }
  for (const l of lines) {
    const st = lineStatus(l)
    s[st]++
    if (st !== 'unpaid') s.minutes += l.minutes
  }
  return s
}

/** A CSV cell: quoted when it holds a comma, quote or line break. */
function cell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number | null | undefined)[]) => cells.map(cell).join(',')

const ROLE_LABEL: Record<Role, string> = { lead: 'Lead', second: 'Second adult' }

type Grouped = { key: string; label: string; lines: TimesheetLine[] }

function groupBy(lines: readonly TimesheetLine[], key: (l: TimesheetLine) => string, label: (l: TimesheetLine) => string): Grouped[] {
  const map = new Map<string, Grouped>()
  for (const l of lines) {
    const k = key(l)
    const g = map.get(k) ?? { key: k, label: label(l), lines: [] }
    g.lines.push(l)
    map.set(k, g)
  }
  return [...map.values()].sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * Hours per Kaiārahi, for entering pay: a total row for each person, then
 * their lines (date, game, programme, role, hours). Approved lines only.
 */
export function csvByKaiarahi(lines: readonly TimesheetLine[], start: string): string {
  const out = [row(['Fortnight', `${start} to ${periodEnd(start)}`]), '', row(['Kaiārahi', 'Date', 'Game', 'Programme', 'Role', 'Hours'])]
  for (const g of groupBy(paidLines(lines), l => l.player_id, l => l.name ?? 'Unknown')) {
    const total = g.lines.reduce((n, l) => n + l.minutes, 0)
    out.push(row([g.label, '', '', '', 'Total', hours(total)]))
    for (const l of [...g.lines].sort((a, b) => a.game_date.localeCompare(b.game_date))) {
      out.push(row([g.label, l.game_date, l.site_name, l.programme_name, ROLE_LABEL[l.role], hours(l.minutes)]))
    }
  }
  return out.join('\r\n') + '\r\n'
}

/** Hours per programme, for funder reporting: a total per programme, then its lines. */
export function csvByProgramme(lines: readonly TimesheetLine[], start: string): string {
  const out = [row(['Fortnight', `${start} to ${periodEnd(start)}`]), '', row(['Programme', 'Date', 'Game', 'Kaiārahi', 'Role', 'Hours'])]
  for (const g of groupBy(paidLines(lines), l => l.programme_id ?? '', l => l.programme_name ?? 'No programme')) {
    const total = g.lines.reduce((n, l) => n + l.minutes, 0)
    out.push(row([g.label, '', '', '', 'Total', hours(total)]))
    for (const l of [...g.lines].sort((a, b) => a.game_date.localeCompare(b.game_date) || (a.name ?? '').localeCompare(b.name ?? ''))) {
      out.push(row([g.label, l.game_date, l.site_name, l.name, ROLE_LABEL[l.role], hours(l.minutes)]))
    }
  }
  return out.join('\r\n') + '\r\n'
}

/** Lines grouped by person, for the panel. */
export function byPerson(lines: readonly TimesheetLine[]): Grouped[] {
  return groupBy(lines, l => l.player_id, l => l.name ?? 'Unknown')
}

export { ROLE_LABEL }
