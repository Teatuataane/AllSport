'use client'

// ─── The stats page ──────────────────────────────────────────────────────────
// Four blocks and one conditional strip. That is the whole page:
//
//   1  identity + seasonal division rank
//   2  the taniwha card — what you are currently earning
//   3  four numbers — games, events won, games won, PRs
//   4  the skill radar across the ten domains
//
// Everything the old bento grid carried is now either a nav destination (judge,
// koha, profile, personal bests) or lives behind the taniwha card (play history,
// the picker, the colours era). The dashboard used to be an action hub with stats
// bolted on; it is a stats page with one action on it.
//
// TWO CLOCKS, ON PURPOSE. Taniwha points are lifetime and never reset. `rankings`
// is still seasonal, so the division rank line is explicitly labelled with the
// year — that is the only seasonal number on the page.

import { useEffect, useMemo, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import { nextScheduledSession } from '@/lib/schedule'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import DomainRadar from '@/components/DomainRadar'
import TaniwhaCard, { loadTaniwhaState, type TaniwhaState } from '@/components/TaniwhaCard'
import VoteCard from '@/app/components/VoteCard'
import WellbeingSurvey from '@/app/components/WellbeingSurvey'
import { DOMAIN_COLORS } from '@/lib/domainColours'
import { taniwhaBySlug, taniwhaOnDark } from '@/lib/taniwha'
import {
  sessionWins,
  type RatingResultRow, type RatingEventRow, type RatingSessionRow, type RatingPlayerRow,
} from '@/lib/rating'
import {
  computePercentiles, domainPercentiles, strongestEvent, weakestEvent,
  eventPctLabel, type DomainPercentile,
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
  totals: { player_id: string; lifetime_points: number; highest_rung: number }[]
  rankings: { player_id: string; division: string | null; current_rank: number | null; total_sessions: number | null }[]
  counts: { player_id: string; games: number; prs: number }[]
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    loading: playerLoading, userId, self, familyMembers, activePlayerId, activePlayer,
  } = useActivePlayer()

  const [household, setHousehold] = useState<HouseholdBundle | null>(null)
  const [stats, setStats] = useState<StatsBundle | null>(null)
  const [taniwha, setTaniwha] = useState<TaniwhaState | null>(null)
  const [activeSession, setActiveSession] = useState<any>(null)
  const [joinCode, setJoinCode] = useState('')
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

  // ── Taniwha. Its OWN query, never folded into the bundle above. ─────────────
  // A missing table returns PGRST205 and this returns null; a missing column
  // would return 42703 and take the whole request down. Keeping it separate is
  // what lets the rest of the page survive the pre-migration window.
  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    setTaniwha(null)
    const points = household?.totals.find(t => t.player_id === activePlayerId)?.lifetime_points ?? 0
    loadTaniwhaState(activePlayerId, points).then(s => { if (!cancelled) setTaniwha(s) })
    return () => { cancelled = true }
  }, [activePlayerId, household])

  // ── Is a game running right now? ────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    const check = async () => {
      await supabase.rpc('close_expired_sessions')
      const { data } = await supabase.from('sessions').select('*').eq('is_active', true).maybeSingle()
      if (!cancelled) setActiveSession(data ?? null)
    }
    check()
    return () => { cancelled = true }
  }, [userId])

  // Silent auto-join from the QR code.
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
  const points = household?.totals.find(t => t.player_id === activePlayerId)?.lifetime_points ?? 0
  const ranking = household?.rankings.find(r => r.player_id === activePlayerId) ?? null
  const counts = household?.counts.find(c => c.player_id === activePlayerId) ?? null

  const derived = useMemo(() => {
    if (!stats || !activePlayerId) return null
    const allPct = computePercentiles(stats.results, stats.events, stats.players)
    const minePct = allPct.get(activePlayerId)
    const domains: DomainPercentile[] = domainPercentiles(minePct, EVENT_DOMAIN)
    const myRows = stats.results.filter(r => r.player_id === activePlayerId)
    return {
      domains,
      strong: strongestEvent(minePct, EVENT_DOMAIN),
      weak: weakestEvent(minePct, EVENT_DOMAIN),
      gamesWon: sessionWins(myRows).get(activePlayerId) ?? 0,
    }
  }, [stats, activePlayerId])

  const eventsWon = useMemo(() => {
    if (!taniwha) return null
    return Object.values(taniwha.winsByEvent).filter(n => n > 0).length
  }, [taniwha])

  const buildingTaniwha = useMemo(() => {
    const row = taniwha?.rows.find(r => r.is_building && !r.crowned_at)
    return row ? taniwhaBySlug(row.taniwha_slug) : null
  }, [taniwha])

  const accent = buildingTaniwha ? taniwhaOnDark(buildingTaniwha) : 'var(--blue)'

  // Strongest / weakest DOMAIN, for the two boxes under the radar.
  const domainExtremes = useMemo(() => {
    const rated = (derived?.domains ?? []).filter(d => d.topPct != null)
    if (rated.length === 0) return null
    const sorted = [...rated].sort((a, b) => (a.topPct! - b.topPct!))
    return { best: sorted[0], worst: sorted[sorted.length - 1] }
  }, [derived])

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
        {activeSession ? (
          <ActionStrip
            href={`/scoring/${activeSession.id}`}
            tone="var(--green)"
            title={isJudge ? 'Session running' : 'Session in progress'}
            detail={`${activeSession.location ?? 'AllSport HQ'} — tap to ${isJudge ? 'score' : 'return'}`}
            live
          />
        ) : userId ? (
          <VoteCard userId={userId} isJudge={isJudge} />
        ) : null}

        {!activeSession && (
          <div id="join">
            <JoinBlock
              nextSession={nextSession}
              highlight={firstRun}
              code={joinCode}
              onCode={setJoinCode}
              onJoin={() => handleJoinByCode(joinCode.trim().toUpperCase())}
              error={joinError}
            />
          </div>
        )}

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
          {ranking?.current_rank != null && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 24,
                color: 'var(--blue)', lineHeight: 1,
              }}>
                {ordinal(ranking.current_rank).toUpperCase()}
              </div>
              <div style={{
                fontFamily: 'var(--font-label)', textTransform: 'uppercase',
                letterSpacing: '0.1em', fontWeight: 600, fontSize: 10,
                color: '#555', marginTop: 2,
              }}>
                {new Date().getFullYear()} board
              </div>
            </div>
          )}
        </div>

        {/* ── 2. Taniwha ──────────────────────────────────────────────────── */}
        {taniwha && (
          <TaniwhaCard
            state={taniwha}
            points={points}
            onOpenHistory={() => router.push('/taniwha/history')}
          />
        )}

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

        {/* ── 4. Skill across the domains ─────────────────────────────────── */}
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '18px 16px 16px',
        }}>
          <div style={{
            display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
            marginBottom: 4,
          }}>
            <SectionLabel>Skill across the domains</SectionLabel>
            <span style={{
              fontFamily: 'var(--font-label)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: 600, fontSize: 10, color: 'var(--text-muted)',
            }}>
              Further out = stronger
            </span>
          </div>

          {derived ? (
            <DomainRadar domains={derived.domains} accent={accent} />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#444' }}>
              Loading…
            </div>
          )}

          {domainExtremes ? (
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <ExtremeBox
                label="Strongest"
                name={DOMAIN_NAMES[domainExtremes.best.domainNumber - 1]}
                colour={DOMAIN_COLORS[domainExtremes.best.domainNumber - 1]}
                detail={`Top ${domainExtremes.best.topPct}%`}
              />
              <ExtremeBox
                label="Weakest"
                name={DOMAIN_NAMES[domainExtremes.worst.domainNumber - 1]}
                colour={DOMAIN_COLORS[domainExtremes.worst.domainNumber - 1]}
                detail={`Top ${domainExtremes.worst.topPct}%`}
              />
            </div>
          ) : (
            <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0 2px', lineHeight: 1.5 }}>
              Play a session and this fills in — every event you score is compared
              against everyone in your division pool who has played it.
            </div>
          )}

          {derived?.strong && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', gap: 12,
              marginTop: 14, paddingTop: 13, borderTop: '1px solid var(--border)',
              fontSize: 12.5, color: 'var(--text-muted)',
            }}>
              <span>Best event: <span style={{ color: 'var(--white)' }}>{derived.strong.eventName}</span></span>
              <span style={{ color: 'var(--amber)', flexShrink: 0 }}>{eventPctLabel(derived.strong.ep)}</span>
            </div>
          )}

          <Link href="/prs" style={{
            display: 'block', textAlign: 'center', paddingTop: 15, marginTop: 14,
            borderTop: '1px solid var(--border)',
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 600, fontSize: 12, color: 'var(--blue)',
          }}>
            All {EVENTS.length} events →
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

