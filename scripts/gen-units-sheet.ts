// Generates WORKOUT_UNITS_REVIEW.md — what one effort unit is, per event — from
// the per-mode defaults in lib/units.ts. Tāne reviews the sheet, then
// scripts/apply-units-sheet.mjs compiles it into lib/unitSheet.ts.
//
//   node --import ./scripts/ts-loader.mjs scripts/gen-units-sheet.ts [--force]
//
// Refuses to overwrite an existing sheet without --force, because the sheet is
// the reviewed source of truth once it exists: regenerating it would throw the
// review away.

import { existsSync, writeFileSync } from 'node:fs'
import { EVENTS, DOMAIN_ORDER } from '../lib/eventData'
import { defaultRule, RULE_WORDS } from '../lib/units'

const OUT = 'WORKOUT_UNITS_REVIEW.md'
if (existsSync(OUT) && !process.argv.includes('--force')) {
  console.error(`${OUT} exists and is the reviewed source. Pass --force to regenerate it from the defaults.`)
  process.exit(1)
}

const meaning = (rule: keyof typeof RULE_WORDS, per: number) => {
  if (rule === 'distance') return `${per} metres`
  const w = RULE_WORDS[rule]
  return per === 1 ? `one ${w.one}` : `${per} ${w.many}`
}

const lines: string[] = [
  '# Workout units — review sheet',
  '',
  `What ONE effort unit is, for each of the ${EVENTS.length} events. Units are the training`,
  'gate on every colour: each domain colour needs a number of units in that',
  'domain since the last colour there (see `lib/grading.ts`). Any completed unit',
  'counts; there is no intensity floor.',
  '',
  '**How to review:** change `rule` or `per` on any row, then run',
  '`node scripts/apply-units-sheet.mjs`. The last column is only a reading aid.',
  '',
  '- `set` — one working set is `per` units apart (`per` 1 = every set is a unit)',
  '- `hold` — one hold',
  '- `distance` — `per` metres is one unit (Cycling 1000 = 25km is 25 units)',
  '- `attempts` — `per` attempts is one unit (throws and jumps: 3)',
  '- `game` — one game',
  '- `round` — one four-hole round',
  '',
  'A Game rung on a drill ladder always counts one game, whatever the rule.',
  'Generated from the per-mode defaults on ' + new Date().toISOString().slice(0, 10) + '.',
  '',
]

DOMAIN_ORDER.forEach((domain, i) => {
  const events = EVENTS.filter(e => e.domainNumber === i + 1)
  lines.push(`## ${i + 1}. ${domain}`, '', '| slug | event | domain | rule | per | one unit is |', '|---|---|---|---|---|---|')
  for (const ev of events) {
    const { rule, per } = defaultRule(ev)
    lines.push(`| \`${ev.slug}\` | ${ev.name} | ${ev.domainNumber} | ${rule} | ${per} | ${meaning(rule, per)} |`)
  }
  lines.push('')
})

writeFileSync(OUT, lines.join('\n'))
console.log(`wrote ${OUT}: ${EVENTS.length} events`)
