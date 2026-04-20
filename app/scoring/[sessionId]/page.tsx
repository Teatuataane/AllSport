'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type SessionEvent = {
  id: string
  domain_number: number
  domain_name: string
  event_name: string
}

type Result = {
  id: string
  player_name: string
  player_id: string | null
  event_id: string
  raw_score: number
  score_label: string
}

type Standing = {
  player_name: string
  total_placement: number
  events_done: number
  placements: { [eventId: string]: number }
}

// Input mode per domain
const INPUT_MODE: Record<string, 'strength' | 'reps' | 'time' | 'distance' | 'sport'> = {
  'Maximal Strength': 'strength',
  'Relative Strength': 'reps',
  'Muscular Endurance': 'reps',
  'Flexibility & Mobility': 'distance',
  'Power': 'distance',
  'Aerobic Endurance': 'time',
  'Speed & Agility': 'time',
  'Body Awareness': 'sport',
  'Co-ordination': 'sport',
  'Aim & Precision': 'sport',
}

function calcPlacements(results: Result[], events: SessionEvent[]): Standing[] {
  const players = [...new Set(results.map(r => r.player_name))]
  const standings: Standing[] = players.map(name => ({
    player_name: name,
    total_placement: 0,
    events_done: 0,
    placements: {},
  }))

  events.forEach(event => {
    const eventResults = results
      .filter(r => r.event_id === event.id)
      .sort((a, b) => b.raw_score - a.raw_score)

    let placement = 1
    eventResults.forEach((result, idx) => {
      if (idx > 0 && result.raw_score < eventResults[idx - 1].raw_score) {
        placement = idx + 1
      }
      const standing = standings.find(s => s.player_name === result.player_name)
      if (standing) {
        standing.placements[event.id] = placement
        standing.total_placement += placement
        standing.events_done += 1
      }
    })
  })

  return standings.sort((a, b) => a.total_placement - b.total_placement)
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const inp: React.CSSProperties = {
  background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '8px',
  padding: '14px', color: '#fff', fontSize: '22px', fontWeight: 'bold',
  width: '100%', boxSizing: 'border-box',
}

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [session, setSession] = useState<any>(null)
  const [player, setPlayer] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'submit'>('leaderboard')
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [bodyweight, setBodyweight] = useState('')
  const [bodyweightSaved, setBodyweightSaved] = useState(false)

  const saveBodyweight = async () => {
    if (!player || !bodyweight) return
    await supabase.from('players').update({ bodyweight_kg: parseFloat(bodyweight) }).eq('id', player.id)
    setBodyweightSaved(true)
    setTimeout(() => setBodyweightSaved(false), 2000)
  }

  // Structured score inputs
  const [weightKg, setWeightKg] = useState('')
  const [repCount, setRepCount] = useState('')
  const [timeMins, setTimeMins] = useState('')
  const [timeSecs, setTimeSecs] = useState('')
  const [distanceVal, setDistanceVal] = useState('')
  const [distanceUnit, setDistanceUnit] = useState<'m' | 'cm'>('m')
  const [sportResult, setSportResult] = useState<'win' | 'draw' | 'loss' | ''>('')
  const [sportScore, setSportScore] = useState('')

  function clearInputs() {
    setWeightKg(''); setRepCount(''); setTimeMins(''); setTimeSecs('')
    setDistanceVal(''); setDistanceUnit('m'); setSportResult(''); setSportScore('')
    setError('')
  }

  // Clear inputs whenever event changes
  useEffect(() => { clearInputs() }, [selectedEvent?.id])

  // Timer
  useEffect(() => {
    if (!session?.started_at || !session?.duration_minutes) return
    const endTime = new Date(session.started_at).getTime() + session.duration_minutes * 60 * 1000
    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        setSessionEnded(true)
        supabase.from('sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', sessionId)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session, sessionId])

  useEffect(() => {
    const load = async () => {
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (authSession) {
        const { data: playerData } = await supabase.from('players').select('*').eq('id', authSession.user.id).single()
        setPlayer(playerData)
        if (playerData?.bodyweight_kg) setBodyweight(String(playerData.bodyweight_kg))
      }
      const { data: sessionData } = await supabase.from('sessions').select('*').eq('id', sessionId).single()
      setSession(sessionData)
      if (!sessionData?.is_active) setSessionEnded(true)
      const { data: eventsData } = await supabase.from('session_events').select('*').eq('session_id', sessionId).order('domain_number')
      setEvents(eventsData || [])
      const { data: resultsData } = await supabase.from('results').select('*').eq('session_id', sessionId)
      setResults(resultsData || [])
    }
    load()

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        payload => setResults(prev => [...prev, payload.new as Result]))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        payload => setResults(prev => prev.map(r => r.id === (payload.new as Result).id ? payload.new as Result : r)))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        payload => setResults(prev => prev.filter(r => r.id !== (payload.old as any).id)))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  const mode = selectedEvent ? (INPUT_MODE[selectedEvent.domain_name] || 'strength') : null

  function isScoreValid(): boolean {
    if (!selectedEvent || !mode) return false
    if (mode === 'strength') return !!weightKg
    if (mode === 'reps') return !!repCount
    if (mode === 'time') return !!(timeMins || timeSecs)
    if (mode === 'distance') return !!distanceVal
    if (mode === 'sport') return !!sportResult
    return false
  }

  function computeScore(): { raw_score: number; score_label: string } {
    if (mode === 'strength') {
      const w = parseFloat(weightKg) || 0
      const r = parseInt(repCount) || 0
      return {
        raw_score: w,
        score_label: r > 0 ? `${weightKg}kg × ${repCount} rep${repCount !== '1' ? 's' : ''}` : `${weightKg}kg`,
      }
    }
    if (mode === 'reps') {
      return { raw_score: parseFloat(repCount) || 0, score_label: `${repCount} reps` }
    }
    if (mode === 'time') {
      const totalSecs = (parseFloat(timeMins) || 0) * 60 + (parseFloat(timeSecs) || 0)
      const m = Math.floor(totalSecs / 60)
      const s = totalSecs % 60
      return { raw_score: -totalSecs, score_label: `${m}:${s.toString().padStart(2, '0')}` }
    }
    if (mode === 'distance') {
      const val = parseFloat(distanceVal) || 0
      const raw_score = distanceUnit === 'cm' ? val / 100 : val
      return { raw_score, score_label: `${distanceVal}${distanceUnit}` }
    }
    if (mode === 'sport') {
      const raw_score = sportResult === 'win' ? 2 : sportResult === 'draw' ? 1 : 0
      let label = sportResult ? sportResult.charAt(0).toUpperCase() + sportResult.slice(1) : ''
      if (sportScore) label += ` (${sportScore})`
      return { raw_score, score_label: label }
    }
    return { raw_score: 0, score_label: '' }
  }

  const handleSubmit = async () => {
    if (!selectedEvent || !isScoreValid() || sessionEnded) return
    if (!player) { setError('You must be logged in to submit a score'); return }
    setSubmitting(true)
    setError('')
    try {
      const { raw_score, score_label } = computeScore()
      const { error: err } = await supabase.from('results').upsert({
        session_id: sessionId,
        event_id: selectedEvent.id,
        player_name: player.display_name || player.username || player.full_name,
        player_id: player.id,
        raw_score,
        score_label,
      }, { onConflict: 'player_id,session_id,event_id' })
      if (err) throw err
      clearInputs()
      setSelectedEvent(null)
      setSubmitSuccess(true)
      setTimeout(() => setSubmitSuccess(false), 3000)
    } catch (e: any) {
      setError(e.message)
    }
    setSubmitting(false)
  }

  const standings = calcPlacements(results, events)
  const RANK_COLOURS = ['#F9B051', '#aaa', '#CD7F32', '#2371BB', '#4DB26E']

  function getEventScores(eventId: string) {
    return results
      .filter(r => r.event_id === eventId)
      .sort((a, b) => b.raw_score - a.raw_score)
      .map((r, idx, arr) => {
        let placement = idx + 1
        if (idx > 0 && r.raw_score === arr[idx - 1].raw_score) {
          placement = arr.findIndex(x => x.raw_score === r.raw_score) + 1
        }
        return { ...r, placement }
      })
  }

  const timerColour = timeLeft !== null
    ? timeLeft < 600 ? '#EA4742' : timeLeft < 1800 ? '#F9B051' : '#4DB26E'
    : '#4DB26E'

  const unitBtn = (unit: 'm' | 'cm') => ({
    padding: '10px 18px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px',
    background: distanceUnit === unit ? '#2371BB' : '#1a1a1a',
    color: distanceUnit === unit ? '#fff' : '#666',
  } as React.CSSProperties)

  const sportBtn = (val: 'win' | 'draw' | 'loss') => {
    const colours = { win: '#4DB26E', draw: '#F9B051', loss: '#EA4742' }
    const active = sportResult === val
    return {
      flex: 1, padding: '16px', border: `2px solid ${active ? colours[val] : '#222'}`,
      borderRadius: '10px', cursor: 'pointer', fontWeight: 'bold', fontSize: '16px',
      background: active ? colours[val] + '22' : '#111',
      color: active ? colours[val] : '#444',
    } as React.CSSProperties
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '600px', margin: '0 auto', fontFamily: 'sans-serif' }}>

      {/* Header */}
      <div style={{ background: '#2371BB', padding: '14px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginBottom: '2px' }}>
              {session?.is_championship ? '🏆 CHAMPIONSHIP' : 'LIVE SESSION'} · {session?.location}
            </div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>AllSport Scoring</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: timerColour, fontVariantNumeric: 'tabular-nums' }}>
              {sessionEnded ? 'ENDED' : timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>remaining</div>
          </div>
        </div>
        {session?.session_code && (
          <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>SESSION CODE</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '6px', color: '#fff' }}>{session.session_code}</div>
          </div>
        )}
      </div>

      {sessionEnded && (
        <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', padding: '14px 20px', textAlign: 'center' }}>
          <div style={{ color: '#EA4742', fontWeight: 'bold', fontSize: '15px' }}>⏱ Session Ended</div>
          <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Score submission is now locked</div>
        </div>
      )}

      <div style={{ height: '4px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #222' }}>
        {(['leaderboard', 'submit'] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            flex: 1, padding: '14px', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: 'bold',
            background: activeTab === tab ? '#111' : '#0a0a0a',
            color: activeTab === tab ? '#2371BB' : '#555',
            borderBottom: activeTab === tab ? '2px solid #2371BB' : '2px solid transparent',
          }}>
            {tab === 'leaderboard' ? '📊 Leaderboard' : '➕ Submit Score'}
          </button>
        ))}
      </div>

      {/* ── LEADERBOARD TAB ── */}
      {activeTab === 'leaderboard' && (
        <div style={{ padding: '16px' }}>
          {standings.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#555', padding: '48px 0' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>🏁</div>
              <div>No scores yet — be the first to submit!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
              {standings.map((s, idx) => (
                <div key={s.player_name} style={{
                  background: '#111', borderRadius: '10px', padding: '14px 16px',
                  border: `1px solid ${idx === 0 ? '#F9B051' : '#1e1e1e'}`,
                  display: 'flex', alignItems: 'center', gap: '14px',
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 'bold', fontSize: '14px',
                    background: RANK_COLOURS[idx] || '#333', color: idx < 3 ? '#000' : '#fff',
                  }}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{s.player_name}</div>
                    <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>{s.events_done} event{s.events_done !== 1 ? 's' : ''} completed</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: idx === 0 ? '#F9B051' : '#fff' }}>{s.total_placement}</div>
                    <div style={{ fontSize: '11px', color: '#555' }}>placement pts</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Events list */}
          <div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '1px' }}>Today's Events</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {events.map(event => {
                const scores = getEventScores(event.id)
                const leader = scores[0] ?? null
                const isExpanded = expandedEventId === event.id
                return (
                  <div key={event.id} style={{ background: '#111', borderRadius: '8px', overflow: 'hidden', border: `1px solid ${isExpanded ? '#2371BB' : '#1e1e1e'}` }}>
                    <button
                      onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                      style={{ width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}
                    >
                      <div style={{ textAlign: 'left', flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#fff' }}>{event.event_name}</div>
                        <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>{event.domain_name}</div>
                      </div>
                      {leader ? (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          <div style={{ fontSize: '13px', fontWeight: 'bold', color: '#F9B051' }}>{leader.player_name}</div>
                          <div style={{ fontSize: '11px', color: '#4DB26E' }}>{leader.score_label || leader.raw_score} · {scores.length} score{scores.length !== 1 ? 's' : ''}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: '11px', color: '#444' }}>No scores yet</div>
                      )}
                      <div style={{ color: '#333', fontSize: '12px', flexShrink: 0, marginLeft: '4px' }}>{isExpanded ? '▲' : '▼'}</div>
                    </button>
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #1e1e1e' }}>
                        {scores.length === 0 ? (
                          <div style={{ padding: '12px 14px', color: '#444', fontSize: '12px' }}>No scores submitted yet.</div>
                        ) : scores.map((r, idx) => (
                          <div key={r.id} style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            padding: '10px 14px',
                            borderBottom: idx < scores.length - 1 ? '1px solid #1a1a1a' : 'none',
                            background: idx === 0 ? '#0d1a0d' : 'transparent',
                          }}>
                            <div style={{
                              width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '11px', fontWeight: 'bold',
                              background: RANK_COLOURS[idx] || '#222', color: idx < 3 ? '#000' : '#fff',
                            }}>{r.placement}</div>
                            <div style={{ flex: 1, fontSize: '13px', color: idx === 0 ? '#fff' : '#aaa', fontWeight: idx === 0 ? 'bold' : 'normal' }}>{r.player_name}</div>
                            <div style={{ fontSize: '14px', fontWeight: 'bold', color: idx === 0 ? '#F9B051' : '#666' }}>{r.score_label || r.raw_score}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── SUBMIT TAB ── */}
      {activeTab === 'submit' && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!player ? (
            <div style={{ background: '#1a1a2e', border: '1px solid #2371BB', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Login required</div>
              <div style={{ color: '#555', fontSize: '13px', marginBottom: '16px' }}>You need an AllSport account to submit scores</div>
              <a href="/play" style={{ background: '#2371BB', color: '#fff', padding: '10px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>Log In →</a>
            </div>
          ) : sessionEnded ? (
            <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>⏱</div>
              <div style={{ fontWeight: 'bold', color: '#EA4742' }}>Session has ended</div>
              <div style={{ color: '#555', fontSize: '13px', marginTop: '8px' }}>Score submission is locked</div>
            </div>
          ) : (
            <>
              {submitSuccess && (
                <div style={{ background: '#0d2e1a', border: '1px solid #4DB26E', borderRadius: '8px', padding: '12px 16px', color: '#4DB26E', fontSize: '14px' }}>
                  ✓ Score submitted!
                </div>
              )}

              {/* Player chip + bodyweight */}
              <div style={{ background: '#111', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2371BB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0 }}>
                  {(player.display_name || player.username || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{player.display_name || player.username}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>{player.division}</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                  <input
                    type="number"
                    value={bodyweight}
                    onChange={e => setBodyweight(e.target.value)}
                    onBlur={saveBodyweight}
                    placeholder="kg"
                    style={{ width: '60px', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '6px 8px', color: '#fff', fontSize: '14px', fontWeight: 'bold', textAlign: 'center' }}
                  />
                  <span style={{ fontSize: '11px', color: bodyweightSaved ? '#4DB26E' : '#444' }}>
                    {bodyweightSaved ? '✓ saved' : 'BW kg'}
                  </span>
                </div>
              </div>

              {/* Event selector */}
              <div>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>SELECT EVENT</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {events.map(event => {
                    const myScore = results.find(r => r.event_id === event.id && r.player_id === player.id)
                    const isSelected = selectedEvent?.id === event.id
                    return (
                      <button key={event.id} onClick={() => setSelectedEvent(isSelected ? null : event)} style={{
                        padding: '12px 14px', borderRadius: '8px', border: `1px solid ${isSelected ? '#2371BB' : '#1e1e1e'}`,
                        cursor: 'pointer', textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        background: isSelected ? '#0d1a2e' : '#111',
                        color: isSelected ? '#fff' : '#aaa',
                        fontSize: '13px',
                      }}>
                        <div>
                          <span style={{ fontWeight: 'bold' }}>{event.event_name}</span>
                          <span style={{ marginLeft: '8px', opacity: 0.5, fontSize: '11px' }}>{event.domain_name}</span>
                        </div>
                        {myScore && (
                          <span style={{ fontSize: '11px', color: '#4DB26E', flexShrink: 0 }}>
                            ✓ {myScore.score_label || myScore.raw_score}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Domain-specific score inputs */}
              {selectedEvent && mode && (
                <div style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#555', textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {selectedEvent.domain_name} — {selectedEvent.event_name}
                  </div>

                  {/* STRENGTH: weight + reps */}
                  {mode === 'strength' && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>WEIGHT (kg)</label>
                        <input type="number" value={weightKg} onChange={e => setWeightKg(e.target.value)}
                          placeholder="100" style={inp} />
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>REPS</label>
                        <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)}
                          placeholder="5" style={inp} />
                      </div>
                    </div>
                  )}

                  {/* REPS: count only */}
                  {mode === 'reps' && (
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>REPS / COUNT</label>
                      <input type="number" value={repCount} onChange={e => setRepCount(e.target.value)}
                        placeholder="42" style={{ ...inp, fontSize: '32px' }} />
                    </div>
                  )}

                  {/* TIME: min + sec */}
                  {mode === 'time' && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>MINUTES</label>
                          <input type="number" value={timeMins} onChange={e => setTimeMins(e.target.value)}
                            placeholder="1" style={inp} />
                        </div>
                        <div>
                          <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SECONDS</label>
                          <input type="number" value={timeSecs} onChange={e => setTimeSecs(e.target.value)}
                            placeholder="42" style={inp} />
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#444' }}>Lower time = better ranking</div>
                    </>
                  )}

                  {/* DISTANCE: value + unit */}
                  {mode === 'distance' && (
                    <div>
                      <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>DISTANCE / MEASUREMENT</label>
                      <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                        <input type="number" value={distanceVal} onChange={e => setDistanceVal(e.target.value)}
                          placeholder="8.5" style={{ ...inp, flex: 1 }} />
                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                          <button onClick={() => setDistanceUnit('m')} style={unitBtn('m')}>m</button>
                          <button onClick={() => setDistanceUnit('cm')} style={unitBtn('cm')}>cm</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* SPORT: win / draw / loss */}
                  {mode === 'sport' && (
                    <>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '8px' }}>RESULT</label>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => setSportResult('win')} style={sportBtn('win')}>Win</button>
                          <button onClick={() => setSportResult('draw')} style={sportBtn('draw')}>Draw</button>
                          <button onClick={() => setSportResult('loss')} style={sportBtn('loss')}>Loss</button>
                        </div>
                      </div>
                      <div>
                        <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>SCORE (optional — e.g. 21-15)</label>
                        <input value={sportScore} onChange={e => setSportScore(e.target.value)}
                          placeholder="21-15" style={{ ...inp, fontSize: '18px' }} />
                      </div>
                    </>
                  )}

                  {/* Preview */}
                  {isScoreValid() && (
                    <div style={{ background: '#111', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '12px', color: '#555' }}>Preview</span>
                      <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#4DB26E' }}>{computeScore().score_label}</span>
                    </div>
                  )}
                </div>
              )}

              {error && <p style={{ color: '#EA4742', fontSize: '13px', margin: 0 }}>{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!selectedEvent || !isScoreValid() || submitting}
                style={{
                  padding: '16px', borderRadius: '10px', border: 'none', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                  background: selectedEvent && isScoreValid() ? '#EA4742' : '#1a1a1a',
                  color: selectedEvent && isScoreValid() ? '#fff' : '#444',
                }}
              >
                {submitting ? 'Submitting...' : 'Submit Score'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
