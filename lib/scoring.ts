// lib/scoring.ts — Pure scoring/entry logic shared by the live session UI
// (EventCard + QuickEntrySheet in app/scoring/[sessionId]/page.tsx).
// Everything here is side-effect free so it can be unit tested directly.

import { isTimedEffort, encodeDiffTime, decodeDiffTime, DT_CAP, type EventData } from '@/lib/eventData'

export function fmtTime(totalSecs: number): string {
  const abs = Math.abs(totalSecs)
  let m = Math.floor(abs / 60)
  let s = Math.round(abs % 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// How a single rung is scored, read off the tier itself. Returns null for the
// ordinary case, where the rung is scored the same way as the rest of its ladder.
export function tierScoring(
  eventData: EventData | undefined,
  tier: { name: string } | number | undefined,
): 'weight' | 'sport' | null {
  const tiers = eventData?.difficultyTiers
  if (!tiers || tier === undefined) return null
  const t = typeof tier === 'number' ? tiers[tier] : tiers.find(x => x.name === tier.name)
  return t?.scoring ?? null
}

// The pre-Sept-2026 weight rungs, kept ONLY as a fallback for rows whose event
// can no longer be resolved — `session_events.event_name` may hold a name that
// `getEventByName` no longer knows, and then there is no tier to read a flag off.
// New behaviour belongs on the tier (`scoring: 'weight'`), never in this list.
// 'Pause Chin Up' → 'Pause Chinup' (Aug 2026 roster update).
// Name -> [rung name, 0-based index] as the ladders stood BEFORE the Sept 2026
// review. These indexes are deliberately frozen at their old values: the whole
// point is to answer for a historical row whose event can no longer be resolved.
const LEGACY_WEIGHT_RUNGS: Record<string, [string, number]> = {
  'GHD Situp': ['GHD Situp', 3],
  'Pause Dips': ['Weighted RTO Dip', 4],
  'Pause Chinup': ['Weighted Chinup', 4],
  'Pause Chin Up': ['Weighted Chinup', 4],
}

export function isWeightScoredTierByIdx(
  eventName: string, tierIdx: number, eventData?: EventData,
): boolean {
  if (eventData?.difficultyTiers) return tierScoring(eventData, tierIdx) === 'weight'
  return LEGACY_WEIGHT_RUNGS[eventName]?.[1] === tierIdx
}
export function isWeightScoredTierByName(
  eventName: string, tierName: string, eventData?: EventData,
): boolean {
  if (eventData?.difficultyTiers) return tierScoring(eventData, { name: tierName }) === 'weight'
  return LEGACY_WEIGHT_RUNGS[eventName]?.[0] === tierName
}

// ── Where a win/draw/loss actually lives ─────────────────────────────────────
// Before Sept 2026 a W/D/L row meant `inputMode === 'sport'` and `raw_score` was
// literally 0, 1 or 2. Now most of them sit on a `Game` rung of a tiered ladder,
// where the result is the WITHIN-TIER term of a banded score. Every consumer
// must ask here rather than testing the mode or comparing raw_score to 2 — 26
// events moved off `sport` in one release and every such test silently stopped
// being true.

/** Does this event record a win/draw/loss at all, on any rung? */
export function eventRecordsSport(eventData: EventData | undefined): boolean {
  if (!eventData) return false
  return eventData.inputMode === 'sport' ||
    (eventData.difficultyTiers?.some(t => t.scoring === 'sport') ?? false)
}

/** The win/draw/loss term of one row, or null if that row is not a result. */
export function sportTermOf(
  eventData: EventData | undefined,
  row: { raw_score: number; difficulty_tier?: string | null },
): 0 | 1 | 2 | null {
  if (!eventData) return null
  if (eventData.inputMode === 'sport') {
    const v = row.raw_score
    return v === 2 || v === 1 || v === 0 ? v : null
  }
  const tiers = eventData.difficultyTiers
  if (!tiers) return null
  const idx = row.difficulty_tier ? tiers.findIndex(t => t.name === row.difficulty_tier) : -1
  if (idx < 0 || tiers[idx].scoring !== 'sport') return null
  const term = row.raw_score % TIER_BAND
  return term === 2 || term === 1 || term === 0 ? term : null
}

/** "3W 1D 2L" across a set of rows, or null when the event records no results. */
export function sportRecord(
  eventData: EventData | undefined,
  rows: Array<{ raw_score: number; difficulty_tier?: string | null }>,
): string | null {
  if (!eventRecordsSport(eventData)) return null
  let w = 0, d = 0, l = 0
  for (const r of rows) {
    const t = sportTermOf(eventData, r)
    if (t === 2) w++; else if (t === 1) d++; else if (t === 0) l++
  }
  const parts: string[] = []
  if (w > 0) parts.push(`${w}W`)
  if (d > 0) parts.push(`${d}D`)
  if (l > 0) parts.push(`${l}L`)
  return parts.join(' ') || null
}

export type EntryVals = {
  weightKg: string
  repCount: string
  timeMins: string
  timeSecs: string
  sprintCs: string
  distanceVal: string
  distanceUnit: 'm' | 'cm'
  sportResult: 'win' | 'draw' | 'loss' | ''
  sportScore: string
  opponentName: string
  exerciseVariation: string
  difficultyTier: string
  scoreInput: string
}

export const EMPTY_VALS: EntryVals = {
  weightKg: '', repCount: '', timeMins: '', timeSecs: '', sprintCs: '',
  distanceVal: '', distanceUnit: 'm', sportResult: '', sportScore: '',
  opponentName: '', exerciseVariation: '', difficultyTier: '', scoreInput: '',
}

// Minimal structural view of a results row — page.tsx's Result satisfies this
export type ResultLike = {
  raw_score: number
  difficulty_tier: string | null
  result_type: string | null
  opponent_name: string | null
  match_score: string | null
  weight_kg: number | null
  reps: number | null
  time_seconds: number | null
}

// Within-tier band width for difficulty encodings — a within-tier term at or
// past this would silently leak into the next tier's band, so it's rejected.
const TIER_BAND = DT_CAP
// Heaviest load the centi-kg encoding can hold inside one band.
export const MAX_ENCODABLE_KG = 99.99

// A `Game` rung records a win, draw or loss. The term stays 0/1/2 whichever way
// the rest of the ladder runs — on a timed effort the seconds term is inverted
// (`DT_CAP - secs`) and inverting a result would make a loss beat a win.
function sportTerm(result: EntryVals['sportResult']): number | null {
  if (!result) return null
  return result === 'win' ? 2 : result === 'draw' ? 1 : 0
}
const sportWord = (r: string) => r.charAt(0).toUpperCase() + r.slice(1)

// Heaviest wins, to 0.01kg, and ties on weight are shared — the same rule the
// `strength` mode already applies everywhere else on the roster. Reps are
// recorded in their own column and shown in the label, they do not rank.
function weightTerm(weightKg: number): number | null {
  if (weightKg < 0 || weightKg > MAX_ENCODABLE_KG) return null
  return Math.round(weightKg * 100)
}

export function computeScoreVals(
  mode: string, eventData: EventData | undefined, v: EntryVals
): { raw_score: number; score_label: string } | null {
  // All numeric inputs are typed as well as stepped, so every branch must
  // reject non-positive values — a negative here flips the raw_score sign and
  // silently ranks first in faster/narrower-wins events.
  const totalSecs = (parseFloat(v.timeMins) || 0) * 60 + (parseFloat(v.timeSecs) || 0)
  const isWeightVariation = !!v.exerciseVariation && (eventData?.weightVariations?.includes(v.exerciseVariation) ?? false)
  if (mode === 'strength') {
    const w = parseFloat(v.weightKg) || 0
    if (w <= 0) return null
    const r = Math.max(0, parseInt(v.repCount) || 0)
    if (eventData?.slug === 'shoulder-dislocate') {
      const label = r > 0 ? `${w}cm × ${r} rep${r !== 1 ? 's' : ''}` : `${w}cm`
      return { raw_score: -w, score_label: label }
    }
    const label = r > 0 ? `${w}kg × ${r} rep${r !== 1 ? 's' : ''}` : `${w}kg`
    return { raw_score: w, score_label: label }
  }
  if (mode === 'reps') {
    if (isWeightVariation) {
      const w = parseFloat(v.weightKg) || 0
      if (w <= 0) return null
      const r = Math.max(0, parseInt(v.repCount) || 0)
      const varLabel = v.exerciseVariation ? `${v.exerciseVariation}: ` : ''
      const label = r > 0 ? `${varLabel}${w}kg × ${r} rep${r !== 1 ? 's' : ''}` : `${varLabel}${w}kg`
      return { raw_score: w, score_label: label }
    }
    const r = parseInt(v.repCount) || 0
    if (r <= 0) return null
    const varLabel = v.exerciseVariation ? `${v.exerciseVariation}: ` : ''
    return { raw_score: r, score_label: `${varLabel}${r} reps` }
  }
  if (mode === 'time') {
    if (totalSecs <= 0) return null
    return { raw_score: -totalSecs, score_label: fmtTime(totalSecs) }
  }
  if (mode === 'hold') {
    if (totalSecs <= 0) return null
    const varLabel = v.exerciseVariation ? `${v.exerciseVariation}: ` : ''
    if (eventData?.difficultyTiers && v.difficultyTier) {
      const tierIdx = eventData.difficultyTiers.findIndex(t => t.name === v.difficultyTier)
      if (tierIdx >= 0) {
        if (totalSecs >= TIER_BAND) return null
        const rawScore = tierIdx * TIER_BAND + totalSecs
        return { raw_score: rawScore, score_label: `D${tierIdx + 1} ${v.difficultyTier} · ${fmtTime(totalSecs)}` }
      }
    }
    return { raw_score: totalSecs, score_label: `${varLabel}${fmtTime(totalSecs)}` }
  }
  if (mode === 'difficulty+time') {
    if (!v.difficultyTier) return null
    const tierIdx = eventData?.difficultyTiers?.findIndex(t => t.name === v.difficultyTier) ?? -1
    if (tierIdx < 0) return null
    if (tierScoring(eventData, tierIdx) === 'sport') {
      const term = sportTerm(v.sportResult)
      if (term === null) return null
      let l = `D${tierIdx + 1} ${v.difficultyTier} · ${sportWord(v.sportResult)}`
      if (v.opponentName) l += ` vs ${v.opponentName}`
      return { raw_score: tierIdx * TIER_BAND + term, score_label: l }
    }
    if (totalSecs <= 0 || totalSecs >= TIER_BAND) return null
    const rawScore = encodeDiffTime(tierIdx, totalSecs, isTimedEffort(eventData?.slug))
    return { raw_score: rawScore, score_label: `D${tierIdx + 1} ${v.difficultyTier} · ${fmtTime(totalSecs)}` }
  }
  if (mode === 'difficulty+reps') {
    if (!v.difficultyTier) return null
    const tierIdx = eventData?.difficultyTiers?.findIndex(t => t.name === v.difficultyTier) ?? -1
    if (tierIdx < 0) return null
    const label = `D${tierIdx + 1} ${v.difficultyTier}`
    const special = tierScoring(eventData, tierIdx)

    if (special === 'sport') {
      const term = sportTerm(v.sportResult)
      if (term === null) return null
      let l = `${label} · ${sportWord(v.sportResult)}`
      if (v.opponentName) l += ` vs ${v.opponentName}`
      // Golf and Disc Golf record the round's strokes alongside the result.
      if (v.scoreInput) l += ` (${v.scoreInput} strokes)`
      else if (v.sportScore) l += ` (${v.sportScore})`
      return { raw_score: tierIdx * TIER_BAND + term, score_label: l }
    }
    if (special === 'weight') {
      const w = parseFloat(v.weightKg) || 0
      if (w <= 0) return null
      const term = weightTerm(w)
      if (term === null) return null
      const r = parseInt(v.repCount) || 0
      const reps = r > 0 ? ` × ${r}` : ''
      return { raw_score: tierIdx * TIER_BAND + term, score_label: `${label} · ${w}kg${reps}` }
    }
    const r = parseInt(v.repCount) || 0
    if (r <= 0 || r >= TIER_BAND) return null
    return { raw_score: tierIdx * TIER_BAND + r, score_label: `${label} · ${r} reps` }
  }
  if (mode === 'difficulty+distance') {
    if (!v.difficultyTier) return null
    const tierIdx = eventData?.difficultyTiers?.findIndex(t => t.name === v.difficultyTier) ?? -1
    if (tierIdx < 0) return null
    const val = parseFloat(v.distanceVal) || 0
    // 0.1m resolution to 999.9m, which clears the longest throw by a wide
    // margin. Anything past it is rejected, never clamped: a clamp would let two
    // different throws tie, and a value one step further would spill into the
    // next rung entirely.
    if (val <= 0 || Math.round(val * 10) > TIER_BAND - 1) return null
    const term = Math.round(val * 10)
    return {
      raw_score: tierIdx * TIER_BAND + term,
      score_label: `D${tierIdx + 1} ${v.difficultyTier} · ${val}m`,
    }
  }
  if (mode === 'weight+time') {
    const w = parseFloat(v.weightKg) || 0
    const term = weightTerm(w)
    if (term === null || totalSecs <= 0) return null
    // Heavier always outranks lighter; within a load, longer wins. Bodyweight
    // (0kg) collapses to the seconds, which keeps it below every loaded hold.
    const raw_score = term * TIER_BAND + Math.min(Math.round(totalSecs), TIER_BAND - 1)
    const label = w > 0 ? `${w}kg · ${fmtTime(totalSecs)}` : `Bodyweight · ${fmtTime(totalSecs)}`
    return { raw_score, score_label: label }
  }
  if (mode === 'distance') {
    const val = parseFloat(v.distanceVal) || 0
    if (val <= 0) return null
    const raw_score = v.distanceUnit === 'm' ? Math.round(val * 100) : Math.round(val)
    return { raw_score, score_label: `${v.distanceVal}${v.distanceUnit}` }
  }
  if (mode === 'sport') {
    if (!v.sportResult) return null
    const raw_score = v.sportResult === 'win' ? 2 : v.sportResult === 'draw' ? 1 : 0
    let label = v.sportResult.charAt(0).toUpperCase() + v.sportResult.slice(1)
    if (v.opponentName) label += ` vs ${v.opponentName}`
    if (v.sportScore) label += ` (${v.sportScore})`
    return { raw_score, score_label: label }
  }
  if (mode === 'sprint') {
    const s = parseFloat(v.timeSecs) || 0
    const cs = parseInt(v.sprintCs) || 0
    if (s < 0 || cs < 0) return null
    const totalCs = Math.round(s * 100) + cs
    if (totalCs <= 0) return null
    const label = `${Math.floor(s)}s.${cs.toString().padStart(2, '0')}`
    return { raw_score: -totalCs, score_label: label }
  }
  if (mode === 'score') {
    const strokes = parseInt(v.scoreInput) || 0
    if (strokes <= 0) return null
    return { raw_score: -strokes, score_label: `${strokes} strokes (4 holes)` }
  }
  return null
}

// Prefill entry values from an existing result row
export function valsFromResult(mode: string, r: ResultLike): Partial<EntryVals> {
  const p: Partial<EntryVals> = {}
  if (r.difficulty_tier) p.difficultyTier = r.difficulty_tier
  if (mode === 'strength') {
    p.weightKg = String(r.weight_kg ?? '')
    p.repCount = String(r.reps ?? '')
  } else if (mode === 'reps') {
    p.repCount = String(r.reps ?? '')
  } else if (mode === 'difficulty+reps') {
    if (r.weight_kg) p.weightKg = String(r.weight_kg)
    else p.repCount = String(r.reps ?? '')
  } else if (mode === 'weight+time') {
    p.weightKg = String(r.weight_kg ?? '')
    const secs = r.time_seconds ?? 0
    p.timeMins = String(Math.floor(secs / 60))
    p.timeSecs = String(Math.round(secs % 60))
  } else if (mode === 'difficulty+distance') {
    // Decoded from raw_score rather than read off a column, the same way
    // `distance` and `sprint` prefill — ResultLike carries no distance field.
    p.distanceVal = String((r.raw_score % 10000) / 10)
    p.distanceUnit = 'm'
  } else if (mode === 'time' || mode === 'hold' || mode === 'difficulty+time') {
    const secs = r.time_seconds ?? 0
    p.timeMins = String(Math.floor(secs / 60))
    p.timeSecs = String(Math.round(secs % 60))
  } else if (mode === 'sprint') {
    const totalCs = Math.abs(r.raw_score)
    p.timeSecs = String(Math.floor(totalCs / 100))
    p.sprintCs = String(totalCs % 100)
  } else if (mode === 'distance') {
    const raw = r.raw_score
    if (raw >= 100) { p.distanceVal = (raw / 100).toFixed(2); p.distanceUnit = 'm' }
    else { p.distanceVal = String(raw); p.distanceUnit = 'cm' }
  } else if (mode === 'sport') {
    p.sportResult = (r.result_type as 'win' | 'draw' | 'loss') || ''
    p.opponentName = r.opponent_name ?? ''
    p.sportScore = r.match_score ?? ''
  } else if (mode === 'score') {
    p.scoreInput = String(Math.abs(r.raw_score))
  }
  return p
}

// Prefill entry values from a raw_score (e.g. season PR) — best effort per mode
export function valsFromRaw(mode: string, eventData: EventData | undefined, raw: number): Partial<EntryVals> {
  const p: Partial<EntryVals> = {}
  if (mode === 'strength') {
    p.weightKg = String(Math.abs(raw))
  } else if (mode === 'reps') {
    p.repCount = String(raw)
  } else if (mode === 'time' || mode === 'hold') {
    const secs = Math.abs(raw) % 10000
    p.timeMins = String(Math.floor(secs / 60)); p.timeSecs = String(Math.round(secs % 60))
  } else if (mode === 'sprint') {
    const totalCs = Math.abs(raw)
    p.timeSecs = String(Math.floor(totalCs / 100)); p.sprintCs = String(totalCs % 100)
  } else if (mode === 'distance') {
    if (raw >= 100) { p.distanceVal = (raw / 100).toFixed(2); p.distanceUnit = 'm' }
    else { p.distanceVal = String(raw); p.distanceUnit = 'cm' }
  } else if (mode === 'difficulty+time') {
    const tierIdxRaw = Math.floor(raw / TIER_BAND)
    if (tierScoring(eventData, tierIdxRaw) === 'sport') {
      // A Game rung on a timed-effort ladder: the term is a result, not seconds.
      const t = eventData?.difficultyTiers?.[tierIdxRaw]?.name
      if (t) p.difficultyTier = t
      const term = raw % TIER_BAND
      p.sportResult = term === 2 ? 'win' : term === 1 ? 'draw' : 'loss'
      return p
    }
    const { tierIdx, secs } = decodeDiffTime(raw, isTimedEffort(eventData?.slug))
    const tierName = eventData?.difficultyTiers?.[tierIdx]?.name
    if (tierName) p.difficultyTier = tierName
    p.timeMins = String(Math.floor(secs / 60)); p.timeSecs = String(Math.round(secs % 60))
  } else if (mode === 'difficulty+reps') {
    const tierIdx = Math.floor(raw / 10000)
    const tierName = eventData?.difficultyTiers?.[tierIdx]?.name
    if (tierName) p.difficultyTier = tierName
    p.repCount = String(raw % 10000)
  } else if (mode === 'difficulty+distance') {
    const tierIdx = Math.floor(raw / TIER_BAND)
    const tierName = eventData?.difficultyTiers?.[tierIdx]?.name
    if (tierName) p.difficultyTier = tierName
    p.distanceVal = String((raw % TIER_BAND) / 10)
    p.distanceUnit = 'm'
  } else if (mode === 'weight+time') {
    const secs = raw % TIER_BAND
    p.weightKg = String(Math.floor(raw / TIER_BAND) / 100)
    p.timeMins = String(Math.floor(secs / 60)); p.timeSecs = String(Math.round(secs % 60))
  } else if (mode === 'score') {
    p.scoreInput = String(Math.abs(raw))
  }
  return p
}
