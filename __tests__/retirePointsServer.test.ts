// Points retired server-side (20260918021529). The file is the contract: a
// closing game writes placements and the summary row and NOTHING that is
// points, and a void is recorded rather than inferred from missing points.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { voidedSessions, voidedSessionIds } from '@/lib/playerGrades'

const sql = readFileSync(join(__dirname, '../supabase/migrations/20260918021529_retire_points_server.sql'), 'utf8')
const award = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.award_session_points()'), sql.indexOf('DROP TRIGGER IF EXISTS trg_update_average_placement'))

describe('retire points migration', () => {
  it('writes no points when a game closes', () => {
    expect(award).not.toMatch(/points_earned/)
    expect(award).not.toMatch(/INSERT INTO rankings/i)
    expect(award).not.toMatch(/refresh_rankings_rank/)
    expect(award).not.toMatch(/PERFORM\s+(award_colour_rungs|recompute_player_total)/i)
  })

  it('keeps the claim guard, the placements and the summary row', () => {
    for (const w of ['SET points_awarded_at = NOW()', 'SET placement = dr.division_rank', 'INSERT INTO session_player_summary']) {
      expect(award).toContain(w)
    }
    // A re-run must never wipe a historical row's points.
    expect(award).toMatch(/ON CONFLICT \(session_id, player_id\) DO UPDATE SET\s+overall_placement = EXCLUDED\.overall_placement;/)
  })

  it('records a void on the one update only Void performs', () => {
    expect(sql).toMatch(/OLD\.is_active AND NOT NEW\.is_active\s+AND OLD\.points_awarded_at IS NULL AND NEW\.points_awarded_at IS NOT NULL/)
    expect(sql).toMatch(/BEFORE UPDATE OF is_active, points_awarded_at ON public\.sessions/)
  })

  it('backfills voids before anything stops writing points, and asserts they agree', () => {
    expect(sql.indexOf('UPDATE public.sessions s\nSET voided_at')).toBeLessThan(sql.indexOf('CREATE OR REPLACE FUNCTION public.award_session_points()'))
    expect(sql).toMatch(/sessions disagree between voided_at and the legacy void rule/)
  })

  it('drops the dead payload keys and the old write path', () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_update_average_placement/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.claim_colour_award\(uuid, uuid, int\) FROM PUBLIC, anon, authenticated/)
    const lb = sql.slice(sql.indexOf('FUNCTION public.leaderboard_page'), sql.indexOf('FUNCTION public.player_dashboard'))
    expect(lb).not.toMatch(/rankings|points_earned/)
  })
})

describe('voidedSessions', () => {
  const sessions = [
    { id: 'played', is_active: false, points_awarded_at: 't' },
    { id: 'voided', is_active: false, points_awarded_at: 't' },
  ]
  // After the migration no game carries points, so the legacy rule calls both voided.
  const noPoints = [{ session_id: 'played', points_earned: null }, { session_id: 'voided', points_earned: null }]

  it('uses the recorded voids when the database has them', () => {
    expect([...voidedSessions(new Set(['voided']), sessions, noPoints)]).toEqual(['voided'])
  })

  it('falls back to the legacy rule only when voided_at does not exist yet', () => {
    const withPoints = [{ session_id: 'played', points_earned: 100 }, { session_id: 'voided', points_earned: null }]
    expect([...voidedSessions(null, sessions, withPoints)]).toEqual(['voided'])
  })

  it('shows why the legacy rule cannot survive the migration', () => {
    expect([...voidedSessionIds(sessions, noPoints)].sort()).toEqual(['played', 'voided'])
  })
})
