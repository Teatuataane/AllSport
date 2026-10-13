import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { nzYear, yearOfDay, awardYear, awardsInYear, yearsToGrade, heldByYear, LATE_DAYS } from '@/lib/seasonYear'
import { gradeStateFrom, type GradeInputs, type ResultRow, type GradeAward } from '@/lib/loadGrades'
import { awardsToConfer } from '@/lib/autoConfer'
import { replayAwards } from '@/lib/replayColours'
import { pastOverallRungs, shownOverallRung } from '@/lib/colourDisplay'
import { heldInYear } from '@/lib/yearColours'
import { getEventBySlug } from '@/lib/eventData'

// ─── Colours per calendar year ───────────────────────────────────────────────
// Tāne, 13 Oct 2026: a colour is earned for a calendar year, January to
// December, NZ time. 1 January starts every domain on Mā again, and last
// year's colours stay on record. Migration 20261012230318.

afterEach(() => { vi.useRealTimers() })
const at = (iso: string) => vi.useFakeTimers({ now: new Date(iso), toFake: ['Date'] })

describe('the NZ year', () => {
  it('turns at NZ midnight, not UTC midnight', () => {
    // 11:30am UTC on 31 December is 12:30am on 1 January in Auckland (NZDT).
    expect(nzYear('2026-12-31T11:30:00.000Z')).toBe(2027)
    expect(nzYear('2026-12-31T10:30:00.000Z')).toBe(2026)
  })

  it('reads a day string by its own year', () => {
    expect(yearOfDay('2026-12-31')).toBe(2026)
    expect(yearOfDay(null)).toBeNull()
    expect(yearOfDay('not a day')).toBeNull()
  })

  it('takes an award\'s year from season_year, else the NZ year it was conferred', () => {
    expect(awardYear({ season_year: 2026, conferred_at: '2027-01-03T00:00:00Z' })).toBe(2026)
    expect(awardYear({ conferred_at: '2026-12-31T11:30:00.000Z' })).toBe(2027)
    const awards = [
      { season_year: 2026, conferred_at: '2026-05-01T00:00:00Z' },
      { season_year: 2027, conferred_at: '2027-02-01T00:00:00Z' },
    ]
    expect(awardsInYear(awards, 2026)).toEqual([awards[0]])
  })
})

describe('which years a recheck grades', () => {
  it('only this year for most of the year', () => {
    expect(yearsToGrade('2026-12-31T10:00:00.000Z')).toEqual([2026])
    expect(yearsToGrade('2027-06-01T00:00:00.000Z')).toEqual([2027])
  })

  it(`this year and last year for the first ${LATE_DAYS} days of January, NZ time`, () => {
    expect(yearsToGrade('2026-12-31T11:30:00.000Z')).toEqual([2027, 2026])
    expect(yearsToGrade('2027-01-14T10:00:00.000Z')).toEqual([2027, 2026])
    // 15 January in Auckland.
    expect(yearsToGrade('2027-01-14T11:30:00.000Z')).toEqual([2027])
  })
})

describe('colours held per year', () => {
  it('keeps the highest colour per domain, newest year first', () => {
    const y = heldByYear([
      { domain_number: 1, rung: 2, season_year: 2026, conferred_at: 'x' },
      { domain_number: 1, rung: 4, season_year: 2026, conferred_at: 'x' },
      { domain_number: 1, rung: 1, season_year: 2027, conferred_at: 'x' },
    ])
    expect(y.map(r => r.year)).toEqual([2027, 2026])
    expect(y[1].held.get(1)).toBe(4)
    expect(y[0].held.get(1)).toBe(1)
  })

  it('reads one year per player for the boards and chips', () => {
    const rows = [
      { player_id: 'a', domain_number: 1, rung: 5, season_year: 2026, conferred_at: 'x' },
      { player_id: 'a', domain_number: 1, rung: 1, season_year: 2027, conferred_at: 'x' },
      { player_id: 'b', domain_number: 2, rung: 3, season_year: 2026, conferred_at: 'x' },
    ]
    const h = heldInYear(rows, 2027)
    expect(h.get('a')?.get(1)).toBe(1)
    expect(h.has('b')).toBe(false)
  })
})

// ─── The engine, graded by year ──────────────────────────────────────────────

const GAME_MS = 100 * 60 * 1000
const row = (session: string, start: string, day: string, event = 'Deadlift', kg = 200): ResultRow => ({
  raw_score: kg, weight_kg: kg, difficulty_tier: null, session_id: session, points_earned: null,
  created_at: start, session_events: { event_name: event },
  sessions: {
    is_active: false, points_awarded_at: start, started_at: start, session_date: day,
    ended_at: new Date(Date.parse(start) + GAME_MS).toISOString(),
  },
  bodyweight_band: '70 to 80kg',
})

