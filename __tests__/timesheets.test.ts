// ── Timesheets (multi-location step 12) ─────────────────────────────────────
// What this pins:
//   1. Fortnights from Monday 8 Feb 2027, mirrored in pay_period_start.
//   2. A line's status: Don't pay is never exported; held lines wait.
//   3. The two CSVs carry approved, paid lines only, totalled per group.
//   4. The migration: lines only at a funded game's start, for a Kaimahi or a
//      Kaiwhakawā; no write policy; held reasons; approval after the end.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  csvByKaiarahi, csvByProgramme, defaultPeriod, formatMinutes, lineStatus, periodEnd, periodEnded, periodStart,
  summarise, type TimesheetLine,
} from '@/lib/timesheets'

const line = (over: Partial<TimesheetLine>): TimesheetLine => ({
  id: Math.random().toString(36), player_id: 'a', name: 'Aroha', weekly_game_id: 'g', site_name: 'Hagley Park',
  programme_id: 'p', programme_name: 'Rangatahi', game_date: '2027-02-09', role: 'lead', minutes: 150,
  source: 'start', players: 8, held: null, decision: null, query_note: null, query_at: null, answer: null,
  settled_at: null, approved_at: '2027-02-22T01:00:00Z', ...over,
})

describe('fortnights', () => {
  it('start on Monday 8 Feb 2027 and run fourteen days', () => {
    expect(periodStart('2027-02-08')).toBe('2027-02-08')
    expect(periodStart('2027-02-21')).toBe('2027-02-08')
    expect(periodStart('2027-02-22')).toBe('2027-02-22')
    expect(periodEnd('2027-02-08')).toBe('2027-02-21')
  })

  it('count back before the first one', () => {
    expect(periodStart('2027-02-07')).toBe('2027-01-25')
    expect(periodStart('2026-11-25')).toBe('2026-11-16')
  })

  it('can be approved from the Monday after', () => {
    expect(periodEnded('2027-02-08', '2027-02-21')).toBe(false)
    expect(periodEnded('2027-02-08', '2027-02-22')).toBe(true)
  })

  it('open on the last ended fortnight, or the first before it ends', () => {
    expect(defaultPeriod('2026-11-25')).toBe('2027-02-08')
    expect(defaultPeriod('2027-02-15')).toBe('2027-02-08')
    expect(defaultPeriod('2027-02-23')).toBe('2027-02-08')
    expect(defaultPeriod('2027-03-08')).toBe('2027-02-22')
  })
})

