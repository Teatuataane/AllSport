import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { outcomeFromResult } from '@/lib/matches'

// The match-recording migration, pinned. A security property of a migration
// fails silently when it regresses — delete a REVOKE and nothing breaks, the
// tables are simply writable — so the file itself is asserted, the same way
// __tests__/securityHeaders.test.ts pins the headers.

const dir = 'supabase/migrations'
const file = readdirSync(dir).find(n => n.endsWith('_match_recording.sql'))!
const sql = readFileSync(`${dir}/${file}`, 'utf8')
// Assertions run on the code only, so a comment can never satisfy one.
const code = sql.replace(/--.*$/gm, '')

describe('match recording migration', () => {
  it('was allocated by the CLI, and shares its version with no other migration', () => {
    // A duplicate 14-digit version is applied as a SILENT skip (CLAUDE.md).
    expect(file).toMatch(/^\d{14}_match_recording\.sql$/)
    const version = file.slice(0, 14)
    expect(readdirSync(dir).filter(n => n.startsWith(version))).toHaveLength(1)
  })

  it('enables RLS on both tables', () => {
    expect(code).toMatch(/ALTER TABLE public\.matches\s+ENABLE ROW LEVEL SECURITY/i)
    expect(code).toMatch(/ALTER TABLE public\.match_players\s+ENABLE ROW LEVEL SECURITY/i)
  })

  it('opens no client write path: no insert, update, delete or all policy', () => {
    expect(code).not.toMatch(/CREATE POLICY[^;]*ON public\.(matches|match_players)\s+FOR\s+(INSERT|UPDATE|DELETE|ALL)/i)
  })

  it('revokes table writes from anon and authenticated, and grants read only', () => {
    expect(code).toMatch(/REVOKE ALL ON public\.matches, public\.match_players FROM anon, authenticated/i)
    expect(code).toMatch(/GRANT SELECT ON public\.matches, public\.match_players TO anon, authenticated/i)
  })

  it('writes only through a SECURITY DEFINER function with a pinned search_path', () => {
    const fn = code.slice(code.indexOf('FUNCTION public.record_match'))
    expect(fn).toMatch(/SECURITY DEFINER/)
    expect(fn).toMatch(/SET search_path = public/)
  })

  it('never lets anon execute record_match', () => {
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.record_match\([^)]*\) FROM PUBLIC, anon/i)
    expect(code).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.record_match[^;]*\banon\b/i)
  })

  it('derives the outcome from the score exactly as lib/matches does', () => {
    // If these drift, the server and the client disagree about who won.
    for (const [resultType, outcome] of [['win', 'a'], ['loss', 'b'], ['draw', 'draw']] as const) {
      expect(code).toMatch(new RegExp(`WHEN '${resultType}'\\s+THEN '${outcome}'`))
      expect(outcomeFromResult(resultType)).toBe(outcome)
    }
  })

  it('removes a match with the score it belongs to', () => {
    expect(code).toMatch(/result_id\s+uuid NOT NULL UNIQUE REFERENCES public\.results\(id\) ON DELETE CASCADE/i)
  })

  it('keeps a player to one side of a match', () => {
    expect(code).toMatch(/PRIMARY KEY \(match_id, player_id\)/i)
  })

  it('checks its own objects before committing, rather than trusting the ledger', () => {
    expect(code).toMatch(/relrowsecurity/)
    expect(code).toMatch(/prosecdef/)
  })
})
