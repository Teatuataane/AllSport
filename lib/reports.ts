// ─── Funder and school reports ───────────────────────────────────────────────
// MULTI_LOCATION_PLAN.md §2 "Reports and privacy", step 14. Agreed with Tāne,
// 26 Nov 2026:
//
//   · A printable page (print or save as PDF) and the same numbers as a CSV.
//   · Funder report: one programme over a period. Delivery, the success
//     measures, reach, wellbeing change (5 or more who answered twice) and
//     approved paid hours.
//   · School report: students who named the school. Totals by age band; names
//     and games played only for students whose parent agreed to share; the
//     rest counted only. Never ethnicity, wellbeing or bodyweight per student.
//   · Every group of 1 to 4 shows as "fewer than 5" (`shown`).
//
// The measures themselves come from lib/successMeasures.ts, so a report and
// the scorecard always agree. PURE: no Supabase, no React
// (__tests__/reports.test.ts).

import {
  AGE_BANDS, ETHNIC_GROUPS, percent, QUINTILES, REASON_LABEL, reachOf, SEXES, shown, ageBand, ageOn,
  type Attendance, type PeriodSummary, type Person, type Reach,
} from '@/lib/successMeasures'

export type Wellbeing = {
  respondents: number
  who5_first: number | null; who5_latest: number | null
  activity_first: number | null; activity_latest: number | null
  belonging_first: number | null; belonging_latest: number | null
}

export type FunderReport = {
  programme: { name: string; funder: string }
  from: string
  to: string
  games: string[]
  summary: PeriodSummary
  /** Everyone who played in the period, aged at the end of it. */
  reach: Reach
  /** The new players only, aged at their first game. */
  newReach: Reach
  wellbeing: Wellbeing | null
  paidMinutes: number
}

export function funderReport(args: {
  programme: { name: string; funder: string }
  from: string
  to: string
  games: string[]
  summary: PeriodSummary
  att: Attendance
  people: ReadonlyMap<string, Person>
  wellbeing: Wellbeing | null
  paidMinutes: number
}): FunderReport {
  const { att, people, summary, to } = args
  return {
    programme: args.programme, from: args.from, to, games: args.games, summary,
    reach: reachOf(summary.players, people, () => to),
    newReach: reachOf(summary.newPlayers, people, id => att.first.get(id)!.date),
    wellbeing: args.wellbeing, paidMinutes: args.paidMinutes,
  }
}

/** One table of a reach breakdown: label and shown count, in a fixed order. */
export function reachRows(r: Reach): { group: string; rows: [string, string][] }[] {
  const rows = (keys: readonly string[], m: Map<string, number>) => {
    const out: [string, string][] = keys.map(k => [k === 'Q5' ? 'Q5 (most deprived)' : k === 'Q1' ? 'Q1 (least deprived)' : k, shown(m.get(k) ?? 0)])
    if ((m.get('Unknown') ?? 0) > 0) out.push(['Unknown', shown(m.get('Unknown')!)])
    return out
  }
  return [
    { group: 'Age', rows: rows(AGE_BANDS, r.age as Map<string, number>) },
    { group: 'Sex', rows: rows(SEXES.filter(s => s !== 'Unknown'), r.sex as Map<string, number>) },
    { group: 'Ethnicity (total response)', rows: rows(ETHNIC_GROUPS, r.ethnicity as Map<string, number>) },
    { group: 'Deprivation (NZDep2023)', rows: rows(QUINTILES, r.deprivation as Map<string, number>) },
  ]
}

const one = (n: number | null) => (n == null ? '–' : n.toFixed(1).replace(/\.0$/, ''))

/** The headline lines of a funder report, as label and value. */
export function funderLines(r: FunderReport): [string, string][] {
  const s = r.summary
  const lines: [string, string][] = [
    ['Games held', String(s.sessions)],
    ['Attendances', String(s.attendances)],
    ['Different players', shown(s.players.length)],
    ['Average turn-up', one(s.turnUp)],
    ['Regulars (3 of the last 6 games)', shown(s.regulars)],
    ['New players', shown(s.newPlayers.length)],
    ['Comebacks (back twice within six weeks)', `${percent(s.comeback)} of ${shown(s.comeback.of)}`],
    ['Show-up (said Coming and played)', `${percent(s.showUp)} of ${shown(s.showUp.of)}`],
    ['Games cancelled', s.cancelled.length ? s.cancelled.map(c => `${c.count} ${REASON_LABEL[c.reason] ?? c.reason}`).join(', ') : 'None'],
    ['Paid Kaiārahi hours (approved)', (r.paidMinutes / 60).toFixed(1)],
  ]
  return lines
}

