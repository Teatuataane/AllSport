import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  nextGameDate, slotLabel, formatTime, dateLabel, dayStatus, matchWeeklyGame, sortWeekly,
  addDays, nzWallClock, type GameNotice, type WeeklyGame,
} from '@/lib/weeklyGames'

// November is NZDT (UTC+13). 2026-11-17 is a Tuesday.
const nz = (iso: string) => new Date(`${iso}+13:00`)

const game = (id: string, dow: number, start_time: string, is_active = true): WeeklyGame =>
  ({ id, site_id: 's1', dow, start_time, is_active })

const notice = (over: Partial<GameNotice>): GameNotice => ({
  id: Math.random().toString(36), weekly_game_id: 'g', game_date: '2026-11-21',
  kind: 'message', message: null, created_at: '2026-11-21T08:00:00Z', ...over,
})

describe('nzWallClock', () => {
  it('reads the NZ day, not the UTC one', () => {
    // 8am Tuesday NZ is still Monday in UTC.
    expect(nzWallClock(nz('2026-11-17T08:00:00'))).toEqual({ date: '2026-11-17', dow: 2, mins: 480 })
  })
})

describe('nextGameDate', () => {
  const tue = game('t', 2, '16:30:00')
  it('is today before the game', () => {
    expect(nextGameDate(tue, nz('2026-11-17T09:00:00'))).toBe('2026-11-17')
  })
  it('is still today while the game runs', () => {
    expect(nextGameDate(tue, nz('2026-11-17T18:00:00'))).toBe('2026-11-17')
  })
  it('rolls a week once the 100 minutes are up', () => {
    expect(nextGameDate(tue, nz('2026-11-17T18:10:00'))).toBe('2026-11-24')
  })
  it('finds Saturday from Tuesday', () => {
    expect(nextGameDate(game('s', 6, '09:00'), nz('2026-11-17T09:00:00'))).toBe('2026-11-21')
  })
})

describe('labels', () => {
  it('formats times', () => {
    expect(formatTime('16:30:00')).toBe('4:30pm')
    expect(formatTime('09:00')).toBe('9:00am')
    expect(formatTime('12:15')).toBe('12:15pm')
    expect(formatTime('00:05')).toBe('12:05am')
  })
  it('names the slot', () => {
    expect(slotLabel(game('s', 6, '09:00:00'))).toBe('Saturday 9:00am')
  })
  it('names the date', () => {
    const now = nz('2026-11-17T09:00:00')
    expect(dateLabel('2026-11-17', now)).toBe('Today')
    expect(dateLabel('2026-11-18', now)).toBe('Tomorrow')
    expect(dateLabel('2026-11-21', now)).toBe('Sat 21 Nov')
  })
  it('adds days across a month end', () => {
    expect(addDays('2026-11-28', 4)).toBe('2026-12-02')
  })
})

describe('dayStatus', () => {
  it('is on with no notices', () => {
    expect(dayStatus('g', '2026-11-21', [])).toEqual({ cancelled: false, venue: null, notices: [] })
  })
  it('the newest cancel or on decides', () => {
    const ns = [
      notice({ kind: 'cancelled', message: 'Rain', created_at: '2026-11-21T06:00:00Z' }),
      notice({ kind: 'on', created_at: '2026-11-21T07:00:00Z' }),
    ]
    expect(dayStatus('g', '2026-11-21', ns).cancelled).toBe(false)
    ns.push(notice({ kind: 'cancelled', created_at: '2026-11-21T07:30:00Z' }))
    expect(dayStatus('g', '2026-11-21', ns).cancelled).toBe(true)
  })
  it('takes the newest move as the venue and ignores other dates and games', () => {
    const ns = [
      notice({ kind: 'moved', message: 'Jellie Park', created_at: '2026-11-21T06:00:00Z' }),
      notice({ kind: 'moved', message: 'Hagley Park, by the band rotunda', created_at: '2026-11-21T06:30:00Z' }),
      notice({ kind: 'moved', message: 'Wrong week', game_date: '2026-11-28' }),
      notice({ kind: 'cancelled', weekly_game_id: 'other' }),
    ]
    const s = dayStatus('g', '2026-11-21', ns)
    expect(s.venue).toBe('Hagley Park, by the band rotunda')
    expect(s.cancelled).toBe(false)
    expect(s.notices.map(n => n.message)).toEqual(['Hagley Park, by the band rotunda', 'Jellie Park'])
  })
  it('lists a wordless cancel but not a wordless back-on', () => {
    const ns = [notice({ kind: 'cancelled' }), notice({ kind: 'on', created_at: '2026-11-20T00:00:00Z' })]
    expect(dayStatus('g', '2026-11-21', ns).notices.map(n => n.kind)).toEqual(['cancelled'])
  })
})

