#!/usr/bin/env node
// Generates the difficulty-level review worksheet, and a separate notes file for
// whoever implements the result.
//
//   node scripts/gen-difficulty-review.mjs [path/to/results-snapshot.json]
//
//   EVENT_DIFFICULTY_REVIEW.md  — the worksheet. Every event, plain English,
//                                 an editable list of levels. Tāne fills this in.
//   EVENT_DIFFICULTY_NOTES.md   — data integrity findings and migration cost.
//                                 Nobody reviewing the sport needs to read this.
//
// The worksheet is committed BEFORE it is filled in, so `git diff` is the record
// of what changed. That is why the worksheet carries no decision codes.
//
// Snapshot (optional) is an array of results rows with difficulty_tier, raw_score
// and an embedded session_events(event_name); fetch with the anon key:
//   curl "$URL/rest/v1/results?select=difficulty_tier,raw_score,time_seconds,\
//   reps,weight_kg,session_events(event_name)&difficulty_tier=not.is.null&limit=5000" \
//     -H "apikey: $KEY" -H "Authorization: Bearer $KEY"

import fs from 'node:fs'

const DT_CAP = 10000
const SRC = 'lib/eventData.ts'
const SHEET = 'EVENT_DIFFICULTY_REVIEW.md'
const NOTES = 'EVENT_DIFFICULTY_NOTES.md'
const BLANK_SLOTS = 5   // empty lines offered to an event that has no levels yet

// Mirrors isWeightScoredTierByName in lib/scoring.ts.
const WEIGHT_SCORED = {
  'GHD Situp': 'GHD Situp',
  'Pause Dips': 'Weighted RTO Dip',
  'Pause Chinup': 'Weighted Chinup',
  'Pause Chin Up': 'Weighted Chinup',
}

// Plain English for the scoring mode. The reviewer is deciding sport, not code,
// so no inputMode string reaches the worksheet.
const SCORING_OVERRIDES = {
  // Repurposes the strength input: weight_kg holds hand width in cm and
  // raw_score is negated, so NARROWER wins. The generic label would read
  // "heaviest weight lifted", which is the opposite of what happens.
  'Shoulder Dislocate': 'narrowest hand width, and reps at that width',
}

function scoredBy(mode, fasterWins, name) {
  if (SCORING_OVERRIDES[name]) return SCORING_OVERRIDES[name]
  switch (mode) {
    case 'strength': return 'heaviest weight lifted'
    case 'reps': return 'most reps'
    case 'hold': return 'longest hold'
    case 'time': return 'time taken'
    case 'sprint': return 'fastest time'
    case 'distance': return 'furthest or highest'
    case 'sport': return 'win, draw or loss against another player'
    case 'score': return 'fewest strokes over 4 holes'
    case 'difficulty+reps': return 'difficulty level, then most reps'
    case 'difficulty+time':
      return fasterWins ? 'difficulty level, then fastest time' : 'difficulty level, then longest hold'
    default: return mode
  }
}

function parseTimedEffortSlugs(src) {
  const block = src.match(/TIMED_EFFORT_SLUGS = new Set<string>\(\[([\s\S]*?)\]\)/)
  if (!block) throw new Error('TIMED_EFFORT_SLUGS not found in ' + SRC)
  return new Set([...block[1].matchAll(/'([^']+)'/g)].map(m => m[1]))
}

function parseEvents(src) {
  const events = []
  for (const b of src.split(/\n  \{\n/).slice(1)) {
    const slug = (b.match(/slug: '([^']+)'/) || [])[1]
    if (!slug) continue
    const nm = b.match(/\n    name: '((?:[^'\\]|\\.)*)'/) || b.match(/\n    name: "((?:[^"\\]|\\.)*)"/)
    events.push({
      slug,
      name: nm ? nm[1] : slug,
      domain: (b.match(/domain: '([^']+)'/) || [])[1],
      domainNumber: +(b.match(/domainNumber: (\d+)/) || [])[1],
      inputMode: (b.match(/inputMode: '([^']+)'/) || [])[1],
      tiers: [...b.matchAll(/level: (\d+), name: '([^']*)'(?:, detail: '([^']*)')?/g)]
        .map(m => ({ level: +m[1], name: m[2], detail: m[3] || '' })),
    })
  }
  return events
}

function classify(row, event) {
  const idx = event.tiers.findIndex(t => t.name === row.difficulty_tier)
  if (idx === -1) return { kind: 'orphan-label', idx }
  if (WEIGHT_SCORED[event.name] === row.difficulty_tier) return { kind: 'weight-scored', idx }
  const raw = Number(row.raw_score ?? 0)
  if (Math.floor(raw / DT_CAP) === idx) return { kind: 'clean', idx }
  if (event.inputMode === 'difficulty+time' && raw > 0 && raw % DT_CAP === 0) {
    return { kind: 'boundary', idx }
  }
  return { kind: 'index-drift', idx }
}

