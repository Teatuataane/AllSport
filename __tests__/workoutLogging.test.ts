import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { EVENTS, getEventByName, type EventData } from '@/lib/eventData'
import { computeScoreVals, scoreColumns, tierScoring, EMPTY_VALS, type EntryVals } from '@/lib/scoring'
import { colourGate, TOP_RUNG, MIN_RATED_GAMES } from '@/lib/grading'
import { eventGrade, type GradePlayer } from '@/lib/playerGrades'
import { isGameTier, isDistanceEvent, metresIn } from '@/lib/eventKinds'
import {
  fitActivity, suggestEvents, workoutEvidence, nzDay, addDays, allowedDays, BACKDATE_DAYS,
  type WorkoutEntryRow,
} from '@/lib/workouts'

const ev = (name: string) => {
  const e = getEventByName(name)
  if (!e) throw new Error(`${name} is not on the roster`)
  return e
}
const vals = (p: Partial<EntryVals>): EntryVals => ({ ...EMPTY_VALS, ...p })

// ─── scoreColumns: parity with the payload the live session used to build ─────
// The live session's submitEntry built these columns inline until v0.8.0.0.
// This is that code, verbatim, kept as the reference: scoreColumns must write
// exactly what it wrote, for every mode, tier and input shape, or a game score
// and a logged best stop being encoded the same way.
function legacyPayload(mode: string, eventData: EventData | undefined, v: EntryVals): Record<string, unknown> | null {
  const scored = computeScoreVals(mode, eventData, v)
  if (!scored) return null
  const totalSecs = (parseFloat(v.timeMins) || 0) * 60 + (parseFloat(v.timeSecs) || 0)
  const payload: Record<string, unknown> = { raw_score: scored.raw_score, score_label: scored.score_label }
  const isWeightVariation = !!v.exerciseVariation && (eventData?.weightVariations?.includes(v.exerciseVariation) ?? false)
  if (v.difficultyTier) payload.difficulty_tier = v.difficultyTier
  if (v.exerciseVariation) payload.exercise_variation = v.exerciseVariation
  if (mode === 'strength') {
    payload.weight_kg = parseFloat(v.weightKg) || 0
    if (v.repCount) payload.reps = parseInt(v.repCount)
  }
  if (mode === 'reps') {
    if (isWeightVariation) payload.weight_kg = parseFloat(v.weightKg) || 0
    payload.reps = parseInt(v.repCount) || 0
  }
  if (['time', 'hold', 'difficulty+time', 'weight+time'].includes(mode) && totalSecs > 0) payload.time_seconds = totalSecs
  if (mode === 'weight+time') payload.weight_kg = parseFloat(v.weightKg) || 0
  if (mode === 'difficulty+reps' || mode === 'difficulty+distance') {
    const special = tierScoring(eventData, { name: v.difficultyTier })
    if (special === 'weight') {
      payload.weight_kg = parseFloat(v.weightKg) || 0
      if (v.repCount) payload.reps = parseInt(v.repCount)
    } else if (special === 'sport') {
      if (v.opponentName) payload.opponent_name = v.opponentName
      payload.result_type = v.sportResult
      if (v.scoreInput) payload.match_score = v.scoreInput
      else if (v.sportScore) payload.match_score = v.sportScore
    } else if (mode === 'difficulty+distance') {
      payload.distance_m = parseFloat(v.distanceVal) || 0
    } else {
      payload.reps = parseInt(v.repCount) || 0
    }
  }
  if (mode === 'difficulty+time' && tierScoring(eventData, { name: v.difficultyTier }) === 'sport') {
    if (v.opponentName) payload.opponent_name = v.opponentName
    payload.result_type = v.sportResult
  }
  if (mode === 'sprint') {
    const s = parseFloat(v.timeSecs) || 0; const cs = parseInt(v.sprintCs) || 0
    payload.time_seconds = s + cs / 100
  }
  if (mode === 'distance') {
    const val = parseFloat(v.distanceVal) || 0
    payload.distance_m = v.distanceUnit === 'm' ? val : val / 100
  }
  if (mode === 'sport') {
    payload.result_type = v.sportResult
    if (v.opponentName) payload.opponent_name = v.opponentName
    if (v.sportScore) payload.match_score = v.sportScore
  }
  return payload
}

