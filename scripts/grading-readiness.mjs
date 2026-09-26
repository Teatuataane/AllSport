#!/usr/bin/env node
// Grading readiness — READ ONLY.
//
// Answers one question: how close is the club to being gradeable?
//
// Grading needs the standard met in HALF of a domain's gradeable events, and
// the overall grade is the AVERAGE of the ten domains — so a domain that cannot
// offer enough gradeable events drags every player's overall down. This report tracks the two
// things that gate the launch:
//
//   1. ROSTER READINESS — can each domain offer enough gradeable events?
//      Since the September 2026 difficulty overhaul this is nearly free: every
//      ladder has drill rungs beneath the contest, and since the grading
//      ladders gave the pure contests drills too, Wrestling is the only pure
//      `sport` event left. No domain is blocked.
//   2. PLAYER READINESS — has each player played enough distinct GRADEABLE
//      events per domain? One session gives one event per domain, drawn from
//      twelve, so this accrues over roughly ten to twelve sessions.
//
// Deliberately contains NO copy of the grade ladder. lib/grading.ts is the
// single source of truth for that, and this file is .mjs so it cannot import
// it — duplicating it here is exactly how six inline copies of the old colour
// ladder came to disagree with each other.
//
//   node scripts/grading-readiness.mjs

import { readFileSync } from 'node:fs'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n').filter(Boolean).map((l) => l.split(/=(.*)/s).slice(0, 2))
)
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!URL_ || !KEY) throw new Error('.env.local is missing the Supabase URL or anon key')

// PostgREST caps a response at 1000 rows, so anything unbounded must be paged.
async function all(path) {
  const out = []
  for (let offset = 0; ; offset += 1000) {
    const res = await fetch(`${URL_}/rest/v1/${path}&limit=1000&offset=${offset}`, { headers: { apikey: KEY } })
    if (!res.ok) throw new Error(`${path} -> ${res.status} ${await res.text()}`)
    const page = await res.json()
    out.push(...page)
    if (page.length < 1000) return out
  }
}

