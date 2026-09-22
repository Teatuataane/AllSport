import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadGradeState, type GradeDb } from '@/lib/loadGrades'

// ─── The grades loader runs anywhere ─────────────────────────────────────────
// Step 2 of docs/designs/auto-conferral-spec.md: the engine has to run on a
// server, against the caller's own login, so `loadGradeState` takes its client
// rather than importing a browser one at module scope.
//
// A source grep alone would be weak, so these drive the whole loader with a
// stub client. That also covers the 42703 fallback ladders, which are the part
// that decides whether a deploy in the wrong order loses a player's scores.

type Resp = { data: unknown; error: { code: string } | null }
const ok = (data: unknown): Resp => ({ data, error: null })
const missingColumn: Resp = { data: null, error: { code: '42703' } }
/** A table that does not exist yet — a known empty, not a failure. */
const missingTable: Resp = { data: null, error: { code: 'PGRST205' } }

/** Every query logs the table and the columns it asked for, then answers from a script. */
function fakeDb(script: Record<string, Resp[]>, log: { table: string; cols: string }[] = []) {
  const from = (table: string) => {
    let cols = ''
    const b: Record<string, unknown> = {
      select: (c: string) => { cols = c; return b },
      eq: () => b, not: () => b, order: () => b, range: () => b, maybeSingle: () => b,
      then: (res: (r: Resp) => unknown, rej: (e: unknown) => unknown) => {
        log.push({ table, cols })
        // A `table|columns` entry answers that exact read, so two reads of one
        // table are scripted independently of the order they happen to run in.
        const queue = script[`${table}|${cols}`] ?? script[table] ?? [ok([])]
        const r = queue.length > 1 ? queue.shift()! : queue[0]
        return Promise.resolve(r).then(res, rej)
      },
    }
    return b
  }
  return { db: { from } as unknown as GradeDb, log }
}

// The base fixture is a database from BEFORE 20260922213125: no
// player_bodyweights table, so the loader falls back to the stored bands. That
// is the deploy-order case worth pinning, and the declarations path gets its
// own block at the bottom.
const base = (): Record<string, Resp[]> => ({
  player_bodyweights: [missingTable],
  players_public: [ok({ division: "Men's", age_years: 30 })],
  players: [ok({ gender: 'Male', bodyweight_band: '90 to 100kg' })],
  results: [ok([{
    raw_score: 100, weight_kg: 100, difficulty_tier: null, session_id: 's1',
    points_earned: 10, created_at: '2026-09-01T00:00:00Z', bodyweight_band: '90 to 100kg',
    session_events: { event_name: 'Deadlift' },
    sessions: { is_active: false, points_awarded_at: '2026-09-01T02:00:00Z', started_at: '2026-09-01T00:00:00Z' },
  }])],
  grade_exemptions: [ok([])],
  grade_awards: [ok([])],
  workout_entries: [ok([])],
  matches: [ok([])],
  sessions: [ok([])],
})

describe('lib/loadGrades.ts is server-safe', () => {
  it('never imports the browser client', () => {
    // This is the property that makes the module usable on a server, and it
    // would regress silently the first time someone adds a convenience import.
    const src = readFileSync('lib/loadGrades.ts', 'utf8')
    expect(src).not.toMatch(/from '\.\/supabase-browser'/)
    expect(src).not.toMatch(/createClient\(\)/)
  })

  it('grades a player through a client it was handed, with no browser at all', async () => {
    const { db } = fakeDb(base())
    const state = await loadGradeState(db, 'p1')
    expect(state).not.toBeNull()
    // The deadlift above is rung 5 at a 90-100kg band. See bodyweightBand.test.ts.
    expect(state!.grades.events.get('deadlift')!.rung).toBe(5)
    expect(state!.games).toBe(1)
  })

  it('returns null for a player it cannot find', async () => {
    const { db } = fakeDb({ ...base(), players_public: [ok(null)] })
    expect(await loadGradeState(db, 'nobody')).toBeNull()
  })
})

