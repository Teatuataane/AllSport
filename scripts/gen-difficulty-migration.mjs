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
// The PRE-REVIEW ladders, from a PINNED ref rather than HEAD. This matters: once
// the rebuild merged, HEAD carried the NEW modes, so reading HEAD made every
// event look unchanged and the gained-ladder map came out EMPTY — silently, with
// the migration still generating cleanly. f05b8b1 is the commit immediately
// before `feat(events): rebuild every difficulty ladder`, i.e. the last state in
// which production's scores and lib/eventData.ts agreed.
const PRE_REVIEW_REF = process.env.PRE_REVIEW_REF ?? 'f05b8b1'
const oldSrc = execFileSync('git', ['show', `${PRE_REVIEW_REF}:lib/eventData.ts`], { encoding: 'utf8', maxBuffer: 1 << 24 })
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
  // ── From the PRE-REVIEW ladders (git show f05b8b1:lib/eventData.ts) ────────
  // Every rung name that existed before the review and is absent after it, one
  // decision each. Derived from a diff of the two ladders, not from a snapshot
  // of production: a snapshot only sees labels someone happened to have scored
  // on, so a row written between the snapshot and the apply would be deleted.
  ['Human Flag', 'Partial Flag', 'Assisted Flag'],
  ['Iron Cross', 'Assisted · 2 Feet', '2 Feet Top Hold'],
  ['Chin Hang', 'Assisted · 2 Feet', 'Feet Assisted'],
  ['Chin Hang', 'Assisted · 1 Foot', 'Feet Assisted'],
  ['Chin Hang', 'Two-Hand Hang', 'Two-Hand Chin Hang'],
  ['Chin Hang', 'One-Hand Hang', 'One-Hand Chin Hang'],
  ['Chin Hang', 'Band-Assisted', 'Banded Hands-Free'],
  ['Chin Hang', 'Hands-Free', 'Chin Hang'],
  ['Climbing', 'Assisted Rope Climb', 'Feet Assisted Climb'],
  ['Climbing', 'Pegboard · Feet OK', 'Assisted Pegboard'],
  ['Climbing', 'Pegboard · No Feet', 'Pegboard Climb'],
  ['Headstand', 'Wall · No Hands', 'Wall Assisted'],
  ['L-Sit Hold', 'Support · Feet Down', '2 Feet Assisted Tuck'],
  ['L-Sit Hold', 'Support · One Foot', '1 Foot Assisted Tuck'],
  ['L-Sit Hold', 'Tucked L-Sit', '1 Leg L-Sit'],
  ['L-Sit Hold', 'Full L-Sit', 'L-Sit'],
  ['Chinup Contest', 'Ring Row', 'High Ring Row'],
  ['Lunges', 'Elevated', 'Elevated Lunge'],
  ['Lunges', 'Floor', 'Lunge'],
  ['Lunges', 'Jumping', 'Jumping Switch Lunges'],
  ['Standing Split', 'Lift · Ankle Height', 'Ankle Height'],
  ['Standing Split', 'Lift · Knee Height', 'Knee Height'],
  ['Standing Split', 'Lift · Hip Height', 'Hip Height'],
  ['Standing Split', 'Hip · Knee Locked', 'Hip Height'],
  ['Standing Split', 'Above Hip · Assisted', 'Rib Height'],
  ['Standing Split', 'Above Hip · Free', 'Rib Height'],
  ['Standing Split', 'Head · Assisted', 'Head Height'],
  ['Standing Split', 'Head · Free', 'Head Height'],
  ['Foot Juggling', 'No Bounce', '0 Bounce'],

  // ── From production, labels older than the pre-review ladders ─────────────
  // Rows still carrying a name from an even earlier revision. Found by diffing
  // the stored difficulty_tier values against the new ladders.
  ['Ab Rollout', 'Kneeling Ab Rollout', 'Kneeling Rollout'],
  ['Ab Rollout', 'Elevated Kneeling Ab Rollout', 'Elevated Kneeling'],
  ['Balance Ball', '1 Leg Standing (no hands)', '1 Leg · No Hands'],
  ['Balance Ball', 'Kneeling (no hands)', 'Kneeling · No Hands'],
  ['Chin Hang', 'Assisted Chin Hang (1 Foot)', 'Feet Assisted'],
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
]

