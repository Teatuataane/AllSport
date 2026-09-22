import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { eventGrade, type GradePlayer, type GradeResultRow } from '@/lib/playerGrades'
import { BODYWEIGHT_BANDS } from '@/lib/grading'
import { getEventByName } from '@/lib/eventData'

// ─── The bodyweight band of the day ──────────────────────────────────────────
// A strength standard is a ratio of bodyweight and the band is self-declared,
// so grading an old lift against TODAY's declaration lets one dropdown re-price
// a whole domain. 20260921232726 stamps the band on the row; these tests pin
// both halves of that — the migration's shape, and the engine reading it.
//
// The numbers below are real: Deadlift's ladder puts a 100kg pull at rung 5 for
// a 90-100kg lifter and rung 11 for an Under-50kg one. That gap IS the exploit.

const dir = 'supabase/migrations'
const sql = readFileSync(`${dir}/${readdirSync(dir).find(n => n.endsWith('_bodyweight_band_of_the_day.sql'))!}`, 'utf8')
const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

const deadlift = getEventByName('Deadlift')!
const lifter = (bodyweightBand: string | null): GradePlayer =>
  ({ division: "Men's", ageYears: 30, gender: 'Male', bodyweightBand })
const lift = (kg: number, bodyweightBand?: string | null): GradeResultRow =>
  ({ event_name: 'Deadlift', raw_score: kg, weight_kg: kg, difficulty_tier: null, ...(bodyweightBand !== undefined ? { bodyweightBand } : {}) })
const rungOf = (rows: GradeResultRow[], p: GradePlayer) => eventGrade(deadlift, rows, p).rung

/** The name of the one trigger a migration file creates on a table. */
const triggerOn = (text: string, table: string) =>
  text.match(new RegExp(`CREATE TRIGGER (\\w+)\\s+BEFORE [A-Z ]+? ON (?:public\\.)?${table}\\b`))![1]
const latestDefining = (fn: string) => {
  const f = readdirSync(dir).filter(n => readFileSync(`${dir}/${n}`, 'utf8').includes(`TRIGGER`) &&
    readFileSync(`${dir}/${n}`, 'utf8').includes(`EXECUTE FUNCTION public.${fn}()`)).sort().at(-1)
  if (!f) throw new Error(`no migration wires ${fn}`)
  return readFileSync(`${dir}/${f}`, 'utf8')
}
const fnBody = (fn: string) => code.match(new RegExp(`FUNCTION public\\.${fn}\\(\\)([\\s\\S]*?)\\$\\$;`))![1]