// The roster is parsed out of lib/eventData.ts rather than imported, for the
// same .mjs reason. If this ever stops matching, the parsed count below will
// not be 128 and the script says so instead of quietly reporting on a subset.
//
// An event is GRADEABLE when it has at least one rung that is not the contest.
// After the overhaul a ladder tops out in a `scoring: 'sport'` Game rung — that
// rung records a win, draw or loss and can carry no percentile, but every drill
// rung beneath it can. A pure `sport` event has no ladder at all and is the
// only kind that can never be graded.
function roster() {
  const src = readFileSync(new URL('../lib/eventData.ts', import.meta.url), 'utf8')
  const events = []
  for (const block of src.split(/\n {2}\{\n/).slice(1)) {
    const grab = (re) => (block.match(re) || [])[1]
    const name = grab(/^\s*name: [`'"](.+?)[`'"],/m)
    const domainNumber = grab(/^\s*domainNumber: (\d+),/m)
    const inputMode = grab(/^\s*inputMode: ['"](.+?)['"],/m)
    if (!name || !domainNumber || !inputMode) continue
    // Tiers are inline objects inside `difficultyTiers: [ ... ]`, one per line:
    //   { level: 5, name: 'Game', scoring: 'sport' },
    // Count `{ level:` entries, NOT `name:` lines — the event's own name and
    // every tier name would both match a bare `name:` and the count would be
    // meaningless.
    const arr = block.match(/difficultyTiers: \[([\s\S]*?)\n {4}\]/)
    const rungs = arr ? [...arr[1].matchAll(/\{ level: \d+[^}]*\}/g)].map((m) => m[0]) : []
    const gameRungs = rungs.filter((r) => /scoring: 'sport'/.test(r)).length
    // An untiered event is gradeable unless it is a pure contest.
    const drillRungs = rungs.length > 0 ? rungs.length - gameRungs : inputMode === 'sport' ? 0 : 1
    events.push({ name, domainNumber: +domainNumber, inputMode, rungs: rungs.length, gameRungs, drillRungs })
  }
  return events
}

const DOMAINS = ['', 'Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Anaerobic Endurance',
  'Aerobic Endurance', 'Flexibility', 'Body Awareness', 'Coordination', 'Aim & Precision']
// The rule is IMPORTED, not restated. This script used to keep its own copy of
// the half-the-domain rule, and it drifted: when Flexibility went to sixteen
// events the copy reported a threshold of 8 while the engine asked for 6.
// lib/grading.ts imports nothing, so Node 24's built-in type stripping loads it
// directly and the command stays `node scripts/grading-readiness.mjs`.
const { requiredForDomain: needed, DOMAIN_REQUIRED_CAP } = await import('../lib/grading.ts')

const events = roster()
// Compared with the slugs the source declares, not a pinned count: a pinned 120
// is what broke the standards generator when the roster grew.
const declared = (readFileSync('lib/eventData.ts', 'utf8').match(/^\s+slug: '/gm) || []).length
console.log(`\nRoster parsed: ${events.length} events` + (events.length === declared ? '' : `  ⚠ the source declares ${declared}`))

// ── 1. Roster readiness ─────────────────────────────────────────────────────
console.log('\n─── ROSTER READINESS ────────────────────────────────────────────────')
console.log('A pure `sport` event can never carry a standard. Everything else can:')
console.log('a ladder that tops out in a Game rung is graded on the drill rungs.\n')
console.log('DOMAIN                  GRADEABLE  CONTESTS  NEEDED')
let blocked = 0
const gradeableByDomain = {}
for (let d = 1; d <= 10; d++) {
  const inDomain = events.filter((e) => e.domainNumber === d)
  const gradeable = inDomain.filter((e) => e.drillRungs > 0)
  gradeableByDomain[d] = new Set(gradeable.map((e) => e.name))
  const req = needed(gradeable.length)
  if (gradeable.length < 2) blocked++
  console.log(
    `${String(d).padStart(2)}. ${DOMAINS[d].padEnd(20)}${String(gradeable.length).padStart(6)}/${String(inDomain.length).padEnd(3)}` +
    `${String(inDomain.length - gradeable.length).padStart(9)}${String(req).padStart(8)}`
  )
}
console.log(
  blocked === 0
    ? '\n  Every domain can be graded. The launch gate is CLEAR.\n' +
      '  Before the September 2026 overhaul, eight of ten domains were blocked —\n' +
      '  Coordination and Aim & Precision could not be graded at all.'
    : `\n  ${blocked} of 10 domains cannot be graded. Grading cannot ship: the overall\n` +
      '  grade is the average of ten domains, so a blocked domain drags every player down.'
)

// ── 2. Player readiness ─────────────────────────────────────────────────────
const [results, sessionEvents, players] = await Promise.all([
  all('results?select=player_id,event_id&order=id.asc'),
  all('session_events?select=id,event_name,domain_number&order=id.asc'),
  all('players_public?select=id,display_name&order=id.asc'),
])
const eventOf = Object.fromEntries(sessionEvents.map((e) => [e.id, e]))
const nameOf = Object.fromEntries(players.map((p) => [p.id, p.display_name]))

// Distinct GRADEABLE events per (player, domain). Guests (no player_id) are
// excluded — they hold no grade. Retired events are excluded too: session
// history still holds them, and a retired event can never be graded, so it can
// never count toward the threshold.
const played = new Map()
for (const r of results) {
  const e = eventOf[r.event_id]
  if (!e || !r.player_id) continue
  if (!gradeableByDomain[e.domain_number]?.has(e.event_name)) continue
  if (!played.has(r.player_id)) played.set(r.player_id, new Map())
  const byDomain = played.get(r.player_id)
  if (!byDomain.has(e.domain_number)) byDomain.set(e.domain_number, new Set())
  byDomain.get(e.domain_number).add(e.event_name)
}

const rows = [...played.entries()].map(([pid, byDomain]) => {
  const counts = Array.from({ length: 10 }, (_, i) => (byDomain.get(i + 1) || new Set()).size)
  const met = counts.filter((n, i) => n >= needed(gradeableByDomain[i + 1].size)).length
  return { name: nameOf[pid] || '(unknown)', counts, met }
}).sort((a, b) => b.met - a.met || b.counts.reduce((x, y) => x + y, 0) - a.counts.reduce((x, y) => x + y, 0))

console.log('\n─── PLAYER READINESS ────────────────────────────────────────────────')
console.log('Distinct gradeable events played per domain, against each domain\'s own')
console.log(`threshold (half its gradeable events, capped at ${DOMAIN_REQUIRED_CAP}).\n`)
console.log('PLAYER              ' + Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(4)).join('') + '   DOMAINS MET')
for (const r of rows) {
  console.log(r.name.slice(0, 18).padEnd(20) + r.counts.map((n) => String(n).padStart(4)).join('') + `      ${r.met}/10`)
}
const ready = rows.filter((r) => r.met === 10).length
console.log(`\n  ${ready} of ${rows.length} players clear the threshold in all ten domains.`)
console.log('  A session draws one event per domain, so this accrues over roughly ten')
console.log('  to twelve sessions — it is a matter of attendance, not of design.\n')
