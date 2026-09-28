// ─── Refresh the leaderboard's numbers (backfill) ───────────────────────────
// Writes every player's domain colours and their colour total in every finished
// game (player_domain_colours, player_game_colours) through lib/leaderboardScores.ts
// and lib/leaderboardData.ts, the same engine and the same write the recheck
// route uses. The season_points view ranks each game on those totals (100 for
// 1st, 99 for 2nd …); this prints the result. The route keeps the per-game
// totals current afterwards; this is for the first fill, and for any time the
// scoring rule changes.
//
// DRY RUN BY DEFAULT. It prints what it would write and touches nothing:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/refresh-leaderboard-scores.ts
//
// Then, to write:
//
//   node --env-file=.env.local --import ./scripts/ts-loader.mjs scripts/refresh-leaderboard-scores.ts --apply
//
// Add `--year 2026` to print a different season. Needs SUPABASE_SERVICE_ROLE_KEY
// and migration 20260928011813. Safe to re-run: the writes are upserts, and a
// game a player no longer has a result in is removed, as the route does.

import { createSupabaseAdminClient, hasServiceKey, SERVICE_KEY_ENV } from '../lib/supabase-admin'
import { loadGradeInputs, loadMatches, gradeStateFrom, leaderboardScoresFrom } from '../lib/loadGrades'
import { toNZDateString } from '../lib/dates'
import { seasonPointsFromGames, type GameTotalRow } from '../lib/leaderboardScores'
import { publishLeaderboardScores } from '../lib/leaderboardData'

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
const names = new Map(players.map(p => [p.id, String(p.display_name)]))
// Every player's game totals for the season, ranked below exactly as the view ranks them.
const seasonTotals: GameTotalRow[] = []

for (const p of players) {
  // Taken before the read, as the route does: only rows older than it may be deleted.
  const readFrom = new Date().toISOString()
  const inputs = await loadGradeInputs(db, p.id, matches)
  if (!inputs) continue
  if (!inputs.complete) { console.log(`  ${p.display_name}: SKIPPED, a read failed`); failed++; continue }
  const state = gradeStateFrom(p.id, inputs)
  const s = leaderboardScoresFrom(p.id, inputs, state)
  const season = s.games.filter(g => g.session_date.startsWith(`${year}-`))
  for (const g of season) seasonTotals.push({ player_id: p.id, session_id: g.session_id, total: g.total })
  console.log(`  ${String(p.display_name).padEnd(20)} [${s.domainRungs.join(' ')}]  ${season.length} games in ${year}, colour totals ${season.map(g => g.total).join(' ')}`)
  if (!apply) continue
  const { error: err } = await publishLeaderboardScores(db, p.id, s, readFrom)
  if (err) { console.error(`    write failed: ${err}`); failed++ } else written++
}

// Only finished, unvoided games reach these totals, the same games the view counts.
const board = [...seasonPointsFromGames(seasonTotals)].sort((x, y) => y[1].points - x[1].points)
console.log(`\nSeason ${year}, by place in each game:`)
for (const [id, s] of board) console.log(`  ${(names.get(id) ?? id).padEnd(20)} ${String(s.points).padStart(5)} pts / ${s.games} games`)

console.log(`\n${apply ? `${written} written, ${failed} failed` : 'Nothing written. Re-run with --apply.'}`)