const inputs = (results: ResultRow[], awards: GradeAward[] = []): GradeInputs => ({
  profile: { division: "Men's", age_years: 30 }, gender: 'Male', band: '70 to 80kg',
  results, entries: [], exemptions: [], awards, matches: [],
  voids: new Set<string>(), schemaReady: true, workoutsReady: true, complete: true,
})

// 9am NZ on Saturday 5 December 2026.
const DEC = '2026-12-04T20:00:00.000Z'
// 9am NZ on 31 December 2026: still 2026 in NZ, and 30 December in UTC.
const NYE = '2026-12-30T20:00:00.000Z'
const award2026 = (domain: number, rung: number): GradeAward => ({
  id: `a${domain}-${rung}`, domain_number: domain, rung, grade_name: `G${rung}`,
  conferred_at: DEC, season_year: 2026, events: [],
})

describe('1 January', () => {
  const deadliftDomain = getEventBySlug('deadlift')!.domainNumber

  beforeEach(() => at('2027-01-20T00:00:00.000Z'))

  it('starts every domain on Mā, with no games, while 2026 stays on record', () => {
    const i = inputs([row('s1', DEC, '2026-12-05')], [award2026(deadliftDomain, 4)])
    const now = gradeStateFrom('p', i)
    expect(now.year).toBe(2027)
    expect(now.held.size).toBe(0)
    expect(now.awards).toEqual([])
    expect(now.games).toBe(0)
    expect(now.grades.events.get('deadlift')!.rung).toBe(0)
    expect(shownOverallRung(now)).toBe(0)
    // Last year is still there, on its own games.
    expect(now.allAwards).toHaveLength(1)
    expect(now.gamesByYear.get(2026)).toBe(1)
    const last = gradeStateFrom('p', i, { year: 2026 })
    expect(last.held.get(deadliftDomain)).toBe(4)
    expect(last.grades.events.get('deadlift')!.rung).toBeGreaterThan(0)
  })

  it('confers nothing in 2027 on 2026 evidence', () => {
    const i = inputs([row('s1', DEC, '2026-12-05')])
    expect(awardsToConfer('p', gradeStateFrom('p', i))).toEqual([])
    // ...but 2026 still owes its colour, stamped with its year.
    const owed = awardsToConfer('p', gradeStateFrom('p', i, { year: 2026 }))
    expect(owed.length).toBeGreaterThan(0)
    expect(owed.every(a => a.season_year === 2026)).toBe(true)
  })

  it('files a game by the NZ day it was played, not the UTC instant', () => {
    // 31 December NZ is 30 December UTC: plainly 2026 either way. The game
    // starting at 11:30pm NZ on 31 December is 2026 too, though by the time it
    // closes it is 2027.
    const late = '2026-12-31T10:30:00.000Z'
    const i = inputs([row('s1', NYE, '2026-12-31'), row('s2', late, '2026-12-31')])
    expect(gradeStateFrom('p', i, { year: 2026 }).games).toBe(2)
    expect(gradeStateFrom('p', i, { year: 2027 }).games).toBe(0)
  })

  it('caps a past year\'s overall colour by that year\'s own games', () => {
    // Ten domains at Kōwhai, but one game in 2026: one game caps at Kiwikiwi.
    const awards = Array.from({ length: 10 }, (_, d) => award2026(d + 1, 4))
    const s = gradeStateFrom('p', inputs([row('s1', DEC, '2026-12-05')], awards))
    expect(pastOverallRungs(s)).toEqual([{ year: 2026, rung: 1 }])
  })

  it('a logged entry counts in the year it was trained', () => {
    const entry = (performed_on: string) => ({
      event_slug: 'deadlift', count: 1, volume_distance_m: null, raw_score: 300, weight_kg: 300,
      difficulty_tier: null, bodyweight_band: '70 to 80kg',
      workouts: { player_id: 'p', performed_on, witnessed: false, created_at: '2027-01-02T00:00:00Z', session_id: null },
    })
    // Typed in on 2 January, trained on 31 December: a 2026 entry.
    const i = { ...inputs([]), entries: [entry('2026-12-31')] }
    expect(gradeStateFrom('p', i).grades.events.get('deadlift')!.rung).toBe(0)
    expect(gradeStateFrom('p', i, { year: 2026 }).grades.events.get('deadlift')!.rung).toBeGreaterThan(0)
  })
})