function tokens(s) {
  return new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').split(/\s+/)
    .filter(w => w && !['the', 'a', 'of', 'with', 'and'].includes(w)))
}
function suggestTier(label, tiers) {
  const a = tokens(label)
  let best = null
  for (const t of tiers) {
    const b = tokens(t.name)
    const shared = [...a].filter(w => b.has(w)).length
    if (!shared) continue
    const score = shared / Math.max(a.size, b.size)
    if (!best || score > best.score) best = { name: t.name, level: t.level, score }
  }
  return best && best.score >= 0.4 ? best : null
}

const src = fs.readFileSync(SRC, 'utf8')
const events = parseEvents(src)
const timedEffort = parseTimedEffortSlugs(src)
const byName = new Map(events.map(e => [e.name, e]))

const rows = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : null
const hist = new Map()
const retired = new Map()
const detiered = new Map()
if (rows) {
  for (const r of rows) {
    const en = r.session_events?.event_name
    const ev = en ? byName.get(en) : null
    if (!ev || !ev.tiers.length) {
      if (en) { const b = ev ? detiered : retired; b.set(en, (b.get(en) || 0) + 1) }
      continue
    }
    if (!hist.has(en)) hist.set(en, { total: 0, perTier: new Map(), orphans: new Map(), clean: 0, boundary: 0, drift: 0, weight: 0 })
    const h = hist.get(en)
    h.total++
    const c = classify(r, ev)
    if (c.kind === 'orphan-label') {
      h.orphans.set(r.difficulty_tier, (h.orphans.get(r.difficulty_tier) || 0) + 1)
    } else {
      const key = ev.tiers[c.idx].name
      const t = h.perTier.get(key) || { n: 0, boundary: 0, drift: 0 }
      t.n++
      if (c.kind === 'boundary') { t.boundary++; h.boundary++ }
      else if (c.kind === 'index-drift') { t.drift++; h.drift++ }
      else if (c.kind === 'weight-scored') h.weight++
      else h.clean++
      h.perTier.set(key, t)
    }
  }
}

// Pacific/Auckland, never toISOString(): a UTC date stamps the previous day for
// most of the NZ working day. Same bug as session_date, avoided the same way.
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date())
const domains = [...new Set(events.map(e => e.domainNumber))].sort((a, b) => a - b)

// ─────────────────────────────────────────────────────────────────────────────
// The worksheet
// ─────────────────────────────────────────────────────────────────────────────
const W = []
const w = s => W.push(s)

w('# Difficulty Levels — Review')
w('')
w(`All ${events.length} AllSport events. Go through them and set the difficulty levels for each one.`)
w('')
w('## How to fill this in')
w('')
w('Every event has a list of levels under it. **Edit the list.** That is the whole job.')
w('')
w('- **Change a level:** type over it.')
w('- **Add a level:** add a new line.')
w('- **Remove a level:** delete the line.')
w('- **Reorder:** move the lines around.')
w('- **This event should have no levels:** delete all the lines and write `NONE`.')
w('')
w('Two rules:')
w('')
w('1. **D1 is the easiest.** Each level below it must be harder than the one above.')
w('2. **Ignore the D numbers.** Delete D2 and leave a gap if you like. I renumber them at the end.')
w('')
w('Events with no levels yet have blank lines waiting. Fill in as many as you need, delete the rest,')
w('and add more lines if five is not enough.')
w('')
w('In brackets after a level you may see how it is judged, and `used N times`, meaning players have')
w('actually scored on it. A level nobody has ever used may be too hard, or may not be a real step.')
w('')
w('If you are unsure about something, write a note on the line and I will pick it up.')
w('')
w(`*${events.length} events · generated ${today} · nothing above this line needs editing*`)
w('')
w('---')
w('')

let n = 0
for (const dn of domains) {
  const inDomain = events.filter(e => e.domainNumber === dn)
  w(`## ${dn}. ${inDomain[0].domain}`)
  w('')
  for (const ev of inDomain) {
    n++
    const h = hist.get(ev.name)
    const fasterWins = timedEffort.has(ev.slug)
    w(`### ${n}. ${ev.name}`)
    w('')
    w(`*Scored by: ${scoredBy(ev.inputMode, fasterWins, ev.name)}*`)
    w('')
    if (ev.tiers.length) {
      for (const t of ev.tiers) {
        const used = h?.perTier.get(t.name)?.n ?? 0
        const bits = []
        if (t.detail) bits.push(t.detail)
        if (used) bits.push(`used ${used} ${used === 1 ? 'time' : 'times'}`)
        w(`- D${t.level}: ${t.name}${bits.length ? `   (${bits.join(' · ')})` : ''}`)
      }
    } else {
      w('_No levels yet._')
      w('')
      for (let i = 1; i <= BLANK_SLOTS; i++) w(`- D${i}: `)
    }
    w('')
  }
  w('---')
  w('')
}

