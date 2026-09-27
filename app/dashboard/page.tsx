'use client'

// ─── HOME ────────────────────────────────────────────────────────────────────
// Player first (redesigned with Tāne 2026-09-28). Top to bottom:
//
//   0  a running game's JOIN card, only while one is on
//   1  identity: the avatar ringed in your overall colour, name, division, and
//      one line of numbers (games · events won · games won · PRs)
//   2  the next session as one slim line, when no game is on
//   3  YOUR COLOURS (components/GradesCard.tsx)
//   4  one row of links: Log a workout · My events · Play history
//
// The colours radar and the four stat tiles are gone: the radar repeated the
// domain list and the tiles became the line under your name. The Colours guide
// is the COLOURS tab, so HOME does not link it.

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import { nextScheduledSession } from '@/lib/schedule'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import GradesCard from '@/components/GradesCard'
import { ColourAvatar, GameOnCard, NextSessionLine, HomeLink } from '@/components/HomeParts'
import { loadGradeState, type GradeState } from '@/lib/loadGrades'
import { useNewColours } from '@/lib/useNewColours'
import NewColourCard from '@/components/NewColourCard'
import VoteCard from '@/app/components/VoteCard'
import WellbeingSurvey from '@/app/components/WellbeingSurvey'
import { bestEventByColour, shownOverallRung } from '@/lib/colourDisplay'
import {
  sessionWins,
  type RatingResultRow, type RatingEventRow, type RatingSessionRow, type RatingPlayerRow,
} from '@/lib/rating'
import { computePercentiles } from '@/lib/percentile'

const supabase = createClient()


type StatsBundle = {
  results: (RatingResultRow & { placement: number | null })[]
  events: RatingEventRow[]
  sessions: RatingSessionRow[]
  players: RatingPlayerRow[]
}

