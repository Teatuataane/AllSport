'use client'

// ─── HOME: covers to claim ───────────────────────────────────────────────────
// "Every eligible Kaiārahi is told" (MULTI_LOCATION_PLAN.md, Roster and cover).
// Until push and email land, being told means this card on HOME: the covers
// this Kaiārahi could claim, and for a Kaiwhakawā the ones still unfilled 48
// hours out. Read once per visit, only for a Kaiārahi; links to the panel.
//
// Step 8 adds "Only 2 coming. Still on?" for the Kaiārahi leading a game in
// the next two hours (a Kaiwhakawā sees it for any game nobody leads), so they
// can cancel with the reason "Not enough players" before people travel.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { loadWeeklyBoard, gamesV2Live } from '@/lib/weeklyGamesData'
import { dateLabel, dayStatus, formatTime, nextGameDate, nzWallClock } from '@/lib/weeklyGames'
import { countsKey, fewComingPrompt, FEW_HOURS } from '@/lib/bookings'
import { loadCounts } from '@/lib/bookingsData'
import { loadOwnKaiarahi } from '@/lib/kaiarahiData'
import { leadFor, minutesUntil, openCovers, rosterWindow, unfilledAlerts, untilLabel } from '@/lib/roster'
import { loadRoster } from '@/lib/rosterData'
import type { KaiarahiLevel } from '@/lib/kaiarahi'

type Line = { key: string; text: string; urgent: boolean }

export default function CoverAlertCard({ userId, level }: { userId: string; level: KaiarahiLevel | null | undefined }) {
  const [lines, setLines] = useState<Line[]>([])

  useEffect(() => {
    if (!level) return
    let cancelled = false
    const supabase = createClient()
    const now = new Date()
    const { from, to } = rosterWindow(now)
    Promise.all([
      loadWeeklyBoard(supabase, null),
      loadRoster(supabase, from, to),
      loadOwnKaiarahi(supabase, userId, null, nzWallClock(now).date),
    ]).then(async ([board, roster, own]) => {
      if (cancelled || !board || !gamesV2Live(board) || !roster) return
      const site = (id: string) => board.sites.find(s => s.id === id)?.name ?? ''
      const me = { id: userId, level: own.level ?? level, checksCurrent: own.checksCurrent }
      const out: Line[] = []
      if (me.level === 'head') {
        for (const a of unfilledAlerts(board.games, roster, now)) {
          out.push({
            key: `u-${a.row.id}`, urgent: a.stage === 'decide',
            text: `Unfilled: ${dateLabel(a.date, now)} ${formatTime(a.game.start_time)} · ${site(a.game.site_id)}, starts ${untilLabel(a.minutes)}`,
          })
        }
      }
      for (const c of openCovers(board.games, roster, me, now)) {
        if (out.some(l => l.key === `u-${c.row.id}`)) continue
        out.push({
          key: `c-${c.row.id}`, urgent: false,
          text: `Cover needed: ${dateLabel(c.date, now)} ${formatTime(c.game.start_time)} · ${site(c.game.site_id)}`,
        })
      }
      // Few coming: games this Kaiārahi leads that start within two hours.
      const soon = board.games
        .map(g => ({ g, date: nextGameDate(g, now) }))
        .filter(({ g, date }) => {
          const m = minutesUntil(g, date, now)
          if (m <= 0 || m > FEW_HOURS * 60) return false
          const lead = leadFor(g, date, roster)
          return lead === userId || (lead === null && me.level === 'head')
        })
      if (soon.length > 0) {
        const counts = await loadCounts(supabase, soon.map(({ g, date }) => ({ gameId: g.id, date })))
        if (cancelled) return
        for (const { g, date } of soon) {
          const ask = fewComingPrompt(g, date, counts?.get(countsKey(g.id, date)), now, dayStatus(g.id, date, board.notices).cancelled)
          if (ask) out.unshift({ key: `f-${g.id}`, urgent: true, text: `${ask} ${formatTime(g.start_time)} · ${site(g.site_id)}` })
        }
      }
      setLines(out.slice(0, 4))
    }).catch(() => {})
    return () => { cancelled = true }
  }, [userId, level])

  if (lines.length === 0) return null
  const urgent = lines.some(l => l.urgent)
  return (
    <Link href="/judge#covers" style={{
      display: 'block', textDecoration: 'none', color: 'var(--white)', marginBottom: 18,
      border: `1px solid ${urgent ? 'var(--red)' : 'var(--amber)'}`, borderRadius: 16, padding: 16, background: '#151208',
    }}>
      {lines.map(l => (
        <div key={l.key} style={{ fontSize: 14, marginTop: 4, color: l.urgent ? 'var(--red)' : '#eee' }}>{l.text}</div>
      ))}
      <div style={{
        fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.1em',
        textTransform: 'uppercase', color: urgent ? 'var(--red)' : 'var(--amber)', marginTop: 10,
      }}>Open the roster →</div>
    </Link>
  )
}
