import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  leadFor, canLeadGame, startableToday, openCovers, unfilledAlerts, minutesUntil, reasonReady, untilLabel,
  type RosterRow, type Me,
} from '@/lib/roster'
import type { WeeklyGame } from '@/lib/weeklyGames'

// November is NZDT (UTC+13). 2026-11-24 is a Tuesday.
const nz = (iso: string) => new Date(`${iso}+13:00`)
const NOW = nz('2026-11-24T09:00:00')

const game = (id: string, over: Partial<WeeklyGame> = {}): WeeklyGame =>
  ({ id, site_id: 's', dow: 5, start_time: '15:15:00', is_active: true, kind: 'funded', created_by: 'head', regular_kaiarahi_id: 'staff', ...over })
const row = (over: Partial<RosterRow>): RosterRow => ({
  id: Math.random().toString(36), weekly_game_id: 'f', game_date: '2026-11-27', role: 'lead',
  player_id: 'staff', helper_name: null, status: 'cover_needed', claimed_by: null, claimed_at: null, note: null, ...over,
})
const me = (id: string, level: Me['level'], checksCurrent = true): Me => ({ id, level, checksCurrent })

describe('leadFor (mirrors rostered_lead)', () => {
  const f = game('f')
  it('is the regular with no roster row', () => {
    expect(leadFor(f, '2026-11-27', [])).toBe('staff')
  })
  it('is nobody while cover is needed', () => {
    expect(leadFor(f, '2026-11-27', [row({})])).toBeNull()
  })
  it('is the claimer once covered, and the rostered person when rostered', () => {
    expect(leadFor(f, '2026-11-27', [row({ status: 'covered', claimed_by: 'kai' })])).toBe('kai')
    expect(leadFor(f, '2026-11-27', [row({ status: 'rostered', player_id: 'other' })])).toBe('other')
  })
  it('only reads the row for that date', () => {
    expect(leadFor(f, '2026-12-04', [row({})])).toBe('staff')
  })
  it('is the creator of a community game with no regular, nobody for a funded one', () => {
    expect(leadFor(game('c', { kind: 'community', created_by: 'kaiako', regular_kaiarahi_id: null }), '2026-11-27', [])).toBe('kaiako')
    expect(leadFor(game('f', { regular_kaiarahi_id: null }), '2026-11-27', [])).toBeNull()
  })
})

describe('canLeadGame (mirrors can_lead_game)', () => {
  it('lets any Kaiārahi lead a community game', () => {
    expect(canLeadGame(me('k', 'community', false), { kind: 'community' })).toBe(true)
  })
  it('needs a Kaimahi or Kaiwhakawā with current checks for a funded game', () => {
    expect(canLeadGame(me('k', 'community'), { kind: 'funded' })).toBe(false)
    expect(canLeadGame(me('s', 'staff', false), { kind: 'funded' })).toBe(false)
    expect(canLeadGame(me('s', 'staff'), { kind: 'funded' })).toBe(true)
    expect(canLeadGame(me('x', null), { kind: 'community' })).toBe(false)
  })
})

describe('startableToday (mirrors can_start_game)', () => {
  const f = game('f')
  const c = game('c', { kind: 'community', created_by: 'kaiako', regular_kaiarahi_id: null })
  it('lets a Kaiwhakawā start anything', () => {
    expect(startableToday([f, c], me('head', 'head', false), [], '2026-11-27').map(g => g.id)).toEqual(['f', 'c'])
  })
  it('lets the lead of the day start it, and nobody else', () => {
    expect(startableToday([f, c], me('staff', 'staff'), [], '2026-11-27').map(g => g.id)).toEqual(['f'])
    expect(startableToday([f, c], me('kaiako', 'community'), [], '2026-11-27').map(g => g.id)).toEqual(['c'])
    expect(startableToday([f], me('staff', 'staff'), [row({})], '2026-11-27')).toEqual([])
  })
  it('refuses a funded lead whose checks lapsed', () => {
    expect(startableToday([f], me('staff', 'staff', false), [], '2026-11-27')).toEqual([])
  })
})

describe('covers and alerts', () => {
  const f = game('f')
  const c = game('c', { kind: 'community', start_time: '10:00:00' })
  it('counts minutes to the start in NZ time', () => {
    expect(minutesUntil(f, '2026-11-24', NOW)).toBe(375)
    expect(minutesUntil(f, '2026-11-27', NOW)).toBe(3 * 1440 + 375)
  })
  it('offers a cover to those who may lead it, not to the one who asked', () => {
    const rows = [row({}), row({ weekly_game_id: 'c', player_id: 'kaiako' })]
    expect(openCovers([f, c], rows, me('kai2', 'community'), NOW).map(o => o.game.id)).toEqual(['c'])
    expect(openCovers([f, c], rows, me('staff', 'staff'), NOW).map(o => o.game.id)).toEqual(['c'])
    expect(openCovers([f, c], rows, me('staff2', 'staff'), NOW).map(o => o.game.id)).toEqual(['c', 'f'])
  })
  it('drops covers that have started', () => {
    expect(openCovers([f], [row({ game_date: '2026-11-24' })], me('s2', 'staff'), nz('2026-11-24T16:00:00'))).toEqual([])
  })
  it('warns at 48 hours and asks for a decision at 4', () => {
    expect(unfilledAlerts([f], [row({})], NOW)).toEqual([])
    expect(unfilledAlerts([f], [row({})], nz('2026-11-25T16:00:00'))[0].stage).toBe('warn')
    expect(unfilledAlerts([f], [row({})], nz('2026-11-27T12:00:00'))[0].stage).toBe('decide')
    expect(unfilledAlerts([f], [row({ status: 'covered', claimed_by: 'x' })], nz('2026-11-27T12:00:00'))).toEqual([])
  })
  it('says when in words', () => {
    expect(untilLabel(30)).toBe('in 30 min')
    expect(untilLabel(180)).toBe('in 3 hours')
    expect(untilLabel(3 * 1440)).toBe('in 3 days')
  })
})

