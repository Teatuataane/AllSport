import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  ageAllowance, formatAllowance, ADULT_AGES, ADULT_ALLOWANCE, ADULT_ROWS, JUNIOR_ALLOWANCE, JUNIOR_ROWS,
} from '@/lib/ageAllowance'
import { eventGrade, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import { getEventByName } from '@/lib/eventData'

// The age allowance by domain, approved by Tāne on 20 Oct 2026
// (AGE_ALLOWANCE_REVIEW.md).

const at = (ageYears: number | null, division: string | null = "Men's") => ({ division, ageYears })

describe('the approved table', () => {
  it('gives Speed and Power the most, the skill domains the least', () => {
    expect(ageAllowance(at(40), 4)).toBe(0.5)   // Speed
    expect(ageAllowance(at(40), 1)).toBe(0)     // Maximal Strength
    expect(ageAllowance(at(60), 3)).toBe(2)     // Power
    expect(ageAllowance(at(60), 2)).toBe(1.5)   // Calisthenics
    expect(ageAllowance(at(60), 6)).toBe(1)     // Endurance
    expect(ageAllowance(at(60), 10)).toBe(0.5)  // Aim & Precision
    expect(ageAllowance(at(80), 4)).toBe(3.5)
    expect(ageAllowance(at(80), 7)).toBe(1.5)   // Flexibility
  })

  it('gives nothing from 17 to 39, including at 35', () => {
    for (let d = 1; d <= 10; d++) {
      expect(ageAllowance(at(17), d)).toBe(0)
      expect(ageAllowance(at(35), d)).toBe(0)
      expect(ageAllowance(at(39), d)).toBe(0)
    }
  })

  it('shapes juniors differently: strength, power and speed most, flexibility none', () => {
    expect(ageAllowance(at(10, 'Juniors'), 1)).toBe(3)
    expect(ageAllowance(at(13, 'Juniors'), 4)).toBe(2)
    expect(ageAllowance(at(16, 'Juniors'), 3)).toBe(1)
    expect(ageAllowance(at(10, 'Juniors'), 2)).toBe(2)
    expect(ageAllowance(at(12, 'Juniors'), 9)).toBe(1.5)
    expect(ageAllowance(at(15, 'Juniors'), 5)).toBe(0.5)
    expect(ageAllowance(at(9, 'Juniors'), 7)).toBe(0)
  })

  it('falls back to the old flat allowance only without an age', () => {
    expect(ageAllowance(at(null, 'Juniors'), 7)).toBe(2)
    expect(ageAllowance(at(null), 4)).toBe(0)
  })

  it('reads halves as players write them', () => {
    expect(formatAllowance(0.5)).toBe('½')
    expect(formatAllowance(1)).toBe('1')
    expect(formatAllowance(2.5)).toBe('2½')
  })
})

describe('a half allowance', () => {
  // Wall Sit (Stamina, one ladder): 10, 20, 30, 45, 60, 90 … seconds.
  const wallSit = getEventByName('Wall Sit')!
  const hold = (secs: number): GradeResultRow => ({ event_name: 'Wall Sit', raw_score: secs, weight_kg: null, difficulty_tier: null })
  const p = (ageYears: number): GradePlayer => ({ division: "Men's", ageYears, gender: 'Male' })

  it('is the mean of the exact scores at the whole steps either side', () => {
    // 60s: 5.0 on the Open ladder, 6.0 with one colour: 5.5 with half.
    const g = eventGrade(wallSit, [hold(60)], p(45))
    expect(g.rung).toBe(5)
    expect(g.exact).toBe(5.5)
  })

  it('earns the colour itself past the middle of one', () => {
    // 75s: 5.5 Open, 6.5 with one colour, so 6.0 with half: Kākāriki is held.
    const g = eventGrade(wallSit, [hold(75)], p(45))
    expect(g.rung).toBe(6)
    expect(g.exact).toBeUndefined()
  })

  it('sits between the whole steps either side', () => {
    const none = eventGrade(wallSit, [hold(75)], p(30))
    const whole = eventGrade(wallSit, [hold(75)], p(55))
    const half = eventGrade(wallSit, [hold(75)], p(45))
    const credit = (g: { rung: number; exact?: number }) => Math.max(g.rung, g.exact ?? 0)
    expect(credit(half)).toBeGreaterThan(credit(none))
    expect(credit(half)).toBeLessThan(credit(whole))
  })
})

describe('AGE_ALLOWANCE_REVIEW.md is the table the code runs', () => {
  const sheet = readFileSync('AGE_ALLOWANCE_REVIEW.md', 'utf8')
  const cell = (v: string) => v.trim() === '½' ? 0.5 : v.trim().endsWith('½') ? Number(v.trim().slice(0, -1)) + 0.5 : Number(v.trim())
  // "Stamina, Endurance" is a row in both tables, so each is read in its own section.
  const section = (title: string) => sheet.slice(sheet.indexOf(`## ${title}`)).split('\n## ')[0]
  const rowOf = (label: string, title: string) => {
    const line = section(title).split('\n').find(l => l.startsWith(`| ${label} |`))
    if (!line) throw new Error(`no row for ${label}`)
    return line.split('|').slice(2, -1).map(cell)
  }

  it('matches the adult rows', () => {
    for (const { label, group } of ADULT_ROWS) expect(rowOf(label, 'Adults')).toEqual([...ADULT_ALLOWANCE[group]])
    expect(ADULT_AGES).toEqual([35, 40, 45, 50, 55, 60, 65, 70, 75])
  })

  it('matches the junior rows', () => {
    for (const { label, group } of JUNIOR_ROWS) expect(rowOf(label, 'Juniors')).toEqual([...JUNIOR_ALLOWANCE[group]])
  })
})
