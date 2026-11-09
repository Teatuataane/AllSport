'use client'

// ─── The play screens' toast ─────────────────────────────────────────────────
// One bar at the foot of the screen for "score in", a PR, a new event, or a
// save that failed (v0.50.0.0). The live game and a personal workout each drew
// their own, in different sizes, radii and places; this is the one both use.
// The words and any buttons come from the screen; the toast owns the frame.

import type { ReactNode } from 'react'

export type ToastTone = 'done' | 'pr' | 'new' | 'error'

const EDGE: Record<ToastTone, string> = {
  done: 'var(--green)', pr: 'var(--amber)', new: 'var(--blue)', error: 'var(--red)',
}

export default function Toast({ tone, children, actions }: {
  tone: ToastTone
  /** The message. */
  children: ReactNode
  /** Buttons on the right, such as "Next" or "Try again". */
  actions?: ReactNode
}) {
  const loud = tone === 'pr' || tone === 'new'
  const edge = EDGE[tone]
  return (
    // An error must be heard at once; anything else waits its turn.
    <div role={tone === 'error' ? 'alert' : 'status'} style={{
      position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)',
      width: 'min(600px, calc(100vw - 32px))', zIndex: tone === 'error' ? 201 : 200,
      overflow: 'hidden', boxSizing: 'border-box',
      background: 'var(--surface-2)',
      border: `1px solid ${tone === 'done' ? 'var(--border-strong)' : `color-mix(in srgb, ${edge} 33%, transparent)`}`,
      borderLeft: `4px solid ${edge}`,
      borderRadius: 'var(--radius-md)', padding: actions ? '10px 10px 10px 16px' : '13px 16px',
      boxShadow: 'var(--shadow-lg)',
      animation: loud ? 'toastPop 0.45s var(--ease-out)' : undefined,
      display: 'flex', alignItems: 'center', gap: '10px',
    }}>
      {tone === 'pr' && (
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'var(--rainbow)' }} />
      )}
      <div style={{ flex: 1, minWidth: 0 }}>{children}</div>
      {actions}
    </div>
  )
}

/** The toast's message line, in the display face. */
export function ToastText({ children }: { children: ReactNode }) {
  return <div style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: 'var(--white)', letterSpacing: '0.02em' }}>{children}</div>
}

/** A pill button on the toast: blue to go on, red to try again. */
export function ToastButton({ onClick, tone = 'go', children }: { onClick: () => void; tone?: 'go' | 'retry'; children: ReactNode }) {
  return (
    <button className="press" onClick={onClick} style={{
      flexShrink: 0, maxWidth: '45%', minHeight: '44px', padding: '0 14px', borderRadius: 'var(--radius-pill)', cursor: 'pointer',
      background: tone === 'retry' ? 'var(--red)' : 'var(--blue)', border: 'none', color: 'var(--white)',
      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      fontFamily: 'var(--font-label)', fontSize: '13px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
    }}>{children}</button>
  )
}
