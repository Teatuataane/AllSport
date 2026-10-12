'use client'

import PRBoardView from '@/components/play/PRBoardView'
import EventStandards from '@/components/play/EventStandards'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { eventRecordsSport, sportRecord } from '@/lib/scoring'
import { loggedBestRows, trainingDistanceRows, nzDay, type LoggedBestEntry, type DistanceDone } from '@/lib/workouts'
import { useActivePlayer } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import { EVENTS, DOMAIN_ORDER, getEventsByDomain, type EventData } from '@/lib/eventData'
import { WIN_MIN_FIELD } from '@/lib/rating'
import { formatNZDate } from '@/lib/dates'
import DomainIcon from '@/components/DomainIcon'
import EventIcon from '@/components/EventIcon'
import { ColourCircle } from '@/components/GradesCard'
import { loadGradeState, type GradeState } from '@/lib/loadGrades'
import { shownDomainRungs } from '@/lib/colourDisplay'
import { gradeForRung, gradeInk, MIN_RATED_GAMES } from '@/lib/grading'
import { STANDARDS } from '@/lib/standards'
import { NEUTRAL_ICON_TINT } from '@/lib/scoreColour'

const supabase = createClient()


// The NZ year at render time: every date on this page is an NZ day, and a
// device clock in another zone (or a page left open over New Year) would file
// a result under the wrong tab.
const currentYear = () => parseInt(nzDay().slice(0, 4), 10)

// White, not gold. It was amber, which since the colours rework is Karaka: on
// a page where colour means a colour earned, a gold WON read as one. A filled
// white pill still reads as an honour without claiming a colour.
const WIN_CHIP: React.CSSProperties = {
  fontFamily: 'var(--font-label)',
  fontSize: '10px',
  fontWeight: 700,
  letterSpacing: '0.08em',
  color: '#fff',
  background: '#ffffff14',
  border: '1px solid #ffffff55',
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
  /** A best effort from a logged workout rather than an official game. */
  logged?: boolean
  witnessed?: boolean
} & DistanceDone

// Marks a logged best wherever it appears, so a PR set alone is never mistaken
// for one set in front of a kaiwhakawā at a game.
// Neutral grey, NOT the purple of the tier chip it sits beside, or the two read
// as the same kind of label.
const LOGGED_CHIP: React.CSSProperties = {
  fontFamily: 'var(--font-label)', fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
  color: '#bbb', background: 'transparent', border: '1px solid #666',
  borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap',
}

function effectiveScore(r: PRResult): number {
  return r.raw_score
}

// A W/D/L record used to mean inputMode 'sport' with raw_score literally 0/1/2.
// Since Sept 2026 most of them sit on a `Game` rung of a tiered ladder, where the
// result is the within-tier term of a banded score. lib/scoring.ts owns the rule
// so this file cannot drift from the live session again.
function sportWDL(eventData: EventData | undefined, results: PRResult[]): string {
  return sportRecord(eventData, results) ?? 'No results'
}

// The PB cell on an event topped by a Game rung shows the win/draw/loss record,
// but a player who has only done its DRILLS has no record to show. Fall back to
// the best score rather than claiming "No results" beside a real PB. Logging
// makes drill-only events common: a logged workout never records a game.
function pbText(eventData: EventData | undefined, results: PRResult[], pb: PRResult): string {
  return (eventRecordsSport(eventData) ? sportRecord(eventData, results) : null) ?? pb.score_label
}

function sessionYear(session_date: string): number {
  return parseInt(session_date.slice(0, 4), 10)
}

// How many of an event's results its row shows before "Show all".
const TOP_SHOWN = 3

