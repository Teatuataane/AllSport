// ─── Take back colours conferred in the 5–6 Oct 2026 deploy gap (one-off) ────
// v0.28.0.0 went live on 5 Oct 2026, a day before its migration
// (20261005012108) re-encoded the old distance ladders. In between, the new
// code read an old Running / Cycling / erg row (a 1000m at band 2, raw ~29,700)
// against 1km standards topping out under 10,000, graded it Taniwha, and the
// GRADING_RULES_VERSION bump rechecked everyone who opened the app. Tāne
// reported the result on 9 Oct: Endurance at Uenuku with no score near it.
// lib/playerGrades.ts now refuses such a row (onCurrentLadder), but a conferred
// colour is never taken back by an ordinary recheck, so the ones already held
// stay until this removes them.
//
// For every colour CONFERRED INSIDE THE WINDOW that today's evidence does not
// support (awardsToWithdraw, the rule the kaiwhakawā audit panel uses), it
// deletes the award, logs it to grade_withdrawals (the player is told on HOME),
// and puts back the colour the evidence does give (awardAfterWithdraw). A
// colour conferred outside the window is never touched, so a later standards
// revision demotes nobody, and a colour resting on a removed event is left
// alone and named (protectedAwards).
//
// DRY RUN BY DEFAULT. It prints what it would take back and touches nothing:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/withdraw-gap-colours.ts
//
// Then, once the output has been read and agreed:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/withdraw-gap-colours.ts --apply
//
// Options: `--player <uuid>` for one player; `--from <iso>` / `--to <iso>` to
// move the window (default 5 Oct 00:00 to 7 Oct 00:00 NZDT).
//
// Needs SUPABASE_SERVICE_ROLE_KEY. Safe to re-run: a colour already gone is
// not found again.

import { createSupabaseAdminClient, hasServiceKey, SERVICE_KEY_ENV } from '../lib/supabase-admin'
import { loadGradeState, loadMatches } from '../lib/loadGrades'
import { awardsToWithdraw, awardAfterWithdraw, protectedAwards } from '../lib/autoConfer'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const opt = (name: string) => (args.includes(name) ? args[args.indexOf(name) + 1] : null)
const only = opt('--player')
const from = Date.parse(opt('--from') ?? '2026-10-05T00:00:00+13:00')
const to = Date.parse(opt('--to') ?? '2026-10-07T00:00:00+13:00')
if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) {
  console.error('--from and --to must be ISO times, --from first.')
  process.exit(1)
}

if (!hasServiceKey()) {
  console.error(`${SERVICE_KEY_ENV} is not set. Run with --env-file=.env.local, and add the key there first.`)
  process.exit(1)
}

const db = createSupabaseAdminClient()
const DOMAINS = ['Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Stamina',
  'Endurance', 'Flexibility', 'Body Awareness', 'Coordination', 'Aim & Precision']
const when = (iso: string) => new Date(iso).toLocaleString('en-NZ', { timeZone: 'Pacific/Auckland', dateStyle: 'medium', timeStyle: 'short' })
const inWindow = (iso: string) => { const t = Date.parse(iso); return t >= from && t < to }
const REASON = 'Conferred in error on 5–6 Oct 2026, while old distance scores were read against the new 1km standards.'

const { data: people, error } = await db.from('players')
  .select('id, display_name, is_guest').order('display_name')
if (error) { console.error(error.message); process.exit(1) }
const players = (people ?? []).filter(p => !p.is_guest && (!only || p.id === only))

console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${players.length} player${players.length === 1 ? '' : 's'}, colours conferred ${when(new Date(from).toISOString())} to ${when(new Date(to).toISOString())}\n`)

const matches = await loadMatches(db)
let taken = 0, people_ = 0

for (const p of players) {
  const state = await loadGradeState(db, p.id, matches)
  if (!state) continue
  if (!state.schemaReady) { console.error('The grading schema is not live (grade_awards unreadable).'); process.exit(1) }
  // Never on a partial read: a failed results read looks like no scores at all.
  if (state.complete === false) { console.log(`  ${p.display_name}: SKIPPED, could not read all evidence`); continue }

  let printed = false
  for (let domain = 1; domain <= 10; domain++) {
    const out = awardsToWithdraw(state, domain).filter(a => inWindow(a.conferred_at))
    const kept = protectedAwards(state, domain).filter(a => inWindow(a.conferred_at))
    if (out.length === 0 && kept.length === 0) continue
    if (!printed) { console.log(`  ${p.display_name}`); printed = true }
    const now = state.grades.domains.find(d => d.domainNumber === domain)?.rung ?? 0
    for (const a of out) console.log(`      take back ${a.grade_name.padEnd(10)} ${DOMAINS[domain - 1].padEnd(16)} conferred ${when(a.conferred_at)} (scores now give rung ${now})`)
    for (const a of kept) console.log(`      LEFT      ${a.grade_name.padEnd(10)} ${DOMAINS[domain - 1].padEnd(16)} rests on a removed event: check by hand`)
    if (out.length === 0) continue
    taken += out.length

    const ids = new Set(out.map(a => a.id))
    const back = awardAfterWithdraw(p.id, state, domain, ids)
    if (back) console.log(`      put back  ${back.grade_name.padEnd(10)} ${DOMAINS[domain - 1]}`)

    if (apply) {
      const { data: gone, error: delError } = await db.from('grade_awards').delete().in('id', [...ids]).select('id')
      if (delError) { console.error(`\n  Failed for ${p.display_name}: ${delError.message}`); process.exit(1) }
      const deleted = new Set((gone ?? []).map(r => r.id))
      const logged = out.filter(a => deleted.has(a.id))
      if (logged.length > 0) {
        const { error: logError } = await db.from('grade_withdrawals').insert(logged.map(a => ({
          player_id: p.id, domain_number: a.domain_number, rung: a.rung, grade_name: a.grade_name,
          conferred_at: a.conferred_at, withdrawn_by: null, reason: REASON,
        })))
        if (logError) console.error(`      (not logged, so ${p.display_name} will not be told: ${logError.message})`)
      }
      if (back) {
        const { error: upError } = await db.from('grade_awards')
          .upsert([back], { onConflict: 'player_id,domain_number,rung', ignoreDuplicates: true })
        if (upError) console.error(`      (could not put back ${back.grade_name}: ${upError.message}; the next recheck will)`)
      }
    }
  }
  if (printed) people_++
}

console.log(`\n${taken} colour${taken === 1 ? '' : 's'} to take back from ${people_} player${people_ === 1 ? '' : 's'}.`)
if (!apply && taken > 0) console.log('Nothing was written. Re-run with --apply once this has been read.')
