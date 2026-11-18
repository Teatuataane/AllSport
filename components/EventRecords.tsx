'use client'

// ─── Season event records, by domain (Tāne, 18 Nov 2026) ─────────────────────
// The best Men's, Women's and Juniors score in each event this season, from
// official games. The rules are in lib/eventRecords.ts. Loaded by
// /leaderboard as its own chunk (next/dynamic), because the roster it needs
// carries every event's how-to prose.
//
// One accordion per domain keeps 140-odd events scannable; a search box opens
// every domain with a match. A division chip on the page narrows the cells to
// that division.

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { loadSeasonResults } from '@/lib/leaderboardData'
import { eventRecords, POOLS, type Pool, type RecordResultRow, type EventRecord } from '@/lib/eventRecords'
import type { SeasonGame } from '@/lib/seasonColourBoard'
import { domainColor } from '@/lib/domainColours'
import DomainIcon from '@/components/DomainIcon'
import EventIcon from '@/components/EventIcon'

const POOL_LABEL: Record<Pool, string> = { men: 'Men', women: 'Women', juniors: 'Juniors' }
const POOL_COLOUR: Record<Pool, string> = { men: '#2371BB', women: '#EA4742', juniors: '#4DB26E' }

function Cell({ pool, rec }: { pool: Pool; rec: EventRecord | null }) {
  return (
    <div className="er-cell">
      <span className="er-pool" style={{ color: POOL_COLOUR[pool] }}>{POOL_LABEL[pool]}</span>
      {rec ? (
        <span className="er-rec">
          <span className="er-score">{rec.score}</span>
          {rec.level && <span className="er-level">{rec.level}</span>}
          <span className="er-name">{rec.name}</span>
        </span>
      ) : <span className="er-none">No score yet</span>}
    </div>
  )
}

export default function EventRecords({ games, players, pool, year }: {
  /** The year's finished, unvoided games. */
  games: readonly SeasonGame[]
  /** Eligible players: id to name and division. */
  players: ReadonlyMap<string, { name: string; division: string | null }>
  /** The page's division chip; null = all three. */
  pool: Pool | null
  year: number
}) {
  const [rows, setRows] = useState<RecordResultRow[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [query, setQuery] = useState('')

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const got = await loadSeasonResults(createClient(), games)
      if (cancelled) return
      setRows(got ?? [])
      setFailed(got == null)
    })()
    return () => { cancelled = true }
  }, [games])

  const domains = useMemo(() => rows ? eventRecords(rows, players) : [], [rows, players])
  const pools = pool ? [pool] : POOLS
  const q = query.trim().toLowerCase()

  const shown = useMemo(() => domains.map(d => ({
    ...d,
    events: q ? d.events.filter(e => e.name.toLowerCase().includes(q)) : d.events,
  })).filter(d => !q || d.events.length > 0), [domains, q])

  const toggle = (n: number) => setOpen(prev => {
    const next = new Set(prev)
    if (next.has(n)) next.delete(n)
    else next.add(n)
    return next
  })

  return (
    <div className="er">
      <style>{`
        .er { max-width: 720px; }
        .er-search { width: 100%; min-height: 44px; padding: 0 14px; margin: 0 0 14px; background: #0d0d0d; border: 1px solid #222; border-radius: 12px;
          color: #fff; font-family: var(--font-body); font-size: 16px; }
        .er-search::placeholder { color: #555; }
        .er-domain { border: 1px solid #1a1a1a; border-radius: 12px; background: #0d0d0d; margin-bottom: 8px; overflow: hidden; }
        .er-head { width: 100%; display: flex; align-items: center; gap: 12px; padding: 10px 14px; min-height: 56px; background: none; border: 0; cursor: pointer; text-align: left; color: #fff; }
        .er-head-name { flex: 1; min-width: 0; font-family: var(--font-label); font-weight: 700; font-size: 16px; letter-spacing: 0.04em; }
        .er-head-count { font-family: var(--font-label); font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase; color: #666; }
        .er-chev { display: inline-block; color: #888; font-size: 20px; line-height: 1; width: 20px; text-align: center; transition: transform .15s; }
        .er-event { display: grid; grid-template-columns: 32px minmax(0, 1fr); gap: 10px 12px; padding: 12px 14px; border-top: 1px solid #161616; }
        .er-event-name { font-family: var(--font-label); font-weight: 700; font-size: 15px; color: #eee; align-self: center; }
        .er-cells { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(var(--er-cols), minmax(0, 1fr)); gap: 8px; }
        .er-cell { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 8px 10px; background: #111; border-radius: 8px; }
        .er-pool { font-family: var(--font-label); font-weight: 700; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; }
        .er-rec { display: flex; flex-direction: column; min-width: 0; }
        .er-score { font-family: var(--font-display); font-size: 22px; line-height: 1.05; color: #fff; }
        .er-level, .er-name { font-family: var(--font-label); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .er-level { color: #888; }
        .er-name { color: #ccc; font-weight: 700; }
        .er-none { font-family: var(--font-label); font-size: 13px; color: #444; }
        @media (max-width: 560px) {
          .er-cells { grid-template-columns: 1fr; }
          .er-cell { flex-direction: row; align-items: baseline; gap: 10px; }
          .er-pool { width: 58px; flex-shrink: 0; }
          .er-rec { flex-direction: row; flex-wrap: wrap; align-items: baseline; gap: 2px 8px; }
          .er-score { font-size: 20px; }
        }
      `}</style>

      <input className="er-search" type="search" placeholder="Find an event" aria-label="Find an event"
        value={query} onChange={e => setQuery(e.target.value)} />

      {rows == null ? (
        <div style={{ height: 56 * 4, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12 }} />
      ) : failed ? (
        <div className="er-none" style={{ padding: '24px 0', fontSize: 15 }}>Could not load the {year} records. Refresh to try again.</div>
      ) : shown.length === 0 ? (
        <div className="er-none" style={{ padding: '24px 0', fontSize: 15 }}>No event matches.</div>
      ) : shown.map(d => {
        const isOpen = q !== '' || open.has(d.domainNumber)
        const scored = d.events.filter(e => pools.some(p => e.records[p])).length
        return (
          <div key={d.domainNumber} className="er-domain" style={{ borderLeft: `3px solid ${domainColor(d.domainNumber)}` }}>
            <button type="button" className="er-head" aria-expanded={isOpen} onClick={() => toggle(d.domainNumber)}>
              <DomainIcon domainName={d.domainName} domainNumber={d.domainNumber} size={32} />
              <span className="er-head-name">{d.domainName}</span>
              <span className="er-head-count">{scored} of {d.events.length} scored</span>
              <span className="er-chev" aria-hidden style={{ transform: isOpen ? 'rotate(90deg)' : undefined }}>&#9656;</span>
            </button>
            {isOpen && d.events.map(e => (
              <div key={e.slug} className="er-event">
                <EventIcon slug={e.slug} domainNumber={d.domainNumber} size={32} />
                <span className="er-event-name">{e.name}</span>
                <div className="er-cells" style={{ ['--er-cols' as string]: pools.length }}>
                  {pools.map(p => <Cell key={p} pool={p} rec={e.records[p]} />)}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