// The sheet is a WORKSHEET. Once it has been filled in it holds review decisions
// that exist nowhere else, and this script regenerates it from lib/eventData.ts —
// i.e. from the state BEFORE the review. Refuse to clobber that.
if (fs.existsSync(SHEET) && !process.argv.includes('--force')) {
  const existing = fs.readFileSync(SHEET, 'utf8')
  const filled = [...existing.matchAll(/^- D\d+: *\S/gm)].length
  const blank = [...existing.matchAll(/^- D\d+: *$/gm)].length
  if (filled > blank) {
    console.error(
      `Refusing to overwrite ${SHEET}: it has ${filled} filled levels against ${blank} blank ones,\n` +
      `so it has been reviewed. Regenerating would discard that. Pass --force if you really mean it.`)
    process.exit(1)
  }
}

fs.writeFileSync(SHEET, W.join('\n'))

// ─────────────────────────────────────────────────────────────────────────────
// The notes, for whoever implements the filled-in sheet
// ─────────────────────────────────────────────────────────────────────────────
const N = []
const q = s => N.push(s)
const esc = s => String(s).replace(/\|/g, '\\|')

const RETIRED_TIMED_EFFORTS = new Set(['walking', 'backwards-walk'])
const rosterSlugs = new Set(events.map(e => e.slug))
const staleTimedEffort = [...timedEffort].filter(sl => !rosterSlugs.has(sl) && !RETIRED_TIMED_EFFORTS.has(sl))
const semanticsSuspect = events.filter(e =>
  e.inputMode === 'difficulty+time' && !timedEffort.has(e.slug) && (hist.get(e.name)?.boundary ?? 0) > 0)
const tieredEvents = events.filter(e => e.tiers.length)
const zeroHistory = tieredEvents.filter(e => !hist.has(e.name))