describe('the 42703 fallbacks', () => {
  it('asks results for the band, then re-asks without it', async () => {
    const script = base()
    script.results = [missingColumn, ok([])]
    const { db, log } = fakeDb(script)
    await loadGradeState(db, 'p1')
    const asked = log.filter(c => c.table === 'results').map(c => c.cols)
    expect(asked).toHaveLength(2)
    expect(asked[0]).toContain('bodyweight_band')
    expect(asked[1]).not.toContain('bodyweight_band')
  })

  it('drops the workout columns one at a time, newest first', async () => {
    // Dropping both at once would lose session_id too, and every swap played at
    // a game would be labelled `solo` evidence for the length of the deploy.
    const script = base()
    script.workout_entries = [missingColumn, ok([])]
    const { db, log } = fakeDb(script)
    await loadGradeState(db, 'p1')
    const asked = log.filter(c => c.table === 'workout_entries').map(c => c.cols)
    expect(asked).toHaveLength(2)
    expect(asked[0]).toContain('bodyweight_band')
    expect(asked[1]).not.toContain('bodyweight_band')
    expect(asked[1]).toContain('session_id')
  })

  it('falls back again when session_id is missing too', async () => {
    const script = base()
    script.workout_entries = [missingColumn, missingColumn, ok([])]
    const { db, log } = fakeDb(script)
    await loadGradeState(db, 'p1')
    const asked = log.filter(c => c.table === 'workout_entries').map(c => c.cols)
    expect(asked).toHaveLength(3)
    expect(asked[2]).not.toContain('session_id')
  })
})

describe('the 42703 fallbacks keep the scores', () => {
  // Asking again is not the point; the point is that the answer to the second
  // ask is what the player is graded on. A loader that retried and then threw
  // the rows away would pass every test above.
  it('grades on the retried results', async () => {
    const script = base()
    const rows = (script.results[0].data as Record<string, unknown>[]).map(({ bodyweight_band: _b, ...r }) => r)
    script.results = [missingColumn, ok(rows)]
    const { db } = fakeDb(script)
    const state = await loadGradeState(db, 'p1')
    // No band on the row: it falls back to the player's, 90 to 100kg -> rung 5.
    expect(state!.grades.events.get('deadlift')!.rung).toBe(5)
    expect(state!.games).toBe(1)
  })

  it('grades on the retried workout entries', async () => {
    const script = base()
    script.results = [ok([])]
    script.workout_entries = [missingColumn, ok([{
      event_slug: 'deadlift', count: 1, volume_distance_m: null, raw_score: 100, weight_kg: 100, difficulty_tier: null,
      workouts: { player_id: 'p1', performed_on: '2026-09-01', witnessed: false, created_at: '2026-09-01T00:00:00Z', session_id: null },
    }])]
    const { db } = fakeDb(script)
    const state = await loadGradeState(db, 'p1')
    expect(state!.grades.events.get('deadlift')!.rung).toBe(5)
    expect(state!.grades.events.get('deadlift')!.source).toBe('solo')
  })

  it('reads the first band when it exists, and survives a database without it', async () => {
    const withFirst = base()
    withFirst.players = [ok({ gender: 'Male', bodyweight_band: 'Under 50kg', bodyweight_band_first: '90 to 100kg' })]
    const rows = (withFirst.results[0].data as Record<string, unknown>[]).map(r => ({ ...r, bodyweight_band: null }))
    withFirst.results = [ok(rows)]
    // Unstamped lift, current band Under 50kg, first band 90 to 100kg: graded
    // on the FIRST, so re-declaring lighter gains nothing.
    expect((await loadGradeState(fakeDb(withFirst).db, 'p1'))!.grades.events.get('deadlift')!.rung).toBe(5)

    // A database without bodyweight_band_first: the band read hits 42703 and
    // must ask again without it, keeping the current band.
    const without = base()
    without['players|bodyweight_band, bodyweight_band_first'] = [missingColumn]
    const { db, log } = fakeDb(without)
    const state = await loadGradeState(db, 'p1')
    const bandAsks = log.filter(c => c.table === 'players' && c.cols.includes('bodyweight_band')).map(c => c.cols)
    expect(bandAsks).toEqual(['bodyweight_band, bodyweight_band_first', 'bodyweight_band'])
    expect(state!.hasBand).toBe(true)
    expect(state!.grades.events.get('deadlift')!.rung).toBe(5)
  })
})

