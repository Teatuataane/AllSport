import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { BODYWEIGHT_BANDS, GRADES } from '@/lib/grading'

// The grading schema migration hard-codes the band labels and the colour names,
// and redefines delete_my_account whole. These tests pin all three against the
// code and the previous definition, and pin the access rules, because a
// security property that regresses fails silently.

const dir = 'supabase/migrations'
const read = (suffix: string) => {
  const f = readdirSync(dir).find(n => n.endsWith(suffix))
  if (!f) throw new Error(`no migration ending ${suffix}`)
  return readFileSync(`${dir}/${f}`, 'utf8')
}
const sql = read('_grading_schema.sql')
const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

describe('the grading schema', () => {
  it('allows exactly the bands lib/grading.ts offers', () => {
    const check = code.match(/players_bodyweight_band_check CHECK \(([\s\S]*?)\)\s*\);/)![1]
    expect([...check.matchAll(/'([^']+)'/g)].map(m => m[1])).toEqual(BODYWEIGHT_BANDS.map(b => b.label))
  })

  it('names each colour exactly as lib/grading.ts does', () => {
    const arr = code.match(/\(ARRAY\[('Kiwikiwi'[\s\S]*?)\]\)\[p_rung\]/)![1]
    expect([...arr.matchAll(/'([^']+)'/g)].map(m => m[1])).toEqual(GRADES.map(g => g.name))
  })

  it('never puts the band in players_public', () => {
    // The view lists its columns explicitly, so leaving it untouched keeps the
    // band out; the closing check asserts that against the database too.
    expect(code).not.toMatch(/CREATE[^;]*VIEW[^;]*players_public/i)
    expect(code).toMatch(/table_name = 'players_public' AND column_name = 'bodyweight_band'/)
  })

  it('locks both tables, and leaves awards writable only through confer_grade', () => {
    for (const t of ['grade_awards', 'grade_exemptions']) {
      expect(code).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
      expect(code).toContain(`REVOKE ALL ON public.${t} FROM anon, authenticated;`)
    }
    expect(code).toContain('GRANT SELECT ON public.grade_awards TO anon, authenticated;')
    expect(code).not.toMatch(/CREATE POLICY \w+ ON public\.grade_awards\s+FOR (INSERT|UPDATE|DELETE)/)
    expect(code).not.toMatch(/GRANT [^;]*(INSERT|UPDATE|DELETE)[^;]* ON public\.grade_awards/)
  })

  it('keeps exemptions private and kaiwhakawā-written', () => {
    expect(code).not.toMatch(/ON public\.grade_exemptions FOR SELECT USING \(true\)/)
    expect(code).toMatch(/grade_exemptions_insert_judge[\s\S]*?WITH CHECK \(public\.is_judge\(\) AND confirmed_by = auth\.uid\(\)\)/)
    expect(code).not.toMatch(/GRANT [^;]* ON public\.grade_exemptions TO [^;]*anon/)
  })

  it('makes confer_grade kaiwhakawā-only, SECURITY DEFINER, with a pinned search_path', () => {
    const fn = code.match(/CREATE OR REPLACE FUNCTION public\.confer_grade[\s\S]*?\$\$;/)![0]
    expect(fn).toMatch(/SECURITY DEFINER/)
    expect(fn).toMatch(/SET search_path = public/)
    expect(fn).toMatch(/NOT public\.is_judge\(\)/)
    expect(code).toContain('REVOKE ALL ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) FROM PUBLIC, anon;')
  })

  it('carries no transaction control of its own', () => {
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/m)
  })
})

describe('erasure, redefined', () => {
  const fnOf = (src: string) =>
    src.match(/CREATE OR REPLACE FUNCTION public\.delete_my_account[\s\S]*?\$\$;/)![0]
  const setCols = (fn: string) =>
    [...fn.match(/UPDATE players SET([\s\S]*?)WHERE id = v_target/)![1].matchAll(/^\s*(\w+)\s*=/gm)].map(m => m[1])

  it('still clears every field the previous definition cleared', () => {
    const before = setCols(fnOf(read('_privacy_tidyup.sql')))
    const after = setCols(fnOf(sql))
    for (const col of before) expect(after, col).toContain(col)
  })

  it('also clears the band and deletes exemptions', () => {
    const fn = fnOf(sql)
    expect(setCols(fn)).toContain('bodyweight_band')
    expect(fn).toMatch(/DELETE FROM grade_exemptions WHERE player_id = v_target;/)
  })

  it('keeps its authority rule: yourself, or a child you manage', () => {
    expect(fnOf(sql)).toMatch(/v_target <> auth\.uid\(\) AND NOT EXISTS \(\s*SELECT 1 FROM players WHERE id = v_target AND parent_id = auth\.uid\(\)/)
  })
})
