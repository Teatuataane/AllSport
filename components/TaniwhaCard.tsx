'use client'

// ─── The Taniwha card ────────────────────────────────────────────────────────
// The dashboard's centrepiece. Shows ONE thing well: the taniwha currently being
// earned, assembling limb by limb, with the three point figures that explain it.
//
// What is deliberately NOT here, after the August 2026 design review:
//   · the crown-condition sentence — it belongs beside the crown, on My Taniwha
//   · the choose/switch button — it lives in Taniwha History, which this opens
// A card that carries its own settings is a settings screen wearing a card.
//
// DEPLOY ORDER: `loadTaniwhaState` returns null if `player_taniwha` does not
// answer, and the dashboard then renders nothing rather than a broken card. The
// tables ship in 20260824220633 + 20260824222612. Verified against production
// before the migration: a missing table comes back as PGRST205 in `error`, not as
// a throw, and a missing COLUMN would come back as 42703 and take the whole query
// down — which is why nothing here selects a column it is not sure of.

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { DOMAIN_ORDER } from '@/lib/eventData'
import { formatNZDate } from '@/lib/dates'
import DomainIcon from '@/components/DomainIcon'
import TaniwhaFigure, { figureInk } from '@/components/TaniwhaFigure'
import {
  PARTS,
  PART_POINTS,
  BODY_PARTS_PER_TANIWHA,
  PARTS_PER_TANIWHA,
  WIN_TARGET,
  WHANAU,
  taniwhaBySlug,
  taniwhaForDomain,
  taniwhaCardStyle,
  taniwhaOnDark,
  bodyPartBudget,
  crownCapacity,
  limbsHeld,
  partFor,
  CROWN_PART,
  sessionsToGoLabel,
  GOOD_SESSION_POINTS_LOW,
  GOOD_SESSION_POINTS_HIGH,
  type Taniwha,
} from '@/lib/taniwha'
import { winsByDomain } from '@/lib/taniwhaAlerts'

const supabase = createClient()

export type PlayerTaniwhaRow = {
  taniwha_slug: string
  domain_number: number | null
  body_parts: number
  is_building: boolean
  crowned_at: string | null
  crown_order: number | null
  crowned_session_id: string | null
}

export type TaniwhaState = {
  rows: PlayerTaniwhaRow[]
  /** event_name -> times won. The >= 3 field rule lives in the view, not here. */
  winsByEvent: Record<string, number>
  points: number
}

/** Loads everything the card needs, or null if the schema is not there yet. */
export async function loadTaniwhaState(
  playerId: string,
  points: number,
): Promise<TaniwhaState | null> {
  const [pt, wins] = await Promise.all([
    supabase
      .from('player_taniwha')
      .select('taniwha_slug, domain_number, body_parts, is_building, crowned_at, crown_order, crowned_session_id')
      .eq('player_id', playerId),
    supabase.from('player_event_wins').select('event_name, wins').eq('player_id', playerId),
  ])

  if (pt.error) {
    console.warn('player_taniwha unavailable — taniwha card hidden', pt.error.message)
    return null
  }

  const winsByEvent: Record<string, number> = {}
  for (const w of (wins.data ?? []) as { event_name: string; wins: number }[]) {
    winsByEvent[w.event_name] = Number(w.wins)
  }
  return { rows: (pt.data ?? []) as PlayerTaniwhaRow[], winsByEvent, points }
}

// `limbsHeld` moved to lib/taniwha.ts (ladder maths, and testable there).
export { limbsHeld }

