'use client'

import { useParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { getEventBySlug } from '@/lib/eventData'

const supabase = createClient()

const DOMAIN_COLOURS: Record<number, string> = {
  1: '#EA4742', 2: '#F9B051', 3: '#F397C0', 4: '#B87DB5', 5: '#2371BB',
  6: '#4DB26E', 7: '#EA4742', 8: '#F9B051', 9: '#B87DB5', 10: '#2371BB',
}

const INPUT_MODE_LABEL: Record<string, string> = {
  strength: 'Weight lifted (kg) relative to bodyweight',
  reps: 'Total repetitions',
  time: 'Time — lower is better',
  hold: 'Hold duration — longer is better',
  distance: 'Distance covered',
  flexibility: 'Blocks from floor — fewer is better',
  sport: 'Win / Draw / Loss result',
  'weight+time': 'Weight carried + time',
  'distance+time': 'Distance reached + time',
  sprint: 'Time in seconds + centiseconds',
  dynamic: 'Variation-based (hold time or reps)',
}

export default function EventPage() {
  const { slug } = useParams<{ slug: string }>()
  const event = getEventBySlug(slug)
  const [player, setPlayer] = useState<any>(null)
  const [personalBest, setPersonalBest] = useState<any>(null)
  const [loadingPB, setLoadingPB] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoadingPB(false); return }

      const { data: p } = await supabase.from('players').select('id, display_name, username').eq('id', user.id).single()
      setPlayer(p)

      if (event) {
        const { data: seData } = await supabase
          .from('session_events')
          .select('id')
          .eq('event_name', event.name)
        const eventIds = (seData || []).map((e: any) => e.id)
        if (eventIds.length > 0) {
          const { data } = await supabase
            .from('results')
            .select('score_label, placement, raw_score, sessions(session_date)')
            .eq('player_id', user.id)
            .in('event_id', eventIds)
            .order('raw_score', { ascending: false })
            .limit(1)
          if (data && data.length > 0) setPersonalBest(data[0])
        }
      }
      setLoadingPB(false)
    }
    load()
  }, [event?.slug])

  if (!event) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '24px' }}>Event not found</div>
        <Link href="/events" style={{ color: '#2371BB' }}>← All Events</Link>
      </div>
    )
  }

  const domainColour = DOMAIN_COLOURS[event.domainNumber] || '#2371BB'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '20px 24px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Link href="/events" style={{ color: '#555', fontSize: '12px', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>
            ← All Events
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '36px', color: '#fff', lineHeight: 1 }}>{event.name}</div>
              <div style={{ marginTop: '8px' }}>
                <span style={{
                  background: domainColour + '22', color: domainColour, border: `1px solid ${domainColour}44`,
                  padding: '3px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: 'bold',
                  fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em',
                }}>
                  {event.domainNumber}. {event.domain.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Video placeholder */}
        <div style={{
          background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px',
          paddingBottom: '56.25%', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px' }}>
            <div style={{ fontSize: '40px', opacity: 0.3 }}>▶</div>
            <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Video coming soon</div>
          </div>
        </div>

        {/* How to perform */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#fff', marginBottom: '12px', letterSpacing: '1px' }}>How to Perform</div>
          <p style={{ color: event.howToPerform === 'Content coming soon.' ? '#555' : '#ccc', fontSize: '14px', lineHeight: 1.6, margin: 0, fontFamily: 'Barlow, sans-serif' }}>
            {event.howToPerform}
          </p>
        </div>

        {/* Rules */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#fff', marginBottom: '12px', letterSpacing: '1px' }}>Rules</div>
          <p style={{ color: event.rules === 'Content coming soon.' ? '#555' : '#ccc', fontSize: '14px', lineHeight: 1.6, margin: 0, fontFamily: 'Barlow, sans-serif' }}>
            {event.rules}
          </p>
        </div>

        {/* Scoring method */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#fff', marginBottom: '12px', letterSpacing: '1px' }}>Scoring Method</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: domainColour + '22', border: `1px solid ${domainColour}44`, padding: '6px 12px', borderRadius: '8px', fontSize: '12px', color: domainColour, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', fontWeight: 'bold', textTransform: 'uppercase' }}>
              {event.inputMode}
            </div>
          </div>
          <p style={{ color: '#888', fontSize: '13px', lineHeight: 1.6, margin: '12px 0 0', fontFamily: 'Barlow, sans-serif' }}>
            {INPUT_MODE_LABEL[event.inputMode] || event.inputMode}
          </p>
        </div>

        {/* Difficulty tiers */}
        {event.hasDifficultyTiers && event.difficultyTiers && (
          <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#B87DB5', marginBottom: '12px', letterSpacing: '1px' }}>
              Difficulty Tiers — D1 to D{event.difficultyTiers.length}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {event.difficultyTiers.map(t => (
                <div key={t.level} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid #1a1a1a' }}>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: '#B87DB522', border: '1px solid #B87DB544',
                    fontFamily: 'Bebas Neue, cursive', fontSize: '14px', color: '#B87DB5',
                  }}>
                    D{t.level}
                  </div>
                  <div style={{ fontSize: '14px', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>{t.name}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personal best */}
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px' }}>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#fff', marginBottom: '12px', letterSpacing: '1px' }}>Personal Best</div>
          {loadingPB ? (
            <div style={{ color: '#555', fontSize: '13px' }}>Loading...</div>
          ) : !player ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}>Log in to see your personal best</div>
              <Link href="/play" style={{ color: '#2371BB', fontSize: '13px', fontWeight: 'bold', textDecoration: 'none' }}>Log In →</Link>
            </div>
          ) : personalBest ? (
            <div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#4DB26E' }}>{personalBest.score_label}</div>
              {personalBest.sessions?.session_date && (
                <div style={{ fontSize: '12px', color: '#555', marginTop: '4px', fontFamily: 'Barlow, sans-serif' }}>
                  {new Date(personalBest.sessions.session_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}>No result yet — participate in a session to set your first score!</div>
          )}
        </div>

      </div>
    </div>
  )
}