const MODES = ['strength', 'reps', 'time', 'hold', 'distance', 'sport', 'sprint',
  'difficulty+time', 'difficulty+reps', 'difficulty+distance', 'weight+time', 'score']

// Input shapes that reach every branch: weight with and without reps, times,
// sprints, both distance units, all three results, opponents and strokes.
const SHAPES: Partial<EntryVals>[] = [
  {},
  { weightKg: '80', repCount: '5' },
  { weightKg: '62.5' },
  { repCount: '12' },
  { timeMins: '1', timeSecs: '30' },
  { timeSecs: '45' },
  { timeSecs: '11', sprintCs: '45' },
  { distanceVal: '250', distanceUnit: 'm' },
  { distanceVal: '185', distanceUnit: 'cm' },
  { sportResult: 'win', opponentName: 'Mere', sportScore: '3-1' },
  { sportResult: 'loss', opponentName: '' },
  { sportResult: 'draw', scoreInput: '18', sportScore: '2-2' },
  { weightKg: '20', repCount: '3', timeMins: '0', timeSecs: '40' },
  { exerciseVariation: 'Weighted', weightKg: '10', repCount: '8' },
]

function shapesFor(e: EventData | undefined): EntryVals[] {
  const tiers = ['', ...(e?.difficultyTiers ?? []).map(t => t.name)]
  return tiers.flatMap(t => SHAPES.map(s => vals({ ...s, difficultyTier: t })))
}

describe('scoreColumns writes exactly what the live session used to write', () => {
  it('matches the old payload for every roster event in its own mode, every rung, every input shape', () => {
    const scoredByMode = new Map<string, number>()
    for (const e of EVENTS) {
      for (const v of shapesFor(e)) {
        const want = legacyPayload(e.inputMode, e, v)
        const got = scoreColumns(e.inputMode, e, v)
        expect(got, `${e.slug} ${JSON.stringify(v)}`).toStrictEqual(want)
        if (got) scoredByMode.set(e.inputMode, (scoredByMode.get(e.inputMode) ?? 0) + 1)
      }
    }
    // The matrix must actually score something in every mode the roster uses,
    // or a parity pass over nothing but nulls would prove nothing.
    for (const mode of new Set(EVENTS.map(e => e.inputMode))) expect(scoredByMode.get(mode) ?? 0, mode).toBeGreaterThan(0)
  })

  it('matches in every mode, including the ones only historical rows still use (time, sprint, score, reps)', () => {
    const sample = ['Deadlift', 'Tennis', 'Pause Dips', 'Javelin', 'Cycling', '100m Sprint', 'Leg Ext Hold', 'Golf', 'Wrestling', 'Wall Sit', 'High Jump']
      .map(ev)
    // No roster event carries weightVariations any more; the reps branch still reads them.
    const withVariation = { ...ev('Deadlift'), inputMode: 'reps', weightVariations: ['Weighted'] } as EventData
    for (const mode of MODES) {
      for (const e of [...sample, withVariation, undefined]) {
        for (const v of shapesFor(e)) {
          expect(scoreColumns(mode, e, v), `${mode} ${e?.slug} ${JSON.stringify(v)}`).toStrictEqual(legacyPayload(mode, e, v))
        }
      }
    }
  })

  it('records reps beside the weight on a weight rung, and never ranks them', () => {
    const dips = ev('Pause Dips')
    const rung = dips.difficultyTiers!.find(t => t.scoring === 'weight')!.name
    const c = scoreColumns(dips.inputMode, dips, vals({ difficultyTier: rung, weightKg: '20', repCount: '3' }))!
    expect(c.weight_kg).toBe(20)
    expect(c.reps).toBe(3)
    const fewer = scoreColumns(dips.inputMode, dips, vals({ difficultyTier: rung, weightKg: '20', repCount: '1' }))!
    expect(fewer.raw_score).toBe(c.raw_score)
  })

  it('writes the result and opponent on a Game rung, and no drill columns', () => {
    const tennis = ev('Tennis')
    const game = tennis.difficultyTiers!.find(t => t.scoring === 'sport')!.name
    const c = scoreColumns(tennis.inputMode, tennis, vals({ difficultyTier: game, sportResult: 'win', opponentName: 'Mere', repCount: '9' }))
    expect(c).toMatchObject({ result_type: 'win', opponent_name: 'Mere', difficulty_tier: game })
    expect(c).not.toHaveProperty('reps')
  })

  it('is null wherever computeScoreVals is, so nothing half-encoded is ever written', () => {
    expect(scoreColumns('strength', ev('Deadlift'), vals({ repCount: '5' }))).toBeNull()
    expect(scoreColumns('difficulty+reps', ev('Pause Dips'), vals({}))).toBeNull()
  })
})