export default function TaniwhaCard({
  state,
  points,
  onOpenHistory,
}: {
  state: TaniwhaState
  points: number
  onOpenHistory: () => void
}) {
  const { rows } = state
  const crowned = rows.filter(r => r.crowned_at)
  const building = rows.find(r => r.is_building && !r.crowned_at) ?? null

  // With nothing under construction the card must NOT fall back to Whānau — a
  // player who has already crowned it would see their finished taniwha presented
  // as work in progress. It shows a choose-your-next face instead.
  const idle = !building
  const t: Taniwha = (building && taniwhaBySlug(building.taniwha_slug)) || WHANAU

  const limbs = limbsHeld(building)
  // partFor, not partByNumber: piece ten is the implement and differs per
  // taniwha, so partByNumber would tell everyone they earned a generic Taputapu.
  const nextLimb = limbs < BODY_PARTS_PER_TANIWHA ? partFor(t, limbs + 1) : partFor(t, CROWN_PART)
  const bodyDone = limbs >= BODY_PARTS_PER_TANIWHA

  // Parts earned but not yet placed, because nothing is being built. Derived,
  // never stored: budget minus what is assigned.
  const assigned = rows.reduce((n, r) => n + r.body_parts, 0)
  const banked = Math.max(bodyPartBudget(points) - assigned, 0)

  const card = idle
    ? { background: 'var(--surface)', color: 'var(--white)', border: '2px solid var(--border)' }
    : taniwhaCardStyle(t)
  const ink = (card.color as string) ?? '#ffffff'
  const inks = figureInk(t, ink)
  const rule = inks.ghostStroke

  // Points already spent on THIS taniwha, and progress toward the next limb.
  const pointsHere = limbs * PART_POINTS
  const towardNext = Math.max(points, 0) % PART_POINTS
  const nextPct = bodyDone ? 100 : Math.round((towardNext / PART_POINTS) * 100)

  const fmt = (n: number) => n.toLocaleString()

  return (
    <button
      onClick={onOpenHistory}
      style={{
        ...card,
        display: 'block', width: '100%', textAlign: 'left',
        borderRadius: 16, padding: 20, marginBottom: 16,
        cursor: 'pointer', position: 'relative', overflow: 'hidden',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.16em', fontWeight: 600, fontSize: 11,
        color: ink, opacity: 0.6,
      }}>
        {idle ? 'Nothing under construction' : 'Currently earning'}
      </div>

      <div style={{
        fontFamily: 'var(--font-display)', fontSize: 28, letterSpacing: '0.04em',
        color: ink, marginTop: 5, lineHeight: 1.05,
      }}>
        {idle ? 'Choose your next taniwha' : t.name}
      </div>
      {!idle && (
        <div style={{ fontSize: 13, color: ink, opacity: 0.72, marginTop: 3 }}>{t.gloss}</div>
      )}

      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600, fontSize: 10,
        color: ink, opacity: 0.45, marginTop: 7,
      }}>
        Tap for taniwha history
      </div>

      {idle ? (
        <div style={{ fontSize: 13, color: ink, opacity: 0.75, marginTop: 14, lineHeight: 1.5 }}>
          Your next pieces will build whichever taniwha you pick.
          {banked > 0 && ` ${banked} piece${banked === 1 ? '' : 's'} waiting.`}
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, margin: '16px 0 4px' }}>
            <TaniwhaFigure
              taniwha={t}
              limbsEarned={limbs}
              ink={inks.ink}
              ghost={inks.ghost}
              ghostStroke={inks.ghostStroke}
              width={150}
            />
            <div style={{ flexGrow: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, color: ink, lineHeight: 1 }}>
                {limbs}<span style={{ fontSize: 18, opacity: 0.5 }}> / {PARTS_PER_TANIWHA}</span>
              </div>
              <div style={{
                fontFamily: 'var(--font-label)', textTransform: 'uppercase',
                letterSpacing: '0.1em', fontWeight: 600, fontSize: 10,
                color: ink, opacity: 0.55, marginTop: 2,
              }}>
                Pieces
              </div>
              <div style={{ height: 1, background: rule, margin: '12px 0' }} />
              <div style={{
                fontFamily: 'var(--font-label)', textTransform: 'uppercase',
                letterSpacing: '0.1em', fontWeight: 600, fontSize: 10,
                color: ink, opacity: 0.55,
              }}>
                {bodyDone ? 'Body complete' : 'Currently building'}
              </div>
              <div style={{ fontSize: 14, color: ink, fontWeight: 600, marginTop: 3 }}>
                {nextLimb?.name}
              </div>
              <div style={{ fontSize: 12, color: ink, opacity: 0.6 }}>
                {bodyDone
                  ? `${nextLimb?.english} — earned, not bought`
                  : `${nextLimb?.english} · piece ${limbs + 1}`}
              </div>
            </div>
          </div>

          {/* The three numbers, all visible at once. */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8,
            marginTop: 14, paddingTop: 14, borderTop: `1px solid ${rule}`,
          }}>
            <Figure ink={ink} label="This taniwha" value={fmt(pointsHere)} />
            <Figure ink={ink} label="This limb"
                    value={`${fmt(towardNext)}`} suffix={`/${fmt(PART_POINTS)}`} />
            <Figure ink={ink} label="All time" value={fmt(points)} />
          </div>
          <div style={{ height: 5, borderRadius: 3, background: rule, marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${nextPct}%`, height: '100%', borderRadius: 3, background: ink }} />
          </div>

          {/* Points priced in games. Without this the whole ladder is a number
              with no denominator — see the design review's headline finding. */}
          {!bodyDone && (
            <div style={{ marginTop: 8, fontSize: 11.5, color: ink, opacity: 0.62, lineHeight: 1.45 }}>
              {sessionsToGoLabel(PART_POINTS - towardNext)} — a good session is worth{' '}
              {GOOD_SESSION_POINTS_LOW}–{GOOD_SESSION_POINTS_HIGH} points.
            </div>
          )}

          {banked > 0 && bodyDone && (
            <div style={{
              marginTop: 10, fontSize: 11, color: ink, opacity: 0.9,
              fontFamily: 'var(--font-label)', letterSpacing: '0.04em',
            }}>
              {banked} piece{banked === 1 ? '' : 's'} waiting
            </div>
          )}
        </>
      )}

      <div style={{
        position: 'absolute', top: 18, right: 20, textAlign: 'right',
      }}>
        {/* No denominator here. PARTS_PER_TANIWHA and MAX_CROWNS are both 11,
            so "0/11 Pieces" and "0/11 Crowned" sat on the same card meaning
            entirely different things. The label carries it. */}
        <div style={{ fontSize: 30, fontWeight: 'bold', color: ink, lineHeight: 1 }}>
          {crowned.length}
        </div>
        <div style={{
          fontFamily: 'var(--font-label)', textTransform: 'uppercase',
          fontSize: 11, color: ink, opacity: 0.6,
        }}>
          Crowned
        </div>
      </div>
    </button>
  )
}

function Figure({ ink, label, value, suffix }: {
  ink: string; label: string; value: string; suffix?: string
}) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: ink, lineHeight: 1 }}>
        {value}{suffix && <span style={{ fontSize: 12, opacity: 0.5 }}>{suffix}</span>}
      </div>
      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.1em', fontWeight: 600, fontSize: 10,
        color: ink, opacity: 0.7, marginTop: 2,
      }}>
        {label}
      </div>
    </div>
  )
}

// ── The picker ───────────────────────────────────────────────────────────────
// Moved off the card and onto Taniwha History. Same `choose_taniwha` RPC.

export function TaniwhaPicker({ state, points, onChanged }: {
  state: TaniwhaState
  points: number
  onChanged: () => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { rows, winsByEvent } = state
  const wins = winsByDomain(winsByEvent)
  const crowned = rows.filter(r => r.crowned_at)
  const roomLeft = crownCapacity(points) - crowned.length
  const takenDomains = new Set(rows.filter(r => r.crowned_at && r.domain_number).map(r => r.domain_number))

  const choose = async (domainNumber: number) => {
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('choose_taniwha', { p_domain_number: domainNumber })
    if (e) setError(e.message)
    else onChanged()
    setBusy(false)
  }

  if (takenDomains.size >= 10) return null

  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 12, padding: '14px 16px', marginBottom: 18,
    }}>
      <div style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.14em', fontWeight: 600, fontSize: 11,
        color: 'var(--text-muted)', marginBottom: 8,
      }}>
        Change what you are building
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
        Your pieces stay where you put them. Switching changes what your next pieces
        build, not what you already hold.
        {roomLeft <= 0 && ' You have no crown room until your next 10,000 points.'}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {DOMAIN_ORDER.map((name, i) => {
          const dn = i + 1
          const t = taniwhaForDomain(dn)!
          const row = rows.find(r => r.domain_number === dn)
          const done = !!row?.crowned_at
          const w = wins[dn] ?? 0
          return (
            <button
              key={dn}
              disabled={done || busy}
              onClick={() => choose(dn)}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, textAlign: 'left',
                padding: '10px 12px', borderRadius: 10, minHeight: 48,
                cursor: done ? 'default' : 'pointer',
                background: row?.is_building ? `${t.accent}1e` : 'var(--surface)',
                border: `1px solid ${row?.is_building ? `${t.accent}77` : '#1a1a1a'}`,
                opacity: done ? 0.45 : 1,
              }}
            >
              <DomainIcon domainName={name} domainNumber={dn} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--white)' }}>{t.name}</div>
                <div style={{
                  fontSize: 11, color: 'var(--text-muted)',
                  fontFamily: 'var(--font-label)', letterSpacing: '0.04em',
                }}>
                  {name} · {done ? 'crowned' : `${w}/${WIN_TARGET} wins`}
                  {row && !done && row.body_parts > 0 ? ` · ${row.body_parts}/${BODY_PARTS_PER_TANIWHA} pieces` : ''}
                </div>
              </div>
              {row?.is_building && (
                <div style={{
                  fontSize: 10, color: taniwhaOnDark(t), fontFamily: 'var(--font-label)',
                  fontWeight: 700, letterSpacing: '0.08em',
                }}>
                  BUILDING
                </div>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <div style={{
          background: '#2e0d0d', border: '1px solid var(--red)', borderRadius: 8,
          padding: '9px 12px', color: 'var(--red)', fontSize: 12, marginTop: 8,
        }}>
          {error}
        </div>
      )}
    </div>
  )
}

/**
 * Every crown, newest first. Crowns only, not limbs — `player_taniwha` stores a
 * count, not a row per limb, and 110 timeline entries would be noise anyway.
 */
export function TaniwhaTimeline({ state, sessions }: {
  state: TaniwhaState | null
  sessions: Record<string, { session_date: string; location: string | null }>
}) {
  if (!state) return null
  const crowns = state.rows
    .filter(r => r.crowned_at)
    .sort((a, b) => (b.crown_order ?? 0) - (a.crown_order ?? 0))
  if (crowns.length === 0) return null

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        fontSize: 11, color: '#555', fontFamily: 'var(--font-label)',
        letterSpacing: '0.1em', marginBottom: 8, textTransform: 'uppercase',
      }}>
        Taniwha crowned
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {crowns.map(r => {
          const t = taniwhaBySlug(r.taniwha_slug)
          if (!t) return null
          const s = r.crowned_session_id ? sessions[r.crowned_session_id] : undefined
          return (
            <div key={r.taniwha_slug} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'var(--surface)', border: '1px solid #1a1a1a',
              borderRadius: 8, padding: '9px 12px',
            }}>
              <div style={{ width: 10, height: 10, borderRadius: 3, flexShrink: 0, background: t.accent }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: taniwhaOnDark(t), fontWeight: 600 }}>{t.name}</div>
                <div style={{ fontSize: 11, color: '#555', fontFamily: 'var(--font-label)' }}>
                  {r.crowned_at ? formatNZDate(r.crowned_at.slice(0, 10)) : ''}
                  {s?.location ? ` · ${s.location}` : ''}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#555', fontFamily: 'var(--font-label)', flexShrink: 0 }}>
                #{r.crown_order}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export { PARTS }
