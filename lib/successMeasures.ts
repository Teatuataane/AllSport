// ─── What success means ──────────────────────────────────────────────────────
// MULTI_LOCATION_PLAN.md §2 "What success means", step 13. ONE pure place so
// the scorecard, the exports (step 14) and any dashboard always agree.
// Agreed with Tāne, 26 Nov 2026:
//
//   · The Kaiwhakawā sees every game; a Kaimahi or Kaiako sees the games they
//     lead, without reach (ethnicity, deprivation), which stays with the head.
//   · "This term" is the NZ school term, holidays counting toward the next.
//   · Deprivation in quintiles (NZDep2023 deciles 1-2 … 9-10), Q5 highlighted.
//   · Age bands Sport NZ style: 5-11, 12-17, 18-24, 25-44, 45-64, 65+.
//   · Ethnicity by total response: a player counts in each group they ticked.
//   · Any group of 1 to 4 people shows as "fewer than 5".
//
// Who played a session: anyone with a result in it, not the Kaiārahi running
// it. Voided sessions never count.
//
// PURE: no Supabase, no React (__tests__/successMeasures.test.ts).

import { addDays } from '@/lib/weeklyGames'

// ── Terms ─────────────────────────────────────────────────────────────────────
/**
 * The last day of each term (Ministry of Education, state schools). Term 1 and
 * Term 4 starts vary by school, so a term runs from the day after the last one
 * ended: the holidays count toward the term that follows. Add a year here each
 * October when the Ministry publishes it (checked 26 Nov 2026).
 */
export const TERM_ENDS: Record<number, [string, string, string, string]> = {
  2026: ['2026-04-02', '2026-07-03', '2026-09-25', '2026-12-18'],
  2027: ['2027-04-09', '2027-07-02', '2027-09-24', '2027-12-17'],
  2028: ['2028-04-13', '2028-07-07', '2028-09-29', '2028-12-15'],
}

export type Term = { year: number; term: 1 | 2 | 3 | 4; start: string; end: string }

/** The term holding `date`; after a year's last term, that is the next year's Term 1. */
export function termOf(date: string): Term {
  const year = Number(date.slice(0, 4))
  const ends = TERM_ENDS[year]
  if (!ends) {
    // A year not listed yet: calendar quarters, so the page never breaks.
    const q = Math.floor((Number(date.slice(5, 7)) - 1) / 3) as 0 | 1 | 2 | 3
    const qEnds = ['03-31', '06-30', '09-30', '12-31']
    const qStarts = ['01-01', '04-01', '07-01', '10-01']
    return { year, term: (q + 1) as Term['term'], start: `${year}-${qStarts[q]}`, end: `${year}-${qEnds[q]}` }
  }
  for (let i = 0; i < 4; i++) {
    if (date <= ends[i]) {
      const prevEnd = i > 0 ? ends[i - 1] : TERM_ENDS[year - 1]?.[3] ?? `${year - 1}-12-31`
      return { year, term: (i + 1) as Term['term'], start: addDays(prevEnd, 1), end: ends[i] }
    }
  }
  const next = TERM_ENDS[year + 1]
  return { year: year + 1, term: 1, start: addDays(ends[3], 1), end: next ? next[0] : `${year + 1}-03-31` }
}

export const termLabel = (t: Pick<Term, 'year' | 'term'>) => `Term ${t.term} ${t.year}`

// ── Bands ─────────────────────────────────────────────────────────────────────
export const AGE_BANDS = ['5-11', '12-17', '18-24', '25-44', '45-64', '65+'] as const
export type AgeBand = (typeof AGE_BANDS)[number] | 'Unknown'

export function ageBand(age: number | null): AgeBand {
  if (age == null || age < 5) return 'Unknown'
  if (age <= 11) return '5-11'
  if (age <= 17) return '12-17'
  if (age <= 24) return '18-24'
  if (age <= 44) return '25-44'
  if (age <= 64) return '45-64'
  return '65+'
}

