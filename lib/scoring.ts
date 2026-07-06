// lib/scoring.ts — Pure scoring/entry logic shared by the live session UI
// (EventCard + QuickEntrySheet in app/scoring/[sessionId]/page.tsx).
// Everything here is side-effect free so it can be unit tested directly.

import { isTimedEffort, encodeDiffTime, decodeDiffTime, type EventData } from '@/lib/eventData'

export function fmtTime(totalSecs: number): string {
  const abs = Math.abs(totalSecs)
  let m = Math.floor(abs / 60)
  let s = Math.round(abs % 60)
  if (s === 60) { m += 1; s = 0 }
  return `${m}:${s.toString().padStart(2, '0')}`
}

// Tiers whose input switches from reps to added weight
export function isWeightScoredTierByIdx(eventName: string, tierIdx: number): boolean {
  return (
    (eventName === 'GHD Situp' && tierIdx === 3) ||
    (eventName === 'Pause Dips' && tierIdx === 4) ||
    (eventName === 'Pause Chin Up' && tierIdx === 4)
  )
}
export function isWeightScoredTierByName(eventName: string, tierName: string): boolean {
  return (
    (eventName === 'GHD Situp' && tierName === 'GHD Situp') ||
    (eventName === 'Pause Dips' && tierName === 'Weighted RTO Dip') ||
    (eventName === 'Pause Chin Up' && tierName === 'Weighted Chinup')
  )
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
const TIER_BAND = 10000

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
    if (!v.difficultyTier || totalSecs <= 0 || totalSecs >= TIER_BAND) return null
    const tierIdx = eventData?.difficultyTiers?.findIndex(t => t.name === v.difficultyTier) ?? -1
    if (tierIdx < 0) return null
    const rawScore = encodeDiffTime(tierIdx, totalSecs, isTimedEffort(eventData?.slug))
    return { raw_score: rawScore, score_label: `D${tierIdx + 1} ${v.difficultyTier} · ${fmtTime(totalSecs)}` }
  }
  if (mode === 'difficulty+reps') {
    if (!v.difficultyTier) return null
    const tierIdx = eventData?.difficultyTiers?.findIndex(t => t.name === v.difficultyTier) ?? -1
    if (tierIdx < 0) return null
    if (isWeightScoredTierByIdx(eventData?.name ?? '', tierIdx)) {
      const w = parseFloat(v.weightKg) || 0
      if (w <= 0) return null
      return { raw_score: w, score_label: `D${tierIdx + 1} ${v.difficultyTier} · ${w}kg` }
    }
    const r = parseInt(v.repCount) || 0
    if (r <= 0 || r >= TIER_BAND) return null
    const rawScore = tierIdx * TIER_BAND + r
    return { raw_score: rawScore, score_label: `D${tierIdx + 1} ${v.difficultyTier} · ${r} reps` }
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
    const { tierIdx, secs } = decodeDiffTime(raw, isTimedEffort(eventData?.slug))
    const tierName = eventData?.difficultyTiers?.[tierIdx]?.name
    if (tierName) p.difficultyTier = tierName
    p.timeMins = String(Math.floor(secs / 60)); p.timeSecs = String(Math.round(secs % 60))
  } else if (mode === 'difficulty+reps') {
    const tierIdx = Math.floor(raw / 10000)
    const tierName = eventData?.difficultyTiers?.[tierIdx]?.name
    if (tierName) p.difficultyTier = tierName
    p.repCount = String(raw % 10000)
  } else if (mode === 'score') {
    p.scoreInput = String(Math.abs(raw))
  }
  return p
}
