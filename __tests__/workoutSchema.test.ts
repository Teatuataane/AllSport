import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { EVENTS } from '@/lib/eventData'
import { BACKDATE_DAYS } from '@/lib/workouts'

// The workout logging migration holds private training logs, pins who logged
// them, and redefines delete_my_account whole. A security property that
// regresses fails silently, so these pin it.

const dir = 'supabase/migrations'
const read = (suffix: string) => {
  const f = readdirSync(dir).find(n => n.endsWith(suffix))
  if (!f) throw new Error(`no migration ending ${suffix}`)
  return readFileSync(`${dir}/${f}`, 'utf8')
}
const strip = (s: string) => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
const sql = strip(read('_workout_logging.sql'))

const fnBody = (src: string, name: string) => {
  const start = src.indexOf(`FUNCTION public.${name}`)
  return src.slice(start, src.indexOf('$$;', start))
}

describe('the workout logging schema', () => {
  it('locks all three tables and gives anon nothing', () => {
    for (const t of ['workouts', 'workout_entries', 'activity_aliases']) {
      expect(sql).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
      expect(sql).toContain(`REVOKE ALL ON public.${t} FROM anon, authenticated;`)
    }
    expect(sql).not.toMatch(/GRANT [^;]* TO anon/)
  })

  it('lets only the player, their parent or a kaiwhakawā read or write a log', () => {
    const rule = fnBody(sql, 'can_log_for')
    expect(rule).toContain('p_player_id = auth.uid()')
    expect(rule).toContain('public.is_judge()')
    expect(rule).toContain('parent_id = auth.uid()')
    expect(sql).toMatch(/workouts_by_logger ON public\.workouts FOR ALL\s+USING \(public\.can_log_for\(player_id\)\)\s+WITH CHECK \(public\.can_log_for\(player_id\)\)/)
  })

  it('pins who logged it and whether it was witnessed, on insert and on update', () => {
    const g = fnBody(sql, 'guard_workouts_write')
    expect(g).toContain('NEW.logged_by  := COALESCE(auth.uid(), NEW.logged_by)')
    expect(g).toContain('NEW.witnessed  := auth.uid() IS NOT NULL AND public.is_judge() AND NEW.player_id <> auth.uid()')
    for (const col of ['player_id', 'logged_by', 'witnessed', 'created_at']) expect(g).toContain(`NEW.${col}`)
    expect(g).toContain('NEW.created_at := now()')
  })

  it('backdates exactly as far as the log form offers', () => {
    expect(sql).toContain(`(created_at AT TIME ZONE 'Pacific/Auckland')::date - ${BACKDATE_DAYS}`)
  })

  it('writes aliases only through fit_activity, which only a kaiwhakawā can call', () => {
    expect(sql).not.toMatch(/CREATE POLICY [^;]*ON public\.activity_aliases FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(fnBody(sql, 'fit_activity')).toContain('NOT public.is_judge()')
  })

  it('seeds aliases only for real events', () => {
    const seed = sql.slice(sql.indexOf('INSERT INTO public.activity_aliases'), sql.indexOf('ON CONFLICT (alias) DO NOTHING'))
    const slugs = [...seed.matchAll(/\('[^']+', '([^']+)'\)/g)].map(m => m[1])
    expect(slugs.length).toBeGreaterThan(20)
    const roster = new Set(EVENTS.map(e => e.slug))
    for (const s of slugs) expect(roster.has(s), s).toBe(true)
  })

  it('redefines delete_my_account as the previous definition plus the workouts delete, and nothing else', () => {
    const prev = fnBody(strip(read('_grading_schema.sql')), 'delete_my_account')
    const next = fnBody(sql, 'delete_my_account')
    expect(next).toContain('DELETE FROM workouts WHERE player_id = v_target;')
    const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
    expect(squash(next.replace('DELETE FROM workouts WHERE player_id = v_target;', ''))).toBe(squash(prev))
  })
})