/** Whole years on `date` from a date of birth (both YYYY-MM-DD). */
export function ageOn(dob: string | null, date: string): number | null {
  if (!dob) return null
  const years = Number(date.slice(0, 4)) - Number(dob.slice(0, 4))
  return date.slice(5) < dob.slice(5) ? years - 1 : years
}

export const QUINTILES = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'] as const
export type Quintile = (typeof QUINTILES)[number] | 'Unknown'

/** NZDep decile 1 (least deprived) to 10 (most) into quintiles; Q5 is 9-10. */
export function quintile(decile: number | null | undefined): Quintile {
  if (!decile || decile < 1 || decile > 10) return 'Unknown'
  return QUINTILES[Math.ceil(decile / 2) - 1]
}

/** Stats NZ level 1 groups, from the sign-up boxes (lib/privateProfile.ts). */
export const ETHNIC_GROUPS = ['European', 'Māori', 'Pacific', 'Asian', 'Other', 'Not stated'] as const
export type EthnicGroup = (typeof ETHNIC_GROUPS)[number]

const GROUP_OF: Record<string, EthnicGroup> = {
  nz_european: 'European', maori: 'Māori',
  samoan: 'Pacific', cook_islands_maori: 'Pacific', tongan: 'Pacific', niuean: 'Pacific',
  chinese: 'Asian', indian: 'Asian', other: 'Other', prefer_not: 'Not stated',
}

/** Total response: every group ticked, once each. No answer is "Not stated". */
export function ethnicGroups(ticked: readonly string[] | null | undefined): EthnicGroup[] {
  const out = new Set<EthnicGroup>()
  for (const t of ticked ?? []) out.add(GROUP_OF[t] ?? 'Other')
  if (out.size === 0) out.add('Not stated')
  return ETHNIC_GROUPS.filter(g => out.has(g))
}

export const SEXES = ['Female', 'Male', 'Other', 'Unknown'] as const
export type Sex = (typeof SEXES)[number]
const sexOf = (g: string | null | undefined): Sex => (g === 'Female' || g === 'Male' || g === 'Other' ? g : 'Unknown')

/** "fewer than 5" for 1 to 4; the number otherwise. */
export function shown(n: number): string {
  return n >= 1 && n <= 4 ? 'fewer than 5' : String(n)
}

// ── Inputs ────────────────────────────────────────────────────────────────────
export type ScoredSession = {
  id: string
  weekly_game_id: string | null
  session_date: string
  judge_id: string | null
  voided_at: string | null
}
/** One row per player per session they scored in. */
export type Played = { session_id: string; player_id: string }
export type Booking = { weekly_game_id: string; game_date: string; player_id: string; answer: 'yes' | 'no' }
export type Cancellation = { weekly_game_id: string; game_date: string; kind: string; reason: string | null }
/** Head only: what reach needs. Never leaves this page as anything but counts. */
export type Person = { id: string; dob: string | null; gender: string | null; ethnicity: string[] | null; decile: number | null }

// ── Attendance ────────────────────────────────────────────────────────────────
export type Attendance = {
  /** Valid sessions, oldest first. */
  sessions: ScoredSession[]
  /** Players per session, the Kaiārahi running it left out. */
  players: Map<string, Set<string>>
  /** Each player's first game anywhere: its date and game. */
  first: Map<string, { date: string; gameId: string | null }>
  /** Each player's game dates anywhere, oldest first. */
  dates: Map<string, string[]>
}

