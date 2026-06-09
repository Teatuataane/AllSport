'use client'
import { useEffect, useState, useCallback, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getEventByName, type EventData } from '@/lib/eventData'

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

type PlayerInfo = { division: string; date_of_birth?: string | null }

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
    case 'score':      return `${Math.abs(rawScore)} strokes`
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
    default: return String(rawScore)
  }
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

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

function getAge(dob: string): number {
  const born = new Date(dob)
  const today = new Date()
  let age = today.getFullYear() - born.getFullYear()
  const m = today.getMonth() - born.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < born.getDate())) age--
  return age
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
  if (mode === 'sport') return existingEventResults.length > 0 ? 1 : 0
  if (mode === 'score') return existingEventResults.length > 0 ? 1 : 0
  if (mode === 'hold') return (timeSecs ?? 0) >= 120 ? 1 : 0
  if (effectivePR === null) return 0
  if (mode === 'strength') {
    const w = weightKg ?? 0
    const r = reps ?? 0
    return (w >= effectivePR * 0.8 && r >= 5) ? 1 : 0
  }
  if (mode === 'sprint') return newRawScore >= Math.round(effectivePR / 0.8) ? 1 : 0
  if (mode === 'time') return newRawScore >= Math.round(effectivePR * 0.8) ? 1 : 0
  if (mode === 'distance') return newRawScore >= Math.round(effectivePR * 0.8) ? 1 : 0
  if (mode === 'difficulty+time') {
    if (!eventData.difficultyTiers || !difficultyTierName) return 0
    const prTierIdx = Math.floor(effectivePR / 10000)
    const prTimeSecs = effectivePR % 10000
    const tiers = eventData.difficultyTiers
    const rTierIdx = tiers.findIndex(t => t.name === difficultyTierName)
    const secs = timeSecs ?? 0
    if (eventData.domainNumber === 6) {
      if (prTierIdx === 0) return rTierIdx === 0 && secs > 0 && secs <= Math.round(prTimeSecs * 1.2) ? 1 : 0
      else return rTierIdx === prTierIdx - 1 && secs > 0 && secs <= Math.round(prTimeSecs * 0.6) ? 1 : 0
    } else {
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
  playerId: string | null
  playerName: string
  playerDivision?: string | null
  playerInfoMap?: Record<string, PlayerInfo>
  sessionId: string
  sessionEnded: boolean
  isExpanded: boolean
  isJudge?: boolean
  onToggle: () => void
  onScoreSubmitted: () => void
}

function EventCard({
  se, eventData, myResults, allResults, allEvents, seasonPR,
  playerId, playerName, playerDivision, playerInfoMap,
  sessionId, sessionEnded,
  isExpanded, isJudge = false, onToggle, onScoreSubmitted,
}: EventCardProps) {
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

  const myBestResult = myResults.length > 0
    ? myResults.reduce((best, r) => r.raw_score > best.raw_score ? r : best, myResults[0])
    : undefined

  const seasonPRNum = typeof seasonPR === 'number' ? seasonPR : null
  const sessionBestRaw = myResults.length > 0 ? Math.max(...myResults.map(r => r.raw_score)) : null
  const effectivePR = sessionBestRaw !== null
    ? (seasonPRNum !== null ? Math.max(sessionBestRaw, seasonPRNum) : sessionBestRaw)
    : seasonPRNum
  const effortLevel = calcEffortLevel(myResults)
  const effortTasks = computeEffortTasks(myResults, eventData, effectivePR, mode)
  const effortLocked = myResults.length === 0

  // Division placement for this event
  let divisionRankLabel = '—'
  let divisionRankColor = '#555'
  if (playerDivision && playerInfoMap) {
    if (myBestResult) {
      const divEventResults = allResults.filter(r =>
        r.event_id === se.id && r.player_id &&
        playerInfoMap[r.player_id]?.division === playerDivision
      )
      const bestPerDiv: Record<string, number> = {}
      divEventResults.forEach(r => {
        if (!r.player_id) return
        const ex = bestPerDiv[r.player_id]
        if (ex === undefined || r.raw_score > ex) bestPerDiv[r.player_id] = r.raw_score
      })
      const strictlyBetter = Object.values(bestPerDiv).filter(b => b > myBestResult.raw_score).length
      const rank = strictlyBetter + 1
      divisionRankLabel = ordinal(rank)
      divisionRankColor = rank === 1 ? '#F9B051' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#888'
    } else {
      divisionRankLabel = 'Last'
      divisionRankColor = '#555'
    }
  }

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
      return { raw_score: -strokes, score_label: `${strokes} strokes (4 holes)` }
    }
    return null
  }

  function isValid(): boolean { return computeScore() !== null }

  async function handleSubmit() {
    if (sessionEnded) return
    const scored = computeScore()
    if (!scored) return
    setSubmitting(true); setError('')
    try {
      const totalSecs = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)
      const payload: Record<string, unknown> = {
        session_id: sessionId, event_id: se.id, player_id: playerId || null,
        player_name: playerName, raw_score: scored.raw_score, score_label: scored.score_label,
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

      const newIsPR = seasonPRNum !== null && scored.raw_score > seasonPRNum && !myResults.some(r => r.is_pr)
      const effortTaskCount = calcSubmissionEffortTasks(
        scored.raw_score, parseInt(repCount) || null, parseFloat(weightKg) || null,
        difficultyTier || null, opponentName || null, totalSecs || null,
        myResults, eventData, effectivePR, mode
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

      setWeightKg(''); setRepCount(''); setTimeMins(''); setTimeSecs('')
      setSprintCs(''); setDistanceVal(''); setSportResult(''); setSportScore('')
      setOpponentName(''); setScoreInput(''); setEditingResult(null)
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
    if (!isExpanded) onToggle()
  }

  async function handleDelete(resultId: string) {
    if (editingResult?.id === resultId) setEditingResult(null)
    await supabase.from('results').delete().eq('id', resultId)
    onScoreSubmitted()
  }

  const myResultsSorted = [...myResults].sort((a, b) => b.raw_score - a.raw_score)

  // ── Collapsed card ────────────────────────────────────────────────────────
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: myBestResult ? '#0d1a0d' : '#111',
          border: `1px solid ${myBestResult ? '#4DB26E33' : '#1e1e1e'}`,
          borderRadius: '12px', padding: '14px 10px', cursor: 'pointer', width: '100%',
          gap: '0', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '26px', lineHeight: 1 }}>{emoji}</div>
        <div style={{
          fontSize: '11px', fontWeight: 700, color: '#fff',
          fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase',
          letterSpacing: '0.05em', lineHeight: 1.2, marginTop: '6px', marginBottom: '8px',
        }}>
          {se.event_name}
        </div>

        {/* Current Score */}
        <div style={{ fontSize: '9px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Score</div>
        <div style={{
          fontSize: '15px', fontWeight: 700, fontFamily: 'Bebas Neue, cursive',
          color: myBestResult ? '#4DB26E' : '#444', marginBottom: '6px',
        }}>
          {myBestResult ? (mode === 'sport' ? sportWDL(myResults) : myBestResult.score_label) : '—'}
        </div>

        {/* Division Placement */}
        <div style={{ fontSize: '9px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Div</div>
        <div style={{
          fontSize: '14px', fontWeight: 700, fontFamily: 'Bebas Neue, cursive',
          color: divisionRankColor, marginBottom: '6px',
        }}>
          {divisionRankLabel}
        </div>

        {/* Effort Level */}
        <div style={{ fontSize: '9px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.08em' }}>EL</div>
        <div style={{
          fontSize: '14px', fontWeight: 700, fontFamily: 'Bebas Neue, cursive',
          color: effortLevel > 0 ? '#B87DB5' : '#444',
        }}>
          {effortLevel}
        </div>
      </button>
    )
  }

  // ── Expanded card ─────────────────────────────────────────────────────────
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

        {/* TODAY'S TOP SCORE */}
        <div>
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Today's Top Score
          </div>
          {myBestResult ? (
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Bebas Neue, cursive' }}>
              {mode === 'sport' ? sportWDL(myResults) : myBestResult.score_label}
            </div>
          ) : (
            <div style={{ color: '#555', fontSize: '14px' }}>No score yet</div>
          )}
        </div>

        {/* PR THIS SEASON */}
        <div>
          <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
            Personal Record This Season
          </div>
          <div style={{ fontSize: '15px', color: seasonPRNum !== null ? '#F9B051' : '#555' }}>
            {seasonPRNum !== null ? formatPR(seasonPRNum, mode) : 'No PR yet'}
          </div>
        </div>

        {/* ALL TODAY'S SCORES */}
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
                        style={{ background: 'none', border: '1px solid #2371BB44', borderRadius: '4px', color: '#2371BB', cursor: 'pointer', fontSize: '11px', padding: '2px 8px', flexShrink: 0, fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}
                      >Edit</button>
                      <button
                        onClick={() => handleDelete(r.id)}
                        style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', flexShrink: 0 }}
                      >✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* EFFORT TASKS */}
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
            <div style={{ fontSize: '13px', color: '#555', fontStyle: 'italic' }}>Submit a score to unlock effort tasks</div>
          ) : effortTasks.length === 0 ? (
            <div style={{ fontSize: '13px', color: '#555', fontStyle: 'italic' }}>No effort tasks for this event</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {effortTasks.map((task, i) => {
                const done = task.count > 0
                return (
                  <div key={i} style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    background: '#0d0d0d', borderRadius: '8px', padding: '10px 14px',
                  }}>
                    <div style={{
                      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px',
                      background: done ? '#B87DB5' : '#1e1e1e', color: done ? '#fff' : '#555',
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

        {/* SUBMIT SCORE */}
        {!sessionEnded && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ fontSize: '10px', color: editingResult ? '#2371BB' : '#555', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'Barlow Condensed, sans-serif' }}>
                {editingResult ? 'Editing Score' : 'Submit Score'}
              </div>
              {editingResult && (
                <button
                  onClick={() => { setEditingResult(null); setWeightKg(''); setRepCount(''); setTimeMins(''); setTimeSecs(''); setSprintCs(''); setDistanceVal(''); setSportResult(''); setSportScore(''); setOpponentName(''); setDifficultyTier(''); setScoreInput('') }}
                  style={{ fontSize: '11px', color: '#555', background: 'none', border: '1px solid #333', borderRadius: '4px', padding: '2px 8px', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif' }}
                >Cancel</button>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {eventData?.variations && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>VARIATION</label>
                  <select value={exerciseVariation} onChange={e => setExerciseVariation(e.target.value)} style={{ ...INP, fontSize: '15px' }}>
                    <option value="">Select variation...</option>
                    {eventData.variations.map((v, i) => (
                      <option key={v} value={v}>D{i + 1} — {v}{eventData.weightVariations?.includes(v) ? ' (weight + reps)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {eventData?.hasDifficultyTiers && eventData.difficultyTiers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>DIFFICULTY TIER</label>
                  <select value={difficultyTier} onChange={e => setDifficultyTier(e.target.value)} style={{ ...INP, fontSize: '15px' }}>
                    <option value="">Select tier...</option>
                    {eventData.difficultyTiers.map(t => (
                      <option key={t.level} value={t.name}>D{t.level} — {t.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {(mode === 'strength' || isWeightVariation ||
                (mode === 'difficulty+reps' && isWeightScoredTierByName(eventData?.name ?? '', difficultyTier))) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)} placeholder="Weight (kg)" style={{ ...INP, flex: 2 }} />
                  {(mode === 'strength' || isWeightVariation) && (
                    <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)} placeholder="Reps" style={{ ...INP, flex: 1 }} />
                  )}
                </div>
              )}

              {((mode === 'reps') && !isWeightVariation) ||
               (mode === 'difficulty+reps' && !isWeightScoredTierByName(eventData?.name ?? '', difficultyTier))
                ? <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)} placeholder="Reps" style={INP} />
                : null}

              {(mode === 'time' || mode === 'hold' || mode === 'weight+time' || mode === 'difficulty+time') && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)} placeholder="min" style={{ ...INP, flex: 1 }} />
                  <span style={{ color: '#555', fontSize: '20px' }}>:</span>
                  <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="sec" style={{ ...INP, flex: 1 }} />
                </div>
              )}

              {mode === 'sprint' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)} placeholder="Seconds" style={{ ...INP, flex: 2 }} />
                  <span style={{ color: '#555', fontSize: '18px' }}>.</span>
                  <input type="number" value={sprintCs} onChange={e => setSprintCs(e.target.value)} placeholder="cs" style={{ ...INP, flex: 1 }} min="0" max="99" />
                </div>
              )}

              {mode === 'distance' && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input type="number" value={distanceVal} onChange={e => setDistanceVal(e.target.value)} placeholder="Distance" style={{ ...INP, flex: 2 }} />
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
                          background: active ? colors[r] + '22' : '#111', color: active ? colors[r] : '#444',
                        }}>{r.charAt(0).toUpperCase() + r.slice(1)}</button>
                      )
                    })}
                  </div>
                  <input value={opponentName} onChange={e => setOpponentName(e.target.value)} placeholder="Opponent name (optional)" style={{ ...INP, fontSize: '15px' }} />
                  <input value={sportScore} onChange={e => setSportScore(e.target.value)} placeholder="Score e.g. 21–18 (optional)" style={{ ...INP, fontSize: '15px' }} />
                </div>
              )}

              {mode === 'score' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>STROKE COUNT (4 HOLES)</label>
                  <input type="number" value={scoreInput} onChange={e => setScoreInput(e.target.value)} placeholder="e.g. 18" style={INP} min="1" />
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

// ─── Division pool constants ──────────────────────────────────────────────────

const MENS_DIVS = ["Men's", 'Masters Men', 'Grandmaster Men']
const WOMENS_DIVS = ["Women's", 'Masters Women', 'Grandmaster Women']

function medalBg(rank: number): string {
  return rank === 1 ? '#F9B051' : rank === 2 ? '#C0C0C0' : rank === 3 ? '#CD7F32' : '#2a2a2a'
}
function medalColor(rank: number): string { return rank <= 3 ? '#000' : '#aaa' }

// ─── JudgeSummaryTab ──────────────────────────────────────────────────────────

function JudgeSummaryTab({
  events, results, playerInfoMap, onScoreChanged,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
  onScoreChanged: () => void
}) {
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)

  function getPoolResults(pool: 'mens' | 'womens' | 'juniors') {
    return results.filter(r => {
      if (!r.player_id) return false
      const info = playerInfoMap[r.player_id]
      if (!info) return false
      if (pool === 'mens') return MENS_DIVS.includes(info.division)
      if (pool === 'womens') return WOMENS_DIVS.includes(info.division)
      return info.division === 'Juniors'
    })
  }

  function computeSummaryRows(pool: 'mens' | 'womens' | 'juniors') {
    const poolResults = getPoolResults(pool)
    const playerIds = [...new Set(poolResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (playerIds.length === 0) return []

    const rows = playerIds.map(pid => {
      let totalPlacement = 0
      const eventDetails = events.map(ev => {
        const evRes = poolResults.filter(r => r.event_id === ev.id)
        const best: Record<string, { rawScore: number; scoreLabel: string }> = {}
        evRes.forEach(r => {
          if (!r.player_id) return
          const ex = best[r.player_id]
          if (!ex || r.raw_score > ex.rawScore) best[r.player_id] = { rawScore: r.raw_score, scoreLabel: r.score_label }
        })
        const scorerCount = Object.keys(best).length
        const myBest = best[pid]
        const evData = getEventByName(ev.event_name)
        const isSport = evData?.inputMode === 'sport'
        if (!myBest) {
          totalPlacement += scorerCount + 1
          return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', displayLabel: null as string | null, placement: scorerCount + 1, hasScore: false }
        }
        const placement = 1 + Object.values(best).filter(b => b.rawScore > myBest.rawScore).length
        totalPlacement += placement
        const displayLabel = isSport
          ? sportWDL(poolResults.filter(r => r.player_id === pid && r.event_id === ev.id))
          : myBest.scoreLabel
        return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', displayLabel, placement, hasScore: true }
      })
      const sample = poolResults.find(r => r.player_id === pid)!
      const division = playerInfoMap[pid]?.division ?? ''
      return { playerId: pid, playerName: sample.player_name, totalPlacement, eventDetails, division }
    })
    rows.sort((a, b) => a.totalPlacement - b.totalPlacement)
    return rows.map((e, _, arr) => ({ ...e, rank: 1 + arr.filter(x => x.totalPlacement < e.totalPlacement).length }))
  }

  async function handleDelete(resultId: string) {
    await supabase.from('results').delete().eq('id', resultId)
    setEditingKey(null)
    onScoreChanged()
  }

  function renderSummarySection(pool: 'mens' | 'womens' | 'juniors', title: string) {
    const rows = computeSummaryRows(pool)
    const poolResults = getPoolResults(pool)
    return (
      <div style={{ marginBottom: '28px' }}>
        <div style={{ fontSize: '16px', fontWeight: 700, color: '#fff', fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.08em', marginBottom: '10px', borderBottom: '1px solid #1e1e1e', paddingBottom: '8px' }}>
          {title}
        </div>
        {rows.length === 0 ? (
          <div style={{ color: '#555', fontSize: '13px', padding: '8px 0', fontFamily: 'Barlow Condensed, sans-serif' }}>No scores submitted</div>
        ) : (
          rows.map(entry => {
            const isExpanded = expandedPlayerId === entry.playerId
            return (
              <div key={entry.playerId} style={{ marginBottom: '6px' }}>
                <button
                  onClick={() => setExpandedPlayerId(isExpanded ? null : entry.playerId)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
                    padding: '10px 14px',
                    background: isExpanded ? '#0d1a2e' : '#111',
                    border: `1px solid ${isExpanded ? '#2371BB' : '#1e1e1e'}`,
                    borderRadius: isExpanded ? '10px 10px 0 0' : '10px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700,
                    background: medalBg(entry.rank), color: medalColor(entry.rank),
                  }}>{entry.rank}</div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>{entry.playerName}</div>
                    {['Masters Men', 'Masters Women', 'Grandmaster Men', 'Grandmaster Women'].includes(entry.division) && (
                      <div style={{ fontSize: '10px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif' }}>{entry.division}</div>
                    )}
                  </div>
                  <div style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0, marginRight: '4px' }}>
                    {entry.totalPlacement}pts
                  </div>
                  <span style={{ color: isExpanded ? '#2371BB' : '#444', fontSize: '12px' }}>{isExpanded ? '▲' : '▼'}</span>
                </button>

                {isExpanded && (
                  <div style={{ background: '#0a0a0a', border: '1px solid #2371BB', borderTop: 'none', borderRadius: '0 0 10px 10px', overflow: 'hidden' }}>
                    {entry.eventDetails.map((ed, i) => {
                      const editKey = `${entry.playerId}-${ed.eventId}`
                      const isEditingThis = editingKey === editKey
                      const eventResults = poolResults.filter(r => r.player_id === entry.playerId && r.event_id === ed.eventId)
                      return (
                        <div key={ed.eventId} style={{ borderBottom: i < entry.eventDetails.length - 1 ? '1px solid #111' : 'none' }}>
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 14px',
                            background: isEditingThis ? '#0d1a2e' : i % 2 === 0 ? '#0a0a0a' : '#0d0d0d',
                          }}>
                            <span style={{ fontSize: '14px', flexShrink: 0 }}>{ed.emoji}</span>
                            <div style={{ flex: 1, fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>{ed.eventName}</div>
                            <div style={{ fontSize: '12px', color: ed.displayLabel ? '#ccc' : '#333', minWidth: '60px', textAlign: 'right' }}>
                              {ed.displayLabel ?? '—'}
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 700, minWidth: '28px', textAlign: 'right', color: ed.hasScore ? '#F9B051' : '#333', fontFamily: 'Barlow Condensed, sans-serif' }}>
                              {ordinal(ed.placement)}
                            </div>
                            <button
                              onClick={() => setEditingKey(isEditingThis ? null : editKey)}
                              style={{
                                background: 'none',
                                border: `1px solid ${isEditingThis ? '#EA474244' : '#2371BB33'}`,
                                borderRadius: '4px', color: isEditingThis ? '#EA4742' : '#2371BB',
                                cursor: 'pointer', fontSize: '11px', padding: '2px 8px',
                                fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, flexShrink: 0,
                              }}
                            >
                              {isEditingThis ? 'Close' : 'Edit'}
                            </button>
                          </div>
                          {isEditingThis && (
                            <div style={{ padding: '12px 14px', background: '#0d1020', borderTop: '1px solid #1e1e1e' }}>
                              {eventResults.length > 0 ? (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '10px' }}>
                                  <div style={{ fontSize: '10px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em', marginBottom: '4px' }}>SUBMITTED SCORES</div>
                                  {eventResults.map(r => (
                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', borderRadius: '8px', padding: '8px 12px' }}>
                                      <div style={{ flex: 1, fontSize: '14px', color: '#fff' }}>{r.score_label}</div>
                                      {r.difficulty_tier && (
                                        <div style={{ fontSize: '10px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif' }}>{r.difficulty_tier}</div>
                                      )}
                                      <button
                                        onClick={() => handleDelete(r.id)}
                                        style={{
                                          background: '#EA474222', border: '1px solid #EA474244',
                                          borderRadius: '4px', color: '#EA4742', cursor: 'pointer',
                                          fontSize: '11px', padding: '3px 10px',
                                          fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
                                        }}
                                      >Delete</button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div style={{ fontSize: '13px', color: '#555', marginBottom: '10px' }}>No score submitted yet</div>
                              )}
                              <div style={{ fontSize: '11px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                To add or update a score, use the Kaiwhakawā tab and select {entry.playerName}.
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>
    )
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: '11px', color: '#EA4742', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '16px', fontWeight: 700 }}>
        GAME SUMMARY — ALL PLAYERS
      </div>
      {renderSummarySection('mens', "Men's")}
      {renderSummarySection('womens', "Women's")}
      {renderSummarySection('juniors', 'Juniors')}
    </div>
  )
}

// ─── LeaderboardTab ───────────────────────────────────────────────────────────

function LeaderboardTab({
  events, results, playerInfoMap, currentPlayerId, currentPlayerDivision,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
  currentPlayerId: string | null
  currentPlayerDivision: string | null
}) {
  const [menFilter, setMenFilter] = useState<'Masters Men' | 'Grandmaster Men' | null>(null)
  const [womenFilter, setWomenFilter] = useState<'Masters Women' | 'Grandmaster Women' | null>(null)
  const [juniorAge, setJuniorAge] = useState<number | null>(null)
  const [eventFilterId, setEventFilterId] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})
  const [expandedPlayerKey, setExpandedPlayerKey] = useState<string | null>(null)

  const juniorAges = useMemo(() => {
    const ages = new Set<number>()
    results.forEach(r => {
      if (!r.player_id) return
      const info = playerInfoMap[r.player_id]
      if (!info || info.division !== 'Juniors') return
      if (info.date_of_birth) ages.add(getAge(info.date_of_birth))
    })
    return [...ages].sort((a, b) => a - b)
  }, [results, playerInfoMap])

  function getPoolResults(pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null) {
    return results.filter(r => {
      if (!r.player_id) return false
      const info = playerInfoMap[r.player_id]
      if (!info) return false
      if (pool === 'mens') return filter ? info.division === filter : MENS_DIVS.includes(info.division)
      if (pool === 'womens') return filter ? info.division === filter : WOMENS_DIVS.includes(info.division)
      if (pool === 'juniors') {
        if (info.division !== 'Juniors') return false
        if (ageFilter !== null) return info.date_of_birth ? getAge(info.date_of_birth) === ageFilter : true
        return true
      }
      return false
    })
  }

  type EventDetail = {
    eventId: string; eventName: string; emoji: string
    scoreLabel: string | null; displayLabel: string | null; placement: number
  }
  type CompRow = {
    playerKey: string; playerName: string; playerId: string
    totalPlacement: number; rank: number
    subDivision?: string; subDivisionRank?: number
    eventDetails: EventDetail[]
  }

  function computeRows(pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null): CompRow[] {
    const poolResults = getPoolResults(pool, filter, ageFilter)
    const playerIds = [...new Set(poolResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (playerIds.length === 0) return []

    const rows = playerIds.map(pid => {
      let totalPlacement = 0
      const eventDetails: EventDetail[] = events.map(ev => {
        const evPoolRes = poolResults.filter(r => r.event_id === ev.id)
        const best: Record<string, { rawScore: number; scoreLabel: string }> = {}
        evPoolRes.forEach(r => {
          if (!r.player_id) return
          const ex = best[r.player_id]
          if (!ex || r.raw_score > ex.rawScore) best[r.player_id] = { rawScore: r.raw_score, scoreLabel: r.score_label }
        })
        const scorerCount = Object.keys(best).length
        const myBest = best[pid]
        const evData = getEventByName(ev.event_name)
        const isSport = evData?.inputMode === 'sport'
        if (!myBest) {
          totalPlacement += scorerCount + 1
          return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', scoreLabel: null, displayLabel: null, placement: scorerCount + 1 }
        }
        const placement = 1 + Object.values(best).filter(b => b.rawScore > myBest.rawScore).length
        totalPlacement += placement
        const displayLabel = isSport
          ? sportWDL(poolResults.filter(r => r.player_id === pid && r.event_id === ev.id))
          : myBest.scoreLabel
        return { eventId: ev.id, eventName: ev.event_name, emoji: evData?.emoji ?? '🏅', scoreLabel: myBest.scoreLabel, displayLabel, placement }
      })
      const sample = poolResults.find(r => r.player_id === pid)!
      return { playerKey: pid, playerName: sample.player_name, playerId: pid, totalPlacement, eventDetails }
    })

    rows.sort((a, b) => a.totalPlacement - b.totalPlacement)
    const ranked: CompRow[] = rows.map((e, _, arr) => ({
      ...e,
      rank: 1 + arr.filter(x => x.totalPlacement < e.totalPlacement).length,
    }))

    // Compute sub-division ranks when showing full unfiltered pool
    if (!filter && (pool === 'mens' || pool === 'womens')) {
      const subDivDefs = pool === 'mens'
        ? [{ key: 'Masters Men', label: 'Masters' }, { key: 'Grandmaster Men', label: '60+' }]
        : [{ key: 'Masters Women', label: 'Masters' }, { key: 'Grandmaster Women', label: '60+' }]
      for (const { key, label } of subDivDefs) {
        const subRows = ranked.filter(r => playerInfoMap[r.playerId]?.division === key)
        subRows.sort((a, b) => a.totalPlacement - b.totalPlacement)
        subRows.forEach((r, _, arr) => {
          r.subDivision = label
          r.subDivisionRank = 1 + arr.filter(x => x.totalPlacement < r.totalPlacement).length
        })
      }
    }

    return ranked
  }

  type EventRow = { playerKey: string; playerName: string; playerId: string | null; rawScore: number; label: string; rank: number }

  function computeEventRows(eventId: string, pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null): EventRow[] {
    const poolResults = getPoolResults(pool, filter, ageFilter).filter(r => r.event_id === eventId)
    const best: Record<string, { name: string; rawScore: number; label: string; playerId: string | null }> = {}
    poolResults.forEach(r => {
      const key = String(r.player_id ?? r.player_name)
      const ex = best[key]
      if (!ex || r.raw_score > ex.rawScore) best[key] = { name: r.player_name, rawScore: r.raw_score, label: r.score_label, playerId: r.player_id }
    })
    const rows = Object.entries(best).map(([key, val]) => ({ playerKey: key, playerName: val.name, playerId: val.playerId, rawScore: val.rawScore, label: val.label }))
    rows.sort((a, b) => b.rawScore - a.rawScore)
    return rows.map((r, _, arr) => ({ ...r, rank: 1 + arr.filter(o => o.rawScore > r.rawScore).length }))
  }

  function chipStyle(active: boolean): React.CSSProperties {
    return {
      padding: '4px 10px', borderRadius: '16px', border: `1px solid ${active ? '#2371BB' : '#222'}`,
      fontSize: '11px', fontWeight: active ? 700 : 400, cursor: 'pointer',
      background: active ? '#0d1a2e' : '#111', color: active ? '#7ab4ff' : '#555',
      fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0,
    }
  }

  function renderCompRow(entry: CompRow, isMe: boolean) {
    const isEx = expandedPlayerKey === entry.playerKey && entry.rank <= 3
    const canExpand = entry.rank <= 3
    return (
      <div key={entry.playerKey} style={{
        background: isMe ? '#0d1020' : entry.rank === 1 ? '#0d1a0d' : '#111',
        borderRadius: '10px', overflow: 'hidden', marginBottom: '6px',
        border: `1px solid ${isEx ? '#2371BB' : isMe ? '#2371BB33' : entry.rank === 1 ? '#4DB26E33' : '#1e1e1e'}`,
      }}>
        <button
          disabled={!canExpand}
          onClick={() => canExpand && setExpandedPlayerKey(isEx ? null : entry.playerKey)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px', width: '100%',
            padding: '10px 14px', background: 'transparent', border: 'none',
            cursor: canExpand ? 'pointer' : 'default',
          }}
        >
          <div style={{
            width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', fontWeight: 700,
            background: medalBg(entry.rank), color: medalColor(entry.rank),
          }}>{entry.rank}</div>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontSize: '14px', fontWeight: entry.rank <= 3 ? 700 : 400, color: isMe ? '#7ab4ff' : entry.rank <= 3 ? '#fff' : '#aaa' }}>
              {entry.playerName}
              {isMe && <span style={{ fontSize: '10px', color: '#555', marginLeft: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>YOU</span>}
            </div>
            {entry.subDivision && entry.subDivisionRank && (
              <div style={{ fontSize: '10px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '1px' }}>
                {ordinal(entry.subDivisionRank)} {entry.subDivision}
              </div>
            )}
          </div>
          <div style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', flexShrink: 0, marginRight: canExpand ? '4px' : '0' }}>
            {entry.totalPlacement}pts
          </div>
          {canExpand && <span style={{ color: isEx ? '#2371BB' : '#444', fontSize: '12px' }}>{isEx ? '▲' : '▼'}</span>}
        </button>

        {isEx && (
          <div style={{ borderTop: '1px solid #1e1e1e', padding: '4px 0' }}>
            {entry.eventDetails.map((ed, i) => (
              <div key={ed.eventId} style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px',
                background: i % 2 === 0 ? '#0a0a0a' : 'transparent',
              }}>
                <span style={{ fontSize: '14px', flexShrink: 0 }}>{ed.emoji}</span>
                <div style={{ flex: 1, fontSize: '11px', color: '#666' }}>{ed.eventName}</div>
                <div style={{ fontSize: '12px', color: ed.displayLabel ? '#ccc' : '#444' }}>
                  {ed.displayLabel ?? 'No score'}
                </div>
                <div style={{ fontSize: '11px', fontWeight: 700, minWidth: '32px', textAlign: 'right', color: ed.scoreLabel ? '#F9B051' : '#444', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  {ordinal(ed.placement)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  function renderSection(pool: 'mens' | 'womens' | 'juniors', filter: string | null, ageFilter: number | null, sectionId: string) {
    const isExpanded = expandedSections[sectionId] ?? false
    const isMyPool = pool === 'mens'
      ? MENS_DIVS.includes(currentPlayerDivision ?? '')
      : pool === 'womens'
        ? WOMENS_DIVS.includes(currentPlayerDivision ?? '')
        : currentPlayerDivision === 'Juniors'

    if (eventFilterId) {
      const evRows = computeEventRows(eventFilterId, pool, filter, ageFilter)
      if (evRows.length === 0) return null
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {evRows.map(entry => (
            <div key={entry.playerKey} style={{
              display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px',
              background: '#111', borderRadius: '10px', border: '1px solid #1e1e1e',
            }}>
              <div style={{
                width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '12px', fontWeight: 700, background: medalBg(entry.rank), color: medalColor(entry.rank),
              }}>{entry.rank}</div>
              <div style={{ flex: 1, fontSize: '14px', color: entry.playerId === currentPlayerId ? '#7ab4ff' : '#aaa' }}>
                {entry.playerName}
                {entry.playerId === currentPlayerId && <span style={{ fontSize: '10px', color: '#555', marginLeft: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>YOU</span>}
              </div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Bebas Neue, cursive' }}>
                {entry.label}
              </div>
            </div>
          ))}
        </div>
      )
    }

    const rows = computeRows(pool, filter, ageFilter)
    if (rows.length === 0) return null

    const top3 = rows.slice(0, 3)
    const rest = rows.slice(3)
    const myRow = isMyPool && currentPlayerId ? rows.find(r => r.playerId === currentPlayerId) : undefined
    const myRowIsBelow = myRow && myRow.rank > 3 && !isExpanded

    return (
      <div>
        {top3.map(e => renderCompRow(e, e.playerId === currentPlayerId))}
        {rest.length > 0 && (
          <button
            onClick={() => setExpandedSections(s => ({ ...s, [sectionId]: !s[sectionId] }))}
            style={{
              width: '100%', padding: '7px', background: 'none',
              border: '1px solid #1e1e1e', borderRadius: '8px', color: '#555',
              fontSize: '12px', cursor: 'pointer', marginBottom: '6px',
              fontFamily: 'Barlow Condensed, sans-serif',
            }}
          >
            {isExpanded ? '▲ Show less' : `▼ Show all (${rest.length} more)`}
          </button>
        )}
        {isExpanded && rest.map(e => renderCompRow(e, e.playerId === currentPlayerId))}
        {myRowIsBelow && (
          <>
            <div style={{ textAlign: 'center', color: '#333', fontSize: '11px', margin: '4px 0', letterSpacing: '3px' }}>• • •</div>
            {renderCompRow(myRow, true)}
          </>
        )}
      </div>
    )
  }

  const selectedEvent = eventFilterId ? events.find(e => e.id === eventFilterId) : null

  return (
    <div style={{ padding: '12px 16px' }}>

      {/* Event filter */}
      <div style={{ marginBottom: '16px' }}>
        <select
          value={eventFilterId ?? ''}
          onChange={e => { setEventFilterId(e.target.value || null); setExpandedPlayerKey(null) }}
          style={{
            width: '100%', background: eventFilterId ? '#0d1a2e' : '#0d0d0d',
            border: `1px solid ${eventFilterId ? '#2371BB' : '#222'}`,
            borderRadius: '8px', padding: '10px 14px',
            color: eventFilterId ? '#7ab4ff' : '#666',
            fontSize: '14px', fontFamily: 'Barlow, sans-serif',
          }}
        >
          <option value="">Overall ranking</option>
          {events.map(ev => <option key={ev.id} value={ev.id}>{ev.event_name}</option>)}
        </select>
        {selectedEvent && (
          <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}>
            SHOWING SCORES FOR: {selectedEvent.event_name.toUpperCase()}
          </div>
        )}
      </div>

      {/* Men's section — always shown */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.08em' }}>
            {menFilter === 'Masters Men' ? 'Masters (Men)' : menFilter === 'Grandmaster Men' ? '60+ (Men)' : "Men's"}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => { setMenFilter(null); setExpandedPlayerKey(null) }} style={chipStyle(menFilter === null)}>All</button>
            <button onClick={() => { setMenFilter(menFilter === 'Masters Men' ? null : 'Masters Men'); setExpandedPlayerKey(null) }} style={chipStyle(menFilter === 'Masters Men')}>Masters</button>
            <button onClick={() => { setMenFilter(menFilter === 'Grandmaster Men' ? null : 'Grandmaster Men'); setExpandedPlayerKey(null) }} style={chipStyle(menFilter === 'Grandmaster Men')}>60+</button>
          </div>
        </div>
        {renderSection('mens', menFilter, null, 'mens') ?? (
          <div style={{ color: '#555', fontSize: '13px', padding: '12px 0', fontFamily: 'Barlow Condensed, sans-serif' }}>No scores yet</div>
        )}
      </div>

      {/* Women's section — always shown */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.08em' }}>
            {womenFilter === 'Masters Women' ? 'Masters (Women)' : womenFilter === 'Grandmaster Women' ? '60+ (Women)' : "Women's"}
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button onClick={() => { setWomenFilter(null); setExpandedPlayerKey(null) }} style={chipStyle(womenFilter === null)}>All</button>
            <button onClick={() => { setWomenFilter(womenFilter === 'Masters Women' ? null : 'Masters Women'); setExpandedPlayerKey(null) }} style={chipStyle(womenFilter === 'Masters Women')}>Masters</button>
            <button onClick={() => { setWomenFilter(womenFilter === 'Grandmaster Women' ? null : 'Grandmaster Women'); setExpandedPlayerKey(null) }} style={chipStyle(womenFilter === 'Grandmaster Women')}>60+</button>
          </div>
        </div>
        {renderSection('womens', womenFilter, null, 'womens') ?? (
          <div style={{ color: '#555', fontSize: '13px', padding: '12px 0', fontFamily: 'Barlow Condensed, sans-serif' }}>No scores yet</div>
        )}
      </div>

      {/* Juniors section — always shown */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.08em', marginBottom: '8px' }}>
            {juniorAge !== null ? `Juniors — Age ${juniorAge}` : 'Juniors'}
          </div>
          {juniorAges.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => { setJuniorAge(null); setExpandedPlayerKey(null) }} style={chipStyle(juniorAge === null)}>All</button>
              {juniorAges.map(age => (
                <button key={age} onClick={() => { setJuniorAge(age === juniorAge ? null : age); setExpandedPlayerKey(null) }} style={chipStyle(juniorAge === age)}>
                  Age {age}
                </button>
              ))}
            </div>
          )}
        </div>
        {renderSection('juniors', null, juniorAge, 'juniors') ?? (
          <div style={{ color: '#555', fontSize: '13px', padding: '12px 0', fontFamily: 'Barlow Condensed, sans-serif' }}>No scores yet</div>
        )}
      </div>
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
  const [isJudge, setIsJudge] = useState(false)
  const [judgeTargetId, setJudgeTargetId] = useState<string>('')
  const [judgeMode, setJudgeMode] = useState<'account' | 'guest'>('account')
  const [judgeGuestName, setJudgeGuestName] = useState('')
  const [sessionPlayers, setSessionPlayers] = useState<{ id: string; name: string }[]>([])
  const [judgePRs, setJudgePRs] = useState<Record<string, number | string | null>>({})

  const allPlayers = player ? [player, ...familyMembers] : []
  const activePlayer = allPlayers.find(p => p.id === activePlayerId) ?? player
  const activePlayerDivision = activePlayer ? (activePlayer as Record<string, unknown>).division as string | null : null

  // ── Division placement for banner ──────────────────────────────────────────
  const myDivisionPlacement = useMemo(() => {
    if (!activePlayerId) return null
    const myInfo = playerInfoMap[activePlayerId]
    if (!myInfo) return null
    const myDivision = myInfo.division
    if (!myDivision) return null

    const myResults = results.filter(r => r.player_id === activePlayerId)
    if (myResults.length === 0) return null

    const divResults = results.filter(r => r.player_id && playerInfoMap[r.player_id]?.division === myDivision)
    const playerIds = [...new Set(divResults.map(r => r.player_id).filter(Boolean))] as string[]
    if (!playerIds.includes(activePlayerId)) return null

    const placements = playerIds.map(pid => {
      let total = 0
      events.forEach(ev => {
        const evDivRes = divResults.filter(r => r.event_id === ev.id)
        const best: Record<string, number> = {}
        evDivRes.forEach(r => {
          if (!r.player_id) return
          const ex = best[r.player_id]
          if (ex === undefined || r.raw_score > ex) best[r.player_id] = r.raw_score
        })
        const scorerCount = Object.keys(best).length
        const myBest = best[pid]
        if (myBest === undefined) total += scorerCount + 1
        else total += 1 + Object.values(best).filter(b => b > myBest).length
      })
      return { pid, total }
    })
    placements.sort((a, b) => a.total - b.total)
    const myEntry = placements.find(p => p.pid === activePlayerId)
    if (!myEntry) return null
    const rank = 1 + placements.filter(p => p.total < myEntry.total).length
    return { rank, divisionName: myDivision }
  }, [activePlayerId, results, events, playerInfoMap])

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
          const { data: children } = await supabase.from('players').select('*').eq('parent_id', authUser.id).order('full_name')
          setFamilyMembers((children ?? []) as Record<string, unknown>[])
          if ((p as Record<string, unknown>).role === 'judge') setIsJudge(true)
        }
      }
      const { data: s } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      setSession(s as Record<string, unknown> | null)
      if (s && !(s as Record<string, unknown>).is_active) setSessionEnded(true)

      const { data: ev } = await supabase.from('session_events').select('*').eq('session_id', sessionId).order('domain_number')
      setEvents((ev ?? []) as SessionEvent[])
      await loadResults()
    }
    load()
  }, [sessionId, loadResults])

  // ── Load player info for leaderboard ──────────────────────────────────────
  useEffect(() => {
    if (results.length === 0) return
    const ids = [...new Set(results.map(r => r.player_id).filter(Boolean))] as string[]
    if (ids.length === 0) return
    supabase.from('players').select('id, division, date_of_birth').in('id', ids).then(({ data }) => {
      if (!data) return
      const map: Record<string, PlayerInfo> = {}
      data.forEach(p => { map[p.id] = { division: p.division ?? '', date_of_birth: p.date_of_birth ?? null } })
      setPlayerInfoMap(map)
    })
  }, [results])

  // ── Load ALL registered players for judge dropdown ─────────────────────────
  useEffect(() => {
    if (!isJudge) return
    supabase.from('players').select('id, display_name, username, full_name').order('display_name', { ascending: true }).then(({ data }) => {
      if (!data) return
      setSessionPlayers(data.map(p => ({
        id: p.id,
        name: (p.display_name || p.username || p.full_name || 'Unknown') as string,
      })))
    })
  }, [isJudge])

  // ── Load season PRs for active player ─────────────────────────────────────
  useEffect(() => {
    if (!activePlayerId || events.length === 0) return
    const year = new Date().getFullYear()
    async function loadPRs() {
      const prs: Record<string, number | string | null> = {}
      for (const ev of events) {
        const evData = getEventByName(ev.event_name)
        const slug = ev.event_slug || evData?.slug
        if (!slug) { prs[ev.id] = null; continue }
        const { data } = await supabase.rpc('get_player_season_pr', {
          p_player_id: activePlayerId,
          p_event_slug: slug,
          p_season_year: year,
        })
        prs[ev.id] = data as number | null
      }
      setSeasonPRs(prs)
    }
    loadPRs()
  }, [activePlayerId, events])

  // ── Load PRs for judge's selected player ──────────────────────────────────
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` }, () => loadResults())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` }, p => {
        const updated = p.new as Record<string, unknown>
        if (updated.is_active === false) setSessionEnded(true)
      })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId, loadResults])

  // Polling fallback — refreshes every 15s in case realtime drops
  useEffect(() => {
    const id = setInterval(loadResults, 15000)
    return () => clearInterval(id)
  }, [loadResults])

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

  const bannerStatusLabel = sessionEnded
    ? 'SESSION ENDED'
    : preSessionSecsLeft !== null
      ? 'STARTING SOON'
      : activePlayerDivision
        ? activePlayerDivision.toUpperCase()
        : 'LIVE SESSION'

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '640px', margin: '0 auto', fontFamily: 'Barlow, sans-serif' }}>

      {/* Top banner — Placement + Timer */}
      <div style={{ background: '#2371BB', padding: '12px 16px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              {bannerStatusLabel}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.05em', lineHeight: 1 }}>
              {myDivisionPlacement ? ordinal(myDivisionPlacement.rank) : '—'}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Time Left
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: timerColour, fontVariantNumeric: 'tabular-nums', fontFamily: 'Bebas Neue, cursive', lineHeight: 1 }}>
              {timerDisplay}
            </div>
          </div>
        </div>
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
        {isJudge && (
          <button onClick={() => setActiveTab('judge-summary')}
            style={{
              padding: '12px 16px', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              fontSize: '13px', fontWeight: activeTab === 'judge-summary' ? 700 : 400, flexShrink: 0,
              background: activeTab === 'judge-summary' ? '#111' : 'transparent',
              color: activeTab === 'judge-summary' ? '#EA4742' : '#555',
              borderBottom: `2px solid ${activeTab === 'judge-summary' ? '#EA4742' : 'transparent'}`,
            }}>
            Summary
          </button>
        )}
      </div>

      {/* Player tabs */}
      {allPlayers.map(p => {
        const pid = p.id as string
        const tabId = `player-${pid}`
        if (activeTab !== tabId) return null
        const pName = (p.display_name || p.username || p.full_name) as string
        const pDivision = (p.division as string | null) ?? null
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

            <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: '13px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                Effort Level: {totalEffort} / 20
              </div>
            </div>

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
                    playerDivision={pDivision}
                    playerInfoMap={playerInfoMap}
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
          <div style={{ marginBottom: '16px' }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#EA4742', letterSpacing: '0.05em' }}>Kaiwhakawā</div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em', marginBottom: '12px' }}>SCORE FOR ANY PLAYER</div>
            {sessionEnded && (
              <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '10px 14px', marginBottom: '12px', color: '#EA4742', fontSize: '13px' }}>
                Session ended — scoring locked
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
              {(['account', 'guest'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setJudgeMode(m); setJudgeTargetId(''); setJudgeGuestName(''); setExpandedEventId(null) }}
                  style={{
                    flex: 1, padding: '8px 0', borderRadius: '8px', border: 'none',
                    cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif',
                    fontSize: '13px', fontWeight: 700, letterSpacing: '0.06em',
                    background: judgeMode === m ? '#EA4742' : '#1a1a1a',
                    color: judgeMode === m ? '#fff' : '#555',
                  }}
                >
                  {m === 'account' ? 'REGISTERED PLAYER' : 'GUEST PLAYER'}
                </button>
              ))}
            </div>

            {judgeMode === 'account' ? (
              <>
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
                  {sessionPlayers.map(sp => <option key={sp.id} value={sp.id}>{sp.name}</option>)}
                </select>
                {sessionPlayers.length === 0 && (
                  <div style={{ fontSize: '12px', color: '#555', marginTop: '8px' }}>
                    No registered players yet — switch to Guest Player to score anyone by name.
                  </div>
                )}
              </>
            ) : (
              <input
                type="text"
                placeholder="Enter player name..."
                value={judgeGuestName}
                onChange={e => { setJudgeGuestName(e.target.value); setExpandedEventId(null) }}
                style={{
                  width: '100%', background: '#0d0d0d', border: '1px solid #EA474244',
                  borderRadius: '8px', padding: '12px 14px', color: '#fff',
                  fontSize: '15px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box',
                }}
              />
            )}
          </div>

          {(() => {
            const isAccountMode = judgeMode === 'account'
            const activeId = isAccountMode ? judgeTargetId : null
            const activeName = isAccountMode
              ? (sessionPlayers.find(s => s.id === judgeTargetId)?.name ?? '')
              : judgeGuestName.trim()
            if (!activeName) return null

            const judgeMyResults = isAccountMode
              ? results.filter(r => r.player_id === activeId)
              : results.filter(r => !r.player_id && r.player_name === activeName)
            const totalEffort = calcTotalEffortLevel(judgeMyResults, events)

            // Get judge target player's division for division rank display
            const judgeTargetDivision = isAccountMode && activeId
              ? (playerInfoMap[activeId]?.division ?? null)
              : null

            return (
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff' }}>
                    {activeName}
                    {!isAccountMode && <span style={{ fontSize: '11px', color: '#EA4742', marginLeft: '8px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em' }}>GUEST</span>}
                  </div>
                  <div style={{ fontSize: '13px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                    Effort Level: {totalEffort} / 20
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {events.map(ev => {
                    const evResults = isAccountMode
                      ? results.filter(r => r.event_id === ev.id && r.player_id === activeId)
                      : results.filter(r => r.event_id === ev.id && !r.player_id && r.player_name === activeName)
                    const evData = getEventByName(ev.event_name)
                    const pr = isAccountMode ? (judgePRs[ev.id] ?? null) : null
                    const cardKey = isAccountMode ? `judge-${ev.id}` : `judge-guest-${ev.id}`
                    return (
                      <EventCard
                        key={cardKey}
                        se={ev}
                        eventData={evData}
                        myResults={evResults}
                        allResults={results}
                        allEvents={events}
                        seasonPR={pr}
                        playerId={activeId}
                        playerName={activeName}
                        playerDivision={judgeTargetDivision}
                        playerInfoMap={playerInfoMap}
                        sessionId={sessionId as string}
                        sessionEnded={sessionEnded}
                        isJudge={true}
                        isExpanded={expandedEventId === cardKey}
                        onToggle={() => setExpandedEventId(expandedEventId === cardKey ? null : cardKey)}
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
        <LeaderboardTab
          events={events}
          results={results}
          playerInfoMap={playerInfoMap}
          currentPlayerId={activePlayerId}
          currentPlayerDivision={activePlayerDivision}
        />
      )}

      {/* Judge Summary tab */}
      {activeTab === 'judge-summary' && isJudge && (
        <JudgeSummaryTab
          events={events}
          results={results}
          playerInfoMap={playerInfoMap}
          onScoreChanged={loadResults}
        />
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
