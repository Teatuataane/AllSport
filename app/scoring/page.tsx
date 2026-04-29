'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { getEventByName } from '@/lib/eventData'

const DOMAINS = [
  { number: 1,  name: 'Maximal Strength',    events: ['1 Arm Press','Deadlift','Overhead Press','Pause Dips','Pause Chin Up','Pause Squat','Zercher Deadlift','Hamstring Curl','Pause Bench Press','Turkish Get-Up'] },
  { number: 2,  name: 'Relative Strength',   events: ['1 Leg Squat','Flag','Windshield Wipers','Toe Lift','Planche','Back Lever','Iron Cross','Front Lever','Chin Hang','Rope Climb'] },
  { number: 3,  name: 'Muscular Endurance',  events: ['Chin Up Contest','Push Up Contest','Reverse Hyper','L-Sit Hold','Tibialis Curl','Headstand','Finger Push Up','Calf Raise','Leg Extension','Ab Wheel Rollout'] },
  { number: 4,  name: 'Flexibility & Mobility', events: ['Rear Hand Clasp','Bridge','Forward Fold','Needle Pose','Front Split','Middle Split','Standing Split','Foot Behind Head','Shoulder Dislocate','Side Bend'] },
  { number: 5,  name: 'Power',               events: ['Kelly Snatch','1 Arm Snatch','Triple Jump','Javelin Throw','Shot Put','AFL','Vertical Jump','Glute Bridge','Clean & Jerk','Snatch'] },
  { number: 6,  name: 'Aerobic Endurance',   events: ['200m Burpee Broad Jump','1k Run','1k Cycle','1k Ski Erg','1k Row','Iron Lungs','200m Carry','2k Run','200m Repeats','Bronco'] },
  { number: 7,  name: 'Speed & Agility',     events: ['100m Sprint','Tag','T-Race','400m Race','Beach Flags','50m Sprint','200m Sprint','Touch Rugby','Football Dribble','Repeat High Jump'] },
  { number: 8,  name: 'Body Awareness',      events: ['Tae Kwon Do','Breakdancing','Trampolining','Jump Rope','Wrestling','Gymnastics','Balance Ball','SKATE','Fencing','Juggling'] },
  { number: 9,  name: 'Co-ordination',       events: ['Volleyball','Baseball','Teqball','Tennis','Cricket','Badminton','Basketball','Football','Hockey','Squash'] },
  { number: 10, name: 'Aim & Precision',     events: ['Netball','Handball','Cornhole','Dodgeball','Carrom','Archery','Bowling','Darts','Disc Golf','Golf'] },
]

const DOMAIN_COLORS = [
  '#EA4742', '#F9B051', '#F397C0', '#B87DB5', '#2371BB',
  '#4DB26E', '#EA4742', '#F9B051', '#B87DB5', '#2371BB',
]

