'use client'

// ─── The Taniwha card ────────────────────────────────────────────────────────
// The dashboard's grading card. Replaces the Colours card — but only once the
// data is there.
//
// DEPLOY ORDER: this returns null if `player_taniwha` does not answer, so the
// dashboard keeps rendering the old Colours card and the page never breaks. The
// tables ship in 20260824220633 + 20260824222612. Verified against production
// before the migration: a missing table comes back as PGRST205 in `error`, not
// as a throw, and a missing COLUMN would come back as 42703 and take the whole
// query down — which is why nothing here selects a column it is not sure of.

import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { DOMAIN_ORDER } from '@/lib/eventData'
import { formatNZDate } from '@/lib/dates'
import DomainIcon from '@/components/DomainIcon'
import {
  PARTS,
  BODY_PARTS_PER_TANIWHA,
  WIN_TARGET,
  EVENTS_PER_DOMAIN,
  MAX_CROWNS,
  WHANAU,
  taniwhaBySlug,
  taniwhaForDomain,
  taniwhaCardStyle,
  taniwhaOnDark,
  bodyPartBudget,
  crownCapacity,
  partFor,
  CROWN_PART,
  winsToGo,
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

/**
 * Loads everything the card needs, or null if the schema is not there yet.
 * Exported so the dashboard can share one fetch between the card and the
 * timeline in the history modal.
 */
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
    console.warn('player_taniwha unavailable — Colours card retained', pt.error.message)
    return null
  }

  const winsByEvent: Record<string, number> = {}
  for (const w of (wins.data ?? []) as { event_name: string; wins: number }[]) {
    winsByEvent[w.event_name] = Number(w.wins)
  }
  return { rows: (pt.data ?? []) as PlayerTaniwhaRow[], winsByEvent, points }
}

function crownConditionLabel(t: Taniwha, wins: number): { text: string; done: boolean } {
  if (t.kind === 'whanau') {
    return { text: 'Bring someone into the whānau — one player you invited, ten sessions in', done: false }
  }
  const togo = winsToGo(wins)
  return {
    text: togo === 0
      ? `Won ${wins} of ${EVENTS_PER_DOMAIN} — the crown is yours`
      : `Win ${WIN_TARGET} of ${EVENTS_PER_DOMAIN} — ${wins} so far, ${togo} to go`,
    done: togo === 0,
  }
}