describe('a line', () => {
  it('is Don\'t pay, approved, held or ready', () => {
    expect(lineStatus({ decision: 'no_pay', approved_at: 'x', held: null })).toBe('unpaid')
    expect(lineStatus({ decision: null, approved_at: 'x', held: null })).toBe('approved')
    expect(lineStatus({ decision: null, approved_at: null, held: 'no_players' })).toBe('held')
    expect(lineStatus({ decision: 'pay', approved_at: null, held: null })).toBe('ready')
  })

  it('reads hours plainly', () => {
    expect(formatMinutes(150)).toBe('2h 30m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(45)).toBe('45m')
  })

  it('sums the fortnight, leaving Don\'t pay out of the hours', () => {
    const s = summarise([line({}), line({ approved_at: null }), line({ approved_at: null, held: 'query' }), line({ decision: 'no_pay' })])
    expect(s).toEqual({ approved: 1, ready: 1, held: 1, unpaid: 1, minutes: 450 })
  })
})

describe('the export', () => {
  const lines = [
    line({ player_id: 'a', name: 'Aroha', game_date: '2027-02-11' }),
    line({ player_id: 'a', name: 'Aroha', game_date: '2027-02-09', role: 'second', programme_id: 'q', programme_name: 'Schools, "Term 1"' }),
    line({ player_id: 'b', name: 'Ben', minutes: 120 }),
    line({ player_id: 'b', name: 'Ben', approved_at: null }),
    line({ player_id: 'c', name: 'Cara', decision: 'no_pay' }),
  ]

  it('per Kaiārahi: a total, then each approved line', () => {
    const csv = csvByKaiarahi(lines, '2027-02-08').split('\r\n')
    expect(csv[0]).toBe('Fortnight,2027-02-08 to 2027-02-21')
    expect(csv[2]).toBe('Kaiārahi,Date,Game,Programme,Role,Hours')
    expect(csv.slice(3, 9)).toEqual([
      'Aroha,,,,Total,5.00',
      'Aroha,2027-02-09,Hagley Park,"Schools, ""Term 1""",Second adult,2.50',
      'Aroha,2027-02-11,Hagley Park,Rangatahi,Lead,2.50',
      'Ben,,,,Total,2.00',
      'Ben,2027-02-09,Hagley Park,Rangatahi,Lead,2.00',
      '',
    ])
    expect(csv.join('\n')).not.toContain('Cara')
  })

  it('per programme: a total, then each approved line', () => {
    const csv = csvByProgramme(lines, '2027-02-08').split('\r\n')
    expect(csv.slice(3, 8)).toEqual([
      'Rangatahi,,,,Total,4.50',
      'Rangatahi,2027-02-09,Hagley Park,Ben,Lead,2.00',
      'Rangatahi,2027-02-11,Hagley Park,Aroha,Lead,2.50',
      '"Schools, ""Term 1""",,,,Total,2.50',
      '"Schools, ""Term 1""",2027-02-09,Hagley Park,Aroha,Second adult,2.50',
    ])
  })
})

describe('timesheets migration', () => {
  const sql = readFileSync('supabase/migrations/20261124223426_timesheets.sql', 'utf8')

  it('counts fortnights from 8 Feb 2027, as the browser does', () => {
    expect(sql).toMatch(/DATE '2027-02-08' \+ 14 \* floor\(\(p_date - DATE '2027-02-08'\) \/ 14\.0\)::int/)
  })

  it('has no write policy and no insert or update grant', () => {
    expect(sql).toMatch(/REVOKE ALL ON public\.timesheet_lines FROM anon, authenticated;/)
    expect(sql).toMatch(/GRANT SELECT ON public\.timesheet_lines TO authenticated;/)
    expect(sql).not.toMatch(/ON public\.timesheet_lines FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(sql).toMatch(/USING \(player_id = auth\.uid\(\) OR public\.is_judge\(\)\)/)
  })

  it('makes lines at the start of a funded game, for paid levels only', () => {
    expect(sql).toMatch(/AFTER INSERT ON public\.sessions/)
    expect(sql).toMatch(/g\.kind <> 'funded' OR g\.paid_block_minutes IS NULL/)
    expect(sql).toMatch(/k\.level IN \('head', 'staff'\) AND k\.suspended_at IS NULL/)
    // Both adults get the same block (Tāne, 25 Nov 2026).
    expect(sql.match(/'(lead|second)', g\.paid_block_minutes, 'start'/g)).toHaveLength(2)
  })

  it('holds a queried line and a game nobody scored in', () => {
    expect(sql).toMatch(/THEN 'query'/)
    expect(sql).toMatch(/THEN 'no_players'/)
    expect(sql).toMatch(/AND public\.timesheet_held_reason\(l\.id\) IS NULL/)
    expect(sql).toMatch(/this fortnight has not ended yet/)
  })

  it('pins search_path on every definer function and keeps anon out', () => {
    const definers = sql.split('CREATE OR REPLACE FUNCTION').slice(1).filter(f => /SECURITY DEFINER/.test(f.split('AS $function$')[0]))
    expect(definers.length).toBeGreaterThanOrEqual(8)
    for (const f of definers) expect(f.split('AS $function$')[0]).toMatch(/SET search_path TO 'public'/)
    for (const fn of ['timesheet_period(date)', 'query_timesheet_line(uuid, text)', 'approve_timesheet_period(date)',
      'settle_timesheet_line(uuid, boolean, integer, text)', 'add_timesheet_line(uuid, uuid, date, text, integer, text)']) {
      expect(sql).toContain(`REVOKE EXECUTE ON FUNCTION public.${fn} FROM PUBLIC, anon;`)
    }
  })
})
