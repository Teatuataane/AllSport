// Parses GRADING_STANDARDS_REVIEW.md and compiles every line into the number a
// result is compared against. PURE — no file writes — so the drift test can
// run it and compare with lib/standards.ts, the way the difficulty sheet's
// parser is re-run to prove the ladders and the sheet agree.
//
// Every threshold is on a scale where a higher number is better, matching how
// lib/scoring.ts writes raw_score, so lib/grading.ts needs one `>=` check:
//
//   difficulty+reps      tierIdx*10000 + reps            (weight rung: + kg*100)
//   difficulty+time      tierIdx*10000 + secs            (hold)
//                        tierIdx*10000 + (10000 - secs)  (timed effort)
//   difficulty+distance  tierIdx*10000 + metres*10
//   distance             centimetres
//   hold                 seconds
//   weight+time          kg*100*10000 + secs
//   weight+reps          kg*100*10000 + reps          ("BW · 20", "10kg · 20")
//   distance+time        tierIdx*10000 + (10000 - secs), secs PREDICTED over
//                        the event's reference distance ("≤ 4:05", "D2 · ≤ 30s")
//   weight+distance+time kg*10*10^9 + metres*10^4     ("40kg · 100m"; a colour
//                        asks for the load AND the distance, lib/grading.ts)
//   strength             a RATIO of bodyweight (kind 'ratio'), compared with
//                        weight_kg ÷ the bodyweight lib/grading.ts supplies
//
// Since the 12 Oct 2026 review the weighted holds, reps and carries may write
// their load as a share of bodyweight ("0.25× BW · 30s", "0.5× BW · ≤ 2:00").
// That ladder is marked `bwLoad` and its load key holds THOUSANDTHS of
// bodyweight; lib/grading.ts bwLoadThresholds turns it into kilograms at the
// bodyweight on the day. A ladder is all kilograms or all shares, never mixed.
// A share-of-bodyweight carry is the official 200m in a time.

export const COLOURS = ['Kiwikiwi', 'Whero', 'Karaka', 'Kōwhai', 'Kākāriki', 'Kahurangi',
  'Poroporo', 'Parahi', 'Hiriwa', 'Kōura', 'Uenuku', 'Taniwha']
export const TOP = 12
export const DRILL_COLOURS = 6
const BAND = 10000
/** The official carry distance since the 12 Oct 2026 review. */
export const CARRY_METRES = 200
const BW_SHARE = /^(\d+(?:\.\d+)?)× BW$/

/** The roster from lib/eventData.ts source, parsed rather than imported (.mjs). */
export function parseRoster(src) {
  const block = src.match(/TIMED_EFFORT_SLUGS = new Set<string>\(\[([\s\S]*?)\]\)/)
  if (!block) throw new Error('TIMED_EFFORT_SLUGS not found in lib/eventData.ts')
  // Comments stripped first: an apostrophe in one pairs with the next quote and
  // misreads every slug after it.
  const body = block[1].replace(/\/\/.*$/gm, '')
  const timed = new Set([...body.matchAll(/'([^']+)'/g)].map(m => m[1]))
  const events = []
  for (const b of src.split(/\n {2}\{\n/).slice(1)) {
    const slug = (b.match(/slug: '([^']+)'/) || [])[1]
    if (!slug) continue
    const nm = b.match(/\n {4}name: '((?:[^'\\]|\\.)*)'/)
    events.push({
      slug,
      name: (nm ? nm[1] : slug).replace(/\\'/g, "'"),
      mode: (b.match(/inputMode: '([^']+)'/) || [])[1],
      timed: timed.has(slug),
      tiers: [...b.matchAll(/\{ level: \d+, name: '((?:[^'\\]|\\.)*)'([^}]*)\}/g)].map(m => ({
        name: m[1].replace(/\\'/g, "'"),
        scoring: (m[2].match(/scoring: '(\w+)'/) || [])[1] ?? null,
      })),
    })
  }
  return events
}