export function attendance(sessions: readonly ScoredSession[], played: readonly Played[]): Attendance {
  const valid = sessions.filter(s => !s.voided_at).sort((a, b) => a.session_date.localeCompare(b.session_date) || a.id.localeCompare(b.id))
  const byId = new Map(valid.map(s => [s.id, s]))
  const players = new Map<string, Set<string>>(valid.map(s => [s.id, new Set<string>()]))
  for (const p of played) {
    const s = byId.get(p.session_id)
    if (!s || p.player_id === s.judge_id) continue
    players.get(s.id)!.add(p.player_id)
  }
  const first = new Map<string, { date: string; gameId: string | null }>()
  const dates = new Map<string, string[]>()
  for (const s of valid) {
    for (const pid of players.get(s.id)!) {
      if (!first.has(pid)) first.set(pid, { date: s.session_date, gameId: s.weekly_game_id })
      const d = dates.get(pid) ?? []
      d.push(s.session_date)
      dates.set(pid, d)
    }
  }
  return { sessions: valid, players, first, dates }
}

// ── The measures ──────────────────────────────────────────────────────────────
export const TREND_WEEKS = 8
export const REGULAR_OF = 6
export const REGULAR_MIN = 3
export const COMEBACK_DAYS = 42
export const COMEBACK_RETURNS = 2
/** First-timers counted for comebacks: those who started in this many weeks. */
export const COMEBACK_LOOKBACK_DAYS = 26 * 7

export type Rate = { of: number; yes: number }

export type Scorecard = {
  /** Average players per session over the last 8 weeks; null with no session. */
  turnUp: number | null
  sessions8: number
  /** Average per week for each of the last 8 weeks, oldest first; null for a week with no session. */
  trend: (number | null)[]
  /** Played 3 or more of the game's last 6 sessions. */
  regulars: number
  /** First-timers here (whose six weeks have passed) who came back at least twice within six weeks. */
  comeback: Rate
  /** Of those who said Coming in the last 8 weeks, how many played that day. */
  showUp: Rate
  /** This term: sessions held, dates cancelled by reason. */
  held: number
  cancelled: { reason: string; count: number }[]
  /** New players this term whose first game was this one. */
  newPlayers: number
}

export type Reach = {
  total: number
  age: Map<AgeBand, number>
  sex: Map<Sex, number>
  ethnicity: Map<EthnicGroup, number>
  deprivation: Map<Quintile, number>
}

/** The scorecard for one game (or every game, with gameId null), as of `today`. */
export function scorecard(args: {
  gameId: string | null
  att: Attendance
  bookings: readonly Booking[]
  cancellations: readonly Cancellation[]
  today: string
}): Scorecard {
  const { gameId, att, bookings, cancellations, today } = args
  const mine = (id: string | null) => gameId === null || id === gameId
  const sessions = att.sessions.filter(s => mine(s.weekly_game_id) && s.session_date <= today)
  const count = (s: ScoredSession) => att.players.get(s.id)!.size

  // Turn-up and its trend.
  const since = addDays(today, -7 * TREND_WEEKS + 1)
  const recent = sessions.filter(s => s.session_date >= since)
  const turnUp = recent.length ? recent.reduce((n, s) => n + count(s), 0) / recent.length : null
  const trend: (number | null)[] = []
  for (let w = TREND_WEEKS - 1; w >= 0; w--) {
    const to = addDays(today, -7 * w)
    const from = addDays(to, -6)
    const week = recent.filter(s => s.session_date >= from && s.session_date <= to)
    trend.push(week.length ? week.reduce((n, s) => n + count(s), 0) / week.length : null)
  }

  // Regulars: of the last six sessions (of this game, or of all games).
  const lastSix = sessions.slice(-REGULAR_OF)
  const times = new Map<string, number>()
  for (const s of lastSix) for (const p of att.players.get(s.id)!) times.set(p, (times.get(p) ?? 0) + 1)
  const regulars = [...times.values()].filter(n => n >= REGULAR_MIN).length

  // Comebacks: first-timers here whose six weeks have run.
  const comeback: Rate = { of: 0, yes: 0 }
  const closed = addDays(today, -COMEBACK_DAYS)
  const from = addDays(today, -COMEBACK_LOOKBACK_DAYS)
  for (const [pid, f] of att.first) {
    if (!mine(f.gameId) || f.date > closed || f.date < from) continue
    comeback.of++
    const until = addDays(f.date, COMEBACK_DAYS)
    const returns = (att.dates.get(pid) ?? []).filter(d => d > f.date && d <= until).length
    if (returns >= COMEBACK_RETURNS) comeback.yes++
  }

  // Show-up: a Yes for a date this game was played.
  const playedOn = new Map<string, Set<string>>()
  for (const s of recent) {
    const key = `${s.weekly_game_id}|${s.session_date}`
    const set = playedOn.get(key) ?? new Set<string>()
    for (const p of att.players.get(s.id)!) set.add(p)
    playedOn.set(key, set)
  }
  const showUp: Rate = { of: 0, yes: 0 }
  for (const b of bookings) {
    if (b.answer !== 'yes' || !mine(b.weekly_game_id)) continue
    const set = playedOn.get(`${b.weekly_game_id}|${b.game_date}`)
    if (!set) continue
    showUp.of++
    if (set.has(b.player_id)) showUp.yes++
  }

  // This term.
  const term = termOf(today)
  const inTerm = (d: string) => d >= term.start && d <= term.end
  const held = sessions.filter(s => inTerm(s.session_date)).length
  const reasons = new Map<string, number>()
  const seen = new Set<string>()
  for (const c of cancellations) {
    if (c.kind !== 'cancelled' || !mine(c.weekly_game_id) || !inTerm(c.game_date) || c.game_date > today) continue
    const key = `${c.weekly_game_id}|${c.game_date}`
    if (seen.has(key)) continue
    seen.add(key)
    const r = c.reason ?? 'other'
    reasons.set(r, (reasons.get(r) ?? 0) + 1)
  }
  const cancelled = [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count)

  const newPlayers = newThisTerm(att, gameId, today).length

  return { turnUp, sessions8: recent.length, trend, regulars, comeback, showUp, held, cancelled, newPlayers }
}

