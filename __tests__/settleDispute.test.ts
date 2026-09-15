import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { agrees } from '@/lib/matches'

// The settle-dispute migration, pinned the way __tests__/matchRecording.test.ts
// pins match recording: a security property that regresses fails silently.

const dir = 'supabase/migrations'
const file = readdirSync(dir).find(n => n.endsWith('_settle_dispute.sql'))!
const sql = readFileSync(`${dir}/${file}`, 'utf8')
// Assertions run on the code only, so a comment can never satisfy one.
const code = sql.replace(/--.*$/gm, '')

describe('settle dispute migration', () => {
  it('was allocated by the CLI, and shares its version with no other migration', () => {
    expect(file).toMatch(/^\d{14}_settle_dispute\.sql$/)
    const version = file.slice(0, 14)
    expect(readdirSync(dir).filter(n => n.startsWith(version))).toHaveLength(1)
  })

  it('is SECURITY DEFINER with a pinned search_path', () => {
    const fn = code.slice(code.indexOf('FUNCTION public.settle_dispute'))
    expect(fn).toMatch(/SECURITY DEFINER/)
    expect(fn).toMatch(/SET search_path = public/)
  })

  it('lets only a kaiwhakawā settle', () => {
    expect(code).toMatch(/NOT public\.is_judge\(\) THEN\s+RAISE EXCEPTION[^;]*ERRCODE = '42501'/)
  })

  it('never lets anon execute it, and opens no table write', () => {
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.settle_dispute\([^)]*\) FROM PUBLIC, anon/i)
    expect(code).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.settle_dispute[^;]*\banon\b/i)
    expect(code).not.toMatch(/GRANT[^;]*ON (TABLE )?public\.matches/i)
    expect(code).not.toMatch(/CREATE POLICY/i)
  })

  it('writes only the confirmation columns', () => {
    const updates = code.match(/UPDATE public\.matches\s+SET[\s\S]*?WHERE/g) ?? []
    expect(updates).toHaveLength(1)
    const set = updates[0]!.replace(/CASE[\s\S]*?END/g, '')
    expect(set.match(/(\w+)\s*=/g)!.map(s => s.replace(/\s*=$/, ''))).toEqual(['confirmed_by', 'confirmed_at'])
  })

  it('refuses exactly the pairs lib/matches.ts calls agreeing', () => {
    // If these drift, the panel offers to settle a game the server calls agreed, or the reverse.
    const outcomes = ['a', 'b', 'draw'] as const
    for (const x of outcomes) for (const y of outcomes) {
      const clause = new RegExp(`v_a\\.outcome = '${x}'\\s+AND v_b\\.outcome = '${y}'`)
      expect(clause.test(code)).toBe(agrees({ outcome: x }, { outcome: y }))
    }
  })

  it('has no transaction control of its own', () => {
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/mi)
  })

  it('checks its own objects before finishing, rather than trusting the ledger', () => {
    expect(code).toMatch(/prosecdef/)
    expect(code).toMatch(/has_function_privilege\('anon'/)
  })
})