/** The sheet, one entry per event: its lists by audience, or rating-only. */
export function parseSheet(text) {
  const out = []
  let ev = null, list = null
  for (const [i, line] of text.split('\n').entries()) {
    const h = line.match(/^### (\d+)\. (.+)$/)
    if (h) { ev = { name: h[2].trim(), lists: {}, ratingOnly: false }; out.push(ev); list = null; continue }
    if (!ev) continue
    if (/^\*\*Rating only\.\*\*/.test(line)) { ev.ratingOnly = true; continue }
    const a = line.match(/^\*\*(Everyone|Men|Women)\*\*\s*$/)
    if (a) {
      const key = { Everyone: 'E', Men: 'M', Women: 'F' }[a[1]]
      if (ev.lists[key]) throw new Error(`${ev.name}: two ${a[1]} lists`)
      list = ev.lists[key] = []
      continue
    }
    const c = line.match(/^- ([^:]+): (.+?)\s*$/)
    if (c) {
      if (!list) throw new Error(`${ev.name}, line ${i + 1}: a colour before any Everyone/Men/Women heading`)
      const want = COLOURS[list.length]
      if (c[1].trim() !== want) throw new Error(`${ev.name}: expected ${want ?? 'no more colours'} next, found ${c[1].trim()}`)
      list.push(c[2])
    }
  }
  return out
}

const secsOf = v => {
  const m = v.match(/^(?:(\d+):(\d{2})|(\d+(?:\.\d+)?)s)$/)
  if (!m) return null
  return m[3] != null ? +m[3] : +m[1] * 60 + +m[2]
}

/** An open-distance effort: "finish", or "≤ 4:05" as the time predicted over the reference. */
function effortThreshold(base, rest, bad) {
  if (rest === 'finish' || rest === 'any') return base + 1
  const m = rest.match(/^≤ (.+)$/)
  const s = m && secsOf(m[1])
  if (s == null) throw bad('an open distance effort: expected "finish" or "≤ 4:05"')
  return base + (BAND - s)
}

/** One sheet value to its threshold. Throws with the event and value named. */
export function threshold(ev, value, load) {
  const bad = why => new Error(`${ev.name}: "${value}" — ${why}`)
  const v = value.trim()

  if (ev.mode === 'strength') {
    if (v === 'empty bar') return 0
    const m = v.match(/^(\d+(?:\.\d+)?)× BW$/)
    if (!m) throw bad('expected "empty bar" or "1.1× BW"')
    return Number(m[1])
  }
  if (ev.mode === 'distance') {
    if (v === 'any') return 1
    const m = v.match(/^(\d+(?:\.\d+)?)(cm|m)$/)
    if (!m) throw bad('expected "any", "64cm" or "2.4m"')
    return m[2] === 'm' ? Math.round(Number(m[1]) * 100) : Number(m[1])
  }
  if (ev.mode === 'hold') {
    // "any": any hold at all, one second or more.
    if (v === 'any') return 1
    const s = secsOf(v)
    if (s == null) throw bad('expected "45s" or "1:30"')
    return s
  }
  if (ev.mode === 'weight+time' || ev.mode === 'weight+reps') {
    const reps = ev.mode === 'weight+reps'
    const m = v.match(/^(.+?) · (.+)$/)
    const other = m && (reps ? (/^\d+$/.test(m[2]) ? Number(m[2]) : null) : secsOf(m[2]))
    const share = m && m[1].match(BW_SHARE)
    const kg = m && (m[1] === 'BW' ? 0 : /^\d+(?:\.\d+)?kg$/.test(m[1]) ? Number(m[1].slice(0, -2)) : null)
    if (!m || other == null || (kg == null && !share)) {
      throw bad(reps ? 'expected "BW · 20", "10kg · 20" or "0.1× BW · 20"' : 'expected "BW · 30s", "12kg · 30s" or "0.25× BW · 30s"')
    }
    if (share) { load?.('bw'); return Math.round(Number(share[1]) * 1000) * BAND + other }
    if (kg > 0) load?.('kg')
    return Math.round(kg * 100) * BAND + other
  }
  if (ev.mode === 'weight+distance+time') {
    const m = v.match(/^(\d+(?:\.\d+)?)kg · (\d+)m$/)
    if (m) { load?.('kg'); return Math.round(Number(m[1]) * 10) * 1e9 + Number(m[2]) * BAND }
    // "0.5× BW · ≤ 2:00": that share of bodyweight over the official 200m, in
    // the time; "· any" in any time.
    const b = v.match(/^(\d+(?:\.\d+)?)× BW · (.+)$/)
    if (!b) throw bad('expected "0.5× BW · ≤ 2:00", "0.1× BW · any" or "40kg · 100m"')
    load?.('bw')
    return Math.round(Number(b[1]) * 1000) * 1e9 + CARRY_METRES * BAND + effortThreshold(0, b[2], bad)
  }
  if (ev.mode === 'distance+time' && ev.tiers.length === 0) return effortThreshold(0, v, bad)

  // Tiered: "D3 · …"
  const t = v.match(/^D(\d+) · (.+)$/)
  if (!t) throw bad('expected a level, as in "D3 · 20"')
  const idx = Number(t[1]) - 1
  const tier = ev.tiers[idx]
  if (!tier) throw bad(`${ev.name} has no level D${idx + 1}`)
  if (tier.scoring === 'sport') throw bad('the Game rung carries no standard; its colours come from the rating')
  const rest = t[2].trim()
  const base = idx * BAND
  // "D3 · any" (12 Oct 2026 review): doing the level at all, any reps, any
  // hold, any time. Every scored row on a level sits at base + 1 or above, so
  // this is the lowest threshold on that level. Not on a weighted rung, where
  // the number is the load.
  if (rest === 'any' && tier.scoring !== 'weight') return base + 1

  if (tier.scoring === 'weight') {
    const m = rest.match(/^\+(\d+(?:\.\d+)?)kg$/)
    if (!m) throw bad(`D${idx + 1} is the weighted level: expected "+10kg"`)
    return base + Math.round(Number(m[1]) * 100)
  }
  if (ev.mode === 'difficulty+reps') {
    if (!/^\d+$/.test(rest)) throw bad('expected a rep count')
    return base + Number(rest)
  }
  if (ev.mode === 'difficulty+distance') {
    if (rest === 'any') return base + 1
    const m = rest.match(/^(\d+(?:\.\d+)?)m$/)
    if (!m) throw bad('expected "any" or "15m"')
    return base + Math.round(Number(m[1]) * 10)
  }
  if (ev.mode === 'distance+time') return effortThreshold(base, rest, bad)
  if (ev.mode === 'difficulty+time') {
    if (ev.timed) {
      // Any completed time leaves a term of at least 1, so "finish" is base + 1.
      if (rest === 'finish') return base + 1
      const m = rest.match(/^≤ (.+)$/)
      const s = m && secsOf(m[1])
      if (s == null) throw bad('a timed effort: expected "finish" or "≤ 4:05"')
      return base + (BAND - s)
    }
    const s = secsOf(rest)
    if (s == null) throw bad('a hold: expected "30s" or "1:30"')
    return base + s
  }
  throw bad(`no rule for mode ${ev.mode}`)
}

/**
 * Compile the sheet against the roster. Throws on anything malformed: a missing
 * or unknown event, a colour out of order, a ladder that does not get harder at
 * every colour, or a full ladder on the wrong number of colours.
 */
export function compile(sheetText, rosterSrc) {
  const roster = parseRoster(rosterSrc)
  const sheet = parseSheet(sheetText)
  const byName = new Map(sheet.map(s => [s.name, s]))
  const errors = []
  const standards = []
  const partial = []

  for (const s of sheet) if (!roster.some(e => e.name === s.name)) errors.push(`${s.name}: in the sheet but not on the roster`)

  for (const ev of roster) {
    const s = byName.get(ev.name)
    if (!s) { errors.push(`${ev.name}: missing from the sheet`); continue }
    const game = ev.tiers.some(t => t.scoring === 'sport')
    if (ev.mode === 'sport') {
      if (!s.ratingOnly) errors.push(`${ev.name}: a pure contest must be marked Rating only`)
      standards.push({ slug: ev.slug, kind: 'rating', game: true })
      continue
    }
    const keys = Object.keys(s.lists)
    if (!keys.length) { errors.push(`${ev.name}: no standards`); continue }
    if (s.lists.E && keys.length > 1) { errors.push(`${ev.name}: has an Everyone list and a Men or Women list`); continue }
    if (!s.lists.E && !(s.lists.M && s.lists.F)) { errors.push(`${ev.name}: needs both a Men and a Women list`); continue }

    const want = game ? DRILL_COLOURS : TOP
    const entry = { slug: ev.slug, kind: ev.mode === 'strength' ? 'ratio' : 'raw', game }
    for (const key of keys) {
      const label = { E: 'Everyone', M: 'Men', F: 'Women' }[key]
      let nums
      const loads = new Set()
      try { nums = s.lists[key].map(v => threshold(ev, v, l => loads.add(l))) } catch (e) { errors.push(e.message); continue }
      if (loads.size > 1) { errors.push(`${ev.name} (${label}): mixes kilograms and shares of bodyweight`); continue }
      if (loads.has('bw')) entry.bwLoad = true
      if (nums.length > want) errors.push(`${ev.name} (${label}): ${nums.length} colours; a ${game ? 'Game-rung event lists six' : 'ladder lists twelve'}`)
      if (nums.length < want) partial.push(`${ev.name} (${label}): ${nums.length} of ${want}`)
      for (let i = 1; i < nums.length; i++) {
        if (!(nums[i] > nums[i - 1])) {
          errors.push(`${ev.name} (${label}): ${COLOURS[i]} "${s.lists[key][i]}" is not harder than ${COLOURS[i - 1]} "${s.lists[key][i - 1]}"`)
        }
      }
      entry[key === 'E' ? 'all' : key] = nums
    }
    standards.push(entry)
  }

  if (errors.length) {
    const e = new Error(`the standards sheet has ${errors.length} problem${errors.length === 1 ? '' : 's'}:\n  ${errors.join('\n  ')}`)
    e.problems = errors
    throw e
  }
  return { standards, partial }
}

const num = n => Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000)
const arr = a => `[${a.map(num).join(', ')}]`