/** Players whose first game anywhere fell in this term (and was this game, when given). */
export function newThisTerm(att: Attendance, gameId: string | null, today: string): string[] {
  const term = termOf(today)
  return [...att.first].filter(([, f]) =>
    f.date >= term.start && f.date <= today && (gameId === null || f.gameId === gameId)).map(([id]) => id)
}

/** Reach: the new players this term by age, sex, ethnicity and deprivation. Head only. */
export function reach(att: Attendance, gameId: string | null, people: ReadonlyMap<string, Person>, today: string): Reach {
  // Age at their first game.
  return reachOf(newThisTerm(att, gameId, today), people, id => att.first.get(id)!.date)
}

/** Reach of any set of players, each aged on the date `ageDate` gives. Head only. */
export function reachOf(ids: Iterable<string>, people: ReadonlyMap<string, Person>, ageDate: (id: string) => string): Reach {
  const r: Reach = { total: 0, age: new Map(), sex: new Map(), ethnicity: new Map(), deprivation: new Map() }
  const bump = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1)
  for (const id of ids) {
    const p = people.get(id)
    r.total++
    bump(r.age, ageBand(ageOn(p?.dob ?? null, ageDate(id))))
    bump(r.sex, sexOf(p?.gender))
    for (const g of ethnicGroups(p?.ethnicity)) bump(r.ethnicity, g)
    bump(r.deprivation, quintile(p?.decile))
  }
  return r
}

// ── A period (the exports, step 14) ──────────────────────────────────────────
// The same definitions over a chosen period and set of games (a programme).

export type PeriodSummary = {
  sessions: number
  /** Player-games: each player once per session. */
  attendances: number
  players: string[]
  turnUp: number | null
  /** Played 3 or more of the last 6 sessions of these games up to the end. */
  regulars: number
  /** First game anywhere in the period, at one of these games. */
  newPlayers: string[]
  /** New players whose six weeks ended by the end of the period. */
  comeback: Rate
  showUp: Rate
  cancelled: { reason: string; count: number }[]
}

