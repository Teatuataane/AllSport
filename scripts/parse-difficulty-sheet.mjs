#!/usr/bin/env node
// Parses the reviewed EVENT_DIFFICULTY_REVIEW.md into structured JSON, and works
// out each event's resulting inputMode. The sheet is the spec; this is the only
// thing that reads it, so the conversion is repeatable rather than hand-typed.
//
//   node scripts/parse-difficulty-sheet.mjs [--json]
//
// A level line is `- D1: Name   (judge detail)`, detail separated by THREE spaces.
// Split on the spacing, never the first bracket: names legitimately contain
// brackets (`Partner Pass (5m)`, `Game (4 Holes)`).

import fs from 'node:fs'

const SHEET = 'EVENT_DIFFICULTY_REVIEW.md'
const SRC = 'lib/eventData.ts'

export function parseSheet(text) {
  const events = []
  let ev = null
  for (const line of text.split('\n')) {
    const h = line.match(/^### (\d+)\. (.+)$/)
    if (h) { ev = { n: +h[1], name: h[2], tiers: [], none: false }; events.push(ev); continue }
    if (!ev) continue
    if (line.trim() === '**NONE**') { ev.none = true; continue }
    const t = line.match(/^- D(\d+): +(.+?)\s*$/)
    if (!t) continue
    const [rawName, rawDetail] = t[2].split(/ {2,}\(/)
    const name = rawName.trim()
    if (!name) continue
    let detail = rawDetail ? rawDetail.replace(/\)\s*$/, '').trim() : ''
    // "used N times" is a generated marker, not judge criteria.
    detail = detail.split(' · ').filter(p => !/^used \d+ times?$/.test(p)).join(' · ')
    ev.tiers.push({ level: ev.tiers.length + 1, name, detail })
  }
  return events
}

// Current roster, so we can see what each event's mode is today.
const src = fs.readFileSync(SRC, 'utf8')
const current = new Map()
for (const b of src.split(/\n  \{\n/).slice(1)) {
  const slug = (b.match(/slug: '([^']+)'/) || [])[1]
  if (!slug) continue
  const nm = b.match(/\n    name: '((?:[^'\\]|\\.)*)'/)
  current.set(nm ? nm[1] : slug, {
    slug,
    mode: (b.match(/inputMode: '([^']+)'/) || [])[1],
    tiers: [...b.matchAll(/level: (\d+), name: '([^']*)'/g)].map(m => m[2]),
    domainNumber: +(b.match(/domainNumber: (\d+)/) || [])[1],
  })
}

// A handful of events cannot have their mode derived from the old one plus the
// ladder, so they are stated. Each is a deliberate call, not a default.
const MODE_OVERRIDES = {
  // Ladder is Walking / Timed / Game: the first two are times, so this is a
  // timed effort with a Game rung on top, NOT a rep ladder.
  'T-Race': 'difficulty+time',
  // New event replacing Duck Walk. Levels are crawl distances, score is time.
  'Animal Crawl': 'difficulty+time',
}

// Events whose ladder is the implement thrown, while the score stays the distance.
const DISTANCE_LADDERS = new Set(['Javelin', 'Shotput'])

// Decide the resulting inputMode for an event that has a ladder.
function resolveMode(name, tiers, cur) {
  if (MODE_OVERRIDES[name]) return MODE_OVERRIDES[name]
  if (DISTANCE_LADDERS.has(name)) return 'difficulty+distance'
  if (!cur) throw new Error(`${name}: not on the roster and no mode override`)
  switch (cur.mode) {
    case 'difficulty+time':
    case 'difficulty+reps':
      return cur.mode
    // A time-measured event keeps being time-measured; the ladder just grades it.
    case 'hold': case 'time': case 'sprint':
      return 'difficulty+time'
    case 'distance':
      return 'difficulty+distance'
    // Drill rungs are counted (passes, hits, putts landed); the Game rung carries
    // its own win/draw/loss scoring via the tier's `scoring` field.
    case 'sport': case 'score': case 'reps': case 'strength':
      return 'difficulty+reps'
    default:
      throw new Error(`${name}: no rule for mode ${cur.mode}`)
  }
}

const sheet = parseSheet(fs.readFileSync(SHEET, 'utf8'))
const out = []
for (const e of sheet) {
  const cur = current.get(e.name)
  const rec = {
    n: e.n, name: e.name, slug: cur?.slug ?? null,
    domainNumber: cur?.domainNumber ?? null,
    oldMode: cur?.mode ?? null, oldTiers: cur?.tiers ?? [],
    tiers: e.tiers, none: e.none,
    newMode: e.tiers.length ? resolveMode(e.name, e.tiers, cur) : (cur?.mode ?? null),
  }
  out.push(rec)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 1))
} else {
  const changed = out.filter(r => r.tiers.length && r.oldMode !== r.newMode)
  console.log(`parsed ${out.length} events: ${out.filter(r => r.tiers.length).length} with ladders, ` +
              `${out.filter(r => !r.tiers.length).length} without`)
  console.log(`\nMODE CHANGES (${changed.length}):`)
  for (const r of changed) console.log(`  ${r.name}: ${r.oldMode} -> ${r.newMode}  (${r.tiers.length} levels)`)
  const gone = out.filter(r => !r.slug)
  if (gone.length) console.log(`\nNOT ON THE ROSTER: ${gone.map(r => r.name).join(', ')}`)
  const dropped = [...current.keys()].filter(k => !sheet.some(e => e.name === k))
  if (dropped.length) console.log(`ON THE ROSTER BUT NOT IN THE SHEET: ${dropped.join(', ')}`)
  const losing = out.filter(r => !r.tiers.length && r.oldTiers.length)
  if (losing.length) console.log(`\nLOSING THEIR LADDER: ${losing.map(r => `${r.name} (had ${r.oldTiers.length})`).join(', ')}`)
}