/** The lib/standards.ts source for a compiled sheet. Deterministic, so the drift test can compare text. */
export function render({ standards }) {
  const L = []
  L.push('// GENERATED by scripts/apply-standards-sheet.mjs from GRADING_STANDARDS_REVIEW.md.')
  L.push('// Do not edit: change the sheet and re-run the script. __tests__/standards.test.ts')
  L.push('// fails if this file and the sheet ever disagree.')
  L.push('//')
  L.push('// Thresholds are the Open standard for each colour, Kiwikiwi first, on a scale')
  L.push('// where higher is always better (see scripts/standards-sheet.mjs). Age is applied')
  L.push('// by lib/grading.ts shifting the ladder, never by a number written here.')
  L.push('')
  L.push("export type StandardKind = 'raw' | 'ratio' | 'rating'")
  L.push('')
  L.push('export type EventStandards = {')
  L.push("  /** 'raw' compares with results.raw_score; 'ratio' with the estimated 1RM (raw_score) ÷ bodyweight; 'rating' has none. */")
  L.push('  kind: StandardKind')
  L.push('  /** Topped by a Game rung: the drills stop at Kahurangi and the rating gives the rest. */')
  L.push('  game: boolean')
  L.push('  /** One ladder for everyone, or one per sex. */')
  L.push('  all?: readonly number[]')
  L.push('  M?: readonly number[]')
  L.push('  F?: readonly number[]')
  L.push('  /** Loads are thousandths of bodyweight, not kilograms (lib/grading.ts bwLoadThresholds). */')
  L.push('  bwLoad?: true')
  L.push('}')
  L.push('')
  L.push('export const STANDARDS: Readonly<Record<string, EventStandards>> = {')
  for (const s of [...standards].sort((a, b) => a.slug.localeCompare(b.slug))) {
    const parts = [`kind: '${s.kind}'`, `game: ${s.game}`]
    if (s.all) parts.push(`all: ${arr(s.all)}`)
    if (s.M) parts.push(`M: ${arr(s.M)}`)
    if (s.F) parts.push(`F: ${arr(s.F)}`)
    if (s.bwLoad) parts.push('bwLoad: true')
    L.push(`  '${s.slug}': { ${parts.join(', ')} },`)
  }
  L.push('}')
  L.push('')
  return L.join('\n')
}