describe('the migration', () => {
  it('allows exactly the bands lib/grading.ts offers, on all three columns', () => {
    for (const c of ['results_bodyweight_band_check', 'workout_entries_bodyweight_band_check', 'players_bodyweight_band_first_check']) {
      const check = code.match(new RegExp(`${c} CHECK \\(([\\s\\S]*?)\\)\\s*;`))![1]
      expect([...check.matchAll(/'([^']+)'/g)].map(m => m[1])).toEqual(BODYWEIGHT_BANDS.map(b => b.label))
    }
  })

  it('stamps server-side, as a definer with a pinned search_path', () => {
    for (const fn of ['stamp_results_band', 'stamp_workout_entry_band']) {
      expect(fnBody(fn)).toMatch(/SECURITY DEFINER/)
      expect(fnBody(fn)).toMatch(/SET search_path = public/)
    }
  })

  it('pins a stamped band on every update, null included', () => {
    // An edit never re-dates the bodyweight a lift was done at, and a client
    // can never move it. Null stays null: those rows grade on the FIRST band.
    for (const fn of ['stamp_results_band', 'stamp_workout_entry_band']) {
      expect(fnBody(fn)).toMatch(/IF TG_OP = 'UPDATE' THEN\s+NEW\.bodyweight_band := OLD\.bodyweight_band;/)
    }
  })

  it('never writes a score row from a trigger on players', () => {
    // The earlier draft did, under the player's own login, and the existing
    // guards refused every finished game and every old or witnessed log: no
    // one with a past game could have set a band.
    expect(code).not.toMatch(/FUNCTION public\.stamp_bands_on_first_set/)
    expect(code).not.toMatch(/CREATE TRIGGER \w+\s+AFTER UPDATE[\s\S]*?ON public\.players/)
    const pin = fnBody('pin_bodyweight_band_first')
    expect(pin).not.toMatch(/UPDATE\s+(public\.)?(results|workout_entries)/)
  })

  it('pins the first band once set, and ignores a client sending it', () => {
    const pin = fnBody('pin_bodyweight_band_first')
    expect(pin).toMatch(/NEW\.bodyweight_band_first := COALESCE\(OLD\.bodyweight_band_first, NEW\.bodyweight_band\)/)
    expect(pin).toMatch(/NEW\.bodyweight_band_first := NEW\.bodyweight_band;/)   // on INSERT
    expect(code).toMatch(/BEFORE INSERT OR UPDATE ON public\.players\s+FOR EACH ROW EXECUTE FUNCTION public\.pin_bodyweight_band_first\(\)/)
  })

  it('backfills BEFORE creating the stamp triggers, which would otherwise undo it', () => {
    expect(code.indexOf('UPDATE results r SET bodyweight_band')).toBeGreaterThan(-1)
    expect(code.indexOf('UPDATE results r SET bodyweight_band')).toBeLessThan(code.indexOf('CREATE TRIGGER trg_stamp_results_band'))
    expect(code.indexOf('UPDATE workout_entries e SET bodyweight_band')).toBeGreaterThan(-1)
    expect(code.indexOf('UPDATE workout_entries e SET bodyweight_band')).toBeLessThan(code.indexOf('CREATE TRIGGER trg_stamp_workout_entry_band'))
  })

  it('never disables a trigger', () => {
    // DISABLE TRIGGER takes an ACCESS EXCLUSIVE lock on results.
    expect(code).not.toMatch(/DISABLE TRIGGER/)
  })

  it('leaves the existing write guards alone', () => {
    // CLAUDE.md: a whole redefinition is how a rule goes missing.
    expect(code).not.toMatch(/FUNCTION public\.guard_results_write/)
    expect(code).not.toMatch(/FUNCTION public\.guard_workout_entries_write/)
  })

  it('sorts its stamp triggers after the real guards, so a rejected write is never stamped', () => {
    // Same-timing triggers fire in name order. Names read from the files, so a
    // rename on either side is caught, not just the literals in this test.
    expect(triggerOn(code, 'results') > triggerOn(latestDefining('guard_results_write'), 'results')).toBe(true)
    expect(triggerOn(code, 'workout_entries') > triggerOn(latestDefining('guard_workout_entries_write'), 'workout_entries')).toBe(true)
  })

  it('asserts its own backfill took', () => {
    expect(code).toMatch(/RAISE EXCEPTION 'band backfill/)
    expect(code).toMatch(/RAISE EXCEPTION 'band: a trigger that rewrites score rows/)
  })
})

describe('the first band', () => {
  it('grades an unstamped lift against the first band, not the current one', () => {
    // Set "90 to 100kg" first, later "Under 50kg": a lift logged while they had
    // no band still grades at 90 to 100kg. Clearing and resetting gains nothing.
    const p: GradePlayer = { ...lifter('Under 50kg'), firstBodyweightBand: '90 to 100kg' }
    expect(rungOf([lift(100, null)], p)).toBe(5)
  })

  it('falls back to the current band before the migration (undefined first band)', () => {
    expect(rungOf([lift(100, null)], lifter('90 to 100kg'))).toBe(5)
  })

  it('never overrides a band stamped on the row', () => {
    const p: GradePlayer = { ...lifter('90 to 100kg'), firstBodyweightBand: '90 to 100kg' }
    expect(rungOf([lift(100, 'Under 50kg')], p)).toBe(11)
  })
})

describe('grading against the band of the day', () => {
  it('grades a lift against the band on the row', () => {
    expect(rungOf([lift(100, '90 to 100kg')], lifter('90 to 100kg'))).toBe(5)
    expect(rungOf([lift(100, 'Under 50kg')], lifter('Under 50kg'))).toBe(11)
  })

  it('does not re-grade a stamped lift when the player re-declares', () => {
    // The exploit, closed: the lift stays rung 5 however the profile changes.
    const honest = [lift(100, '90 to 100kg')]
    expect(rungOf(honest, lifter('90 to 100kg'))).toBe(5)
    expect(rungOf(honest, lifter('Under 50kg'))).toBe(5)
  })

  it('takes the best RUNG, not the heaviest lift', () => {
    // 80kg at a light bodyweight is a better lift than 100kg at a heavy one,
    // and the old code picked by weight_kg alone.
    const rows = [lift(100, '90 to 100kg'), lift(80, 'Under 50kg')]
    expect(rungOf(rows, lifter('90 to 100kg'))).toBe(10)
    expect(eventGrade(deadlift, rows, lifter('90 to 100kg')).rung)
      .toBeGreaterThan(rungOf([lift(100, '90 to 100kg')], lifter('90 to 100kg')))
  })

  it('falls back to the current band for a row written before the stamp', () => {
    // Unstamped rows must behave exactly as they did before the migration, so
    // the code is safe to deploy in either order.
    expect(rungOf([lift(100, null)], lifter('90 to 100kg')))
      .toBe(rungOf([lift(100, '90 to 100kg')], lifter('90 to 100kg')))
    expect(rungOf([lift(100)], lifter('90 to 100kg'))).toBe(5)
  })

  it('is ungradeable, not failed, when no band exists anywhere', () => {
    const g = eventGrade(deadlift, [lift(100, null)], lifter(null))
    expect(g.gradeable).toBe(false)
    expect(g.rung).toBe(0)
  })

  it('is gradeable on a stamped row even if the player has cleared their band', () => {
    const g = eventGrade(deadlift, [lift(100, '90 to 100kg')], lifter(null))
    expect(g.gradeable).toBe(true)
    expect(g.rung).toBe(5)
  })

  it('ignores the stamp for juniors, who are always graded at 50kg', () => {
    const junior: GradePlayer = { division: 'Juniors', ageYears: 12, gender: 'Female', bodyweightBand: null }
    // A stamped band must not let a junior out of the fixed junior weight.
    expect(rungOf([lift(60, 'Under 50kg')], junior)).toBe(rungOf([lift(60, null)], junior))
    expect(eventGrade(deadlift, [lift(60, null)], junior).gradeable).toBe(true)
  })
})

describe('account erasure', () => {
  // /privacy promises erasure removes bodyweight. bodyweight_band_first is a
  // new bodyweight attribute, so delete_my_account is redefined whole here —
  // the move that has lost rules in this repo before. Pinned to be the previous
  // definition plus the one marked line, and nothing else.
  const fnOf = (text: string) => text.match(/CREATE OR REPLACE FUNCTION public\.delete_my_account[\s\S]*?\n\$\$;/)![0]
  const previous = fnOf(readFileSync(`${dir}/20260915214702_workout_logging.sql`, 'utf8'))
  const current = fnOf(sql)

  it('is the previous definition plus clearing the first band, and nothing else', () => {
    const added = '    -- ADDED 20260921232726: the first band is a bodyweight attribute too.\n    bodyweight_band_first = NULL,\n'
    expect(current).toContain(added)
    expect(current.replace(added, '')).toBe(previous)
  })

  it('keeps its grants', () => {
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.delete_my_account\(UUID\) FROM PUBLIC, anon;/)
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION public\.delete_my_account\(UUID\) TO authenticated;/)
  })

  it('gets past the first-band pin, which trusts server code by current_user', () => {
    const pin = fnBody('pin_bodyweight_band_first')
    expect(pin).toMatch(/SECURITY INVOKER/)
    expect(pin).toMatch(/IF auth\.uid\(\) IS NULL OR current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
  })

  it('asserts in the database that erasure clears it', () => {
    expect(code).toMatch(/RAISE EXCEPTION 'band: account erasure does not clear the first band'/)
  })
})
