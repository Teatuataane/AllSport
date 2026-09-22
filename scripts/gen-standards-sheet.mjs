#!/usr/bin/env node
// Generates the grading standards worksheet: every event, every colour, one
// standard per line. Tāne reviews it the way he reviewed the difficulty sheet,
// and scripts/apply-standards-sheet.mjs compiles the reviewed sheet into
// lib/standards.ts. Nothing is typed into lib/ by hand.
//
//   node scripts/gen-standards-sheet.mjs [--snapshot <dir>] [--force]
//
// Six events carry the standards approved over four review rounds, verbatim.
// Every other event is DRAFTED: by a stated rule where one can be written (rep
// and hold ladders), or by hand where no rule can know what a good time, load
// or throw is (timed efforts, lifts, throws, jumps). The sheet says which, on
// every event, so the review knows where to look hardest.
//
// --snapshot reads snap-results.json and snap-session-events.json from <dir>
// (fetched with the anon key) to show how many players have scored each event.
// The sheet names no player: this repo is public.
//
// Refuses to overwrite an existing sheet without --force, because once it has
// been reviewed the sheet IS the record of the decisions.

import fs from 'node:fs'

const SRC = 'lib/eventData.ts'
const SHEET = 'GRADING_STANDARDS_REVIEW.md'
const COLOURS = ['Kiwikiwi', 'Whero', 'Karaka', 'Kōwhai', 'Kākāriki', 'Kahurangi',
  'Poroporo', 'Parahi', 'Hiriwa', 'Kōura', 'Uenuku', 'Taniwha']
const TOP = 12
const DRILL_COLOURS = 6 // Kiwikiwi to Kahurangi; the rating gives the rest

const args = process.argv.slice(2)
const force = args.includes('--force')
const snapAt = args.indexOf('--snapshot')
const snapDir = snapAt >= 0 ? args[snapAt + 1] : null
if (fs.existsSync(SHEET) && !force) {
  console.error(`${SHEET} exists and may carry review edits. Pass --force to overwrite it.`)
  process.exit(1)
}

