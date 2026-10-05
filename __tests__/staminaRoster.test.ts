// 20260930011149 re-levels five events and repoints four names. Its level
// lists are typed into SQL, so pin them to lib/eventData.ts: a ladder that
// drifts from the migration would leave the invariant at the end of the file
// asserting against levels the app no longer offers.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { getEventBySlug, getEventByName } from '@/lib/eventData'

const sql = readFileSync('supabase/migrations/20260930011149_stamina_roster.sql', 'utf8')
const section = (from: string, to: string) => sql.slice(sql.indexOf(from), sql.indexOf(to, sql.indexOf(from)))

// This migration is applied and frozen, so it names events as they were on
// 30 Sept 2026. A later rename (slug kept) is mapped onto today's name here.
const RENAMED_LATER: Record<string, string> = { Compression: 'L-Sit' } // 20261005032653
const today = (name: string) => RENAMED_LATER[name] ?? name

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
      expect(rows.every(r => today(r.name) === ev.name), slug).toBe(true)
      expect(rows.map(r => r.tier), slug).toEqual(ev.difficultyTiers!.map(t => t.name))
      expect(rows.map(r => r.idx), slug).toEqual(ev.difficultyTiers!.map((_, i) => i))
    }
  })

  // The PRE-change ladders, frozen here rather than read from git: a test that
  // reads HEAD sees the new ladders once this merges and checks nothing.
  const OLD: Record<string, string[]> = {
    'l-sit-hold': ['2 Feet Assisted Tuck', '1 Foot Assisted Tuck', 'Tuck Hold', '1 Leg L-Sit', 'L-Sit', 'V-Sit'],
    'push-up-contest': ['Elevated Knee Push Up', 'Knee Push Up', 'Push Up', '1 Arm Pushup', 'Handstand Pushup', 'Deficit Handstand'],
    'calf-raises': ['Two-Leg Raise', 'Two-Leg Deficit', 'Single-Leg Raise', 'Single-Leg Deficit'],
  }

  it('maps each old level onto a level that exists, in the same order', () => {
    const map = [...section('INSERT INTO level_map VALUES', ';')
      .matchAll(/\('([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*(\d+),\s*(\d+)\)/g)]
      .map(m => ({ slug: m[1], name: m[2], oldTier: m[3], oldIdx: +m[5], newTier: m[4], newIdx: +m[6] }))
    expect(map).toHaveLength(9)
    for (const m of map) {
      const ev = getEventBySlug(m.slug)!
      expect(today(m.name), m.slug).toBe(ev.name)
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
      expect(getEventBySlug(slug)?.name, slug).toBe(today(name))
      expect(getEventByName(today(name))?.slug).toBe(slug)
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

  // The guard is redefined by whichever LATER migration changes one of these
  // ladders, so its pins read the newest definition, never this frozen file.
  const guardSql = (() => {
    const dir = 'supabase/migrations'
    const f = readdirSync(dir).sort().reverse()
      .find(n => readFileSync(`${dir}/${n}`, 'utf8').includes('FUNCTION public.enforce_relevelled_ladders()'))!
    const all = readFileSync(`${dir}/${f}`, 'utf8')
    const from = all.indexOf('CREATE OR REPLACE FUNCTION public.enforce_relevelled_ladders()')
    return all.slice(from, all.indexOf('$$;', from))
  })()

  // 20261005012108 redefined the guard to cover every ladder it changed too.
  it('guards exactly the current ladders of every re-levelled event', () => {
    const guarded = [...guardSql.matchAll(/\('([a-z0-9-]+)', '((?:[^']|'')+)', (\d+)\)/g)]
      .map(m => ({ slug: m[1], tier: m[2].replace(/''/g, "'"), idx: +m[3] }))
    const slugs = [...new Set(guarded.map(g => g.slug))].sort()
    // Stated, not derived: dropping an event from both lists must still fail.
    expect(slugs).toEqual([
      'american-football', 'animal-crawl', 'baseball', 'breakdancing', 'calf-raises', 'cricket', 'darts',
      'disc-golf', 'finger-push-up', 'foot-juggling', 'golf', 'gymnastics', 'iron-cross', 'jump-rope',
      'l-sit-hold', 'middle-split', 'netball', 'pancake', 'push-up-contest', 'reverse-wrist-stretch',
      'rope-climb', 'skate', 'slackline', 'table-tennis', 'tennis', 'teqball', 'touch-rugby', 'trampolining',
      'volleyball', 'wrist-stretch',
    ])
    for (const slug of slugs) {
      const ev = getEventBySlug(slug)!
      const rows = guarded.filter(g => g.slug === slug)
      expect(rows.map(r => r.tier), slug).toEqual(ev.difficultyTiers!.map(t => t.name))
      expect(rows.map(r => r.idx), slug).toEqual(ev.difficultyTiers!.map((_, i) => i))
    }
    // The gate lists exactly the guarded slugs: one missing is an unguarded event.
    const gate = guardSql.match(/IF v_slug IN \(([^)]*)\)\s+AND NEW\.raw_score IS NOT NULL\s+AND NOT EXISTS/)
    expect(gate, 'gate list').toBeTruthy()
    expect([...gate![1].matchAll(/'([^']+)'/g)].map(m => m[1]).sort()).toEqual(slugs)
    // The band check is the whole point: without it an old 'Push Up' in its old band passes.
    expect(guardSql).toContain('floor(NEW.raw_score / 10000) = lv.idx')
  })

  it('names every event it resolves by name correctly', () => {
    const REMOVED: Record<string, string> = { Lunges: 'lunges', 'Ab Rollout': 'ab-wheel-rollout', 'Shoulder Dislocate': 'shoulder-dislocate' }
    const OLD_NAMES: Record<string, string> = { 'L-Sit Hold': 'l-sit-hold', Compression: 'l-sit-hold', 'Pushup Contest': 'push-up-contest', 'Wrist Stretch': 'wrist-stretch', 'Reverse Wrist Stretch': 'reverse-wrist-stretch' }
    const whens = [...guardSql.matchAll(/WHEN event_name (?:IN \(([^)]*)\)|= ('[^']*')) THEN '([^']+)'/g)]
    expect(whens.length).toBeGreaterThan(0)
    for (const w of whens) {
      for (const n of [...(w[1] ?? w[2]).matchAll(/'([^']+)'/g)].map(m => m[1])) {
        const slug = getEventByName(n)?.slug ?? REMOVED[n] ?? OLD_NAMES[n]
        expect(slug, n).toBe(w[3])
      }
    }
    expect(guardSql).toMatch(/TG_OP = 'INSERT' AND v_slug IN \('lunges', 'ab-wheel-rollout', 'shoulder-dislocate'\)/)
  })

  it('checks an UPDATE only when the score or the event changes, so a game can always close', () => {
    expect(guardSql).toMatch(/IF TG_OP = 'UPDATE' AND NEW\.raw_score IS NOT DISTINCT FROM OLD\.raw_score\s+AND NEW\.difficulty_tier IS NOT DISTINCT FROM OLD\.difficulty_tier THEN/)
    // Moving a row onto another event is checked, on both tables.
    expect(guardSql).toContain('IF NEW.event_id IS NOT DISTINCT FROM OLD.event_id THEN RETURN NEW; END IF;')
    expect(guardSql).toMatch(/ELSIF NEW\.event_slug IS NOT DISTINCT FROM OLD\.event_slug THEN\s+RETURN NEW;/)
    // The skip comes before the lookup, so placement writes cost nothing.
    expect(guardSql.indexOf("IF TG_OP = 'UPDATE'")).toBeLessThan(guardSql.indexOf('SELECT CASE'))
  })

  it('creates the guard after the repair it must not interrupt', () => {
    expect(sql.indexOf('CREATE TRIGGER trg_zz_relevelled_ladders_results'))
      .toBeGreaterThan(sql.indexOf('PERFORM public.compute_event_placements'))
  })

  it('rebuilds the label of every row it moves, keeping its score', () => {
    for (const t of ['r', 'e']) {
      const expr = `score_label = 'D' || (s.new_idx + 1) || ' ' || s.new_tier
         || CASE WHEN position(' · ' in ${t}.score_label) > 0
                 THEN substring(${t}.score_label from position(' · ' in ${t}.score_label)) ELSE '' END`
      expect(sql, t).toContain(expr)
    }
  })
})
