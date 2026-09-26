import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { entryPayload } from '@/lib/personalGame'
import { getEventBySlug, EVENTS } from '@/lib/eventData'
import { computeScoreVals, EMPTY_VALS } from '@/lib/scoring'

// ── A game played as a SWAP is rated; a logged one still is not ─────────────
// Decided with Tāne 2026-09-20. The difference is `workouts.session_id`: at an
// official game the opponent is a registered player in the room and a
// kaiwhakawā is present. 20260916211643's rule survives everywhere else.

const gameEvent = EVENTS.find(e => (e.difficultyTiers ?? []).some(t => t.scoring === 'sport'))!
const gameRung = gameEvent.difficultyTiers!.find(t => t.scoring === 'sport')!
const vals = { ...EMPTY_VALS, difficultyTier: gameRung.name, sportResult: 'win' as const }

describe('a Game rung on an entry', () => {
  it('keeps the win only when the caller says it is at a game', () => {
    expect(entryPayload(gameEvent, vals)!.raw_score).toBeUndefined()
    expect(entryPayload(gameEvent, vals, { allowGameScore: true })!.raw_score).toBeDefined()
  })
})

describe('the migration', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260920053207_rate_swap_games.sql'), 'utf8')

  it('anchors a match to exactly one of a result or an entry', () => {
    expect(sql).toContain('num_nonnulls(result_id, workout_entry_id) = 1')
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS workout_entry_id uuid UNIQUE/)
  })

  it('rates only a swap made AT a game', () => {
    expect(sql).toContain('only a game played at an official game is rated')
    // The guard's refusal now applies when there is no game.
    expect(sql).toContain('AND v_session IS NULL THEN')
  })

  it('keeps every other rule the entries guard had', () => {
    for (const rule of [
      'a witnessed workout can only be changed by a kaiwhakawā',
      'more than 7 days old',
      'that game has finished',
      'is not an event on the roster',
      'v_fitting_only',
    ]) expect(sql).toContain(rule)
  })

  it('reads the outcome off the score with the SAME encoding the client writes', () => {
    // lib/scoring.ts: raw = tierIdx * 10000 + (win 2 / draw 1 / loss 0).
    expect(sql).toContain("WHEN 2 THEN 'a' WHEN 1 THEN 'draw' WHEN 0 THEN 'b'")
    const term = (r: 'win' | 'draw' | 'loss') =>
      computeScoreVals(gameEvent.inputMode, gameEvent, { ...vals, sportResult: r })!.raw_score % 10000
    expect(term('win')).toBe(2)
    expect(term('draw')).toBe(1)
    expect(term('loss')).toBe(0)
  })

  it('never lets a guest or a stranger record one', () => {
    expect(sql).toContain('public.can_log_for(e.player_id)')
    expect(sql).toContain('an opponent is not a registered player')
  })
})

describe('the roster mirror is what names the event', () => {
  it('holds the slug the server looks up', () => {
    // record_entry_match resolves event_domains.slug -> event_name, because a
    // swapped event has no session_events row.
    expect(getEventBySlug(gameEvent.slug)!.name).toBe(gameEvent.name)
  })
})
