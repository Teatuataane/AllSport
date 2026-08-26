'use client'

// ─── Taniwha history ─────────────────────────────────────────────────────────
// What the dashboard's taniwha card opens. Everything historical or
// configurational about the grading system lives here so the card can show one
// thing well:
//
//   1  which taniwha is under construction
//   2  the picker — change what you are building
//   3  limbs earned, with the session each landed in
//   4  play history — the session timeline, moved off the dashboard
//   5  the colours era
//
// Limb dates are DERIVED, not stored — see `limbCrossings` in lib/taniwha.ts.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { formatNZDate } from '@/lib/dates'
import { useActivePlayer, playerLabel } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import TaniwhaFigure, { figureInk } from '@/components/TaniwhaFigure'
import {
  TaniwhaPicker, TaniwhaTimeline, loadTaniwhaState, limbsHeld, type TaniwhaState,
} from '@/components/TaniwhaCard'
import {
  PARTS_PER_TANIWHA, BODY_PARTS_PER_TANIWHA, WHANAU, limbCrossings, partByNumber,
  taniwhaBySlug, taniwhaCardStyle, type PointsSession,
} from '@/lib/taniwha'

const supabase = createClient()

type Summary = {
  session_id: string
  player_id: string
  overall_placement: number | null
  total_placement_points: number | null
  effort_points: number | null
  effort_level: number | null
  session_date: string
  location: string | null
}

type Award = {
  player_id: string
  rung: number
  colour_name: string
  points_at_award: number
  awarded_at: string
  session_date: string | null
  location: string | null
}

type Bundle = {
  totals: { player_id: string; lifetime_points: number; earned_points: number }[]
  summaries: Summary[]
  awards: Award[]
}

const PAGE = 20

