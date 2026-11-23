// ── Bookings: "Coming?" (multi-location step 8) ─────────────────────────────
// What this pins:
//   1. HOME asks from 4pm the day before until the start, and answers close at the start.
//   2. The counts line and the "Still on?" prompt two hours out under four.
//   3. A second tap takes an answer back; counts move with an answer.
//   4. The migration: answers only through set_booking, counts never names,
//      away dates copied as a No, and anon shut out.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  adjustCounts, askOpen, canAnswer, countsLine, fewComingPrompt, nextAnswer, questionLabel,
} from '@/lib/bookings'

const sat = { start_time: '09:00:00' }
const tue = { start_time: '16:30:00' }
const at = (iso: string) => new Date(iso)

describe('when to ask', () => {
  it('opens at 4pm the day before and closes at the start', () => {
    expect(askOpen(sat, '2026-11-21', at('2026-11-20T15:59:00+13:00'))).toBe(false)
    expect(askOpen(sat, '2026-11-21', at('2026-11-20T16:00:00+13:00'))).toBe(true)
    expect(askOpen(sat, '2026-11-21', at('2026-11-21T08:59:00+13:00'))).toBe(true)
    expect(askOpen(sat, '2026-11-21', at('2026-11-21T09:00:00+13:00'))).toBe(false)
    expect(askOpen(sat, '2026-11-21', at('2026-11-18T18:00:00+13:00'))).toBe(false)
  })

  it('takes answers any time before the start, none after', () => {
    expect(canAnswer(tue, '2026-11-24', at('2026-11-17T10:00:00+13:00'))).toBe(true)
    expect(canAnswer(tue, '2026-11-24', at('2026-11-24T16:29:00+13:00'))).toBe(true)
    expect(canAnswer(tue, '2026-11-24', at('2026-11-24T16:30:00+13:00'))).toBe(false)
  })

  it('words the question by the day', () => {
    const now = at('2026-11-20T17:00:00+13:00')
    expect(questionLabel('2026-11-20', now)).toBe('Coming today?')
    expect(questionLabel('2026-11-21', now)).toBe('Coming tomorrow?')
    expect(questionLabel('2026-11-24', now)).toBe('Coming Tue 24 Nov?')
  })
})

describe('counts', () => {
  it('says only what is there', () => {
    expect(countsLine({ coming: 6, notComing: 3, unanswered: 11 })).toBe("6 coming · 3 not · 11 haven't said")
    expect(countsLine({ coming: 2, notComing: 0, unanswered: 0 })).toBe('2 coming')
    expect(countsLine({ coming: 0, notComing: 0, unanswered: 0 })).toBeNull()
    expect(countsLine(null)).toBeNull()
  })

  it('asks the Kaiārahi "Still on?" two hours out with fewer than four coming', () => {
    const c = (coming: number) => ({ coming, notComing: 0, unanswered: 5 })
    const twoHoursOut = at('2026-11-21T07:00:00+13:00')
    expect(fewComingPrompt(sat, '2026-11-21', c(2), twoHoursOut)).toBe('Only 2 coming. Still on?')
    expect(fewComingPrompt(sat, '2026-11-21', c(0), twoHoursOut)).toBe('Nobody has said they are coming. Still on?')
    expect(fewComingPrompt(sat, '2026-11-21', c(4), twoHoursOut)).toBeNull()
    expect(fewComingPrompt(sat, '2026-11-21', c(2), at('2026-11-21T06:59:00+13:00'))).toBeNull()
    expect(fewComingPrompt(sat, '2026-11-21', c(2), at('2026-11-21T09:00:00+13:00'))).toBeNull()
    expect(fewComingPrompt(sat, '2026-11-21', c(2), twoHoursOut, true)).toBeNull()
    expect(fewComingPrompt(sat, '2026-11-21', null, twoHoursOut)).toBeNull()
  })

  it('takes an answer back on a second tap', () => {
    expect(nextAnswer(undefined, 'yes')).toBe('yes')
    expect(nextAnswer('yes', 'yes')).toBeNull()
    expect(nextAnswer('yes', 'no')).toBe('no')
  })

  it('moves the counts with an answer', () => {
    const c = { coming: 1, notComing: 1, unanswered: 3 }
    expect(adjustCounts(c, undefined, 'yes', true)).toEqual({ coming: 2, notComing: 1, unanswered: 2 })
    expect(adjustCounts(c, 'yes', 'no', true)).toEqual({ coming: 0, notComing: 2, unanswered: 3 })
    expect(adjustCounts(c, 'no', null, true)).toEqual({ coming: 1, notComing: 0, unanswered: 4 })
    // A walk-up who is not registered was never in "haven't said".
    expect(adjustCounts(c, undefined, 'yes', false)).toEqual({ coming: 2, notComing: 1, unanswered: 3 })
  })
})

describe('bookings migration', () => {
  const sql = readFileSync('supabase/migrations/20261123214052_bookings.sql', 'utf8')

  it('lets answers in only through set_booking, for yourself or your children', () => {
    expect(sql).toMatch(/GRANT SELECT ON public\.game_bookings TO authenticated;/)
    expect(sql).not.toMatch(/GRANT[^;]*(INSERT|UPDATE|DELETE)[^;]*game_bookings/)
    expect(sql).not.toMatch(/CREATE POLICY[^;]*game_bookings FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(sql).toMatch(/p_player_id = auth\.uid\(\)\s+OR EXISTS \(SELECT 1 FROM players WHERE id = p_player_id AND parent_id = auth\.uid\(\)\)/)
    expect(sql).toMatch(/that game has started/)
    expect(sql).toMatch(/the game is not on that date/)
  })

  it('gives players counts, never names, and anon nothing', () => {
    expect(sql).toMatch(/RETURNS TABLE \(weekly_game_id uuid, game_date date, coming integer, not_coming integer, unanswered integer\)/)
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.set_booking\(uuid, date, uuid, text\), public\.booking_counts\(uuid\[\], date\[\]\)\s+FROM PUBLIC, anon;/)
    expect(sql).toMatch(/REVOKE ALL ON public\.game_bookings FROM anon, authenticated;/)
  })

  it('turns away dates into a No and stops new ones', () => {
    expect(sql).toMatch(/INSERT INTO public\.game_bookings[\s\S]*'no'[\s\S]*FROM public\.weekly_game_absences/)
    expect(sql).toMatch(/REVOKE INSERT ON public\.weekly_game_absences FROM authenticated;/)
  })
})
