#!/usr/bin/env node
// Generates the body of the difficulty-levels migration from lib/eventData.ts.
// The 120-row event_domains seed and the per-event tier mappings are GENERATED,
// never typed: CLAUDE.md requires the roster mirror to be re-seeded in full by
// whichever migration changes the roster, and a hand-typed seed drifts.
//
//   node scripts/gen-difficulty-migration.mjs > /tmp/body.sql

import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const src = fs.readFileSync('lib/eventData.ts', 'utf8')
// The PREVIOUS ladders, read from git rather than remembered — the working copy
// has already been rewritten, and CLAUDE.md's rename rule is explicit that old
// names must come from git history.
const oldSrc = execFileSync('git', ['show', 'HEAD:lib/eventData.ts'], { encoding: 'utf8', maxBuffer: 1 << 24 })
const oldMode = new Map()
for (const b of oldSrc.split(/\n  \{\n/).slice(1)) {
  const nm = b.match(/\n    name: '((?:[^'\\\\]|\\\\.)*)'/)
  const md = b.match(/inputMode: '([^']+)'/)
  if (nm && md) oldMode.set(nm[1].replace(/\\'/g, "'"), md[1])
}
const timed = new Set([...src.match(/TIMED_EFFORT_SLUGS = new Set<string>\(\[([\s\S]*?)\]\)/)[1]
  .matchAll(/'([^']+)'/g)].map(m => m[1]))

const events = []
for (const b of src.split(/\n  \{\n/).slice(1)) {
  const slug = (b.match(/slug: '([^']+)'/) || [])[1]
  if (!slug) continue
  const nm = b.match(/\n    name: '((?:[^'\\]|\\.)*)'/)
  events.push({
    slug,
    name: (nm ? nm[1] : slug).replace(/\\'/g, "'"),
    domainNumber: +(b.match(/domainNumber: (\d+)/) || [])[1],
    domain: (b.match(/domain: '([^']+)'/) || [])[1],
    mode: (b.match(/inputMode: '([^']+)'/) || [])[1],
    tiers: [...b.matchAll(/level: (\d+), name: '((?:[^'\\]|\\.)*)'(?:[^}]*?scoring: '(\w+)')?/g)]
      .map(m => ({ level: +m[1], name: m[2].replace(/\\'/g, "'"), scoring: m[3] || null })),
  })
}
const q = v => `'${String(v).replace(/'/g, "''")}'`

// ── Rung renames ─────────────────────────────────────────────────────────────
// Labels stored in production that are the SAME movement under a new name.
// CLAUDE.md's rule for this exact case is a repoint, not a delete (20260801000000
// repointed 24 event names for the same reason). Derived by diffing the stored
// labels against the new ladders, then judged one by one — a label is only here
// when the movement is unambiguous.
//
// Deliberately NOT mapped, because the movement changed rather than the label:
//   Handstand "Handstand Walk (unbroken)" / "Wall Handstand Walk" — the ladder
//     went from walking to holding; crediting a walk to a hold is the OHP rule.
//   Windshield Wipers "Hanging Wiper Circles" — split into two rungs, and Tāne's
//     answer was to remove the scores that conflict rather than pick one.
//   Jump Rope "Crossover Double Under" — a different skill from Double Under.
//   Needle Pose — the whole ladder changed family (leg lifts -> quad stretches).
//   Weighted Carry "x0.25 BW" — a bodyweight multiple cannot become a fixed kg.
//   Pause Dips "Assisted Dips (1 Foot)" — that rung left the ladder.
const RUNG_RENAMES = [
  ['Ab Rollout', 'Kneeling Ab Rollout', 'Kneeling Rollout'],
  ['Ab Rollout', 'Elevated Kneeling Ab Rollout', 'Elevated Kneeling'],
  ['Balance Ball', '1 Leg Standing (no hands)', '1 Leg · No Hands'],
  ['Balance Ball', 'Kneeling (no hands)', 'Kneeling · No Hands'],
  ['Chin Hang', 'Two-Hand Hang', 'Two-Hand Chin Hang'],
  ['Chin Hang', 'Assisted Chin Hang (1 Foot)', 'Feet Assisted'],
  ['Climbing', 'Assisted Rope Climb', 'Feet Assisted Climb'],
  ['Forward Fold', 'Standing Forward Fold (knees bent)', 'Standing · Bent Knees'],
  ['Forward Fold', 'Standing Forward Fold (finger-tips to floor)', 'Fingertips to Floor'],
  ['Forward Split', 'Assisted Front Split (1 Block)', '1 Block'],
  ['Forward Split', 'Assisted Front Split (1.5 Blocks)', '1.5 Blocks'],
  ['Forward Split', 'Front Split (1.5 Blocks)', '1.5 Blocks'],
  ['Headstand', 'Wall Headstand (No hands, wall support)', 'Wall Assisted'],
  ['Headstand', 'Wall Headstand', 'Wall Assisted'],
  ['Headstand', 'Freestanding Headstand', 'Freestanding'],
  ['Iron Cross', 'Ring Top Position Hold', 'Ring Top Hold'],
  ['L-Sit Hold', 'Tuck Hold (both knees to chest)', 'Tuck Hold'],
  ['L-Sit Hold', 'Full L Sit', 'L-Sit'],
  ['L-Sit Hold', 'Full L-Sit (legs fully horizontal, Knees locked)', 'L-Sit'],
  ['Middle Split', 'Assisted Middle Split (1.5 Blocks)', '1.5 Blocks'],
  ['Middle Split', 'Assisted Middle Split (2 Blocks)', '2 Blocks'],
  ['Pancake', 'Elevated Pancake (More than 2 blocks)', 'Over 2 Blocks'],
  ['Pancake', 'Elevated Pancake (1.5 blocks)', '1.5 Blocks'],
  ['Pancake', 'Elevated Pancake (2 blocks)', '2 Blocks'],
  ['Planche', 'Elevated Pseudo Planche Lean', 'Elevated Pseudo Lean'],
  ['Rear Hand Clasp', 'Towel-Assisted (hands hold opposite ends of towel)', 'Towel-Assisted'],
  ['Standing Split', 'Standing Split (Hip height, knee locked)', 'Hip Height'],
  ['Standing Split', 'Standing Leg Lift (Hip height)', 'Hip Height'],
  ['Standing Split', 'Lift · Hip Height', 'Hip Height'],
  ['Standing Split', 'Hip · Knee Locked', 'Hip Height'],
  ['Standing Split', 'Above Hip · Assisted', 'Rib Height'],
]

// ── Events GAINING a ladder ──────────────────────────────────────────────────
// 477 rows sit on events that had no ladder and now have one. They carry
// difficulty_tier NULL and a raw_score on the abandoned scale, so nothing keyed
// on difficulty_tier can see them — a Tennis win (raw 2) would decode as D1 with
// 2 reps, and 44 rows with a NEGATIVE raw_score would decode as tier -1.
// `old_mode` says how to read the old raw_score; `rung` names where it lands.
const GAINED_LADDER = {
  // Win/draw/loss keeps its result exactly, on the Game rung.
  sport:  { term: 'GREATEST(LEAST(r.raw_score, 2), 0)', guard: 'AND r.raw_score BETWEEN 0 AND 2', rung: 'GAME', extra: "result_type = COALESCE(r.result_type, CASE r.raw_score WHEN 2 THEN 'win' WHEN 1 THEN 'draw' ELSE 'loss' END)" },
  // A round of golf IS the game rung, but no opponent result was ever recorded,
  // so the term is 0 (a loss) rather than an invented win. The stroke count is
  // preserved in match_score, which is what the Game rung's `records: strokes`
  // reads. Deliberately does not fabricate a result.
  score:  { term: 'g.term', rung: 'GAME', keepStrokes: true, ranked: true },
  // raw = -(secs*100 + cs) -> seconds, then the timed-effort inversion.
  sprint: { term: '10000 - GREATEST(LEAST(ABS(r.raw_score) / 100.0, 9999), 0.01)', rung: 'Timed', extra: 'time_seconds = COALESCE(r.time_seconds, ABS(r.raw_score) / 100.0)' },
  // raw = metres * 100 -> tenths of a metre. Lands on the real implement (the
  // top rung): every historical throw was taken with the competition implement.
  distance: { term: 'LEAST(ROUND(ABS(r.raw_score) / 10.0), 9999)', rung: 'TOP', extra: 'distance_m = COALESCE(r.distance_m, ABS(r.raw_score) / 100.0)' },
  // Slackline: raw = seconds, and the walk is what was being timed.
  hold:   { term: 'GREATEST(LEAST(ROUND(ABS(r.raw_score)), 9999), 1)', rung: 'Slackline Walk', extra: 'time_seconds = COALESCE(r.time_seconds, ABS(r.raw_score))' },
}


const L = []
L.push(`-- event_domains: the roster mirrored into SQL, ${events.length} rows.`)
L.push(`-- Generated from lib/eventData.ts by scripts/gen-difficulty-migration.mjs.`)
L.push(`-- THIS FILE IS NOW THE DEFINITION of the mirror (the newest file carrying`)
L.push(`-- the seed), which is what __tests__/taniwha.test.ts reads.`)
L.push(`DELETE FROM event_domains;`)
// Column list and ordering match the previous seed exactly: the table has three
// columns, and __tests__/taniwha.test.ts finds the newest file by the unqualified
// `INSERT INTO event_domains` and parses `  ('name', N, 'slug')`.
L.push(`INSERT INTO event_domains (event_name, domain_number, slug) VALUES`)
const sorted = [...events].sort((a, b) => a.domainNumber - b.domainNumber || a.name.localeCompare(b.name))
L.push(sorted.map(e => `  (${q(e.name)}, ${e.domainNumber}, ${q(e.slug)})`).join(',\n') + ';')
L.push('')

// Every (event_name, tier_name) that survives, with its NEW 0-based index and
// how its within-tier term must be rebuilt.
L.push(`-- Surviving (event, level) pairs with their new 0-based index.`)
// new_idx leads deliberately. __tests__/taniwha.test.ts finds the newest file
// carrying an `INSERT INTO event_domains` and then parses every `  ('x', N, 'y')`
// line in it; a tier_map row starting with two quoted strings matches that shape
// and would be read as a bogus roster entry. Leading with the integer makes the
// two impossible to confuse without making whitespace load-bearing.
L.push(`CREATE TEMP TABLE tier_map (`)
L.push(`  new_idx int, event_name text, tier_name text, mode text,`)
L.push(`  faster_wins boolean, scoring text`)
L.push(`) ON COMMIT DROP;`)
const rows = []
for (const e of events) {
  for (const t of e.tiers) {
    rows.push(`  (${t.level - 1}, ${q(e.name)}, ${q(t.name)}, ${q(e.mode)}, ` +
              `${timed.has(e.slug)}, ${t.scoring ? q(t.scoring) : 'NULL'})`)
  }
}
L.push(`INSERT INTO tier_map VALUES\n${rows.join(',\n')};`)
L.push('')
L.push(`-- Pre-image FIRST, before anything below rewrites a row. Captured here and`)
L.push(`-- not later: the repair passes overwrite raw_score and difficulty_tier in`)
L.push(`-- place, so a snapshot taken after them is not a pre-image at all. Covers`)
L.push(`-- every row any later statement can touch — those already carrying a level,`)
L.push(`-- and those on an event that is gaining one.`)
L.push(`CREATE TABLE public.results_difficulty_preimage_20260908 AS`)
L.push(`SELECT r.id, r.raw_score, r.difficulty_tier, r.score_label, r.result_type,`)
L.push(`       r.time_seconds, r.distance_m, se.event_name, now() AS captured_at`)
L.push(`FROM results r`)
L.push(`JOIN session_events se ON se.id = r.event_id`)
L.push(`WHERE EXISTS (SELECT 1 FROM tier_map m WHERE m.event_name = se.event_name)`)
L.push(`   OR r.difficulty_tier IS NOT NULL;`)
L.push(`ALTER TABLE public.results_difficulty_preimage_20260908 ENABLE ROW LEVEL SECURITY;`)
L.push(`REVOKE ALL ON public.results_difficulty_preimage_20260908 FROM anon, authenticated;`)
// ── Emit the two repair maps ─────────────────────────────────────────────────
L.push('')
L.push(`-- Rung renames: same movement, new label. Applied BEFORE anything keys on`)
L.push(`-- difficulty_tier, so a renamed rung's history survives instead of being`)
L.push(`-- archived as an orphan.`)
L.push(`CREATE TEMP TABLE rung_rename (event_name text, old_name text, new_name text) ON COMMIT DROP;`)
L.push(`INSERT INTO rung_rename VALUES\n` +
  RUNG_RENAMES.map(([e, o, n]) => `  (${q(e)}, ${q(o)}, ${q(n)})`).join(',\n') + ';')
L.push(`UPDATE results r SET difficulty_tier = m.new_name`)
L.push(`FROM session_events se, rung_rename m`)
L.push(`WHERE se.id = r.event_id AND se.event_name = m.event_name`)
L.push(`  AND r.difficulty_tier = m.old_name;`)
L.push('')

// Events that gained a ladder, with the rung their history lands on.
const gained = []
for (const e of events) {
  if (!e.tiers.length) continue
  const prev = oldMode.get(e.name)
  const rule = prev ? GAINED_LADDER[prev] : null
  if (!rule) continue
  let idx
  if (rule.rung === 'GAME') idx = e.tiers.findIndex(t => t.scoring === 'sport')
  else if (rule.rung === 'TOP') idx = e.tiers.length - 1
  else idx = e.tiers.findIndex(t => t.name === rule.rung)
  if (idx < 0) throw new Error(`${e.name}: cannot resolve target rung ${rule.rung}`)
  gained.push({ name: e.name, idx, prev, rung: e.tiers[idx].name })
}
L.push(`-- Events that gained a ladder. Their rows carry difficulty_tier NULL and a`)
L.push(`-- raw_score on the abandoned scale, so they are invisible to anything keyed`)
L.push(`-- on difficulty_tier. Each lands on a named rung with its real value kept.`)
L.push(`-- new_idx leads for the same reason tier_map's does: see the note there.`)
L.push(`CREATE TEMP TABLE gained (new_idx int, event_name text, rung text, old_mode text) ON COMMIT DROP;`)
L.push(`INSERT INTO gained VALUES\n` +
  gained.map(g => `  (${g.idx}, ${q(g.name)}, ${q(g.rung)}, ${q(g.prev)})`).join(',\n') + ';')
L.push('')
L.push(`-- Every row repaired here is recorded so the doomed sweep and the re-encode`)
L.push(`-- below cannot touch it a second time: it already carries a final score.`)
L.push(`CREATE TEMP TABLE gained_ids (id uuid PRIMARY KEY) ON COMMIT DROP;`)
for (const [mode, rule] of Object.entries(GAINED_LADDER)) {
  const hit = gained.filter(g => g.prev === mode)
  if (!hit.length) continue
  const sets = [
    `    difficulty_tier = g.rung`,
    `    raw_score = g.new_idx * 10000 + (${rule.ranked ? 'g2.term' : rule.term})`,
  ]
  if (rule.extra) sets.push(`    ${rule.extra}`)
  if (rule.keepStrokes) {
    sets.push(`    match_score = COALESCE(r.match_score, ABS(r.raw_score)::text || ' strokes')`)
    sets.push(`    result_type = COALESCE(r.result_type, CASE g2.term WHEN 2 THEN 'win' WHEN 1 THEN 'draw' ELSE 'loss' END)`)
  }
  L.push('')
  L.push(`-- was \`${mode}\`: ${hit.map(g => g.name).join(', ')}`)
  L.push(`WITH upd AS (`)
  L.push(`  UPDATE results r SET`)
  L.push(sets.join(',\n'))
  if (rule.ranked) {
    // Fewest strokes in that session's field takes the win; a shared best is a
    // draw; a solo round beat nobody. Derived from the strokes really shot.
    L.push(`  FROM session_events se, gained g, (`)
    L.push(`    SELECT rr.id,`)
    L.push(`      CASE WHEN COUNT(*) OVER (PARTITION BY rr.event_id) = 1 THEN 0`)
    L.push(`           WHEN RANK() OVER (PARTITION BY rr.event_id ORDER BY ABS(rr.raw_score)) > 1 THEN 0`)
    L.push(`           WHEN COUNT(*) OVER (PARTITION BY rr.event_id, ABS(rr.raw_score)) > 1 THEN 1`)
    L.push(`           ELSE 2 END AS term`)
    L.push(`    FROM results rr JOIN session_events sse ON sse.id = rr.event_id`)
    L.push(`    JOIN gained gg ON gg.event_name = sse.event_name AND gg.old_mode = ${q(mode)}`)
    L.push(`    WHERE rr.difficulty_tier IS NULL AND rr.raw_score IS NOT NULL`)
    L.push(`  ) g2`)
    L.push(`  WHERE se.id = r.event_id AND se.event_name = g.event_name AND g2.id = r.id`)
  } else {
    L.push(`  FROM session_events se, gained g`)
    L.push(`  WHERE se.id = r.event_id AND se.event_name = g.event_name`)
  }
  L.push(`    AND g.old_mode = ${q(mode)} AND r.difficulty_tier IS NULL`)
  L.push(`    AND r.raw_score IS NOT NULL ${rule.guard ?? ''}`)
  L.push(`  RETURNING r.id`)
  L.push(`)`)
  L.push(`INSERT INTO gained_ids SELECT id FROM upd ON CONFLICT DO NOTHING;`)
}
console.log(L.join('\n'))
