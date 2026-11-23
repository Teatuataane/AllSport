import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { levelFrom, isHead, isKaiarahi, runsSession, LEVEL_NAME, KAIARAHI_LEVELS } from '@/lib/kaiarahi'

const MIGRATION = readFileSync(
  join(__dirname, '..', 'supabase', 'migrations', '20261123024501_kaiarahi_levels.sql'), 'utf8')

describe('Kaiārahi levels', () => {
  it('names the three levels as Tāne chose (23 Nov 2026)', () => {
    expect(KAIARAHI_LEVELS).toEqual(['head', 'staff', 'community'])
    expect(LEVEL_NAME).toEqual({ head: 'Kaiwhakawā', staff: 'Kaimahi', community: 'Kaiako' })
  })

  it('reads the old judge role as a head only until the table is live', () => {
    expect(levelFrom(undefined, 'judge')).toBe('head')
    expect(levelFrom(undefined, 'player')).toBeNull()
    // Live: the row decides, and the old role grants nothing.
    expect(levelFrom(null, 'judge')).toBeNull()
    expect(levelFrom({ level: 'staff', suspended_at: null }, 'player')).toBe('staff')
  })

  it('gives a suspended Kaiārahi no level, and ignores an unknown one', () => {
    expect(levelFrom({ level: 'head', suspended_at: '2026-11-23T00:00:00Z' }, 'judge')).toBeNull()
    expect(levelFrom({ level: 'boss', suspended_at: null }, null)).toBeNull()
  })

  it('lets a head run any game and others only the game they started', () => {
    expect(runsSession('head', 'me', 'someone')).toBe(true)
    expect(runsSession('head', 'me', null)).toBe(true)
    expect(runsSession('staff', 'me', 'me')).toBe(true)
    expect(runsSession('community', 'me', 'me')).toBe(true)
    expect(runsSession('staff', 'me', 'someone')).toBe(false)
    expect(runsSession('staff', 'me', null)).toBe(false)
    expect(runsSession(null, 'me', 'me')).toBe(false)
    expect(isHead('staff')).toBe(false)
    expect(isKaiarahi('community')).toBe(true)
    expect(isKaiarahi(null)).toBe(false)
  })
})

describe('the levels migration', () => {
  it('makes is_judge() a current head from the kaiarahi row, not players.role', () => {
    const def = MIGRATION.slice(MIGRATION.indexOf('CREATE OR REPLACE FUNCTION public.is_judge()'))
    const body = def.slice(0, def.indexOf('$function$;'))
    expect(body).toMatch(/FROM kaiarahi/)
    expect(body).toMatch(/level = 'head'/)
    expect(body).toMatch(/suspended_at IS NULL/)
    expect(body).not.toMatch(/role = 'judge'/)
  })

  it('makes every existing judge a head, so nothing changes on the day', () => {
    expect(MIGRATION).toMatch(/INSERT INTO public\.kaiarahi[\s\S]*SELECT id, 'head', 'founder' FROM public\.players WHERE role = 'judge'/)
  })

  it('widens only the rules about running a game to runs_session', () => {
    for (const policy of [
      'sessions_update_judge', 'session_events_insert_judge', 'session_events_delete_judge',
      'results_insert_own', 'results_update_judge_own', 'results_delete_judge_own', 'sps_select_judge',
    ]) {
      const at = MIGRATION.indexOf(`CREATE POLICY ${policy} `)
      expect(at, policy).toBeGreaterThan(-1)
      expect(MIGRATION.slice(at, MIGRATION.indexOf(';', at)), policy).toMatch(/runs_session\(/)
    }
    // Deleting a game outright stays with a head.
    const del = MIGRATION.indexOf('CREATE POLICY sessions_delete_judge ')
    expect(MIGRATION.slice(del, MIGRATION.indexOf(';', del))).toMatch(/public\.is_judge\(\)/)
  })

  it('keeps voiding and handing a game on with a head (Tāne, 23 Nov 2026)', () => {
    expect(MIGRATION).toMatch(/only a Kaiwhakawā can void a game/)
    expect(MIGRATION).toMatch(/only a Kaiwhakawā can hand a game to someone else/)
    // Fires after mark_session_voided has stamped voided_at.
    expect('session_zz_runner_guard' > 'session_void_recorded').toBe(true)
    expect(MIGRATION).toMatch(/CREATE TRIGGER session_zz_runner_guard\s+BEFORE INSERT OR UPDATE ON public\.sessions/)
  })

  it('refuses to leave no head', () => {
    for (const fn of ['grant_kaiarahi', 'suspend_kaiarahi', 'remove_kaiarahi']) {
      const at = MIGRATION.indexOf(`FUNCTION public.${fn}(`)
      const body = MIGRATION.slice(at, MIGRATION.indexOf('$function$;', at))
      expect(body, fn).toMatch(/kaiarahi_heads_left/)
      expect(body, fn).toMatch(/IF NOT public\.is_judge\(\)/)
    }
  })

  it('leaves no policy or function granting a power from players.role', () => {
    // The check block asserts this against the live catalogue when applied.
    expect(MIGRATION).toMatch(/policies still read players\.role/)
    expect(MIGRATION).toMatch(/functions still read players\.role/)
    // From the new rules up to the check block, which counts judges on purpose.
    const afterBackfill = MIGRATION.slice(MIGRATION.indexOf('-- ── 2. Who holds what'), MIGRATION.indexOf('-- ── 7. Check'))
    const code = afterBackfill.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    expect(code.replace(/role = ''judge''/g, '')).not.toMatch(/role = 'judge'/)
  })

  it('pins search_path on every definer function it creates', () => {
    const defs = MIGRATION.split('CREATE OR REPLACE FUNCTION').slice(1)
    for (const d of defs) {
      if (/SECURITY DEFINER/.test(d.slice(0, d.indexOf('AS $function$')))) {
        expect(d.slice(0, d.indexOf('AS $function$')), d.slice(0, 60)).toMatch(/SET search_path/)
      }
    }
  })

  it('is the only migration with its timestamp', () => {
    const stamps = readdirSync(join(__dirname, '..', 'supabase', 'migrations')).map(f => f.slice(0, 14))
    expect(stamps.filter(s => s === '20261123024501')).toHaveLength(1)
  })
})

describe('the app reads levels, not the role', () => {
  const read = (p: string) => readFileSync(join(__dirname, '..', p), 'utf8')
  it('no screen grants anything from players.role', () => {
    for (const p of [
      'lib/useNavState.ts', 'app/dashboard/page.tsx', 'app/judge/page.tsx', 'app/scoring/[sessionId]/page.tsx',
      'app/workout/new/page.tsx', 'app/workout/[id]/page.tsx', 'app/vote/[voteId]/results/page.tsx',
      'app/components/JudgeCard.tsx',
    ]) {
      expect(read(p), p).not.toMatch(/role\s*(===|!==)\s*'judge'/)
    }
  })
})
