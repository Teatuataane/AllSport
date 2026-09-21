import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'fs'
import { EVENTS } from '@/lib/eventData'
import {
  workoutMinutes, sessionLoad, recentLoad, weekStart, weeklyActivity, normaliseActivity,
  EFFORT_WORDS, GAME_MINUTES, GUIDELINE_MINUTES, MIN_COHORT, type ActivityInput,
} from '@/lib/workouts'

const dir = 'supabase/migrations'
const sql = readFileSync(`${dir}/20260918023038_training_load.sql`, 'utf8')

describe('how long and how hard', () => {
  it('uses the workout minutes when given, and never adds the entries on top', () => {
    expect(workoutMinutes({ performed_on: '2026-09-18', duration_minutes: 45, effort_rating: null, entry_seconds: [600, 1200] })).toBe(45)
  })
  it('falls back to the entries, then to zero', () => {
    expect(workoutMinutes({ performed_on: '2026-09-18', duration_minutes: null, effort_rating: null, entry_seconds: [600, null, 1200] })).toBe(30)
    expect(workoutMinutes({ performed_on: '2026-09-18', duration_minutes: null, effort_rating: null })).toBe(0)
  })
  it('load is minutes times effort, and needs both', () => {
    expect(sessionLoad({ performed_on: 'x', duration_minutes: 60, effort_rating: 7 })).toBe(420)
    expect(sessionLoad({ performed_on: 'x', duration_minutes: 60, effort_rating: null })).toBeNull()
    expect(sessionLoad({ performed_on: 'x', duration_minutes: null, effort_rating: 7 })).toBeNull()
  })
  it('sums the last week only, and load only over rated workouts', () => {
    const now = new Date('2026-09-18T02:00:00Z') // Friday 18 Sep NZ
    const w = recentLoad([
      { performed_on: '2026-09-18', duration_minutes: 30, effort_rating: 5 },
      { performed_on: '2026-09-12', duration_minutes: 20, effort_rating: null },
      { performed_on: '2026-09-11', duration_minutes: 90, effort_rating: 9 }, // eight days back
    ], 7, now)
    expect(w).toEqual({ minutes: 50, load: 150, rated: 1, workouts: 2 })
  })
  it('has a word for every rating 1 to 10', () => {
    for (let n = 1; n <= 10; n++) expect(EFFORT_WORDS[n]).toBeTruthy()
  })
})

describe('weekly activity report', () => {
  it('weeks start on Monday', () => {
    expect(weekStart('2026-09-14')).toBe('2026-09-14') // Monday
    expect(weekStart('2026-09-20')).toBe('2026-09-14') // Sunday
    expect(weekStart('2026-09-21')).toBe('2026-09-21')
  })

  const adult = (id: string, logged: number, games = 0): ActivityInput => ({
    playerId: id, rangatahi: false, logged: logged ? [{ day: '2026-09-15', minutes: logged }] : [],
    games: Array.from({ length: games }, () => '2026-09-16'),
  })
  const kid = (id: string, logged: number): ActivityInput => ({ ...adult(id, logged), rangatahi: true })

  it('counts a game as 100 minutes and judges each player by their own guideline', () => {
    const rows = weeklyActivity([adult('a', 0, 2), adult('b', 60), adult('c', 30, 1), kid('k1', 300), kid('k2', 500), kid('k3', 0)].map(i =>
      i.playerId === 'k3' ? { ...i, games: ['2026-09-16'] } : i))
    const all = rows.find(r => r.cohort === 'all')!
    expect(all.players).toBe(6)
    expect(all.gameMinutes).toBe(4 * GAME_MINUTES)
    // a 200, c 130 → only a meets 150; k2 500 meets 420, k1 300 does not.
    expect(rows.find(r => r.cohort === 'adults')!.meetingGuideline).toBe(1)
    expect(rows.find(r => r.cohort === 'rangatahi')!.meetingGuideline).toBe(1)
    expect(GUIDELINE_MINUTES).toEqual({ adult: 150, rangatahi: 420 })
  })

  it('drops a small cohort AND the all row, so nobody can be subtracted out', () => {
    const rows = weeklyActivity([adult('a', 60), adult('b', 60), adult('c', 60), kid('k', 999)])
    expect(rows.map(r => r.cohort)).toEqual(['adults'])
    expect(MIN_COHORT).toBe(3)
  })

  it('keeps the all row when there are no rangatahi at all', () => {
    const rows = weeklyActivity([adult('a', 60), adult('b', 90), adult('c', 200)])
    expect(rows.map(r => r.cohort).sort()).toEqual(['adults', 'all'])
    expect(rows.find(r => r.cohort === 'all')!.medianMinutes).toBe(90)
  })
})

