// ── The Swiss contests migration, pinned to lib/swiss.ts ─────────────────────
// contest_safe_opponents() decides who may meet in the database; canPair in
// lib/swiss.ts mirrors it. These keep the two from drifting.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { SWISS_CONTESTS, WEIGHT_SPREAD, WEIGHT_FRESH_DAYS } from '@/lib/swiss'

const sql = readFileSync('supabase/migrations/20261015011537_swiss_contests.sql', 'utf8')
const code = sql.replace(/--.*$/gm, '')

describe('swiss contests migration', () => {
  it('lists the same contests at the same safety level', () => {
    const levels = { contact: 'contact', age: 'age', open: 'open' }
    for (const [slug, level] of Object.entries(SWISS_CONTESTS)) {
      expect(code).toContain(`WHEN '${slug}' THEN '${levels[level]}'`)
    }
    expect((code.match(/WHEN '[a-z-]+' THEN '(contact|age|open)'/g) ?? []).length).toBe(Object.keys(SWISS_CONTESTS).length)
  })
  it('uses the same age groups, bodyweight spread and freshness', () => {
    expect(code).toContain("WHEN p.date_of_birth IS NULL THEN '16+'")
    expect(code).toMatch(/< 12 THEN 'U12'/)
    expect(code).toMatch(/< 16 THEN '12-15'/)
    expect(code).toContain(`LEAST(a.kg, b.kg) * ${1 + WEIGHT_SPREAD}`)
    expect(code).toContain(`b.measured_on > p_day - ${WEIGHT_FRESH_DAYS}`)
    expect(code).toContain("RETURN a.age_group = 'U12' OR p_mixed OR a.sex_class = b.sex_class")
  })
  it('has no queue or pairing tables: suggestions are worked out in the browser', () => {
    expect(code).not.toMatch(/CREATE TABLE/)
    expect(code).not.toContain('contest_ready')
  })
  it('keeps ages, sexes and bodyweights inside the database', () => {
    expect(code).toContain('REVOKE ALL ON FUNCTION public.contest_profile(uuid, date) FROM PUBLIC, anon, authenticated')
    expect(code).toContain('REVOKE ALL ON FUNCTION public.contest_can_pair(uuid, uuid, text, boolean, date) FROM PUBLIC, anon, authenticated')
    const returned = code.slice(code.indexOf('FUNCTION public.contest_safe_opponents'), code.indexOf('FUNCTION public.set_contest_mixed'))
    expect(returned).toContain("'safe'")
    expect(returned).not.toMatch(/'(kg|age_group|sex_class|date_of_birth|gender)'/)
  })
  it('has no write policy and pins search_path on every definer', () => {
    expect(code).not.toMatch(/CREATE POLICY[^;]*FOR (INSERT|UPDATE|DELETE|ALL)/)
    const defs = code.match(/CREATE OR REPLACE FUNCTION[\s\S]*?AS \$\$/g) ?? []
    expect(defs.length).toBeGreaterThanOrEqual(6)
    for (const d of defs) if (d.includes('SECURITY DEFINER')) expect(d).toContain('SET search_path = public')
  })
  it('lets only a kaiwhakawā allow mixed, and only the player or a kaiwhakawā ask who is safe', () => {
    const mixed = code.slice(code.indexOf('FUNCTION public.set_contest_mixed('))
    expect(mixed.slice(0, 400)).toContain('IF NOT public.is_judge() THEN')
    const safe = code.slice(code.indexOf('FUNCTION public.contest_safe_opponents('))
    expect(safe.slice(0, 500)).toContain('IF NOT COALESCE(public.can_log_for(p_player_id) OR public.is_judge(), false) OR p_player_id IS NULL THEN')
  })
})
