#!/usr/bin/env node
// Compiles the reviewed GRADING_STANDARDS_REVIEW.md into lib/standards.ts.
// Idempotent: running it twice produces the same file.
//
//   node scripts/apply-standards-sheet.mjs [--dry]
//
// Refuses to write anything if the sheet has a single problem, and lists them
// all at once so a review pass fixes every one in one go.

import fs from 'node:fs'
import { compile, render } from './standards-sheet.mjs'

const SHEET = 'GRADING_STANDARDS_REVIEW.md'
const OUT = 'lib/standards.ts'

let compiled
try {
  compiled = compile(fs.readFileSync(SHEET, 'utf8'), fs.readFileSync('lib/eventData.ts', 'utf8'))
} catch (e) {
  console.error(e.message)
  process.exit(1)
}

const ts = render(compiled)
const kinds = compiled.standards.reduce((m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }), {})
console.log(`${compiled.standards.length} events compiled: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}`)
if (compiled.partial.length) console.log(`partial ladders (grade up to their own top):\n  ${compiled.partial.join('\n  ')}`)

if (process.argv.includes('--dry')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  console.log(cur === ts ? `${OUT} is up to date` : `${OUT} would change`)
} else {
  fs.writeFileSync(OUT, ts)
  console.log(`wrote ${OUT}`)
}