export default function TaniwhaHistoryPage() {
  const router = useRouter()
  const { loading, userId, familyMembers, activePlayerId, activePlayer } = useActivePlayer()
  const [bundle, setBundle] = useState<Bundle | null>(null)
  const [taniwha, setTaniwha] = useState<TaniwhaState | null>(null)
  const [shown, setShown] = useState(PAGE)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    if (!loading && !userId) router.push('/play')
  }, [loading, userId, router])

  const householdIds = useMemo(
    () => (userId ? [userId, ...familyMembers.map(m => m.id)] : []),
    [userId, familyMembers],
  )

  useEffect(() => {
    if (householdIds.length === 0) return
    let cancelled = false
    supabase.rpc('player_dashboard', { p_player_ids: householdIds }).then(({ data, error }) => {
      if (cancelled || error || !data) return
      setBundle(data as Bundle)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdIds.join(',')])

  const points = bundle?.totals.find(t => t.player_id === activePlayerId)?.lifetime_points ?? 0

  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    setTaniwha(null)
    loadTaniwhaState(activePlayerId, points).then(s => { if (!cancelled) setTaniwha(s) })
    return () => { cancelled = true }
  }, [activePlayerId, points, reload])

  useEffect(() => { setShown(PAGE) }, [activePlayerId])

  const mySummaries = useMemo(
    () => (bundle?.summaries ?? [])
      .filter(s => s.player_id === activePlayerId)
      .sort((a, b) => b.session_date.localeCompare(a.session_date)),
    [bundle, activePlayerId],
  )

  const crossings = useMemo(() => {
    const sessions: PointsSession[] = mySummaries.map(s => ({
      session_id: s.session_id,
      session_date: s.session_date,
      location: s.location,
      points: (s.total_placement_points ?? 0) + (s.effort_points ?? 0),
    }))
    // Whatever the sessions do not account for is adjustment_points, which belong
    // to no session and shift every crossing that follows.
    const fromSessions = sessions.reduce((n, s) => n + s.points, 0)
    const starting = Math.max(points - fromSessions, 0)
    return limbCrossings(sessions, starting).reverse()
  }, [mySummaries, points])

  const myAwards = useMemo(
    () => (bundle?.awards ?? []).filter(a => a.player_id === activePlayerId),
    [bundle, activePlayerId],
  )

  const sessionsById = useMemo(() => {
    const m: Record<string, { session_date: string; location: string | null }> = {}
    for (const s of mySummaries) m[s.session_id] = { session_date: s.session_date, location: s.location }
    return m
  }, [mySummaries])

  if (loading) {
    return <Centered>Loading…</Centered>
  }
  if (!activePlayer) {
    return <Centered>No player profile found.</Centered>
  }

  const building = taniwha?.rows.find(r => r.is_building && !r.crowned_at) ?? null
  const t = (building && taniwhaBySlug(building.taniwha_slug)) || WHANAU
  const limbs = limbsHeld(building)
  const card = taniwhaCardStyle(t)
  const ink = (card.color as string) ?? '#ffffff'
  const inks = figureInk(t, ink)

  return (
    <>
      <PlayerTabs />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px 40px', color: 'var(--white)' }}>
        <BackLink href="/dashboard">Taniwha history</BackLink>
        <ViewingAsBanner />

        {/* 1 — what is under construction */}
        {taniwha && building && (
          <div style={{
            ...card, borderRadius: 14, padding: '14px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <TaniwhaFigure
              taniwha={t} limbsEarned={limbs}
              ink={inks.ink} ghost={inks.ghost} ghostStroke={inks.ghostStroke}
              width={74} showEye={false}
            />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <Label ink={ink}>Currently earning</Label>
              <div style={{ fontSize: 14.5, fontWeight: 600, color: ink, marginTop: 2 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: ink, opacity: 0.65 }}>{t.gloss}</div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: ink }}>
                {limbs}/{PARTS_PER_TANIWHA}
              </div>
              <Label ink={ink}>Limbs</Label>
            </div>
          </div>
        )}

        {/* 2 — the picker, moved off the card */}
        {taniwha && (
          <TaniwhaPicker state={taniwha} points={points} onChanged={() => setReload(n => n + 1)} />
        )}

        {/* 3 — limbs earned */}
        <Section>Limbs earned</Section>
        <Panel>
          {crossings.length === 0 ? (
            <Empty>Your first limb lands at 1,000 points.</Empty>
          ) : (
            crossings.slice(0, 6).map(c => {
              // Body parts only — crowns are earned, not bought, so they are not
              // slots on this ladder and must not be part of the modulus.
              //
              // partByNumber, NOT partFor, and that is deliberate: we do not know
              // which taniwha this piece went on, because switching is not
              // recorded. Piece ten therefore reads as the generic "Taputapu"
              // rather than naming a tool the player may not have earned.
              const part = partByNumber(((c.limb - 1) % BODY_PARTS_PER_TANIWHA) + 1)
              return (
                <Row key={c.limb}>
                  <Pip>{c.limb}</Pip>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600 }}>
                      {part?.name} <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{part?.english}</span>
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 1 }}>
                      {formatNZDate(c.sessionDate)}{c.location ? ` · ${c.location}` : ''}
                    </div>
                  </div>
                  <Muted>{c.points.toLocaleString()}</Muted>
                </Row>
              )
            })
          )}
        </Panel>

        {/* 4 — play history */}
        <Section>Play history</Section>
        <Panel>
          {mySummaries.length === 0 ? (
            <Empty>No games yet.</Empty>
          ) : (
            mySummaries.slice(0, shown).map(s => {
              const total = (s.total_placement_points ?? 0) + (s.effort_points ?? 0)
              return (
                <Row key={s.session_id}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: s.overall_placement === 1 ? 'rgba(249,176,81,0.13)' : '#1a1a1a',
                    border: `1px solid ${s.overall_placement === 1 ? 'rgba(249,176,81,0.33)' : 'var(--border-strong)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontSize: 17,
                    color: s.overall_placement === 1 ? 'var(--amber)' : '#999',
                  }}>
                    {s.overall_placement ? ordinalShort(s.overall_placement) : '—'}
                  </div>
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{formatNZDate(s.session_date)}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                      {s.location ?? 'AllSport HQ'}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 19 }}>{total}</div>
                    <div style={{
                      fontFamily: 'var(--font-label)', fontSize: 9, color: '#555',
                      textTransform: 'uppercase', letterSpacing: '0.08em',
                    }}>
                      {s.total_placement_points ?? 0} + {s.effort_points ?? 0} effort
                    </div>
                  </div>
                </Row>
              )
            })
          )}
          {mySummaries.length > shown && (
            <button onClick={() => setShown(n => n + PAGE)} style={{
              width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
              padding: '13px 0', color: 'var(--blue)',
              fontFamily: 'var(--font-label)', textTransform: 'uppercase',
              letterSpacing: '0.1em', fontWeight: 600, fontSize: 12,
            }}>
              Show all {mySummaries.length} games
            </button>
          )}
        </Panel>

        {/* Crowns, then the colours era */}
        <div style={{ marginTop: 20 }}>
          <TaniwhaTimeline state={taniwha} sessions={sessionsById} />
        </div>

        {myAwards.length > 0 && (
          <>
            <Section>The colours era</Section>
            <Panel>
              {myAwards.map(a => (
                <Row key={a.rung}>
                  <div style={{
                    width: 11, height: 11, borderRadius: 999, flexShrink: 0,
                    background: 'var(--grey)',
                  }} />
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 16, letterSpacing: '0.04em',
                    }}>
                      {a.colour_name.toUpperCase()}
                    </div>
                    <div style={{ fontSize: 11, color: '#555', marginTop: 2 }}>
                      {a.session_date ? formatNZDate(a.session_date) : formatNZDate(a.awarded_at.slice(0, 10))}
                      {a.location ? ` · ${a.location}` : ''}
                    </div>
                  </div>
                  <Muted>{a.points_at_award.toLocaleString()}</Muted>
                </Row>
              ))}
              <div style={{
                fontSize: 11, color: '#444', lineHeight: 1.5,
                padding: '12px 14px', borderTop: '1px solid var(--border)',
              }}>
                Colours you really earned, on the dates you earned them. Kept as
                history — never rewritten as taniwha limbs.
              </div>
            </Panel>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Link href="/taniwha" style={{
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            letterSpacing: '0.1em', fontWeight: 600, fontSize: 12, color: 'var(--blue)',
          }}>
            See all twelve →
          </Link>
        </div>
      </div>
    </>
  )
}

// ── Shared shells, used by both taniwha pages ────────────────────────────────

function ordinalShort(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return (n + (s[(v - 20) % 10] || s[v] || s[0])).toUpperCase()
}

export function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      minHeight: '60vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', color: '#555',
    }}>
      {children}
    </div>
  )
}

export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{
      display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
      color: 'var(--white)', textDecoration: 'none',
    }}>
      <span style={{ color: 'var(--grey)', fontSize: 19, lineHeight: 1 }}>‹</span>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.05em' }}>
        {String(children).toUpperCase()}
      </span>
    </Link>
  )
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase',
      letterSpacing: '0.14em', fontWeight: 600, fontSize: 11,
      color: 'var(--text-muted)', margin: '18px 0 10px',
    }}>
      {children}
    </div>
  )
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 16, overflow: 'hidden',
    }}>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 11,
      padding: '12px 14px', borderBottom: '1px solid #1a1a1a',
    }}>
      {children}
    </div>
  )
}

function Pip({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      width: 24, height: 24, borderRadius: 7, flexShrink: 0,
      background: 'var(--amber)', color: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'var(--font-display)', fontSize: 12,
    }}>
      {children}
    </div>
  )
}

function Muted({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: 'var(--font-label)', fontSize: 11, color: '#555', flexShrink: 0,
    }}>
      {children}
    </span>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ padding: '20px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
      {children}
    </div>
  )
}

function Label({ ink, children }: { ink: string; children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase',
      letterSpacing: '0.1em', fontWeight: 600, fontSize: 10, color: ink, opacity: 0.55,
    }}>
      {children}
    </div>
  )
}
