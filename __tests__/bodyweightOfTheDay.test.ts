import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { BODYWEIGHT_BANDS } from '@/lib/grading'

// ─── Bodyweight of the day: the migration's shape ────────────────────────────
// 20260922213125 replaces the 10kg band on /profile with a dated declaration
// made on the scoring screen. One player in 27 ever set the band, and the
// midpoint over-graded the heavy half of each band by about a rung.
//
// The properties below are the ones that cost something if they regress: a
// write path that lets a player date their own weigh-in would hand back the
// re-pricing that per-row pinning was built to stop, and a column drop in this
// file would break every self-service erasure and four app surfaces mid-deploy.

const dir = 'supabase/migrations'
const file = readdirSync(dir).find(n => n.endsWith('_player_bodyweights.sql'))!
const sql = readFileSync(`${dir}/${file}`, 'utf8')
const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')
/** A function's whole CREATE body. Anchored on CREATE, because a multi-line
 *  argument list means a bare `FUNCTION name(uuid, ...)` match lands on the
 *  REVOKE line underneath it instead. */
const fnBody = (fn: string) =>
  code.match(new RegExp(`CREATE OR REPLACE FUNCTION public\\.${fn}\\([\\s\\S]*?\\n\\$\\$;`))![0]

describe('the table', () => {
  it('stores an exact weight against a day, one per player per day', () => {
    expect(code).toMatch(/CREATE TABLE IF NOT EXISTS public\.player_bodyweights/)
    expect(code).toMatch(/measured_on\s+date NOT NULL/)
    expect(code).toMatch(/kg\s+numeric NOT NULL CHECK \(kg >= 20 AND kg <= 400\)/)
    expect(code).toMatch(/UNIQUE \(player_id, measured_on\)/)
  })

  it('has row level security and no direct write for anyone', () => {
    // record_bodyweight() is the only path. A PostgREST upsert is
    // INSERT ... ON CONFLICT DO UPDATE and needs the UPDATE privilege, which is
    // exactly what the day-pin depends on nobody having.
    expect(code).toMatch(/ALTER TABLE public\.player_bodyweights ENABLE ROW LEVEL SECURITY/)
    expect(code).toMatch(/REVOKE INSERT, UPDATE, DELETE ON TABLE public\.player_bodyweights FROM authenticated/)
    expect(code).toMatch(/REVOKE ALL ON TABLE public\.player_bodyweights FROM anon/)
    expect(code).not.toMatch(/CREATE POLICY[\s\S]*?FOR (INSERT|UPDATE|DELETE)[\s\S]*?ON public\.player_bodyweights/)
  })

  it('reads to the player, their parent and a kaiwhakawā, and nobody else', () => {
    // An exact kilogram is more sensitive than a band, and `players` shipped
    // world-readable for months, so the SELECT policy is stated not assumed.
    const policy = code.match(/CREATE POLICY player_bodyweights_select_own[\s\S]*?;/)![0]
    expect(policy).toMatch(/FOR SELECT TO authenticated/)
    expect(policy).toMatch(/player_id = auth\.uid\(\)/)
    expect(policy).toMatch(/p\.parent_id = auth\.uid\(\)/)
    expect(policy).toMatch(/public\.is_judge\(\)/)
  })
})

describe('the day is not the client\'s to choose', () => {
  it('pins measured_on to the NZ day, by a named zone', () => {
    const pin = fnBody('pin_bodyweight_measured_on')
    expect(pin).toMatch(/NEW\.measured_on := \(now\(\) AT TIME ZONE 'Pacific\/Auckland'\)::date/)
    // Never a fixed +12: NZDT is +13 from late September.
    expect(pin).not.toMatch(/\+12|interval '12/)
  })

  it('is SECURITY INVOKER, so current_user can tell a client write apart', () => {
    // As a definer, current_user would always be the owner and every client
    // write would be waved through as trusted server code.
    const pin = fnBody('pin_bodyweight_measured_on')
    expect(pin).toMatch(/SECURITY INVOKER/)
    expect(pin).toMatch(/IF auth\.uid\(\) IS NULL OR current_user NOT IN \('authenticated', 'anon'\) THEN\s+RETURN NEW;/)
    expect(code).toMatch(/BEFORE INSERT OR UPDATE ON public\.player_bodyweights\s+FOR EACH ROW EXECUTE FUNCTION public\.pin_bodyweight_measured_on\(\)/)
  })
})

describe('record_bodyweight', () => {
  const fn = () => fnBody('record_bodyweight')

  it('is a definer with a pinned search_path, and the same authority as a score', () => {
    expect(fn()).toMatch(/SECURITY DEFINER/)
    expect(fn()).toMatch(/SET search_path = public/)
    expect(fn()).toMatch(/IF NOT public\.can_log_for\(p_player_id\) THEN/)
  })

  it('lets only a kaiwhakawā date a weigh-in, and never in the future', () => {
    // This IS the correction path. A player who could name a day could backdate
    // a light weight onto history they have already been graded on.
    expect(fn()).toMatch(/IF NOT public\.is_judge\(\) THEN[\s\S]*?only a kaiwhakawa may date a weigh-in/)
    expect(fn()).toMatch(/IF p_measured_on > v_day THEN/)
  })

  it('replaces a same-day declaration rather than granting anyone UPDATE', () => {
    expect(fn()).toMatch(/ON CONFLICT \(player_id, measured_on\)\s*\n\s*DO UPDATE SET/)
  })

  it('never writes to players', () => {
    // __tests__/autoConferral.test.ts asserts delete_my_account is the ONLY
    // definer that updates players — the invariant that stops a definer being
    // a way around guard_players_grading_identity. grades_need_recheck probing
    // this table is the same signal without the write.
    expect(fn()).not.toMatch(/UPDATE\s+(public\.)?players/)
  })

  it('is granted to signed-in callers and never to anon', () => {
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.record_bodyweight\(uuid, numeric, date\) FROM PUBLIC, anon/)
    expect(code).toMatch(/GRANT EXECUTE ON FUNCTION public\.record_bodyweight\(uuid, numeric, date\) TO authenticated, service_role/)
  })
})

