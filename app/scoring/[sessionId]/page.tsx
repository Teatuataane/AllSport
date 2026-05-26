'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS, getEventByName, type EventData } from '@/lib/eventData'

const supabase = createClient()

// ─── Types ────────────────────────────────────────────────────────────────────

type SessionEvent = {
  id: string
  domain_number: number
  domain_name: string
  event_name: string
  event_slug: string
  input_mode: string
  display_order: number
}

type Result = {
  id: string
  player_id: string | null
  player_name: string
  event_id: string
  raw_score: number
  score_label: string
  placement: number | null
  points_earned: number | null
  difficulty_tier: string | null
  result_type: string | null
  opponent_name: string | null
  match_score: string | null
  weight_kg: number | null
  reps: number | null
  time_seconds: number | null
  is_pr: boolean
  effort_task_completions: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtTime(totalSecs: number): string {
  const abs = Math.abs(totalSecs)
  const m = Math.floor(abs / 60)
  const s = Math.round(abs % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function formatPR(rawScore: number, inputMode: string): string {
  switch (inputMode) {
    case 'strength':   return `${rawScore} kg`
    case 'reps':       return `${rawScore} reps`
    case 'time':
    case 'sprint':     return fmtTime(Math.abs(rawScore))
    case 'hold':       return fmtTime(rawScore)
    case 'distance':   return rawScore >= 100 ? `${(rawScore / 100).toFixed(2)}m` : `${rawScore}cm`
    case 'sport':      return rawScore === 2 ? 'Win' : rawScore === 1 ? 'Draw' : 'Loss'
    case 'score': return `${Math.abs(rawScore)} strokes`
    case 'difficulty+time': {
      const tierIdx = Math.floor(rawScore / 10000)
      const secs = rawScore % 10000
      return `D${tierIdx + 1} · ${fmtTime(secs)}`
    }
    case 'difficulty+reps': {
      const tierIdx = Math.floor(rawScore / 10000)
      const reps = rawScore % 10000
      return `D${tierIdx + 1} · ${reps} reps`
    }
    default:           return String(rawScore)
  }
}

function calcPlacementPts(rank: number, playerCount: number): number {
  // No floor on gap — minimum 10 applies to earned points only
  const gap = 100 / playerCount
  return Math.max(100 - (rank - 1) * gap, 10)
}

function sportWDL(results: Result[]): string {
  const w = results.filter(r => r.raw_score === 2).length
  const d = results.filter(r => r.raw_score === 1).length
  const l = results.filter(r => r.raw_score === 0).length
  const parts: string[] = []
  if (w > 0) parts.push(`${w}W`)
  if (d > 0) parts.push(`${d}D`)
  if (l > 0) parts.push(`${l}L`)
  return parts.join(' ') || '–'
}

// ─── Effort helpers ───────────────────────────────────────────────────────────

function calcEffortLevel(myEventResults: Result[]): number {
  if (myEventResults.length === 0) return 0
  const participation = 1
  const isPR = myEventResults.some(r => r.is_pr) ? 1 : 0
  const taskCompletions = myEventResults.reduce((sum, r) => sum + (r.effort_task_completions || 0), 0)
  return participation + isPR + taskCompletions
}

function calcTotalEffortLevel(allMyResults: Result[], events: SessionEvent[]): number {
  const total = events.reduce((sum, ev) => {
    return sum + calcEffortLevel(allMyResults.filter(r => r.event_id === ev.id))
  }, 0)
  return Math.min(total, 20)
}

type EffortTask = { label: string; count: number; isRepeatable: boolean }

function computeEffortTasks(
  myEventResults: Result[],
  eventData: EventData | undefined,
  effectivePR: number | null,
  mode: string
): EffortTask[] {
  if (!eventData) return []

  if (mode === 'sport') {
    const extras = myEventResults.slice(1).length
    return [{ label: 'Play a game vs a new opponent', count: extras, isRepeatable: true }]
  }

  if (mode === 'score') {
    const extras = myEventResults.slice(1).length
    return [{ label: 'Complete an additional 4 holes', count: extras, isRepeatable: true }]
  }

  if (mode === 'hold') {
    const count = myEventResults.filter(r => r.raw_score >= 120).length
    return [{ label: 'Hold for 2 minutes', count, isRepeatable: true }]
  }

  if (effectivePR === null) return []

  if (mode === 'strength') {
    const kg = Math.round(effectivePR * 0.8)
    const count = myEventResults.filter(r => (r.weight_kg ?? 0) >= kg && (r.reps ?? 0) >= 5).length
    return [{ label: `${kg}kg × 5 reps`, count, isRepeatable: true }]
  }

  if (mode === 'sprint') {
    const threshold = Math.round(effectivePR / 0.8)
    const count = myEventResults.filter(r => r.raw_score >= threshold).length
    const thresholdSecs = Math.abs(threshold) / 100
    const s = Math.floor(thresholdSecs)
    const cs = Math.round((thresholdSecs - s) * 100)
    return [{ label: `Sprint in ${s}.${cs.toString().padStart(2, '0')}s or faster`, count, isRepeatable: true }]
  }

  if (mode === 'time') {
    const threshold = Math.round(effectivePR * 0.8)
    const count = myEventResults.filter(r => r.raw_score >= threshold).length
    return [{ label: `Hold for ${fmtTime(threshold)} or longer`, count, isRepeatable: true }]
  }

  if (mode === 'distance') {
    const target = Math.round(effectivePR * 0.8)
    const count = myEventResults.filter(r => r.raw_score >= target).length
    const targetStr = target >= 100 ? `${(target / 100).toFixed(2)}m` : `${target}cm`
    return [{ label: `Throw/jump ≥ ${targetStr}`, count, isRepeatable: true }]
  }

  if (mode === 'difficulty+time') {
    if (!eventData.difficultyTiers) return []
    const prTierIdx = Math.floor(effectivePR / 10000)
    const prTimeSecs = effectivePR % 10000
    const tiers = eventData.difficultyTiers

    // Domain 6: race events — complete half-distance (or same if D1) at 80% pace
    if (eventData.domainNumber === 6) {
      if (prTierIdx === 0) {
        const tierName = tiers[0]?.name ?? 'D1'
        const targetSecs = Math.round(prTimeSecs * 1.2)
        const count = myEventResults.filter(r => {
          const rTierIdx = tiers.findIndex(t => t.name === r.difficulty_tier)
          return rTierIdx === 0 && (r.time_seconds ?? Infinity) <= targetSecs
        }).length
        return [{ label: `Complete ${tierName} in ${fmtTime(targetSecs)} or faster`, count, isRepeatable: true }]
      } else {
        const belowName = tiers[prTierIdx - 1]?.name ?? `D${prTierIdx}`
        const targetSecs = Math.round(prTimeSecs * 0.6)
        const count = myEventResults.filter(r => {
          const rTierIdx = tiers.findIndex(t => t.name === r.difficulty_tier)
          return rTierIdx === prTierIdx - 1 && (r.time_seconds ?? Infinity) <= targetSecs
        }).length
        return [{ label: `Complete ${belowName} in ${fmtTime(targetSecs)} or faster`, count, isRepeatable: true }]
      }
    }

    // Non-D6: hold events — hold tier below for 2 min (or D1 for 2 min if at D1)
    const targetTierIdx = Math.max(0, prTierIdx - 1)
    const targetTierName = tiers[targetTierIdx]?.name ?? `D${targetTierIdx + 1}`
    const count = myEventResults.filter(r => {
      const rTierIdx = tiers.findIndex(t => t.name === r.difficulty_tier)
      return rTierIdx === targetTierIdx && (r.time_seconds ?? 0) >= 120
    }).length
    return [{ label: `Hold ${targetTierName} for 2 min`, count, isRepeatable: true }]
  }

  if (mode === 'difficulty+reps') {
    if (!eventData.difficultyTiers) return []
    const prTierIdx = Math.floor(effectivePR / 10000)
    const prReps = effectivePR % 10000
    const tiers = eventData.difficultyTiers
    const tierName = tiers[prTierIdx]?.name ?? `D${prTierIdx + 1}`
    const targetReps = Math.max(1, Math.round(prReps * 0.8))
    const count = myEventResults.filter(r => {
      const rTierIdx = tiers.findIndex(t => t.name === r.difficulty_tier)
      return rTierIdx === prTierIdx && (r.reps ?? 0) >= targetReps
    }).length
    return [{ label: `${targetReps}+ reps at ${tierName}`, count, isRepeatable: true }]
  }

  return []
}

function calcSubmissionEffortTasks(
  newRawScore: number,
  reps: number | null,
  weightKg: number | null,
  difficultyTierName: string | null,
  opponentName: string | null,
  timeSecs: number | null,
  existingEventResults: Result[],
  eventData: EventData | undefined,
  effectivePR: number | null,
  mode: string
): number {
  if (!eventData) return 0

  if (mode === 'sport') {
    // Every submission after the first counts (vs any opponent)
    return existingEventResults.length > 0 ? 1 : 0
  }

  if (mode === 'score') {
    // Every submission after the first counts
    return existingEventResults.length > 0 ? 1 : 0
  }

  if (mode === 'hold') {
    return (timeSecs ?? 0) >= 120 ? 1 : 0
  }

  if (effectivePR === null) return 0

  if (mode === 'strength') {
    const w = weightKg ?? 0
    const r = reps ?? 0
    return (w >= effectivePR * 0.8 && r >= 5) ? 1 : 0
  }

  if (mode === 'sprint') {
    return newRawScore >= Math.round(effectivePR / 0.8) ? 1 : 0
  }

  if (mode === 'time') {
    return newRawScore >= Math.round(effectivePR * 0.8) ? 1 : 0
  }

  if (mode === 'distance') {
    return newRawScore >= Math.round(effectivePR * 0.8) ? 1 : 0
  }

  if (mode === 'difficulty+time') {
    if (!eventData.difficultyTiers || !difficultyTierName) return 0
    const prTierIdx = Math.floor(effectivePR / 10000)
    const prTimeSecs = effectivePR % 10000
    const tiers = eventData.difficultyTiers
    const rTierIdx = tiers.findIndex(t => t.name === difficultyTierName)
    const secs = timeSecs ?? 0

    if (eventData.domainNumber === 6) {
      // Race: lower time = better
      if (prTierIdx === 0) {
        return rTierIdx === 0 && secs > 0 && secs <= Math.round(prTimeSecs * 1.2) ? 1 : 0
      } else {
        return rTierIdx === prTierIdx - 1 && secs > 0 && secs <= Math.round(prTimeSecs * 0.6) ? 1 : 0
      }
    } else {
      // Hold: higher time = better, target tier = max(0, prTierIdx - 1)
      const targetTierIdx = Math.max(0, prTierIdx - 1)
      return rTierIdx === targetTierIdx && secs >= 120 ? 1 : 0
    }
  }

  if (mode === 'difficulty+reps') {
    if (!eventData.difficultyTiers || !difficultyTierName) return 0
    const prTierIdx = Math.floor(effectivePR / 10000)
    const prReps = effectivePR % 10000
    const tiers = eventData.difficultyTiers
    const rTierIdx = tiers.findIndex(t => t.name === difficultyTierName)
    const r = reps ?? 0
    const targetReps = Math.max(1, Math.round(prReps * 0.8))
    return rTierIdx === prTierIdx && r >= targetReps ? 1 : 0
  }

  return 0
}

// ─── Input component helpers ──────────────────────────────────────────────────

const INP: React.CSSProperties = {
  background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '8px',
  padding: '14px', color: '#fff', fontSize: '20px', fontWeight: 'bold',
  width: '100%', boxSizing: 'border-box',
}

// ─── EventCard ────────────────────────────────────────────────────────────────

type EventCardProps = {
  se: SessionEvent
  eventData: EventData | undefined
  myResults: Result[]
  allResults: Result[]
  allEvents: SessionEvent[]
  seasonPR: number | string | null
  playerId: string
  playerName: string
  sessionId: string
  sessionEnded: boolean
  isExpanded: boolean
  isJudge?: boolean
  onToggle: () => void
  onScoreSubmitted: () => void
}

function EventCard({
  se, eventData, myResults, allResults, allEvents, seasonPR,
  playerId, playerName, sessionId, sessionEnded,
  isExpanded, isJudge = false, onToggle, onScoreSubmitted,
}: EventCardProps) {
  // Form state
  const [weightKg, setWeightKg] = useState('')
  const [repCount, setRepCount] = useState('')
  const [timeMins, setTimeMins] = useState('')
  const [timeSecs, setTimeSecs] = useState('')
  const [sprintCs, setSprintCs] = useState('')
  const [distanceVal, setDistanceVal] = useState('')
  const [distanceUnit, setDistanceUnit] = useState<'m' | 'cm'>('m')
  const [sportResult, setSportResult] = useState<'win' | 'draw' | 'loss' | ''>('')
  const [sportScore, setSportScore] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [exerciseVariation, setExerciseVariation] = useState('')
  const [difficultyTier, setDifficultyTier] = useState('')
  const [scoreInput, setScoreInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [editingResult, setEditingResult] = useState<Result | null>(null)

  const mode = (eventData?.inputMode || se.input_mode || 'strength') as string
  const emoji = eventData?.emoji ?? '🏅'
  const isWeightVariation = !!exerciseVariation && (eventData?.weightVariations?.includes(exerciseVariation) ?? false)

  // Best result for this player at this event
  const myBestResult = myResults.length > 0
    ? myResults.reduce((best, r) => r.raw_score > best.raw_score ? r : best, myResults[0])
    : undefined

  // Effort derived
  const seasonPRNum = typeof seasonPR === 'number' ? seasonPR : null
  const sessionBestRaw = myResults.length > 0
    ? Math.max(...myResults.map(r => r.raw_score))
    : null
  const effectivePR = sessionBestRaw !== null
    ? (seasonPRNum !== null ? Math.max(sessionBestRaw, seasonPRNum) : sessionBestRaw)
    : seasonPRNum
  const effortLevel = calcEffortLevel(myResults)
  const effortTasks = computeEffortTasks(myResults, eventData, effectivePR, mode)
  const effortLocked = myResults.length === 0

  // Compute placement using best score per player
  const playerBestMap: Record<string, Result> = {}
  allResults.filter(r => r.event_id === se.id).forEach(r => {
    const key = r.player_id ?? r.player_name
    if (!playerBestMap[key] || r.raw_score > playerBestMap[key].raw_score) playerBestMap[key] = r
  })
  const eventBests = Object.values(playerBestMap)
  const playerCount = eventBests.length
  const sorted = [...eventBests].sort((a, b) => (b.raw_score ?? 0) - (a.raw_score ?? 0))
  let myRank: number | null = null
  if (myBestResult) {
    let rank = 1
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].raw_score !== sorted[i - 1].raw_score) rank = i + 1
      const key = sorted[i].player_id ?? sorted[i].player_name
      const myKey = myBestResult.player_id ?? myBestResult.player_name
      if (key === myKey) { myRank = rank; break }
    }
  }

  // Events where the final difficulty tier switches to weight-based scoring
  function isWeightScoredTierByIdx(eventName: string, tierIdx: number): boolean {
    return (
      (eventName === 'GHD Situp' && tierIdx === 3) ||
      (eventName === 'Pause Dips' && tierIdx === 4) ||
      (eventName === 'Pause Chin Up' && tierIdx === 4)
    )
  }
  function isWeightScoredTierByName(eventName: string, tierName: string): boolean {
    return (
      (eventName === 'GHD Situp' && tierName === 'GHD Situp') ||
      (eventName === 'Pause Dips' && tierName === 'Weighted RTO Dip') ||
      (eventName === 'Pause Chin Up' && tierName === 'Weighted Chinup')
    )
  }

  function computeScore(): { raw_score: number; score_label: string } | null {
    const totalSecs = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)

    if (mode === 'strength') {
      const w = parseFloat(weightKg) || 0
      if (!w) return null
      const r = parseInt(repCount) || 0
      const label = r > 0 ? `${w}kg × ${r} rep${r !== 1 ? 's' : ''}` : `${w}kg`
      return { raw_score: w, score_label: label }
    }
    if (mode === 'reps') {
      if (isWeightVariation) {
        const w = parseFloat(weightKg) || 0
        if (!w) return null
        const r = parseInt(repCount) || 0
        const varLabel = exerciseVariation ? `${exerciseVariation}: ` : ''
        const label = r > 0 ? `${varLabel}${w}kg × ${r} rep${r !== 1 ? 's' : ''}` : `${varLabel}${w}kg`
        return { raw_score: w, score_label: label }
      }
      const r = parseInt(repCount) || 0
      if (!r) return null
      const varLabel = exerciseVariation ? `${exerciseVariation}: ` : ''
      return { raw_score: r, score_label: `${varLabel}${r} reps` }
    }
    if (mode === 'time') {
      if (!totalSecs) return null
      return { raw_score: -totalSecs, score_label: fmtTime(totalSecs) }
    }
    if (mode === 'hold') {
      if (!totalSecs) return null
      const varLabel = exerciseVariation ? `${exerciseVariation}: ` : ''
      if (eventData?.difficultyTiers && difficultyTier) {
        const tierIdx = eventData.difficultyTiers.findIndex(t => t.name === difficultyTier)
        if (tierIdx >= 0) {
          const rawScore = tierIdx * 10000 + totalSecs
          return { raw_score: rawScore, score_label: `D${tierIdx + 1} ${difficultyTier} · ${fmtTime(totalSecs)}` }
        }
      }
      return { raw_score: totalSecs, score_label: `${varLabel}${fmtTime(totalSecs)}` }
    }
    if (mode === 'difficulty+time') {
      if (!difficultyTier || !totalSecs) return null
      const tierIdx = eventData?.difficultyTiers?.findIndex(t => t.name === difficultyTier) ?? -1
      if (tierIdx < 0) return null
      const rawScore = tierIdx * 10000 + totalSecs
      return { raw_score: rawScore, score_label: `D${tierIdx + 1} ${difficultyTier} · ${fmtTime(totalSecs)}` }
    }
    if (mode === 'difficulty+reps') {
      if (!difficultyTier) return null
      const tierIdx = eventData?.difficultyTiers?.findIndex(t => t.name === difficultyTier) ?? -1
      if (tierIdx < 0) return null
      if (isWeightScoredTierByIdx(eventData?.name ?? '', tierIdx)) {
        const w = parseFloat(weightKg) || 0
        if (!w) return null
        return { raw_score: w, score_label: `D${tierIdx + 1} ${difficultyTier} · ${w}kg` }
      }
      const r = parseInt(repCount) || 0
      if (!r) return null
      const rawScore = tierIdx * 10000 + r
      return { raw_score: rawScore, score_label: `D${tierIdx + 1} ${difficultyTier} · ${r} reps` }
    }
    if (mode === 'distance') {
      const val = parseFloat(distanceVal) || 0
      if (!val) return null
      const raw_score = distanceUnit === 'm' ? Math.round(val * 100) : Math.round(val)
      return { raw_score, score_label: `${distanceVal}${distanceUnit}` }
    }
    if (mode === 'sport') {
      if (!sportResult) return null
      const raw_score = sportResult === 'win' ? 2 : sportResult === 'draw' ? 1 : 0
      let label = sportResult.charAt(0).toUpperCase() + sportResult.slice(1)
      if (opponentName) label += ` vs ${opponentName}`
      if (sportScore) label += ` (${sportScore})`
      return { raw_score, score_label: label }
    }
    if (mode === 'sprint') {
      const s = parseFloat(timeSecs) || 0
      const cs = parseInt(sprintCs) || 0
      if (!s && !cs) return null
      const totalCs = Math.round(s * 100) + cs
      const label = `${Math.floor(s)}s.${cs.toString().padStart(2, '0')}`
      return { raw_score: -totalCs, score_label: label }
    }
    if (mode === 'score') {
      const strokes = parseInt(scoreInput) || 0
      if (strokes <= 0) return null
      return {
        raw_score: -strokes,
        score_label: `${strokes} strokes (4 holes)`,
      }
    }
    return null
  }

  function isValid(): boolean {
    return computeScore() !== null
  }

  async function handleSubmit() {
    if (sessionEnded) return
    const scored = computeScore()
    if (!scored) return
    setSubmitting(true); setError('')
    try {
      const totalSecs = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)
      const payload: Record<string, unknown> = {
        session_id: sessionId,
        event_id: se.id,
        player_id: playerId,
        player_name: playerName,
        raw_score: scored.raw_score,
        score_label: scored.score_label,
      }
      if (difficultyTier) payload.difficulty_tier = difficultyTier
      if (exerciseVariation) payload.exercise_variation = exerciseVariation
      if (mode === 'strength') {
        payload.weight_kg = parseFloat(weightKg) || 0
        if (repCount) payload.reps = parseInt(repCount)
      }
      if (mode === 'reps') payload.reps = parseInt(repCount) || 0
      if (['time', 'hold', 'difficulty+time'].includes(mode) && totalSecs > 0) payload.time_seconds = totalSecs
      if (mode === 'difficulty+reps') {
        if (isWeightScoredTierByName(eventData?.name ?? '', difficultyTier)) {
          payload.weight_kg = parseFloat(weightKg) || 0
        } else {
          payload.reps = parseInt(repCount) || 0
        }
      }
      if (mode === 'sprint') {
        const s = parseFloat(timeSecs) || 0; const cs = parseInt(sprintCs) || 0
        payload.time_seconds = s + cs / 100
      }
      if (mode === 'distance') {
        const val = parseFloat(distanceVal) || 0
        payload.distance_m = distanceUnit === 'm' ? val : val / 100
      }
      if (mode === 'sport') {
        payload.result_type = sportResult
        if (opponentName) payload.opponent_name = opponentName
        if (sportScore) payload.match_score = sportScore
      }

      // Calculate is_pr and effort_task_completions
      const newIsPR = seasonPRNum !== null && scored.raw_score > seasonPRNum && !myResults.some(r => r.is_pr)
      const effortTaskCount = calcSubmissionEffortTasks(
        scored.raw_score,
        parseInt(repCount) || null,
        parseFloat(weightKg) || null,
        difficultyTier || null,
        opponentName || null,
        totalSecs || null,
        myResults,
        eventData,
        effectivePR,
        mode
      )
      payload.is_pr = newIsPR
      payload.effort_task_completions = effortTaskCount

      let dbErr
      if (editingResult) {
        ;({ error: dbErr } = await supabase.from('results').update(payload).eq('id', editingResult.id))
      } else {
        ;({ error: dbErr } = await supabase.from('results').insert(payload))
      }
      if (dbErr) throw dbErr

      // Clear form after submit
      setWeightKg(''); setRepCount(''); setTimeMins(''); setTimeSecs('')
      setSprintCs(''); setDistanceVal(''); setSportResult(''); setSportScore(''); setOpponentName(''); setScoreInput('')
      setEditingResult(null)

      setSuccess(true); setTimeout(() => setSuccess(false), 2500)
      onScoreSubmitted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    }
    setSubmitting(false)
  }

  function prefillFromResult(r: Result) {
    const m = mode
    setEditingResult(r)
    if (r.difficulty_tier) setDifficultyTier(r.difficulty_tier)
    if (m === 'strength') {
      setWeightKg(String(r.weight_kg ?? ''))
      setRepCount(String(r.reps ?? ''))
    } else if (m === 'reps') {
      setRepCount(String(r.reps ?? ''))
    } else if (m === 'difficulty+reps') {
      if (r.weight_kg) setWeightKg(String(r.weight_kg))
      else setRepCount(String(r.reps ?? ''))
    } else if (m === 'time' || m === 'hold') {
      const secs = r.time_seconds ?? 0
      setTimeMins(String(Math.floor(secs / 60)))
      setTimeSecs(String(Math.round(secs % 60)))
    } else if (m === 'difficulty+time') {
      const secs = r.time_seconds ?? 0
      setTimeMins(String(Math.floor(secs / 60)))
      setTimeSecs(String(Math.round(secs % 60)))
    } else if (m === 'sprint') {
      const totalCs = Math.abs(r.raw_score)
      setTimeSecs(String(Math.floor(totalCs / 100)))
      setSprintCs(String(totalCs % 100))
    } else if (m === 'distance') {
      const raw = r.raw_score
      if (raw >= 100) { setDistanceVal((raw / 100).toFixed(2)); setDistanceUnit('m') }
      else { setDistanceVal(String(raw)); setDistanceUnit('cm') }
    } else if (m === 'sport') {
      setSportResult((r.result_type as 'win' | 'draw' | 'loss') || '')
      setOpponentName(r.opponent_name ?? '')
      setSportScore(r.match_score ?? '')
    } else if (m === 'score') {
      setScoreInput(String(Math.abs(r.raw_score)))
    }
    // Scroll the card into view
    if (!isExpanded) onToggle()
  }

  async function handleDelete(resultId: string) {
    if (editingResult?.id === resultId) setEditingResult(null)
    await supabase.from('results').delete().eq('id', resultId)
    onScoreSubmitted()
  }

  // Sort myResults best first
  const myResultsSorted = [...myResults].sort((a, b) => b.raw_score - a.raw_score)

  // Collapsed card
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: myBestResult ? '#0d1a0d' : '#111', border: `1px solid ${myBestResult ? '#4DB26E33' : '#1e1e1e'}`,
          borderRadius: '12px', padding: '16px 12px', cursor: 'pointer', width: '100%',
          gap: '6px', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '28px', lineHeight: 1 }}>{emoji}</div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
          {se.event_name}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: myBestResult ? '#4DB26E' : '#555', fontFamily: 'Bebas Neue, cursive' }}>
          {myBestResult ? (mode === 'sport' ? sportWDL(myResults) : myBestResult.score_label) : '—'}
        </div>
        {seasonPR !== null && typeof seasonPR === 'number' && (
          <div style={{ fontSize: '10px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif' }}>
            PR: {formatPR(seasonPR as number, mode)}
          </div>
        )}
        {typeof seasonPR === 'string' && (
          <div style={{ fontSize: '10px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif' }}>
            PR: {seasonPR}
          </div>
        )}
        <div style={{ fontSize: '13px', color: effortLevel > 0 ? '#B87DB5' : '#555', fontFamily: 'Bebas Neue, cursive' }}>
          {`Effort Level: ${effortLevel}`}
        </div>
      </button>
    )
  }

  // Expanded card
  const isTimeMode = mode === 'time' || mode === 'hold'
  const isDynamicHold = false
  const isDynamicReps = false

  return (
    <div style={{
      background: '#111', border: '1px solid #2371BB', borderRadius: '12px',
      overflow: 'hidden', gridColumn: '1 / -1',
    }}>
      {/* Card header */}
      <button
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
          padding: '16px', background: '#0d1a2e', border: 'none', cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: '24px' }}>{emoji}</span>
        <span style={{ fontSize: '18px', fontWeight: 700, color: '#fff', fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.05em' }}>
          {se.event_name}
        </span>
        <span style={{ marginLeft: 'auto', color: '#2371BB', fontSize: '18px' }}>▲</span>
      </button>

      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* 1. TODAY'S TOP SCORE */}
        <div>
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Today's Top Score
          </div>
          {myBestResult ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Bebas Neue, cursive' }}>
                {myBestResult.score_label}
              </div>
              {myRank && <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif' }}>#{myRank} of {playerCount}</div>}
            </div>
          ) : (
            <div style={{ color: '#555', fontSize: '14px' }}>No score yet</div>
          )}
        </div>

        {/* 2. PR THIS SEASON */}
        <div>
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
            PR This Season
          </div>
          <div style={{ fontSize: '15px', color: seasonPRNum !== null ? '#F9B051' : '#555' }}>
            {seasonPRNum !== null ? formatPR(seasonPRNum, mode) : 'No PR yet'}
          </div>
        </div>

        {/* 3. ALL TODAY'S SCORES */}
        {myResults.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
                All Today's Scores
              </div>
              {mode === 'sport' && (
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.05em' }}>
                  {sportWDL(myResults)}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {myResultsSorted.map(r => (
                <div key={r.id} style={{
                  background: editingResult?.id === r.id ? '#0d1a2d' : '#0d0d0d',
                  border: `1px solid ${editingResult?.id === r.id ? '#2371BB55' : 'transparent'}`,
                  borderRadius: '8px', padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: '10px',
                }}>
                  <div style={{ fontSize: '15px', color: '#fff', flex: 1 }}>{r.score_label}</div>
                  {r.is_pr && (
                    <div style={{
                      fontSize: '10px', fontWeight: 700, color: '#F9B051',
                      background: '#F9B05122', borderRadius: '4px', padding: '2px 6px',
                      fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em',
                    }}>PR</div>
                  )}
                  {r.effort_task_completions > 0 && (
                    <div style={{ fontSize: '12px', color: '#B87DB5', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>
                      +{r.effort_task_completions}
                    </div>
                  )}
                  {!sessionEnded && (isJudge || true) && (
                    <>
                      <button
                        onClick={() => prefillFromResult(r)}
                        title="Edit this score"
                        style={{ background: 'none', border: '1px solid #2371BB44', borderRadius: '4px', color: '#2371BB', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', flexShrink: 0, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        title="Delete this score"
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', flexShrink: 0 }}
                      >
                        ✕
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. EFFORT TASKS */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Effort Tasks
            </div>
            <div style={{ fontSize: '13px', color: '#B87DB5', fontWeight: 700, fontFamily: 'Bebas Neue, cursive' }}>
              Level {effortLevel}
            </div>
          </div>
          {effortLocked ? (
            <div style={{ fontSize: '13px', color: '#555', fontStyle: 'italic' }}>
              Submit a score to unlock effort tasks
            </div>
          ) : effortTasks.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#555', fontStyle: 'italic' }}>
              No effort tasks for this event
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {effortTasks.map((task, i) => {
                const done = task.isRepeatable ? task.count > 0 : task.count > 0
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: '#0d0d0d', borderRadius: '8px', padding: '10px 14px',
                  }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                      background: done ? '#B87DB5' : '#1e1e1e',
                      color: done ? '#fff' : '#555',
                    }}>
                      {done ? '✓' : '○'}
                    </div>
                    <div style={{ flex: 1, fontSize: '13px', color: done ? '#B87DB5' : '#888', fontFamily: 'Barlow Condensed, sans-serif' }}>
                      {task.label}
                    </div>
                    {task.isRepeatable && task.count > 1 && (
                      <div style={{ fontSize: '12px', color: '#B87DB5', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif' }}>
                        ×{task.count}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* 5. SUBMIT SCORE */}
        {!sessionEnded && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: editingResult ? '#2371BB' : '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
                {editingResult ? 'Editing Score' : 'Submit Score'}
              </div>
              {editingResult && (
                <button onClick={() => { setEditingResult(null); setWeightKg(''); setRepCount(''); setTimeMins(''); setTimeSecs(''); setSprintCs(''); setDistanceVal(''); setSportResult(''); setSportScore(''); setOpponentName(''); setDifficultyTier(''); setScoreInput('') }}
                  style={{ fontSize: '11px', color: '#555', background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  Cancel
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Variation selector — events with named variations */}
              {eventData?.variations && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>VARIATION</label>
                  <select value={exerciseVariation} onChange={e => setExerciseVariation(e.target.value)}
                    style={{ ...INP, fontSize: '15px' }}>
                    <option value="">Select variation...</option>
                    {eventData.variations.map((v, i) => (
                      <option key={v} value={v}>D{i + 1} — {v}{eventData.weightVariations?.includes(v) ? ' (weight + reps)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Difficulty tier selector */}
              {eventData?.hasDifficultyTiers && eventData.difficultyTiers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>DIFFICULTY TIER</label>
                  <select value={difficultyTier} onChange={e => setDifficultyTier(e.target.value)}
                    style={{ ...INP, fontSize: '15px' }}>
                    <option value="">Select tier...</option>
                    {eventData.difficultyTiers.map(t => (
                      <option key={t.level} value={t.name}>D{t.level} — {t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Strength mode — also shown when a weight variation is selected or a weight-scored difficulty tier */}
              {(mode === 'strength' || isWeightVariation ||
                (mode === 'difficulty+reps' && isWeightScoredTierByName(eventData?.name ?? '', difficultyTier))) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                    placeholder="Weight (kg)" style={{ ...INP, flex: 2 }} />
                  {(mode === 'strength' || isWeightVariation) && (
                    <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)}
                      placeholder="Reps" style={{ ...INP, flex: 1 }} />
                  )}
                </div>
              )}

              {/* Reps mode — hidden when weight variation selected; difficulty+reps — hidden for weight-scored tiers */}
              {((mode === 'reps' || isDynamicReps) && !isWeightVariation) ||
               (mode === 'difficulty+reps' && !isWeightScoredTierByName(eventData?.name ?? '', difficultyTier))
                ? (
                <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)}
                  placeholder="Reps" style={INP} />
              ) : null}

              {/* Time / hold / weight+time / difficulty+time */}
              {(mode === 'time' || mode === 'hold' || mode === 'weight+time' || mode === 'difficulty+time' || isDynamicHold) && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)}
                    placeholder="min" style={{ ...INP, flex: 1 }} />
                  <span style={{ color: '#555', fontSize: '20px' }}>:</span>
                  <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)}
                    placeholder="sec" style={{ ...INP, flex: 1 }} />
                </div>
              )}

              {/* Sprint mode */}
              {mode === 'sprint' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)}
                    placeholder="Seconds" style={{ ...INP, flex: 2 }} />
                  <span style={{ color: '#555', fontSize: '18px' }}>.</span>
                  <input type="number" value={sprintCs} onChange={e => setSprintCs(e.target.value)}
                    placeholder="cs" style={{ ...INP, flex: 1 }} min="0" max="99" />
                </div>
              )}

              {/* Distance mode */}
              {mode === 'distance' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" value={distanceVal} onChange={e => setDistanceVal(e.target.value)}
                    placeholder="Distance" style={{ ...INP, flex: 2 }} />
                  <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden' }}>
                    {(['m', 'cm'] as const).map(u => (
                      <button key={u} onClick={() => setDistanceUnit(u)} style={{
                        padding: '10px 16px', border: 'none', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                        background: distanceUnit === u ? '#2371BB' : '#1a1a1a',
                        color: distanceUnit === u ? '#fff' : '#666',
                      }}>{u}</button>
                    ))}
                  </div>
                </div>
              )}

              {/* Sport mode */}
              {mode === 'sport' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['win', 'draw', 'loss'] as const).map(r => {
                      const colors = { win: '#4DB26E', draw: '#F9B051', loss: '#EA4742' }
                      const active = sportResult === r
                      return (
                        <button key={r} onClick={() => setSportResult(r)} style={{
                          flex: 1, padding: '14px', border: `2px solid ${active ? colors[r] : '#222'}`,
                          borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
                          background: active ? colors[r] + '22' : '#111',
                          color: active ? colors[r] : '#444',
                        }}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>
                      )
                    })}
                  </div>
                  <input value={opponentName} onChange={e => setOpponentName(e.target.value)}
                    placeholder="Opponent name (optional)" style={{ ...INP, fontSize: '15px' }} />
                  <input value={sportScore} onChange={e => setSportScore(e.target.value)}
                    placeholder="Score e.g. 21–18 (optional)" style={{ ...INP, fontSize: '15px' }} />
                </div>
              )}

              {/* Score mode (Golf, Disc Golf) */}
              {mode === 'score' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>STROKE COUNT (4 HOLES)</label>
                  <input
                    type="number"
                    value={scoreInput}
                    onChange={e => setScoreInput(e.target.value)}
                    placeholder="e.g. 18"
                    style={INP}
                    min="1"
                  />
                </div>
              )}

              {error && <div style={{ color: '#EA4742', fontSize: '13px' }}>{error}</div>}
              {success && <div style={{ color: '#4DB26E', fontSize: '13px' }}>Submitted!</div>}

              <button
                onClick={handleSubmit}
                disabled={!isValid() || submitting}
                style={{
                  padding: '14px', borderRadius: '10px', border: 'none', fontWeight: 'bold',
                  fontSize: '15px', cursor: isValid() && !submitting ? 'pointer' : 'not-allowed',
                  background: isValid() && !submitting ? '#2371BB' : '#1a1a1a',
                  color: isValid() && !submitting ? '#fff' : '#555',
                }}
              >
                {submitting ? 'Saving...' : editingResult ? 'Save Changes' : 'Submit Score'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LeaderboardTab ───────────────────────────────────────────────────────────

const DIVISION_TABS = [
  { key: "Men's",            label: "Men's" },
  { key: "Women's",          label: "Women's" },
  { key: 'Juniors',          label: 'Juniors (U17)' },
  { key: 'Masters Men',      label: 'Masters Men (40+)' },
  { key: 'Masters Women',    label: 'Masters Women (40+)' },
  { key: 'Grandmaster Men',  label: 'Grandmaster Men (60+)' },
  { key: 'Grandmaster Women',label: 'Grandmaster Women (60+)' },
]

type PlayerInfo = { division: string }

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function LeaderboardTab({
  events, results, playerInfoMap,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
}) {
  const [activeTab, setActiveTab] = useState<string>('effort')
  const [expandedPlayerKey, setExpandedPlayerKey] = useState<string | null>(null)

  // Only show division tabs where at least one player from that division has a result
  const visibleDivisions = useMemo(() => {
    const divisionsWithScores = new Set(
      results
        .filter(r => r.player_id && playerInfoMap[r.player_id])
        .map(r => playerInfoMap[r.player_id!].division)
    )
    return DIVISION_TABS.filter(dt => divisionsWithScores.has(dt.key))
  }, [results, playerInfoMap])

  // Effort leaderboard — all divisions
  const effortRows = useMemo(() => {
    const playerKeys = [...new Set(results.map(r => r.player_id ?? r.player_name))]
    return playerKeys
      .map(key => {
        const pr = results.filter(r => (r.player_id ?? r.player_name) === key)
        const sample = pr[0]
        const level = Math.min(
          events.reduce((s, ev) => s + calcEffortLevel(pr.filter(r => r.event_id === ev.id)), 0),
          20
        )
        return { playerKey: String(key), playerName: sample.player_name, playerId: sample.player_id, effortLevel: level }
      })
      .sort((a, b) => b.effortLevel - a.effortLevel)
  }, [results, events])

  // Competitive leaderboard — ranked by total placement for a given division
  const competitiveRows = useMemo(() => {
    if (activeTab === 'effort') return []
    const divResults = results.filter(r => r.player_id && playerInfoMap[r.player_id]?.division === activeTab)
    const playerIds = [...new Set(divResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (playerIds.length === 0) return []

    type EventRow = { eventId: string; eventName: string; emoji: string; scoreLabel: string | null; displayLabel: string | null; placement: number }

    const rows = playerIds.map(pid => {
      let totalPlacement = 0
      const eventDetails: EventRow[] = events.map(ev => {
        const evDivRes = divResults.filter(r => r.event_id === ev.id)
        const bestPerPlayer: Record<string, { rawScore: number; scoreLabel: string }> = {}
        evDivRes.forEach(r => {
          if (!r.player_id) return
          const existing = bestPerPlayer[r.player_id]
          if (!existing || r.raw_score > existing.rawScore) {
            bestPerPlayer[r.player_id] = { rawScore: r.raw_score, scoreLabel: r.score_label }
          }
        })
        const scorerCount = Object.keys(bestPerPlayer).length
        const myBest = bestPerPlayer[pid]
        const evData = getEventByName(ev.event_name)
        const isSport = evData?.inputMode === 'sport'
        if (!myBest) {
          const placement = scorerCount + 1
          totalPlacement += placement
          return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', scoreLabel: null, displayLabel: null, placement }
        }
        const strictlyBetter = Object.values(bestPerPlayer).filter(b => b.rawScore > myBest.rawScore).length
        const placement = strictlyBetter + 1
        totalPlacement += placement
        // For sport events show W/D/L summary; otherwise show the best score label
        const displayLabel = isSport
          ? sportWDL(evDivRes.filter(r => r.player_id === pid))
          : myBest.scoreLabel
        return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', scoreLabel: myBest.scoreLabel, displayLabel, placement }
      })
      const sample = divResults.find(r => r.player_id === pid)!
      return { playerKey: pid, playerName: sample.player_name, playerId: pid, totalPlacement, eventDetails }
    })

    rows.sort((a, b) => a.totalPlacement - b.totalPlacement)
    return rows.map(entry => ({
      ...entry,
      rank: 1 + rows.filter(e => e.totalPlacement < entry.totalPlacement).length,
    }))
  }, [activeTab, results, events, playerInfoMap])

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Single-row tab bar */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
        <button
          onClick={() => { setActiveTab('effort'); setExpandedPlayerKey(null) }}
          style={{
            padding: '6px 12px', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap',
            border: `1px solid ${activeTab === 'effort' ? '#B87DB5' : '#222'}`,
            fontSize: '12px', fontWeight: activeTab === 'effort' ? 700 : 400, cursor: 'pointer',
            background: activeTab === 'effort' ? '#1a0d1a' : '#111',
            color: activeTab === 'effort' ? '#B87DB5' : '#555',
          }}
        >
          Effort Level (All-Divisions)
        </button>
        {visibleDivisions.map(dt => (
          <button
            key={dt.key}
            onClick={() => { setActiveTab(dt.key); setExpandedPlayerKey(null) }}
            style={{
              padding: '6px 12px', borderRadius: '20px', flexShrink: 0, whiteSpace: 'nowrap',
              border: `1px solid ${activeTab === dt.key ? '#2371BB' : '#222'}`,
              fontSize: '12px', fontWeight: activeTab === dt.key ? 700 : 400, cursor: 'pointer',
              background: activeTab === dt.key ? '#0d1a2e' : '#111',
              color: activeTab === dt.key ? '#2371BB' : '#555',
            }}
          >
            {dt.label}
          </button>
        ))}
      </div>

      {/* Effort tab */}
      {activeTab === 'effort' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {effortRows.length === 0 ? (
            <div style={{ color: '#555', fontSize: '14px', textAlign: 'center', padding: '32px' }}>No effort data yet</div>
          ) : effortRows.map((entry, idx) => {
            const rank = 1 + effortRows.filter(e => e.effortLevel > entry.effortLevel).length
            return (
              <div key={entry.playerKey} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                background: rank === 1 ? '#1a0d1a' : '#111', borderRadius: '10px',
                border: `1px solid ${rank === 1 ? '#B87DB5' : '#1e1e1e'}`,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700,
                  background: rank === 1 ? '#B87DB5' : rank === 2 ? '#888' : rank === 3 ? '#CD7F32' : '#333',
                  color: rank <= 3 ? '#000' : '#fff',
                }}>{rank}</div>
                <div style={{ flex: 1, fontSize: '14px', color: rank === 1 ? '#fff' : '#aaa', fontWeight: rank === 1 ? 700 : 400 }}>
                  {entry.playerName}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#B87DB5' }}>
                  Level {entry.effortLevel}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Competitive division tab */}
      {activeTab !== 'effort' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {competitiveRows.length === 0 ? (
            <div style={{ color: '#555', fontSize: '14px', textAlign: 'center', padding: '32px' }}>No scores yet</div>
          ) : competitiveRows.map(entry => {
            const isExpanded = expandedPlayerKey === entry.playerKey
            return (
              <div key={entry.playerKey} style={{
                background: entry.rank === 1 ? '#0d1a0d' : '#111', borderRadius: '10px', overflow: 'hidden',
                border: `1px solid ${isExpanded ? '#2371BB' : entry.rank === 1 ? '#4DB26E33' : '#1e1e1e'}`,
              }}>
                <button
                  onClick={() => setExpandedPlayerKey(isExpanded ? null : entry.playerKey)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px', width: '100%',
                    padding: '12px 16px', background: 'transparent', border: 'none', cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '13px', fontWeight: 700,
                    background: entry.rank === 1 ? '#F9B051' : entry.rank === 2 ? '#888' : entry.rank === 3 ? '#CD7F32' : '#333',
                    color: entry.rank <= 3 ? '#000' : '#fff',
                  }}>{entry.rank}</div>
                  <div style={{ flex: 1, textAlign: 'left', fontSize: '14px', color: entry.rank === 1 ? '#fff' : '#aaa', fontWeight: entry.rank === 1 ? 700 : 400 }}>
                    {entry.playerName}
                  </div>
                  <div style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif' }}>
                    {ordinal(entry.rank)} of {competitiveRows.length}
                  </div>
                  <span style={{ color: isExpanded ? '#2371BB' : '#444', fontSize: '14px', flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div style={{ borderTop: '1px solid #1e1e1e', padding: '4px 0' }}>
                    {entry.eventDetails.map((ed, i) => (
                      <div key={ed.eventId} style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '8px 16px',
                        background: i % 2 === 0 ? '#0a0a0a' : 'transparent',
                      }}>
                        <span style={{ fontSize: '16px', flexShrink: 0 }}>{ed.emoji}</span>
                        <div style={{ flex: 1, fontSize: '12px', color: '#666' }}>{ed.eventName}</div>
                        <div style={{ fontSize: '13px', color: ed.displayLabel ? '#ccc' : '#444' }}>
                          {ed.displayLabel ?? 'No score'}
                        </div>
                        <div style={{
                          fontSize: '12px', fontWeight: 700, minWidth: '36px', textAlign: 'right',
                          color: ed.scoreLabel ? '#F9B051' : '#444',
                          fontFamily: 'Barlow Condensed, sans-serif',
                        }}>
                          {ordinal(ed.placement)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [player, setPlayer] = useState<Record<string, unknown> | null>(null)
  const [familyMembers, setFamilyMembers] = useState<Record<string, unknown>[]>([])
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
  const [seasonPRs, setSeasonPRs] = useState<Record<string, number | string | null>>({})
  const [activeTab, setActiveTab] = useState<string>('leaderboard')
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [preSessionSecsLeft, setPreSessionSecsLeft] = useState<number | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [playerInfoMap, setPlayerInfoMap] = useState<Record<string, PlayerInfo>>({})
  // Judge mode
  const [isJudge, setIsJudge] = useState(false)
  const [judgeTargetId, setJudgeTargetId] = useState<string>('')
  const [sessionPlayers, setSessionPlayers] = useState<{ id: string; name: string }[]>([])
  const [judgePRs, setJudgePRs] = useState<Record<string, number | string | null>>({})

  const allPlayers = player ? [player, ...familyMembers] : []
  const activePlayer = allPlayers.find(p => p.id === activePlayerId) ?? player

  // ── Load initial data ──────────────────────────────────────────────────────
  const loadResults = useCallback(async () => {
    const { data } = await supabase.from('results').select('*').eq('session_id', sessionId)
    if (data) setResults(data as Result[])
  }, [sessionId])

  useEffect(() => {
    const load = async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        const { data: p } = await supabase.from('players').select('*').eq('id', authUser.id).single()
        if (p) {
          setPlayer(p as Record<string, unknown>)
          setActivePlayerId(authUser.id)
          const { data: children } = await supabase.from('players')
            .select('*').eq('parent_id', authUser.id).order('full_name')
          setFamilyMembers((children ?? []) as Record<string, unknown>[])
          // Judge mode: load all session players
          if ((p as Record<string, unknown>).role === 'judge') {
            setIsJudge(true)
          }
        }
      }
      const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      setSession(s as Record<string, unknown> | null)
      if (s && !(s as Record<string, unknown>).is_active) setSessionEnded(true)

      const { data: ev } = await supabase.from('session_events').select('*')
        .eq('session_id', sessionId).order('domain_number')
      setEvents((ev ?? []) as SessionEvent[])

      await loadResults()
    }
    load()
  }, [sessionId, loadResults])

  // ── Load player info for leaderboard ─────────────────────────────────────
  useEffect(() => {
    if (results.length === 0) return
    const ids = [...new Set(results.map(r => r.player_id).filter(Boolean))] as string[]
    if (ids.length === 0) return
    supabase.from('players').select('id, division, display_name, username, full_name').in('id', ids).then(({ data }) => {
      if (!data) return
      const map: Record<string, PlayerInfo> = {}
      data.forEach(p => { map[p.id] = { division: p.division ?? '' } })
      setPlayerInfoMap(map)
      // For judge mode: build session players list
      setSessionPlayers(data.map(p => ({
        id: p.id,
        name: (p.display_name || p.username || p.full_name || 'Unknown') as string,
      })))
    })
  }, [results])

  // ── Load season PRs for active player ─────────────────────────────────────
  useEffect(() => {
    if (!activePlayerId || events.length === 0) return
    const year = new Date().getFullYear()

    async function loadPRs() {
      const prs: Record<string, number | string | null> = {}
      for (const ev of events) {
        if (!ev.event_slug) {
          const evData = getEventByName(ev.event_name)
          if (!evData) { prs[ev.id] = null; continue }
          const { data } = await supabase.rpc('get_player_season_pr', {
            p_player_id: activePlayerId,
            p_event_slug: evData.slug,
            p_season_year: year,
          })
          prs[ev.id] = data as number | null
        } else {
          const { data } = await supabase.rpc('get_player_season_pr', {
            p_player_id: activePlayerId,
            p_event_slug: ev.event_slug,
            p_season_year: year,
          })
          prs[ev.id] = data as number | null
        }
      }
      setSeasonPRs(prs)
    }
    loadPRs()
  }, [activePlayerId, events])

  // ── Load PRs for judge's selected player ─────────────────────────────────
  useEffect(() => {
    if (!isJudge || !judgeTargetId || events.length === 0) return
    const year = new Date().getFullYear()
    async function loadJudgePRs() {
      const prs: Record<string, number | string | null> = {}
      for (const ev of events) {
        const evData = getEventByName(ev.event_name)
        const slug = ev.event_slug || evData?.slug
        if (!slug) { prs[ev.id] = null; continue }
        const { data } = await supabase.rpc('get_player_season_pr', {
          p_player_id: judgeTargetId,
          p_event_slug: slug,
          p_season_year: year,
        })
        prs[ev.id] = data as number | null
      }
      setJudgePRs(prs)
    }
    loadJudgePRs()
  }, [isJudge, judgeTargetId, events])

  // ── Realtime subscriptions ─────────────────────────────────────────────────
  useEffect(() => {
    const ch = supabase.channel(`scoring-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        () => loadResults())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        p => {
          const updated = p.new as Record<string, unknown>
          if (updated.is_active === false) setSessionEnded(true)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId, loadResults])

  // ── Timer ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const s = session as Record<string, unknown> | null
    if (!s?.started_at) return
    const startTs = new Date(s.started_at as string).getTime()
    const endTs = startTs + 100 * 60 * 1000
    let closedByTimer = false

    const tick = () => {
      const now = Date.now()
      if (now < startTs) {
        setPreSessionSecsLeft(Math.ceil((startTs - now) / 1000))
        setTimeLeft(null)
      } else {
        setPreSessionSecsLeft(null)
        const remaining = Math.max(0, Math.floor((endTs - now) / 1000))
        setTimeLeft(remaining)
        if (remaining === 0 && !closedByTimer && s.is_active) {
          closedByTimer = true
          setSessionEnded(true)
          supabase.from('sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', sessionId)
        }
      }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [session, sessionId])

  // ── Derived ────────────────────────────────────────────────────────────────
  const timerColour = preSessionSecsLeft !== null
    ? '#B87DB5'
    : timeLeft !== null
      ? timeLeft < 600 ? '#EA4742' : timeLeft < 1800 ? '#F9B051' : '#4DB26E'
      : '#4DB26E'

  const timerDisplay = sessionEnded
    ? 'ENDED'
    : preSessionSecsLeft !== null
      ? fmtCountdown(preSessionSecsLeft)
      : timeLeft !== null
        ? fmtCountdown(timeLeft)
        : '--:--'

  const sessionCode = (session as Record<string, unknown> | null)?.session_code as string | undefined

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '640px', margin: '0 auto', fontFamily: 'Barlow, sans-serif' }}>

      {/* Top bar */}
      <div style={{ background: '#2371BB', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {sessionEnded ? 'SESSION ENDED' : preSessionSecsLeft !== null ? 'STARTING SOON' : 'LIVE SESSION'}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 700, fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.05em' }}>
              AllSport
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: timerColour, fontVariantNumeric: 'tabular-nums', fontFamily: 'Bebas Neue, cursive' }}>
              {timerDisplay}
            </div>
            {sessionCode && (
              <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', letterSpacing: '4px' }}>{sessionCode}</div>
            )}
          </div>
        </div>
        {sessionCode && (
          <div style={{ marginTop: '10px', background: '#000', borderRadius: '12px', padding: '12px 16px', textAlign: 'center', border: '2px solid rgba(255,255,255,0.15)' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', letterSpacing: '2px', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>GAME CODE — share with players to join</div>
            <div style={{ fontSize: '42px', fontWeight: 'bold', letterSpacing: '10px', color: '#F9B051', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1 }}>{sessionCode}</div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', marginTop: '6px' }}>Players enter this at Dashboard → Join a Session</div>
          </div>
        )}
      </div>

      <div style={{ height: '3px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1e1e1e', overflowX: 'auto', background: '#0a0a0a', position: 'sticky', top: '60px', zIndex: 9 }}>
        {allPlayers.map(p => {
          const pid = p.id as string
          const label = (p.display_name || p.username || p.full_name) as string
          const tabId = `player-${pid}`
          const active = activeTab === tabId
          return (
            <button key={pid} onClick={() => { setActiveTab(tabId); setActivePlayerId(pid); setExpandedEventId(null) }}
              style={{
                padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
                fontSize: '13px', fontWeight: active ? 700 : 400, flexShrink: 0,
                background: active ? '#111' : 'transparent',
                color: active ? '#fff' : '#555',
                borderBottom: `2px solid ${active ? '#2371BB' : 'transparent'}`,
              }}>
              {label}
            </button>
          )
        })}
        <button onClick={() => setActiveTab('leaderboard')}
          style={{
            padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
            fontSize: '13px', fontWeight: activeTab === 'leaderboard' ? 700 : 400, flexShrink: 0,
            background: activeTab === 'leaderboard' ? '#111' : 'transparent',
            color: activeTab === 'leaderboard' ? '#fff' : '#555',
            borderBottom: `2px solid ${activeTab === 'leaderboard' ? '#2371BB' : 'transparent'}`,
          }}>
          Leaderboard
        </button>
        {isJudge && (
          <button onClick={() => setActiveTab('judge-mode')}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '13px', fontWeight: activeTab === 'judge-mode' ? 700 : 400, flexShrink: 0,
              background: activeTab === 'judge-mode' ? '#111' : 'transparent',
              color: activeTab === 'judge-mode' ? '#EA4742' : '#555',
              borderBottom: `2px solid ${activeTab === 'judge-mode' ? '#EA4742' : 'transparent'}`,
            }}>
            Kaiwhakawā
          </button>
        )}
      </div>

      {/* Player tabs */}
      {allPlayers.map(p => {
        const pid = p.id as string
        const tabId = `player-${pid}`
        if (activeTab !== tabId) return null
        const pName = (p.display_name || p.username || p.full_name) as string
        const myResults = results.filter(r => r.player_id === pid)
        const totalEffort = calcTotalEffortLevel(myResults, events)

        return (
          <div key={pid} style={{ padding: '16px' }}>
            {sessionEnded && (
              <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ color: '#EA4742', fontWeight: 700, fontFamily: 'Bebas Neue, cursive', fontSize: '18px' }}>Session Ended</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Score submission is locked</div>
              </div>
            )}

            {/* Total effort level */}
            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: '13px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                Effort Level: {totalEffort} / 20
              </div>
            </div>

            {/* 2-column grid of event cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {events.map(ev => {
                const evResults = results.filter(r => r.event_id === ev.id && r.player_id === pid)
                const evData = getEventByName(ev.event_name)
                const pr = seasonPRs[ev.id] ?? null

                return (
                  <EventCard
                    key={ev.id}
                    se={ev}
                    eventData={evData}
                    myResults={evResults}
                    allResults={results}
                    allEvents={events}
                    seasonPR={pr}
                    playerId={pid}
                    playerName={pName}
                    sessionId={sessionId as string}
                    sessionEnded={sessionEnded}
                    isExpanded={expandedEventId === ev.id}
                    onToggle={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}
                    onScoreSubmitted={async () => { await loadResults() }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}

      {/* Judge mode tab */}
      {activeTab === 'judge-mode' && isJudge && (
        <div style={{ padding: '16px' }}>
          {/* Header */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#EA4742', letterSpacing: '0.05em' }}>
              Kaiwhakawā
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em', marginBottom: '12px' }}>
              SCORE FOR ANY PLAYER
            </div>
            {sessionEnded && (
              <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#EA4742', fontSize: '13px' }}>
                Session ended — scoring locked
              </div>
            )}
            <select
              value={judgeTargetId}
              onChange={e => { setJudgeTargetId(e.target.value); setExpandedEventId(null) }}
              style={{
                width: '100%', background: '#0d0d0d', border: '1px solid #EA474244',
                borderRadius: '8px', padding: '12px 14px', color: judgeTargetId ? '#fff' : '#666',
                fontSize: '15px', fontFamily: 'Barlow, sans-serif',
              }}
            >
              <option value="">Select a player to score for...</option>
              {sessionPlayers.map(sp => (
                <option key={sp.id} value={sp.id}>{sp.name}</option>
              ))}
            </select>
            {sessionPlayers.length === 0 && (
              <div style={{ fontSize: '12px', color: '#555', marginTop: '8px', fontFamily: 'Barlow, sans-serif' }}>
                No players have joined yet — players appear here once they submit a score.
              </div>
            )}
          </div>

          {/* Event grid for selected player */}
          {judgeTargetId && (() => {
            const sp = sessionPlayers.find(s => s.id === judgeTargetId)
            if (!sp) return null
            const judgeMyResults = results.filter(r => r.player_id === judgeTargetId)
            const totalEffort = calcTotalEffortLevel(judgeMyResults, events)
            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{sp.name}</div>
                  <div style={{ fontSize: '13px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                    Effort Level: {totalEffort} / 20
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {events.map(ev => {
                    const evResults = results.filter(r => r.event_id === ev.id && r.player_id === judgeTargetId)
                    const evData = getEventByName(ev.event_name)
                    const pr = judgePRs[ev.id] ?? null
                    return (
                      <EventCard
                        key={ev.id}
                        se={ev}
                        eventData={evData}
                        myResults={evResults}
                        allResults={results}
                        allEvents={events}
                        seasonPR={pr}
                        playerId={judgeTargetId}
                        playerName={sp.name}
                        sessionId={sessionId as string}
                        sessionEnded={sessionEnded}
                        isJudge={true}
                        isExpanded={expandedEventId === `judge-${ev.id}`}
                        onToggle={() => setExpandedEventId(expandedEventId === `judge-${ev.id}` ? null : `judge-${ev.id}`)}
                        onScoreSubmitted={async () => { await loadResults() }}
                      />
                    )
                  })}
                </div>
              </div>
            )
          })()}
        </div>
      )}

      {/* Leaderboard tab */}
      {activeTab === 'leaderboard' && (
        <LeaderboardTab events={events} results={results} playerInfoMap={playerInfoMap} />
      )}

      {/* Not logged in */}
      {!player && (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ color: '#555', marginBottom: '16px' }}>Log in to submit scores</div>
          <a href="/login" style={{ color: '#2371BB', fontWeight: 700, textDecoration: 'none' }}>Log in →</a>
        </div>
      )}
    </div>
  )
}
