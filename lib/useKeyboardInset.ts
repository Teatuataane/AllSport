'use client'

// ─── How much of the screen the on-screen keyboard covers ────────────────────
// A bottom sheet pinned with `position: fixed` does not move when a phone's
// keyboard opens, on iOS or on current Android Chrome, and `dvh` does not
// shrink for the keyboard. So a Submit button pinned to the sheet's bottom
// would sit under the keyboard. The visual viewport does shrink: the gap
// between it and the window is what the keyboard covers, and the sheet is
// lifted by that much (v0.49.0.0).
//
// Untestable in jsdom (it has no visualViewport); it returns 0 there and on any
// browser without one, which is the old behaviour.

import { useEffect, useState } from 'react'

export function useKeyboardInset(): number {
  const [inset, setInset] = useState(0)
  useEffect(() => {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    if (!vv) return
    const measure = () => {
      // Under 80px is a browser bar moving, not a keyboard.
      const covered = Math.round(window.innerHeight - vv.height - vv.offsetTop)
      setInset(covered > 80 ? covered : 0)
    }
    vv.addEventListener('resize', measure)
    vv.addEventListener('scroll', measure)
    return () => {
      vv.removeEventListener('resize', measure)
      vv.removeEventListener('scroll', measure)
    }
  }, [])
  return inset
}
