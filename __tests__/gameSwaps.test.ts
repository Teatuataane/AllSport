import { describe, it, expect } from 'vitest'
import { EVENTS } from '@/lib/eventData'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  playList, addChoice, removeChoice, swapChoices, domainsCovered, type OfficialEvent,
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
  it('is the official events when nothing has been swapped', () => {
    const list = playList(ten, [])
    expect(list).toHaveLength(3)
    expect(list.every(s => s.kind === 'official')).toBe(true)
  })

  it('puts a swap under the event it stands in for', () => {
    const list = playList(ten, ['pause-bench'])
    expect(list.map(s => s.kind)).toEqual(['official', 'swap', 'official', 'official'])
    expect(list[1].se.event_name).toBe('Pause Bench')
    expect(list[1].replaces?.event_name).toBe('Deadlift')
  })

  it('calls the second event in a domain an extra, not a second swap', () => {
    const list = playList(ten, ['pause-bench', 'pause-row'])
    expect(list.map(s => s.kind)).toEqual(['official', 'swap', 'extra', 'official', 'official'])
    expect(list[2].replaces).toBeUndefined()
  })

  it('drops a choice that IS the official event, so one score cannot go in two places', () => {
    expect(playList(ten, ['deadlift'])).toHaveLength(3)
  })

  it('keeps an extra from a domain the game has no event for', () => {
    const list = playList([official('deadlift')], ['tennis'])
    expect(list.map(s => s.kind)).toEqual(['official', 'extra'])
  })

  it('ignores a slug the roster no longer has', () => {
    expect(playList(ten, ['leg-extension-retired'])).toHaveLength(3)
  })
})

describe('choosing', () => {
  it('offers the rest of the domain, minus what is already in play', () => {
    const choices = swapChoices(1, ['deadlift'])
    // Domain 1 holds 14 events since Sept 2026, so this is the whole domain
    // minus the one already in play. Derived, not a literal, because the pool
    // is now expected to keep growing.
    expect(choices).toHaveLength(EVENTS.filter(e => e.domainNumber === 1).length - 1)
    expect(choices.some(e => e.slug === 'deadlift')).toBe(false)
  })

  it('adds once, in the order picked', () => {
    expect(addChoice(['pause-bench'], 'pause-row')).toEqual(['pause-bench', 'pause-row'])
    expect(addChoice(['pause-bench'], 'pause-bench')).toEqual(['pause-bench'])
  })

  it('will not remove a swap that has already been scored', () => {
    expect(removeChoice(['pause-bench'], 'pause-bench', new Set())).toEqual([])
    expect(removeChoice(['pause-bench'], 'pause-bench', new Set(['pause-bench']))).toEqual(['pause-bench'])
  })
})

describe('progress', () => {
  it('counts a swapped domain as covered, because it is the player’s workout', () => {
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
