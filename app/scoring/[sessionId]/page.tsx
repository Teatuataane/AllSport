'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
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

export default function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const router = useRouter()
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [results, setResults] = useState<Result[]>([])
  const [session, setSession] = useState<any>(null)
  const [player, setPlayer] = useState<any>(null)
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'submit'>('leaderboard')
  const [selectedEvent, setSelectedEvent] = useState<SessionEvent | null>(null)
  const [scoreValue, setScoreValue] = useState('')
  const [scoreLabel, setScoreLabel] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [error, setError] = useState('')
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const [sessionEnded, setSessionEnded] = useState(false)

  // Timer
  useEffect(() => {
    if (!session?.started_at || !session?.duration_minutes) return
    const endTime = new Date(session.started_at).getTime() + session.duration_minutes * 60 * 1000

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000))
      setTimeLeft(remaining)
      if (remaining === 0) {
        setSessionEnded(true)
        // Mark session as inactive
        supabase.from('sessions').update({ is_active: false, ended_at: new Date().toISOString() }).eq('id', sessionId)
      }
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [session, sessionId])

  useEffect(() => {
    const load = async () => {
      // Get logged in player
      const { data: { session: authSession } } = await supabase.auth.getSession()
      if (authSession) {
        const { data: playerData } = await supabase
          .from('players').select('*').eq('id', authSession.user.id).single()
        setPlayer(playerData)
      }

      const { data: sessionData } = await supabase
        .from('sessions').select('*').eq('id', sessionId).single()
      setSession(sessionData)
      if (!sessionData?.is_active) setSessionEnded(true)

      const { data: eventsData } = await supabase
        .from('session_events').select('*').eq('session_id', sessionId)
        .order('domain_number')
      setEvents(eventsData || [])

      const { data: resultsData } = await supabase
        .from('results').select('*').eq('session_id', sessionId)
      setResults(resultsData || [])
    }
    load()

    const channel = supabase
      .channel(`session-${sessionId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'results',
        filter: `session_id=eq.${sessionId}`
      }, payload => {
        setResults(prev => [...prev, payload.new as Result])
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'results',
        filter: `session_id=eq.${sessionId}`
      }, payload => {
        setResults(prev => prev.filter(r => r.id !== (payload.old as any).id))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  const handleSubmit = async () => {
    if (!selectedEvent || !scoreValue.trim() || sessionEnded) return
    if (!player) { setError('You must be logged in to submit a score'); return }
    setSubmitting(true)
    setError('')
    try {
      const { error: err } = await supabase.from('results').upsert({
        session_id: sessionId,
        event_id: selectedEvent.id,
        player_name: player.display_name || player.username || player.full_name,
        player_id: player.id,
        raw_score: parseFloat(scoreValue),
        score_label: scoreLabel || scoreValue,
        score: parseFloat(scoreValue),
      }, { onConflict: 'player_id,session_id,event_id' })
      if (err) throw err
      setScoreValue('')
      setScoreLabel('')
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
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)

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
          {/* Timer */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: timerColour, fontVariantNumeric: 'tabular-nums' }}>
              {sessionEnded ? 'ENDED' : timeLeft !== null ? formatTime(timeLeft) : '--:--'}
            </div>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>remaining</div>
          </div>
        </div>

        {/* Session code */}
        {session?.session_code && (
          <div style={{ marginTop: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.6)' }}>SESSION CODE</div>
            <div style={{ fontSize: '22px', fontWeight: 'bold', letterSpacing: '6px', color: '#fff' }}>
              {session.session_code}
            </div>
          </div>
        )}
      </div>

      {/* Session ended banner */}
      {sessionEnded && (
        <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', padding: '14px 20px', textAlign: 'center' }}>
          <div style={{ color: '#EA4742', fontWeight: 'bold', fontSize: '15px' }}>⏱ Session Ended</div>
          <div style={{ color: '#888', fontSize: '12px', marginTop: '4px' }}>Score submission is now locked</div>
        </div>
      )}

      {/* Rainbow stripe */}
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

      {/* Leaderboard */}
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
                  display: 'flex', alignItems: 'center', gap: '14px'
                }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', flexShrink: 0,
                    background: RANK_COLOURS[idx] || '#333', color: idx < 3 ? '#000' : '#fff'
                  }}>{idx + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 'bold', fontSize: '15px' }}>{s.player_name}</div>
                    <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>
                      {s.events_done} event{s.events_done !== 1 ? 's' : ''} completed
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '20px', fontWeight: 'bold', color: idx === 0 ? '#F9B051' : '#fff' }}>
                      {s.total_placement}
                    </div>
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
                    {/* Event header row — tap to expand */}
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

                    {/* Expanded scores list */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #1e1e1e' }}>
                        {scores.length === 0 ? (
                          <div style={{ padding: '12px 14px', color: '#444', fontSize: '12px' }}>No scores submitted for this event yet.</div>
                        ) : (
                          scores.map((r, idx) => (
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
                                background: RANK_COLOURS[idx] || '#222',
                                color: idx < 3 ? '#000' : '#fff',
                              }}>{r.placement}</div>
                              <div style={{ flex: 1, fontSize: '13px', color: idx === 0 ? '#fff' : '#aaa', fontWeight: idx === 0 ? 'bold' : 'normal' }}>
                                {r.player_name}
                              </div>
                              <div style={{ fontSize: '14px', fontWeight: 'bold', color: idx === 0 ? '#F9B051' : '#666' }}>
                                {r.score_label || r.raw_score}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Submit tab */}
      {activeTab === 'submit' && (
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {!player ? (
            <div style={{ background: '#1a1a2e', border: '1px solid #2371BB', borderRadius: '10px', padding: '24px', textAlign: 'center' }}>
              <div style={{ fontSize: '24px', marginBottom: '12px' }}>🔒</div>
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>Login required</div>
              <div style={{ color: '#555', fontSize: '13px', marginBottom: '16px' }}>You need an AllSport account to submit scores</div>
              <a href="/play" style={{ background: '#2371BB', color: '#fff', padding: '10px 24px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', fontSize: '14px' }}>
                Log In →
              </a>
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

              <div style={{ background: '#111', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#2371BB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px' }}>
                  {(player.display_name || player.username || '?')[0].toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{player.display_name || player.username}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>{player.division}</div>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>SELECT EVENT</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {events.map(event => (
                    <button key={event.id} onClick={() => setSelectedEvent(event)} style={{
                      padding: '12px 14px', borderRadius: '8px', border: 'none', cursor: 'pointer', textAlign: 'left',
                      background: selectedEvent?.id === event.id ? '#2371BB' : '#111',
                      color: selectedEvent?.id === event.id ? '#fff' : '#aaa',
                      fontSize: '13px',
                    }}>
                      <span style={{ fontWeight: 'bold' }}>{event.event_name}</span>
                      <span style={{ marginLeft: '8px', opacity: 0.6, fontSize: '11px' }}>{event.domain_name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {selectedEvent && (
                <>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>
                      SCORE (number — kg, seconds, reps, metres)
                    </label>
                    <input
                      type="number"
                      value={scoreValue}
                      onChange={e => setScoreValue(e.target.value)}
                      placeholder="e.g. 100"
                      style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '12px', color: '#fff', fontSize: '24px', fontWeight: 'bold', boxSizing: 'border-box' as const }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }}>
                      LABEL (optional — e.g. "1:42" or "105kg x 3")
                    </label>
                    <input
                      value={scoreLabel}
                      onChange={e => setScoreLabel(e.target.value)}
                      placeholder="Human-readable version"
                      style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '12px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' as const }}
                    />
                  </div>
                </>
              )}

              {error && <p style={{ color: '#EA4742', fontSize: '13px', margin: 0 }}>{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={!selectedEvent || !scoreValue.trim() || submitting}
                style={{
                  padding: '16px', borderRadius: '10px', border: 'none', fontSize: '15px', fontWeight: 'bold', cursor: 'pointer',
                  background: selectedEvent && scoreValue ? '#EA4742' : '#222',
                  color: selectedEvent && scoreValue ? '#fff' : '#555',
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