describe('matchWeeklyGame', () => {
  const games = [game('tue', 2, '16:30:00'), game('tue-early', 2, '06:00:00'), game('sat', 6, '09:00:00'), game('old', 2, '16:00:00', false)]
  it('picks the nearest active game on the day', () => {
    expect(matchWeeklyGame(games, nz('2026-11-17T16:40:00'))?.id).toBe('tue')
    expect(matchWeeklyGame(games, nz('2026-11-17T06:20:00'))?.id).toBe('tue-early')
  })
  it('gives none far from any start or on another day', () => {
    expect(matchWeeklyGame(games, nz('2026-11-17T12:00:00'))).toBeNull()
    expect(matchWeeklyGame(games, nz('2026-11-18T16:30:00'))).toBeNull()
  })
})

describe('sortWeekly', () => {
  it('orders by weekday then time', () => {
    const s = sortWeekly([game('a', 6, '09:00'), game('b', 2, '16:30'), game('c', 2, '06:00')])
    expect(s.map(g => g.id)).toEqual(['c', 'b', 'a'])
  })
})

// The migration is the only thing standing between a player and someone else's
// registration, so its rules are pinned here as text.
describe('weekly games migration', () => {
  const sql = readFileSync('supabase/migrations/20261118010039_weekly_games.sql', 'utf8')
  it('enables RLS on every new table', () => {
    for (const t of ['sites', 'weekly_games', 'weekly_game_members', 'weekly_game_absences', 'game_notices']) {
      expect(sql).toContain(`ALTER TABLE public.${t}`)
      expect(sql).toMatch(new RegExp(`ALTER TABLE public\\.${t}\\s+ENABLE ROW LEVEL SECURITY`))
    }
  })
  it('lets only a kaiwhakawā write sites, games and notices', () => {
    expect(sql).toMatch(/sites_judge_insert[\s\S]*?is_judge\(\)/)
    expect(sql).toMatch(/weekly_games_judge_insert[\s\S]*?is_judge\(\)/)
    expect(sql).toMatch(/game_notices_judge_insert[\s\S]*?is_judge\(\) AND created_by = auth\.uid\(\)/)
  })
  it('keys registrations on can_log_for and never lets anon write', () => {
    expect(sql).toMatch(/weekly_game_members_insert[\s\S]*?can_log_for\(player_id\)/)
    expect(sql).toMatch(/REVOKE ALL ON public\.sites[\s\S]*?FROM anon, authenticated/)
    expect(sql).not.toMatch(/GRANT (INSERT|UPDATE|DELETE)[^;]*TO anon/)
  })
  it('has no delete on members, so leaving keeps the history', () => {
    expect(sql).not.toMatch(/weekly_game_members[^;]*FOR DELETE/)
  })
})

// ── Games and programmes (20261123035106) ───────────────────────────────────
import { isUpcoming, startableGames, isOneOff, gameKind } from '@/lib/weeklyGames'

