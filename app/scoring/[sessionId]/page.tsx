'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS, getEventByName, getBonusTargets, type EventData, type BonusTarget } from '@/lib/eventData'

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
  adjusted_score: number | null
  score_label: string
  placement: number | null
  placement_points: number | null
  bonus_points_total: number | null
  points_earned: number | null
  difficulty_tier: string | null
  disadvantage_type: string | null
  disadvantage_option: string | null
  result_type: string | null
  opponent_name: string | null
  match_score: string | null
  weight_kg: number | null
  reps: number | null
  time_seconds: number | null
}

type BonusCompletion = {
  id: string
  player_id: string
  event_id: string
  tier: number
  points_awarded: number
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
    case 'flexibility': return `${Math.abs(rawScore)} blocks`
    case 'sport':      return rawScore === 2 ? 'Win' : rawScore === 1 ? 'Draw' : 'Loss'
    default:           return String(rawScore)
  }
}

function calcPlacementPts(rank: number, playerCount: number): number {
  const gap = Math.max(Math.floor(100 / playerCount), 10)
  return Math.max(100 - (rank - 1) * gap, 10)
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
  myResult: Result | undefined
  allResults: Result[]
  allEvents: SessionEvent[]
  seasonPR: number | string | null
  bonusCompletions: BonusCompletion[]
  playerId: string
  playerName: string
  sessionId: string
  sessionEnded: boolean
  isExpanded: boolean
  onToggle: () => void
  onScoreSubmitted: () => void
}

