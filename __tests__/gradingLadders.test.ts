import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { EVENTS, getEventByName, getEventBySlug } from '@/lib/eventData'

// History migrations hard-code rung indexes and names, so these tests fail if
// a ladder and the migration that re-filed its history ever disagree: a wrong
// index would file a score on the wrong rung, and the closing assertion would
// only catch it in production.
//
// The Sept 2026 grading rebuild (20260915040534) gave the pure contests a drill
// under a Game rung. The 5 Oct 2026 difficulty review (20261005012108) took
// most of those drills away again, so the September file is now pinned only on
// what does not depend on today's ladders.

function migration(suffix: string): string {
  const dir = 'supabase/migrations'
  const f = readdirSync(dir).find(n => n.endsWith(suffix))
  if (!f) throw new Error(`${suffix} migration not found`)
  return readFileSync(`${dir}/${f}`, 'utf8')
}

function valuesOf(sql: string, table: string): string {
  const m = sql.match(new RegExp(`INSERT INTO ${table} VALUES([\\s\\S]*?);`))
  if (!m) throw new Error(`no VALUES block for ${table}`)
  return m[1]
}

const SEPT = migration('_pure_contest_ladders.sql')
const OCT = migration('_difficulty_review_oct.sql')

const PURE_CONTESTS = [
  'Arm Wrestling', 'Tug of War', '100m Sprint', 'Tag', 'T-Race', 'Beach Flags', '200m Sprint',
  'Rats & Rabbits', 'Speed Chess', 'Capture the Flag', 'Kabaddi', 'Tae Kwon Do', 'Fencing',
]

describe('pure contests (5 Oct 2026)', () => {
  it('are plain win/draw/loss with no ladder', () => {
    for (const name of PURE_CONTESTS) {
      const e = getEventByName(name)!
      expect(e.inputMode, name).toBe('sport')
      expect(e.difficultyTiers, name).toBeUndefined()
    }
  })

  // The 6 Oct 2026 roster added four more, born plain win/draw/loss.
  const ADDED_OCT_6 = ['Mas Wrestling', '400m Sprint', '800m Sprint', 'Obstacle Course']

  it('are, with Wrestling and the 6 Oct additions, every event on plain win/draw/loss', () => {
    expect(EVENTS.filter(e => e.inputMode === 'sport').map(e => e.name).sort())
      .toEqual([...PURE_CONTESTS, 'Wrestling', ...ADDED_OCT_6].sort())
  })

  it('record a time alongside exactly when they are raced', () => {
    const raced = ['100m Sprint', '200m Sprint', 'Tag', 'T-Race', 'Beach Flags', 'Rats & Rabbits',
      'Capture the Flag', 'Kabaddi', '400m Sprint', '800m Sprint', 'Obstacle Course']
    expect(EVENTS.filter(e => e.recordsTime).map(e => e.name).sort()).toEqual(raced.sort())
  })
})