q('# Difficulty Levels — Implementation Notes')
q('')
q(`> Companion to \`${SHEET}\`. Nothing here is a review decision — it is what the data looks like`)
q('> underneath, and what each kind of change costs. Generated by the same script.')
q('>')
q(`> Generated ${today} from \`${SRC}\`${rows ? ` and a production snapshot of ${rows.length} tiered result rows` : ''}.`)
q('')
q('## Reading the filled-in worksheet')
q('')
q('A level line is `- D1: Name   (judge detail)`, and the detail is separated by **three spaces**.')
q('Split on that, not on the first bracket: level names legitimately contain brackets of their own')
q('(`Roll to Jack (2m)`, `Game (4 Holes)`, `Partner Hits (5m)`), and a first-bracket split silently')
q('truncates them to `Roll to Jack` and loses the only thing distinguishing three levels from')
q('each other.')
q('')
q('## What each change costs')
q('')
q('| Change | Cost |')
q('|---|---|')
q('| Rename a level | Free **once the tier index is stored** instead of the display name. Today it orphans that level\'s history — see below. |')
q('| Reword the judge detail | Free |')
q('| Add, delete, reorder, or split a level | `raw_score` re-encode migration |')
q('| Give an untiered event levels | Input mode change; no history to re-encode, but the event\'s past rows stop being comparable |')
q('| Change the level count on GHD Situp, Pause Dips or Pause Chinup | Also edit the name literals in `lib/scoring.ts` |')
q('')
q('## Fix the storage model first')
q('')
q('`results.difficulty_tier` stores the level\'s **display name**, and every lookup in the app is')
q('`tiers.findIndex(t => t.name === r.difficulty_tier)`. While that is true, a rename orphans history')
q('and a reorder silently re-points it. Adding `results.difficulty_level INT`, backfilled from')
q('`raw_score` (which already carries the index), makes renames free forever and turns a reorder into')
q('a single UPDATE. Same trap as the event-rename one in CLAUDE.md, one level down.')
q('')
if (rows) {
  const c = { clean: 0, boundary: 0, drift: 0, weight: 0, orphan: 0 }
  for (const h of hist.values()) {
    c.clean += h.clean; c.boundary += h.boundary; c.drift += h.drift; c.weight += h.weight
    for (const v of h.orphans.values()) c.orphan += v
  }
  const noLadder = [...retired.values()].concat([...detiered.values()]).reduce((a, b) => a + b, 0)
  q('## State of the existing data')
  q('')
  q(`${rows.length} historical rows carry a level. Of those:`)
  q('')
  q(`- **${c.clean}** are internally consistent.`)
  q(`- **${c.orphan}** carry a label matching no current level — mostly the July 2026 renames.`)
  q(`- **${c.boundary}** sit on an exact tier boundary with the seconds zeroed.`)
  q(`- **${c.weight}** are on weight-scored final levels, which store a bare weight, not a tier-encoded score.`)
  q(`- **${c.drift}** disagree in some other way.`)
  q(`- **${noLadder}** belong to events that no longer carry a ladder.`)
  q('')
  q(`**${zeroHistory.length} tiered events have no history at all** — free to change however: ` +
    zeroHistory.map(e => e.name).join(', ') + '.')
  q('')
}
q('## Known defects to settle alongside the review')
q('')
q('### The June 2026 re-encode did not floor its division')
q('')
q('`supabase/migrations/20260629000000_fix_placement_and_timed_events.sql` line 26:')
q('')
q('```sql')
q('SET raw_score = (r.raw_score / 10000) * 10000 + (10000 - (r.raw_score % 10000))')
q('```')
q('')
q('`raw_score` is `numeric`, so `/ 10000` is not integer division and `(raw / 10000) * 10000` evaluates')
q('back to `raw`. The expression collapses to `raw + 10000 - (raw % 10000)`, pushing every row it')
q('touched one level up with the within-level term zeroed — the time is gone from the score and')
q('everyone on that level ties. Floor the division in whatever replaces it.')
q('')
for (const sl of staleTimedEffort) {
  q(`### \`TIMED_EFFORT_SLUGS\` contains \`'${sl}'\`, which matches no event`)
  q('')
  q('The set is keyed on slug, so an entry that matches nothing silently does nothing and the event')
  q('ranks with the opposite semantics. (`walking` and `backwards-walk` miss on purpose — retired')
  q('events whose inverted-encoded rows must still decode.)')
  q('')
}
for (const e of semanticsSuspect) {
  q(`### ${e.name} is ranked backwards`)
  q('')
  q(`\`${e.slug}\` is scored as a hold — longest time wins — but ${hist.get(e.name).boundary} of its rows are`)
  q('inverted-encoded, i.e. written as a timed effort. One of the two is wrong, and its leaderboard has')
  q('been ordered accordingly ever since.')
  q('')
}
q('### Weight-scored final levels are not tier-encoded')
q('')
q('GHD Situp D4, Pause Dips D5 and Pause Chinup D5 store a bare weight as `raw_score`')
q('(`lib/scoring.ts:137`), so the hardest level ranks below every level above D1.')
q('')
q('## Labels in the data that match no current level')
q('')
q('Italicised guesses are token overlap only — confirm or overrule each; nothing is applied from them.')
q('')
q('| Event | Stored label | Rows | Likely |')
q('|---|---|---:|---|')
for (const ev of tieredEvents) {
  const h = hist.get(ev.name)
  if (!h?.orphans.size) continue
  for (const [label, count] of [...h.orphans.entries()].sort((a, b) => b[1] - a[1])) {
    const g = suggestTier(label, ev.tiers)
    q(`| ${esc(ev.name)} | ${esc(label)} | ${count} | ${g ? `*D${g.level} ${esc(g.name)}?*` : '—' } |`)
  }
}
q('')
if (retired.size || detiered.size) {
  q('## Tiered history with no ladder to attach to')
  q('')
  q('A re-encode must not assume every row carrying a level maps to a live ladder.')
  q('')
  if (retired.size) {
    q('**Events removed from the roster** — inert.')
    q('')
    q('| Event | Rows |')
    q('|---|---:|')
    for (const [e, c] of [...retired.entries()].sort((a, b) => b[1] - a[1])) q(`| ${esc(e)} | ${c} |`)
    q('')
  }
  if (detiered.size) {
    q('**Events still on the roster whose levels were removed** — decide whether to clear the label or')
    q('restore the ladder.')
    q('')
    q('| Event | Rows | Mode now |')
    q('|---|---:|---|')
    for (const [e, c] of [...detiered.entries()].sort((a, b) => b[1] - a[1])) {
      q(`| ${esc(e)} | ${c} | \`${byName.get(e)?.inputMode ?? '?'}\` |`)
    }
    q('')
  }
}

fs.writeFileSync(NOTES, N.join('\n'))
console.log(`${SHEET}: ${events.length} events (${tieredEvents.length} with levels, ${events.length - tieredEvents.length} without)`)
console.log(`${NOTES}: ${rows ? rows.length + ' history rows analysed' : 'no history snapshot'}`)