describe('one-off games', () => {
  // Saturday 21 Nov 2026, 9am.
  const popUp: WeeklyGame = { ...game('p', 6, '09:00:00'), one_off_date: '2026-11-21', kind: 'community' }
  it('has one date, whatever today is', () => {
    expect(nextGameDate(popUp, nz('2026-11-17T09:00:00'))).toBe('2026-11-21')
    expect(isOneOff(popUp)).toBe(true)
  })
  it('is upcoming until its 100 minutes are over', () => {
    expect(isUpcoming(popUp, nz('2026-11-20T12:00:00'))).toBe(true)
    expect(isUpcoming(popUp, nz('2026-11-21T10:30:00'))).toBe(true)
    expect(isUpcoming(popUp, nz('2026-11-21T10:41:00'))).toBe(false)
    expect(isUpcoming(popUp, nz('2026-11-22T08:00:00'))).toBe(false)
  })
  it('is labelled by its date', () => {
    expect(slotLabel(popUp, nz('2026-11-17T09:00:00'))).toBe('Sat 21 Nov 9:00am')
  })
  it('is never matched on another Saturday', () => {
    expect(matchWeeklyGame([popUp], nz('2026-11-28T09:00:00'))).toBeNull()
    expect(matchWeeklyGame([popUp], nz('2026-11-21T09:10:00'))?.id).toBe('p')
  })
  it('sorts after the weekly games', () => {
    expect(sortWeekly([popUp, game('t', 2, '16:30')]).map(g => g.id)).toEqual(['t', 'p'])
  })
  it('reads a game from before the migration as weekly community', () => {
    expect(gameKind(game('old', 2, '16:30'))).toBe('community')
    expect(isOneOff(game('old', 2, '16:30'))).toBe(false)
  })
})

describe('startableGames (mirrors can_start_game)', () => {
  const funded: WeeklyGame = { ...game('f', 5, '15:15'), kind: 'funded', programme_id: 'prog', created_by: 'head' }
  const mine: WeeklyGame = { ...game('m', 0, '10:00'), kind: 'community', created_by: 'me' }
  const theirs: WeeklyGame = { ...game('o', 0, '11:00'), kind: 'community', created_by: 'other' }
  const all = [funded, mine, theirs]
  const ids = (who: Parameters<typeof startableGames>[1]) => startableGames(all, who).map(g => g.id)
  it('lets a Kaiwhakawā start any game', () => {
    expect(ids({ id: 'me', level: 'head', checksCurrent: false })).toEqual(['f', 'm', 'o'])
  })
  it('lets a Kaiako start only the community games they made', () => {
    expect(ids({ id: 'me', level: 'community', checksCurrent: true })).toEqual(['m'])
  })
  it('lets a Kaimahi start a funded game only with current checks', () => {
    expect(ids({ id: 'me', level: 'staff', checksCurrent: true })).toEqual(['f', 'm'])
    expect(ids({ id: 'me', level: 'staff', checksCurrent: false })).toEqual(['m'])
  })
  it('gives nobody else anything', () => {
    expect(ids({ id: 'me', level: null, checksCurrent: true })).toEqual([])
  })
})

describe('migration 20261123035106', () => {
  const sql = readFileSync('supabase/migrations/20261123035106_games_and_programmes.sql', 'utf8')
  it('ties every session to a game, with a pre-image of the backfill', () => {
    expect(sql).toMatch(/ALTER COLUMN weekly_game_id SET NOT NULL/)
    expect(sql).toMatch(/sessions_game_backfill_20261123/)
    expect(sql).toMatch(/sessions_game_backfill_20261123 ENABLE ROW LEVEL SECURITY/)
  })
  it('lets only a head make a funded game, and needs a programme for one', () => {
    expect(sql).toMatch(/weekly_games_funded_has_programme/)
    expect(sql).toMatch(/guard_weekly_games_write/)
  })
  it('starts a session only on a game the Kaiārahi may start', () => {
    expect(sql).toMatch(/is_kaiarahi\(\) AND public\.can_start_game\(weekly_game_id\)/)
  })
  it('stops the runner key from blocking account deletion', () => {
    expect(sql).toMatch(/sessions_judge_id_fkey[\s\S]{0,200}ON DELETE SET NULL/)
  })
  it('pins search_path on every definer function', () => {
    const definers = sql.match(/SECURITY DEFINER[\s\S]*?\$function\$/g) ?? []
    expect(definers.length).toBeGreaterThan(0)
    for (const d of definers) expect(d).toMatch(/SET search_path/)
  })
})
