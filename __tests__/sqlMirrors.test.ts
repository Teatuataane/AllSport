import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { EVENTS } from '@/lib/eventData'
import { WIN_MIN_FIELD } from '@/lib/rating'

// SQL that duplicates something TypeScript owns, pinned so the two cannot
// drift. These lived in __tests__/taniwha.test.ts and moved here when the
// taniwha retired: the roster mirror and the placement ranking both outlive it.
// Duplication is how this codebase once ended up with six disagreeing copies
// of the colour ladder, so if a test here goes red the migration is what needs
// updating, not the test.

const dir = 'supabase/migrations'

/** The newest migration whose text matches — CREATE OR REPLACE means it wins. */
function newest(pattern: RegExp, what: string): string {
  const f = readdirSync(dir).sort().reverse().find(n => pattern.test(readFileSync(`${dir}/${n}`, 'utf8')))
  if (!f) throw new Error(`${what} migration not found`)
  return readFileSync(`${dir}/${f}`, 'utf8')
}

// The roster mirror is re-seeded IN FULL by every migration that changes the
// roster, so the newest file carrying the seed is the current definition.
const rosterSql = newest(/INSERT INTO event_domains/i, 'event_domains seed')

describe('event_domains mirrors lib/eventData.ts', () => {
  const seeded = [...rosterSql.matchAll(/^ {2}\('(.+?)', (\d+), '(.+?)'\)/gm)]
    .map(m => ({ name: m[1], domainNumber: Number(m[2]), slug: m[3] }))

  it('seeds every event, and only real events', () => {
    expect(seeded).toHaveLength(EVENTS.length)
    expect(seeded).toHaveLength(128)
    expect(new Set(seeded.map(s => s.name)).size).toBe(seeded.length)
  })

  it('agrees with the roster on every event\'s domain and slug', () => {
    const byName = new Map(EVENTS.map(e => [e.name, e]))
    for (const s of seeded) {
      const e = byName.get(s.name)
      expect(e, `event_domains has "${s.name}", which is not in eventData`).toBeDefined()
      expect(e!.domainNumber, `domain for ${s.name}`).toBe(s.domainNumber)
      expect(e!.slug, `slug for ${s.name}`).toBe(s.slug)
    }
  })

  it('contains no apostrophes, which the seed does not escape', () => {
    for (const e of EVENTS) expect(e.name).not.toContain("'")
  })
})

const placementsSql = newest(/FUNCTION public\.compute_event_placements/i, 'compute_event_placements')

describe('compute_event_placements ranks players, not rows', () => {
  const body = placementsSql.slice(placementsSql.indexOf('FUNCTION public.compute_event_placements'))

  // The original definition ran RANK() straight over every result ROW, so a
  // player who scored an event three times sat in the field three times. That
  // inflated event_field_size — the number WIN_MIN_FIELD reads — and counted
  // one win up to three times through player_event_wins' COUNT(*).
  it('reduces to one row per player per event before ranking', () => {
    expect(body).toMatch(/DISTINCT ON \(event_id, player_id\)/)
  })

  it('picks the best submission, deterministically', () => {
    expect(body).toMatch(/ORDER BY event_id, player_id, raw_score DESC, id/)
  })

  it('ranks and sizes the field over the DEDUPED set, not the raw rows', () => {
    const ranked = body.slice(body.indexOf('ranked AS'), body.indexOf('UPDATE results r'))
    expect(ranked).toContain('FROM best')
    expect(ranked).toMatch(/COUNT\(\*\)\s+OVER \(PARTITION BY event_id, pool\)/)
  })

  it('uses the same field threshold /prs quotes', () => {
    expect(WIN_MIN_FIELD).toBe(3)
  })
})