// The colour line in an open event row: the colour the standards give its
// best effort, or why it has none. The same reasons, in the same order, as
// the event list under a domain on HOME (GradesCard), so the two never
// disagree about one event.
function EventColour({ state, event, yearTab }: { state: GradeState; event: EventData; yearTab: boolean }) {
  const eg = state.grades.events.get(event.slug)
  if (!eg) return null
  const g = gradeForRung(eg.rung)
  const why = state.exemptions.has(event.slug)
    ? 'Exempt'
    : eg.bodyweightBlocked
      ? 'Needs bodyweight: declare it on the scoring screen'
      : STANDARDS[event.slug]?.kind === 'rating' && eg.rung === 0
        ? `Colours come after ${MIN_RATED_GAMES} rated games`
        : !eg.gradeable
          ? 'No colour standard'
          : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 10px' }}>
      <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        Colour
      </span>
      {why ? (
        <span style={{ fontSize: '13px', color: '#999' }}>{why}</span>
      ) : (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: eg.rung ? gradeInk(g) : '#999',
        }}>
          <ColourCircle rung={eg.rung} size={14} /> {eg.rung ? g.name : 'No colour yet'}
        </span>
      )}
      {/* A half step: the load of the next colour, short of its other key.
          It counts in the domain average, never as a colour (v0.33.0.0). */}
      {!why && eg.credit != null && eg.credit > eg.rung && (
        <span style={{ fontSize: '12px', color: '#999' }}>
          + half a step toward {gradeForRung(Math.ceil(eg.credit)).name}
        </span>
      )}
      {/* The scores below follow the year tab; the colour, for now, is graded
          on every result, as HOME grades it. Said here so the two never look
          like they disagree. Goes when colours become yearly (Tāne, 13 Oct
          2026: colours are earned per calendar year; not built yet). */}
      {yearTab && (
        <span style={{ width: '100%', fontSize: '11.5px', color: '#666' }}>From all your results, not only this year&apos;s</span>
      )}
    </div>
  )
}