// ─── Event colour: which source earned it ────────────────────────────────────

describe('the source behind an event colour', () => {
  const adult: GradePlayer = { division: "Men's", ageYears: 30, gender: 'Male' }
  const tennis = ev('Tennis')
  const drill = tennis.difficultyTiers!.find(t => t.scoring !== 'sport')!.name
  const row = (raw: number, source: 'game' | 'witnessed' | 'solo' | undefined, tier = drill) =>
    ({ event_name: 'Tennis', raw_score: raw, weight_kg: null, difficulty_tier: tier, ...(source ? { source } : {}) })

  it('is a game when the rating beats the capped drill, because ratings only come from recorded matches', () => {
    const g = eventGrade(tennis, [row(15, 'solo')], adult, { rating: 1100, games: MIN_RATED_GAMES })
    expect(g.rung).toBeGreaterThan(6)
    expect(g.source).toBe('game')
  })

  it('stays with the drill row when the rating has too few games to count', () => {
    const g = eventGrade(tennis, [row(15, 'witnessed')], adult, { rating: 1400, games: MIN_RATED_GAMES - 1 })
    expect(g.rung).toBeGreaterThan(0)
    expect(g.source).toBe('witnessed')
  })

  it('takes the earliest row on a tie, so a game result listed first beats an equal solo log', () => {
    expect(eventGrade(tennis, [row(15, 'game'), row(15, 'solo')], adult).source).toBe('game')
    expect(eventGrade(tennis, [row(15, 'solo'), row(15, 'game')], adult).source).toBe('solo')
  })

  it('ignores Game-rung rows when choosing the drill that set the colour', () => {
    const game = tennis.difficultyTiers!.find(t => t.scoring === 'sport')!.name
    const idx = tennis.difficultyTiers!.findIndex(t => t.name === game)
    const g = eventGrade(tennis, [row(15, 'solo'), row(idx * 10000 + 2, 'witnessed', game)], adult)
    expect(g.source).toBe('solo')
  })

  it('carries no source when nothing earns a colour, or when the rows carry none', () => {
    expect(eventGrade(tennis, [row(1, 'solo')], adult)).not.toHaveProperty('source')
    const g = eventGrade(tennis, [row(15, undefined)], adult)
    expect(g.rung).toBeGreaterThan(0)
    expect(g).not.toHaveProperty('source')
  })

  it('takes the source from the heaviest lift on a bodyweight-ratio event', () => {
    const junior: GradePlayer = { division: 'Juniors', ageYears: 14, gender: 'Male' }
    // Juniors declare a bodyweight like everyone else now; they used to be
    // graded as a fixed 50kg lifter whatever they weighed.
    const lift = (kg: number, source: 'solo' | 'witnessed') =>
      ({ event_name: 'Deadlift', raw_score: kg, weight_kg: kg, difficulty_tier: null, source, bodyweightKg: 50 })
    const g = eventGrade(ev('Deadlift'), [lift(60, 'witnessed'), lift(40, 'solo')], junior)
    expect(g.rung).toBeGreaterThan(0)
    expect(g.source).toBe('witnessed')
  })
})

// ─── colourGate at its edges ─────────────────────────────────────────────────
// No games or training check on a domain since 26 September 2026: a domain
// confers whatever colour its standards give, when that is above the one held.

describe('colourGate edges', () => {
  it('confers Kiwikiwi on a first result, with no games needed', () => {
    expect(colourGate({ domainNumber: 1, standardsRung: 1, held: 0 }).releasable).toBe(1)
  })

  it('confers Taniwha from the standards alone', () => {
    expect(colourGate({ domainNumber: 3, standardsRung: TOP_RUNG, held: TOP_RUNG - 1 }).releasable).toBe(TOP_RUNG)
  })

  it('at the top, releases nothing', () => {
    expect(colourGate({ domainNumber: 3, standardsRung: TOP_RUNG, held: TOP_RUNG }).releasable).toBe(0)
  })

  it('does not release a colour when the standards today sit below one already held', () => {
    expect(colourGate({ domainNumber: 3, standardsRung: 3, held: 5 }).releasable).toBe(0)
  })
})

