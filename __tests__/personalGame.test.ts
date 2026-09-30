import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  historyWorkouts, mergeHistory,
  drawPlan, planFromEventNames, togglePlanned, sortPlan, planEvents,
  entryPayload, isPersonalGame, isOpen, PLAN_MAX,
} from '@/lib/personalGame'
import { getEventBySlug, EVENTS } from '@/lib/eventData'
import { EMPTY_VALS, type EntryVals } from '@/lib/scoring'

const ev = (slug: string) => {
  const e = getEventBySlug(slug)
  if (!e) throw new Error(`no event ${slug}`)
  return e
}
const vals = (p: Partial<EntryVals>): EntryVals => ({ ...EMPTY_VALS, ...p })

describe('a plan', () => {
  it('draws one event from every domain', () => {
    const plan = drawPlan(() => 0)
    expect(plan).toHaveLength(10)
    expect(new Set(planEvents(plan).map(e => e.domainNumber)).size).toBe(10)
  })

  it('copies an official ten by name, dropping events no longer on the roster', () => {
    expect(planFromEventNames(['Deadlift', 'Leg Extension', 'Tennis'])).toEqual(['deadlift', 'tennis'])
  })

  it('toggles, keeps play order, and stops at the cap', () => {
    expect(togglePlanned(['deadlift'], 'tennis')).toEqual(['deadlift', 'tennis'])
    expect(togglePlanned(['deadlift', 'tennis'], 'deadlift')).toEqual(['tennis'])
    const full = EVENTS.slice(0, PLAN_MAX).map(e => e.slug)
    expect(togglePlanned(full, EVENTS[PLAN_MAX].slug)).toHaveLength(PLAN_MAX)
  })

  it('sorts into roster order', () => {
    const plan = sortPlan(['tennis', 'deadlift'])
    expect(planEvents(plan)[0].domainNumber).toBeLessThan(planEvents(plan)[1].domainNumber)
  })
})

describe('one submission', () => {
  it('stores the score for a set event', () => {
    const p = entryPayload(ev('deadlift'), vals({ weightKg: '100', repCount: '3' }))
    expect(p).toMatchObject({ event_slug: 'deadlift', weight_kg: 100 })
    expect(p).not.toHaveProperty('count')
    expect(p).not.toHaveProperty('volume_distance_m')
    // Ranks on the estimated 1RM: 100kg × 3 is 105.9kg (Brzycki).
    expect(p!.raw_score).toBe(105.9)
  })

  it('returns null when the score is not complete', () => {
    expect(entryPayload(ev('deadlift'), vals({}))).toBeNull()
  })

  it('never stores a score on a Game rung — the database refuses one', () => {
    const gameEvent = EVENTS.find(e => (e.difficultyTiers ?? []).some(t => t.scoring === 'sport'))!
    const rung = gameEvent.difficultyTiers!.find(t => t.scoring === 'sport')!
    const p = entryPayload(gameEvent, vals({ difficultyTier: rung.name, sportResult: 'win' }))!
    expect(p.raw_score).toBeUndefined()
    expect(p.event_slug).toBe(gameEvent.slug)
  })
})

describe('lifecycle', () => {
  const now = new Date('2026-09-20T09:00:00+12:00')
  const day = '2026-09-20'

  it('a workout is a personal game only when it carries a plan', () => {
    expect(isPersonalGame({ planned_events: [] })).toBe(false)
    expect(isPersonalGame({ planned_events: null })).toBe(false)
    expect(isPersonalGame({ planned_events: ['deadlift'] })).toBe(true)
  })

  it('is open until Finish, and the NZ day closes it', () => {
    expect(isOpen({ planned_events: [], performed_on: day, finished_at: null }, now)).toBe(true)
    expect(isOpen({ planned_events: [], performed_on: day, finished_at: '2026-09-20T10:00:00Z' }, now)).toBe(false)
    expect(isOpen({ planned_events: [], performed_on: '2026-09-19', finished_at: null }, now)).toBe(false)
  })
})

describe('the migration', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260920040735_personal_games.sql'), 'utf8')

  it('adds both columns and caps the plan at the same size the code does', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS planned_events/)
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS finished_at/)
    expect(sql).toContain(`cardinality(planned_events) <= ${PLAN_MAX}`)
  })

  it('checks every planned slug against the roster', () => {
    expect(sql).toMatch(/event_domains WHERE slug = s/)
  })

  it('keeps every rule the workout guard already had', () => {
    // Redefining a guard WHOLE is how a rule goes missing silently. These are
    // the four lines 20260915214702 relies on.
    for (const rule of [
      'a witnessed workout can only be changed by a kaiwhakawā',
      'NEW.created_at := now()',
      'NEW.logged_by  := COALESCE(auth.uid(), NEW.logged_by)',
      'NEW.player_id  := OLD.player_id',
    ]) expect(sql).toContain(rule)
  })
})

// Play history lists games and solo workouts as one list (30 Sept 2026).
// Value: protects=which workouts get a history row and in what order; fails_when=game swaps get their own row, an abandoned empty workout shows, or order breaks; why_new=the page had no test; seam=none
describe('play history rows', () => {
  const now = new Date('2026-09-30T02:00:00Z') // 30 Sept, afternoon in NZ
  const w = (over: Partial<{ id: string; performed_on: string; finished_at: string | null; planned_events: string[] | null; session_id: string | null; workout_entries: unknown[] }>) => ({
    id: 'w', performed_on: '2026-09-30', finished_at: null, planned_events: ['deadlift'],
    session_id: null, workout_entries: [{}], ...over,
  })

  it('keeps a workout with scores, and an open one with none yet', () => {
    const rows = historyWorkouts([
      w({ id: 'scored', finished_at: '2026-09-30T01:00:00Z' }),
      w({ id: 'open-empty', workout_entries: [] }),
    ], now)
    expect(rows.map(r => r.id)).toEqual(['scored', 'open-empty'])
  })

  it('leaves out a game’s swaps and an abandoned empty workout', () => {
    const rows = historyWorkouts([
      w({ id: 'swaps', session_id: 's1' }),
      w({ id: 'stale-empty', performed_on: '2026-09-20', workout_entries: [] }),
      w({ id: 'finished-empty', finished_at: '2026-09-30T01:00:00Z', workout_entries: [] }),
    ], now)
    expect(rows).toEqual([])
  })

  it('merges newest first, a game above a workout on the same day', () => {
    const merged = mergeHistory(
      [{ date: '2026-09-28', item: 'g1' }, { date: '2026-09-30', item: 'g2' }],
      [{ date: '2026-09-30', item: 'w1' }, { date: '2026-09-29', item: 'w2' }],
    )
    expect(merged.map(m => `${m.kind}:${m.item}`)).toEqual(['game:g2', 'workout:w1', 'workout:w2', 'game:g1'])
  })
})