function EventCard({
  se, eventData, myResult, allResults, allEvents, seasonPR,
  bonusCompletions, playerId, playerName, sessionId, sessionEnded,
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
  // Bonus
  const [bonusOpponent, setBonusOpponent] = useState<Record<number, string>>({})
  const [bonusSubmitting, setBonusSubmitting] = useState<Record<number, boolean>>({})

  const mode = (se.input_mode || eventData?.inputMode || 'strength') as string
  const emoji = eventData?.emoji ?? '🏅'
  const isWeightVariation = !!exerciseVariation && (eventData?.weightVariations?.includes(exerciseVariation) ?? false)

  // Compute current placement for this player across this event
  const eventResults = allResults.filter(r => r.event_id === se.id)
  const allPlayers = [...new Set(allResults.map(r => r.player_id || r.player_name))]
  const playerCount = allPlayers.length
  const sorted = [...eventResults].sort((a, b) => (b.raw_score ?? 0) - (a.raw_score ?? 0))
  let myRank: number | null = null
  if (myResult) {
    let rank = 1
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i].raw_score !== sorted[i - 1].raw_score) rank = i + 1
      if (sorted[i].id === myResult.id) { myRank = rank; break }
    }
  }

  const placementPts = myRank && playerCount > 0 ? calcPlacementPts(myRank, playerCount) : null
  const myBonuses = bonusCompletions.filter(b => b.event_id === se.id)
  const bonusPts = myBonuses.reduce((sum, b) => sum + b.points_awarded, 0)
  const totalPts = placementPts !== null ? placementPts + bonusPts : null

  const bonusTargets: BonusTarget[] = eventData ? getBonusTargets(eventData, seasonPR) : []
  const completedTiers = new Set(myBonuses.map(b => b.tier))

  function computeScore(): { raw_score: number; score_label: string; adjusted_score?: number } | null {
    const totalSecs = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)

    if (mode === 'strength') {
      const w = parseFloat(weightKg) || 0
      if (!w) return null
      const r = parseInt(repCount) || 0
      const label = r > 0 ? `${w}kg × ${r} rep${r !== 1 ? 's' : ''}` : `${w}kg`
      return { raw_score: w, score_label: label }
    }
    if (mode === 'reps') {
      // Variation requires weight (e.g. Ring Dip) — score by weight like strength
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
      // hideTierPrefix events (e.g. Front Split) treat the tier as the position — require it
      if (eventData?.hideTierPrefix && !difficultyTier) return null
      const varLabel = exerciseVariation ? `${exerciseVariation}: ` : ''
      // tier-based scoring for events like Breakdancing, Standing Split, Front Split
      if (eventData?.difficultyTiers && difficultyTier) {
        const tierIdx = eventData.difficultyTiers.findIndex(t => t.name === difficultyTier)
        if (tierIdx >= 0) {
          const rawScore = tierIdx * 10000 + totalSecs
          const tierLabel = eventData.hideTierPrefix ? difficultyTier : `D${tierIdx + 1} ${difficultyTier}`
          return { raw_score: rawScore, score_label: `${tierLabel} · ${fmtTime(totalSecs)}` }
        }
      }
      return { raw_score: totalSecs, score_label: `${varLabel}${fmtTime(totalSecs)}` }
    }
    if (mode === 'distance') {
      const val = parseFloat(distanceVal) || 0
      if (!val) return null
      const raw_score = distanceUnit === 'm' ? Math.round(val * 100) : Math.round(val)
      return { raw_score, score_label: `${distanceVal}${distanceUnit}` }
    }
    if (mode === 'flexibility') {
      const blocks = parseInt(distanceVal) || 0
      const label = blocks === 0 ? '0 blocks (floor)' : `${blocks} block${blocks !== 1 ? 's' : ''}`
      return { raw_score: -blocks, score_label: label }
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
    if (mode === 'weight+time') {
      if (!weightKg || !totalSecs) return null
      return { raw_score: -totalSecs, score_label: `${weightKg}kg · ${fmtTime(totalSecs)}` }
    }
    if (mode === 'distance+time') {
      const val = parseFloat(distanceVal) || 0
      if (!val) return null
      const raw_score = distanceUnit === 'm' ? Math.round(val * 100) : Math.round(val)
      const parts = [`${distanceVal}${distanceUnit}`]
      if (totalSecs > 0) parts.push(fmtTime(totalSecs))
      return { raw_score, score_label: parts.join(' · ') }
    }
    if (mode === 'dynamic') {
      if (!exerciseVariation) return null
      const isHold = exerciseVariation.endsWith('/ Hold')
      if (isHold) {
        if (!totalSecs) return null
        const varLabel = exerciseVariation.replace(' / Hold', '')
        return { raw_score: totalSecs, score_label: `${varLabel}: ${fmtTime(totalSecs)}` }
      } else {
        const r = parseInt(repCount) || 0
        if (!r) return null
        const varLabel = exerciseVariation.replace(' / Reps', '')
        return { raw_score: r, score_label: `${varLabel}: ${r} reps` }
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
      if (scored.adjusted_score != null) payload.adjusted_score = scored.adjusted_score
      if (difficultyTier) payload.difficulty_tier = difficultyTier
      if (exerciseVariation) payload.exercise_variation = exerciseVariation
      if (mode === 'strength') {
        payload.weight_kg = parseFloat(weightKg) || 0
        if (repCount) payload.reps = parseInt(repCount)
      }
      if (mode === 'reps') payload.reps = parseInt(repCount) || 0
      if (['time', 'hold', 'weight+time'].includes(mode) && totalSecs > 0) payload.time_seconds = totalSecs
      if (mode === 'dynamic' && isDynamicHold && totalSecs > 0) payload.time_seconds = totalSecs
      if (mode === 'sprint') {
        const s = parseFloat(timeSecs) || 0; const cs = parseInt(sprintCs) || 0
        payload.time_seconds = s + cs / 100
      }
      if (mode === 'weight+time') payload.weight_kg = parseFloat(weightKg) || 0
      if (mode === 'distance' || mode === 'distance+time') {
        const val = parseFloat(distanceVal) || 0
        payload.distance_m = distanceUnit === 'm' ? val : val / 100
      }
      if (mode === 'sport') {
        payload.result_type = sportResult
        if (opponentName) payload.opponent_name = opponentName
        if (sportScore) payload.match_score = sportScore
      }

      const { error: err } = await supabase.from('results').upsert(payload, {
        onConflict: 'player_id,session_id,event_id',
      })
      if (err) throw err
      setSuccess(true); setTimeout(() => setSuccess(false), 2500)
      onScoreSubmitted()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submission failed')
    }
    setSubmitting(false)
  }

  async function handleBonusSubmit(tier: number, label: string) {
    setBonusSubmitting(prev => ({ ...prev, [tier]: true }))
    try {
      const opp = bonusOpponent[tier] || null
      const completionData: Record<string, unknown> = { label }
      if (opp) completionData.opponent_name = opp

      const { error: err } = await supabase.from('bonus_completions').insert({
        player_id: playerId,
        session_id: sessionId,
        event_id: se.id,
        result_id: myResult?.id ?? null,
        tier,
        points_awarded: 15,
        completion_data: completionData,
      })
      if (err) throw err
      onScoreSubmitted()
    } catch (e: unknown) {
      // silently fail — user can retry
    }
    setBonusSubmitting(prev => ({ ...prev, [tier]: false }))
  }

  async function handleBonusDelete(completionId: string) {
    await supabase.from('bonus_completions').delete().eq('id', completionId)
    onScoreSubmitted()
  }

  // Collapsed card
  if (!isExpanded) {
    return (
      <button
        onClick={onToggle}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          background: myResult ? '#0d1a0d' : '#111', border: `1px solid ${myResult ? '#4DB26E33' : '#1e1e1e'}`,
          borderRadius: '12px', padding: '16px 12px', cursor: 'pointer', width: '100%',
          gap: '6px', textAlign: 'center',
        }}
      >
        <div style={{ fontSize: '28px', lineHeight: 1 }}>{emoji}</div>
        <div style={{ fontSize: '12px', fontWeight: 700, color: '#fff', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em', lineHeight: 1.2 }}>
          {se.event_name}
        </div>
        <div style={{ fontSize: '16px', fontWeight: 700, color: myResult ? '#4DB26E' : '#555', fontFamily: 'Bebas Neue, cursive' }}>
          {myResult ? myResult.score_label : '—'}
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
        <div style={{ fontSize: '13px', color: totalPts !== null ? '#F9B051' : '#555', fontFamily: 'Bebas Neue, cursive' }}>
          {totalPts !== null ? `${totalPts} pts` : '— pts'}
        </div>
      </button>
    )
  }

  // Expanded card
  const isTimeMode = mode === 'time' || mode === 'hold' || mode === 'weight+time' || mode === 'distance+time'
  const isDynamicHold = mode === 'dynamic' && exerciseVariation?.endsWith('/ Hold')
  const isDynamicReps = mode === 'dynamic' && exerciseVariation?.endsWith('/ Reps')

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
          {myResult ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '22px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Bebas Neue, cursive' }}>
                {myResult.score_label}
              </div>
              {myRank && <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif' }}>#{myRank} of {playerCount}</div>}
              {totalPts !== null && <div style={{ fontSize: '13px', color: '#F9B051', fontFamily: 'Bebas Neue, cursive' }}>{totalPts} pts</div>}
            </div>
          ) : (
            <div style={{ color: '#555', fontSize: '14px' }}>No score yet</div>
          )}
        </div>

        {/* 2. SCORE HISTORY */}
        {myResult && (
          <div>
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '6px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Score History (today)
            </div>
            <div style={{ background: '#0d0d0d', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: '15px', color: '#fff' }}>{myResult.score_label}</div>
              {myResult.difficulty_tier && <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif' }}>{myResult.difficulty_tier}</div>}
            </div>
          </div>
        )}

        {/* 3. ADD A SCORE */}
        {!sessionEnded && (
          <div>
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              {myResult ? 'Update Score' : 'Add a Score'}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {/* Variation selector (dynamic events) */}
              {mode === 'dynamic' && eventData?.difficultyTiers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>VARIATION</label>
                  <select value={exerciseVariation} onChange={e => setExerciseVariation(e.target.value)}
                    style={{ ...INP, fontSize: '15px' }}>
                    <option value="">Select variation...</option>
                    {eventData.difficultyTiers.map(t => (
                      <option key={t.level} value={`${t.name} / Hold`}>{t.name} / Hold</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Variation selector (events with named variations e.g. Pause Dips) */}
              {eventData?.variations && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>VARIATION</label>
                  <select value={exerciseVariation} onChange={e => setExerciseVariation(e.target.value)}
                    style={{ ...INP, fontSize: '15px' }}>
                    <option value="">Select variation...</option>
                    {eventData.variations.map(v => (
                      <option key={v} value={v}>{v}{eventData.weightVariations?.includes(v) ? ' (weight + reps)' : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Difficulty tier (for tiered events that aren't dynamic) */}
              {mode !== 'dynamic' && eventData?.hasDifficultyTiers && eventData.difficultyTiers && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif' }}>DIFFICULTY TIER</label>
                  <select value={difficultyTier} onChange={e => setDifficultyTier(e.target.value)}
                    style={{ ...INP, fontSize: '15px' }}>
                    <option value="">Select tier...</option>
                    {eventData.difficultyTiers.map(t => (
                      <option key={t.level} value={t.name}>
                        {eventData.hideTierPrefix ? t.name : `D${t.level} — ${t.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Strength mode — also shown when a weight variation is selected (e.g. Ring Dip) */}
              {(mode === 'strength' || mode === 'weight+time' || isWeightVariation) && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                    placeholder="Weight (kg)" style={{ ...INP, flex: 2 }} />
                  {(mode === 'strength' || isWeightVariation) && (
                    <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)}
                      placeholder="Reps" style={{ ...INP, flex: 1 }} />
                  )}
                </div>
              )}

              {/* Reps mode — hidden when a weight variation is selected (reps shown inside weight row) */}
              {(mode === 'reps' || isDynamicReps) && !isWeightVariation && (
                <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)}
                  placeholder="Reps" style={INP} />
              )}

              {/* Time / hold / weight+time */}
              {(mode === 'time' || mode === 'hold' || mode === 'weight+time' || isDynamicHold) && (
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
              {(mode === 'distance' || mode === 'distance+time') && (
                <>
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
                  {mode === 'distance+time' && (
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)}
                        placeholder="min" style={{ ...INP, flex: 1 }} />
                      <span style={{ color: '#555', fontSize: '20px' }}>:</span>
                      <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)}
                        placeholder="sec" style={{ ...INP, flex: 1 }} />
                    </div>
                  )}
                </>
              )}

              {/* Flexibility mode */}
              {mode === 'flexibility' && (
                <input type="number" value={distanceVal} onChange={e => setDistanceVal(e.target.value)}
                  placeholder="Blocks from floor (0 = floor)" style={INP} min="0" />
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
                {submitting ? 'Submitting...' : myResult ? 'Update Score' : 'Submit Score'}
              </button>
            </div>
          </div>
        )}

        {/* 4. BONUS POINTS */}
        {bonusTargets.length > 0 && (
          <div>
            <div style={{ fontSize: '10px', color: '#555', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Bonus Points
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {bonusTargets.map(bt => {
                const done = completedTiers.has(bt.tier)
                const completion = myBonuses.find(b => b.tier === bt.tier)
                return (
                  <div key={bt.tier} style={{
                    background: done ? '#0d1a0d' : '#0d0d0d',
                    border: `1px solid ${done ? '#4DB26E33' : '#1e1e1e'}`,
                    borderRadius: '8px', padding: '12px 14px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div style={{
                        width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px',
                        background: done ? '#4DB26E' : '#1e1e1e',
                        color: done ? '#fff' : '#555',
                      }}>
                        {done ? '✓' : bt.tier}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: done ? '#4DB26E' : '#ccc', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>{bt.label}</div>
                      </div>
                      <div style={{ fontSize: '13px', color: '#F9B051', fontFamily: 'Bebas Neue, cursive' }}>+15 pts</div>
                      {done && !sessionEnded && completion && (
                        <button onClick={() => handleBonusDelete(completion.id)}
                          style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '14px', padding: '2px 6px' }}>
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Sport bonus: opponent input */}
                    {mode === 'sport' && !done && !sessionEnded && (
                      <div style={{ marginTop: '10px', display: 'flex', gap: '8px' }}>
                        <input
                          value={bonusOpponent[bt.tier] || ''}
                          onChange={e => setBonusOpponent(prev => ({ ...prev, [bt.tier]: e.target.value }))}
                          placeholder="Opponent name"
                          style={{ flex: 1, background: '#111', border: '1px solid #333', borderRadius: '6px', padding: '8px 12px', color: '#fff', fontSize: '14px' }}
                        />
                        <button
                          onClick={() => handleBonusSubmit(bt.tier, bt.label)}
                          disabled={bonusSubmitting[bt.tier]}
                          style={{
                            padding: '8px 14px', borderRadius: '6px', border: 'none', fontWeight: 'bold', fontSize: '13px',
                            background: '#F9B051', color: '#000', cursor: 'pointer',
                          }}
                        >
                          {bonusSubmitting[bt.tier] ? '...' : 'Confirm'}
                        </button>
                      </div>
                    )}

                    {/* Non-sport bonus: confirm button */}
                    {mode !== 'sport' && !done && !sessionEnded && (
                      <div style={{ marginTop: '10px' }}>
                        <button
                          onClick={() => handleBonusSubmit(bt.tier, bt.label)}
                          disabled={bonusSubmitting[bt.tier]}
                          style={{
                            padding: '8px 14px', borderRadius: '6px', border: '1px solid #F9B051', fontWeight: 'bold', fontSize: '13px',
                            background: 'transparent', color: '#F9B051', cursor: 'pointer',
                          }}
                        >
                          {bonusSubmitting[bt.tier] ? '...' : 'Claim +15 pts'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })}
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

function LeaderboardTab({
  events, results, playerInfoMap,
}: {
  events: SessionEvent[]
  results: Result[]
  playerInfoMap: Record<string, PlayerInfo>
}) {
  const [division, setDivision] = useState('All-Divisions')
  const [expandedId, setExpandedId] = useState<string | null>(null)

  function filteredResults(eventId: string): Result[] {
    const evRes = results.filter(r => r.event_id === eventId)
    if (division === 'All-Divisions') return evRes
    return evRes.filter(r => r.player_id && playerInfoMap[r.player_id]?.division === division)
  }

  function rankFor(evRes: Result[]): Array<Result & { rank: number }> {
    const sorted = [...evRes].sort((a, b) => (b.raw_score ?? 0) - (a.raw_score ?? 0))
    let rank = 1
    return sorted.map((r, i) => {
      if (i > 0 && r.raw_score !== sorted[i - 1].raw_score) rank = i + 1
      return { ...r, rank }
    })
  }

  return (
    <div style={{ padding: '12px 16px' }}>
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

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {events.map(ev => {
          const evData = getEventByName(ev.event_name)
          const evRes = filteredResults(ev.id)
          const ranked = rankFor(evRes)
          const leader = ranked[0]
          const isOpen = expandedId === ev.id
          const scoreCount = ranked.length

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
                      <span style={{ color: '#555', fontWeight: 400, marginLeft: '6px' }}>{scoreCount} score{scoreCount !== 1 ? 's' : ''}</span>
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
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()

  const [session, setSession] = useState<Record<string, unknown> | null>(null)
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [bonusCompletions, setBonusCompletions] = useState<BonusCompletion[]>([])
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

  const loadBonuses = useCallback(async () => {
    const { data } = await supabase.from('bonus_completions').select('*').eq('session_id', sessionId)
    if (data) setBonusCompletions(data as BonusCompletion[])
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
      await loadBonuses()
    }
    load()
  }, [sessionId, loadResults, loadBonuses])

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
          // fallback: look up slug from eventData
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bonus_completions', filter: `session_id=eq.${sessionId}` },
        () => loadBonuses())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        p => {
          const updated = p.new as Record<string, unknown>
          if (updated.is_active === false) setSessionEnded(true)
        })
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [sessionId, loadResults, loadBonuses])

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
        const myBonuses = bonusCompletions.filter(b => b.player_id === pid)

        return (
          <div key={pid} style={{ padding: '16px' }}>
            {sessionEnded && (
              <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', textAlign: 'center' }}>
                <div style={{ color: '#EA4742', fontWeight: 700, fontFamily: 'Bebas Neue, cursive', fontSize: '18px' }}>Session Ended</div>
                <div style={{ color: '#888', fontSize: '13px', marginTop: '4px' }}>Score submission is locked</div>
              </div>
            )}

            {/* 2-column grid of event cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {events.map(ev => {
                const myResult = myResults.find(r => r.event_id === ev.id)
                const evBonuses = myBonuses.filter(b => b.event_id === ev.id)
                const evData = getEventByName(ev.event_name)
                const pr = seasonPRs[ev.id] ?? null

                return (
                  <EventCard
                    key={ev.id}
                    se={ev}
                    eventData={evData}
                    myResult={myResult}
                    allResults={results}
                    allEvents={events}
                    seasonPR={pr}
                    bonusCompletions={evBonuses}
                    playerId={pid}
                    playerName={pName}
                    sessionId={sessionId as string}
                    sessionEnded={sessionEnded}
                    isExpanded={expandedEventId === ev.id}
                    onToggle={() => setExpandedEventId(expandedEventId === ev.id ? null : ev.id)}
                    onScoreSubmitted={async () => { await loadResults(); await loadBonuses() }}
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
