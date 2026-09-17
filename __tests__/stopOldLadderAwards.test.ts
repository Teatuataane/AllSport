// The points-ladder colours retired with the twelve-colour grades on
// 2026-09-16, but award_session_points() kept awarding them at session close.
// 20260917021257 removes those calls and must remove NOTHING else: placement,
// points_earned (the void discriminator in voidedSessionIds) and the summary
// row are all read by the app.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(join(__dirname, '../supabase/migrations/20260917021257_stop_old_ladder_awards.sql'), 'utf8')
const body = sql.slice(sql.indexOf('AS $$'), sql.indexOf('$$;'))

describe('stop old ladder awards migration', () => {
  it('no longer awards the points ladder', () => {
    expect(body).not.toMatch(/PERFORM\s+award_colour_rungs/)
    expect(body).not.toMatch(/PERFORM\s+recompute_player_total/)
  })

  it('keeps every write the app still reads', () => {
    for (const w of [
      'SET points_awarded_at = NOW()',
      'SET placement = dr.division_rank',
      'SET points_earned = v_total_points',
      'INSERT INTO session_player_summary',
    ]) expect(body).toContain(w)
  })

  it('keeps SECURITY DEFINER and asserts its own result', () => {
    expect(sql).toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/RAISE EXCEPTION 'stop old ladder: award_session_points still awards/)
  })
})