// ─── The roster, parsed rather than imported (this is .mjs) ──────────────────
function parseEvents(src) {
  const block = src.match(/TIMED_EFFORT_SLUGS = new Set<string>\(\[([\s\S]*?)\]\)/)
  if (!block) throw new Error('TIMED_EFFORT_SLUGS not found in ' + SRC)
  // Comments stripped first: an apostrophe in one pairs with the next quote and
  // misreads every slug after it.
  const body = block[1].replace(/\/\/.*$/gm, '')
  const timed = new Set([...body.matchAll(/'([^']+)'/g)].map(m => m[1]))
  const events = []
  for (const b of src.split(/\n {2}\{\n/).slice(1)) {
    const slug = (b.match(/slug: '([^']+)'/) || [])[1]
    if (!slug) continue
    const nm = b.match(/\n {4}name: '((?:[^'\\]|\\.)*)'/)
    const tiers = [...b.matchAll(/\{ level: \d+, name: '((?:[^'\\]|\\.)*)'([^}]*)\}/g)].map(m => ({
      name: m[1].replace(/\\'/g, "'"),
      scoring: (m[2].match(/scoring: '(\w+)'/) || [])[1] ?? null,
    }))
    events.push({
      slug,
      name: (nm ? nm[1] : slug).replace(/\\'/g, "'"),
      domain: (b.match(/domain: '([^']+)'/) || [])[1],
      domainNumber: +(b.match(/domainNumber: (\d+)/) || [])[1],
      mode: (b.match(/inputMode: '([^']+)'/) || [])[1],
      timed: timed.has(slug),
      tiers,
    })
  }
  // The roster size is not pinned here: it was, at 120, and the Sept 2026
  // change to 128 would have aborted the next regeneration. What this guards
  // against is a parser that silently reads a SUBSET, so compare against the
  // slug count in the source instead of a number someone has to remember.
  const declared = (src.match(/^\s+slug: '/gm) || []).length
  if (events.length !== declared) throw new Error(`parsed ${events.length} events from ${SRC}, but it declares ${declared}`)
  return events
}

// ─── Formatting ──────────────────────────────────────────────────────────────
const fmtSecs = s => s < 60 ? `${s}s` : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`
/** Parse "≤ 4:05" or "≤ 14.5s" back to seconds. */
const parseLe = v => {
  const m = v.match(/^≤ (?:(\d+):(\d{2})|([\d.]+)s)$/)
  if (!m) return null
  return m[3] != null ? +m[3] : +m[1] * 60 + +m[2]
}
/** A women's timed ladder drafted from the men's: every time to beat × f. */
const scaleTimes = (lines, f) => lines.map(l => {
  const [d, v] = l.split(' · ')
  const s = parseLe(v)
  if (s == null) return l
  const t = s * f
  const r = t < 60 ? Math.round(t * 10) / 10 : Math.round(t / 5) * 5
  return `${d} · ≤ ${fmtSecs(r)}`
})

// ─── Approved in review — verbatim ───────────────────────────────────────────
const BENCH = {
  M: [null, 0.35, 0.45, 0.55, 0.65, 0.75, 0.85, 0.93, 1, 1.1, 1.25, 1.5],
  F: [null, 0.23, 0.3, 0.36, 0.43, 0.5, 0.56, 0.62, 0.68, 0.75, 0.85, 1],
}
const ratioLines = rs => rs.map(r => r == null ? 'empty bar' : `${Math.round(r * 100) / 100}× BW`)
const CARRY = ['D1 · ≤ 4:00', 'D1 · ≤ 2:30', 'D1 · ≤ 1:45', 'D2 · ≤ 4:00', 'D2 · ≤ 2:45', 'D2 · ≤ 2:00',
  'D3 · ≤ 4:00', 'D3 · ≤ 3:00', 'D3 · ≤ 2:15', 'D3 · ≤ 1:45', 'D4 · ≤ 4:00', 'D4 · ≤ 2:00']

const APPROVED = {
  'Pause Bench': { M: ratioLines(BENCH.M), F: ratioLines(BENCH.F) },
  'Pushup Contest': {
    M: ['D1 · 10', 'D1 · 20', 'D2 · 10', 'D2 · 20', 'D2 · 30', 'D3 · 10', 'D3 · 20', 'D3 · 30', 'D4 · 5', 'D4 · 20', 'D5 · 10', 'D6 · 10'],
    F: ['D1 · 10', 'D1 · 20', 'D2 · 10', 'D2 · 20', 'D2 · 30', 'D3 · 6', 'D3 · 12', 'D3 · 18', 'D4 · 3', 'D4 · 10', 'D5 · 5', 'D6 · 5'],
  },
  'Jump Rope': { E: ['D1 · 1', 'D1 · 10', 'D2 · 10', 'D3 · 10', 'D4 · 10', 'D5 · 10'] },
  'Bridge': { E: ['D1 · 10s', 'D1 · 60s', 'D2 · 15s', 'D2 · 45s', 'D3 · 10s', 'D3 · 30s', 'D4 · 10s', 'D4 · 30s', 'D5 · 10s', 'D5 · 30s', 'D6 · 15s', 'D6 · 60s'] },
  // Approved in review as Weighted Carry / Wheelbarrow Push / Wheelbarrow Pull;
  // renamed Sept 2026 with the numbers untouched. These keys are checked against
  // the live roster further down, so a stale name here stops the generator dead
  // rather than quietly dropping an approved standard.
  'Sandbag Carry': { E: CARRY },
  'Farmer Carry': { E: CARRY },
  'Weighted Drag': { E: CARRY },
  'Vertical Jump': {
    M: [10, 20, 27, 33, 39, 45, 51, 54, 57, 60, 62, 64].map(c => `${c}cm`),
    F: [8, 15, 20, 25, 29, 33, 38, 40, 42, 44, 47, 50].map(c => `${c}cm`),
  },
}

// ─── Drafted by hand — events no rule can price ──────────────────────────────
// Each carries its reasoning into the sheet. Every figure is a draft against
// the general population: Kahurangi is the median adult, Kōura the top tenth,
// Taniwha one in a hundred, Uenuku reachable by anyone with years of training.

// Lifts are the bench ratios times how that lift typically compares with a
// bench press, so the approved bench ladder anchors every lift.
const LIFT = {
  'Deadlift': [1.6, 'about 1.6 times a bench press'],
  'Pause Back Squat': [1.3, 'about 1.3 times a bench press'],
  'Zercher Dead': [1.2, 'about 1.2 times a bench press'],
  'Pause Front Squat': [1.1, 'about 1.1 times a bench press'],
  'Clean & Jerk': [1.0, 'about a bench press'],
  'Pause Row': [0.9, 'about 0.9 times a bench press'],
  'Snatch': [0.8, 'about 0.8 times a bench press'],
  'Arthur Lift': [0.7, 'a clean and jerk to behind the neck, about 0.7 times a bench press'],
  'Clean & Press': [0.65, 'a strict overhead press, about 0.65 times a bench press'],
  '1A Snatch': [0.4, 'one arm, about 0.4 times a bench press'],
  'Kelly Snatch': [0.4, 'one arm, about 0.4 times a bench press'],
  '1A Press': [0.33, 'one arm, about a third of a bench press'],
  'Turkish Getup': [0.33, 'one arm, about a third of a bench press'],
  'Tibialis Curl': [0.2, 'a small muscle: a fifth of a bench press. A ratio of bodyweight sits oddly on a lift this size'],
  'Toe Lift': [0.2, 'a small muscle: a fifth of a bench press. The event itself was flagged as uncertain in July'],
}
const lift = f => ({ M: ratioLines(BENCH.M.map(r => r == null ? null : r * f)), F: ratioLines(BENCH.F.map(r => r == null ? null : r * f)) })

const RUN_M = ['D1 · finish', 'D1 · ≤ 1:10', 'D2 · finish', 'D2 · ≤ 2:30', 'D2 · ≤ 2:05',
  'D3 · ≤ 6:00', 'D3 · ≤ 5:00', 'D3 · ≤ 4:30', 'D3 · ≤ 4:05', 'D3 · ≤ 3:45', 'D3 · ≤ 3:30', 'D3 · ≤ 3:15']
const ERG = (m250, m500, k1) => ['D1 · finish', `D1 · ≤ ${m250}`, 'D2 · finish', ...m500.map(t => `D2 · ≤ ${t}`), ...k1.map(t => `D3 · ≤ ${t}`)]

const CUSTOM = {
  // Strength
  ...Object.fromEntries(Object.entries(LIFT).map(([n, [f, why]]) => [n, { ...lift(f), why: `The approved bench ratios scaled for this lift: ${why}.` }])),
  'Shoulder Dislocate': {
    E: ['any', '≤ 120cm', '≤ 110cm', '≤ 100cm', '≤ 95cm', '≤ 90cm', '≤ 85cm', '≤ 80cm', '≤ 75cm', '≤ 70cm', '≤ 65cm', '≤ 60cm'],
    why: 'Hand width on the stick, narrower is better. A width depends on shoulder breadth, so a broad player is disadvantaged; say if it should be a ratio of shoulder width instead.',
  },

  // Distance
  'Standing Broad Jump': {
    M: [100, 130, 150, 165, 180, 195, 210, 225, 240, 255, 270, 290].map(c => `${c}cm`),
    F: [80, 105, 120, 135, 145, 155, 165, 175, 185, 195, 210, 230].map(c => `${c}cm`),
    why: 'Built like the approved Vertical Jump: the median adult on Kahurangi, a steep climb to the top.',
  },
  'High Jump': {
    M: [60, 80, 95, 105, 115, 125, 135, 145, 155, 165, 175, 190].map(c => `${c}cm`),
    F: [50, 65, 75, 85, 95, 100, 110, 115, 125, 135, 145, 160].map(c => `${c}cm`),
    why: 'Bar height cleared, any technique.',
  },
  'Javelin': {
    M: ['D1 · any', 'D1 · 10m', 'D1 · 15m', 'D1 · 20m', 'D2 · 10m', 'D2 · 15m', 'D2 · 20m', 'D2 · 25m', 'D3 · 15m', 'D3 · 25m', 'D3 · 35m', 'D3 · 45m'],
    F: ['D1 · any', 'D1 · 8m', 'D1 · 12m', 'D1 · 16m', 'D2 · 8m', 'D2 · 12m', 'D2 · 16m', 'D2 · 20m', 'D3 · 10m', 'D3 · 17m', 'D3 · 24m', 'D3 · 32m'],
    why: 'Four colours on each implement. A throw with a heavier implement always outranks a lighter one, as on every ladder.',
  },
  'Shotput': {
    M: ['D1 · any', 'D1 · 15m', 'D1 · 25m', 'D1 · 35m', 'D2 · 4m', 'D2 · 6m', 'D2 · 8m', 'D2 · 10m', 'D3 · 5m', 'D3 · 7m', 'D3 · 9m', 'D3 · 11m'],
    F: ['D1 · any', 'D1 · 10m', 'D1 · 18m', 'D1 · 25m', 'D2 · 3m', 'D2 · 5m', 'D2 · 7m', 'D2 · 9m', 'D3 · 4m', 'D3 · 6m', 'D3 · 8m', 'D3 · 10m'],
    why: 'Four colours on each implement. The tennis-ball rung is thrown, so its distances are far longer.',
  },

  // Holds without a ladder
  'Wall Sit': {
    E: [10, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 420].map(fmtSecs),
    why: 'The median adult holds about a minute and a half.',
  },
  'Breath Hold': {
    E: [10, 20, 30, 40, 50, 60, 75, 90, 120, 150, 180, 240].map(fmtSecs),
    why: 'A static hold. The median untrained adult manages about a minute; three minutes takes years of practice.',
  },
  'Leg Ext Hold': {
    E: ['BW · 15s', 'BW · 30s', 'BW · 60s', '2kg · 30s', '4kg · 30s', '8kg · 30s', '12kg · 30s', '16kg · 30s', '20kg · 30s', '24kg · 30s', '28kg · 30s', '32kg · 30s'],
    why: 'A 30-second hold at each load from Parahi down, after three bodyweight holds. The loads follow the old ladder, extended past 24kg.',
  },

  // Timed efforts
  'Running': { M: RUN_M, F: scaleTimes(RUN_M, 1.12), why: 'Anyone can finish 1000m, so finishing cannot be a high colour: most colours are times on the longest rung. Women\'s times are the men\'s plus 12%.' },
  'Row Erg': (() => { const M = ERG('1:05', ['2:15', '1:55'], ['4:45', '4:15', '3:55', '3:40', '3:28', '3:18', '3:10']); return { M, F: scaleTimes(M, 1.12), why: 'As Running. The median adult rows 1000m in about 4:45.' } })(),
  'Ski Erg': (() => { const M = ERG('1:05', ['2:20', '2:05'], ['5:00', '4:35', '4:15', '4:00', '3:45', '3:35', '3:25']); return { M, F: scaleTimes(M, 1.12), why: 'As Running. The median adult skis 1000m in about 5:00.' } })(),
  'Cycling': (() => { const M = ERG('0:35', ['1:05', '0:55'], ['2:00', '1:45', '1:35', '1:28', '1:22', '1:17', '1:12']); return { M, F: scaleTimes(M, 1.12), why: 'As Running. These assume a stationary bike; the bike used changes every time.' } })(),
  'Scooting': {
    E: ERG('1:00', ['2:00', '1:45'], ['4:00', '3:30', '3:10', '2:55', '2:45', '2:35', '2:25']),
    why: 'As Running, one ladder for everyone.',
  },
  'Burpee Broad Jump': {
    E: ['D1 · finish', 'D1 · ≤ 1:30', 'D1 · ≤ 1:10', 'D2 · ≤ 3:00', 'D2 · ≤ 2:30', 'D2 · ≤ 2:10',
      'D3 · ≤ 6:00', 'D3 · ≤ 5:00', 'D3 · ≤ 4:20', 'D4 · ≤ 12:00', 'D4 · ≤ 10:00', 'D4 · ≤ 8:30'],
    why: 'About 55 burpee broad jumps to 100m. Taniwha is 200m at under five seconds a rep.',
  },
  'Animal Crawl': {
    E: ['D1 · finish', 'D1 · ≤ 30s', 'D1 · ≤ 20s', 'D2 · finish', 'D2 · ≤ 30s', 'D2 · ≤ 20s',
      'D3 · ≤ 45s', 'D3 · ≤ 30s', 'D4 · ≤ 40s', 'D4 · ≤ 25s', 'D5 · ≤ 2:30', 'D5 · ≤ 1:45'],
    why: 'Three colours on each of the easy crawls, two on the hard ones.',
  },
  'Bronco': {
    E: ['D1 · finish', 'D1 · ≤ 1:15', 'D1 · ≤ 1:00', 'D2 · finish', 'D2 · ≤ 2:30', 'D2 · ≤ 2:05',
      'D3 · ≤ 4:00', 'D3 · ≤ 3:15', 'D4 · ≤ 5:15', 'D4 · ≤ 4:20', 'D5 · ≤ 6:30', 'D5 · ≤ 5:00'],
    why: 'Taniwha is the full five-lap Bronco under five minutes, which is a professional rugby standard.',
  },
  'Climbing': {
    E: ['D1 · finish', 'D1 · ≤ 20s', 'D2 · finish', 'D2 · ≤ 20s', 'D3 · finish', 'D3 · ≤ 20s', 'D4 · finish', 'D4 · ≤ 20s',
      'D5 · finish', 'D6 · finish', 'D7 · finish', 'D8 · finish'],
    why: 'The four hardest rungs are one colour each for completing them. NOTE: the lowest three rungs are HANGS on a ladder ranked fastest-first, so a longer hang scores worse. That came from the difficulty review; say if the hangs should move off this ladder.',
  },
  'Repeat High Jump': {
    E: ['D1 · finish', 'D1 · ≤ 30s', 'D2 · finish', 'D2 · ≤ 30s', 'D3 · finish', 'D3 · ≤ 30s',
      'D4 · finish', 'D4 · ≤ 30s', 'D5 · finish', 'D5 · ≤ 30s', 'D6 · finish', 'D6 · ≤ 30s'],
    why: 'Two colours a height: complete the set, then complete it inside 30 seconds. The number of jumps is set by the kaiwhakawā, so the time assumes it never changes.',
  },

  // Game-rung events whose drill is raced or single-rung
  '100m Sprint': {
    M: ['D1 · finish', 'D1 · ≤ 1:15', 'D1 · ≤ 1:00', 'D2 · ≤ 19s', 'D2 · ≤ 17s', 'D2 · ≤ 15.5s'],
    F: ['D1 · finish', 'D1 · ≤ 1:15', 'D1 · ≤ 1:00', 'D2 · ≤ 22s', 'D2 · ≤ 19.5s', 'D2 · ≤ 17.5s'],
    why: 'Three colours walking, three sprinting. The median adult man sprints 100m in about 15.5 seconds.',
  },
  '200m Sprint': {
    M: ['D1 · finish', 'D1 · ≤ 2:30', 'D1 · ≤ 2:05', 'D2 · ≤ 40s', 'D2 · ≤ 35s', 'D2 · ≤ 32s'],
    F: ['D1 · finish', 'D1 · ≤ 2:30', 'D1 · ≤ 2:05', 'D2 · ≤ 46s', 'D2 · ≤ 40s', 'D2 · ≤ 37s'],
    why: 'As the 100m.',
  },
  'T-Race': {
    E: ['D1 · finish', 'D1 · ≤ 25s', 'D1 · ≤ 20s', 'D2 · ≤ 14s', 'D2 · ≤ 12.5s', 'D2 · ≤ 11.5s'],
    why: 'The T agility test: the median adult runs it in about 11 to 12 seconds.',
  },
  'Tag': {
    E: ['D1 · finish', 'D1 · ≤ 40s', 'D1 · ≤ 34s', 'D1 · ≤ 29s', 'D1 · ≤ 25s', 'D1 · ≤ 22s'],
    why: 'Six calls in a 10m grid. A new drill, so these times are the roughest on the sheet.',
  },
  'Rats & Rabbits': {
    E: ['D1 · finish', 'D1 · ≤ 3.5s', 'D1 · ≤ 3s', 'D1 · ≤ 2.7s', 'D1 · ≤ 2.5s', 'D1 · ≤ 2.3s'],
    why: 'Timed from the call to the line, 10m away. A new drill.',
  },
  'Capture the Flag': {
    E: ['D1 · finish', 'D1 · ≤ 10s', 'D1 · ≤ 8.5s', 'D1 · ≤ 7.5s', 'D1 · ≤ 6.8s', 'D1 · ≤ 6.2s'],
    why: 'About 30m with a pickup. A new drill.',
  },
  'Beach Flags': {
    E: ['D1 · finish', 'D1 · ≤ 5.5s', 'D1 · ≤ 4.8s', 'D1 · ≤ 4.3s', 'D1 · ≤ 3.9s', 'D1 · ≤ 3.6s'],
    why: 'From face down to a flag 15m away.',
  },
  'Tug of War': {
    E: ['D1 · finish', 'D1 · ≤ 20s', 'D2 · finish', 'D2 · ≤ 25s', 'D3 · ≤ 40s', 'D4 · ≤ 1:00'],
    why: 'A 10m hand-over-hand sled pull at each load.',
  },
  'Kabaddi': {
    E: ['D1 · 1', 'D1 · 2', 'D1 · 3', 'D1 · 4', 'D1 · 5'],
    partial: true,
    why: 'Five cones make five colours, so the drill stops at Kākāriki and Kahurangi comes only from the rating. Add cones to the drill if the drill should reach Kahurangi.',
  },
}

// ─── Drafted by rule — rep and hold ladders ──────────────────────────────────
// Colours spread across the drill rungs as evenly as possible, extras on the
// LOWEST rungs, where most players are. With fewer colours than rungs, colour i
// sits on rung floor((i - 1) × rungs / colours) + 1, which keeps D1 and drops
// rungs near the top.
function spread(colours, rungs) {
  if (colours >= rungs) {
    const base = Math.floor(colours / rungs), extra = colours % rungs
    return Array.from({ length: rungs }, (_, i) => base + (i < extra ? 1 : 0))
  }
  const out = Array(rungs).fill(0)
  for (let i = 1; i <= colours; i++) out[Math.floor((i - 1) * rungs / colours)]++
  return out
}
// Targets for k colours on one rung: reach it, then own it.
const REPS = { 1: [10], 2: [5, 15], 3: [5, 10, 20], 4: [3, 8, 15, 25], 5: [3, 6, 10, 15, 25], 6: [2, 4, 6, 10, 15, 25] }
const HOLD = { 1: [30], 2: [10, 30], 3: [10, 20, 45], 4: [5, 15, 30, 60], 5: [5, 10, 20, 40, 60], 6: [5, 10, 15, 30, 45, 60] }
const REPS_OVERRIDE = {
  'Speed Chess': { 2: [3, 8] },
  'Tae Kwon Do': { 2: [5, 8] },
  'Fencing': { 2: [5, 8] },
}
const WEIGHT_RUNG = { 'Pause Dips': [10, 25, 40], 'Pause Chinup': [10, 20, 30], 'GHD Situp': [10, 20, 30] }

function drafted(ev) {
  const drills = ev.tiers.map((t, i) => ({ ...t, idx: i })).filter(t => t.scoring !== 'sport')
  const game = ev.tiers.some(t => t.scoring === 'sport')
  const per = spread(game ? DRILL_COLOURS : TOP, drills.length)
  const lines = []
  drills.forEach((t, j) => {
    const k = per[j]
    if (!k) return
    const D = `D${t.idx + 1}`
    if (t.scoring === 'weight') {
      for (const kg of WEIGHT_RUNG[ev.name].slice(0, k)) lines.push(`${D} · +${kg}kg`)
    } else if (ev.mode === 'difficulty+reps') {
      for (const r of (REPS_OVERRIDE[ev.name]?.[k] ?? REPS[k])) lines.push(`${D} · ${r}`)
    } else if (ev.mode === 'difficulty+time' && !ev.timed) {
      for (const s of HOLD[k]) lines.push(`${D} · ${fmtSecs(s)}`)
    } else {
      throw new Error(`${ev.name}: no drafting rule for ${ev.mode}${ev.timed ? ' (timed)' : ''}; add it to CUSTOM`)
    }
  })
  return { E: lines, why: game
    ? 'Six drill colours spread over the drill rungs, extras on the lowest. Reach a rung, then own it.'
    : 'Twelve colours spread over the rungs, extras on the lowest. Reach a rung, then own it.' }
}

// ─── Assemble ────────────────────────────────────────────────────────────────
const events = parseEvents(fs.readFileSync(SRC, 'utf8'))
const byName = new Map(events.map(e => [e.name, e]))
for (const n of [...Object.keys(APPROVED), ...Object.keys(CUSTOM)]) {
  if (!byName.has(n)) throw new Error(`${n} is in the standards tables but not on the roster`)
}

let players = null
if (snapDir) {
  const rows = JSON.parse(fs.readFileSync(`${snapDir}/snap-results.json`, 'utf8'))
  const se = new Map(JSON.parse(fs.readFileSync(`${snapDir}/snap-session-events.json`, 'utf8')).map(e => [e.id, e.event_name]))
  players = new Map()
  for (const r of rows) {
    const n = se.get(r.event_id)
    if (!n || !r.player_id || r.raw_score == null) continue
    if (!players.has(n)) players.set(n, new Set())
    players.get(n).add(r.player_id)
  }
}

const scoredBy = ev => {
  if (ev.name === 'Shoulder Dislocate') return 'narrowest hand width'
  switch (ev.mode) {
    case 'strength': return 'heaviest weight lifted, as a ratio of bodyweight'
    case 'distance': return 'furthest or highest'
    case 'hold': return 'longest hold'
    case 'weight+time': return 'heaviest load, then longest hold'
    case 'sport': return 'win, draw or loss against another player'
    case 'difficulty+reps': return 'difficulty level, then most reps'
    case 'difficulty+distance': return 'difficulty level, then furthest throw'
    case 'difficulty+time': return ev.timed ? 'difficulty level, then fastest time' : 'difficulty level, then longest hold'
    default: return ev.mode
  }
}

const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Pacific/Auckland' }).format(new Date())
const W = []
const w = s => W.push(s)
const tally = { approved: 0, rule: 0, hand: 0, rating: 0 }

w('# Grading Standards — Review')
w('')
w(`Every standard for all ${events.length} events: one line per colour. Go through them the way you went through the difficulty sheet.`)
w('')
w('## How to fill this in')
w('')
w('Each event lists its colours from Kiwikiwi up. **Edit the value after the colour.** That is the whole job.')
w('')
w('- **Change a standard:** type over the value.')
w('- **Split men and women:** replace `**Everyone**` with a `**Men**` list and a `**Women**` list.')
w('- **Leave a note:** write it on its own line starting with `>`, and I will pick it up.')
w('')
w('How a value is written:')
w('')
w('- `D3 · 20` — twenty reps on level D3. `D3 · 30s` or `D3 · 1:30` — a hold that long on D3.')
w('- `D3 · ≤ 4:05` — D3 done in 4:05 or faster. `D3 · finish` — D3 done, any time.')
w('- `D6 · +10kg` — the weighted top level with 10kg added. `D2 · 15m` — a 15m throw on D2; `D1 · any` — any throw.')
w('- `1.1× BW` — a lift of 1.1 times your bodyweight on the day. `empty bar` — any lift.')
w('- `64cm`, `1:30`, `12kg · 30s` — a jump, a hold, a load held for that long.')
w('')
w('Three rules:')
w('')
w('1. **Each colour must be harder than the one before.** A higher level always beats a lower one, however few reps.')
w('2. **Write the Open standard only.** Juniors, Masters and Grandmasters are shifted up the ladder automatically.')
w('3. **Game events list six colours.** Poroporo and above come from the head-to-head rating, after ten games.')
w('')
w('Every event says where its numbers came from. **Approved** means you settled it in review. **Drafted** means I wrote it,')
w('with the reason underneath: those are the ones to read hardest, and the hand-drafted ones hardest of all.')
w('')
w(`*generated ${today} · nothing above this line needs editing*`)
w('')
w('---')
w('')

let n = 0
for (const dn of [...new Set(events.map(e => e.domainNumber))].sort((a, b) => a - b)) {
  const inDomain = events.filter(e => e.domainNumber === dn)
  w(`## ${dn}. ${inDomain[0].domain}`)
  w('')
  for (const ev of inDomain) {
    n++
    const game = ev.tiers.some(t => t.scoring === 'sport')
    w(`### ${n}. ${ev.name}`)
    w('')
    const count = players ? ` · ${players.get(ev.name)?.size ?? 0} players have scored it` : ''
    w(`*Scored by: ${scoredBy(ev)}${count}*`)
    w('')
    if (ev.mode === 'sport') {
      w('**Rating only.** No fair solo drill exists, so every colour comes from the head-to-head rating.')
      w('')
      tally.rating++
      continue
    }
    let entry, source
    if (APPROVED[ev.name]) { entry = APPROVED[ev.name]; source = 'Approved in review.'; tally.approved++ }
    else if (CUSTOM[ev.name]) { entry = CUSTOM[ev.name]; source = `Drafted by hand. ${entry.why}`; tally.hand++ }
    else if (ev.tiers.length) { entry = drafted(ev); source = `Drafted by rule. ${entry.why}`; tally.rule++ }
    else throw new Error(`${ev.name}: no standards source`)

    const want = game ? DRILL_COLOURS : TOP
    for (const [key, list] of Object.entries(entry)) {
      if (!['M', 'F', 'E'].includes(key)) continue
      if (list.length !== want && !(entry.partial && list.length < want)) {
        throw new Error(`${ev.name} (${key}): ${list.length} colours, expected ${want}`)
      }
    }
    w(`> ${source}`)
    w('')
    const block = (label, list) => {
      w(`**${label}**`)
      w('')
      list.forEach((v, i) => w(`- ${COLOURS[i]}: ${v}`))
      w('')
    }
    if (entry.E) block('Everyone', entry.E)
    if (entry.M) block('Men', entry.M)
    if (entry.F) block('Women', entry.F)
    if (game) { w('*Poroporo and above: the head-to-head rating.*'); w('') }
  }
  w('---')
  w('')
}

fs.writeFileSync(SHEET, W.join('\n'))
console.log(`wrote ${SHEET}: ${n} events — ${tally.approved} approved, ${tally.hand} drafted by hand, ` +
  `${tally.rule} drafted by rule, ${tally.rating} rating only`)
