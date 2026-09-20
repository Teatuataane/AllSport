'use client'

// ─── New official game ───────────────────────────────────────────────────────
// A kaiwhakawā picks one event per domain and starts the game. The picker is
// the SAME component a player uses to set up a personal game
// (components/play/EventPlanPicker), so setting up a workout and setting up a
// game are one experience — the first thing the September 2026 customisation
// review asked for.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { DOMAIN_ORDER } from '@/lib/eventData'
import { DOMAIN_COLORS } from '@/lib/domainColours'
import { sessionStart } from '@/lib/dates'
import { drawPlan, planEvents } from '@/lib/personalGame'
import EventPlanPicker from '@/components/play/EventPlanPicker'

export default function ScoringSetup() {
  const router = useRouter()
  const [location, setLocation] = useState('AllSport HQ')
  const [isChampionship, setIsChampionship] = useState(false)
  const [startTime, setStartTime] = useState(() => {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  })
  const [plan, setPlan] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const events = planEvents(plan)
  const allSelected = events.length === 10

  const handleStart = async () => {
    if (!allSelected) return
    setLoading(true)
    setError('')
    try {
      const supabase = createClient()

      // Guard: reject if a session is already active
      const { count } = await supabase
        .from('sessions')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true)
      if (count && count > 0) {
        setError('A session is already active — end it before starting a new one.')
        setLoading(false)
        return
      }

      // started_at and session_date come from ONE derivation so they cannot
      // disagree — deriving the date separately from toISOString() is what
      // stamped every NZ morning game with the previous day. See sessionStart.
      const { startedAt: started, sessionDate: today } = sessionStart(startTime)

      const sessionCode = Math.random().toString(36).substring(2, 8).toUpperCase()

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          session_date: today,
          start_time: startTime + ':00',
          location,
          is_championship: isChampionship,
          is_active: true,
          started_at: started.toISOString(),
          session_code: sessionCode,
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const eventsToInsert = events.map(ev => ({
        session_id: session.id,
        domain_number: ev.domainNumber,
        domain_name: ev.domain,
        event_name: ev.name,
        event_slug: ev.slug,
        input_mode: ev.inputMode,
        display_order: ev.domainNumber,
      }))

      const { error: eventsError } = await supabase
        .from('session_events')
        .insert(eventsToInsert)

      if (eventsError) throw eventsError

      router.push(`/scoring/${session.id}`)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#2371BB', lineHeight: 1 }}>New Game</div>
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Select one event per domain</div>
          </div>
          {/* Progress ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {DOMAIN_ORDER.map((_, i) => (
                <div key={i} style={{
                  width: '6px', height: '24px', borderRadius: '3px', transition: 'background 0.2s',
                  background: events.some(e => e.domainNumber === i + 1) ? DOMAIN_COLORS[i] : '#222',
                }} />
              ))}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: allSelected ? '#4DB26E' : '#555' }}>
              {events.length}/10
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px' }}>
        {/* Session config */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
            <div>
              <label htmlFor="location" style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '11px', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Location</label>
              <input
                id="location"
                value={location}
                onChange={e => setLocation(e.target.value)}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '16px', fontFamily: 'var(--font-body)', boxSizing: 'border-box' as const, minHeight: '44px' }}
              />
            </div>
            <div>
              <label htmlFor="start-time" style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '11px', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Start Time</label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '16px', fontFamily: 'var(--font-body)', minHeight: '44px', colorScheme: 'dark' as const }}
              />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={isChampionship}
              onChange={e => setIsChampionship(e.target.checked)}
              style={{ width: '18px', height: '18px', accentColor: '#F9B051' }}
            />
            <div>
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', color: isChampionship ? '#F9B051' : '#ccc' }}>Championship Game</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: '12px', color: '#555' }}>Marks this game as the annual Championship</div>
            </div>
          </label>
        </div>

        {/* Draw — the same shortcut a personal game offers */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setPlan(drawPlan())} style={{
            minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
            background: '#151515', border: '1px solid #2a2a2a', color: '#fff',
            fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>Draw for me</button>
          {plan.length > 0 && (
            <button type="button" onClick={() => setPlan([])} style={{
              minHeight: 44, padding: '0 16px', borderRadius: 999, cursor: 'pointer',
              background: 'none', border: '1px solid #2a2a2a', color: '#888',
              fontFamily: 'var(--font-label)', fontSize: 13, letterSpacing: '0.08em', textTransform: 'uppercase',
            }}>Clear</button>
          )}
        </div>

        <EventPlanPicker mode="official" plan={plan} onChange={setPlan} />

        {error && (
          <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '12px 16px', color: '#EA4742', fontSize: '14px', fontFamily: 'var(--font-body)', margin: '16px 0' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!allSelected || loading}
          style={{
            width: '100%', marginTop: '24px', padding: '18px', borderRadius: '10px', border: 'none',
            cursor: allSelected && !loading ? 'pointer' : 'not-allowed',
            background: allSelected ? 'linear-gradient(90deg, #2371BB, #EA4742)' : '#1a1a1a',
            color: allSelected ? '#fff' : '#444',
            fontFamily: 'var(--font-display)', fontSize: '22px', letterSpacing: '0.1em',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Starting game...' : allSelected ? 'Start Game →' : `Select ${10 - events.length} more event${10 - events.length !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
