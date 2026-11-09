// ─── The live game's banner: colour score and clock ──────────────────────────
// Its own component because the clock ticks every second (v0.48.0.0). While
// the tick lived in the scoring page, the whole page, open sheet and all,
// redrew every second; now only this banner does. The page hears from it once,
// when the clock reaches zero.

'use client'

import { useEffect, useRef, useState } from 'react'

const GAME_MINUTES = 100

function fmtCountdown(secs: number): string {
  const m = Math.floor(secs / 60)
  const s = secs % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

type Clock = { kind: 'none' } | { kind: 'before'; secs: number } | { kind: 'live'; secs: number }

function clockAt(startedAt: string | null, now: number): Clock {
  if (!startedAt) return { kind: 'none' }
  const start = new Date(startedAt).getTime()
  if (now < start) return { kind: 'before', secs: Math.ceil((start - now) / 1000) }
  return { kind: 'live', secs: Math.max(0, Math.floor((start + GAME_MINUTES * 60 * 1000 - now) / 1000)) }
}

export default function GameBanner({ startedAt, isActive, ended, colourScore, flash, onExpired }: {
  /** sessions.started_at; null until the session has loaded. */
  startedAt: string | null
  /** sessions.is_active as loaded. A game already closed never fires onExpired. */
  isActive: boolean
  /** The page's own "this game is over". */
  ended: boolean
  /** This player's colour score so far, or null. */
  colourScore: number | null
  /** The banner number's rise, while it animates. */
  flash: { from: number; to: number } | null
  /** Called once, when the clock reaches zero on a game still open. */
  onExpired: () => void
}) {
  const [now, setNow] = useState(() => Date.now())
  // The latest callback, read when the clock runs out, so a new function from
  // each page render does not restart the interval.
  const expired = useRef(onExpired)
  useEffect(() => { expired.current = onExpired }, [onExpired])

  useEffect(() => {
    if (!startedAt) return
    const end = new Date(startedAt).getTime() + GAME_MINUTES * 60 * 1000
    let fired = false
    const tick = () => {
      const t = Date.now()
      setNow(t)
      if (t >= end && isActive && !fired) { fired = true; expired.current() }
    }
    tick()
    const iv = setInterval(tick, 1000)
    return () => clearInterval(iv)
  }, [startedAt, isActive])

  // The banner sticks under the site bar (--site-bar-h, from Navbar) and the
  // tab bar sticks under the banner, so the tabs need the banner's real height.
  // A fixed 60px used to stand in for both, and the banner slid out of sight
  // under the site bar on scroll (v0.50.0.0). Published as a CSS variable on the page root,
  // not as page state, so a resize never redraws the page.
  const bar = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = bar.current
    if (!el) return
    const root = document.documentElement
    const publish = () => root.style.setProperty('--game-banner-h', `${el.offsetHeight}px`)
    publish()
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(publish)
    ro?.observe(el)
    return () => { ro?.disconnect(); root.style.removeProperty('--game-banner-h') }
  }, [])

  const clock = clockAt(startedAt, now)
  const timerColour = clock.kind === 'before' ? 'var(--purple)'
    : clock.kind === 'live' ? (clock.secs < 600 ? 'var(--red)' : clock.secs < 1800 ? 'var(--amber)' : 'var(--green)')
    : 'var(--green)'
  const timerDisplay = ended ? 'ENDED' : clock.kind === 'none' ? '--:--' : fmtCountdown(clock.secs)
  const statusLabel = ended ? 'SESSION ENDED'
    : clock.kind === 'before' ? 'STARTING SOON'
    : colourScore !== null ? 'COLOUR SCORE'
    : 'LIVE SESSION'

  return (
    <>
      <div ref={bar} style={{ background: 'var(--blue)', padding: '12px 16px', position: 'sticky', top: 'var(--site-bar-h, 0px)', zIndex: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', fontFamily: 'var(--font-label)' }}>
              {statusLabel}
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, fontFamily: 'var(--font-display)', letterSpacing: '0.05em', lineHeight: 1 }}>
              {flash ? (
                <span style={{ display: 'inline-block', animation: 'rankImprove 1.4s cubic-bezier(0.16,1,0.3,1)' }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '22px' }}>{flash.from}</span>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: '22px', margin: '0 6px' }}>→</span>
                  {flash.to}
                </span>
              ) : (
                colourScore ?? '—'
              )}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '2px', fontFamily: 'var(--font-label)' }}>
              Time Left
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color: timerColour, fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-display)', lineHeight: 1 }}>
              {timerDisplay}
            </div>
          </div>
        </div>
      </div>
      <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--red), var(--amber), var(--pink), var(--purple), var(--blue), var(--green))' }} />
    </>
  )
}
