'use client'

// ─── My Taniwha ──────────────────────────────────────────────────────────────
// The collection. Four counts, then all twelve as expandable rows — expand one
// and you get its ten named limbs and exactly what its crown needs.
//
// The dashboard card can only ever show the taniwha under construction, and the
// grading system IS the collection, so it needed a screen of its own.
//
// "Taniwha" in the header counts those STARTED, not crowned — crowns have their
// own number beside it. A player with five limbs on one taniwha has started one.

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { useActivePlayer } from '@/lib/useActivePlayer'
import PlayerTabs, { ViewingAsBanner } from '@/components/PlayerTabs'
import DomainIcon from '@/components/DomainIcon'
import TaniwhaFigure, { figureInk } from '@/components/TaniwhaFigure'
import { loadTaniwhaState, limbsHeld, type TaniwhaState, type PlayerTaniwhaRow } from '@/components/TaniwhaCard'
import { winsByDomain } from '@/lib/taniwhaAlerts'
import { DOMAIN_ORDER } from '@/lib/eventData'
import {
  PARTS, PARTS_PER_TANIWHA, PART_POINTS, BODY_PARTS_PER_TANIWHA, partFor,
  TOTAL_BODY_PARTS, MAX_CROWNS, TOTAL_TANIWHA, WIN_TARGET, EVENTS_PER_DOMAIN,
  WHANAU, KAHUI, DOMAIN_TANIWHA, taniwhaCardStyle, taniwhaOnDark,
  winsToGo, WIN_MIN_FIELD, type Taniwha,
} from '@/lib/taniwha'

const supabase = createClient()