describe('reasons', () => {
  it('needs a reason, and a note for Other', () => {
    expect(reasonReady(null, 'x')).toBe(false)
    expect(reasonReady('weather', '')).toBe(true)
    expect(reasonReady('other', ' ')).toBe(false)
    expect(reasonReady('other', 'flooded')).toBe(true)
  })
})

describe('migration 20261123202226', () => {
  const sql = readFileSync('supabase/migrations/20261123202226_roster_and_cover.sql', 'utf8')
  it('writes the roster only through functions', () => {
    expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON public\.game_roster FROM authenticated/)
    expect(sql).toMatch(/game_roster has a write policy/)
  })
  it('narrows starting a game to the lead of the day', () => {
    expect(sql).toMatch(/COALESCE\(public\.rostered_lead\(p_game_id, \(now\(\) AT TIME ZONE 'Pacific\/Auckland'\)::date\) = auth\.uid\(\), false\)/)
  })
  it('makes the first claim win', () => {
    expect(sql).toMatch(/role = 'lead' FOR UPDATE;\s+IF NOT FOUND OR r\.status <> 'cover_needed'/)
  })
  it('needs a reason to cancel or move, and refuses a cancel once started', () => {
    expect(sql).toMatch(/game_notices_reason_needed CHECK \(kind NOT IN \('cancelled', 'moved'\) OR reason IS NOT NULL\)/)
    expect(sql).toMatch(/void it instead of cancelling/)
  })
  it('pins search_path on every definer function', () => {
    const definers = sql.match(/SECURITY DEFINER[\s\S]*?\$function\$/g) ?? []
    expect(definers.length).toBeGreaterThan(5)
    for (const d of definers) expect(d).toMatch(/SET search_path/)
  })
})

// ── Second adult (step 7b) ───────────────────────────────────────────────────
import { ageOn, secondAdultRule, secondReady } from '@/lib/roster'

describe('ageOn', () => {
  it('counts whole years, turning on the birthday', () => {
    expect(ageOn('2009-11-24', '2026-11-24')).toBe(17)
    expect(ageOn('2009-11-25', '2026-11-24')).toBe(16)
    expect(ageOn(null, '2026-11-24')).toBeNull()
  })
})

describe('secondAdultRule (mirrors session_start_blocker)', () => {
  it('asks for a second at a two-adult game, whoever runs it', () => {
    expect(secondAdultRule({ two_adults: true }, { level: 'head', age: 40 })).toEqual({ needed: true, mustBeAdult: false })
  })
  it('asks a Kaiako under 18 for an adult second at any game', () => {
    expect(secondAdultRule({ two_adults: false }, { level: 'community', age: 17 })).toEqual({ needed: true, mustBeAdult: true })
    expect(secondAdultRule(null, { level: 'community', age: 16 })).toEqual({ needed: true, mustBeAdult: true })
  })
  it('asks nothing of an adult, or of a Kaiako whose age is unknown, at an ordinary game', () => {
    expect(secondAdultRule({ two_adults: false }, { level: 'community', age: 18 })).toEqual({ needed: false, mustBeAdult: false })
    expect(secondAdultRule({ two_adults: false }, { level: 'community', age: null })).toEqual({ needed: false, mustBeAdult: false })
  })
})

describe('secondReady', () => {
  it('needs a Kaiārahi or a named helper', () => {
    expect(secondReady(null, false)).toBe(false)
    expect(secondReady({ kind: 'kaiarahi', playerId: 'k' }, true)).toBe(true)
    expect(secondReady({ kind: 'helper', name: ' ', adult: true }, false)).toBe(false)
    expect(secondReady({ kind: 'helper', name: 'Ms T', adult: false }, false)).toBe(true)
  })
  it('needs the helper confirmed 18 or over for a young Kaiako', () => {
    expect(secondReady({ kind: 'helper', name: 'Ms T', adult: false }, true)).toBe(false)
    expect(secondReady({ kind: 'helper', name: 'Ms T', adult: true }, true)).toBe(true)
  })
})

describe('migration 20261123205536', () => {
  const sql = readFileSync('supabase/migrations/20261123205536_two_adults.sql', 'utf8')
  it('keeps ages private', () => {
    expect(sql).toMatch(/REVOKE EXECUTE ON FUNCTION public\.age_today\(uuid\), public\.second_is_adult\(uuid, date\) FROM authenticated/)
  })
  it('answers the start check only about the caller', () => {
    const fn = sql.slice(sql.indexOf('FUNCTION public.session_start_blocker'), sql.indexOf('REVOKE EXECUTE ON FUNCTION public.session_start_blocker'))
    expect(fn).toMatch(/age_today\(auth\.uid\(\)\)/)
    expect(fn).not.toMatch(/p_player/)
  })
  it('guards the start after the runner is stamped', () => {
    expect('session_zzz_adults_guard' > 'session_zz_runner_guard').toBe(true)
    expect(sql).toMatch(/CREATE TRIGGER session_zzz_adults_guard\s+BEFORE INSERT ON public\.sessions/)
  })
  it('keeps Kaiārahi 16 and over, and Kaimahi 18 and over', () => {
    expect(sql).toMatch(/must be 16 or over/)
    expect(sql).toMatch(/Kaimahi or Kaiwhakawā must be 18 or over/)
  })
  it('does not enforce the parent-present rule (Tāne, 24 Nov 2026)', () => {
    expect(sql).toMatch(/parent-present rule for juniors is NOT enforced/)
  })
})