type HouseholdBundle = {
  counts: { player_id: string; games: number; prs: number }[]
}

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    loading: playerLoading, userId, self, familyMembers, activePlayerId, activePlayer,
  } = useActivePlayer()

  const [household, setHousehold] = useState<HouseholdBundle | null>(null)
  const [stats, setStats] = useState<StatsBundle | null>(null)
  const [grades, setGrades] = useState<GradeState | null>(null)
  const [eventsWon, setEventsWon] = useState<number | null>(null)
  const [activeSession, setActiveSession] = useState<any>(null)
  // Only the QR link's ?code= joins by code now; nobody types one.
  const [joinError, setJoinError] = useState('')

  const isJudge = self?.role === 'judge'

  useEffect(() => {
    if (!playerLoading && !userId) router.push('/play')
  }, [playerLoading, userId, router])

  // ── The household, in one round trip ────────────────────────────────────────
  // Parent AND every child at once, so switching tabs is pure state. See the
  // header of 20260826004819 for why this is one call and not four per player.
  const householdIds = useMemo(
    () => (userId ? [userId, ...familyMembers.map(m => m.id)] : []),
    [userId, familyMembers],
  )

  useEffect(() => {
    if (householdIds.length === 0) return
    let cancelled = false
    const load = async () => {
      const { data, error } = await supabase.rpc('player_dashboard', { p_player_ids: householdIds })
      if (cancelled) return
      if (error) { console.warn('player_dashboard unavailable', error.message); return }
      setHousehold(data as HouseholdBundle)
    }
    load()
    return () => { cancelled = true }
    // Keyed on the ids themselves, not the array identity, so a re-render of the
    // hook does not refire the request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdIds.join(',')])

  // ── Percentiles. One shared dataset for every player on the page. ───────────
  useEffect(() => {
    let cancelled = false
    supabase.rpc('stats_bundle').then(({ data, error }) => {
      if (cancelled || error || !data) return
      setStats(data as StatsBundle)
    })
    return () => { cancelled = true }
  }, [])

  // ── Grades. Their OWN queries, never folded into the bundle above. ──────────
  // lib/loadGrades.ts reads every source separately, so a missing grading table
  // returns PGRST205 there and the rest of this page is untouched.
  // `gradesNonce` is what the recheck bumps when the server confers something,
  // so the card below describes rows that are actually in the database.
  const [gradesNonce, setGradesNonce] = useState(0)
  const reloadGrades = useCallback(() => setGradesNonce(n => n + 1), [])
  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    setGrades(null)
    loadGradeState(supabase, activePlayerId).then(s => { if (!cancelled) setGrades(s) })
    return () => { cancelled = true }
  }, [activePlayerId, gradesNonce])

  const newColours = useNewColours(activePlayerId, grades, reloadGrades)

  // ── Events won: the player_event_wins view, which /prs reads too. ──────────
  // The >= 3 field rule lives in the view. It used to arrive through the taniwha
  // loader, but a win is not a taniwha thing and outlives it.
  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    setEventsWon(null)
    supabase.from('player_event_wins').select('event_name, wins').eq('player_id', activePlayerId)
      .then(({ data, error }) => {
        if (cancelled || error) return
        setEventsWon((data ?? []).filter((w: { wins: number }) => Number(w.wins) > 0).length)
      })
    return () => { cancelled = true }
  }, [activePlayerId])

  // ── Is a game running right now? ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    // One check at a time: an interval tick and a tab coming back can overlap,
    // and a slow older answer must not land after a newer one.
    let running = false
    const check = async () => {
      if (running) return
      running = true
      try {
        await supabase.rpc('close_expired_sessions')
        const { data, error } = await supabase.from('sessions').select('*').eq('is_active', true).maybeSingle()
        // A failed poll keeps the last known answer: one flaky request must not
        // take the JOIN button away mid-game.
        if (!cancelled && !error) setActiveSession(data ?? null)
      } finally {
        running = false
      }
    }
    check()
    // The JOIN button is now the only way in from HOME (no code box), so a
    // player who opened the page before the game started must see it appear
    // without reloading: re-check on an interval and when the tab comes back.
    // Hidden tabs skip the poll; visibilitychange catches them up on return.
    const timer = setInterval(() => { if (document.visibilityState === 'visible') check() }, 30_000)
    const onVisible = () => { if (document.visibilityState === 'visible') check() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [userId])

  // Silent auto-join from the QR code. The typed code box is gone (home
  // colours rework, 24 September 2026): a running game gets one JOIN button.
  useEffect(() => {
    const code = searchParams.get('code')
    if (code && userId) handleJoinByCode(code.toUpperCase())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, userId])

  const handleJoinByCode = async (code: string) => {
    setJoinError('')
    const { data: sess, error } = await supabase
      .from('sessions')
      .select('id, session_code, is_active, location')
      // .eq, not .ilike — ILIKE treats the code as a PATTERN, so `?code=%`
      // matched every session that ever had one.
      .eq('session_code', code)
      .maybeSingle()
    if (error) { setJoinError(`Session lookup failed: ${error.message}`); return }
    if (!sess) { setJoinError(`No session found with code "${code}". Ask the Kaiwhakawā to confirm it.`); return }
    if (!sess.is_active) { setJoinError(`Session "${code}" has ended.`); return }
    window.location.href = `/scoring/${sess.id}`
  }

  // ── Derived ─────────────────────────────────────────────────────────────────
  const counts = household?.counts.find(c => c.player_id === activePlayerId) ?? null

  const derived = useMemo(() => {
    if (!stats || !activePlayerId) return null
    const allPct = computePercentiles(stats.results, stats.events, stats.players)
    const minePct = allPct.get(activePlayerId)
    const myRows = stats.results.filter(r => r.player_id === activePlayerId)
    const eventPct = new Map<string, number | null>()
    for (const [name, ep] of minePct ?? []) eventPct.set(name, ep.topPct)
    return {
      eventPct,
      gamesWon: sessionWins(myRows).get(activePlayerId) ?? 0,
    }
  }, [stats, activePlayerId])

  // The overall colour, by the same rule the colours card uses, so the avatar
  // ring and the card can never disagree. Null until grades load.
  const overallRung = grades ? shownOverallRung(grades) : null

  const bestEvent = useMemo(
    () => (grades ? bestEventByColour(grades.grades.events, derived?.eventPct) : null),
    [grades, derived],
  )

  if (playerLoading) {
    return (
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555' }}>Loading…</div>
      </div>
    )
  }

  if (!activePlayer) {
    return (
      <div style={{
        minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexDirection: 'column', gap: 16,
      }}>
        <div style={{ color: '#555' }}>No player profile found.</div>
        <Link href="/register" style={{ color: 'var(--blue)' }}>Complete registration</Link>
      </div>
    )
  }

  const nextSession = nextScheduledSession()
  // `household` is null while the RPC is in flight, and "no data yet" must not
  // be mistaken for "no games ever" — otherwise every returning player gets a
  // flash of the first-run screen before their real stats arrive.
  const householdLoaded = household !== null
  const hasPlayed = (counts?.games ?? 0) > 0
  const firstRun = householdLoaded && !hasPlayed

  const game = activeSession ? { id: activeSession.id, location: activeSession.location ?? null } : null

  return (
    <>
      <PlayerTabs />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px 40px', color: 'var(--white)' }}>
        <ViewingAsBanner />

        {/* ── 0. A running game is the one action that outranks you ────────── */}
        {game && <GameOnCard game={game} isJudge={isJudge} error={joinError} />}

        {/* ── 1. Identity ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <ColourAvatar
            rung={overallRung}
            icon={activePlayer.icon}
            initial={playerLabel(activePlayer).charAt(0).toUpperCase()}
          />
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 32,
              letterSpacing: '0.05em', lineHeight: 1,
            }}>
              {playerLabel(activePlayer).toUpperCase()}
            </div>
            <div style={{
              fontFamily: 'var(--font-label)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: 600, fontSize: 12,
              color: 'var(--text-muted)', marginTop: 3,
            }}>
              {activePlayer.division ?? 'No division'}{isJudge && activePlayerId === userId ? ' · Kaiwhakawā' : ''}
            </div>
            {householdLoaded && hasPlayed && (
              <div style={{ fontSize: 12.5, color: 'var(--grey-light)', marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>
                <Num value={counts?.games} /> games · <Num value={eventsWon} /> events won
                {' · '}<Num value={derived?.gamesWon} /> games won · <Num value={counts?.prs} /> PRs
              </div>
            )}
          </div>
        </div>

        {/* ── 2. When the next game is, when none is running ───────────────── */}
        {game ? <div style={{ height: 18 }} /> : (
          <NextSessionLine nextSession={nextSession} firstRun={firstRun} error={joinError} />
        )}

        {!game && userId && <VoteCard userId={userId} isJudge={isJudge} />}

        {/* ── 3. Colours ──────────────────────────────────────────────────── */}
        <NewColourCard awards={newColours.unseen} withdrawn={newColours.withdrawn} onDismiss={newColours.dismiss} />
        {grades ? <GradesCard state={grades} bestEvent={bestEvent} /> : (
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
            height: 220, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444',
          }}>
            Loading…
          </div>
        )}

        {/* A player with no games gets what will fill the page, not zeros. */}
        {firstRun && <FirstRunPanel />}

        {/* ── 4. Everything else is one row of links, all alike ────────────── */}
        <nav aria-label="More from HOME" style={{
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8,
        }}>
          <HomeLink href="/workout/new">Log a workout</HomeLink>
          <HomeLink href="/prs">My events</HomeLink>
          <HomeLink href="/history">Play history</HomeLink>
        </nav>

        {userId && activePlayerId && (
          <div style={{ marginTop: 16 }}>
            <WellbeingSurvey playerId={activePlayerId} />
          </div>
        )}
      </div>
    </>
  )
}