export default function MyTaniwhaPage() {
  const router = useRouter()
  const { loading, userId, familyMembers, activePlayerId, activePlayer } = useActivePlayer()
  const [points, setPoints] = useState(0)
  const [state, setState] = useState<TaniwhaState | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !userId) router.push('/play')
  }, [loading, userId, router])

  const householdIds = useMemo(
    () => (userId ? [userId, ...familyMembers.map(m => m.id)] : []),
    [userId, familyMembers],
  )

  useEffect(() => {
    if (householdIds.length === 0 || !activePlayerId) return
    let cancelled = false
    supabase.rpc('player_dashboard', { p_player_ids: householdIds }).then(({ data, error }) => {
      if (cancelled || error || !data) return
      const totals = (data as { totals: { player_id: string; lifetime_points: number }[] }).totals
      setPoints(totals.find(t => t.player_id === activePlayerId)?.lifetime_points ?? 0)
    })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [householdIds.join(','), activePlayerId])

  useEffect(() => {
    if (!activePlayerId) return
    let cancelled = false
    setState(null)
    setOpen(null)
    loadTaniwhaState(activePlayerId, points).then(s => { if (!cancelled) setState(s) })
    return () => { cancelled = true }
  }, [activePlayerId, points])

  const wins = useMemo(() => winsByDomain(state?.winsByEvent ?? {}), [state])
  const rowFor = (slug: string): PlayerTaniwhaRow | undefined =>
    state?.rows.find(r => r.taniwha_slug === slug)

  if (loading) {
    return <div style={pad}><div style={{ color: '#555' }}>Loading…</div></div>
  }
  if (!activePlayer) {
    return <div style={pad}><div style={{ color: '#555' }}>No player profile found.</div></div>
  }

  const started = (state?.rows ?? []).filter(r => r.body_parts > 0 || r.crowned_at).length
  const crowned = (state?.rows ?? []).filter(r => r.crowned_at).length
  const limbsPlaced = (state?.rows ?? []).reduce((n, r) => n + limbsHeld(r), 0)

  return (
    <>
      <PlayerTabs />
      <div style={{ maxWidth: 520, margin: '0 auto', padding: '14px 16px 40px', color: 'var(--white)' }}>
        <Link href="/dashboard" style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          color: 'var(--white)', textDecoration: 'none',
        }}>
          <span style={{ color: 'var(--grey)', fontSize: 19, lineHeight: 1 }}>‹</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.05em' }}>
            MY TANIWHA
          </span>
        </Link>

        <ViewingAsBanner />

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 8, marginBottom: 16,
        }}>
          <Count value={started} of={TOTAL_TANIWHA} label="Taniwha" />
          <Count value={limbsPlaced} of={TOTAL_BODY_PARTS} label="Pieces" colour="var(--amber)" />
          <Count value={crowned} of={MAX_CROWNS} label="Crowns" />
          <Count value={points.toLocaleString()} label="Points" />
        </div>

        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 18 }}>
          Every {PART_POINTS.toLocaleString()} points places one piece.{' '}
          {BODY_PARTS_PER_TANIWHA} pieces make a body — including the{' '}
          <span style={{ color: 'var(--amber)' }}>taputapu</span>, the tool of its
          own discipline. The last piece, the{' '}
          <span style={{ color: 'var(--amber)' }}>Tikitiki</span>, has to be earned.
          Your pieces stay where you put them, so switching changes what your next
          ones build, not what you already hold.
        </p>

        {/* The field-of-three rule, said out loud. It is enforced in the
            player_event_wins view and was never explained anywhere, so a
            player who beat one opponent saw their counter refuse to move and
            had no way to find out why. */}
        <p style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 18 }}>
          A domain crown needs {WIN_TARGET} of its {EVENTS_PER_DOMAIN} events won.
          A win counts when you finish first and at least{' '}
          <span style={{ color: 'var(--white)' }}>{WIN_MIN_FIELD} players</span> in your
          division pool played that event — so a head-to-head with one other
          player does not count towards a crown. Ties share the win.
        </p>

        {!state ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '24px 0' }}>
            Loading your taniwha…
          </div>
        ) : (
          <>
            <Heading>The whānau taniwha</Heading>
            <TaniwhaRow
              t={WHANAU} row={rowFor(WHANAU.slug)} wins={null}
              open={open === WHANAU.slug} onToggle={() => setOpen(o => o === WHANAU.slug ? null : WHANAU.slug)}
            />

            <Heading>The ten domains</Heading>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {DOMAIN_TANIWHA.map(t => (
                <TaniwhaRow
                  key={t.slug}
                  t={t}
                  row={rowFor(t.slug)}
                  wins={wins[t.domainNumber as number] ?? 0}
                  domainName={DOMAIN_ORDER[(t.domainNumber as number) - 1]}
                  open={open === t.slug}
                  onToggle={() => setOpen(o => o === t.slug ? null : t.slug)}
                />
              ))}
            </div>

            <Heading>The assembly</Heading>
            <div style={{
              border: '2px solid transparent', borderRadius: 12, opacity: 0.55,
              backgroundImage: 'linear-gradient(#000,#000), var(--rainbow)',
              backgroundOrigin: 'border-box', backgroundClip: 'padding-box, border-box',
              padding: '15px 16px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 40, height: 40, borderRadius: 11, flexShrink: 0,
                background: 'var(--rainbow)', opacity: 0.35,
              }} />
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 600 }}>{KAHUI.name}</div>
                <div style={{ fontSize: 11.5, color: 'var(--grey)', marginTop: 1 }}>
                  {KAHUI.gloss} · hold all {MAX_CROWNS} crowned
                </div>
              </div>
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#666"
                   strokeWidth="1.9" strokeLinecap="round" aria-hidden style={{ flexShrink: 0 }}>
                <rect x="5" y="11" width="14" height="10" rx="2" />
                <path d="M8 11V8a4 4 0 018 0v3" />
              </svg>
            </div>
          </>
        )}
      </div>
    </>
  )
}

const pad: React.CSSProperties = {
  minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontFamily: 'var(--font-label)', textTransform: 'uppercase',
      letterSpacing: '0.14em', fontWeight: 600, fontSize: 11,
      color: '#555', margin: '18px 0 9px',
    }}>
      {children}
    </div>
  )
}

function Count({ value, of, label, colour = 'var(--white)' }: {
  value: number | string; of?: number; label: string; colour?: string
}) {
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 14, padding: '13px 6px', textAlign: 'center',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, color: colour, lineHeight: 1 }}>
        {value}{of != null && <span style={{ fontSize: 13, color: '#555' }}>/{of}</span>}
      </div>
      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600, fontSize: 9,
        color: 'var(--text-muted)', marginTop: 3,
      }}>
        {label}
      </div>
    </div>
  )
}