/** Wellbeing lines: averages with the change, or "fewer than 5". */
export function wellbeingLines(w: Wellbeing | null): [string, string][] {
  if (!w || w.respondents < 5 || w.who5_first == null || w.who5_latest == null) {
    // null: the function is not live yet (or refused), which is not the same as nobody.
    return [['Players with two check-ins', w ? shown(w.respondents) : 'not available yet']]
  }
  const change = (a: number | null, b: number | null, dp = 1) =>
    a == null || b == null ? '–' : `${a.toFixed(dp)} to ${b.toFixed(dp)} (${b - a >= 0 ? '+' : ''}${(b - a).toFixed(dp)})`
  return [
    ['Players with two check-ins', String(w.respondents)],
    ['WHO-5 wellbeing (0 to 100)', change(w.who5_first, w.who5_latest)],
    ['Active days a week', change(w.activity_first, w.activity_latest)],
    ['Belonging (1 to 5)', change(w.belonging_first, w.belonging_latest, 2)],
  ]
}

// ── Schools ───────────────────────────────────────────────────────────────────
export type Student = { id: string; name: string | null; dob: string | null; consent: boolean }

export type SchoolReport = {
  school: string
  from: string
  to: string
  /** Students who played in the period. */
  students: number
  attendances: number
  /** Played 3 or more times in the period. */
  often: number
  age: [string, string][]
  /** Consenting students, by name, with games played. */
  named: { name: string; games: number }[]
  /** Played, but no parent's OK to share: counted only. */
  unnamed: number
}

export const SCHOOL_AGE_BANDS = ['5-11', '12-17'] as const
export const OFTEN = 3

export function schoolReport(args: {
  school: string
  from: string
  to: string
  students: readonly Student[]
  att: Attendance
}): SchoolReport {
  const { att, from, to } = args
  const games = new Map<string, number>()
  for (const s of att.sessions) {
    if (s.session_date < from || s.session_date > to) continue
    for (const p of att.players.get(s.id)!) games.set(p, (games.get(p) ?? 0) + 1)
  }
  const played = args.students.filter(s => (games.get(s.id) ?? 0) > 0)
  const age = new Map<string, number>()
  for (const s of played) {
    const b = ageBand(ageOn(s.dob, to))
    const k = b === '5-11' || b === '12-17' ? b : 'Other'
    age.set(k, (age.get(k) ?? 0) + 1)
  }
  const named = played.filter(s => s.consent)
    .map(s => ({ name: s.name ?? 'Unnamed', games: games.get(s.id)! }))
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name))
  return {
    school: args.school, from, to,
    students: played.length,
    attendances: played.reduce((n, s) => n + games.get(s.id)!, 0),
    often: played.filter(s => games.get(s.id)! >= OFTEN).length,
    age: [...SCHOOL_AGE_BANDS, ...((age.get('Other') ?? 0) > 0 ? ['Other'] : [])].map(k => [k, shown(age.get(k) ?? 0)] as [string, string]),
    named,
    unnamed: played.length - named.length,
  }
}

/** The headline lines of a school report. */
export function schoolLines(r: SchoolReport): [string, string][] {
  return [
    ['Students who played', shown(r.students)],
    // Under five students, a total could single one out: left out.
    ['Games played (all students)', r.students >= 5 ? String(r.attendances) : r.students ? '–' : '0'],
    [`Played ${OFTEN} or more times`, shown(r.often)],
    ...r.age.map(([k, v]) => [`Aged ${k}`, v] as [string, string]),
    ['Students named below (a parent agreed)', String(r.named.length)],
    ['Students counted only', shown(r.unnamed)],
  ]
}

// ── CSV ───────────────────────────────────────────────────────────────────────
function cell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
const row = (cells: (string | number | null | undefined)[]) => cells.map(cell).join(',')

export function funderCsv(r: FunderReport): string {
  const out = [
    row(['AllSport funder report']),
    row(['Programme', r.programme.name]), row(['Funder', r.programme.funder]), row(['Period', `${r.from} to ${r.to}`]),
    '', row(['Measure', 'Value']), ...funderLines(r).map(row),
    '', row(['Wellbeing (first and latest check-in)', '']), ...wellbeingLines(r.wellbeing).map(row),
  ]
  for (const [title, reach] of [['Everyone who played', r.reach], ['New players', r.newReach]] as const) {
    out.push('', row([`Reach: ${title}`, shown(reach.total)]))
    for (const g of reachRows(reach)) {
      out.push(row([g.group, '']))
      for (const [k, v] of g.rows) out.push(row([k, v]))
    }
  }
  out.push('', row(['Groups of 1 to 4 people show as "fewer than 5".']))
  return out.join('\r\n') + '\r\n'
}

export function schoolCsv(r: SchoolReport): string {
  const out = [
    row(['AllSport school report']), row(['School', r.school]), row(['Period', `${r.from} to ${r.to}`]),
    '', row(['Measure', 'Value']), ...schoolLines(r).map(row),
    '', row(['Student', 'Games played']), ...r.named.map(n => row([n.name, n.games])),
    '', row(['Names only where a parent agreed to share with the school. Groups of 1 to 4 show as "fewer than 5".']),
  ]
  return out.join('\r\n') + '\r\n'
}
