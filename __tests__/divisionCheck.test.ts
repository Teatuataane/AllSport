import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { divisionPool } from '@/lib/rating'

// players_division_check once spelled the 60+ divisions 'Grandmasters …'
// while the register form wrote 'Grandmaster …', so every 60+ sign-up failed
// at the database (19 Oct 2026). Pin every division the register form can
// produce to the newest constraint definition. Since 20261019214532 there are
// three: age is in the colour standards, not the division.

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
  // Every literal it can hand back: after `return`, or either arm of a ternary.
  return [...body[0].matchAll(/(?:return|\?|:) (['"])(.*?)\1/g)].map(m => m[2])
}

describe('players_division_check', () => {
  it('accepts every division the register form can write', () => {
    const allowed = allowedDivisions()
    const produced = registerDivisions()
    expect(produced.length).toBe(3)
    for (const d of produced) expect(allowed).toContain(d)
  })

  it('allows only divisions the app can pool', () => {
    for (const d of allowedDivisions()) expect(divisionPool(d)).not.toBeNull()
  })
})

describe('age is not a division (20261019214532)', () => {
  const sql = readFileSync(`${dir}/20261019214532_age_not_a_division.sql`, 'utf8')

  it('allows no age division', () => {
    expect(allowedDivisions().sort()).toEqual(['Juniors', "Men's", "Women's"])
  })

  it('moves juniors up by the age they turn this NZ year, every day, server side only', () => {
    expect(sql).toMatch(/FUNCTION public\.roll_juniors\(\)[\s\S]*SECURITY INVOKER/)
    expect(sql).not.toMatch(/SECURITY DEFINER/)
    expect(sql).toMatch(/REVOKE ALL ON FUNCTION public\.roll_juniors\(\) FROM PUBLIC, anon, authenticated/)
    expect(sql).toMatch(/AT TIME ZONE 'Pacific\/Auckland'[\s\S]*>= 17/)
    expect(sql).toMatch(/cron\.schedule\('roll-juniors'/)
  })

  it('keeps a pre-image of every folded row, behind RLS', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.players_division_archive_20261019 AS/)
    expect(sql).toMatch(/players_division_archive_20261019 ENABLE ROW LEVEL SECURITY/)
  })

  it('only appends birth_year to players_public', () => {
    // CREATE OR REPLACE VIEW may only add columns at the end.
    const view = sql.slice(sql.indexOf('CREATE OR REPLACE VIEW public.players_public'), sql.indexOf('FROM public.players p'))
    expect(view.trim().endsWith('AS birth_year')).toBe(true)
  })
})
