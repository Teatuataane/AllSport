import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { EVENTS, getEventBySlug } from '@/lib/eventData'
import { STANDARDS } from '@/lib/standards'
import { eventGrade, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import {
  ADULT_PERCENT, JUNIOR_PERCENT, JUMP_SLUGS, LOWER_LOAD_SLUGS, PERCENT_AGES, TIMED_ENDURANCE_SLUGS, UPPER_LEVEL_SLUGS, UPPER_LOAD_SLUGS,
  agePercent, colourAllowance, numberShare, scaledAsWoman, scaledLadder, timeFactor, usesPercent,
} from '@/lib/scaling'

const man = (ageYears: number | null = 30): GradePlayer => ({ division: "Men's", ageYears, gender: 'Male' })
const woman = (ageYears: number | null = 30): GradePlayer => ({ division: "Women's", ageYears, gender: 'Female' })
const ev = (slug: string) => getEventBySlug(slug)!
const ladder = (slug: string, p: GradePlayer) => scaledLadder(ev(slug), STANDARDS[slug], p)
const row = (name: string, raw: number | null, extra: Partial<GradeResultRow> = {}): GradeResultRow =>
  ({ event_name: name, raw_score: raw, weight_kg: null, difficulty_tier: null, ...extra })

describe('who is scaled', () => {
  it('starts the women\'s scaling at 12, and "Other" stays on the listed standard', () => {
    expect(scaledAsWoman(woman())).toBe(true)
    expect(scaledAsWoman({ division: 'Juniors', ageYears: 12, gender: 'Female' })).toBe(true)
    expect(scaledAsWoman({ division: 'Juniors', ageYears: 11, gender: 'Female' })).toBe(false)
    expect(scaledAsWoman({ division: 'Juniors', ageYears: 13, gender: 'Other' })).toBe(false)
    expect(scaledAsWoman(man())).toBe(false)
  })
})

describe('every list a scaling names is a real event of the right kind', () => {
  it('names only events on the roster', () => {
    for (const set of [LOWER_LOAD_SLUGS, UPPER_LOAD_SLUGS, JUMP_SLUGS, TIMED_ENDURANCE_SLUGS, UPPER_LEVEL_SLUGS]) {
      for (const slug of set) expect(getEventBySlug(slug), slug).toBeDefined()
    }
  })

  it('gives a percentage only to events with no levels, and a colour only to events with them', () => {
    for (const slug of [...LOWER_LOAD_SLUGS, ...UPPER_LOAD_SLUGS, ...JUMP_SLUGS, ...TIMED_ENDURANCE_SLUGS]) {
      expect(ev(slug).difficultyTiers?.length ?? 0, slug).toBe(0)
    }
    for (const slug of UPPER_LEVEL_SLUGS) expect(ev(slug).difficultyTiers?.length, slug).toBeGreaterThan(0)
  })
})

describe('sex', () => {
  it('takes 80% of a lower body load, 70% of an upper body load', () => {
    expect(ladder('deadlift', woman()).at(-1)).toBe(1.6)
    expect(ladder('pause-bench', woman()).at(-1)).toBeCloseTo(1.05)
    expect(ladder('deadlift', man()).at(-1)).toBe(2)
  })

  it('takes 80% of a jump and leaves a throw alone', () => {
    expect(ladder('vertical-jump', woman()).at(-1)).toBe(48)
    expect(ladder('javelin-throw', woman())).toEqual(ladder('javelin-throw', man()))
  })

  it('adds 12% to timed Endurance and leaves its distance steps alone', () => {
    const f = ladder('running', woman())
    expect(f.slice(0, 5)).toEqual([1, 2, 3, 4, 5])
    expect(10000 - f.at(-1)!).toBe(269) // 4:00 becomes 4:29
  })

  it('moves an upper body event with levels by one colour, and no other', () => {
    expect(colourAllowance(woman(), ev('planche'))).toBe(1)
    expect(colourAllowance(man(), ev('planche'))).toBe(0)
    expect(colourAllowance(woman(), ev('bridge'))).toBe(0)
    expect(colourAllowance({ division: 'Juniors', ageYears: 11, gender: 'Female' }, ev('flag'))).toBe(2)
  })

  it('leaves the reps of a set and the time of a hold or carry as they are', () => {
    const list = ladder('strict-curl', woman())
    expect(list.map(t => t % 10000)).toEqual((STANDARDS['strict-curl'].all!).map(t => t % 10000))
    const carry = ladder('farmer-carry', woman())
    expect(carry.map(t => t % 1e9)).toEqual((STANDARDS['farmer-carry'].all!).map(t => t % 1e9))
    expect(Math.floor(carry.at(-1)! / 1e9)).toBe(700) // 1× BW becomes 0.7× BW
  })
})

describe('age', () => {
  it('eases an event with a number by its domain row', () => {
    expect(agePercent({ ageYears: 34 }, ev('deadlift'))).toBe(0)
    expect(agePercent({ ageYears: 60 }, ev('deadlift'))).toBe(15)
    expect(agePercent({ ageYears: 60 }, ev('snatch'))).toBe(20)
    expect(agePercent({ ageYears: 60 }, ev('running'))).toBe(10)
    expect(agePercent({ ageYears: 80 }, ev('wall-sit'))).toBe(25)
    expect(agePercent({ ageYears: 13 }, ev('deadlift'))).toBe(20)
    expect(agePercent({ ageYears: 15 }, ev('running'))).toBe(5)
  })

  it('moves an event with levels in colours instead, never both', () => {
    expect(usesPercent(ev('pause-dips'))).toBe(false)
    expect(agePercent({ ageYears: 60 }, ev('pause-dips'))).toBe(0)
    expect(colourAllowance(man(60), ev('pause-dips'))).toBe(1.5)
    expect(colourAllowance(man(60), ev('deadlift'))).toBe(0)
  })

  it('multiplies with sex: a 60-year-old woman deadlifts 68% of the list', () => {
    expect(numberShare(woman(60), ev('deadlift'))).toBeCloseTo(0.68)
    expect(ladder('deadlift', woman(60)).at(-1)).toBeCloseTo(1.36)
    expect(timeFactor(woman(60), ev('running'))).toBeCloseTo(1.232)
  })

  it('grades through the scaled list', () => {
    const lift = (kg: number, bw: number) => row('Deadlift', kg, { weight_kg: kg, bodyweightKg: bw })
    expect(eventGrade(ev('deadlift'), [lift(96, 60)], woman()).rung).toBe(12)
    expect(eventGrade(ev('deadlift'), [lift(96, 60)], man()).rung).toBe(8)
  })
})

describe('distance steps', () => {
  const run = ev('running')
  it('earns a low colour on the metres alone, in any time, with no score', () => {
    expect(eventGrade(run, [row('Running', null, { distance_m: 100 })], man()).rung).toBe(2)
    expect(eventGrade(run, [row('Running', null, { distance_m: 99 })], man()).rung).toBe(1)
    expect(eventGrade(run, [row('Running', null, { distance_m: 1000 })], man()).rung).toBe(5)
  })

  it('needs the full distance in the time for a timed colour', () => {
    expect(eventGrade(run, [row('Running', 10000 - 360, { distance_m: 1000 })], man()).rung).toBe(6)
    expect(eventGrade(run, [row('Running', 10000 - 361, { distance_m: 1000 })], man()).rung).toBe(5)
    expect(eventGrade(run, [row('Running', 10000 - 361, { distance_m: 1000 })], man()).exact).toBeUndefined()
    // An estimate from 500m ranks but earns only its step.
    expect(eventGrade(run, [row('Running', 5000 - 200, { distance_m: 500 })], man()).rung).toBe(4)
  })
})

describe('a weighted level in shares of bodyweight', () => {
  const pull = ev('wrestler-pullover')
  const onTop = (centiKg: number, bw: number | null) =>
    row('Wrestler Pullover', 30000 + centiKg, { difficulty_tier: 'Wrestler Pullover', bodyweightKg: bw })
  it('reads the load at the bodyweight on the row', () => {
    expect(eventGrade(pull, [onTop(800, 80)], man()).rung).toBe(8) // 0.1× BW is 8kg
    expect(eventGrade(pull, [onTop(799, 80)], man()).rung).toBe(7)
  })
  it('meets only "any" with no bodyweight, and never blocks the levels under it', () => {
    expect(eventGrade(pull, [onTop(800, null)], man()).rung).toBe(6)
    expect(eventGrade(pull, [row('Wrestler Pullover', 10030, { difficulty_tier: 'Elevated Assisted Wrestler Bridge' })], man()).rung).toBe(3)
  })
})

describe('AGE_ALLOWANCE_REVIEW.md is the table the code runs', () => {
  const sheet = readFileSync('AGE_ALLOWANCE_REVIEW.md', 'utf8')
  const section = (title: string) => sheet.slice(sheet.indexOf(`## ${title}`)).split('\n## ')[0]
  const rowOf = (label: string, title: string) => {
    const line = section(title).split('\n').find(l => l.startsWith(`| ${label} |`))
    if (!line) throw new Error(`no row for ${label}`)
    return line.split('|').slice(2, -1).map(v => Number(v.trim()))
  }
  it('matches the adult percentages', () => {
    expect(PERCENT_AGES).toEqual([35, 40, 45, 50, 55, 60, 65, 70, 75])
    expect(rowOf('Power', 'Percent: adults')).toEqual([...ADULT_PERCENT.power])
    expect(rowOf('Maximal Strength', 'Percent: adults')).toEqual([...ADULT_PERCENT.strength])
    expect(rowOf('Stamina, Endurance', 'Percent: adults')).toEqual([...ADULT_PERCENT.stamina])
  })
  it('matches the junior percentages', () => {
    expect(rowOf('Maximal Strength, Power', 'Percent: juniors')).toEqual([...JUNIOR_PERCENT.strength])
    expect(rowOf('Stamina, Endurance', 'Percent: juniors')).toEqual([...JUNIOR_PERCENT.stamina])
  })
  it('names every event the sex scaling names', () => {
    const body = section('Sex')
    for (const set of [LOWER_LOAD_SLUGS, UPPER_LOAD_SLUGS, JUMP_SLUGS, TIMED_ENDURANCE_SLUGS, UPPER_LEVEL_SLUGS]) {
      for (const slug of set) expect(body, slug).toContain(ev(slug).name.replace('Pause Back Squat', 'Back Squat').replace('Pause Front Squat', 'Front Squat'))
    }
  })
  it('leaves no event on the roster unaccounted for', () => {
    expect(EVENTS).toHaveLength(154)
  })
})

describe('a girl is never given an easier list than she had at 11', () => {
  const girl = (ageYears: number): GradePlayer => ({ division: 'Juniors', ageYears, gender: 'Female' })
  const graded = EVENTS.filter(e => STANDARDS[e.slug])

  it('holds on every event, at every age from 12 to 16', () => {
    for (const e of graded) {
      for (let age = 12; age <= 16; age++) {
        expect(numberShare(girl(age), e), `${e.slug} ${age}`).toBeGreaterThanOrEqual(numberShare(girl(11), e))
        expect(timeFactor(girl(age), e), `${e.slug} ${age}`).toBeLessThanOrEqual(timeFactor(girl(11), e))
        expect(colourAllowance(girl(age), e), `${e.slug} ${age}`).toBeLessThanOrEqual(colourAllowance(girl(11), e))
      }
    }
  })

  it('no longer eases Pause Bench from 70% at 11 to 56% at 12', () => {
    expect(numberShare(girl(11), ev('pause-bench'))).toBeCloseTo(0.7)
    expect(numberShare(girl(12), ev('pause-bench'))).toBeCloseTo(0.7)
    expect(numberShare(girl(14), ev('deadlift'))).toBeCloseTo(0.72)
  })

  it('leaves boys and adult women as they were', () => {
    const boy = (ageYears: number): GradePlayer => ({ division: 'Juniors', ageYears, gender: 'Male' })
    expect(numberShare(boy(12), ev('deadlift'))).toBeCloseTo(0.8)
    expect(numberShare(woman(60), ev('deadlift'))).toBeCloseTo(0.68)
  })
})
