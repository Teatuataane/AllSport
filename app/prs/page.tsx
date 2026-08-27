'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useActivePlayer } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import {
  computePercentiles, domainPercentiles, type DomainPercentile,
} from '@/lib/percentile'
import type {
  RatingResultRow, RatingEventRow, RatingPlayerRow,
} from '@/lib/rating'
import { EVENTS, DOMAIN_ORDER, getEventsByDomain } from '@/lib/eventData'
import { WIN_MIN_FIELD } from '@/lib/taniwha'
import { formatNZDate } from '@/lib/dates'
import DomainIcon from '@/components/DomainIcon'
import EventIcon from '@/components/EventIcon'
import { domainColor } from '@/lib/domainColours'

const supabase = createClient()


const CURRENT_YEAR = new Date().getFullYear()

// Gold, so a win reads as an honour rather than as another domain accent. It
// is a filled pill rather than bare text specifically so it still separates
// from the Calisthenics rows, whose domain colour is the same amber.
const WIN_CHIP: React.CSSProperties = {
  fontFamily: 'var(--font-label)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#F9B051',
  background: '#F9B05118',
  border: '1px solid #F9B05155',
  borderRadius: '4px',
  padding: '2px 6px',
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
}

type PRResult = {
  id: string
  score_label: string
  raw_score: number
  difficulty_tier: string | null
  placement: number | null
  session_date: string
  is_championship: boolean
  event_name: string
  domain_number: number
}

function effectiveScore(r: PRResult): number {
  return r.raw_score
}

function sportWDL(results: PRResult[]): string {
  const w = results.filter(r => r.raw_score === 2).length
  const d = results.filter(r => r.raw_score === 1).length
  const l = results.filter(r => r.raw_score === 0).length
  const parts: string[] = []
  if (w > 0) parts.push(`${w}W`)
  if (d > 0) parts.push(`${d}D`)
  if (l > 0) parts.push(`${l}L`)
  return parts.join(' ') || 'No results'
}

function sessionYear(session_date: string): number {
  return parseInt(session_date.slice(0, 4), 10)
}

const EVENT_DOMAIN = new Map(EVENTS.map(e => [e.name, e.domainNumber]))


// ── Strongest to weakest ─────────────────────────────────────────────────────
// Answers "what am I good at, what am I bad at" before a single domain is
// opened. Top % is where the player's best sits against everyone in their
// division pool who has played that event, so LOWER is better and the bar is
// drawn from its inverse.
function DomainComparison({ domains }: { domains: DomainPercentile[] }) {
  const rated = domains
    .filter(d => d.topPct != null)
    .sort((a, b) => (a.topPct as number) - (b.topPct as number))
  if (rated.length === 0) return null

  return (
    <div style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: '16px',
      padding: '15px 16px', marginBottom: '18px',
    }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: '11px',
      }}>
        <span style={{
          fontFamily: 'var(--font-label)', textTransform: 'uppercase',
          letterSpacing: '0.14em', fontWeight: 600, fontSize: '11px', color: '#666',
        }}>
          Strongest to weakest
        </span>
        <span style={{
          fontFamily: 'var(--font-label)', textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 600, fontSize: '10px', color: '#444',
        }}>
          Longer = stronger
        </span>
      </div>

      {rated.map(d => {
        const colour = domainColor(d.domainNumber)
        const pct = Math.max(0, Math.min(100, 100 - (d.topPct as number)))
        return (
          <div key={d.domainNumber} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '4px 0' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: colour, flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', color: '#fff', width: '104px', flexShrink: 0 }}>
              {DOMAIN_ORDER[d.domainNumber - 1]}
            </span>
            <div style={{ flexGrow: 1, height: '7px', background: '#171717', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: `${pct}%`, height: '100%', background: colour }} />
            </div>
            <span style={{
              fontFamily: 'var(--font-label)', fontSize: '11px', color: '#888',
              width: '46px', textAlign: 'right', flexShrink: 0,
            }}>
              TOP {d.topPct}%
            </span>
          </div>
        )
      })}

      <div style={{
        fontSize: '11.5px', color: '#555', lineHeight: 1.5, marginTop: '11px',
        paddingTop: '11px', borderTop: '1px solid #1e1e1e',
      }}>
        Top % is where your best sits against everyone in your division pool who
        has played that event. Lower is better.
      </div>
    </div>
  )
}

