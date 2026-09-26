// ─── Refresh the leaderboard's numbers (backfill) ───────────────────────────
// Writes every player's domain colours and this season's points (player_domain_colours,
// player_season_points) through lib/leaderboardScores.ts — the same engine the
// recheck route uses. The route keeps them current afterwards; this is for the
// first fill, and for any time the scoring rule changes.
//
// DRY RUN BY DEFAULT. It prints what it would write and touches nothing:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/refresh-leaderboard-scores.ts
//
// Then, to write:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/refresh-leaderboard-scores.ts --apply
//
// Add `--year 2026` to score a different season. Needs SUPABASE_SERVICE_ROLE_KEY
// and migration 20260924213359. Safe to re-run: both writes are upserts.

import { createSupabaseAdminClient, hasServiceKey, SERVICE_KEY_ENV } from '../lib/supabase-admin'
import { loadGradeInputs, loadMatches, gradeStateFrom, leaderboardScoresFrom } from '../lib/loadGrades'
import { toNZDateString } from '../lib/dates'

const args = process.argv.slice(2)
const apply = args.includes('--apply')
const year = args.includes('--year')
  ? Number(args[args.indexOf('--year') + 1])
  : Number(toNZDateString(new Date()).slice(0, 4))

if (!hasServiceKey()) {
  console.error(`${SERVICE_KEY_ENV} is not set. Run with --env-file=.env.local, and add the key there first.`)
  process.exit(1)
}

const db = createSupabaseAdminClient()
const { data: people, error } = await db.from('players')
  .select('id, display_name, is_guest, is_active').order('display_name')
if (error) { console.error(error.message); process.exit(1) }
// Guests and erased profiles are never on the board, as the route never scores them.
const players = (people ?? []).filter(p => !p.is_guest && p.is_active !== false)

console.log(`${apply ? 'APPLYING' : 'DRY RUN'} — ${players.length} players, season ${year}\n`)
const matches = await loadMatches(db)
let written = 0, failed = 0

for (const p of players) {
  const inputs = await loadGradeInputs(db, p.id, matches)
  if (!inputs) continue
  if (!inputs.complete) { console.log(`  ${p.display_name}: SKIPPED, a read failed`); failed++; continue }
  const state = gradeStateFrom(p.id, inputs)
  const s = leaderboardScoresFrom(p.id, inputs, state, year)
  console.log(`  ${String(p.display_name).padEnd(20)} [${s.domainRungs.join(' ')}]  season ${String(s.points).padStart(4)} pts / ${s.games} games`)
  if (!apply) continue
  const now = new Date().toISOString()
  const [a, b] = await Promise.all([
    db.from('player_domain_colours').upsert(
      { player_id: p.id, domain_rungs: s.domainRungs, updated_at: now }, { onConflict: 'player_id' }),
    db.from('player_season_points').upsert(
      { player_id: p.id, season_year: year, points: s.points, games: s.games, updated_at: now }, { onConflict: 'player_id,season_year' }),
  ])
  if (a.error || b.error) { console.error(`    write failed: ${(a.error ?? b.error)!.message}`); failed++ } else written++
}

console.log(`\n${apply ? `${written} written, ${failed} failed` : 'Nothing written. Re-run with --apply.'}`)