describe('the 5 Oct 2026 history migration agrees with the ladders', () => {
  it('names every contest that lost its drills, by its real slug', () => {
    const rows = [...valuesOf(OCT, 'contest').matchAll(/\('([^']+)', '([^']+)'\)/g)].map(m => [m[1], m[2]] as const)
    expect(rows.map(r => r[0]).sort()).toEqual([...PURE_CONTESTS].sort())
    for (const [name, slug] of rows) expect(getEventByName(name)!.slug, name).toBe(slug)
  })

  it('files every surviving rung at its real index, and archives only rungs that are gone', () => {
    const rows = [...valuesOf(OCT, 'tier_map').matchAll(/\('((?:[^']|'')+)', '((?:[^']|'')+)', (\d+), (NULL|'((?:[^']|'')+)'), (NULL|\d+)\)/g)]
      .map(m => ({ event: m[1].replace(/''/g, "'"), old: m[2].replace(/''/g, "'"), newTier: m[5]?.replace(/''/g, "'") ?? null, newIdx: m[6] === 'NULL' ? null : +m[6] }))
    expect(rows.length).toBeGreaterThan(100)
    for (const r of rows) {
      const tiers = getEventByName(r.event)!.difficultyTiers!.map(t => t.name)
      if (r.newTier === null) {
        expect(tiers, `${r.event}: ${r.old} is archived but still a rung`).not.toContain(r.old)
      } else {
        expect(tiers[r.newIdx!], `${r.event}: ${r.old}`).toBe(r.newTier)
      }
    }
  })

  it('maps Animal Crawl onto its four crawls', () => {
    const tiers = getEventBySlug('animal-crawl')!.difficultyTiers!.map(t => t.name)
    const rows = [...valuesOf(OCT, 'crawl_map').matchAll(/\('([^']+)', (\d+), '([^']+)', (\d+), (\d+)\)/g)]
    expect(rows).toHaveLength(5)
    for (const m of rows) expect(tiers[+m[4]], m[1]).toBe(m[3])
    expect(getEventBySlug('animal-crawl')!.referenceMetres).toBe(25)
  })

  it('converts each old Tibialis Curl level to the load it was', () => {
    const rows = [...valuesOf(OCT, 'tib_map').matchAll(/\('([^']+)', (\d+), ([\d.]+)\)/g)]
    expect(rows.map(m => [m[1], +m[3]])).toEqual([
      ['Bodyweight', 0], ['2.5kg', 2.5], ['5kg', 5], ['10kg', 10], ['15kg', 15], ['20kg', 20],
    ])
    expect(getEventBySlug('tibialis-curl')!.inputMode).toBe('weight+reps')
  })

  it('keeps the full implement on the throws, which are now plain distances', () => {
    for (const slug of ['javelin-throw', 'shot-put']) {
      expect(OCT).toContain(`'${slug}'`)
      expect(getEventBySlug(slug)!.inputMode, slug).toBe('distance')
    }
  })

  it('re-files the distance efforts on the 1000m reference the code uses', () => {
    const rows = [...valuesOf(OCT, 'effort').matchAll(/\('([^']+)', '([^']+)'\)/g)]
    expect(rows).toHaveLength(5)
    for (const m of rows) {
      const e = getEventBySlug(m[2])!
      expect(e.name).toBe(m[1])
      expect(e.inputMode).toBe('distance+time')
      expect(e.referenceMetres, m[1]).toBe(1000)
    }
    // Riegel's exponent, written once in each language.
    expect(OCT).toContain('power(25.0 / x.metres, 1.06)')
  })

  it('names the carries as the roster now has them', () => {
    for (const m of valuesOf(OCT, 'carry').matchAll(/\('([^']+)', '([^']+)'\)/g)) {
      expect(getEventBySlug(m[2])!.inputMode, m[1]).toBe('weight+distance+time')
    }
  })

  // 20260930011149 already removed Lunges, Ab Rollout and Shoulder Dislocate and
  // kept their scores; this file must not touch them again.
  it('leaves the events removed on 30 Sept alone', () => {
    // The redefined guard still refuses new scores on them, so it is left out.
    const g0 = OCT.indexOf('CREATE OR REPLACE FUNCTION public.enforce_relevelled_ladders()')
    const outside = OCT.slice(0, g0) + OCT.slice(OCT.indexOf('$$;', g0))
    expect(outside).not.toMatch(/'(lunges|ab-wheel-rollout|shoulder-dislocate)'/)
  })
})

describe.each([
  ['20260915040534', SEPT, ['results_grading_preimage_20260915040534', 'results_grading_archive_20260915040534']],
  ['20261005012108', OCT, [
    'results_difficulty_preimage_20261005012108', 'workout_entries_difficulty_preimage_20261005012108',
    'results_difficulty_archive_20261005012108', 'workout_entries_difficulty_archive_20261005012108',
  ]],
])('%s', (_name, sql, tables) => {
  it('carries no transaction control of its own', () => {
    // The CLI wraps the file and its ledger row together; an explicit COMMIT
    // would end that before the ledger row is written.
    const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im)
  })

  it('locks every table it creates in public', () => {
    for (const t of tables) {
      expect(sql).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
      expect(sql).toContain(`REVOKE ALL ON public.${t} FROM anon, authenticated;`)
    }
  })
})