export default function PRsPage() {
  const router = useRouter()
  const { loading: playerLoading, userId, activePlayerId } = useActivePlayer()
  const [loading, setLoading] = useState(true)
  // Average placement per event. Its own query on purpose: `event_placement`
  // ships in 20260824220633, and selecting a column that does not exist yet
  // returns 42703 and takes the WHOLE results query down — where a separate one
  // just leaves this column blank. Same reasoning as the wins query below.
  const [avgPlace, setAvgPlace] = useState<Record<string, number>>({})
  // Percentiles, for the strongest-to-weakest comparison at the top.
  const [domainPct, setDomainPct] = useState<DomainPercentile[] | null>(null)
  const [results, setResults] = useState<PRResult[]>([])
  const [tab, setTab] = useState<'season' | 'all'>('season')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [expandedDomains, setExpandedDomains] = useState<Set<string>>(new Set())
  // Events this player has WON, keyed by event_name -> how many times.
  // A win is 1st in the unified division pool with a field of at least 3 —
  // that rule is defined once, in the player_event_wins view, and never
  // reimplemented here.
  const [wins, setWins] = useState<Record<string, number>>({})
  // False until the view answers. The view ships in 20260824220633, so if the
  // client is deployed first this stays false and the whole win layer simply
  // does not render, rather than taking the page down with a 42703. Same
  // failure mode CLAUDE.md records for players_public column drift.
  const [winsReady, setWinsReady] = useState(false)

  useEffect(() => {
    if (playerLoading) return
    if (!userId) { router.replace('/play'); return }
    if (!activePlayerId) return
    const load = async () => {
      const user = { id: activePlayerId }
      setLoading(true)

      // Both loads at once. They are separate queries on purpose — folding
      // event_placement into the results select would take the whole page down
      // with a 42703 if it ever went missing — but there is no reason to wait
      // for one before starting the other.
      const [resultsRes, winsRes] = await Promise.all([
        supabase
        .from('results')
        .select(`
          id, score_label, raw_score, difficulty_tier, placement,
          session_events!inner(event_name, domain_number),
          sessions!inner(session_date, is_championship)
        `)
        .eq('player_id', user.id)
        .not('score_label', 'is', null)
        .order('created_at', { ascending: false }),
        supabase
          .from('player_event_wins')
          .select('event_name, wins')
          .eq('player_id', user.id),
      ])

      const { data } = resultsRes
      if (data) {
        const mapped: PRResult[] = (data as any[]).map(r => ({
          id: r.id,
          score_label: r.score_label,
          raw_score: r.raw_score,
          difficulty_tier: r.difficulty_tier,
          placement: r.placement,
          session_date: r.sessions.session_date,
          is_championship: r.sessions.is_championship,
          event_name: r.session_events.event_name,
          domain_number: r.session_events.domain_number,
        }))
        setResults(mapped)
      }

      const { data: winRows, error: winErr } = winsRes
      if (winErr) {
        console.warn('player_event_wins unavailable — win markers hidden', winErr.message)
      } else if (winRows) {
        const m: Record<string, number> = {}
        for (const w of winRows as { event_name: string; wins: number }[]) {
          m[w.event_name] = (m[w.event_name] ?? 0) + Number(w.wins)
        }
        setWins(m)
        setWinsReady(true)
      }

      setLoading(false)
    }
    load()
  }, [playerLoading, userId, activePlayerId, router])

  // Average placement per event — separate and guarded, see above.
  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    supabase
      .from('results')
      .select('event_placement, session_events!inner(event_name)')
      .eq('player_id', activePlayerId)
      .not('event_placement', 'is', null)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('event_placement unavailable — average placement hidden', error.message)
          return
        }
        const sums: Record<string, { n: number; total: number }> = {}
        for (const r of (data ?? []) as any[]) {
          const name = r.session_events?.event_name
          if (!name) continue
          if (!sums[name]) sums[name] = { n: 0, total: 0 }
          sums[name].n += 1
          sums[name].total += Number(r.event_placement)
        }
        const out: Record<string, number> = {}
        for (const [k, v] of Object.entries(sums)) out[k] = v.total / v.n
        setAvgPlace(out)
      })
    return () => { cancelled = true }
  }, [activePlayerId])

  // Domain percentiles for the comparison bars. Reuses the same bundle the
  // dashboard loads — no new per-player queries.
  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    supabase.rpc('stats_bundle').then(({ data, error }) => {
      if (cancelled || error || !data) return
      const b = data as {
        results: RatingResultRow[]; events: RatingEventRow[]; players: RatingPlayerRow[]
      }
      const mine = computePercentiles(b.results as any, b.events, b.players).get(activePlayerId)
      setDomainPct(domainPercentiles(mine, EVENT_DOMAIN))
    })
    return () => { cancelled = true }
  }, [activePlayerId])

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

  // Lifetime and tab-independent: the season tabs filter PBs, but a win is a
  // permanent fact and is what the taniwha crowns will count.
  const totalWins = Object.keys(wins).length
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

  const toggleDomain = (domain: string) => {
    setExpandedDomains(prev => {
      const next = new Set(prev)
      if (next.has(domain)) next.delete(domain)
      else next.add(domain)
      return next
    })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <PlayerTabs />
      {/* Header */}
      <div style={{ background: '#000', borderBottom: '1px solid #1a1a1a', padding: '20px 24px' }}>
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <Link href="/dashboard" style={{ color: '#555', fontSize: '12px', textDecoration: 'none', display: 'block', marginBottom: '8px' }}>
            ← Dashboard
          </Link>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '12px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', color: '#fff', lineHeight: 1 }}>My Events</div>
              {!loading && (
                <div style={{ color: '#555', fontSize: '13px', marginTop: '4px', fontFamily: 'var(--font-body)' }}>
                  {totalPBs} / {totalEvents} events {tab === 'season' ? `in ${CURRENT_YEAR}` : 'all time'}
                </div>
              )}
              {/* "outright" was wrong: ties share a win, by the sport's own
                  rule and by the player_event_wins view. The field-of-three
                  rule is stated here because this is where a player counts
                  their wins and wonders why one is missing. */}
              {!loading && winsReady && (
                <div style={{ color: '#555', fontSize: '12px', marginTop: '6px', fontFamily: 'var(--font-body)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={WIN_CHIP}>WON</span>
                    <span>{totalWins} of {totalEvents} events won, all time</span>
                  </div>
                  <div style={{ color: '#4a4a4a', fontSize: '11.5px', marginTop: '5px', lineHeight: 1.5, maxWidth: '340px' }}>
                    A win counts when you finish first and at least {WIN_MIN_FIELD} players
                    in your division pool played that event.
                  </div>
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
                    fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px',
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
        <div>
          <ViewingAsBanner />
          {domainPct && <DomainComparison domains={domainPct} />}
        </div>
        {loading ? (
          <div style={{ color: '#555', fontSize: '14px', fontFamily: 'var(--font-body)', textAlign: 'center', paddingTop: '48px' }}>Loading your results…</div>
        ) : (
          DOMAIN_ORDER.map((domain, domainIdx) => {
            const domainNumber = domainIdx + 1
            const colour = domainColor(domainNumber)
            const domainEvents = byDomain[domain] || []
            const domainOpen = expandedDomains.has(domain)
            const domainPBs = domainEvents.filter(e => resultsByEvent[e.name]).length
            // Lifetime, and counted from the CURRENT roster's domain membership
            // rather than session_events.domain_number, which records the
            // numbering of the day and was renumbered in June 2026 (and five
            // events changed domain again in August). See the warning in
            // migration 20260824220633 part 6.
            const domainWins = domainEvents.filter(e => wins[e.name]).length

            return (
              <div key={domain}>
                {/* Domain heading — collapsible */}
                <button
                  onClick={() => toggleDomain(domain)}
                  style={{
                    width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '12px', padding: '4px 0',
                    marginBottom: domainOpen ? '10px' : '0', textAlign: 'left',
                  }}
                >
                  <DomainIcon domainName={domain} domainNumber={domainNumber} size={44} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: colour, letterSpacing: '1px', flex: 1 }}>
                    {domainNumber}. {domain.toUpperCase()}
                  </div>
                  {winsReady && domainWins > 0 && (
                    <div style={{ ...WIN_CHIP, flexShrink: 0 }}>
                      {domainWins}/{domainEvents.length} WON
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 700, color: domainPBs > 0 ? colour : '#555', letterSpacing: '0.05em', flexShrink: 0 }}>
                    {domainPBs}/{domainEvents.length}
                  </div>
                  <div style={{ color: colour, fontSize: '16px', flexShrink: 0, transform: domainOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</div>
                </button>

                {domainOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Column headers — without them the three right-hand numbers
                      are unreadable, and a tooltip is no use on a phone. */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: '10px', padding: '2px 14px 4px',
                    fontFamily: 'var(--font-label)', textTransform: 'uppercase',
                    letterSpacing: '0.08em', fontWeight: 600, fontSize: '9px', color: '#555',
                  }}>
                    <span style={{ width: '84px', textAlign: 'right' }}>Personal best</span>
                    <span style={{ width: '38px', textAlign: 'right' }}>Avg</span>
                    <span style={{ width: '30px', textAlign: 'right' }}>Won</span>
                    <span style={{ width: '10px' }} />
                  </div>
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
                          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                            <div style={{ opacity: pb ? 1 : 0.4, flexShrink: 0 }}>
                              <EventIcon slug={event.slug} emoji={event.emoji} domainNumber={domainNumber} size={36} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <div style={{ fontSize: '14px', fontWeight: 600, color: pb ? '#fff' : '#444', fontFamily: 'var(--font-body)' }}>
                                {event.name}
                                {event.hasDifficultyTiers && event.difficultyTiers && (
                                  <span style={{ marginLeft: '8px', fontSize: '11px', color: '#B87DB5', fontFamily: 'var(--font-label)', fontWeight: 700 }}>
                                    D1–D{event.difficultyTiers.length}
                                  </span>
                                )}
                              </div>
                              {pb && (
                                <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  {event.inputMode}
                                </div>
                              )}
                            </div>
                          </div>

                          {/* PR, average placement and wins side by side. A lens
                              toggle would hide two thirds of the answer behind a
                              tap, and all three fit at 375px. */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <div style={{ textAlign: 'right', width: '84px' }}>
                              {pb ? (
                                <>
                                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#4DB26E', fontFamily: 'var(--font-body)' }}>
                                    {event.inputMode === 'sport' ? sportWDL(eventResults) : pb.score_label}
                                  </div>
                                  {pb.difficulty_tier && event.inputMode !== 'sport' && (
                                    <div style={{ fontSize: '11px', color: '#B87DB5', fontFamily: 'var(--font-label)', fontWeight: 700 }}>
                                      {pb.difficulty_tier}
                                    </div>
                                  )}
                                </>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#333', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>
                                  NOT PLAYED
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', width: '38px', fontSize: '13px', color: avgPlace[event.name] != null ? '#999' : '#333', fontFamily: 'var(--font-body)' }}>
                              {avgPlace[event.name] != null ? avgPlace[event.name].toFixed(1) : '—'}
                            </div>
                            <div style={{ textAlign: 'right', width: '30px', fontSize: '13px', fontWeight: 600, color: wins[event.name] ? '#F9B051' : '#333', fontFamily: 'var(--font-body)' }}>
                              {winsReady ? (wins[event.name] ?? 0) : '—'}
                            </div>
                            <div style={{ color: '#333', fontSize: '14px', width: '10px', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                              {pb ? '›' : ''}
                            </div>
                          </div>
                        </button>

                        {/* Expanded history */}
                        {isExpanded && pb && (
                          <div style={{ borderTop: '1px solid #1e1e1e', padding: '8px 14px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                              <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                {event.inputMode === 'sport' ? `${eventResults.length} match${eventResults.length !== 1 ? 'es' : ''}` : `All results — ${eventResults.length} session${eventResults.length !== 1 ? 's' : ''}`}
                              </div>
                              {event.inputMode === 'sport' && (
                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#4DB26E', letterSpacing: '0.05em' }}>
                                  {sportWDL(eventResults)}
                                </div>
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {eventResults.map((r, i) => {
                                const isBest = i === 0
                                const date = formatNZDate(r.session_date)
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
                                          fontFamily: 'var(--font-label)', fontSize: '10px', fontWeight: 700,
                                          color: colour, background: colour + '22', border: `1px solid ${colour}44`,
                                          padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em', textTransform: 'uppercase',
                                        }}>PB</div>
                                      )}
                                      <div style={{ fontSize: '12px', color: '#555', fontFamily: 'var(--font-body)' }}>{date}</div>
                                      {r.is_championship && (
                                        <div style={{ fontFamily: 'var(--font-label)', fontSize: '10px', fontWeight: 700, color: '#F9B051', background: '#F9B05122', border: '1px solid #F9B05144', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em' }}>
                                          CHAMP
                                        </div>
                                      )}
                                      {r.difficulty_tier && (
                                        <div style={{ fontFamily: 'var(--font-label)', fontSize: '10px', fontWeight: 700, color: '#B87DB5', background: '#B87DB522', border: '1px solid #B87DB544', padding: '2px 6px', borderRadius: '4px' }}>
                                          {r.difficulty_tier}
                                        </div>
                                      )}
                                    </div>
                                    <div style={{ fontSize: '14px', fontWeight: isBest ? 700 : 400, color: isBest ? '#4DB26E' : '#888', fontFamily: 'var(--font-body)' }}>
                                      {r.score_label}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            <Link
                              href={`/events/${event.slug}`}
                              style={{ display: 'block', marginTop: '10px', fontSize: '12px', color: '#2371BB', fontFamily: 'var(--font-body)', textDecoration: 'none' }}
                            >
                              View event details →
                            </Link>
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
    </div>
  )
}
