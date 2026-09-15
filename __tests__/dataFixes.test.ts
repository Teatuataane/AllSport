import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'

// One-off data fixes Tāne asked for, pinned so a later edit cannot widen what
// they delete.

const dir = 'supabase/migrations'
const sql = readFileSync(`${dir}/${readdirSync(dir).find(f => f.endsWith('_remove_impossible_sprint.sql'))!}`, 'utf8')
const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

const ROW = 'f786efa6-2b31-4335-a70b-480494fad71d'
const SESSION = 'e032cb24-416d-48e9-9806-168c4d6fe46f'

describe('removing the 0.16-second 100m result', () => {
  it('names exactly one row, and only ever deletes it while its time is impossible', () => {
    const ids = new Set([...code.matchAll(/'([0-9a-f-]{36})'/g)].map(m => m[1]))
    expect(ids).toEqual(new Set([ROW, SESSION]))
    const del = code.match(/DELETE FROM public\.results[\s\S]*?;/)![0]
    expect(del).toContain(`id = '${ROW}'`)
    expect(del).toContain('time_seconds < 1')
  })

  it('archives the row, locked, before deleting it', () => {
    expect(code.indexOf('CREATE TABLE public.results_impossible_archive_')).toBeLessThan(code.indexOf('DELETE FROM public.results'))
    expect(code).toMatch(/ALTER TABLE public\.results_impossible_archive_\d+ ENABLE ROW LEVEL SECURITY;/)
    expect(code).toMatch(/REVOKE ALL ON public\.results_impossible_archive_\d+ FROM anon, authenticated;/)
  })

  it('refuses to delete the row if its time has been corrected to a real one', () => {
    expect(code).toMatch(/IF v_archived = 0 AND v_present THEN\s*RAISE EXCEPTION/)
  })

  it('re-ranks that session\'s event placements, and leaves points and overall placings alone', () => {
    expect(code).toContain(`PERFORM public.compute_event_placements('${SESSION}');`)
    expect(code).not.toMatch(/award_session_points|recompute_player_total|session_player_summary\s+SET|UPDATE public\.results\b/)
  })

  it('carries no transaction control of its own', () => {
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/m)
  })
})