// The dashboard owns the fetch (it needs the same answer to decide whether to
// render this card or the old Colours one), so this takes state as a prop
// rather than loading its own. One query, one source of truth for the decision.
export default function TaniwhaCard({
  state,
  points,
  onOpenHistory,
  onChanged,
}: {
  state: TaniwhaState
  points: number
  onOpenHistory: () => void
  onChanged: () => void
}) {
  const [picking, setPicking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { rows, winsByEvent } = state
  const wins = winsByDomain(winsByEvent)
  const crowned = rows.filter(r => r.crowned_at)
  const building = rows.find(r => r.is_building) ?? null
  // With nothing under construction the card must NOT fall back to Whānau — a
  // player who has already crowned it would see their finished taniwha
  // presented as work in progress. It shows a choose-your-next face instead.
  const buildingTaniwha: Taniwha =
    (building && taniwhaBySlug(building.taniwha_slug)) || WHANAU
  const idle = !building

  // Parts earned but not yet placed, because nothing is being built. Derived,
  // never stored: budget minus what is assigned.
  const assigned = rows.reduce((n, r) => n + r.body_parts, 0)
  const banked = Math.max(bodyPartBudget(points) - assigned, 0)

  const bodyParts = building?.body_parts ?? 0
  const bodyDone = bodyParts >= BODY_PARTS_PER_TANIWHA
  const nextPart = bodyDone
    ? partFor(buildingTaniwha, CROWN_PART)
    : partFor(buildingTaniwha, bodyParts + 1)
  const domainWins = building?.domain_number ? (wins[building.domain_number] ?? 0) : 0
  const condition = crownConditionLabel(buildingTaniwha, domainWins)
  const roomLeft = crownCapacity(points) - crowned.length
  // A crown needs its act AND its points. Saying "the crown is yours" while the
  // points slot is still ahead would promise something the server will refuse.
  const nextCrownPoints = (crowned.length + 1) * 10_000
  const crownLine = condition.done && roomLeft <= 0
    ? `Crown ready — ${(nextCrownPoints - points).toLocaleString()} pts to claim it`
    : condition.text

  const card: React.CSSProperties = idle
    ? { background: '#111111', color: '#ffffff', border: '2px solid #1e1e1e' }
    : taniwhaCardStyle(buildingTaniwha)
  const ink = (card.color as string) ?? '#fff'

  const choose = async (domainNumber: number) => {
    setBusy(true); setError('')
    const { error: e } = await supabase.rpc('choose_taniwha', { p_domain_number: domainNumber })
    if (e) setError(e.message)
    else { setPicking(false); onChanged() }
    setBusy(false)
  }

  const takenDomains = new Set(rows.filter(r => r.crowned_at && r.domain_number).map(r => r.domain_number))

  return (
    <>
      <div
        onClick={onOpenHistory}
        style={{ ...card, position: 'relative', overflow: 'hidden', borderRadius: '16px', padding: '22px', minHeight: '140px', cursor: 'pointer', marginBottom: '12px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', color: ink, letterSpacing: '0.04em', lineHeight: 1.05 }}>
              {idle ? 'Choose your next taniwha' : buildingTaniwha.name}
            </div>
            <div style={{ fontSize: '11px', color: ink, opacity: 0.6, fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginTop: '3px' }}>
              TANIWHA · TAP FOR HISTORY
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0, paddingLeft: '12px' }}>
            <div style={{ fontSize: '30px', fontWeight: 'bold', color: ink, lineHeight: 1 }}>
              {crowned.length}<span style={{ fontSize: '16px', opacity: 0.5 }}>/{MAX_CROWNS}</span>
            </div>
            <div style={{ fontSize: '11px', color: ink, opacity: 0.6, fontFamily: 'var(--font-label)' }}>
              crowned
            </div>
          </div>
        </div>

        {/* Nine body parts, one segment each. The tenth is the crown and is not
            a segment — it is the line underneath. */}
        {!idle && (
        <div style={{ display: 'flex', gap: '3px', marginBottom: '7px' }}>
          {PARTS.slice(0, BODY_PARTS_PER_TANIWHA).map(p => (
            <div key={p.number} title={`${p.number}. ${p.name} — ${p.english}`} style={{
              flex: 1, height: '6px', borderRadius: '3px',
              background: p.number <= bodyParts ? ink : 'rgba(0,0,0,0.22)',
              opacity: p.number <= bodyParts ? 0.9 : 1,
            }} />
          ))}
        </div>
        )}

        <div style={{ fontSize: '11px', color: ink, opacity: 0.75, fontFamily: 'var(--font-label)', letterSpacing: '0.04em' }}>
          {idle
            ? 'Your next parts will build whichever taniwha you pick.'
            : bodyDone
            ? crownLine
            : `${bodyParts} of ${BODY_PARTS_PER_TANIWHA} parts · next: ${nextPart?.name} (${nextPart?.english})`}
        </div>

        {/* Only ever true once the taniwha under construction is full, because
            sync tops the builder up first. Guarded anyway, so an odd state
            cannot produce "choose your next" while one is half-built. */}
        {banked > 0 && (idle || bodyDone) && (
          <div style={{ marginTop: '10px', fontSize: '11px', color: ink, opacity: 0.9, fontFamily: 'var(--font-label)', letterSpacing: '0.04em' }}>
            {banked} part{banked === 1 ? '' : 's'} waiting
          </div>
        )}
      </div>

      {/* Choose / switch. Outside the card so tapping it does not open the
          history modal. Hidden once every domain is crowned. */}
      {takenDomains.size < 10 && (
        <button
          onClick={() => setPicking(v => !v)}
          style={{
            width: '100%', marginBottom: '12px', padding: '11px 14px', cursor: 'pointer',
            background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px',
            color: '#888', fontFamily: 'var(--font-label)', fontSize: '12px',
            fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
          }}
        >
          {picking ? 'Close' : building ? 'Change which taniwha you are building' : 'Choose a taniwha to build'}
        </button>
      )}

      {picking && (
        <div style={{ marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '11px', color: '#666', fontFamily: 'var(--font-body)', lineHeight: 1.5, marginBottom: '4px' }}>
            Your parts stay where you put them. Switching changes what your next
            parts build, not what you have already earned.
            {roomLeft <= 0 && ' You have no crown room until your next 10,000 points.'}
          </div>
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
                  display: 'flex', alignItems: 'center', gap: '11px', textAlign: 'left',
                  padding: '10px 12px', borderRadius: '10px', cursor: done ? 'default' : 'pointer',
                  background: row?.is_building ? t.accent + '1e' : '#111',
                  border: `1px solid ${row?.is_building ? t.accent + '77' : '#1a1a1a'}`,
                  opacity: done ? 0.45 : 1,
                }}
              >
                <DomainIcon domainName={name} domainNumber={dn} size={34} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-body)' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: '11px', color: '#666', fontFamily: 'var(--font-label)', letterSpacing: '0.04em' }}>
                    {name} · {done ? 'crowned' : `${w}/${WIN_TARGET} wins`}
                    {row && !done && row.body_parts > 0 ? ` · ${row.body_parts}/${BODY_PARTS_PER_TANIWHA} parts` : ''}
                  </div>
                </div>
                {row?.is_building && (
                  <div style={{ fontSize: '10px', color: t.accent, fontFamily: 'var(--font-label)', fontWeight: 700, letterSpacing: '0.08em' }}>
                    BUILDING
                  </div>
                )}
              </button>
            )
          })}
          {error && (
            <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '9px 12px', color: '#EA4742', fontSize: '12px', fontFamily: 'var(--font-body)' }}>
              {error}
            </div>
          )}
        </div>
      )}
    </>
  )
}

/**
 * The taniwha half of the history modal: every crown, newest first.
 *
 * Crowns only, not parts. Parts have no award log — `player_taniwha` stores a
 * count, not a row per part — and 110 timeline entries would be noise anyway.
 * The colours-era timeline still renders above this from `colour_awards`, which
 * is left untouched precisely so that history survives.
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
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '8px' }}>
        Taniwha crowned
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        {crowns.map(r => {
          const t = taniwhaBySlug(r.taniwha_slug)
          if (!t) return null
          const s = r.crowned_session_id ? sessions[r.crowned_session_id] : undefined
          return (
            <div key={r.taniwha_slug} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#111', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '9px 12px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0, background: t.accent }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: taniwhaOnDark(t), fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                  {t.name}
                </div>
                <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)' }}>
                  {r.crowned_at ? formatNZDate(r.crowned_at.slice(0, 10)) : ''}
                  {s?.location ? ` · ${s.location}` : ''}
                </div>
              </div>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', flexShrink: 0 }}>
                #{r.crown_order}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