describe('a head-to-head rating', () => {
  const wrestling = getEventBySlug('wrestling')!
  // One agreed game: both players recorded it, each from their own side.
  const game = (id: string, created_at: string) => [
    { id: `${id}p`, session_id: `s-${id}`, outcome: 'a', created_at, confirmed_at: null, event_name: wrestling.name,
      players: [{ player_id: 'p', side: 'a' }, { player_id: 'q', side: 'b' }] },
    { id: `${id}q`, session_id: `s-${id}`, outcome: 'b', created_at, confirmed_at: null, event_name: wrestling.name,
      players: [{ player_id: 'q', side: 'a' }, { player_id: 'p', side: 'b' }] },
  ]

  it('stays lifetime, but only counts in a year that sport was played', () => {
    at('2027-03-01T00:00:00.000Z')
    const i = { ...inputs([]), matches: game('m1', '2026-06-01T00:00:00Z') } as unknown as GradeInputs
    // 2026: played, so the rating is there.
    expect(gradeStateFrom('p', i, { year: 2026 }).grades.events.get(wrestling.slug)?.rating).toBeDefined()
    // 2027: not played yet, so it is not.
    expect(gradeStateFrom('p', i).grades.events.get(wrestling.slug)?.rating).toBeUndefined()
    // One game in 2027 brings back the whole lifetime rating.
    const more = { ...i, matches: [...i.matches, ...game('m2', '2027-02-01T00:00:00Z')] } as GradeInputs
    expect(gradeStateFrom('p', more).grades.events.get(wrestling.slug)?.rating?.games).toBe(2)
  })
})

describe('the replay, across a new year', () => {
  it('confers the same colour again in the new year, each stamped with its own year', () => {
    const jan = '2027-01-29T20:00:00.000Z'
    const i = inputs([row('s1', DEC, '2026-12-05'), row('s2', jan, '2027-01-30')])
    const planned = replayAwards('p', i, '2027-02-01T00:00:00.000Z')
    const years = [...new Set(planned.map(a => a.season_year))].sort()
    expect(years).toEqual([2026, 2027])
    const deadliftDomain = getEventBySlug('deadlift')!.domainNumber
    const rungs = (y: number) => planned.filter(a => a.season_year === y && a.domain_number === deadliftDomain).map(a => a.rung)
    expect(rungs(2027)).toEqual(rungs(2026))
  })
})

// ─── The migration (20261012230318) ──────────────────────────────────────────
describe('the yearly colours migration', () => {
  const dir = 'supabase/migrations'
  const file = readdirSync(dir).find(n => n.endsWith('_yearly_colours.sql'))!
  const sql = readFileSync(`${dir}/${file}`, 'utf8')
  const confer = sql.match(/CREATE OR REPLACE FUNCTION public\.confer_grade[\s\S]*?\$\$;/)![0]

  it('is the newest definition of confer_grade', () => {
    const newest = readdirSync(dir).filter(n => n.endsWith('.sql')).sort()
      .filter(n => /FUNCTION public\.confer_grade/.test(readFileSync(`${dir}/${n}`, 'utf8'))).pop()
    expect(newest).toBe(file)
  })

  it('keeps every guard confer_grade had', () => {
    expect(confer).toMatch(/SECURITY DEFINER\s+SET search_path = public/)
    expect(confer).toMatch(/NOT public\.is_judge\(\)[\s\S]*?ERRCODE = '42501'/)
    expect(confer).toMatch(/NOT BETWEEN 1 AND 10/)
    expect(confer).toMatch(/NOT BETWEEN 1 AND 12/)
    expect(confer).toMatch(/a guest cannot hold a colour/)
    expect(confer).toMatch(/already holds a higher colour/)
    expect(confer).toMatch(/not in that domain/)
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.confer_grade(uuid, int, int, text[], uuid) FROM PUBLIC, anon;')
  })

  it('scopes "already holds a higher colour" to this year, and conflicts on the year key', () => {
    expect(confer).toMatch(/domain_number = p_domain_number AND season_year = v_year/)
    expect(confer).toMatch(/ON CONFLICT \(player_id, domain_number, rung, season_year\) DO NOTHING/)
  })

  it('keeps the old unique key, which the live route upserts on until the new code is out', () => {
    expect(sql).not.toMatch(/DROP CONSTRAINT[^;]*rung_key/)
    expect(sql).toMatch(/the old unique key is gone too early/)
  })

  it('is the key the route, the replay and the gap script upsert on', () => {
    expect(sql).toMatch(/ON public\.grade_awards \(player_id, domain_number, rung, season_year\)/)
    const route = readFileSync('app/api/grades/recheck/route.ts', 'utf8')
    expect(route).toContain("const AWARD_KEY = 'player_id,domain_number,rung,season_year'")
    expect(route).not.toMatch(/onConflict: 'player_id,domain_number,rung'/)
    for (const f of ['scripts/replay-colours.ts', 'scripts/withdraw-gap-colours.ts']) {
      expect(readFileSync(f, 'utf8')).toMatch(/onConflict: 'player_id,domain_number,rung,season_year'/)
    }
  })
})
