import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { divisionPool } from '@/lib/rating'

// players_division_check once spelled the 60+ divisions 'Grandmasters …'
// while the register form wrote 'Grandmaster …', so every 60+ sign-up failed
// at the database (19 Oct 2026). Pin every division the register form can
// produce to the newest constraint definition.

const dir = 'supabase/migrations'

function allowedDivisions(): string[] {
  const f = readdirSync(dir).sort().reverse()
    .find(n => /ADD CONSTRAINT players_division_check/.test(readFileSync(`${dir}/${n}`, 'utf8')))
  if (!f) throw new Error('players_division_check migration not found')
  const sql = readFileSync(`${dir}/${f}`, 'utf8')
  const list = sql.match(/players_division_check CHECK \(division IN \(([\s\S]*?)\)\)/)
  if (!list) throw new Error('division list not found')
  return [...list[1].matchAll(/'((?:[^']|'')*)'/g)].map(m => m[1].replace(/''/g, "'"))
}

function registerDivisions(): string[] {
  const src = readFileSync('app/register/page.tsx', 'utf8')
  const body = src.match(/function calculateDivision[\s\S]*?\n}\n/)
  if (!body) throw new Error('calculateDivision not found')
  return [...body[0].matchAll(/return (['"])(.*?)\1/g)].map(m => m[2])
}

describe('players_division_check', () => {
  it('accepts every division the register form can write', () => {
    const allowed = allowedDivisions()
    const produced = registerDivisions()
    expect(produced.length).toBe(7)
    for (const d of produced) expect(allowed).toContain(d)
  })

  it('allows only divisions the app can pool', () => {
    for (const d of allowedDivisions()) expect(divisionPool(d)).not.toBeNull()
  })
})