// Deliberately NOT mapped. Each is a rung whose MOVEMENT changed, not its label,
// and crediting a score across one would record a lift nobody did — the rule that
// kept OHP off Clean & Press and Toe Squat off Lunges.
//   Pause Dips / Pause Chinup 'Assisted · 1 Foot'  -> replaced by top holds and
//     negatives, which are different movements.
//   Back Lever 'Straddle Back Lever'               -> replaced by 'Banded'.
//   Iron Cross 'Assisted · 1 Foot', 'Partial Iron Cross'
//   Front Lever '1 Leg Front Lever'
//   L-Sit Hold 'Half L-Sit'                        -> no equivalent rung.
//   Pancake 'Hands to Floor'                       -> the standard became elbows,
//     which is HARDER; mapping it would promote the score.
//   Needle Pose (all six)                          -> the ladder changed family,
//     from leg lifts and scales to quad stretches.
//   Windshield Wipers 'Hanging Wiper Circles'      -> split in two, and Tāne's
//     answer was to remove the scores that conflict rather than pick one.
//   Scooting (all five)                            -> the distances no longer
//     overlap: the old ladder topped out at 200m, the new one starts at 250m.
//   Jump Rope 'Crossover Doubles', Gymnastics 'Back Handspring', Juggling
//     '4 Ball'                                     -> rungs that left the ladder.
//   Handstand walk rungs, Weighted Carry 'x0.25 BW', Duck Walk (event replaced).

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
if (!gained.length) {
  throw new Error(
    `No events resolved as gaining a ladder. PRE_REVIEW_REF (${PRE_REVIEW_REF}) probably ` +
    `already contains the new modes, which makes every event look unchanged. ` +
    `This is the failure that produced an empty repair map once already.`)
}
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
    // Rebuilt, not patched: these rows have no D-prefix to replace.
    `    score_label = 'D' || (g.new_idx + 1) || ' ' || g.rung || ' · ' ||\n` +
    `      COALESCE(NULLIF(r.score_label, ''), '')`,
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
    L.push(`    WITH best AS (`)
    L.push(`      -- One row per PLAYER before ranking. Counting rows would let a`)
    L.push(`      -- player's own extra rounds sit in the field beside them, which`)
    L.push(`      -- is the defect 20260828204652 fixed in compute_event_placements.`)
    L.push(`      SELECT DISTINCT ON (rr.event_id, COALESCE(rr.player_id::text, rr.player_name))`)
    L.push(`             rr.id, rr.event_id, ABS(rr.raw_score) AS strokes`)
    L.push(`      FROM results rr JOIN session_events sse ON sse.id = rr.event_id`)
    L.push(`      JOIN gained gg ON gg.event_name = sse.event_name AND gg.old_mode = ${q(mode)}`)
    L.push(`      WHERE rr.difficulty_tier IS NULL AND rr.raw_score IS NOT NULL`)
    L.push(`      ORDER BY rr.event_id, COALESCE(rr.player_id::text, rr.player_name), ABS(rr.raw_score), rr.id`)
    L.push(`    )`)
    L.push(`    SELECT b.id,`)
    L.push(`      CASE WHEN COUNT(*) OVER (PARTITION BY b.event_id) = 1 THEN 0`)
    L.push(`           WHEN RANK() OVER (PARTITION BY b.event_id ORDER BY b.strokes) > 1 THEN 0`)
    L.push(`           WHEN COUNT(*) OVER (PARTITION BY b.event_id, b.strokes) > 1 THEN 1`)
    L.push(`           ELSE 2 END AS term`)
    L.push(`    FROM best b`)
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
