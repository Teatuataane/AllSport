// 20260930011149 re-levels five events and repoints four names. Its level
// lists are typed into SQL, so pin them to lib/eventData.ts: a ladder that
// drifts from the migration would leave the invariant at the end of the file
// asserting against levels the app no longer offers.
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { getEventBySlug, getEventByName } from '@/lib/eventData'

const sql = readFileSync('supabase/migrations/20260930011149_stamina_roster.sql', 'utf8')
const section = (from: string, to: string) => sql.slice(sql.indexOf(from), sql.indexOf(to, sql.indexOf(from)))

describe('stamina roster migration', () => {
  const newLevels = [...section('INSERT INTO new_levels VALUES', ';')
    .matchAll(/\('([^']+)', '([^']+)', '([^']+)', (\d+)\)/g)]
    .map(m => ({ slug: m[1], name: m[2], tier: m[3], idx: +m[4] }))

  it('lists every level of the five re-levelled ladders, exactly', () => {
    const slugs = [...new Set(newLevels.map(l => l.slug))].sort()
    expect(slugs).toEqual(['calf-raises', 'l-sit-hold', 'push-up-contest', 'reverse-wrist-stretch', 'wrist-stretch'])
    for (const slug of slugs) {
      const ev = getEventBySlug(slug)!
      const rows = newLevels.filter(l => l.slug === slug)
      expect(rows.every(r => r.name === ev.name), slug).toBe(true)
      expect(rows.map(r => r.tier), slug).toEqual(ev.difficultyTiers!.map(t => t.name))
      expect(rows.map(r => r.idx), slug).toEqual(ev.difficultyTiers!.map((_, i) => i))
    }
  })

  it('maps each old level onto a level that exists, in the same order', () => {
    const map = [...section('INSERT INTO level_map VALUES', ';')
      .matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)/g)]
      .map(m => ({ slug: m[1], oldIdx: +m[5], newTier: m[4], newIdx: +m[6] }))
    expect(map).toHaveLength(7)
    for (const m of map) {
      const tiers = getEventBySlug(m.slug)!.difficultyTiers!
      expect(tiers[m.newIdx]?.name, `${m.slug} ${m.newTier}`).toBe(m.newTier)
    }
    // A shift must keep every player's order, or placements would change.
    for (const slug of new Set(map.map(m => m.slug))) {
      const rows = map.filter(m => m.slug === slug).sort((a, b) => a.oldIdx - b.oldIdx)
      expect(rows.map(r => r.newIdx), slug).toEqual([...rows.map(r => r.newIdx)].sort((a, b) => a - b))
    }
  })

  it('repoints every renamed event onto a name the app knows', () => {
    for (const [slug, name] of [...sql.matchAll(/UPDATE session_events SET event_name = '([^']+)'\s+WHERE event_name = '[^']+' OR event_slug = '([^']+)'/g)]
      .map(m => [m[2], m[1]])) {
      expect(getEventBySlug(slug)?.name, slug).toBe(name)
      expect(getEventByName(name)?.slug).toBe(slug)
    }
    expect(sql).toMatch(/SET domain_name = 'Stamina'\s+WHERE domain_name = 'Anaerobic Endurance' AND domain_number = 5/)
  })
})
