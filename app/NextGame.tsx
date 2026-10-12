'use client'

import { useSyncExternalStore } from 'react'
import { nextScheduledSession } from '@/lib/schedule'

// The homepage is cached and rebuilt hourly, so "next game" cannot be rendered on
// the server: it would name Tuesday all of Wednesday. The server snapshot is null
// (the line's box is reserved, empty) and the browser fills it in on hydration,
// then refreshes it once a minute.
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(id)
}

function snapshot(): string {
  const { label, relative } = nextScheduledSession()
  return `${label} · ${relative}`
}

export default function NextGame() {
  const text = useSyncExternalStore(subscribe, snapshot, () => null)

  return (
    <div className="lp-next" aria-live="polite">
      <span className="lp-next-dot" />
      <span style={{ color: '#888' }}>Next game</span>
      <span style={{ color: '#fff', minWidth: '14ch' }}>{text ?? ' '}</span>
    </div>
  )
}
