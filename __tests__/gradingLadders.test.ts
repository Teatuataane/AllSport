import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { EVENTS, getEventByName, isTimedEffort } from '@/lib/eventData'

// The grading rebuild (Sept 2026) gave the pure contests a drill under a Game
// rung and moved the loaded carries to bodyweight. The history migration hard-
// codes each Game rung's index and the carry levels, so these tests fail if the
// ladders and the migration ever disagree: a wrong index would file a win on a
// drill rung, and the closing assertion would only catch it in production.

function migration(): string {
  const dir = 'supabase/migrations'
  const f = readdirSync(dir).find(n => n.endsWith('_pure_contest_ladders.sql'))
  if (!f) throw new Error('pure contest ladders migration not found')
  return readFileSync(`${dir}/${f}`, 'utf8')
}

function valuesOf(sql: string, table: string): string {
  const m = sql.match(new RegExp(`INSERT INTO ${table} VALUES([\\s\\S]*?);`))
  if (!m) throw new Error(`no VALUES block for ${table}`)
  return m[1]
}

const PURE_CONTESTS = [
  'Arm Wrestling', 'Tug of War', 'Tag', 'Beach Flags', 'Rats & Rabbits',
  'Speed Chess', 'Capture the Flag', 'Kabaddi', 'Tae Kwon Do', 'Fencing',
]

describe('pure contests', () => {
  it('each tops a drill ladder with exactly one Game rung, last', () => {
    for (const name of PURE_CONTESTS) {
      const e = getEventByName(name)!
      const tiers = e.difficultyTiers!
      expect(tiers.length, name).toBeGreaterThanOrEqual(2)
      expect(tiers.filter(t => t.scoring === 'sport'), name).toHaveLength(1)
      expect(tiers.at(-1)!.scoring, name).toBe('sport')
    }
  })

  it('Wrestling is the only event left on plain win/draw/loss', () => {
    expect(getEventByName('Wrestling')!.inputMode).toBe('sport')
    expect(EVENTS.filter(e => e.inputMode === 'sport').map(e => e.name)).toEqual(['Wrestling'])
  })

  it('races the five chase and pull drills, holds the arm, counts the rest', () => {
    const raced = ['Tag', 'Rats & Rabbits', 'Capture the Flag', 'Beach Flags', 'Tug of War']
    for (const name of raced) {
      const e = getEventByName(name)!
      expect(e.inputMode, name).toBe('difficulty+time')
      expect(isTimedEffort(e.slug), name).toBe(true)
    }
    const arm = getEventByName('Arm Wrestling')!
    expect(arm.inputMode).toBe('difficulty+time')
    expect(isTimedEffort(arm.slug)).toBe(false)
    for (const name of ['Kabaddi', 'Speed Chess', 'Fencing', 'Tae Kwon Do']) {
      expect(getEventByName(name)!.inputMode, name).toBe('difficulty+reps')
    }
  })
})

describe('the history migration agrees with the ladders', () => {
  const sql = migration()

  it('names every pure contest, at its real Game index', () => {
    const rows = [...valuesOf(sql, 'contest_game').matchAll(/\('([^']+)', (\d+)\)/g)]
      .map(m => [m[1], +m[2]] as const)
    expect(rows.map(r => r[0]).sort()).toEqual([...PURE_CONTESTS].sort())
    for (const [name, idx] of rows) {
      const tiers = getEventByName(name)!.difficultyTiers!
      expect(tiers.findIndex(t => t.scoring === 'sport'), name).toBe(idx)
    }
  })

  it('archives against the exact bodyweight ladder the carries now use', () => {
    const m = sql.match(/unnest\(ARRAY\[('Weighted Carry'[^\]]*)\]\) AS e,\s*unnest\(ARRAY\[([^\]]*)\]\) AS t/)
    expect(m).not.toBeNull()
    const events = [...m![1].matchAll(/'([^']+)'/g)].map(x => x[1])
    const rungs = [...m![2].matchAll(/'([^']+)'/g)].map(x => x[1])
    expect(events).toEqual(['Weighted Carry', 'Wheelbarrow Push', 'Wheelbarrow Pull'])
    // 20260915040534 is APPLIED and frozen, so it names the carries as they were
    // called in September 2026. All three were renamed later that month, which
    // is why this maps the historical names onto today's roster rather than
    // looking them up directly — a rename must not be able to make an applied
    // migration look wrong.
    const RENAMED: Record<string, string> = {
      'Weighted Carry': 'Sandbag Carry',
      'Wheelbarrow Push': 'Farmer Carry',
      'Wheelbarrow Pull': 'Weighted Drag',
    }
    for (const name of events) {
      const e = getEventByName(RENAMED[name] ?? name)
      expect(e, `${name} (now ${RENAMED[name] ?? name}) is not on the roster`).toBeDefined()
      expect(e!.difficultyTiers!.map(t => t.name), name).toEqual(rungs)
    }
  })

  it('carries no transaction control of its own', () => {
    // The CLI wraps the file and its ledger row together; an explicit COMMIT
    // would end that before the ledger row is written.
    const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
    expect(code).not.toMatch(/^\s*(BEGIN|COMMIT)\s*;/im)
  })

  it('locks both tables it creates in public', () => {
    for (const t of ['results_grading_preimage_20260915040534', 'results_grading_archive_20260915040534']) {
      expect(sql).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`)
      expect(sql).toContain(`REVOKE ALL ON public.${t} FROM anon, authenticated;`)
    }
  })
})
