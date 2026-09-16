import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
// A plain .mjs script, imported for its pure compile and render.
import { compile, render } from '../scripts/apply-units-sheet.mjs'
import { EVENTS, getEventByName } from '@/lib/eventData'
import { UNIT_SHEET } from '@/lib/unitSheet'
import { unitRule, unitsForResult, unitsForVolume, metresIn, fmtUnits, unitsForEntryRow } from '@/lib/units'

const ev = (name: string) => {
  const e = getEventByName(name)
  if (!e) throw new Error(`${name} is not on the roster`)
  return e
}

describe('the units sheet', () => {
  const sheet = readFileSync('WORKOUT_UNITS_REVIEW.md', 'utf8')
  const eventSrc = readFileSync('lib/eventData.ts', 'utf8')

  it('compiles to exactly lib/unitSheet.ts — change the sheet, then run the script', () => {
    expect(render(compile(sheet, eventSrc))).toBe(readFileSync('lib/unitSheet.ts', 'utf8'))
  })

  it('gives every event on the roster a rule, and nothing else', () => {
    expect(Object.keys(UNIT_SHEET).sort()).toEqual(EVENTS.map(e => e.slug).sort())
  })

  it('refuses a sheet with a missing event or a bad number, naming every problem at once', () => {
    const noCycling = sheet.replace(/^\| `cycling` .*$/m, '')
    const broken = noCycling.replace(/(\| `deadlift` \|[^|]*\|[^|]*\| set \| )1/, '$10')
    expect(noCycling).not.toBe(sheet)
    expect(broken).not.toBe(noCycling)
    let message = ''
    try { compile(broken, eventSrc) } catch (e) { message = (e as Error).message }
    expect(message).toContain('cycling: missing')
    expect(message).toContain('deadlift: per')
  })
})

describe('what one unit is', () => {
  it('counts a 25km ride as 25 Cycling units, as Tāne described', () => {
    expect(unitRule(ev('Cycling'))).toEqual({ rule: 'distance', per: 1000 })
    expect(unitsForVolume(ev('Cycling'), { distanceM: 25000 })).toBe(25)
  })

  it('ignores a count on a distance event, so one ride is never counted twice', () => {
    expect(unitsForVolume(ev('Cycling'), { count: 3, distanceM: 2000 })).toBe(2)
    expect(unitsForVolume(ev('Cycling'), { count: 3 })).toBe(0)
  })

  it('credits a game result on a distance ladder with its share of the unit', () => {
    expect(unitsForResult(ev('Cycling'), '250m')).toBe(0.25)
    expect(unitsForResult(ev('Cycling'), '1000m')).toBe(1)
  })

  it('counts a set, a hold and three throws each as one unit', () => {
    expect(unitsForVolume(ev('Deadlift'), { count: 5 })).toBe(5)
    expect(unitsForVolume(ev('Bridge'), { count: 2 })).toBe(2)
    expect(unitsForVolume(ev('Javelin'), { count: 6 })).toBe(2)
    expect(unitsForResult(ev('Javelin'), null)).toBeCloseTo(1 / 3)
  })

  it('counts a Game rung as one game whatever the drill rule', () => {
    const tennis = ev('Tennis')
    const game = tennis.difficultyTiers!.find(t => t.scoring === 'sport')!
    expect(unitsForResult(tennis, game.name)).toBe(1)
  })

  it('treats a ladder of loads over one distance as one effort per carry', () => {
    expect(unitRule(ev('Weighted Carry')).rule).toBe('set')
  })

  it('earns nothing for an entry that is not fitted to an event yet', () => {
    expect(unitsForEntryRow({ event_slug: null, count: 10, volume_distance_m: null })).toBeNull()
  })

  it('reads metres out of a rung name', () => {
    expect(metresIn('1000m')).toBe(1000)
    expect(metresIn('½ BW — 200m')).toBe(200)
    expect(metresIn('1.5km')).toBe(1500)
    expect(metresIn('Pushup Hold')).toBeNull()
  })

  it('shows whole units, and one decimal under ten', () => {
    expect(fmtUnits(25)).toBe('25')
    expect(fmtUnits(2.75)).toBe('2.7')
    expect(fmtUnits(12.9)).toBe('12')
  })
})
