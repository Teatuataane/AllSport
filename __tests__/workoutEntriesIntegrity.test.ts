import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { EVENTS } from '@/lib/eventData'

// 20260916211643 makes the database refuse scores no workout can have, and
// recognises Game rungs by NAME because it does not hold the ladders. These
// tests pin both: the migration against the previous guard, and the naming
// rule against lib/eventData.ts, so a renamed rung fails here, not in prod.

const dir = 'supabase/migrations'
const read = (suffix: string) => {
  const f = readdirSync(dir).find(n => n.endsWith(suffix))
  if (!f) throw new Error(`no migration ending ${suffix}`)
  return readFileSync(`${dir}/${f}`, 'utf8')
}
const strip = (s: string) => s.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
const fnBody = (src: string, name: string) => {
  const start = src.indexOf(`FUNCTION public.${name}`)
  return src.slice(start, src.indexOf('$$;', start))
}
const squash = (s: string) => s.replace(/\s+/g, ' ').trim()
const sql = strip(read('_workout_entries_integrity.sql'))

describe('workout entries refuse scores no workout can have', () => {
  it('requires every score column to be finite, and the measured ones plausible', () => {
    expect(sql).toContain("raw_score IS NULL OR (raw_score > '-Infinity'::numeric AND raw_score < 'Infinity'::numeric)")
    expect(sql).toContain('weight_kg IS NULL OR (weight_kg >= 0 AND weight_kg <= 1000)')
    expect(sql).toContain('time_seconds IS NULL OR (time_seconds >= 0 AND time_seconds <= 86400)')
    expect(sql).toContain('distance_m IS NULL OR (distance_m >= 0 AND distance_m <= 100000)')
  })

  it('redefines the entries guard as the previous definition plus the Game-rung rule, and nothing else', () => {
    const prev = fnBody(strip(read('_workout_logging.sql')), 'guard_workout_entries_write')
    const next = fnBody(sql, 'guard_workout_entries_write')
    const added = next.match(/ {2}IF NEW\.raw_score IS NOT NULL\s+AND \(NEW\.difficulty_tier ILIKE 'Game%'[\s\S]*?END IF;\n/)
    expect(added, 'the Game-rung block is missing').not.toBeNull()
    expect(squash(next.replace(added![0], ''))).toBe(squash(prev))
  })
})

describe('the database recognises a Game rung by its name', () => {
  const tiers = EVENTS.flatMap(e => (e.difficultyTiers ?? []).map(t => ({ event: e.slug, ...t })))

  it('names every Game rung starting with "Game"', () => {
    const misnamed = tiers.filter(t => t.scoring === 'sport' && !/^game/i.test(t.name))
    expect(misnamed.map(t => `${t.event}: ${t.name}`)).toEqual([])
  })

  it('never starts a drill rung with "Game", or the trigger would refuse a real drill', () => {
    const collisions = tiers.filter(t => t.scoring !== 'sport' && /^game/i.test(t.name))
    expect(collisions.map(t => `${t.event}: ${t.name}`)).toEqual([])
  })

  it('lists exactly the pure contests, which have no rungs to name', () => {
    const listed = [...sql.match(/NEW\.event_slug IN \(([^)]*)\)/)![1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort()
    expect(listed).toEqual(EVENTS.filter(e => e.inputMode === 'sport').map(e => e.slug).sort())
  })
})
