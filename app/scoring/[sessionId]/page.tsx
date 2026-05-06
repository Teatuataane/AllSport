'use client'
import { useEffect, useState, useCallback } from 'react'
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
  const gap = Math.max(Math.floor(100 / playerCount), 10)
  return Math.max(100 - (rank - 1) * gap, 10)
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
  seasonPR: number | null,
  mode: string
): EffortTask[] {
  if (!eventData) return []

  if (mode === 'strength') {
    if (seasonPR === null) return []
    const countA = myEventResults.filter(r => (r.weight_kg ?? 0) >= seasonPR * 0.9 && (r.reps ?? 0) >= 3).length
    const countB = myEventResults.filter(r => (r.weight_kg ?? 0) >= seasonPR * 0.8 && (r.reps ?? 0) >= 5).length
    const countC = myEventResults.filter(r => (r.weight_kg ?? 0) >= seasonPR * 0.7 && (r.reps ?? 0) >= 8).length
    return [
      { label: `${Math.round(seasonPR * 0.9)}kg × 3 reps`, count: countA, isRepeatable: true },
      { label: `${Math.round(seasonPR * 0.8)}kg × 5 reps`, count: countB, isRepeatable: true },
      { label: `${Math.round(seasonPR * 0.7)}kg × 8 reps`, count: countC, isRepeatable: true },
    ]
  }

  if (mode === 'sprint' || mode === 'time') {
    if (seasonPR === null) return []
    const threshold = Math.round(seasonPR / 0.9)
    const count = myEventResults.filter(r => r.raw_score >= threshold).length
    const timeStr = fmtTime(Math.abs(threshold))
    return [{ label: `Complete in ${timeStr} or faster`, count, isRepeatable: true }]
  }

  if (mode === 'distance') {
    if (seasonPR === null) return []
    const target = Math.round(seasonPR * 0.9)
    const qualifying = myEventResults.filter(r => r.raw_score >= target).length
    const completions = Math.floor(qualifying / 3)
    const targetStr = target >= 100 ? `${(target / 100).toFixed(2)}m` : `${target}cm`
    return [{ label: `3 throws/jumps ≥ ${targetStr} (90% PR)`, count: completions, isRepeatable: true }]
  }

  if (mode === 'sport') {
    const usedOpponents = new Set<string>()
    let uniqueExtra = 0
    myEventResults.slice(1).forEach(r => {
      const opp = r.opponent_name
      if (opp && !usedOpponents.has(opp)) { usedOpponents.add(opp); uniqueExtra++ }
      else if (!opp) uniqueExtra++
    })
    return [{ label: 'Extra game vs a unique opponent', count: uniqueExtra, isRepeatable: true }]
  }

  if (mode === 'difficulty+time') {
    if (seasonPR === null || !eventData.difficultyTiers) return []
    const prTierIdx = Math.floor(seasonPR / 10000)
    const prTierName = eventData.difficultyTiers[prTierIdx]?.name ?? `D${prTierIdx + 1}`
    const belowTierName = prTierIdx > 0 ? (eventData.difficultyTiers[prTierIdx - 1]?.name ?? `D${prTierIdx}`) : null
    const countA = myEventResults.filter(r => {
      const tIdx = eventData.difficultyTiers!.findIndex(t => t.name === r.difficulty_tier)
      return tIdx >= prTierIdx && (r.time_seconds ?? 0) >= 60
    }).length
    const countB = myEventResults.filter(r => {
      const tIdx = eventData.difficultyTiers!.findIndex(t => t.name === r.difficulty_tier)
      return tIdx >= Math.max(0, prTierIdx - 1) && (r.time_seconds ?? 0) >= 120
    }).length
    const countC = myEventResults.filter(r => {
      const tIdx = eventData.difficultyTiers!.findIndex(t => t.name === r.difficulty_tier)
      return tIdx >= Math.max(0, prTierIdx - 1) && (r.time_seconds ?? 0) >= 240
    }).length
    const tasks: EffortTask[] = [{ label: `Hold ${prTierName} for 1 min`, count: countA, isRepeatable: false }]
    if (belowTierName) {
      tasks.push({ label: `Hold ${belowTierName} for 2 min`, count: countB, isRepeatable: false })
      tasks.push({ label: `Hold ${belowTierName} for 4 min`, count: countC, isRepeatable: false })
    }
    return tasks
  }

  if (mode === 'difficulty+reps') {
    if (seasonPR === null || !eventData.difficultyTiers) return []
    const prTierIdx = Math.floor(seasonPR / 10000)
    const prReps = seasonPR % 10000
    const tiers = eventData.difficultyTiers
    const t0 = tiers[prTierIdx]?.name ?? `D${prTierIdx + 1}`
    const t1 = prTierIdx > 0 ? (tiers[prTierIdx - 1]?.name ?? `D${prTierIdx}`) : null
    const t2 = prTierIdx > 1 ? (tiers[prTierIdx - 2]?.name ?? `D${prTierIdx - 1}`) : null
    const target70 = Math.round(prReps * 0.7)
    const target120 = Math.round(prReps * 1.2)
    const target150 = Math.round(prReps * 1.5)
    const cA = myEventResults.filter(r => tiers.findIndex(t => t.name === r.difficulty_tier) === prTierIdx && (r.reps ?? 0) >= target70).length
    const cB = t1 ? myEventResults.filter(r => tiers.findIndex(t => t.name === r.difficulty_tier) === prTierIdx - 1 && (r.reps ?? 0) >= target120).length : 0
    const cC = t2 ? myEventResults.filter(r => tiers.findIndex(t => t.name === r.difficulty_tier) === prTierIdx - 2 && (r.reps ?? 0) >= target150).length : 0
    const tasks: EffortTask[] = [{ label: `${target70}+ reps at ${t0}`, count: cA, isRepeatable: true }]
    if (t1) tasks.push({ label: `${target120}+ reps at ${t1}`, count: cB, isRepeatable: true })
    if (t2) tasks.push({ label: `${target150}+ reps at ${t2}`, count: cC, isRepeatable: true })
    return tasks
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
  seasonPR: number | null,
  mode: string
): number {
  if (!eventData || seasonPR === null) return 0
  if (mode === 'strength') {
    const w = weightKg ?? 0; const r = reps ?? 0
    let count = 0
    if (w >= seasonPR * 0.9 && r >= 3) count++
    if (w >= seasonPR * 0.8 && r >= 5) count++
    if (w >= seasonPR * 0.7 && r >= 8) count++
    return count
  }
  if (mode === 'sprint' || mode === 'time') {
    return newRawScore >= Math.round(seasonPR / 0.9) ? 1 : 0
  }
  if (mode === 'distance') {
    const target = Math.round(seasonPR * 0.9)
    const prev = existingEventResults.filter(r => r.raw_score >= target).length
    const next = prev + (newRawScore >= target ? 1 : 0)
    return Math.floor(next / 3) - Math.floor(prev / 3)
  }
  if (mode === 'sport') {
    if (existingEventResults.length === 0) return 0
    const used = new Set(existingEventResults.map(r => r.opponent_name).filter(Boolean))
    return (opponentName && !used.has(opponentName)) || !opponentName ? 1 : 0
  }
  if (mode === 'difficulty+time') {
    if (!eventData.difficultyTiers || !difficultyTierName) return 0
    const prTierIdx = Math.floor(seasonPR / 10000)
    const tierIdx = eventData.difficultyTiers.findIndex(t => t.name === difficultyTierName)
    const secs = timeSecs ?? 0; let count = 0
    if (tierIdx >= prTierIdx && secs >= 60) count++
    if (tierIdx >= Math.max(0, prTierIdx - 1) && secs >= 120) count++
    if (tierIdx >= Math.max(0, prTierIdx - 1) && secs >= 240) count++
    return count
  }
  if (mode === 'difficulty+reps') {
    if (!eventData.difficultyTiers || !difficultyTierName) return 0
    const prTierIdx = Math.floor(seasonPR / 10000)
    const prReps = seasonPR % 10000
    const tierIdx = eventData.difficultyTiers.findIndex(t => t.name === difficultyTierName)
    const r = reps ?? 0; let count = 0
    if (tierIdx === prTierIdx && r >= Math.round(prReps * 0.7)) count++
    if (tierIdx === prTierIdx - 1 && r >= Math.round(prReps * 1.2)) count++
    if (tierIdx === prTierIdx - 2 && r >= Math.round(prReps * 1.5)) count++
    return count
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
  onToggle: () => void
  onScoreSubmitted: () => void
}

function EventCard({
  se, eventData, myResults, allResults, allEvents, seasonPR,
  playerId, playerName, sessionId, sessionEnded,
  isExpanded, onToggle, onScoreSubmitted,
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
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const mode = (eventData?.inputMode || se.input_mode || 'strength') as string
  const emoji = eventData?.emoji ?? '🏅'
  const isWeightVariation = !!exerciseVariation && (eventData?.weightVariations?.includes(exerciseVariation) ?? false)

  // Best result for this player at this event
  const myBestResult = myResults.length > 0
    ? myResults.reduce((best, r) => r.raw_score > best.raw_score ? r : best, myResults[0])
    : undefined

  // Effort derived
  const seasonPRNum = typeof seasonPR === 'number' ? seasonPR : null
  const effortLevel = calcEffortLevel(myResults)
  const effortTasks = computeEffortTasks(myResults, eventData, seasonPRNum, mode)
  const effortLocked = seasonPRNum === null && ['strength', 'sprint', 'time', 'distance', 'difficulty+time', 'difficulty+reps'].includes(mode)

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
        seasonPRNum,
        mode
      )
      payload.is_pr = newIsPR
      payload.effort_task_completions = effortTaskCount

      const { error: err } = await supabase.from('results').insert(payload)
      if (err) throw err

      // Clear form after submit
      setWeightKg(''); setRepCount(''); setTimeMins(''); setTimeSecs('')
      setSprintCs(''); setDistanceVal(''); setSportResult(''); setSportScore(''); setOpponentName('')

      setSuccess(true); setTimeout(() => setSuccess(false), 2500)
      onScoreSubmitted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    }
    setSubmitting(false)
  }

  async function handleDelete(resultId: string) {
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
          {myBestResult ? myBestResult.score_label : '—'}
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
          {effortLevel > 0 ? `Effort Level: ${effortLevel}` : '— pts'}
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
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              All Today's Scores
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {myResultsSorted.map(r => (
                <div key={r.id} style={{
                  background: '#0d0d0d', borderRadius: '8px', padding: '10px 14px',
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
                  {!sessionEnded && (
                    <button
                      onClick={() => handleDelete(r.id)}
                      style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '2px 6px', flexShrink: 0 }}
                    >
                      ✕
                    </button>
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
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Submit Score
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
                {submitting ? 'Submitting...' : 'Submit Score'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── LeaderboardTab ───────────────────────────────────────────────────────────

const ALL_DIVISIONS = [
  'All-Divisions', 'Youth', 'Juniors', "Men's", "Women's",
  'Masters Men', 'Masters Women', 'Grandmasters Men', 'Grandmasters Women',
]

type PlayerInfo = { division: string }

function bestPerPlayer(evRes: Result[]): Result[] {
  const map: Record<string, Result> = {}
  evRes.forEach(r => {
    const key = r.player_id ?? r.player_name
    if (!map[key] || r.raw_score > map[key].raw_score) map[key] = r
  })
  return Object.values(map)
}

function rankFor(evRes: Result[]): Array<Result & { rank: number }> {
  const bests = bestPerPlayer(evRes)
  const sorted = [...bests].sort((a, b) => (b.raw_score ?? 0) - (a.raw_score ?? 0))
  let rank = 1
  return sorted.map((r, i) => {
    if (i > 0 && r.raw_score !== sorted[i - 1].raw_score) rank = i + 1
    return { ...r, rank }
  })
}

function LeaderboardTab({
  events, results, playerInfoMap,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
}) {
  const [division, setDivision] = useState('All-Divisions')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [lbTab, setLbTab] = useState<'competitive' | 'effort'>('competitive')

  function filteredResults(eventId: string): Result[] {
    const evRes = results.filter(r => r.event_id === eventId)
    if (division === 'All-Divisions') return evRes
    return evRes.filter(r => r.player_id && playerInfoMap[r.player_id]?.division === division)
  }

  function effortBoard() {
    const playerKeys = [...new Set(results.map(r => r.player_id ?? r.player_name))]
    return playerKeys.map(key => {
      const pr = results.filter(r => (r.player_id ?? r.player_name) === key)
      const sample = pr[0]
      const pid = sample.player_id
      const div = pid ? (playerInfoMap[pid]?.division ?? '') : ''
      if (division !== 'All-Divisions' && div !== division) return null
      const level = Math.min(events.reduce((s, ev) => s + calcEffortLevel(pr.filter(r => r.event_id === ev.id)), 0), 20)
      return { playerName: sample.player_name, playerId: pid, effortLevel: level }
    }).filter(Boolean).sort((a, b) => b!.effortLevel - a!.effortLevel) as Array<{ playerName: string; playerId: string | null; effortLevel: number }>
  }

  return (
    <div style={{ padding: '12px 16px' }}>
      {/* Sub-tab buttons */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
        {(['competitive', 'effort'] as const).map(tab => (
          <button key={tab} onClick={() => setLbTab(tab)} style={{
            padding: '8px 16px', borderRadius: '20px', border: `1px solid ${lbTab === tab ? (tab === 'effort' ? '#B87DB5' : '#2371BB') : '#222'}`,
            cursor: 'pointer', fontSize: '13px', fontWeight: lbTab === tab ? 700 : 400,
            background: lbTab === tab ? (tab === 'effort' ? '#1a0d1a' : '#0d1a2e') : '#111',
            color: lbTab === tab ? (tab === 'effort' ? '#B87DB5' : '#2371BB') : '#555',
          }}>
            {tab === 'competitive' ? 'Competitive' : 'Effort'}
          </button>
        ))}
      </div>

      {/* Division filter */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '16px' }}>
        {ALL_DIVISIONS.map(d => (
          <button key={d} onClick={() => setDivision(d)} style={{
            padding: '6px 12px', border: `1px solid ${division === d ? '#2371BB' : '#222'}`,
            borderRadius: '20px', cursor: 'pointer', whiteSpace: 'nowrap', fontSize: '12px', fontWeight: division === d ? 700 : 400,
            background: division === d ? '#0d1a2e' : '#111',
            color: division === d ? '#2371BB' : '#555',
            flexShrink: 0,
          }}>{d}</button>
        ))}
      </div>

      {lbTab === 'competitive' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {events.map(ev => {
            const evData = getEventByName(ev.event_name)
            const evRes = filteredResults(ev.id)
            const ranked = rankFor(evRes)
            const leader = ranked[0]
            const isOpen = expandedId === ev.id
            const playerCount = ranked.length

            return (
              <div key={ev.id} style={{ background: '#111', borderRadius: '12px', overflow: 'hidden', border: `1px solid ${isOpen ? '#2371BB' : '#1e1e1e'}` }}>
                <button onClick={() => setExpandedId(isOpen ? null : ev.id)} style={{
                  display: 'flex', alignItems: 'center', gap: '14px', width: '100%',
                  padding: '16px 18px', background: isOpen ? '#0d1a2e' : 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left',
                }}>
                  <span style={{ fontSize: '24px', flexShrink: 0 }}>{evData?.emoji ?? '🏅'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: isOpen ? '#fff' : '#ccc' }}>{ev.event_name}</div>
                    <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{ev.domain_name}</div>
                    {leader ? (
                      <div style={{ fontSize: '13px', color: '#F9B051', marginTop: '4px', fontWeight: 600 }}>
                        {leader.player_name} · {leader.score_label}
                        <span style={{ color: '#555', fontWeight: 400, marginLeft: '6px' }}>{playerCount} player{playerCount !== 1 ? 's' : ''}</span>
                      </div>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#444', marginTop: '4px' }}>No scores yet</div>
                    )}
                  </div>
                  <span style={{ color: isOpen ? '#2371BB' : '#444', fontSize: '16px', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #1e1e1e' }}>
                    {ranked.length === 0 ? (
                      <div style={{ padding: '14px 18px', color: '#444', fontSize: '13px' }}>No scores yet.</div>
                    ) : ranked.map((r, idx) => (
                      <div key={r.id} style={{
                        display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 18px',
                        borderBottom: idx < ranked.length - 1 ? '1px solid #0d0d0d' : 'none',
                        background: idx === 0 ? '#0d1a0d' : 'transparent',
                      }}>
                        <div style={{
                          width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '13px', fontWeight: 700,
                          background: r.rank === 1 ? '#F9B051' : r.rank === 2 ? '#888' : r.rank === 3 ? '#CD7F32' : '#333',
                          color: r.rank <= 3 ? '#000' : '#fff',
                        }}>{r.rank}</div>
                        <div style={{ flex: 1, fontSize: '14px', color: idx === 0 ? '#fff' : '#aaa', fontWeight: idx === 0 ? 700 : 400 }}>
                          {r.player_name}
                        </div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: idx === 0 ? '#F9B051' : '#666' }}>{r.score_label}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {lbTab === 'effort' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {effortBoard().length === 0 ? (
            <div style={{ color: '#555', fontSize: '14px', textAlign: 'center', padding: '32px' }}>No effort data yet</div>
          ) : effortBoard().map((entry, idx) => {
            let rank = idx + 1
            if (idx > 0) {
              const prev = effortBoard()[idx - 1]
              if (prev && prev.effortLevel === entry.effortLevel) rank = effortBoard().findIndex(e => e.effortLevel === entry.effortLevel) + 1
            }
            return (
              <div key={entry.playerId ?? entry.playerName} style={{
                display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                background: idx === 0 ? '#1a0d1a' : '#111', borderRadius: '10px',
                border: `1px solid ${idx === 0 ? '#B87DB5' : '#1e1e1e'}`,
              }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700,
                  background: idx === 0 ? '#B87DB5' : idx === 1 ? '#888' : idx === 2 ? '#CD7F32' : '#333',
                  color: idx <= 2 ? '#000' : '#fff',
                }}>{rank}</div>
                <div style={{ flex: 1, fontSize: '14px', color: idx === 0 ? '#fff' : '#aaa', fontWeight: idx === 0 ? 700 : 400 }}>
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
    supabase.from('players').select('id, division').in('id', ids).then(({ data }) => {
      if (!data) return
      const map: Record<string, PlayerInfo> = {}
      data.forEach(p => { map[p.id] = { division: p.division ?? '' } })
      setPlayerInfoMap(map)
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
