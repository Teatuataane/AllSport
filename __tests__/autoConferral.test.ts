import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { awardsToConfer, awardsToWithdraw } from '@/lib/autoConfer'
import { eventsBehind } from '@/lib/playerGrades'
import { SERVICE_KEY_ENV } from '@/lib/supabase-admin'
import { colourGate, gradeForRung } from '@/lib/grading'
import { EVENTS } from '@/lib/eventData'
import type { GradeState } from '@/lib/loadGrades'

// ─── Auto-conferral ──────────────────────────────────────────────────────────
// Step 3 of docs/designs/auto-conferral-spec.md. The security argument is that
// the client asserts nothing and the write is elevated, so the tests that
// matter are the ones about WHERE the key can reach and WHAT gets written.

const dir = 'supabase/migrations'
const sql = readFileSync(`${dir}/${readdirSync(dir).find(n => n.endsWith('_auto_conferral_route.sql'))!}`, 'utf8')
const code = sql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

/** Every source file under a directory. */
function walk(root: string, out: string[] = []): string[] {
  for (const name of readdirSync(root)) {
    const p = join(root, name)
    if (statSync(p).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(p)) out.push(p)
  }
  return out
}

describe('the service key cannot reach a browser', () => {
  it('is not a NEXT_PUBLIC_ variable', () => {
    // Next inlines anything prefixed NEXT_PUBLIC_ into the client bundle.
    expect(SERVICE_KEY_ENV.startsWith('NEXT_PUBLIC_')).toBe(false)
  })

  it('is imported only by server routes', () => {
    // supabase-admin.ts claims the build fails if a client component imports
    // it. This is that check. A single stray import ships the key to every
    // visitor, and nothing else in the toolchain would say a word.
    const importers = [...walk('app'), ...walk('components'), ...walk('lib')]
      .filter(f => !f.endsWith('lib/supabase-admin.ts'))
      // Any quoted mention, not just `from '…'`: a dynamic import() or a
      // require() in a client file ships the key just the same.
      .filter(f => /supabase-admin['"]/.test(readFileSync(f, 'utf8')))
    expect(importers).toEqual(['app/api/grades/recheck/route.ts'])
  })

  it('never sits in a file marked use client', () => {
    for (const f of [...walk('app'), ...walk('components')]) {
      const src = readFileSync(f, 'utf8')
      if (/supabase-admin['"]/.test(src)) {
        expect(src.trimStart().startsWith("'use client'")).toBe(false)
      }
    }
  })
})

describe('the route', () => {
  const src = readFileSync('app/api/grades/recheck/route.ts', 'utf8')

  it('verifies the token rather than reading a cookie', () => {
    // getSession() reads local storage and is explicitly NOT a security
    // boundary (see lib/supabase-browser.ts). This is one.
    expect(src).toMatch(/auth\.getUser\(\)/)
    expect(src).not.toMatch(/auth\.getSession\(\)/)
  })

  it('reads through the caller, and elevates only to write', () => {
    // loadGradeState is handed the CALLER's client, so RLS is still the guard.
    expect(src).toMatch(/loadGradeState\(db,/)
    // The admin client only ever WRITES: the awards, the withdrawal log, the
    // watermark, and the two published leaderboard numbers. It never reads a player's evidence, which is what keeps RLS the
    // guard on everything the answer rests on.
    const adminTables = new Set([...src.matchAll(/admin\.from\('(\w+)'\)/g)].map(m => m[1]))
    expect([...adminTables].sort()).toEqual(['grade_awards', 'grade_withdrawals', 'player_domain_colours', 'player_season_points', 'players'])
    expect(src).not.toMatch(/loadGradeState\(admin/)
  })

  it('checks the caller may act for another player', () => {
    expect(src).toMatch(/can_log_for/)
    expect(src).toMatch(/403/)
  })

  it('treats an unknown answer as "do the work"', () => {
    // Skipping a colour someone earned would never surface; a wasted recompute
    // costs nothing. The skip happens ONLY on an explicit false.
    expect(src).toMatch(/!error && dirty === false/)
  })

  it('reports only the colours it actually inserted', () => {
    // ON CONFLICT DO NOTHING returns just the new rows. Reporting `pending`
    // would announce the same colour twice when two screens race, or when one
    // races a kaiwhakawā releasing it by hand.
    expect(src).toMatch(/\.select\('domain_number, rung, grade_name, events'\)/)
    expect(src).toMatch(/conferred = pending\.filter/)
  })

  it('moves the watermark only after the writes succeed', () => {
    const write = src.indexOf("admin.from('grade_awards')")
    const stamp = src.indexOf('grades_checked_at')
    expect(write).toBeGreaterThan(-1)
    expect(stamp).toBeGreaterThan(write)
  })
})

describe('the migration', () => {
  it('lets the server confer with nobody as the conferrer', () => {
    expect(code).toMatch(/ALTER COLUMN conferred_by DROP NOT NULL/)
  })

  it('probes as a definer, with a pinned search_path', () => {
    const body = code.match(/FUNCTION public\.grades_need_recheck\(p_player_id uuid\)([\s\S]*?)\$\$;/)![1]
    expect(body).toMatch(/SECURITY DEFINER/)
    expect(body).toMatch(/SET search_path = public/)
  })

  it('refuses to probe a player the caller cannot act for', () => {
    const body = code.match(/FUNCTION public\.grades_need_recheck\(p_player_id uuid\)([\s\S]*?)\$\$;/)![1]
    // Before any data is read: a definer that answered first would be an
    // activity oracle for every player in the club.
    expect(body.indexOf('can_log_for')).toBeLessThan(body.indexOf('grades_checked_at'))
    expect(body).toMatch(/42501/)
  })

  it('is never granted to anon', () => {
    expect(code).toMatch(/REVOKE ALL ON FUNCTION public\.grades_need_recheck\(uuid\) FROM PUBLIC, anon/)
    expect(code).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.grades_need_recheck\(uuid\) TO [^;]*anon/)
  })

  it('marks a player dirty only for games they played in, and indexes the check', () => {
    const body = code.match(/FUNCTION public\.grades_need_recheck\(p_player_id uuid\)([\s\S]*?)\$\$;/)![1]
    expect(body).toMatch(/FROM results r JOIN sessions s ON s\.id = r\.session_id\s+WHERE r\.player_id = p_player_id/)
    expect(code).toMatch(/CREATE INDEX IF NOT EXISTS results_player_created_idx ON public\.results \(player_id, created_at\)/)
  })

  it('leaves confer_grade completely alone', () => {
    // The kaiwhakawā path keeps every guard it has.
    expect(code).not.toMatch(/FUNCTION public\.confer_grade/)
  })

  it('asserts its own shape', () => {
    expect(code).toMatch(/RAISE EXCEPTION 'grades_need_recheck is missing/)
    expect(code).toMatch(/RAISE EXCEPTION 'grade_awards\.conferred_by is still NOT NULL/)
  })
})

// ── What gets written ───────────────────────────────────────────────────────

const gate = (domainNumber: number, held: number, standardsRung: number) =>
  colourGate({ domainNumber, standardsRung, held, games: 999, unitsSinceHeld: 999 })

const stateWith = (gates: ReturnType<typeof gate>[], schemaReady = true): GradeState => ({
  grades: {
    band: 'Open', ladder: 'M',
    events: new Map(EVENTS.map(e => [e.slug, { slug: e.slug, rung: 12, gradeable: true, played: true }])),
    domains: [], overall: null,
  },
  awards: [], held: new Map(), exemptions: new Set(), hasBand: true, schemaReady,
  games: 999, unitsByDomain: new Map(), gates, workoutsReady: true, disputed: new Map(),
} as unknown as GradeState)

describe('awardsToConfer', () => {
  it('confers nothing before the grading schema exists', () => {
    // Every domain would otherwise look like it owed Kiwikiwi, against a schema
    // with nowhere to record it.
    expect(awardsToConfer('p1', stateWith([gate(1, 0, 5)], false))).toEqual([])
  })

  it('confers one colour per domain, never a chain', () => {
    // The standards say rung 5, the player holds nothing: they get rung 1, and
    // the next colour needs its own training units from that moment.
    const out = awardsToConfer('p1', stateWith([gate(1, 0, 5), gate(2, 3, 9)]))
    expect(out.map(a => [a.domain_number, a.rung])).toEqual([[1, 1], [2, 4]])
  })

  it('confers nothing when a gate is unmet', () => {
    const short = colourGate({ domainNumber: 1, standardsRung: 0, held: 0, games: 0, unitsSinceHeld: 0 })
    expect(awardsToConfer('p1', stateWith([short]))).toEqual([])
  })

  it('records nobody as the conferrer, and names the colour', () => {
    const [a] = awardsToConfer('p1', stateWith([gate(3, 0, 4)]))
    expect(a.conferred_by).toBeNull()
    expect(a.grade_name).toBe(gradeForRung(1).name)
    expect(a.player_id).toBe('p1')
  })

  it('records the same evidence the release panel shows', () => {
    const state = stateWith([gate(3, 0, 4)])
    const [a] = awardsToConfer('p1', state)
    expect(a.events).toEqual(eventsBehind(state.grades, 3, 1))
    // Domain 3 holds twelve events and this fixture grades them all.
    expect(a.events).toHaveLength(EVENTS.filter(e => e.domainNumber === 3).length)
  })
})

// ─── Taking a colour back (step 5) ──────────────────────────────────────────


const withAwards = (standardsRung: number, awards: { rung: number; domain: number; id?: string }[], availableCount = 12): GradeState => ({
  ...stateWith([]),
  grades: {
    ...stateWith([]).grades,
    domains: [{ domainNumber: 3, rung: standardsRung, availableCount, required: 6, metAtNextRung: 0, nextRung: null }],
  },
  awards: awards.map(a => ({ domain_number: a.domain, rung: a.rung, grade_name: `G${a.rung}`, conferred_at: '2026-09-01T00:00:00Z', id: a.id })),
} as unknown as GradeState)

describe('awardsToWithdraw', () => {
  it('takes back what the evidence no longer supports, highest first', () => {
    const out = awardsToWithdraw(withAwards(2, [
      { domain: 3, rung: 1, id: 'a' }, { domain: 3, rung: 2, id: 'b' },
      { domain: 3, rung: 3, id: 'c' }, { domain: 3, rung: 4, id: 'd' },
    ]), 3)
    expect(out.map(a => a.id)).toEqual(['d', 'c'])
  })

  it('touches only the domain it was asked about', () => {
    // A deleted Power score must never cost a colour in another domain.
    const out = awardsToWithdraw(withAwards(0, [{ domain: 3, rung: 2, id: 'a' }, { domain: 5, rung: 2, id: 'b' }]), 3)
    expect(out.map(a => a.id)).toEqual(['a'])
  })

  it('leaves a colour alone when the domain cannot be graded at all', () => {
    // Every event exempt or ungradeable is "we cannot tell", not "the evidence
    // is gone" — and the safe answer to "we cannot tell" is to do nothing.
    expect(awardsToWithdraw(withAwards(0, [{ domain: 3, rung: 2, id: 'a' }], 0), 3)).toEqual([])
  })

  it('never withdraws an award it cannot name', () => {
    // An award with no id has not been loaded from the database, so there is
    // nothing to delete — and deleting by anything looser would be a guess.
    expect(awardsToWithdraw(withAwards(0, [{ domain: 3, rung: 2 }]), 3)).toEqual([])
  })

  it('does nothing before the grading schema exists', () => {
    expect(awardsToWithdraw({ ...withAwards(0, [{ domain: 3, rung: 2, id: 'a' }]), schemaReady: false }, 3)).toEqual([])
  })
})

describe('withdrawal in the route', () => {
  const src = readFileSync('app/api/grades/recheck/route.ts', 'utf8')
  const ordinary = src.slice(0, src.indexOf('// ─── Taking a colour back'))
  const withdrawal = src.slice(src.indexOf('// ─── Taking a colour back'))

  it('never withdraws on an ordinary recheck', () => {
    // "Rules cannot drop a colour" rests entirely on this: a revised standards
    // sheet reaches players through rechecks that can only confer.
    expect(ordinary).not.toMatch(/awardsToWithdraw\(/)
    expect(ordinary).not.toMatch(/\.delete\(/)
  })

  it('is for a kaiwhakawā only, asked as the caller', () => {
    expect(withdrawal).toMatch(/db\.rpc\('is_judge'\)/)
    expect(withdrawal).toMatch(/judge !== true\) return json\(\{ error: [^}]*\}, 403\)/)
  })

  it('checks the kaiwhakawā before it reads anything', () => {
    expect(withdrawal.indexOf("rpc('is_judge')")).toBeLessThan(withdrawal.indexOf('loadGradeState('))
  })

  it('deletes the award before logging it, and reports a failed log', () => {
    // The award is what changes what the player holds; the log is the notice.
    const del = withdrawal.search(/from\('grade_awards'\)\s*\.delete\(\)/)
    const log = withdrawal.search(/from\('grade_withdrawals'\)\s*\.insert\(/)
    expect(del).toBeGreaterThan(-1)
    expect(log).toBeGreaterThan(del)
    expect(withdrawal).toMatch(/logged = !logError/)
  })

  it('accepts only a whole domain number from 1 to 10', () => {
    expect(withdrawal).toMatch(/Number\.isInteger\(domain\) \|\| domain < 1 \|\| domain > 10/)
  })
})

describe('the withdrawals migration', () => {
  const wsql = readFileSync(`${dir}/${readdirSync(dir).find(n => n.endsWith('_grade_withdrawals.sql'))!}`, 'utf8')
  const wcode = wsql.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

  it('is private: own, family, kaiwhakawā — never everyone', () => {
    // An award is public because colours are. A withdrawal says a score did not
    // stand up, which is not everyone's business.
    expect(wcode).toMatch(/ENABLE ROW LEVEL SECURITY/)
    expect(wcode).not.toMatch(/USING \(true\)/)
    expect(wcode).toMatch(/player_id = auth\.uid\(\)/)
    expect(wcode).toMatch(/parent_id = auth\.uid\(\)/)
    expect(wcode).toMatch(/public\.is_judge\(\)/)
  })

  it('cannot be written by a client', () => {
    expect(wcode).toMatch(/REVOKE ALL ON public\.grade_withdrawals FROM anon, authenticated/)
    expect(wcode).toMatch(/GRANT SELECT ON public\.grade_withdrawals TO authenticated;/)
    expect(wcode).not.toMatch(/GRANT [^;]*INSERT[^;]*grade_withdrawals/)
  })

  it('asserts its own access rules', () => {
    expect(wcode).toMatch(/RAISE EXCEPTION 'grade_withdrawals: anon can read it'/)
    expect(wcode).toMatch(/RAISE EXCEPTION 'grade_withdrawals: a client can write it'/)
  })

  it('does not redefine delete_my_account', () => {
    expect(wcode).not.toMatch(/FUNCTION public\.delete_my_account/)
  })
})

describe('the audit panel', () => {
  const src = readFileSync('components/GradeReleasePanel.tsx', 'utf8')

  it('catches up through the same route a player uses', () => {
    // No second write path: a colour conferred from the panel is conferred by
    // exactly the code that confers it from a player's own screen.
    expect(src).toMatch(/recheckGrades\(\{ playerId: r\.player\.id, force: true \}\)/)
  })

  it('keeps manual Confirm as the fallback while the server cannot write', () => {
    expect(src).toMatch(/rpc\('confer_grade'/)
    expect(src).toMatch(/writable === false/)
  })

  it('asks twice before deleting evidence', () => {
    expect(src).toMatch(/if \(confirmDelete !== e\.id\) \{ setConfirmDelete\(e\.id\); return \}/)
  })

  it('re-judges the domain after a deletion', () => {
    expect(src).toMatch(/withdrawColours\(player\.id, domain/)
  })

  it('never offers a game-linked entry for deletion', () => {
    // A swap entered at a game was scored in front of a kaiwhakawā; it is not
    // the kind of evidence this list exists to question.
    expect(src).toMatch(/filter\(e => !e\.workouts\.session_id\)/)
  })

  it('dates an award in NZ time, not by slicing a UTC timestamp', () => {
    // Slicing gives the UTC day: the previous NZ day for anything before noon.
    // The same bug session_date had for four months.
    expect(src).not.toMatch(/conferred_at\.slice\(0, 10\)/)
    expect(src).toMatch(/toNZDateString\(new Date\(a\.conferred_at\)\)/)
  })
})

describe('the grading identity cannot be self-edited', () => {
  // Division, date of birth and gender set the age allowance and the ladder.
  // Editable by the player, they would mint colours with nobody looking.
  const pin = readFileSync(`${dir}/${readdirSync(dir).find(n => n.endsWith('_pin_grading_identity.sql'))!}`, 'utf8')
  const pinCode = pin.split('\n').filter(l => !l.trim().startsWith('--')).join('\n')

  it('refuses a change to each of the three unless a kaiwhakawā or server code makes it', () => {
    for (const col of ['division', 'date_of_birth', 'gender', 'is_active']) {
      expect(pinCode).toMatch(new RegExp(`IF NEW\\.${col} IS DISTINCT FROM OLD\\.${col} THEN\\s+RAISE EXCEPTION`))
    }
    expect(pinCode).toMatch(/IF auth\.uid\(\) IS NULL\s+OR current_user NOT IN \('authenticated', 'anon'\)\s+OR public\.is_judge\(\) THEN\s+RETURN NEW;/)
  })

  it('guards UPDATE only, so registration and adding a family member still work', () => {
    expect(pinCode).toMatch(/BEFORE UPDATE ON public\.players/)
    expect(pinCode).not.toMatch(/BEFORE INSERT/)
  })

  it('is a new trigger, never a redefinition of the privileged-columns guard', () => {
    expect(pinCode).not.toMatch(/FUNCTION public\.guard_players_privileged_columns/)
  })

  it('is SECURITY INVOKER, so current_user can tell a client from server code', () => {
    // As a definer, current_user would always be its owner and the erasure
    // exemption would let every client write through.
    expect(pinCode).toMatch(/SECURITY INVOKER\s+SET search_path = public/)
    expect(pinCode).not.toMatch(/SECURITY DEFINER/)
    expect(pinCode).toMatch(/AND NOT p\.prosecdef/)
    expect(pinCode).toMatch(/REVOKE ALL ON FUNCTION public\.guard_players_grading_identity\(\) FROM PUBLIC, anon, authenticated/)
    expect(pinCode).toMatch(/RAISE EXCEPTION 'players grading-identity guard is missing'/)
  })

  it('covers every attribute the engine grades on', () => {
    // If the loader ever reads another player attribute for grading, it must
    // be pinned too, or it is a new dropdown that mints colours.
    const loader = readFileSync('lib/loadGrades.ts', 'utf8')
    const read = [...loader.matchAll(/from\('players(?:_public)?'\)\.select\('([^']+)'\)/g)]
      .flatMap(m => m[1].split(',').map(c => c.trim()))
    const graded = new Set(read.filter(c => !['bodyweight_band', 'bodyweight_band_first'].includes(c)))
    // age_years is players_public's view of date_of_birth; is_active and
    // is_guest gate conferral in the route. is_guest is pinned by the older
    // guard_players_privileged_columns, the rest by 20260921182106.
    const pinned = new Set(['division', 'age_years', 'gender', 'is_active', 'is_guest'])
    expect([...graded].sort()).toEqual([...pinned].sort())
  })
})

describe('server code is trusted by current_user, so erasure still works', () => {
  // The identity guard and the first-band pin let a write through when it runs
  // inside a SECURITY DEFINER function. That is safe only while the one definer
  // function that updates players is account erasure. A second one would
  // inherit the exemption silently; this makes it a decision instead.
  // Every function statement: optional `public.`, any `$tag$`, and whatever
  // follows the body up to its `;` — this repo also writes
  // `$$ LANGUAGE plpgsql SECURITY DEFINER;` after the body.
  const functions = (text: string) => {
    const out: [string, string][] = []
    const start = /CREATE (?:OR REPLACE )?FUNCTION (?:public\.)?(\w+)\s*\(/g
    for (let m; (m = start.exec(text)); ) {
      const open = /\$(\w*)\$/g
      open.lastIndex = m.index
      const o = open.exec(text)
      if (!o) continue
      const close = text.indexOf(o[0], o.index + o[0].length)
      const end = text.indexOf(';', close + o[0].length)
      out.push([m[1], text.slice(m.index, end + 1)])
      start.lastIndex = end + 1
    }
    return out
  }

  it('recognises every function style the migrations use', () => {
    const fixture = [
      'CREATE OR REPLACE FUNCTION public.a() RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN UPDATE players SET x = 1; END; $$;',
      'CREATE OR REPLACE FUNCTION b() RETURNS void AS $fn$ BEGIN UPDATE public.players SET x = 1; END; $fn$ LANGUAGE plpgsql SECURITY DEFINER;',
      'CREATE FUNCTION public.c() RETURNS void AS $$ BEGIN UPDATE players SET x = 1; END; $$ LANGUAGE plpgsql;',
    ].join('\n')
    const found = functions(fixture)
    expect(found.map(([n]) => n)).toEqual(['a', 'b', 'c'])
    expect(found.filter(([, b]) => /SECURITY DEFINER/.test(b)).map(([n]) => n)).toEqual(['a', 'b'])
  })

  it('delete_my_account is the only SECURITY DEFINER function that updates players', () => {
    const latest = new Map<string, string>()
    for (const f of readdirSync(dir).sort()) {
      for (const [name, body] of functions(readFileSync(`${dir}/${f}`, 'utf8'))) latest.set(name, body)
    }
    expect(latest.size).toBeGreaterThan(30)   // the parser found the migrations' functions at all
    const writers = [...latest]
      .filter(([, body]) => /SECURITY DEFINER/.test(body) && /UPDATE\s+(public\.)?players\b/.test(body))
      .map(([n]) => n)
    expect(writers).toEqual(['delete_my_account'])
  })
})

describe('the watermark', () => {
  const route = readFileSync('app/api/grades/recheck/route.ts', 'utf8')
  const withdrawal = route.slice(route.indexOf('async function withdrawIn'))

  it('is never moved by a withdrawal, which ran no conferral pass', () => {
    expect(withdrawal).not.toMatch(/stampChecked\(/)
    expect(withdrawal).not.toMatch(/grades_checked_at/)
  })

  it('is cleared when a player\'s band, division, date of birth or gender changes', () => {
    const body = code.match(/FUNCTION public\.reset_grades_watermark\(\)([\s\S]*?)\$\$;/)![1]
    for (const col of ['bodyweight_band', 'division', 'date_of_birth', 'gender', 'is_active']) {
      expect(body).toMatch(new RegExp(`NEW\\.${col} IS DISTINCT FROM OLD\\.${col}`))
    }
    expect(body).toMatch(/NEW\.grades_checked_at := NULL/)
    expect(code).toMatch(/BEFORE UPDATE ON public\.players\s+FOR EACH ROW EXECUTE FUNCTION public\.reset_grades_watermark\(\)/)
  })
})

describe('the audit panel says what actually happened', () => {
  const panel = readFileSync('components/GradeReleasePanel.tsx', 'utf8')

  it('promises the player will be told only when the notice was logged', () => {
    expect(panel).toMatch(/out\.logged \? 'They will be told\.' : 'Their notice could not be recorded/)
  })

  it('disarms an armed delete on its own, and clears the timer', () => {
    expect(panel).toMatch(/const t = setTimeout\(\(\) => setConfirmDelete\(null\), \d+\)/)
    expect(panel).toMatch(/return \(\) => clearTimeout\(t\)/)
  })

  it('reports a catch-up recheck that failed, instead of reading it as "nothing due"', () => {
    expect(panel).toMatch(/setCatchUpFailed\(results\.filter\(x => !x\.ok\)\.length\)/)
    expect(panel).toMatch(/Could not check colours for/)
  })

  it('keeps that notice apart from action errors, and Refresh clears it', () => {
    // On `error` it was overwritten by the next action and never cleared.
    expect(panel).not.toMatch(/setError\(`Could not check colours/)
    expect(panel).toMatch(/const reloadAll = \(\) => \{[^}]*setCatchUpFailed\(0\)/)
  })
})

describe('found by the adversarial review', () => {
  it('the probe sees a game that closed after a recheck read it as in progress', () => {
    // ended_at is started_at + 100 minutes, earlier than that recheck's
    // watermark; points_awarded_at is stamped NOW() when the close runs.
    const body = code.match(/FUNCTION public\.grades_need_recheck\(p_player_id uuid\)([\s\S]*?)\$\$;/)![1]
    expect(body).toMatch(/s\.points_awarded_at > v_since/)
  })

  it('the replay skips an inactive profile, as the live route does', () => {
    const script = readFileSync('scripts/replay-colours.ts', 'utf8')
    expect(script).toMatch(/if \(inputs\.profile\.is_active === false\)/)
  })

  it('a failed re-judge after a deletion stays retryable', () => {
    // The score is already gone and Refresh never withdraws.
    const panel = readFileSync('components/GradeReleasePanel.tsx', 'utf8')
    expect(panel).toMatch(/setPendingRejudge\(failed \? \{ player, domain, reason \} : null\)/)
    expect(panel).toMatch(/Re-check now/)
    expect(panel).not.toMatch(/could not be re-checked\. Press Refresh/)
  })

  it('is_guest, which gates conferral, is pinned by the older guard', () => {
    const guard = readFileSync(`${dir}/20260813000000_role_escalation_guard.sql`, 'utf8')
    expect(guard).toMatch(/IF NEW\.is_guest IS DISTINCT FROM OLD\.is_guest THEN\s+RAISE EXCEPTION/)
  })

  it('the switch-on steps put the Vercel key AFTER the replay', () => {
    // The route confers the moment Vercel has the key, and the replay skips
    // anyone who already holds a colour.
    const doc = readFileSync('CLAUDE.md', 'utf8')
    const applyStep = doc.indexOf('2. `scripts/replay-colours.ts --apply`')
    const vercelStep = doc.indexOf('3. Key added to Vercel')
    expect(applyStep).toBeGreaterThan(-1)
    expect(vercelStep).toBeGreaterThan(applyStep)
  })
})
