'use client'

// ─── The stats page ──────────────────────────────────────────────────────────
// Four blocks and one conditional strip. That is the whole page:
//
//   1  identity + seasonal division rank
//   2  the grades card — a colour in each of the ten domains
//   3  four numbers — games, events won, games won, PRs
//   4  the colours radar across the ten domains
//
// Everything the old bento grid carried is now either a nav destination (judge,
// koha, profile, personal bests) or lives on /history (play history and the
// colours era). The dashboard used to be an action hub with stats bolted on; it
// is a stats page with one action on it.
//
// TWO CLOCKS, ON PURPOSE. Colours are lifetime; a standards change never takes one back. `rankings`
// is still seasonal, so the division rank line is explicitly labelled with the
// year — that is the only seasonal number on the page.

import { useCallback, useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import { nextScheduledSession } from '@/lib/schedule'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import DomainRadar from '@/components/DomainRadar'
import GradesCard from '@/components/GradesCard'
import { loadGradeState, type GradeState } from '@/lib/loadGrades'
import { useNewColours } from '@/lib/useNewColours'
import NewColourCard from '@/components/NewColourCard'
import VoteCard from '@/app/components/VoteCard'
import WellbeingSurvey from '@/app/components/WellbeingSurvey'
import { gradeForRung, gradeInk } from '@/lib/grading'
import { GradeDot } from '@/components/GradeDot'
import { domainExtremesByColour, bestEventByColour, shownDomainRungs } from '@/lib/colourDisplay'
import {
  sessionWins,
  type RatingResultRow, type RatingEventRow, type RatingSessionRow, type RatingPlayerRow,
} from '@/lib/rating'
import {
  computePercentiles, domainPercentiles, type DomainPercentile,
} from '@/lib/percentile'

const supabase = createClient()

const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')
const EVENT_DOMAIN = new Map(EVENTS.map(e => [e.name, e.domainNumber]))

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
    const check = async () => {
      await supabase.rpc('close_expired_sessions')
      const { data, error } = await supabase.from('sessions').select('*').eq('is_active', true).maybeSingle()
      // A failed poll keeps the last known answer: one flaky request must not
      // take the JOIN button away mid-game.
      if (!cancelled && !error) setActiveSession(data ?? null)
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
    const domains: DomainPercentile[] = domainPercentiles(minePct, EVENT_DOMAIN)
    const myRows = stats.results.filter(r => r.player_id === activePlayerId)
    const eventPct = new Map<string, number | null>()
    for (const [name, ep] of minePct ?? []) eventPct.set(name, ep.topPct)
    return {
      domains,
      eventPct,
      gamesWon: sessionWins(myRows).get(activePlayerId) ?? 0,
    }
  }, [stats, activePlayerId])

  // A hex, not a CSS variable: it is suffixed with an alpha below, and
  // 'var(--blue)1e' is not a colour. The old taniwha fallback had exactly that
  // bug, so the tile rendered with no tint at all.
  const accent = '#2371BB'

  // The colour HELD per domain, which the radar and the two boxes under it
  // draw. The same rule as the YOUR COLOURS list above, so the two agree:
  // conferred colours once grading is live, computed ones before.
  const heldRungs = useMemo(() => (grades ? shownDomainRungs(grades) : new Map<number, number>()), [grades])

  // Best / weakest DOMAIN by colour; Top % only breaks a tie, unseen.
  const domainExtremes = useMemo(() => {
    const pct = new Map((derived?.domains ?? []).map(d => [d.domainNumber, d.topPct]))
    return domainExtremesByColour(heldRungs, pct)
  }, [heldRungs, derived])

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

  return (
    <>
      <PlayerTabs />

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px 40px', color: 'var(--white)' }}>
        <ViewingAsBanner />

        {/* ── The one action on the page ──────────────────────────────────── */}
        {!activeSession && userId && <VoteCard userId={userId} isJudge={isJudge} />}

        <div id="join">
          <JoinBlock
            game={activeSession ? { id: activeSession.id, location: activeSession.location ?? null } : null}
            isJudge={isJudge}
            nextSession={nextSession}
            highlight={firstRun}
            error={joinError}
          />
        </div>

        {/* ── 1. Identity ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <div style={{
            width: 54, height: 54, borderRadius: 15, flexShrink: 0,
            background: `${accent}1e`, border: `1px solid ${accent}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: activePlayer.icon ? 26 : 24,
            fontFamily: activePlayer.icon ? undefined : 'var(--font-display)',
            color: accent,
          }}>
            {activePlayer.icon || playerLabel(activePlayer).charAt(0).toUpperCase()}
          </div>
          <div style={{ flexGrow: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 30,
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
          </div>
        </div>

        {/* ── 2. Colours ──────────────────────────────────────────────────── */}
        <NewColourCard awards={newColours.unseen} withdrawn={newColours.withdrawn} onDismiss={newColours.dismiss} />
        {/* Juniors are asked for a bodyweight too (Tāne, 23 September 2026), and
            /grades no longer carries a personal prompt, so this is the only one. */}
        {grades && <GradesCard state={grades} askBand />}
        <Link href="/history" style={{
          display: 'block', textAlign: 'right', margin: '-6px 2px 16px',
          fontFamily: 'var(--font-label)', textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)',
        }}>
          Play history →
        </Link>

        {/* ── 3 + 4. Stats, or an honest empty state ──────────────────────
            A player with no games has nothing to put in four stat tiles or a
            radar: they get four zeros and a shape collapsed to a dot at the
            centre, which reads as a broken page rather than a new one. The
            first-run panel is design-canvas/FirstRun.dc.html. */}
        {firstRun ? (
          <FirstRunPanel />
        ) : (
        <>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 8, marginBottom: 16,
        }}>
          <Stat value={counts?.games ?? 0} label="Total games" />
          <Stat value={eventsWon} label="Events won" colour="var(--amber)" />
          <Stat value={derived?.gamesWon} label="Games won" colour="var(--amber)" />
          <Stat value={counts?.prs ?? 0} label="Total PRs" colour="var(--green)" />
        </div>

        {/* ── 4. Colours across the domains ────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '18px 16px 16px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <SectionLabel>Colours across the domains</SectionLabel>
            <span style={{
              fontFamily: 'var(--font-label)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: 600, fontSize: 10, color: 'var(--text-muted)',
            }}>
              Edge = Taniwha
            </span>
          </div>

          {grades ? (
            <DomainRadar held={heldRungs} />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
              Loading…
            </div>
          )}

          {domainExtremes ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <ExtremeBox
                label="Best domain"
                name={DOMAIN_NAMES[domainExtremes.best.domainNumber - 1]}
                rung={domainExtremes.best.rung}
              />
              <ExtremeBox
                label="Weakest domain"
                name={DOMAIN_NAMES[domainExtremes.weakest.domainNumber - 1]}
                rung={domainExtremes.weakest.rung}
              />
            </div>
          ) : grades && (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '10px 0 2px', lineHeight: 1.5 }}>
              Each spoke grows as that domain earns a colour. Taniwha is the edge.
            </div>
          )}

          {bestEvent && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
              marginTop: 14, paddingTop: 13, borderTop: '1px solid var(--border)',
              fontSize: 12.5, color: 'var(--text-muted)',
            }}>
              <span>Best event: <span style={{ color: 'var(--white)' }}>{EVENTS.find(e => e.slug === bestEvent.slug)?.name}</span></span>
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
                fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em',
                fontWeight: 600, fontSize: 11.5, color: 'var(--white)',
              }}>
                <GradeDot grade={gradeForRung(bestEvent.rung)} size={10} /> {gradeForRung(bestEvent.rung).name}
              </span>
            </div>
          )}

          <Link href="/prs" style={{
            display: 'block', textAlign: 'center', paddingTop: 15, marginTop: 14,
            borderTop: '1px solid var(--border)',
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 600, fontSize: 12, color: 'var(--blue)',
          }}>
            My events →
          </Link>
        </div>
        </>
        )}

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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase',
      letterSpacing: '0.14em', fontWeight: 600, fontSize: 11, color: 'var(--text-muted)',
    }}>
      {children}
    </span>
  )
}

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

function Stat({ value, label, colour = 'var(--white)' }: {
  value: number | null | undefined
  label: string
  colour?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, padding: '13px 6px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color: colour, lineHeight: 1 }}>
        {value == null ? '—' : value}
      </div>
      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600, fontSize: 10,
        color: 'var(--text-muted)', marginTop: 3,
      }}>
        {label}
      </div>
    </div>
  )
}

function ExtremeBox({ label, name, rung }: { label: string; name: string; rung: number }) {
  const g = gradeForRung(rung)
  return (
    <div style={{
      flex: 1, background: '#0d0d0d', border: '1px solid #1a1a1a',
      borderRadius: 10, padding: '11px 13px', minWidth: 0,
    }}>
      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600, fontSize: 10, color: 'var(--text-muted)',
      }}>
        {label}
      </div>
      <div style={{ fontSize: 13.5, color: 'var(--white)', fontWeight: 600, marginTop: 3 }}>{name}</div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, marginTop: 3,
        fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em',
        fontWeight: 600, fontSize: 11.5, color: gradeInk(g),
      }}>
        <GradeDot grade={g} size={10} /> {g.name}
      </div>
    </div>
  )
}

/**
 * The top of the page. A game running: one JOIN button straight into it. No
 * game: when and where the next one is. Nobody types a join code any more (home
 * colours rework, 24 September 2026); the QR link's ?code= still joins silently.
 */
function JoinBlock({ game, isJudge, nextSession, highlight, error }: {
  game: { id: string; location: string | null } | null
  isJudge: boolean
  nextSession: ReturnType<typeof nextScheduledSession>
  highlight: boolean
  error: string
}) {
  if (game) {
    return (
      <div style={{
        background: 'linear-gradient(135deg,#061a0d,#0d2e1a)',
        border: '1px solid #4DB26E55', borderRadius: 16, padding: 18, marginBottom: 16,
        boxShadow: '0 8px 30px rgba(77,178,110,0.18)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: 'var(--green)',
            boxShadow: '0 0 0 4px #4DB26E2e', flexShrink: 0,
          }} />
          <SectionLabel>Game on now</SectionLabel>
        </div>
        <div style={{ fontSize: 13, color: '#9fc4ab', marginTop: 6 }}>
          {game.location ?? 'AllSport HQ'}
        </div>
        {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}
        <Link href={`/scoring/${game.id}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 50,
          marginTop: 14, borderRadius: 999, background: 'var(--green)', color: '#0a0a0a',
          fontFamily: 'var(--font-label)', textTransform: 'uppercase',
          letterSpacing: '0.1em', fontWeight: 700, fontSize: 16,
        }}>
          {isJudge ? 'Open the game →' : 'Join →'}
        </Link>
      </div>
    )
  }
  return (
    <div style={{
      background: highlight ? 'linear-gradient(135deg,#0d2140,#061428)' : 'var(--surface)',
      border: `1px solid ${highlight ? '#2371BB55' : 'var(--border)'}`,
      borderRadius: 16, padding: 18, marginBottom: 16,
      boxShadow: highlight ? '0 8px 30px rgba(35,113,187,0.22)' : undefined,
    }}>
      <SectionLabel>{highlight ? 'Your first game' : 'Next session'}</SectionLabel>
      {nextSession && (
        <>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 26, marginTop: 6, letterSpacing: '0.04em',
          }}>
            {nextSession.label.toUpperCase()}
          </div>
          <div style={{ fontSize: 13, color: '#8fa9c4', marginTop: 5, lineHeight: 1.5 }}>
            AllSport HQ · 26 Carbine Place, Sockburn<br />{nextSession.relative}
          </div>
        </>
      )}
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginTop: 10 }}>
        Join opens here when the game starts.
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}
    </div>
  )
}

export default function Dashboard() {
  return <Suspense><DashboardInner /></Suspense>
}
