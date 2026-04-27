'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS, DOMAIN_ORDER, getEventsByDomain } from '@/lib/eventData'

const supabase = createClient()

const DOMAIN_COLOURS: Record<number, string> = {
  1: '#EA4742', 2: '#F9B051', 3: '#F397C0', 4: '#B87DB5', 5: '#2371BB',
  6: '#4DB26E', 7: '#EA4742', 8: '#F9B051', 9: '#B87DB5', 10: '#2371BB',
}

const CURRENT_YEAR = new Date().getFullYear()

type PRResult = {
  id: string
  score_label: string
  raw_score: number
  adjusted_score: number | null
  difficulty_tier: string | null
  placement: number | null
  session_date: string
  is_championship: boolean
  event_name: string
  domain_number: number
}

function effectiveScore(r: PRResult): number {
  return r.adjusted_score != null ? r.adjusted_score : r.raw_score
}

function sessionYear(session_date: string): number {
  return parseInt(session_date.slice(0, 4), 10)
}

export default function PRsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [results, setResults] = useState<PRResult[]>([])
  const [tab, setTab] = useState<'season' | 'all'>('season')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/play'); return }

      const { data } = await supabase
        .from('results')
        .select(`
          id, score_label, raw_score, adjusted_score, difficulty_tier, placement,
          session_events!inner(event_name, domain_number),
          sessions!inner(session_date, is_championship)
        `)
        .eq('player_id', user.id)
        .not('score_label', 'is', null)
        .order('created_at', { ascending: false })

      if (data) {
        const mapped: PRResult[] = (data as any[]).map(r => ({
          id: r.id,
          score_label: r.score_label,
          raw_score: r.raw_score,
          adjusted_score: r.adjusted_score,
          difficulty_tier: r.difficulty_tier,
          placement: r.placement,
          session_date: r.sessions.session_date,
          is_championship: r.sessions.is_championship,
          event_name: r.session_events.event_name,
          domain_number: r.session_events.domain_number,
        }))
        setResults(mapped)
      }
      setLoading(false)
    }
    load()
  }, [])

  const byDomain = getEventsByDomain()
  const visibleResults = tab === 'season'
    ? results.filter(r => sessionYear(r.session_date) === CURRENT_YEAR)
    : results

  // Group results by event name
  const resultsByEvent: Record<string, PRResult[]> = {}
  for (const r of visibleResults) {
    if (!resultsByEvent[r.event_name]) resultsByEvent[r.event_name] = []
    resultsByEvent[r.event_name].push(r)
  }

  // Sort each event's results descending by effective score (best first)
  for (const k of Object.keys(resultsByEvent)) {
    resultsByEvent[k].sort((a, b) => effectiveScore(b) - effectiveScore(a))
  }

  const totalPBs = Object.keys(resultsByEvent).length
  const totalEvents = EVENTS.length

  const toggleExpanded = (slug: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '20px 24px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Link href="/dashboard" style={{ color: '#555', fontSize: '12px', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>
            ← Dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '36px', color: '#fff', lineHeight: 1 }}>My Personal Bests</div>
              {!loading && (
                <div style={{ color: '#555', fontSize: '13px', marginTop: '4px', fontFamily: 'Barlow, sans-serif' }}>
                  {totalPBs} / {totalEvents} events {tab === 'season' ? `in ${CURRENT_YEAR}` : 'all time'}
                </div>
              )}
            </div>
            {/* Season tabs */}
            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
              {(['season', 'all'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  style={{
                    padding: '6px 14px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                    fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: tab === t ? '#2371BB' : '#111',
                    color: tab === t ? '#fff' : '#555',
                    transition: 'all 0.15s',
                  }}
                >
                  {t === 'season' ? `${CURRENT_YEAR}` : 'All time'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {loading ? (
          <div style={{ color: '#555', fontSize: '14px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', paddingTop: '48px' }}>Loading your results…</div>
        ) : (
          DOMAIN_ORDER.map((domain, domainIdx) => {
            const domainNumber = domainIdx + 1
            const colour = DOMAIN_COLOURS[domainNumber] || '#2371BB'
            const domainEvents = byDomain[domain] || []

            return (
              <div key={domain}>
                {/* Domain heading */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '4px', height: '20px', borderRadius: '2px', background: colour, flexShrink: 0 }} />
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '20px', color: colour, letterSpacing: '1px' }}>
                    {domainNumber}. {domain.toUpperCase()}
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {domainEvents.map(event => {
                    const eventResults = resultsByEvent[event.name]
                    const pb = eventResults?.[0]
                    const isExpanded = expanded.has(event.slug)

                    return (
                      <div
                        key={event.slug}
                        style={{
                          background: '#111', border: `1px solid ${pb ? colour + '33' : '#1a1a1a'}`,
                          borderRadius: '8px', overflow: 'hidden',
                        }}
                      >
                        {/* Event row */}
                        <button
                          onClick={() => { if (pb) toggleExpanded(event.slug) }}
                          style={{
                            width: '100%', background: 'transparent', border: 'none',
                            padding: '11px 14px', cursor: pb ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <div style={{ fontSize: '14px', fontWeight: 600, color: pb ? '#fff' : '#444', fontFamily: 'Barlow, sans-serif' }}>
                              {event.name}
                              {event.hasDifficultyTiers && event.difficultyTiers && (
                                <span style={{ marginLeft: '8px', fontSize: '11px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                                  D1–D{event.difficultyTiers.length}
                                </span>
                              )}
                            </div>
                            {pb && (
                              <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                {event.inputMode}
                              </div>
                            )}
                          </div>

                          {pb ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '16px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Barlow, sans-serif' }}>
                                  {pb.score_label}
                                </div>
                                {pb.difficulty_tier && (
                                  <div style={{ fontSize: '11px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700 }}>
                                    {pb.difficulty_tier}
                                  </div>
                                )}
                              </div>
                              <div style={{ color: '#333', fontSize: '14px', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</div>
                            </div>
                          ) : (
                            <div style={{ fontSize: '12px', color: '#333', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>No result</div>
                          )}
                        </button>

                        {/* Expanded history */}
                        {isExpanded && pb && (
                          <div style={{ borderTop: '1px solid #1e1e1e', padding: '8px 14px 12px' }}>
                            <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>
                              All results — {eventResults.length} session{eventResults.length !== 1 ? 's' : ''}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {eventResults.map((r, i) => {
                                const isBest = i === 0
                                const date = new Date(r.session_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
                                return (
                                  <div
                                    key={r.id}
                                    style={{
                                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                      padding: '8px 10px', borderRadius: '6px',
                                      background: isBest ? colour + '11' : '#0a0a0a',
                                      border: `1px solid ${isBest ? colour + '33' : '#1a1a1a'}`,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                      {isBest && (
                                        <div style={{
                                          fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: 700,
                                          color: colour, background: colour + '22', border: `1px solid ${colour}44`,
                                          padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em', textTransform: 'uppercase',
                                        }}>PB</div>
                                      )}
                                      <div style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow, sans-serif' }}>{date}</div>
                                      {r.is_championship && (
                                        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: 700, color: '#F9B051', background: '#F9B05122', border: '1px solid #F9B05144', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em' }}>
                                          CHAMP
                                        </div>
                                      )}
                                      {r.difficulty_tier && (
                                        <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '10px', fontWeight: 700, color: '#B87DB5', background: '#B87DB522', border: '1px solid #B87DB544', padding: '2px 6px', borderRadius: '4px' }}>
                                          {r.difficulty_tier}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: isBest ? 700 : 400, color: isBest ? '#4DB26E' : '#888', fontFamily: 'Barlow, sans-serif' }}>
                                      {r.score_label}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <Link
                              href={`/events/${event.slug}`}
                              style={{ display: 'block', marginTop: '10px', fontSize: '12px', color: '#2371BB', fontFamily: 'Barlow, sans-serif', textDecoration: 'none' }}
                            >
                              View event details →
                            </Link>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