export default function PRsPage() {
  const router = useRouter()
  const { loading: playerLoading, userId, activePlayerId } = useActivePlayer()
  const [loading, setLoading] = useState(true)
  // The "Avg" place column is gone (13 Oct 2026): it averaged places across
  // games of very different sizes, so it said little. Places themselves stay
  // on the game report.
  // Colours, computed exactly as HOME computes them. Keyed by the player it
  // was loaded for, like `logged`. A failed load settles as null: the page
  // still works, it just paints nothing in a colour.
  const [grades, setGrades] = useState<{ id: string; state: GradeState | null } | null>(null)
  // Events whose whole history is open, past the top three.
  const [showAll, setShowAll] = useState<Set<string>>(new Set())
  // Keyed by the player it was loaded for, like `logged`, so a slow response
  // for the previous player can never mix into this one's page.
  const [gameLoaded, setGameLoaded] = useState<{ id: string; rows: PRResult[] } | null>(null)
  const [tab, setTab] = useState<'season' | 'all'>('season')
  // Hide events with nothing on the chosen tab. Each domain lists 13 to 16
  // events, and most players have played a few of each.
  const [playedOnly, setPlayedOnly] = useState(false)
  const [winHelp, setWinHelp] = useState(false)
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
  // Best efforts from logged workouts (decision 16 of workout logging): shown
  // here, marked, and never in any public ranking. Keyed by the player they
  // were loaded for, so a switch never shows the previous player's logs.
  const [logged, setLogged] = useState<{ id: string; rows: PRResult[]; training: ReturnType<typeof trainingDistanceRows> } | null>(null)

  useEffect(() => {
    if (playerLoading) return
    if (!userId) { router.replace('/play'); return }
    if (!activePlayerId) return
    let cancelled = false
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
          id, score_label, raw_score, difficulty_tier, placement, distance_m, time_seconds, weight_kg,
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

      if (cancelled) return
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
          distance_m: r.distance_m, time_seconds: r.time_seconds, weight_kg: r.weight_kg,
        }))
        setGameLoaded({ id: user.id, rows: mapped })
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
    return () => { cancelled = true }
  }, [playerLoading, userId, activePlayerId, router])

  // Logged bests — their own query, like every workout read. A missing table
  // (before the migration) or an RLS refusal simply shows no logged bests.
  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    supabase
      .from('workout_entries')
      .select('id, event_slug, raw_score, score_label, difficulty_tier, distance_m, time_seconds, weight_kg, workouts!inner(player_id, performed_on, witnessed)')
      .eq('workouts.player_id', activePlayerId)
      // A distance effort with no raw_score is training under the reference
      // distance: never a PB here, but still a record at its own distance.
      .or('raw_score.not.is.null,distance_m.not.is.null')
      // Best first: the server caps a response at 1000 rows, so if a player
      // ever passes that it is the weakest efforts that fall off, not a random set.
      .order('raw_score', { ascending: false, nullsFirst: false })
      .range(0, 4999)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          console.warn('workout_entries unavailable — logged bests hidden', error.message)
          setLogged({ id: activePlayerId, rows: [], training: [] })
          return
        }
        const entries = (data ?? []) as unknown as LoggedBestEntry[]
        const rows = loggedBestRows(entries).map(r => ({
          ...r, placement: null, is_championship: false, logged: true,
        }))
        setLogged({ id: activePlayerId, rows, training: trainingDistanceRows(entries) })
      })
    return () => { cancelled = true }
  }, [activePlayerId])

  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    loadGradeState(supabase, activePlayerId)
      .then(st => { if (!cancelled) setGrades({ id: activePlayerId, state: st }) })
      .catch(() => { if (!cancelled) setGrades({ id: activePlayerId, state: null }) })
    return () => { cancelled = true }
  }, [activePlayerId])

  const byDomain = getEventsByDomain()
  // Game results first, so a logged effort that only TIES a game result never
  // displaces it as the PB (the sort below is stable).
  const CURRENT_YEAR = currentYear()
  const gameRows = gameLoaded && gameLoaded.id === activePlayerId ? gameLoaded.rows : []
  const loggedRows = logged && logged.id === activePlayerId ? logged.rows : []
  const trainingRows = logged && logged.id === activePlayerId ? logged.training : []
  const allResults = [...gameRows, ...loggedRows]
  const visibleResults = tab === 'season'
    ? allResults.filter(r => sessionYear(r.session_date) === CURRENT_YEAR)
    : allResults

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
  // permanent fact.
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

  // Short distance efforts on the chosen tab: never a PB, still a record.
  const trainingFor = (name: string) =>
    trainingRows.filter(t => t.event_name === name && (tab !== 'season' || sessionYear(t.session_date) === CURRENT_YEAR))

  const toggleShowAll = (slug: string) => {
    setShowAll(prev => {
      const next = new Set(prev)
      if (next.has(slug)) next.delete(slug)
      else next.add(slug)
      return next
    })
  }

  const gradeState = grades && grades.id === activePlayerId ? grades.state : null
  // The colour SHOWN per domain, by HOME's own rule (conferred once grading
  // is live), so the two pages can never disagree.
  const domainRungs = gradeState ? shownDomainRungs(gradeState) : null

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
            ← Home
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
                    <button
                      type="button"
                      onClick={() => setWinHelp(o => !o)}
                      aria-expanded={winHelp}
                      aria-label="How a win counts"
                      style={{
                        width: '20px', height: '20px', borderRadius: '50%', border: '1px solid #444',
                        background: 'none', color: '#888', fontSize: '11px', fontWeight: 700,
                        cursor: 'pointer', padding: 0, lineHeight: 1, flexShrink: 0,
                      }}
                    >?</button>
                  </div>
                  {/* Behind a tap since 13 Oct 2026: it was read once and then
                      sat at the top of every visit. */}
                  {winHelp && (
                    <div style={{ color: '#777', fontSize: '11.5px', marginTop: '5px', lineHeight: 1.5, maxWidth: '340px' }}>
                      A win counts when you finish first and at least {WIN_MIN_FIELD} players
                      in your division pool played that event.
                    </div>
                  )}
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
          {!loading && (
            <button
              type="button"
              onClick={() => setPlayedOnly(p => !p)}
              aria-pressed={playedOnly}
              style={{
                padding: '6px 12px', borderRadius: '6px', cursor: 'pointer',
                fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px',
                letterSpacing: '0.08em', textTransform: 'uppercase',
                border: `1px solid ${playedOnly ? '#fff' : '#333'}`,
                background: playedOnly ? '#fff' : 'transparent',
                color: playedOnly ? '#000' : '#888',
              }}
            >
              Played only
            </button>
          )}
        </div>
        {loading ? (
          <div style={{ color: '#555', fontSize: '14px', fontFamily: 'var(--font-body)', textAlign: 'center', paddingTop: '48px' }}>Loading your results…</div>
        ) : (
          DOMAIN_ORDER.map((domain, domainIdx) => {
            const domainNumber = domainIdx + 1
            // Painted in the colour held, not the domain's own hue: on this
            // page colour means a colour earned, as it does on HOME. Mā (or
            // grades not loaded yet) stays plain white.
            const domainRung = domainRungs?.get(domainNumber) ?? 0
            const domainGrade = gradeForRung(domainRung)
            const domainInk = domainRung ? gradeInk(domainGrade) : '#fff'
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
                  <DomainIcon domainName={domain} domainNumber={domainNumber} size={44} tint={NEUTRAL_ICON_TINT} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: domainInk, letterSpacing: '1px' }}>
                      {domain.toUpperCase()}
                    </div>
                    {domainRungs && (
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px',
                        fontFamily: 'var(--font-label)', fontSize: '11px', fontWeight: 700,
                        letterSpacing: '0.08em', textTransform: 'uppercase', color: domainRung ? '#bbb' : '#666',
                      }}>
                        <ColourCircle rung={domainRung} size={10} /> {domainGrade.name}
                      </div>
                    )}
                  </div>
                  {winsReady && domainWins > 0 && (
                    <div style={{ ...WIN_CHIP, flexShrink: 0 }}>
                      {domainWins}/{domainEvents.length} WON
                    </div>
                  )}
                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 700, color: domainPBs > 0 ? '#999' : '#555', letterSpacing: '0.05em', flexShrink: 0 }}>
                    {domainPBs}/{domainEvents.length}
                  </div>
                  <div style={{ color: '#777', fontSize: '16px', flexShrink: 0, transform: domainOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</div>
                </button>

                {domainOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {/* Column headers — without them the right-hand numbers
                      are unreadable, and a tooltip is no use on a phone. */}
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                    gap: '10px', padding: '2px 14px 4px',
                    fontFamily: 'var(--font-label)', textTransform: 'uppercase',
                    letterSpacing: '0.08em', fontWeight: 600, fontSize: '10px', color: '#777',
                  }}>
                    <span style={{ width: '84px', textAlign: 'right' }}>Personal best</span>
                    <span style={{ width: '30px', textAlign: 'right' }}>Won</span>
                    <span style={{ width: '10px' }} />
                  </div>
                  {playedOnly && !domainEvents.some(e => resultsByEvent[e.name] || trainingFor(e.name).length > 0) && (
                    <div style={{ fontSize: '13px', color: '#666', padding: '4px 14px 8px' }}>
                      Nothing played {tab === 'season' ? `in ${CURRENT_YEAR}` : 'yet'}
                    </div>
                  )}
                  {domainEvents.map(event => {
                    const eventResults: PRResult[] | undefined = resultsByEvent[event.name]
                    const pb = eventResults?.[0]
                    // Short distance efforts never rank, so they are no PB, but
                    // they are records at their distance: an event with only
                    // those still opens to show them.
                    const training = trainingFor(event.name)
                    const played = !!pb || training.length > 0
                    if (playedOnly && !played) return null
                    const isExpanded = expanded.has(event.slug)
                    const eventRung = gradeState?.grades.events.get(event.slug)?.rung ?? 0
                    const allOpen = showAll.has(event.slug)
                    const listed = allOpen ? (eventResults ?? []) : (eventResults ?? []).slice(0, TOP_SHOWN)

                    return (
                      <div
                        key={event.slug}
                        style={{
                          background: '#111', border: `1px solid ${played ? '#262626' : '#1a1a1a'}`,
                          borderRadius: '8px', overflow: 'hidden',
                        }}
                      >
                        {/* Event row */}
                        <button
                          onClick={() => { if (played) toggleExpanded(event.slug) }}
                          style={{
                            width: '100%', background: 'transparent', border: 'none',
                            padding: '11px 14px', cursor: played ? 'pointer' : 'default',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            textAlign: 'left',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '11px', minWidth: 0 }}>
                            <div style={{ opacity: played ? 1 : 0.4, flexShrink: 0 }}>
                              <EventIcon slug={event.slug} emoji={event.emoji} domainNumber={domainNumber} size={36} tint={NEUTRAL_ICON_TINT} />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '14px', fontWeight: 600, color: played ? '#fff' : '#444', fontFamily: 'var(--font-body)' }}>
                                {event.name}
                                {/* The event's colour, lifetime: it does not
                                    follow the season tab, because a colour is
                                    held, not seasonal. */}
                                {eventRung > 0 && <ColourCircle rung={eventRung} size={10} />}
                              </div>
                            </div>
                          </div>

                          {/* PB and wins side by side. */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                            <div style={{ textAlign: 'right', width: '84px' }}>
                              {pb ? (
                                <>
                                  <div style={{ fontSize: '15px', fontWeight: 700, color: '#fff', fontFamily: 'var(--font-body)' }}>
                                    {pbText(event, eventResults, pb)}
                                  </div>
                                  {pb.difficulty_tier && !(eventRecordsSport(event) && sportRecord(event, eventResults)) && (
                                    <div style={{ fontSize: '11px', color: '#999', fontFamily: 'var(--font-label)', fontWeight: 700 }}>
                                      {pb.difficulty_tier}
                                    </div>
                                  )}
                                  {pb.logged && (
                                    <div style={{ marginTop: '3px' }}><span style={LOGGED_CHIP}>LOGGED</span></div>
                                  )}
                                </>
                              ) : training.length > 0 ? (
                                <span style={{ fontSize: '11px', color: '#777', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>
                                  TRAINING
                                </span>
                              ) : (
                                <span style={{ fontSize: '11px', color: '#333', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>
                                  NOT PLAYED
                                </span>
                              )}
                            </div>
                            <div style={{ textAlign: 'right', width: '30px', fontSize: '13px', fontWeight: 600, color: wins[event.name] ? '#fff' : '#333', fontFamily: 'var(--font-body)' }}>
                              {winsReady ? (wins[event.name] ?? 0) : '—'}
                            </div>
                            <div style={{ color: '#333', fontSize: '14px', width: '10px', transform: isExpanded ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>
                              {played ? '›' : ''}
                            </div>
                          </div>
                        </button>

                        {/* Expanded: the colour this event holds, then the
                            top three (Tāne, 13 Oct 2026), the rest a tap away.
                            The best per level used to list every level of the
                            ladder, twelve rows on some events, which buried
                            the scores; distance events keep their records per
                            distance, which are records nothing else shows. */}
                        {isExpanded && played && (
                          <div style={{ borderTop: '1px solid #1e1e1e', padding: '10px 14px 12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {gradeState && <EventColour state={gradeState} event={event} yearTab={tab === 'season'} />}
                            {eventResults && (
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                                  <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                    {eventResults.length > TOP_SHOWN && !allOpen
                                      ? `Top ${TOP_SHOWN} of ${eventResults.length} results`
                                      : `${eventResults.length} result${eventResults.length !== 1 ? 's' : ''}`}
                                  </div>
                                  {eventRecordsSport(event) && sportRecord(event, eventResults) && (
                                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#fff', letterSpacing: '0.05em' }}>
                                      {sportWDL(event, eventResults)}
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                                  {listed.map((r, i) => {
                                    const isBest = i === 0
                                    return (
                                      <div
                                        key={r.id}
                                        style={{
                                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px',
                                          padding: '8px 10px', borderRadius: '6px',
                                          background: isBest ? '#181818' : '#0a0a0a',
                                          border: `1px solid ${isBest ? '#333' : '#1a1a1a'}`,
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 8px' }}>
                                          <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', fontWeight: 700, color: isBest ? '#fff' : '#777', minWidth: '22px' }}>
                                            {isBest ? 'PB' : `#${i + 1}`}
                                          </span>
                                          <div style={{ fontSize: '12px', color: '#777', fontFamily: 'var(--font-body)' }}>{formatNZDate(r.session_date)}</div>
                                          {r.logged && (
                                            <span style={LOGGED_CHIP}>{r.witnessed ? 'LOGGED · WITNESSED' : 'LOGGED'}</span>
                                          )}
                                          {r.is_championship && (
                                            <div style={{ fontFamily: 'var(--font-label)', fontSize: '10px', fontWeight: 700, color: '#fff', background: '#ffffff14', border: '1px solid #ffffff55', padding: '2px 6px', borderRadius: '4px', letterSpacing: '0.05em' }}>
                                              CHAMP
                                            </div>
                                          )}
                                          {r.difficulty_tier && (
                                            <span style={{ fontFamily: 'var(--font-label)', fontSize: '10px', fontWeight: 700, color: '#bbb', border: '1px solid #444', padding: '2px 6px', borderRadius: '4px' }}>
                                              {r.difficulty_tier}
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ fontSize: '14px', fontWeight: isBest ? 700 : 400, color: isBest ? '#fff' : '#aaa', fontFamily: 'var(--font-body)', textAlign: 'right' }}>
                                          {r.score_label}
                                        </div>
                                      </div>
                                    )
                                  })}
                                </div>
                                {eventResults.length > TOP_SHOWN && (
                                  <button
                                    type="button"
                                    onClick={() => toggleShowAll(event.slug)}
                                    style={{
                                      marginTop: '6px', background: 'none', border: 'none', padding: '6px 0', cursor: 'pointer',
                                      fontFamily: 'var(--font-label)', fontSize: '11px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase',
                                    }}
                                  >
                                    {allOpen ? `Show top ${TOP_SHOWN}` : `Show all ${eventResults.length}`}
                                  </button>
                                )}
                              </div>
                            )}
                            {(event.recordDistances?.length ?? 0) > 0 && (
                              <div>
                                <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', color: '#777', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>
                                  Best at each distance
                                </div>
                                <PRBoardView
                                  ev={event}
                                  colour="#bbbbbb"
                                  showAllLevels
                                  rows={[
                                    ...(eventResults ?? []),
                                    ...training.map(t => ({ ...t, placement: null, is_championship: false, logged: true })),
                                  ].map(r => ({
                                    id: r.id, raw_score: r.raw_score, score_label: r.score_label,
                                    difficulty_tier: r.difficulty_tier, date: r.session_date,
                                    source: r.logged ? (r.witnessed ? 'witnessed' : 'logged') : 'game',
                                    distance_m: r.distance_m, time_seconds: r.time_seconds, weight_kg: r.weight_kg,
                                  }))}
                                />
                              </div>
                            )}
                            {activePlayerId && (
                              <EventStandards ev={event} playerId={activePlayerId} today={nzDay()} rows={(eventResults ?? []).map(r => ({ raw_score: r.raw_score, weight_kg: r.weight_kg ?? null, difficulty_tier: r.difficulty_tier }))} />
                            )}
                            <Link
                              href={`/events/${event.slug}`}
                              style={{ display: 'block', fontSize: '12px', color: '#5A9BE0', fontFamily: 'var(--font-body)', textDecoration: 'none' }}
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