// ─── What kind of event this is ──────────────────────────────────────────────

describe('event kinds', () => {
  it('picks out exactly the seven events raced over a ladder of distances', () => {
    // The retired units sheet called these its 'distance' events; the natural
    // "distance + time" entry format is offered on them and nowhere else.
    expect(EVENTS.filter(isDistanceEvent).map(e => e.slug).sort()).toEqual(
      ['animal-crawl', 'burpee-broad-jump', 'cycling', 'row-erg', 'running', 'scooting', 'ski-erg'])
  })

  it('does not count a ladder of loads over one distance, or a ladder with an unreadable rung', () => {
    expect(isDistanceEvent(ev('Sandbag Carry'))).toBe(false)
    const cycling = ev('Cycling')
    expect(isDistanceEvent({ ...cycling, difficultyTiers: [{ name: 'Easy' }, { name: '1000m' }] } as EventData)).toBe(false)
    expect(isDistanceEvent({ ...cycling, difficultyTiers: [] } as EventData)).toBe(false)
  })

  it('reads metres out of rung names', () => {
    expect(metresIn('250m')).toBe(250)
    expect(metresIn('1.5km')).toBe(1500)
    expect(metresIn('5kg — 200m')).toBe(200)
    expect(metresIn('Easy')).toBeNull()
  })

  it('knows a Game rung from a drill', () => {
    expect(isGameTier(ev('Wrestling'), null)).toBe(true)
    expect(isGameTier(ev('Tennis'), 'Game')).toBe(true)
    expect(isGameTier(ev('Tennis'), ev('Tennis').difficultyTiers![0].name)).toBe(false)
    expect(isGameTier(ev('Tennis'), null)).toBe(false)
    expect(isGameTier(ev('Tennis'), 'No such rung')).toBe(false)
  })
})

// ─── Fitting and suggesting ──────────────────────────────────────────────────

describe('fitting and suggesting activities', () => {
  it('fits nothing to blank text', () => {
    expect(fitActivity('', new Map())).toBeNull()
    expect(fitActivity('   ', new Map())).toBeNull()
  })

  it('lets an alias win over an event name, and never falls through when the alias names a missing event', () => {
    expect(fitActivity('Deadlift', new Map([['deadlift', 'cycling']]))?.slug).toBe('cycling')
    expect(fitActivity('deadlift', new Map([['deadlift', 'ghost']]))).toBeNull()
  })

  it('lists each event once, however many aliases match it', () => {
    const aliases = new Map([['cycle', 'cycling'], ['cycling fast', 'cycling']])
    const slugs = suggestEvents('cyc', aliases).map(e => e.slug)
    expect(slugs.filter(s => s === 'cycling')).toHaveLength(1)
  })

  it('ranks exact over prefix over contains, then by slug', () => {
    expect(suggestEvents('jog', new Map([['jog', 'running']]))[0].slug).toBe('running')
    expect(suggestEvents('running', new Map())[0].slug).toBe('running')
    const sprints = suggestEvents('sprint', new Map()).map(e => e.slug)
    expect(sprints.indexOf('100m-sprint')).toBeLessThan(sprints.indexOf('200m-sprint'))
  })

  it('respects the limit and drops aliases that name no event', () => {
    expect(suggestEvents('in', new Map(), 3)).toHaveLength(3)
    expect(suggestEvents('zzq', new Map([['zzq', 'ghost']]))).toEqual([])
  })
})

// ─── Logged entries into grading ─────────────────────────────────────────────

