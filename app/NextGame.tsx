'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { nextScheduledSession } from '@/lib/schedule'
import { createClient } from '@/lib/supabase-browser'
import { loadWeeklyBoard } from '@/lib/weeklyGamesData'
import { findCards, nextListedGame } from '@/lib/findGame'
import { dateLabel, formatTime } from '@/lib/weeklyGames'

// The homepage is cached and rebuilt hourly, so "next game" cannot be rendered on
// the server: it would name Tuesday all of Wednesday. The server snapshot is null
// (the line's box is reserved, empty) and the browser fills it in on hydration,
// then refreshes it once a minute.
//
// Since v0.69.0.0 (Find a game) the line names the soonest listed game from the
// database, read once per visit, with its place. The fixed Tue/Thu/Sat slots in
// lib/schedule.ts show until that read lands, or if it fails.
function subscribe(onChange: () => void) {
  const id = window.setInterval(onChange, 60_000)
  return () => window.clearInterval(id)
}

function snapshot(): string {
  const { label, relative } = nextScheduledSession()
  return `${label} · ${relative}`
}

export default function NextGame() {
  const fixed = useSyncExternalStore(subscribe, snapshot, () => null)
  const [listed, setListed] = useState<string | null>(null)

  useEffect(() => {
    let gone = false
    const now = new Date()
    loadWeeklyBoard(createClient(), null, now).then(board => {
      if (gone || !board) return
      const next = nextListedGame(findCards({ games: board.games, sites: board.sites, notices: board.notices, now }))
      if (next) setListed(`${dateLabel(next.date, now)} ${formatTime(next.game.start_time)} · ${next.site.name}`)
    })
    return () => { gone = true }
  }, [])

  const text = fixed == null ? null : listed ?? fixed

  return (
    <div className="lp-next" aria-live="polite">
      <span className="lp-next-dot" />
      <span style={{ color: '#888' }}>Next game</span>
      <span style={{ color: '#fff', minWidth: '14ch' }}>{text ?? ' '}</span>
    </div>
  )
}
