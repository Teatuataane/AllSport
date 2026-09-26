// ─── Play screen chrome ──────────────────────────────────────────────────────
// The pieces an official game and a PERSONAL GAME both draw with: the event
// list rows, the progress bar, the score formatter and the sheet's controls.
//
// Extracted from app/scoring/[sessionId]/page.tsx (September 2026) when
// personal games started using the same screen. Scoring has had ONE code path
// since the kaiwhakawā tab rebuild; this keeps that true for a workout too.

'use client'

import type React from 'react'
import EventIcon, { domainColor } from '@/components/EventIcon'
import { type EventData } from '@/lib/eventData'
// formatPR lives in lib/scoreFormat.ts so server code and pure libs can use it
// without importing this client module. Re-exported for existing callers.
export { formatPR } from '@/lib/scoreFormat'

/**
 * An event as a play screen shows it. An official game's row IS a
 * session_events row; a personal game builds one from its plan, with the slug
 * as the id, so neither screen needs to know which it is looking at.
 */
export type PlayEvent = {
  id: string
  domain_number: number
  domain_name: string
  event_name: string
  event_slug: string
  input_mode: string
}

/**
 * One submission, as either store shapes it: a `results` row at a game, a
 * `workout_entries` row in a personal game. Only what the screen actually
 * draws or re-fills from is here.
 */
export type EntryRow = {
  id: string
  raw_score: number
  score_label: string
  difficulty_tier: string | null
  weight_kg: number | null
  reps: number | null
  time_seconds: number | null
  /** Only a personal game stores these; a game result re-fills from the columns above. */
  distance_m?: number | null
  exercise_variation?: string | null
  result_type: string | null
  opponent_name: string | null
  match_score: string | null
  is_pr?: boolean
}

export function sportWDL(results: readonly { raw_score: number }[]): string {
  const w = results.filter(r => r.raw_score === 2).length
  const d = results.filter(r => r.raw_score === 1).length
  const l = results.filter(r => r.raw_score === 0).length
  const parts: string[] = []
  if (w > 0) parts.push(`${w}W`)
  if (d > 0) parts.push(`${d}D`)
  if (l > 0) parts.push(`${l}L`)
  return parts.join(' ') || '–'
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0])
}

export const INP: React.CSSProperties = {
  background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '8px',
  padding: '14px', color: '#fff', fontSize: '20px', fontWeight: 'bold',
  width: '100%', boxSizing: 'border-box',
}

export const QES_LBL: React.CSSProperties = {
  fontSize: '11px', color: '#777', letterSpacing: '0.14em', textTransform: 'uppercase',
  fontFamily: 'var(--font-label)', margin: '16px 2px 8px',
}
export const QES_CHIP: React.CSSProperties = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em',
  fontSize: '13px', color: '#fff', background: '#161616', border: '1px solid #2a2a2a',
  borderRadius: '999px', padding: '0 14px', minHeight: '44px', cursor: 'pointer', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

export function StepBtn({ children, onClick, disabled }: { children: React.ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '56px', minHeight: '56px', flexShrink: 0, borderRadius: '14px',
      background: '#181818', border: '1px solid #2a2a2a', color: disabled ? '#444' : '#fff',
      fontSize: '26px', fontFamily: 'var(--font-display)', cursor: disabled ? 'default' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>{children}</button>
  )
}

export const QES_INP: React.CSSProperties = {
  flex: 1, minWidth: 0, background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '14px',
  color: '#fff', fontSize: '30px', fontFamily: 'var(--font-display)', textAlign: 'center',
  padding: '10px 4px', boxSizing: 'border-box',
}

// ─── Shared scoring-screen chrome ─────────────────────────────────────────────

export function sectionLabel(text: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 4px 8px', fontFamily: 'var(--font-label)', fontSize: '11.5px', color: '#777', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
      <span style={{ width: '14px', height: '3px', borderRadius: '2px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />
      {text}
    </div>
  )
}

export function ProgressSegments({ events, scoredIds, height = 8, fillFor }: {
  events: readonly PlayEvent[]
  scoredIds: ReadonlySet<string>
  height?: number
  /** A scored segment's fill. Defaults to the domain colour; the live game passes the grade. */
  fillFor?: (ev: PlayEvent) => string
}) {
  return (
    <div style={{ display: 'flex', gap: '3px' }}>
      {events.map(ev => (
        <div key={ev.id} style={{
          flex: 1, height: `${height}px`, borderRadius: '99px',
          background: scoredIds.has(ev.id) ? (fillFor ? fillFor(ev) : domainColor(ev.domain_number)) : '#1e1e1e',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}

// ─── Kaiwhakawā picker ────────────────────────────────────────────────────────
