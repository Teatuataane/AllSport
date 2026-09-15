import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// The taniwha retired with the grading rebuild. These pin the migration that
// removes its database half, and that the leaderboard the public page loads is
// still the function it expects: one round trip, invoker rights, still healing
// expired sessions, now carrying conferred colours instead of taniwha.

const dir = 'supabase/migrations'
const files = readdirSync(dir).sort()
const read = (f: string) => readFileSync(`${dir}/${f}`, 'utf8')
const retire = read(files.find(f => f.endsWith('_retire_taniwha.sql'))!)
const code = retire.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

// CREATE OR REPLACE means the newest definition is the live one.
const leaderboardFile = [...files].reverse().find(f => /function public\.leaderboard_page/i.test(read(f)))!
const leaderboard = read(leaderboardFile)

describe('retiring the taniwha', () => {
  it('archives player_taniwha, locked, BEFORE dropping it', () => {
    const archive = code.indexOf('CREATE TABLE public.player_taniwha_archive_')
    const drop = code.indexOf('DROP TABLE public.player_taniwha;')
    expect(archive).toBeGreaterThan(-1)
    expect(drop).toBeGreaterThan(archive)
    expect(code).toMatch(/ALTER TABLE public\.player_taniwha_archive_\d+ ENABLE ROW LEVEL SECURITY;/)
    expect(code).toMatch(/REVOKE ALL ON public\.player_taniwha_archive_\d+ FROM anon, authenticated;/)
  })

  it('drops the sync trigger and all six functions', () => {
    expect(code).toContain('DROP TRIGGER IF EXISTS trg_taniwha_sync ON public.sessions;')
    for (const fn of ['trg_sync_taniwha', 'claim_taniwha_crown', 'choose_taniwha', 'sync_player_taniwha', 'taniwha_body_budget', 'taniwha_crown_capacity']) {
      expect(code, fn).toMatch(new RegExp(`DROP FUNCTION IF EXISTS public\\.${fn}\\(`))
    }
  })

  it('carries no transaction control of its own', () => {
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/m)
  })

  it('comes after the migration that creates grade_awards', () => {
    const schema = files.find(f => f.endsWith('_grading_schema.sql'))!
    expect(files.indexOf(schema)).toBeLessThan(files.findIndex(f => f.endsWith('_retire_taniwha.sql')))
  })
})

describe('the leaderboard function the public page loads', () => {
  // The function body only: the file's closing checks deliberately name
  // player_taniwha ("must not appear"), so the slice stops at $fn$;.
  const start = leaderboard.search(/create or replace function public\.leaderboard_page/i)
  const fn = leaderboard.slice(start, leaderboard.indexOf('$fn$;', start) + '$fn$;'.length)

  it('is defined last by the retirement migration', () => {
    expect(leaderboardFile).toMatch(/_retire_taniwha\.sql$/)
  })

  it('carries conferred colours and no taniwha', () => {
    expect(fn).toMatch(/'grades', coalesce\(/)
    expect(fn).toMatch(/from grade_awards ga/)
    expect(fn).not.toMatch(/player_taniwha|'taniwha'/)
  })

  it('keeps invoker rights, volatility, the guarded heal and the anon grant', () => {
    expect(fn).toMatch(/security invoker/)
    expect(fn).toMatch(/\bvolatile\b/)
    expect(fn).toMatch(/perform public\.close_expired_sessions\(\);\s*exception when others then/)
    expect(leaderboard).toContain('grant execute on function public.leaderboard_page(int) to anon, authenticated;')
  })

  it('shapes grades exactly as the leaderboard page reads them', () => {
    for (const key of ['player_id', 'domain_number', 'rung']) expect(fn).toContain(`'${key}'`)
    const page = readFileSync('app/leaderboard/page.tsx', 'utf8')
    expect(page).toMatch(/grades\?: \{ player_id: string; domain_number: number; rung: number \}\[\]/)
  })
})
