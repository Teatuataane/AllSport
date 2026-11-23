'use client'

// ─── The top loading bar ─────────────────────────────────────────────────────
// A thin white line under the rainbow strip that creeps across while a page is
// changing or a page's fresh numbers are on their way. Players asked for a sign
// that something is happening: a slow page with no sign reads as broken, and
// people tap again or leave.
//
// Two things start it:
//  1. A tap on a link to another page of the site. Caught on the document in
//     the CAPTURE phase, because next/link calls preventDefault in its own
//     handler and a bubbling listener would see every Link as "handled". It
//     stops when the path changes, or after NAV_SAFETY_MS if the page never
//     changes (a handler that cancelled the change, a failed load).
//  2. A page saying it is waiting (lib/useLoadingBar.ts), even while a saved
//     copy is drawn (lib/pageCache.ts).
//
// It appears only once the wait passes SHOW_AFTER_MS, so a fast page never
// flashes it. The progress is invented (nobody knows how long the database will
// take): it moves quickly at first and slows as it nears the end, then jumps
// to full and fades when the work is done, the way most apps do it.

import { useEffect, useState, useSyncExternalStore } from 'react'
import { usePathname } from 'next/navigation'
import { isPageChangeClick, startLoading, subscribeLoading, isLoading } from '@/lib/loadingBar'
import { RAINBOW_HEIGHT } from '@/components/Navbar'

const SHOW_AFTER_MS = 150
const TRICKLE_MS = 250
const NAV_SAFETY_MS = 8000
const FADE_MS = 300

// The open page change, if any. Module scope, so the path effect can end what
// the click listener began without a ref written during render.
let endNavigation: (() => void) | null = null
let navTimer: ReturnType<typeof setTimeout> | undefined

function finishNavigation() {
  clearTimeout(navTimer)
  endNavigation?.()
  endNavigation = null
}

export default function LoadingBar() {
  const pathname = usePathname()
  const busy = useSyncExternalStore(subscribeLoading, isLoading, () => false)
  // 0 = hidden. Between 0 and 1 while running; 1 for the moment it completes.
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)

  // A tap on a link to another page starts it…
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null
      const a = target && typeof target.closest === 'function' ? target.closest('a') : null
      if (!a || !a.href) return
      const link = { href: a.href, target: a.target, hasDownload: a.hasAttribute('download') }
      if (!isPageChangeClick(e, link, window.location)) return
      finishNavigation()
      endNavigation = startLoading()
      navTimer = setTimeout(finishNavigation, NAV_SAFETY_MS)
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  // …and the new path ends it.
  useEffect(() => {
    finishNavigation()
  }, [pathname])

  // Show after a short delay, then creep towards 90%.
  useEffect(() => {
    if (!busy) return
    let trickle: ReturnType<typeof setInterval> | undefined
    const show = setTimeout(() => {
      setVisible(true)
      setProgress(p => (p > 0 && p < 1 ? p : 0.12))
      trickle = setInterval(() => setProgress(p => p + (0.9 - p) * 0.12), TRICKLE_MS)
    }, SHOW_AFTER_MS)
    return () => { clearTimeout(show); clearInterval(trickle) }
  }, [busy])

  // When the work is done the bar is drawn full (`shown` below), then fades…
  useEffect(() => {
    if (busy || !visible) return
    // Held full while it fades, so it never shrinks back on the way out.
    const fade = setTimeout(() => { setProgress(1); setVisible(false) }, TRICKLE_MS)
    return () => clearTimeout(fade)
  }, [busy, visible])

  // …and once faded, reset to empty without animating backwards.
  useEffect(() => {
    if (busy || visible || progress === 0) return
    const reset = setTimeout(() => setProgress(0), FADE_MS)
    return () => clearTimeout(reset)
  }, [busy, visible, progress])

  const shown = !busy && visible ? 1 : progress

  return (
    <div
      aria-hidden
      style={{
        position: 'fixed', top: RAINBOW_HEIGHT, left: 0, right: 0, height: 3,
        zIndex: 1002, pointerEvents: 'none',
        opacity: visible ? 1 : 0,
        transition: `opacity ${FADE_MS}ms ease`,
      }}
    >
      <div style={{
        height: '100%', width: '100%', background: 'var(--white)',
        boxShadow: '0 0 8px rgba(122, 180, 255, 0.9), 0 0 2px rgba(255, 255, 255, 0.9)',
        transformOrigin: 'left center',
        transform: `scaleX(${shown})`,
        transition: shown === 0 ? 'none' : `transform ${TRICKLE_MS}ms ease-out`,
      }} />
    </div>
  )
}