function ExtremeBox({ label, name, colour, detail }: {
  label: string; name: string; colour: string; detail: string
}) {
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
      <div style={{ fontSize: 13.5, color: colour, fontWeight: 600, marginTop: 3 }}>{name}</div>
      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        fontSize: 11, color: 'var(--text-muted)', marginTop: 1,
      }}>
        {detail}
      </div>
    </div>
  )
}

function ActionStrip({ href, tone, title, detail, live }: {
  href: string; tone: string; title: string; detail: string; live?: boolean
}) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      background: 'linear-gradient(135deg,#061a0d,#0d2e1a)',
      border: `1px solid ${tone}44`, borderLeft: `4px solid ${tone}`,
      borderRadius: 16, padding: '13px 16px', marginBottom: 14, textDecoration: 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {live && (
          <span style={{
            width: 8, height: 8, borderRadius: 999, background: tone,
            boxShadow: `0 0 0 4px ${tone}2e`, flexShrink: 0,
          }} />
        )}
        <div>
          <div style={{
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            letterSpacing: '0.08em', fontWeight: 600, fontSize: 13, color: tone,
          }}>
            {title}
          </div>
          <div style={{ fontSize: 12, color: '#7a7a7a', marginTop: 1 }}>{detail}</div>
        </div>
      </div>
      <span style={{ color: tone, fontSize: 20 }}>→</span>
    </Link>
  )
}

