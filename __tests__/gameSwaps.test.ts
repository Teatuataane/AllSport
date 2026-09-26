import { describe, it, expect } from 'vitest'
import { EVENTS } from '@/lib/eventData'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  playList, domainGroups, addChoices, removeChoice, domainChoices, domainsCovered, type OfficialEvent,
} from '@/lib/gameSwaps'
import { getEventBySlug } from '@/lib/eventData'

const official = (slug: string, id = slug): OfficialEvent => {
  const e = getEventBySlug(slug)!
  return {
    id, domain_number: e.domainNumber, domain_name: e.domain,
    event_name: e.name, event_slug: e.slug, input_mode: e.inputMode,
  }
}

const ten: OfficialEvent[] = [official('deadlift'), official('flag'), official('tennis')]

describe('the play list', () => {
  it('is the official events when nothing has been added', () => {
    const list = playList(ten, [])
    expect(list).toHaveLength(3)
    expect(list.every(s => s.kind === 'official')).toBe(true)
  })

  it('puts an added event under its own domain, whatever order it was picked in', () => {
    const list = playList(ten, ['badminton', 'pause-bench'])
    expect(list.map(s => s.se.event_slug)).toEqual(['deadlift', 'pause-bench', 'flag', 'tennis', 'badminton'])
    expect(list.map(s => s.kind)).toEqual(['official', 'added', 'official', 'official', 'added'])
  })

  it('keeps several added in one domain in the order picked', () => {
    const list = playList(ten, ['pause-row', 'pause-bench'])
    expect(list.map(s => s.se.event_slug)).toEqual(['deadlift', 'pause-row', 'pause-bench', 'flag', 'tennis'])
  })

  it('drops a choice that IS the official event, so one score cannot go in two places', () => {
    expect(playList(ten, ['deadlift'])).toHaveLength(3)
  })

  it('gives a domain the game has no event for a group of its own', () => {
    const groups = domainGroups([official('deadlift')], ['tennis'])
    expect(groups).toHaveLength(2)
    expect(groups[1].official).toBeNull()
    expect(groups[1].added.map(s => s.se.event_slug)).toEqual(['tennis'])
  })

  it('ignores a slug the roster no longer has', () => {
    expect(playList(ten, ['leg-extension-retired'])).toHaveLength(3)
  })
})

describe('choosing', () => {
  it('offers the rest of the domain, minus what is already in play', () => {
    const choices = domainChoices(1, ['deadlift'])
    // Domain 1 holds 14 events since Sept 2026, so this is the whole domain
    // minus the one already in play. Derived, not a literal, because the pool
    // is now expected to keep growing.
    expect(choices).toHaveLength(EVENTS.filter(e => e.domainNumber === 1).length - 1)
    expect(choices.some(e => e.slug === 'deadlift')).toBe(false)
  })

  it('adds several at once, each once, in the order picked', () => {
    expect(addChoices(['pause-bench'], ['pause-row', 'pause-bench', 'arthur-lift']))
      .toEqual(['pause-bench', 'pause-row', 'arthur-lift'])
  })

  it('will not remove an added event that has already been scored', () => {
    expect(removeChoice(['pause-bench'], 'pause-bench', new Set())).toEqual([])
    expect(removeChoice(['pause-bench'], 'pause-bench', new Set(['pause-bench']))).toEqual(['pause-bench'])
  })
})

describe('progress', () => {
  it('counts a domain covered by an added event, because it is the player’s workout', () => {
    const covered = domainsCovered(ten, new Set(['tennis']), new Set(['pause-bench']))
    // Coordination from the official Tennis, Maximal Strength from the swap.
    expect([...covered].sort((a, b) => a - b)).toEqual([1, 9])
  })
})

describe('the migration', () => {
  const sql = readFileSync(join(process.cwd(), 'supabase/migrations/20260920042215_game_swaps.sql'), 'utf8')

  it('allows only one swap workout per player per game', () => {
    expect(sql).toMatch(/CREATE UNIQUE INDEX IF NOT EXISTS workouts_one_per_game/)
  })

  it('adds session_id and pins it on update', () => {
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public\.sessions/)
    expect(sql).toContain('NEW.session_id := OLD.session_id')
  })

  it('confines a game-linked write to an open game, in BOTH guards', () => {
    const workouts = sql.slice(sql.indexOf('guard_workouts_write'), sql.indexOf('guard_workout_entries_write'))
    const entries = sql.slice(sql.indexOf('CREATE OR REPLACE FUNCTION public.guard_workout_entries_write'))
    expect(workouts).toContain('that game has finished')
    expect(entries).toContain('that game has finished')
  })

  it('keeps every rule both guards already had', () => {
    for (const rule of [
      'a witnessed workout can only be changed by a kaiwhakawā',
      'is not an event on the roster',
      'more than 7 days old',
      'a game result is recorded at an official game, not logged',
      'NEW.created_at := now()',
      'v_fitting_only',
    ]) expect(sql).toContain(rule)
  })
})