describe('training load migration', () => {
  it('adds both columns with range CHECKs', () => {
    expect(sql).toMatch(/duration_minutes int\s+CONSTRAINT workouts_duration_minutes_range CHECK \(duration_minutes IS NULL OR duration_minutes BETWEEN 1 AND 1440\)/)
    expect(sql).toMatch(/effort_rating smallint\s+CONSTRAINT workouts_effort_rating_range CHECK \(effort_rating IS NULL OR effort_rating BETWEEN 1 AND 10\)/)
  })

  const seed = sql.slice(sql.indexOf('INSERT INTO public.activity_aliases'), sql.indexOf('ON CONFLICT (alias) DO NOTHING'))
  const seeded = [...seed.matchAll(/\('([^']+)', '([^']+)'\)/g)].map(m => [m[1], m[2]] as const)
  const slugs = new Set(EVENTS.map(e => e.slug))

  // This migration is APPLIED and frozen, so it still names slugs that a later
  // roster change may have renamed — 20260920220344 repointed four carries.
  // What has to hold is the EFFECTIVE state: no alias in the database may point
  // at an event that does not exist, because fit_activity() then silently never
  // fits it. So replay every later repoint before checking, which also means a
  // future rename that forgets its UPDATE fails here rather than in the gym.
  const effective = new Map<string, string>(seeded)
  for (const name of readdirSync(dir).sort()) {
    if (name <= '20260918023038_training_load.sql') continue
    const later = readFileSync(`${dir}/${name}`, 'utf8')
    // A later migration can reach the table three ways. Each is replayed, and a
    // form this parser does not understand FAILS the test rather than being
    // skipped — skipping is exactly how an orphaned alias would get through.
    for (const ins of later.matchAll(/INSERT INTO (?:public\.)?activity_aliases[^;]*;/g)) {
      for (const t of ins[0].matchAll(/\('([^']+)', '([^']+)'\)/g)) effective.set(t[1], t[2])
    }
    for (const u of later.matchAll(/UPDATE (?:public\.)?activity_aliases SET event_slug = '([^']+)'\s+WHERE alias (?:IN \(([^)]*)\)|= ('[^']*'))/g)) {
      for (const a of (u[2] ?? u[3]).matchAll(/'([^']+)'/g)) effective.set(a[1], u[1])
    }
    const touches = (later.match(/(?:INSERT INTO|UPDATE|DELETE FROM) (?:public\.)?activity_aliases/g) ?? []).length
    const understood = (later.match(/INSERT INTO (?:public\.)?activity_aliases/g) ?? []).length
      + (later.match(/UPDATE (?:public\.)?activity_aliases SET event_slug = '[^']+'\s+WHERE alias (?:IN \(|= ')/g) ?? []).length
    if (touches !== understood) throw new Error(`${name} changes activity_aliases in a form this test cannot replay`)
  }
  const pairs = [...effective.entries()]

  it('seeds aliases only for real events, already normalised', () => {
    expect(pairs.length).toBeGreaterThan(100)
    for (const [alias, slug] of pairs) {
      expect(slugs.has(slug), `${alias} → ${slug}`).toBe(true)
      expect(normaliseActivity(alias)).toBe(alias)
    }
  })

  it('repoints the carries the Sept 2026 rename retired', () => {
    expect(effective.get('farmers walk')).toBe('farmer-carry')
    expect(effective.get('farmer carry')).toBe('farmer-carry')
    expect(effective.get('sandbag carry')).toBe('sandbag-carry')
  })

  it('never aliases the movements the roster deliberately keeps apart', () => {
    const aliases = new Map(pairs)
    for (const w of ['overhead press', 'ohp', 'calf raise', 'calf raises', 'burpees', 'sit ups', 'tramp', 'swim', 'swimming', 'surfing', 'bouldering', 'yoga', 'walking']) {
      expect(aliases.has(w), w).toBe(false)
    }
  })

  it('checks every alias against the roster before it can report success', () => {
    expect(sql).toContain('NOT EXISTS (SELECT 1 FROM event_domains d WHERE d.slug = a.event_slug)')
  })
})
