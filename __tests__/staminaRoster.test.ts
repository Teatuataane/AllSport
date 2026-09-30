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

  // The PRE-change ladders, frozen here rather than read from git: a test that
  // reads HEAD sees the new ladders once this merges and checks nothing.
  const OLD: Record<string, string[]> = {
    'l-sit-hold': ['2 Feet Assisted Tuck', '1 Foot Assisted Tuck', 'Tuck Hold', '1 Leg L-Sit', 'L-Sit', 'V-Sit'],
    'push-up-contest': ['Elevated Knee Push Up', 'Knee Push Up', 'Push Up', '1 Arm Pushup', 'Handstand Pushup', 'Deficit Handstand'],
  }

  it('maps each old level onto a level that exists, in the same order', () => {
    const map = [...section('INSERT INTO level_map VALUES', ';')
      .matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)/g)]
      .map(m => ({ slug: m[1], name: m[2], oldTier: m[3], oldIdx: +m[5], newTier: m[4], newIdx: +m[6] }))
    expect(map).toHaveLength(7)
    for (const m of map) {
      const ev = getEventBySlug(m.slug)!
      expect(m.name, m.slug).toBe(ev.name)
      expect(ev.difficultyTiers![m.newIdx]?.name, `${m.slug} ${m.newTier}`).toBe(m.newTier)
      // A typo on the OLD side would send real rows to the archive instead.
      expect(OLD[m.slug][m.oldIdx], `${m.slug} old ${m.oldIdx}`).toBe(m.oldTier)
    }
    // A shift must keep every player's order, or placements would change.
    for (const slug of new Set(map.map(m => m.slug))) {
      const rows = map.filter(m => m.slug === slug).sort((a, b) => a.oldIdx - b.oldIdx)
      expect(rows.map(r => r.newIdx), slug).toEqual([...rows.map(r => r.newIdx)].sort((a, b) => a - b))
    }
  })

  it('repoints every renamed event, name and slug, onto what the app knows', () => {
    const repoints = [...sql.matchAll(/UPDATE session_events SET event_name = '([^']+)', event_slug = '([^']+)'\s+WHERE event_name = '[^']+' OR event_slug = '([^']+)'/g)]
    expect(repoints.map(m => m[2]).sort()).toEqual(['l-sit-hold', 'push-up-contest', 'reverse-wrist-stretch', 'wrist-stretch'])
    for (const [, name, slug, whereSlug] of repoints) {
      expect(whereSlug).toBe(slug)
      expect(getEventBySlug(slug)?.name, slug).toBe(name)
      expect(getEventByName(name)?.slug).toBe(slug)
    }
    expect(sql).toMatch(/SET domain_name = 'Stamina'\s+WHERE domain_name = 'Anaerobic Endurance' AND domain_number = 5/)
  })

  it('locks every table it creates away from the API', () => {
    const tables = [...sql.matchAll(/CREATE TABLE public\.(\w+) AS/g)].map(m => m[1])
    expect(tables).toHaveLength(5)
    for (const t of tables) {
      expect(sql, t).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
      expect(sql, t).toContain(`REVOKE ALL ON public.${t} FROM anon, authenticated;`)
    }
  })

  it('guards exactly the new ladders, created after the repair', () => {
    const fn = section('CREATE OR REPLACE FUNCTION public.enforce_relevelled_ladders()', '$$;')
    const guarded = [...fn.matchAll(/\('([a-z-]+)', '([^']+)', (\d+)\)/g)].map(m => `${m[1]}|${m[2]}|${m[3]}`).sort()
    expect(guarded).toEqual(newLevels.map(l => `${l.slug}|${l.tier}|${l.idx}`).sort())
    expect(sql.indexOf('CREATE TRIGGER trg_zz_relevelled_ladders_results'))
      .toBeGreaterThan(sql.indexOf('PERFORM public.compute_event_placements'))
    expect(fn).toMatch(/TG_OP = 'INSERT' AND v_slug IN \('lunges', 'ab-wheel-rollout', 'shoulder-dislocate'\)/)
  })
})
