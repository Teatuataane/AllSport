#!/usr/bin/env node
// Grading readiness — READ ONLY.
//
// Answers one question: how close is the club to being gradeable?
//
// Grading needs the standard met in HALF of a domain's events, and the overall
// grade is the LOWEST domain — so a single domain with too few gradeable events
// blocks every player. This report tracks the two things that gate the launch:
//
//   1. ROSTER READINESS — can each domain even offer six gradeable events?
//      A `sport` event (win/draw/loss) can never carry a standard, and a tiered
//      event's standard cannot be written until the event-difficulty overhaul
//      settles its tiers.
//   2. PLAYER READINESS — has each player played six distinct events per
//      domain yet? One session gives one event per domain, so this accrues
//      over roughly ten to twelve sessions.
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
// same .mjs reason. Only name / domain / input mode are read, all of which are
// simple literals — if this ever stops matching, the parsed count below will
// not be 120 and the script says so instead of quietly reporting on a subset.
function roster() {
  const src = readFileSync(new URL('../lib/eventData.ts', import.meta.url), 'utf8')
  const events = []
  for (const block of src.split(/\n {2}\{\n/).slice(1)) {
    const grab = (re) => (block.match(re) || [])[1]
    const name = grab(/^\s*name: [`'"](.+?)[`'"],/m)
    const domainNumber = grab(/^\s*domainNumber: (\d+),/m)
    const inputMode = grab(/^\s*inputMode: ['"](.+?)['"],/m)
    if (name && domainNumber && inputMode) events.push({ name, domainNumber: +domainNumber, inputMode })
  }
  return events
}

const DOMAINS = ['', 'Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Anaerobic Endurance',
  'Aerobic Endurance', 'Flexibility', 'Body Awareness', 'Coordination', 'Aim & Precision']
const TIERED = ['difficulty+time', 'difficulty+reps']
// Half of twelve. A domain that cannot offer this many gradeable events blocks
// every player's overall grade, because the overall grade is the lowest domain.
// Mirrors DOMAIN_FRACTION in lib/grading.ts, which is authoritative — this file
// is .mjs and cannot import it. If that fraction ever changes, change this too.
const NEEDED = 6

const events = roster()
console.log(`\nRoster parsed: ${events.length} events` + (events.length === 120 ? '' : '  ⚠ expected 120'))

// ── 1. Roster readiness ─────────────────────────────────────────────────────
console.log('\n─── ROSTER READINESS ────────────────────────────────────────────────')
console.log('A "sport" event can never carry a standard. A tiered event cannot have one')
console.log('written until the event-difficulty overhaul settles its tiers.\n')
console.log('DOMAIN                  READY  TIERED  SPORT   STATUS')
let blocked = 0
for (let d = 1; d <= 10; d++) {
  const inDomain = events.filter((e) => e.domainNumber === d)
  const sport = inDomain.filter((e) => e.inputMode === 'sport').length
  const tiered = inDomain.filter((e) => TIERED.includes(e.inputMode)).length
  const ready = inDomain.length - sport - tiered
  const ok = ready >= NEEDED
  if (!ok) blocked++
  console.log(
    `${String(d).padStart(2)}. ${DOMAINS[d].padEnd(20)}${String(ready).padStart(5)}${String(tiered).padStart(8)}${String(sport).padStart(7)}   ` +
    (ok ? 'ready' : `BLOCKED — needs ${NEEDED - ready} more from the overhaul`)
  )
}
console.log(
  blocked === 0
    ? '\n  All ten domains can offer six gradeable events. Grading can ship.'
    : `\n  ${blocked} of 10 domains cannot reach ${NEEDED} gradeable events.\n` +
      '  Grading CANNOT ship until the event-difficulty overhaul lands: the overall\n' +
      '  grade is the lowest domain, so one blocked domain caps every player.'
)

// ── 2. Player readiness ─────────────────────────────────────────────────────
const [results, sessionEvents, players] = await Promise.all([
  all('results?select=player_id,event_id&order=id.asc'),
  all('session_events?select=id,event_name,domain_number&order=id.asc'),
  all('players_public?select=id,display_name&order=id.asc'),
])
const eventOf = Object.fromEntries(sessionEvents.map((e) => [e.id, e]))
const nameOf = Object.fromEntries(players.map((p) => [p.id, p.display_name]))

// Distinct events per (player, domain). Guests (no player_id) are excluded —
// they hold no grade.
//
// Only events on the CURRENT roster count. Session history still holds retired
// events (Football Dribble, 400m Race and the rest of the session-27 removals),
// and counting those would overstate readiness — a retired event can never be
// graded, so it can never contribute to the six.
const current = new Set(events.map((e) => e.name))
const played = new Map()
for (const r of results) {
  const e = eventOf[r.event_id]
  if (!e || !r.player_id || !current.has(e.event_name)) continue
  if (!played.has(r.player_id)) played.set(r.player_id, new Map())
  const byDomain = played.get(r.player_id)
  if (!byDomain.has(e.domain_number)) byDomain.set(e.domain_number, new Set())
  byDomain.get(e.domain_number).add(e.event_name)
}

const rows = [...played.entries()].map(([pid, byDomain]) => {
  const counts = Array.from({ length: 10 }, (_, i) => (byDomain.get(i + 1) || new Set()).size)
  return { name: nameOf[pid] || '(unknown)', counts, at: counts.filter((n) => n >= NEEDED).length }
}).sort((a, b) => b.at - a.at || b.counts.reduce((x, y) => x + y, 0) - a.counts.reduce((x, y) => x + y, 0))

console.log('\n─── PLAYER READINESS ────────────────────────────────────────────────')
console.log(`Distinct events played per domain. ${NEEDED} needed in every domain before a`)
console.log('player can hold an overall grade.\n')
console.log('PLAYER              ' + Array.from({ length: 10 }, (_, i) => String(i + 1).padStart(4)).join('') + '   DOMAINS@6+')
for (const r of rows) {
  console.log(r.name.slice(0, 18).padEnd(20) + r.counts.map((n) => String(n).padStart(4)).join('') + `      ${r.at}/10`)
}
const ready = rows.filter((r) => r.at === 10).length
console.log(`\n  ${ready} of ${rows.length} players have six distinct events in all ten domains.`)
console.log('  A session draws one event per domain, so this accrues over roughly ten')
console.log('  to twelve sessions — it is a matter of attendance, not of design.\n')
