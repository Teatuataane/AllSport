// ─── Play screen chrome ──────────────────────────────────────────────────────
// The pieces an official game and a PERSONAL GAME both draw with: the event
// list rows, the progress bar, the score formatter and the sheet's controls.
//
// Extracted from app/scoring/[sessionId]/page.tsx (September 2026) when
// personal games started using the same screen. Scoring has had ONE code path
// since the kaiwhakawā tab rebuild; this keeps that true for a workout too.

'use client'

import type React from 'react'
import { useEffect, useRef } from 'react'
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
  /** Drawn before the server confirmed it (lib/pendingResults.ts): it has no
      real id yet, so it cannot be edited or deleted. */
  pending?: boolean
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
  background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-md)',
  padding: '14px', color: 'var(--white)', fontSize: '20px', fontWeight: 'bold',
  width: '100%', boxSizing: 'border-box',
}

export const QES_LBL: React.CSSProperties = {
  fontSize: '12px', color: 'var(--grey)', letterSpacing: '0.14em', textTransform: 'uppercase',
  fontFamily: 'var(--font-label)', margin: '16px 2px 8px',
}
export const QES_CHIP: React.CSSProperties = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.08em',
  fontSize: '13px', color: 'var(--white)', background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
  borderRadius: 'var(--radius-pill)', padding: '0 14px', minHeight: '44px', cursor: 'pointer', flexShrink: 0,
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
}

/** How long a stepper is held before it starts repeating, and how fast it then goes. */
export const HOLD_DELAY_MS = 400
export const HOLD_REPEAT_MS = 90

/**
 * A big − or + beside a number. One step on press; held, it waits a moment
 * and then repeats until released, the finger slides off, or the browser
 * cancels the touch (v0.49.0.0). A click that did not start with a pointer
 * (the keyboard, a screen reader) is still one step.
 */
export function StepBtn({ children, onClick, disabled, label }: {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  /** What the button does, for a screen reader: "Add 2.5kg". */
  label?: string
}) {
  // The latest step, so a long hold reads the newest value on every repeat.
  const step = useRef(onClick)
  useEffect(() => { step.current = onClick }, [onClick])
  const delay = useRef<ReturnType<typeof setTimeout> | null>(null)
  const repeat = useRef<ReturnType<typeof setInterval> | null>(null)
  // A pointer press already stepped; the click the browser fires after it
  // must not step again.
  const pressed = useRef(false)
  const stop = () => {
    if (delay.current) clearTimeout(delay.current)
    if (repeat.current) clearInterval(repeat.current)
    delay.current = null
    repeat.current = null
  }
  useEffect(() => stop, [])

  return (
    <button className="press" disabled={disabled} aria-label={label}
      onPointerDown={e => {
        if (disabled || e.button !== 0) return
        pressed.current = true
        stop()
        step.current()
        delay.current = setTimeout(() => {
          repeat.current = setInterval(() => step.current(), HOLD_REPEAT_MS)
        }, HOLD_DELAY_MS)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={() => { stop(); pressed.current = false }}
      onContextMenu={e => e.preventDefault()}
      onClick={() => {
        if (pressed.current) { pressed.current = false; return }
        if (!disabled) onClick()
      }}
      style={{
        width: '56px', minHeight: '56px', flexShrink: 0, borderRadius: 'var(--radius-lg)',
        background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: disabled ? 'var(--grey)' : 'var(--white)',
        fontSize: '26px', fontFamily: 'var(--font-display)', cursor: disabled ? 'default' : 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{children}</button>
  )
}

/**
 * Small steps under a field, for when one stepper size does not fit: −5, −1,
 * +1, +5 on a weight beside the 2.5kg buttons. Each chip is one step.
 */
export function StepChips({ steps, onStep, unit = '' }: {
  steps: readonly number[]
  onStep: (delta: number) => void
  unit?: string
}) {
  return (
    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', marginTop: '8px' }}>
      {steps.map(d => (
        <button key={d} className="press" onClick={() => onStep(d)} style={{
          minWidth: '52px', minHeight: '40px', padding: '0 10px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
          background: 'var(--surface-2)', border: '1px solid var(--border-strong)', color: 'var(--grey-light)',
          fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 600, letterSpacing: '0.04em',
        }}>{d > 0 ? '+' : '−'}{Math.abs(d)}{unit}</button>
      ))}
    </div>
  )
}

export const QES_INP: React.CSSProperties = {
  flex: 1, minWidth: 0, background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: 'var(--radius-lg)',
  color: 'var(--white)', fontSize: '30px', fontFamily: 'var(--font-display)', textAlign: 'center',
  padding: '10px 4px', boxSizing: 'border-box',
}

// ─── Shared scoring-screen chrome ─────────────────────────────────────────────

export function sectionLabel(text: string) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 4px 8px', fontFamily: 'var(--font-label)', fontSize: '12px', color: 'var(--grey)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
      <span style={{ width: '14px', height: '3px', borderRadius: 'var(--radius-sm)', background: 'linear-gradient(90deg, var(--red), var(--amber), var(--pink), var(--purple), var(--blue), var(--green))' }} />
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
          flex: 1, height: `${height}px`, borderRadius: 'var(--radius-pill)',
          background: scoredIds.has(ev.id) ? (fillFor ? fillFor(ev) : domainColor(ev.domain_number)) : 'var(--border)',
          transition: 'background 0.3s',
        }} />
      ))}
    </div>
  )
}

// ─── Kaiwhakawā picker ────────────────────────────────────────────────────────