export function periodSummary(args: {
  att: Attendance
  games: ReadonlySet<string>
  from: string
  to: string
  bookings: readonly Booking[]
  cancellations: readonly Cancellation[]
}): PeriodSummary {
  const { att, games, from, to, bookings, cancellations } = args
  const mine = (id: string | null) => id != null && games.has(id)
  const all = att.sessions.filter(s => mine(s.weekly_game_id) && s.session_date <= to)
  const inside = all.filter(s => s.session_date >= from)
  const players = new Set<string>()
  let attendances = 0
  for (const s of inside) for (const p of att.players.get(s.id)!) { players.add(p); attendances++ }

  const times = new Map<string, number>()
  for (const s of all.slice(-REGULAR_OF)) for (const p of att.players.get(s.id)!) times.set(p, (times.get(p) ?? 0) + 1)
  const regulars = [...times.values()].filter(n => n >= REGULAR_MIN).length

  const newPlayers = [...att.first].filter(([, f]) => mine(f.gameId) && f.date >= from && f.date <= to).map(([id]) => id)
  const comeback: Rate = { of: 0, yes: 0 }
  for (const id of newPlayers) {
    const f = att.first.get(id)!
    if (addDays(f.date, COMEBACK_DAYS) > to) continue
    comeback.of++
    const until = addDays(f.date, COMEBACK_DAYS)
    if ((att.dates.get(id) ?? []).filter(d => d > f.date && d <= until).length >= COMEBACK_RETURNS) comeback.yes++
  }

  const playedOn = new Map<string, Set<string>>()
  for (const s of inside) {
    const key = `${s.weekly_game_id}|${s.session_date}`
    const set = playedOn.get(key) ?? new Set<string>()
    for (const p of att.players.get(s.id)!) set.add(p)
    playedOn.set(key, set)
  }
  const showUp: Rate = { of: 0, yes: 0 }
  for (const b of bookings) {
    if (b.answer !== 'yes' || !mine(b.weekly_game_id)) continue
    const set = playedOn.get(`${b.weekly_game_id}|${b.game_date}`)
    if (!set) continue
    showUp.of++
    if (set.has(b.player_id)) showUp.yes++
  }

  const reasons = new Map<string, number>()
  const seen = new Set<string>()
  for (const c of cancellations) {
    if (c.kind !== 'cancelled' || !mine(c.weekly_game_id) || c.game_date < from || c.game_date > to) continue
    const key = `${c.weekly_game_id}|${c.game_date}`
    if (seen.has(key)) continue
    seen.add(key)
    reasons.set(c.reason ?? 'other', (reasons.get(c.reason ?? 'other') ?? 0) + 1)
  }

  return {
    sessions: inside.length, attendances, players: [...players],
    turnUp: inside.length ? attendances / inside.length : null,
    regulars, newPlayers, comeback, showUp,
    cancelled: [...reasons].map(([reason, count]) => ({ reason, count })).sort((a, b) => b.count - a.count),
  }
}

/** The games a Kaiārahi sees: every one for a head; otherwise those they regularly lead or ran in the last 8 weeks. */
export function gamesFor(args: {
  me: string
  head: boolean
  games: readonly { id: string; regular_kaiarahi_id?: string | null }[]
  sessions: readonly ScoredSession[]
  today: string
}): string[] {
  const { me, head, games, sessions, today } = args
  if (head) return games.map(g => g.id)
  const since = addDays(today, -7 * TREND_WEEKS + 1)
  const ran = new Set(sessions.filter(s => s.judge_id === me && s.session_date >= since && s.weekly_game_id).map(s => s.weekly_game_id!))
  return games.filter(g => g.regular_kaiarahi_id === me || ran.has(g.id)).map(g => g.id)
}

export const REASON_LABEL: Record<string, string> = {
  weather: 'Weather', no_kaiarahi: 'No Kaiārahi', few_players: 'Too few players', venue: 'Venue', other: 'Other',
}

/** "67%" or "–" with nothing to count. */
export function percent(r: Rate): string {
  return r.of ? `${Math.round((100 * r.yes) / r.of)}%` : '–'
}