describe('the cheap recheck probe', () => {
  const fn = () => fnBody('grades_need_recheck')

  it('sees a new declaration', () => {
    // Declaring makes every lift gradeable and leaves no result or entry
    // behind, so without this a player whose only change is their bodyweight
    // is skipped until something else marks them dirty.
    expect(fn()).toMatch(/FROM player_bodyweights WHERE player_id = p_player_id AND created_at > v_since/)
  })

  it('keeps every probe it already had', () => {
    // A whole redefinition is how a rule goes missing.
    for (const t of ['results', 'workout_entries', 'grade_exemptions', 'matches']) {
      expect(fn()).toContain(t)
    }
    expect(fn()).toMatch(/s\.ended_at > v_since OR s\.voided_at > v_since OR s\.points_awarded_at > v_since/)
    expect(fn()).toMatch(/IF NOT public\.can_log_for\(p_player_id\) THEN/)
  })
})

describe('account erasure', () => {
  const fnOf = (text: string) => text.match(/CREATE OR REPLACE FUNCTION public\.delete_my_account[\s\S]*?\n\$\$;/)![0]
  const previous = fnOf(readFileSync(`${dir}/20260921232726_bodyweight_band_of_the_day.sql`, 'utf8'))
  const current = fnOf(sql)

  it('is the previous definition plus deleting the declarations, and nothing else', () => {
    // /privacy promises erasure removes bodyweight. The table's ON DELETE
    // CASCADE never fires, because erasure ANONYMISES the players row instead
    // of deleting it — so the delete has to be explicit.
    const added = '\n  -- ADDED 20260922213125: dated bodyweights are health information and /privacy\n'
      + '  -- promises they go with the account. The table\'s ON DELETE CASCADE never\n'
      + '  -- fires here, because erasure ANONYMISES the players row rather than deleting\n'
      + '  -- it, so the delete has to be explicit.\n'
      + '  DELETE FROM player_bodyweights WHERE player_id = v_target;\n'
    expect(current).toContain(added)
    expect(current.replace(added, '')).toBe(previous)
  })

  it('still clears the band columns it cleared before', () => {
    expect(current).toMatch(/bodyweight_band\s+= NULL/)
    expect(current).toMatch(/bodyweight_band_first = NULL/)
  })
})

describe('the deploy order this file depends on', () => {
  it('does NOT drop the old columns', () => {
    // A missing COLUMN returns 42703 and takes the whole PostgREST request
    // down, and four app surfaces plus lib/loadGrades.ts still select these.
    // Dropping them here would also make delete_my_account raise at runtime,
    // failing every self-service erasure. Separate later migration.
    expect(code).not.toMatch(/DROP COLUMN[\s\S]*?bodyweight_band/)
    expect(code).not.toMatch(/ALTER TABLE[\s\S]*?DROP COLUMN/)
  })

  it('seeds history from the bands, at the midpoints lib/grading.ts defines', () => {
    // Without the seed, every historical lift becomes undeclared the moment the
    // engine stops reading bands, and the history replay would confer nothing
    // in Maximal Strength for anybody.
    const seed = code.match(/CASE b\.band([\s\S]*?)END/)![1]
    for (const b of BODYWEIGHT_BANDS) {
      expect(seed).toContain(`WHEN '${b.label}'`)
      expect(seed).toMatch(new RegExp(`WHEN '${b.label}'\\s+THEN ${b.mid}\\b`))
    }
  })

  it('asserts its own seed covered everyone who held a band', () => {
    expect(code).toMatch(/RAISE EXCEPTION 'bodyweight seed: % players hold a band but no declaration'/)
  })

  it('never disables a trigger', () => {
    expect(code).not.toMatch(/DISABLE TRIGGER/)
  })
})