function TaniwhaRow({ t, row, wins, domainName, open, onToggle }: {
  t: Taniwha
  row: PlayerTaniwhaRow | undefined
  /** null for Whānau, whose crown is a referral rather than wins. */
  wins: number | null
  domainName?: string
  open: boolean
  onToggle: () => void
}) {
  const limbs = limbsHeld(row)
  const crownedHere = !!row?.crowned_at
  const accent = taniwhaOnDark(t)
  const card = taniwhaCardStyle(t)
  const inks = figureInk(t, (card.color as string) ?? '#fff')

  // Only the taniwha under construction wears its own colours; the rest stay on
  // the neutral surface, or the page becomes ten flood-filled cards in a stack.
  const dressed = open || !!row?.is_building || crownedHere

  return (
    <div style={{
      background: dressed ? `${accent}0f` : 'var(--surface)',
      border: `1px solid ${dressed ? `${accent}55` : '#1a1a1a'}`,
      borderRadius: 12, overflow: 'hidden', marginBottom: 7,
    }}>
      <button onClick={onToggle} style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '13px 14px', minHeight: 48, background: 'transparent',
        border: 'none', cursor: 'pointer', textAlign: 'left',
      }}>
        {t.domainNumber != null && domainName ? (
          <DomainIcon domainName={domainName} domainNumber={t.domainNumber} size={38} />
        ) : (
          <div style={{
            width: 38, height: 38, borderRadius: 11, flexShrink: 0,
            background: `${accent}22`, border: `1px solid ${accent}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={accent}
                 strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M3 17l3-9 6 5 6-5 3 9z" />
            </svg>
          </div>
        )}

        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--white)' }}>{t.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 1 }}>
            {t.gloss}
            {wins != null && ` · ${wins} of ${WIN_TARGET} wins`}
            {crownedHere && ' · crowned'}
          </div>
        </div>

        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 17,
            color: limbs > 0 ? accent : '#555',
          }}>
            {limbs}/{PARTS_PER_TANIWHA}
          </div>
          <div style={{
            fontFamily: 'var(--font-label)', textTransform: 'uppercase',
            fontSize: 9, color: '#555',
          }}>
            {row?.is_building ? 'Building' : 'Pieces'}
          </div>
        </div>
        <span style={{
          color: '#444', fontSize: 12, flexShrink: 0,
          transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms',
        }}>
          ›
        </span>
      </button>

      {open && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
            <TaniwhaFigure
              taniwha={t} limbsEarned={limbs}
              ink={accent}
              ghost={inks.ghost.replace('rgba(0,0,0', 'rgba(255,255,255')}
              ghostStroke={`${accent}44`}
              width={96} showEye={false}
            />
            <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5 }}>
              {limbs === 0
                ? 'Not started. Pick this taniwha and your next pieces build it.'
                : crownedHere
                ? 'Complete — body and crown.'
                : `${limbs} of ${PARTS_PER_TANIWHA} pieces placed.`}
            </div>
          </div>

          {PARTS.map(raw => {
            const p = partFor(t, raw.number) ?? raw
            const held = p.number <= Math.min(limbs, BODY_PARTS_PER_TANIWHA)
              || (p.number === PARTS_PER_TANIWHA && crownedHere)
            const isCrown = p.number === PARTS_PER_TANIWHA
            const building = !isCrown && p.number === limbs + 1 && !!row?.is_building
            return (
              <div key={p.number} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0',
                opacity: held || building ? 1 : 0.38,
                borderTop: isCrown ? `1px solid ${accent}33` : undefined,
                marginTop: isCrown ? 5 : undefined,
                paddingTop: isCrown ? 11 : undefined,
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: 6, flexShrink: 0,
                  background: held ? accent : 'transparent',
                  border: held ? 'none' : `${building ? 1.5 : 1}px ${building ? 'dashed' : 'solid'} ${accent}80`,
                  color: held ? '#000' : accent,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontSize: 12,
                }}>
                  {p.number}
                </div>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: accent, fontWeight: building || isCrown ? 600 : 400 }}>
                    {p.name} {isCrown && <span style={{ opacity: 0.5, fontWeight: 400 }}>crown</span>}
                  </div>
                  {isCrown && (
                    <div style={{ fontSize: 11.5, color: accent, opacity: 0.6, marginTop: 1 }}>
                      {t.kind === 'whanau'
                        ? 'Bring in one player who reaches ten sessions'
                        : crownedHere
                        ? 'Earned'
                        : `Win ${WIN_TARGET} of ${EVENTS_PER_DOMAIN} — ${wins ?? 0} so far, ${winsToGo(wins ?? 0)} to go`}
                    </div>
                  )}
                </div>
                {!isCrown && (
                  <span style={{ fontSize: 12, color: accent, opacity: 0.5 }}>{p.english}</span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