export default function ScoringSetup() {
  const router = useRouter()
  const [location, setLocation] = useState('AllSport HQ')
  const [isChampionship, setIsChampionship] = useState(false)
  const [startTime, setStartTime] = useState(() => {
    const now = new Date()
    return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`
  })
  const [selectedEvents, setSelectedEvents] = useState<{ [domainNumber: number]: string }>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selected = Object.keys(selectedEvents).length
  const allSelected = selected === 10

  const handleEventSelect = (domainNumber: number, event: string) => {
    setSelectedEvents(prev => ({ ...prev, [domainNumber]: event }))
  }

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

      const today = new Date().toISOString().split('T')[0]
      // Build started_at from the selected start time today
      const [h, m] = startTime.split(':').map(Number)
      const started = new Date()
      started.setHours(h, m, 0, 0)

      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .insert({
          session_date: today,
          start_time: startTime + ':00',
          location,
          is_championship: isChampionship,
          is_active: true,
          started_at: started.toISOString(),
        })
        .select()
        .single()

      if (sessionError) throw sessionError

      const eventsToInsert = DOMAINS.map(d => {
        const evName = selectedEvents[d.number]
        const evData = getEventByName(evName)
        return {
          session_id: session.id,
          domain_number: d.number,
          domain_name: d.name,
          event_name: evName,
          event_slug: evData?.slug ?? '',
          input_mode: evData?.inputMode ?? 'strength',
          display_order: d.number,
        }
      })

      const { error: eventsError } = await supabase
        .from('session_events')
        .insert(eventsToInsert)

      if (eventsError) throw eventsError

      router.push(`/scoring/${session.id}`)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '16px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#2371BB', lineHeight: 1 }}>New Session</div>
            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Select one event per domain</div>
          </div>
          {/* Progress ring */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '4px' }}>
              {DOMAINS.map(d => (
                <div key={d.number} style={{ width: '6px', height: '24px', borderRadius: '3px', background: selectedEvents[d.number] ? DOMAIN_COLORS[d.number - 1] : '#222', transition: 'background 0.2s' }} />
              ))}
            </div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: allSelected ? '#4DB26E' : '#555' }}>
              {selected}/10
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px' }}>
        {/* Session config */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px' }}>
            <div>
              <label style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '11px', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Location</label>
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                style={{ width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '15px', fontFamily: 'Barlow, sans-serif', boxSizing: 'border-box' as const, outline: 'none' }}
              />
            </div>
            <div>
              <label style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '11px', color: '#555', letterSpacing: '0.15em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>Start Time</label>
              <input
                type="time"
                value={startTime}
                onChange={e => setStartTime(e.target.value)}
                style={{ background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '10px 14px', color: '#fff', fontSize: '15px', fontFamily: 'Barlow, sans-serif', outline: 'none', colorScheme: 'dark' as any }}
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
              <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '14px', color: isChampionship ? '#F9B051' : '#ccc' }}>Championship Session</div>
              <div style={{ fontFamily: 'Barlow, sans-serif', fontSize: '12px', color: '#555' }}>Awards championship bonus points</div>
            </div>
          </label>
        </div>

        {/* Domain event selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '32px' }}>
          {DOMAINS.map(domain => {
            const domainColor = DOMAIN_COLORS[domain.number - 1]
            const chosen = selectedEvents[domain.number]
            return (
              <div key={domain.number} style={{ background: '#111', border: `1px solid ${chosen ? domainColor + '44' : '#1a1a1a'}`, borderRadius: '10px', overflow: 'hidden', transition: 'border-color 0.2s' }}>
                <div style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${chosen ? domainColor + '22' : '#1a1a1a'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: chosen ? domainColor : '#2a2a2a', flexShrink: 0 }} />
                    <div>
                      <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '13px', color: chosen ? '#fff' : '#888', letterSpacing: '0.05em' }}>
                        {domain.number}. {domain.name.toUpperCase()}
                      </div>
                    </div>
                  </div>
                  {chosen && (
                    <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: 700, color: domainColor, background: domainColor + '22', padding: '3px 10px', borderRadius: '4px', letterSpacing: '0.05em' }}>
                      {chosen}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px', display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                  {domain.events.map(event => {
                    const isSelected = selectedEvents[domain.number] === event
                    return (
                      <button
                        key={event}
                        onClick={() => handleEventSelect(domain.number, event)}
                        style={{
                          padding: '5px 10px', fontSize: '12px', borderRadius: '5px', cursor: 'pointer',
                          border: isSelected ? `1px solid ${domainColor}` : '1px solid #222',
                          background: isSelected ? domainColor : '#0d0d0d',
                          color: isSelected ? '#fff' : '#777',
                          fontFamily: 'Barlow Condensed, sans-serif',
                          fontWeight: isSelected ? 700 : 400,
                          letterSpacing: '0.03em',
                          transition: 'all 0.15s',
                        }}
                      >
                        {event}
                        {(() => { const ev = getEventByName(event); return ev?.hasDifficultyTiers && ev.difficultyTiers ? <span style={{ marginLeft: '5px', color: isSelected ? 'rgba(255,255,255,0.7)' : '#B87DB5', fontSize: '10px' }}>D1–D{ev.difficultyTiers.length}</span> : null })()}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {error && (
          <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '12px 16px', color: '#EA4742', fontSize: '14px', fontFamily: 'Barlow, sans-serif', marginBottom: '16px' }}>
            {error}
          </div>
        )}

        <button
          onClick={handleStart}
          disabled={!allSelected || loading}
          style={{
            width: '100%', padding: '18px', borderRadius: '10px', border: 'none',
            cursor: allSelected && !loading ? 'pointer' : 'not-allowed',
            background: allSelected ? 'linear-gradient(90deg, #2371BB, #EA4742)' : '#1a1a1a',
            color: allSelected ? '#fff' : '#444',
            fontFamily: 'Bebas Neue, cursive', fontSize: '22px', letterSpacing: '0.1em',
            transition: 'opacity 0.2s',
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? 'Starting session...' : allSelected ? 'Start Session →' : `Select ${10 - selected} more event${10 - selected !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  )
}