describe('logged entries into grading, as PostgREST returns them', () => {
  const workout = { player_id: 'p', performed_on: '2026-09-16', witnessed: false, created_at: '2026-09-16T01:00:00Z' }
  const entry = (e: Partial<WorkoutEntryRow>): WorkoutEntryRow => ({
    event_slug: 'cycling', count: null, volume_distance_m: null, raw_score: null, weight_kg: null, difficulty_tier: null, workouts: workout, ...e,
  })

  it('reads numeric columns that arrive as strings', () => {
    const { rows } = workoutEvidence([entry({
      raw_score: '29900' as unknown as number, volume_distance_m: '5000' as unknown as number, difficulty_tier: '1000m',
    })])
    expect(rows[0].raw_score).toBe(29900)
    const lift = workoutEvidence([entry({ event_slug: 'deadlift', raw_score: '100' as unknown as number, weight_kg: '100' as unknown as number, count: 3 })])
    expect(lift.rows[0].weight_kg).toBe(100)
  })

  it('skips an entry whose workout it cannot read', () => {
    expect(workoutEvidence([entry({ workouts: null, raw_score: 29900, volume_distance_m: 5000 })])).toEqual({ rows: [] })
  })

  it('never grades a score on an entry that is not fitted to an event', () => {
    expect(workoutEvidence([entry({ event_slug: null, raw_score: 100 })]).rows).toEqual([])
  })
})

describe('NZ days', () => {
  const now = new Date('2026-09-16T01:00:00Z') // 1pm 16 September NZ

  it('reads the NZ day across midnight, standard and daylight time', () => {
    expect(nzDay('2026-09-15T11:59:00Z')).toBe('2026-09-15') // 11:59pm NZST
    expect(nzDay('2026-09-15T12:00:00Z')).toBe('2026-09-16')
    expect(nzDay('2026-12-31T11:30:00Z')).toBe('2027-01-01') // 12:30am NZDT
  })

  it('does calendar arithmetic across a leap day and a year end', () => {
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  })

  it('offers distinct days, newest first, as far back as the database allows', () => {
    const d = allowedDays(now)
    expect(d).toHaveLength(BACKDATE_DAYS + 1)
    expect(new Set(d).size).toBe(d.length)
    expect([...d].sort().reverse()).toEqual(d)
  })
})

// ─── Migration properties the schema test does not pin ───────────────────────

describe('the workout logging migration, beyond the schema test', () => {
  const dir = 'supabase/migrations'
  const file = readdirSync(dir).find(n => n.endsWith('_workout_logging.sql'))!
  const sql = readFileSync(`${dir}/${file}`, 'utf8').split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
  const fnBody = (name: string) => {
    const start = sql.indexOf(`FUNCTION public.${name}`)
    return sql.slice(start, sql.indexOf('$$;', start))
  }

  it('pins every SECURITY DEFINER function to the public search_path', () => {
    for (const name of ['can_log_for', 'guard_workouts_write', 'guard_workout_entries_write', 'fit_activity', 'delete_my_account']) {
      const body = fnBody(name)
      expect(body, name).toContain('SECURITY DEFINER')
      expect(body, name).toContain('SET search_path = public')
    }
  })

  it('keeps the callable functions away from anon', () => {
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.can_log_for(uuid) FROM PUBLIC, anon;')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.fit_activity(text, text) FROM PUBLIC, anon;')
    expect(sql).toContain('REVOKE ALL ON FUNCTION public.delete_my_account(UUID) FROM PUBLIC, anon;')
  })

  it('refuses a signed-out caller in the logging rule', () => {
    expect(fnBody('can_log_for')).toContain('auth.uid() IS NOT NULL')
  })

  it('stops an entry being moved onto another workout, and checks its event against the roster', () => {
    const g = fnBody('guard_workout_entries_write')
    expect(g).toContain('NEW.workout_id := OLD.workout_id')
    expect(g).toContain('NEW.id         := OLD.id')
    expect(g).toContain('FROM event_domains WHERE slug = NEW.event_slug')
  })

  it('reaches entries only through a workout the caller may log for', () => {
    expect(sql).toMatch(/workout_entries_by_logger ON public\.workout_entries FOR ALL\s+USING \(EXISTS \(SELECT 1 FROM workouts w WHERE w\.id = workout_entries\.workout_id AND public\.can_log_for\(w\.player_id\)\)\)\s+WITH CHECK \(EXISTS/)
  })

  it('re-fits only entries still unfitted, and checks the event first', () => {
    const f = fnBody('fit_activity')
    expect(f).toContain('WHERE event_slug IS NULL')
    expect(f.indexOf('FROM event_domains WHERE slug = p_event_slug')).toBeLessThan(f.indexOf('INSERT INTO activity_aliases'))
  })

  it('never lets a score sit on an entry with no event', () => {
    expect(sql).toContain('CHECK (raw_score IS NULL OR event_slug IS NOT NULL)')
  })
})