function JoinBlock({ nextSession, highlight, code, onCode, onJoin, error }: {
  nextSession: ReturnType<typeof nextScheduledSession>
  highlight: boolean
  code: string
  onCode: (v: string) => void
  onJoin: () => void
  error: string
}) {
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
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <input
          value={code}
          onChange={e => onCode(e.target.value.toUpperCase())}
          placeholder="JOIN CODE"
          style={{
            flexGrow: 1, minWidth: 0, background: '#0a0a0a',
            border: '1px solid var(--border-strong)', borderRadius: 999,
            padding: '11px 18px', color: 'var(--white)',
            fontFamily: 'var(--font-label)', letterSpacing: '0.1em', fontSize: 13,
          }}
        />
        <button onClick={onJoin} style={{
          background: 'var(--blue)', color: 'var(--white)', border: 'none',
          borderRadius: 999, padding: '11px 22px', cursor: 'pointer',
          fontFamily: 'var(--font-label)', textTransform: 'uppercase',
          letterSpacing: '0.08em', fontWeight: 600, fontSize: 13, flexShrink: 0,
        }}>
          Join
        </button>
      </div>
      {error && <div style={{ color: 'var(--red)', fontSize: 13, marginTop: 10 }}>{error}</div>}
    </div>
  )
}

export default function Dashboard() {
  return <Suspense><DashboardInner /></Suspense>
}
