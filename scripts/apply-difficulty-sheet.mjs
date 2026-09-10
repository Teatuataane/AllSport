#!/usr/bin/env node
// Writes the reviewed ladders from EVENT_DIFFICULTY_REVIEW.md into lib/eventData.ts:
// each event's inputMode, hasDifficultyTiers and difficultyTiers block.
// Idempotent — running it twice produces the same file.
//
//   node scripts/apply-difficulty-sheet.mjs [--dry]

import fs from 'node:fs'
import { execFileSync } from 'node:child_process'

const SRC = 'lib/eventData.ts'
const spec = JSON.parse(execFileSync('node', ['scripts/parse-difficulty-sheet.mjs', '--json'],
  { encoding: 'utf8', maxBuffer: 1 << 24 }))
const byName = new Map(spec.map(r => [r.name, r]))

// Rungs scored differently from the rest of their ladder. Keyed on the tier NAME
// within its event, and resolved here once — the output carries the flag on the
// tier itself, so nothing downstream matches on a name again.
const WEIGHT_RUNGS = {
  'Pause Dips': 'Weighted RTO Dip',
  'Pause Chinup': 'Weighted Chinup',
  'GHD Situp': 'Weighted GHD Situp',
}
// Golf and Disc Golf top out in a real round: win/draw/loss, with the stroke
// count recorded alongside it.
const STROKE_GAME = new Set(['Golf', 'Disc Golf'])
const isGameRung = n => n === 'Game' || n.startsWith('Game (')

const q = v => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`

function tierLine(t, evName) {
  const parts = [`level: ${t.level}`, `name: ${q(t.name)}`]
  if (t.detail) parts.push(`detail: ${q(t.detail)}`)
  if (WEIGHT_RUNGS[evName] === t.name) { parts.push(`scoring: 'weight'`, `records: 'reps'`) }
  else if (isGameRung(t.name)) {
    parts.push(`scoring: 'sport'`)
    if (STROKE_GAME.has(evName)) parts.push(`records: 'strokes'`)
  }
  return `      { ${parts.join(', ')} },`
}

const lines = fs.readFileSync(SRC, 'utf8').split('\n')
const out = []
let i = 0, touched = 0, missing = []

// Walk the EVENTS array one object at a time: an event opens on `  {` and closes
// on `  },` at the same indent.
while (i < lines.length) {
  if (lines[i] !== '  {') { out.push(lines[i]); i++; continue }
  let j = i
  while (j < lines.length && lines[j] !== '  },') j++
  const block = lines.slice(i, j + 1)
  const nameLine = block.find(l => /^    name: /.test(l))
  const name = nameLine ? nameLine.match(/^    name: (['"])([\s\S]*?)\1,$/)?.[2] : null
  const rec = name ? byName.get(name) : null

  if (!rec) { if (name) missing.push(name); out.push(...block); i = j + 1; continue }

  const rebuilt = []
  let k = 0
  while (k < block.length) {
    const l = block[k]
    if (/^    inputMode: /.test(l)) { rebuilt.push(`    inputMode: '${rec.newMode}',`); k++; continue }
    if (/^    hasDifficultyTiers: /.test(l)) {
      rebuilt.push(`    hasDifficultyTiers: ${rec.tiers.length > 0},`)
      k++
      // Drop any existing difficultyTiers block; a fresh one is emitted here.
      if (block[k] && /^    difficultyTiers: \[/.test(block[k])) {
        while (block[k] && block[k] !== '    ],') k++
        k++
      }
      if (rec.tiers.length) {
        rebuilt.push('    difficultyTiers: [')
        for (const t of rec.tiers) rebuilt.push(tierLine(t, name))
        rebuilt.push('    ],')
      }
      continue
    }
    rebuilt.push(l); k++
  }
  touched++
  out.push(...rebuilt)
  i = j + 1
}

if (missing.length) console.error(`NOT IN THE SHEET (left alone): ${missing.join(', ')}`)
const result = out.join('\n')
if (process.argv.includes('--dry')) {
  console.log(`would rewrite ${touched} events`)
} else {
  fs.writeFileSync(SRC, result)
  console.log(`rewrote ${touched} events in ${SRC}`)
}
