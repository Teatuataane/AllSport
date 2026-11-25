// ── Funder and school reports (multi-location step 14) ──────────────────────
// What this pins:
//   1. The period measures use the scorecard's definitions over a programme.
//   2. A school sees names only with a parent's OK; the rest are counted, and
//      under five students hides the total games.
//   3. Groups of 1 to 4 read "fewer than 5" everywhere, wellbeing included.
//   4. The wellbeing function: head only, averages only, nothing under five.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { attendance, periodSummary, type Person, type Played, type ScoredSession } from '@/lib/successMeasures'
import {
  funderCsv, funderLines, funderReport, schoolCsv, schoolLines, schoolReport, wellbeingLines, type Student,
} from '@/lib/reports'

const s = (id: string, game: string, date: string): ScoredSession =>
  ({ id, weekly_game_id: game, session_date: date, judge_id: 'K', voided_at: null })
const sessions = [
  s('a1', 'fund', '2026-10-06'), s('a2', 'fund', '2026-10-13'), s('a3', 'fund', '2026-10-20'),
  s('a4', 'fund', '2026-11-24'), s('c1', 'comm', '2026-10-10'),
]
const p = (session: string, ...ids: string[]): Played[] => ids.map(player_id => ({ session_id: session, player_id }))
const att = attendance(sessions, [
  ...p('a1', 'A', 'B', 'C'), ...p('a2', 'A', 'B'), ...p('a3', 'A', 'B', 'D'), ...p('a4', 'A', 'E'),
  ...p('c1', 'A', 'F'),
])

describe('a programme over a period', () => {
  const summary = periodSummary({
    att, games: new Set(['fund']), from: '2026-09-26', to: '2026-11-26',
    bookings: [{ weekly_game_id: 'fund', game_date: '2026-11-24', player_id: 'E', answer: 'yes' }],
    cancellations: [{ weekly_game_id: 'fund', game_date: '2026-11-03', kind: 'cancelled', reason: 'weather' },
      { weekly_game_id: 'comm', game_date: '2026-11-07', kind: 'cancelled', reason: 'venue' }],
  })

  it('counts only that programme\'s games', () => {
    expect(summary.sessions).toBe(4)
    expect(summary.attendances).toBe(10)
    expect(summary.players.sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    expect(summary.turnUp).toBe(2.5)
    expect(summary.regulars).toBe(2) // A 4, B 3 of the last 4
    expect(summary.newPlayers.sort()).toEqual(['A', 'B', 'C', 'D', 'E'])
    // A, B came back twice within six weeks; C did not; D and E started too recently to tell.
    expect(summary.comeback).toEqual({ of: 3, yes: 2 })
    expect(summary.showUp).toEqual({ of: 1, yes: 1 })
    expect(summary.cancelled).toEqual([{ reason: 'weather', count: 1 }])
  })

  it('builds a funder report that hides groups under five', () => {
    const people = new Map<string, Person>([
      ['A', { id: 'A', dob: '2011-05-01', gender: 'Female', ethnicity: ['maori'], decile: 9 }],
    ])
    const r = funderReport({
      programme: { name: 'Rangatahi', funder: 'A trust' }, from: '2026-09-26', to: '2026-11-26', games: ['fund'],
      summary, att, people, paidMinutes: 600,
      wellbeing: { respondents: 3, who5_first: null, who5_latest: null, activity_first: null, activity_latest: null, belonging_first: null, belonging_latest: null },
    })
    const lines = Object.fromEntries(funderLines(r))
    expect(lines['Different players']).toBe('5')
    expect(lines['Regulars (3 of the last 6 games)']).toBe('fewer than 5')
    expect(lines['Paid Kaiārahi hours (approved)']).toBe('10.0')
    expect(wellbeingLines(r.wellbeing)).toEqual([['Players with two check-ins', 'fewer than 5']])
    const csv = funderCsv(r)
    expect(csv).toContain('Programme,Rangatahi')
    expect(csv).toContain('Q5 (most deprived),fewer than 5')
    // No group of people is ever a bare 1 to 4 (counts of games are not people).
    expect(csv.slice(csv.indexOf('Reach:'))).not.toMatch(/,[1-4]\r\n/)
    expect(csv).toContain('Wellbeing (first and latest check-in)')
  })

  it('says when wellbeing is not available rather than zero', () => {
    expect(wellbeingLines(null)).toEqual([['Players with two check-ins', 'not available yet']])
  })

  it('shows the wellbeing change from five who answered twice', () => {
    expect(wellbeingLines({ respondents: 6, who5_first: 52, who5_latest: 60.4, activity_first: 2, activity_latest: 3.5, belonging_first: 3.2, belonging_latest: 3.9 })).toEqual([
      ['Players with two check-ins', '6'],
      ['WHO-5 wellbeing (0 to 100)', '52.0 to 60.4 (+8.4)'],
      ['Active days a week', '2.0 to 3.5 (+1.5)'],
      ['Belonging (1 to 5)', '3.20 to 3.90 (+0.70)'],
    ])
  })
})

describe('a school report', () => {
  const students: Student[] = [
    { id: 'A', name: 'Aroha Smith', dob: '2011-05-01', consent: true },
    { id: 'B', name: 'Ben Jones', dob: '2015-02-01', consent: false },
    { id: 'C', name: 'Cara Lee', dob: '2012-01-01', consent: true },
    { id: 'Z', name: 'Zed Never', dob: '2012-01-01', consent: true }, // did not play
  ]
  const r = schoolReport({ school: 'A School', from: '2026-09-26', to: '2026-11-26', students, att })

  it('names only students whose parent agreed, and counts the rest', () => {
    expect(r.named).toEqual([{ name: 'Aroha Smith', games: 5 }, { name: 'Cara Lee', games: 1 }])
    expect(r.unnamed).toBe(1)
    expect(r.students).toBe(3)
  })

  it('hides small totals', () => {
    const lines = Object.fromEntries(schoolLines(r))
    expect(lines['Students who played']).toBe('fewer than 5')
    expect(lines['Games played (all students)']).toBe('–')
    expect(lines['Students counted only']).toBe('fewer than 5')
    const csv = schoolCsv(r)
    expect(csv).toContain('Aroha Smith,5')
    expect(csv).not.toContain('Ben Jones')
    expect(csv).not.toMatch(/thnic|ellbeing answers,|odyweight,/i)
  })
})

describe('programme wellbeing migration', () => {
  const sql = readFileSync('supabase/migrations/20261125225819_programme_wellbeing.sql', 'utf8')
  it('is head only, averages only, nothing under five', () => {
    expect(sql).toMatch(/IF NOT public\.is_judge\(\) THEN/)
    expect(sql).toMatch(/SECURITY DEFINER\s+SET search_path TO 'public'/)
    expect(sql.match(/CASE WHEN a\.c >= 5 THEN/g)).toHaveLength(6)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.programme_wellbeing\(uuid, date, date\) FROM PUBLIC, anon;/)
    const returns = sql.slice(sql.indexOf('RETURNS TABLE'), sql.indexOf('LANGUAGE plpgsql'))
    expect(returns).not.toMatch(/player/) // never returns a player
  })
})
