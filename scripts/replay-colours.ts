// ─── Replay colour history (one-off) ─────────────────────────────────────────
// Step 6 of docs/designs/auto-conferral-spec.md. Confers every colour each
// player has earned, dated when it would have landed had auto-conferral always
// run. The walk itself is lib/replayColours.ts, which computes through the same
// engine the live route uses; this file only reads and writes.
//
// DRY RUN BY DEFAULT. It prints what it would confer and touches nothing:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/replay-colours.ts
//
// Then, once the output has been read and agreed:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/replay-colours.ts --apply
//
// One player only: add `--player <uuid>`.
//
// Needs SUPABASE_SERVICE_ROLE_KEY: a backfill reads every player, which no
// login can. Needs migrations 20260921232726 (band of the day) and
// 20260921232728 (server-conferred awards) applied first — without the second,
// `--apply` fails on conferred_by being NOT NULL, and says so.
//
// SAFE TO RE-RUN. A player who already holds any colour is SKIPPED, not merged:
// mixing replayed dates with live conferrals would corrupt the units clock,
// which counts from the latest one. Inserts ignore duplicates as well.

import { createSupabaseAdminClient, hasServiceKey, SERVICE_KEY_ENV } from '../lib/supabase-admin'
import { loadGradeInputs, loadMatches } from '../lib/loadGrades'
import { replayAwards } from '../lib/replayColours'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const only = args.includes('--player') ? args[args.indexOf('--player') + 1] : null

if (!hasServiceKey()) {
  console.error(`${SERVICE_KEY_ENV} is not set. Run with --env-file=.env.local, and add the key there first.`)
  process.exit(1)
}

const db = createSupabaseAdminClient()
const now = new Date().toISOString()
const DOMAINS = ['Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Anaerobic Endurance',
  'Aerobic Endurance', 'Flexibility', 'Body Awareness', 'Coordination', 'Aim & Precision']
const day = (iso: string) => new Date(iso).toLocaleDateString('en-NZ', { timeZone: 'Pacific/Auckland', day: 'numeric', month: 'short', year: 'numeric' })

const { data: people, error } = await db.from('players')
  .select('id, display_name, is_guest').order('display_name')
if (error) { console.error(error.message); process.exit(1) }
const players = (people ?? []).filter(p => !p.is_guest && (!only || p.id === only))

console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${players.length} player${players.length === 1 ? '' : 's'}, as of ${day(now)}`)
console.log('Ages are today\'s ages throughout; see lib/replayColours.ts.\n')

const matches = await loadMatches(db)
let total = 0, conferredFor = 0, skipped = 0

for (const p of players) {
  const inputs = await loadGradeInputs(db, p.id, matches)
  if (!inputs) continue
  if (!inputs.schemaReady) {
    console.error('The grading schema is not live (grade_awards unreadable). Nothing to replay onto.')
    process.exit(1)
  }
  // The live route refuses these, so the replay must too: an erased profile has
  // a null date of birth, and a junior with no age grades as U14, a colour easier
  // than U16. Reactivate a player first, then re-run with --player.
  if (inputs.profile.is_active === false) {
    console.log(`  ${p.display_name}: SKIPPED, inactive`)
    skipped++
    continue
  }
  if (inputs.awards.length > 0) {
    console.log(`  ${p.display_name}: SKIPPED, already holds ${inputs.awards.length} colour${inputs.awards.length === 1 ? '' : 's'}`)
    skipped++
    continue
  }

  const planned = replayAwards(p.id, inputs, now)
  if (planned.length === 0) continue
  conferredFor++
  total += planned.length
  console.log(`  ${p.display_name}: ${planned.length}`)
  for (const a of planned) {
    console.log(`      ${day(a.conferred_at).padEnd(12)} ${a.grade_name.padEnd(10)} ${DOMAINS[a.domain_number - 1]}`)
  }

  if (apply) {
    const { error: e } = await db.from('grade_awards')
      .upsert(planned, { onConflict: 'player_id,domain_number,rung', ignoreDuplicates: true })
    if (e) {
      console.error(`\n  Failed for ${p.display_name}: ${e.message}`)
      if (/conferred_by/.test(e.message)) console.error('  Apply migration 20260921232728 first: it lets the server confer.')
      process.exit(1)
    }
    // The next recheck then has nothing new to find, and stays cheap.
    await db.from('players').update({ grades_checked_at: now }).eq('id', p.id)
  }
}

console.log(`\n${total} colour${total === 1 ? '' : 's'} for ${conferredFor} player${conferredFor === 1 ? '' : 's'}${skipped ? `, ${skipped} skipped` : ''}.`)
if (!apply && total > 0) console.log('Nothing was written. Re-run with --apply once this has been read.')
