// ── Groups (Scoring v2 step 4) ──────────────────────────────────────────────
// The board's rule in lib/groupBoard.ts, and the migration that defines it in
// SQL. Structural checks on the migration pin what PGlite rehearsed on
// 15 Oct 2026: writes only through functions, names never public.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { memberImprovement, improvementLabel, groupErrorMessage, ACTIVE_GAMES, RECENT_GAMES } from '@/lib/groupBoard'

const sql = readFileSync('supabase/migrations/20261015004143_scoring_v2_groups.sql', 'utf8')

describe('memberImprovement', () => {
  it('is null until the member has three games', () => {
    expect(memberImprovement([])).toBeNull()
    expect(memberImprovement([50, 60])).toBeNull()
  })
  it('averages the last three games after the first, in colours', () => {
    expect(memberImprovement([40, 45, 50])).toBe(0.75)
    expect(memberImprovement([50, 60, 70, 80])).toBe(2)
    // The second game drops out once there are three after it.
    expect(memberImprovement([50, 10, 70, 80, 90])).toBe(3)
  })
  it('can go down', () => {
    expect(memberImprovement([80, 70, 70])).toBe(-1)
  })
})

describe('improvementLabel', () => {
  it('reads in colours', () => {
    expect(improvementLabel(1.38)).toBe('+1.4 colours')
    expect(improvementLabel(1)).toBe('+1.0 colour')
    expect(improvementLabel(-0.3)).toBe('−0.3 colours')
    expect(improvementLabel(null)).toBe('Not yet active')
  })
})

describe('groupErrorMessage', () => {
  it('names the one-of-each-kind rule', () => {
    expect(groupErrorMessage({ code: '23505', message: 'duplicate key value violates unique constraint "group_members_player_id_kind_key"' }))
      .toBe('Already in a group of that kind. Leave it first.')
  })
})

describe('the groups migration', () => {
  it('uses the same active and recent counts as the TypeScript rule', () => {
    expect(sql).toContain(`WHEN MAX(total) >= ${ACTIVE_GAMES} THEN`)
    expect(sql).toContain(`n > 1 AND n > total - ${RECENT_GAMES}`)
    expect(sql).toMatch(/- MAX\(colour_total\) FILTER \(WHERE n = 1\)\) \/ 10, 2\)/)
  })
  it('counts games the way season_points does', () => {
    expect(sql).toContain('s.is_active = false AND s.voided_at IS NULL')
    expect(sql).toContain('p.is_active IS NOT FALSE AND p.is_guest IS NOT TRUE')
  })
  it('allows one group of each kind per player', () => {
    expect(sql).toContain('UNIQUE (player_id, kind)')
  })
  it('has no write policy and keeps names off the public board', () => {
    expect(sql).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/)
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.group_board(int) TO anon, authenticated')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.group_detail(uuid, int) FROM PUBLIC, anon')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.group_member_progress(int) FROM PUBLIC, anon, authenticated')
    const board = sql.slice(sql.indexOf('FUNCTION public.group_board'), sql.indexOf('FUNCTION public.group_detail'))
    expect(board).not.toMatch(/display_name|full_name|username/)
  })
  it('pins search_path on every SECURITY DEFINER function', () => {
    const defs = sql.match(/CREATE OR REPLACE FUNCTION[\s\S]*?AS \$\$/g) ?? []
    expect(defs.length).toBeGreaterThanOrEqual(10)
    for (const d of defs) if (d.includes('SECURITY DEFINER')) expect(d).toContain('SET search_path = public')
  })
  it('never touches bodyweights, wellbeing or can_log_for', () => {
    const code = sql.replace(/--.*$/gm, '')
    expect(code).not.toMatch(/player_bodyweights|wellbeing|FUNCTION public\.can_log_for/)
  })
})
