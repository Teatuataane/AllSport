import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// ── A personal training session ──────────────────────────────────────────────
// A session a kaiwhakawā runs for one player is a WITNESSED workout that both
// of them can write to while it is open (docs/designs/personal-training-spec.md).
// The rules live in the database, which these tests cannot run, so they pin the
// migration text: every rule the entries guard already had must survive the
// whole-function redefinition, and the new ones must be there.

const dir = join(process.cwd(), 'supabase/migrations')
const sql = readFileSync(join(dir, '20260930222237_training_sessions.sql'), 'utf8')
const before = readFileSync(join(dir, '20260920053207_rate_swap_games.sql'), 'utf8')

// The function body, comments stripped, so a rule named only in a comment does not count.
function body(text: string, fn: string): string {
  const i = text.indexOf(`FUNCTION public.${fn}()`)
  const start = text.indexOf('$$', i)
  const end = text.indexOf('$$', start + 2)
  return text.slice(start, end).split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
}

describe('guard_workout_entries_write', () => {
  const now = body(sql, 'guard_workout_entries_write')
  const was = body(before, 'guard_workout_entries_write')

  it('keeps every refusal the previous definition had', () => {
    const messages = [...was.matchAll(/RAISE EXCEPTION '([^']+)'/g)].map(m => m[1])
    expect(messages.length).toBeGreaterThanOrEqual(5)
    for (const m of messages) {
      // The witnessed message is kept verbatim: the screen matches on it.
      expect(now).toContain(m)
    }
  })

  it('keeps the fitting-only exception, the 7-day window and the Game-rung rule', () => {
    expect(now).toContain('v_fitting_only')
    expect(now).toContain("date - 7")
    expect(now).toContain("ILIKE 'Game%'")
    expect(now).toContain('AND v_session IS NULL THEN')
  })

  it('lets the player write into a witnessed workout only while it is open', () => {
    expect(now).toContain('v_finished IS NULL')
    expect(now).toContain("v_performed_on = (now() AT TIME ZONE 'Pacific/Auckland')::date")
    expect(now).toContain('public.can_log_for(v_player)')
  })

  it('stays a pinned-search-path definer, as before', () => {
    expect(sql).toMatch(/FUNCTION public\.guard_workout_entries_write\(\)[\s\S]*?SECURITY DEFINER\s+SET search_path = public/)
  })
})

describe('the delete guards', () => {
  it('are SECURITY INVOKER and test current_user, never auth.uid()', () => {
    for (const fn of ['guard_workout_entries_delete', 'guard_workouts_delete']) {
      expect(sql).toMatch(new RegExp(`FUNCTION public\\.${fn}\\(\\)[\\s\\S]*?SECURITY INVOKER`))
      expect(body(sql, fn)).toContain("current_user")
      expect(body(sql, fn)).not.toContain('auth.uid()')
    }
  })

  it('leave erasure alone: a definer call is not held to them', () => {
    expect(body(sql, 'guard_workout_entries_delete')).toContain("current_user <> 'authenticated'")
  })

  it('stop a player deleting a witnessed workout or its closed entries', () => {
    expect(body(sql, 'guard_workouts_delete')).toContain('OLD.witnessed')
    expect(body(sql, 'guard_workout_entries_delete')).toContain('v_finished IS NULL')
  })

  it('are wired BEFORE DELETE', () => {
    expect(sql).toContain('BEFORE DELETE ON public.workout_entries')
    expect(sql).toContain('BEFORE DELETE ON public.workouts')
  })
})

describe('guard_workouts_write', () => {
  it('is NOT redefined: the plan, Finish and the row stay kaiwhakawā-only', () => {
    expect(sql).not.toContain('FUNCTION public.guard_workouts_write')
  })
})
