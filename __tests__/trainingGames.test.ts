import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { rateGames } from '@/lib/headToHead'
import type { MatchRow } from '@/lib/matches'

// ── Playing the kaiwhakawā in a training session (20261026220347) ───────────
// Tāne, 27 Oct 2026: the player may play the kaiwhakawā running the session,
// and the game counts toward both ratings. The rules live in the database,
// which these tests cannot run, so they pin the migration text.

const dir = join(process.cwd(), 'supabase/migrations')
const file = readdirSync(dir).find(n => n.endsWith('_training_games_against_kaiwhakawa.sql'))!
const sql = readFileSync(join(dir, file), 'utf8')
const previous = readFileSync(join(dir, '20261005222950_roster_144.sql'), 'utf8')

// A function body, comments stripped, so a rule named only in a comment does not count.
function body(text: string, fn: string): string {
  const i = text.indexOf(`FUNCTION public.${fn}(`)
  const start = text.indexOf('$$', i)
  const end = text.indexOf('$$', start + 2)
  return text.slice(start, end).split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
}

describe('the migration', () => {
  it('lets a match have no session only when it hangs off an entry', () => {
    expect(sql).toContain('ALTER COLUMN session_id DROP NOT NULL')
    expect(sql).toContain('CHECK (session_id IS NOT NULL OR workout_entry_id IS NOT NULL)')
  })

  it('keeps every refusal both functions had', () => {
    for (const fn of ['guard_workout_entries_write', 'record_entry_match']) {
      const was = [...body(previous, fn).matchAll(/RAISE EXCEPTION '([^']+)'/g)].map(m => m[1])
      const now = body(sql, fn)
      expect(was.length, fn).toBeGreaterThan(3)
      for (const m of was) {
        // The one message reworded: a personal game is still refused, now
        // naming training as the other place a game is rated.
        if (m.includes('only a game played at an official game is rated')) continue
        expect(now, `${fn}: ${m}`).toContain(m)
      }
    }
  })

  it('allows a game result in training only while the session is open', () => {
    const g = body(sql, 'guard_workout_entries_write')
    expect(g).toContain('AND v_session IS NULL')
    expect(g).toMatch(/AND NOT \(\s*COALESCE\(v_witnessed, false\)\s*AND v_finished IS NULL\s*AND v_performed_on = \(now\(\) AT TIME ZONE 'Pacific\/Auckland'\)::date/)
  })

  it('rates a training game only against the kaiwhakawā running it, who must be a kaiwhakawā', () => {
    const r = body(sql, 'record_entry_match')
    expect(r).toContain('IF NOT COALESCE(e.witnessed, false) THEN')
    expect(r).toContain('v_opp <> ARRAY[e.logged_by]')
    expect(r).toContain("p.id = e.logged_by AND p.role = 'judge'")
    expect(r).toContain('public.can_log_for(e.player_id)')
    expect(r).toContain('CASE WHEN v_training THEN e.logged_by END')
  })

  it('pins search_path and keeps anon out', () => {
    for (const fn of ['guard_workout_entries_write', 'record_entry_match']) {
      expect(sql).toMatch(new RegExp(`FUNCTION public\\.${fn}\\([\\s\\S]*?SECURITY DEFINER\\s+SET search_path = public`))
    }
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.record_entry_match(uuid, uuid[], uuid[]) FROM PUBLIC, anon')
  })
})

describe('the rating', () => {
  it('moves both the player and the kaiwhakawā', () => {
    const m: MatchRow = {
      id: 't1', session_id: null, event_name: 'Squash', outcome: 'a', created_at: '2026-10-27T05:00:00Z',
      confirmed_at: '2026-10-27T05:00:00Z',
      players: [{ player_id: 'P', side: 'a' }, { player_id: 'K', side: 'b' }],
    }
    const squash = rateGames([m]).get('Squash')!
    expect(squash.get('P')).toEqual({ rating: 1020, games: 1 })
    expect(squash.get('K')).toEqual({ rating: 980, games: 1 })
  })
})
