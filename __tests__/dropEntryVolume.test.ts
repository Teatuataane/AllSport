// ── 20260926181359: drop workout_entries.count and volume_distance_m ─────────
// The guard is redefined WHOLE, and a whole redefinition is how a rule goes
// missing (CLAUDE.md). So this pins that every line of the previous definition
// survives except the two that named the dropped columns, and that no code in
// the app still selects or writes them: a missing column is 42703 and takes the
// whole request down.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'

const dir = join(process.cwd(), 'supabase/migrations')
const read = (f: string) => readFileSync(join(dir, f), 'utf8')
const code = read('20260926181359_drop_entry_volume_columns.sql')

/** The guard's body, one trimmed non-blank line per entry. */
function guardLines(sql: string): string[] {
  const start = sql.indexOf('CREATE OR REPLACE FUNCTION public.guard_workout_entries_write')
  const body = sql.slice(start, sql.indexOf('$function$;', start) >= 0 ? sql.indexOf('$function$;', start) : sql.indexOf('$$;', start))
  // pg_get_functiondef prints `SET search_path TO 'public'`; the files wrote `= public`.
  return body.split('\n').map(l => l.trim().replace("SET search_path TO 'public'", 'SET search_path = public')).filter(Boolean)
}

describe('the drop-volume migration', () => {
  it('keeps every line of the previous guard except the two dropped columns', () => {
    const before = guardLines(read('20260920053207_rate_swap_games.sql'))
    const after = new Set(guardLines(code))
    const lost = before.filter(l => !after.has(l) && !/\$\$|\$function\$|^AS /.test(l))
    expect(lost).toEqual([
      'AND NEW.count IS NOT DISTINCT FROM OLD.count',
      'AND NEW.volume_distance_m IS NOT DISTINCT FROM OLD.volume_distance_m',
    ])
  })

  it('drops both columns and asserts they are gone', () => {
    expect(code).toMatch(/DROP COLUMN IF EXISTS count;/)
    expect(code).toMatch(/DROP COLUMN IF EXISTS volume_distance_m;/)
    expect(code).toMatch(/RAISE EXCEPTION 'drop volume: a column survived'/)
    expect(code).toMatch(/RAISE EXCEPTION 'drop volume: guard_workout_entries_write still names a dropped column'/)
  })

  it('archives the values first, behind RLS, before anything is dropped', () => {
    expect(code.indexOf('workout_entries_volume_archive_20260926181359 AS'))
      .toBeLessThan(code.indexOf('DROP COLUMN'))
    expect(code).toMatch(/workout_entries_volume_archive_20260926181359 ENABLE ROW LEVEL SECURITY/)
    expect(code).toMatch(/REVOKE ALL ON public\.workout_entries_volume_archive_20260926181359 FROM anon, authenticated/)
  })

  it('leaves the guard trigger wiring alone', () => {
    // Recreating the trigger would reorder it against the band-stamp triggers.
    expect(code).not.toMatch(/CREATE TRIGGER|DROP TRIGGER/)
  })
})

describe('the app no longer touches the dropped columns', () => {
  it('selects and writes neither column anywhere in app, components or lib', () => {
    // git grep exits 1 when nothing matches, which is the passing case.
    let hits = ''
    try {
      hits = execFileSync('git', ['grep', '-n', '-E', 'volume_distance_m|event_slug, count|count: sets', '--', 'app', 'components', 'lib'], { encoding: 'utf8' })
    } catch { hits = '' }
    expect(hits).toBe('')
  })
})