// ── Small parts ──────────────────────────────────────────────────────────────

/**
 * The zero-games dashboard. Says what will fill this page and what it costs to
 * fill it, instead of four zeros and an empty radar.
 *
 * The event count is the only real number here on purpose — it is a fact about
 * the sport rather than about the player, so it is the one figure that is
 * genuinely theirs to look forward to.
 */
function FirstRunPanel() {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '26px 20px', marginBottom: 16, textAlign: 'center',
    }}>
      <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="#2a2a2a"
           strokeWidth="1.6" strokeLinecap="round" aria-hidden
           style={{ marginBottom: 14 }}>
        <path d="M5 19V11" /><path d="M12 19V5" /><path d="M19 19v-5" />
      </svg>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.04em' }}>
        NO GAMES YET
      </div>
      <p style={{
        fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6,
        maxWidth: 280, margin: '8px auto 0',
      }}>
        Play one 100-minute session and this page fills with your placements,
        your personal bests, and every event you have tried.
      </p>

      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)',
        textAlign: 'left',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            letterSpacing: '0.12em', fontWeight: 600, fontSize: 10, color: '#555',
          }}>
            Waiting for you
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3, lineHeight: 1.5 }}>
            {EVENTS.length} events across 10 domains. You play 10 of them a session.
          </div>
        </div>
        <Link href="/events" style={{
          fontFamily: 'var(--font-label)', textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 600, fontSize: 12,
          color: 'var(--blue)', flexShrink: 0,
        }}>
          See them →
        </Link>
      </div>
    </div>
  )
}

/** A number in the stats line: bold white, a dash while it loads. */
function Num({ value }: { value: number | null | undefined }) {
  return <b style={{ color: 'var(--white)', fontWeight: 600 }}>{value == null ? '—' : value}</b>
}

export default function Dashboard() {
  return <Suspense><DashboardInner /></Suspense>
}