describe('the bodyweight of the day', () => {
  // Once 20260922213125 is applied, declarations are the ONLY source: the
  // stored band is not consulted, or moving the question would have changed
  // nothing for the 26 of 27 players who never answered it.
  const declaring = (rows: unknown[]) => {
    const script = base()
    script.player_bodyweights = [ok(rows)]
    // The lift is on 2026-09-01 and carries a stale band, to prove neither is read.
    const results = (script.results[0].data as Record<string, unknown>[]).map(r => ({
      ...r, bodyweight_band: 'Under 50kg',
      sessions: { ...(r.sessions as object), session_date: '2026-09-01' },
    }))
    script.results = [ok(results)]
    return script
  }

  it('grades the lift against the declaration in force on the day', async () => {
    const script = declaring([{ measured_on: '2026-08-01', kg: 95, created_at: '2026-08-01T00:00:00Z' }])
    const state = await loadGradeState(fakeDb(script).db, 'p1')
    // 100kg at 95kg bodyweight is rung 5. The row's own band says Under 50kg,
    // which would be rung 11 — so the band is genuinely no longer read.
    expect(state!.grades.events.get('deadlift')!.rung).toBe(5)
    expect(state!.hasBand).toBe(true)
  })

  it('uses the most recent declaration at or before the day, not the latest overall', async () => {
    const script = declaring([
      { measured_on: '2026-08-01', kg: 95, created_at: '2026-08-01T00:00:00Z' },
      { measured_on: '2026-09-20', kg: 45, created_at: '2026-09-20T00:00:00Z' },
    ])
    // A lighter weight declared AFTER the lift must not re-price it.
    expect((await loadGradeState(fakeDb(script).db, 'p1'))!.grades.events.get('deadlift')!.rung).toBe(5)
  })

  it('counts the lift as unmet when the table is live but they have declared nothing', async () => {
    const script = declaring([])
    const state = await loadGradeState(fakeDb(script).db, 'p1')
    const g = state!.grades.events.get('deadlift')!
    expect(g.rung).toBe(0)
    expect(g.gradeable).toBe(true)
    expect(g.bodyweightBlocked).toBe(true)
    expect(state!.hasBand).toBe(false)
  })

  it('marks the state INCOMPLETE when the declarations read fails', async () => {
    // Not a missing table — a real error against a database that has it. A
    // silent empty reads as "declared nothing", and a kaiwhakawā deleting a
    // score re-judges that domain and would withdraw strength colours on a
    // transient network error. The route must not write on this.
    const script = declaring([])
    script.player_bodyweights = [{ data: null, error: { code: '08006' } }]
    expect((await loadGradeState(fakeDb(script).db, 'p1'))!.complete).toBe(false)
  })

  it('stays complete when the table simply is not there yet', async () => {
    expect((await loadGradeState(fakeDb(base()).db, 'p1'))!.complete).toBe(true)
  })
})

describe('the voided-sessions cache', () => {
  it('reads once per client, not once per process', async () => {
    // A module-scope memo is "once per page load" in a browser but "once per
    // process lifetime" on a server, so a game voided after the server started
    // would stay invisible until the next deploy.
    const a = fakeDb(base())
    await loadGradeState(a.db, 'p1')
    await loadGradeState(a.db, 'p2')
    expect(a.log.filter(c => c.table === 'sessions')).toHaveLength(1)

    const b = fakeDb(base())
    await loadGradeState(b.db, 'p1')
    expect(b.log.filter(c => c.table === 'sessions')).toHaveLength(1)
  })

  it('does not cache a failure', async () => {
    const script = base()
    script.sessions = [{ data: null, error: { code: '500' } }, ok([])]
    const { db, log } = fakeDb(script)
    await loadGradeState(db, 'p1')
    await loadGradeState(db, 'p2')
    expect(log.filter(c => c.table === 'sessions')).toHaveLength(2)
  })
})

describe('an inactive profile', () => {
  it('is reported as inactive, and an active one as active', async () => {
    const off = base()
    off.players_public = [ok({ division: "Men's", age_years: 30, is_active: false })]
    expect((await loadGradeState(fakeDb(off).db, 'p1'))!.active).toBe(false)
    expect((await loadGradeState(fakeDb(base()).db, 'p1'))!.active).toBe(true)
  })
})

describe('complete: whether the route may act on what was read', () => {
  const failed = { data: null, error: { code: '500', message: 'boom' } }
  const tableMissing = { data: null, error: { code: 'PGRST205' } }

  it('is true when every read succeeded', async () => {
    expect((await loadGradeState(fakeDb(base()).db, 'p1'))!.complete).toBe(true)
  })

  it('is false when the results read failed, though it looks like "no scores"', async () => {
    const s = base(); s.results = [failed]
    expect((await loadGradeState(fakeDb(s).db, 'p1'))!.complete).toBe(false)
  })

  it('is false when the voids read failed', async () => {
    const s = base(); s.sessions = [failed]
    expect((await loadGradeState(fakeDb(s).db, 'p1'))!.complete).toBe(false)
  })

  it('is false when the matches read failed', async () => {
    const s = base(); s.matches = [failed]
    expect((await loadGradeState(fakeDb(s).db, 'p1'))!.complete).toBe(false)
  })

  it('treats a table that does not exist yet as a known empty, not a failure', async () => {
    const s = base(); s.workout_entries = [tableMissing]; s.grade_exemptions = [tableMissing]
    expect((await loadGradeState(fakeDb(s).db, 'p1'))!.complete).toBe(true)
  })
})
