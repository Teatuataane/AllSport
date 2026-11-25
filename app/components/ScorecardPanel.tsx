'use client'

// ─── Kaiārahi panel: scorecard ───────────────────────────────────────────────
// Multi-location games step 13. Rules in lib/successMeasures.ts, reads in
// lib/successMeasuresData.ts. No migration: everything is read through the
// existing policies.
//
//   · A Kaiwhakawā sees All games first, then every game, each with reach
//     (new players this term by age, sex, ethnicity and deprivation).
//   · A Kaimahi or Kaiako sees the games they lead, without reach.
//
// `ScorecardView` takes props only (__tests__/scorecardPanel.test.tsx).

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { nzWallClock, addDays, slotLabel, sortWeekly, type Site, type WeeklyGame } from '@/lib/weeklyGames'
import { loadWeeklyBoard } from '@/lib/weeklyGamesData'
import {
  AGE_BANDS, attendance, ETHNIC_GROUPS, gamesFor, percent, QUINTILES, REASON_LABEL, reach, scorecard, SEXES, shown,
  termLabel, termOf, TREND_WEEKS, type Reach, type Scorecard,
} from '@/lib/successMeasures'
import { loadPeople, loadScoreData } from '@/lib/successMeasuresData'

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, color: '#777',
  letterSpacing: '0.12em', textTransform: 'uppercase',
}

export type ScoreCardRow = { key: string; title: string; sub: string; card: Scorecard; reach: Reach | null }

const one = (n: number | null) => (n == null ? '–' : n.toFixed(1).replace(/\.0$/, ''))

export function ScorecardView({ rows, term, head }: { rows: ScoreCardRow[]; term: string; head: boolean }) {
  return (
    <div id="scorecard" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', lineHeight: 1 }}>Scorecard</div>
      <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>
        Turn-up over the last {TREND_WEEKS} weeks; held, cancelled and new players for {term}.
      </div>
      {rows.length === 0 && <div style={{ fontSize: 13, color: '#666', marginTop: 12 }}>
        {head ? 'No games yet.' : 'No games of yours in the last eight weeks.'}
      </div>}
      {rows.map(r => <Card key={r.key} row={r} />)}
      <p style={{ fontSize: 13, color: '#777', margin: '14px 0 0', lineHeight: 1.5 }}>
        Regulars played 3 or more of the last 6 games. A comeback is a first-timer who came back at least twice
        within six weeks. Show-up is how many who said Coming played.{head ? ' Groups of 1 to 4 show as fewer than 5.' : ''}
      </p>
    </div>
  )
}

function Card({ row }: { row: ScoreCardRow }) {
  const c = row.card
  const max = Math.max(1, ...c.trend.map(t => t ?? 0))
  return (
    <section aria-label={row.title} style={{ borderTop: '1px solid #1e1e1e', paddingTop: 14, marginTop: 14 }}>
      <div style={{ fontSize: 17, fontWeight: 700 }}>{row.title}</div>
      {row.sub && <div style={{ fontSize: 13, color: '#888' }}>{row.sub}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10, marginTop: 10 }}>
        <Stat label="Turn-up" value={one(c.turnUp)} note={`a game · ${c.sessions8} game${c.sessions8 === 1 ? '' : 's'}`}>
          <div aria-hidden style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 24, marginTop: 6 }}>
            {c.trend.map((t, i) => (
              <span key={i} style={{ flex: 1, height: t == null ? 2 : Math.max(3, (24 * t) / max), background: t == null ? '#2a2a2a' : 'var(--blue)', borderRadius: 2 }} />
            ))}
          </div>
        </Stat>
        <Stat label="Regulars" value={String(c.regulars)} note="3 of last 6" />
        <Stat label="Comebacks" value={percent(c.comeback)} note={`${c.comeback.yes} of ${c.comeback.of} first-timers`} />
        <Stat label="Show-up" value={percent(c.showUp)} note={`${c.showUp.yes} of ${c.showUp.of} who said Coming`} />
        <Stat label="This term" value={String(c.held)} note={c.cancelled.length
          ? `held · cancelled ${c.cancelled.map(x => `${x.count} ${REASON_LABEL[x.reason] ?? x.reason}`).join(', ')}`
          : 'held · none cancelled'} />
        <Stat label="New this term" value={String(c.newPlayers)} note="first game ever" />
      </div>

      {row.reach && row.reach.total > 0 && <ReachTable reach={row.reach} />}
    </section>
  )
}

function Stat({ label, value, note, children }: { label: string; value: string; note: string; children?: ReactNode }) {
  return (
    <div style={{ background: '#0c0c0c', border: '1px solid #1e1e1e', borderRadius: 10, padding: 10 }}>
      <div style={labelStyle}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#888' }}>{note}</div>
      {children}
    </div>
  )
}

function ReachTable({ reach: r }: { reach: Reach }) {
  const group = (title: string, keys: readonly string[], m: Map<string, number>, hot?: string) => {
    const ks = [...keys, 'Unknown'].filter(k => (m.get(k as never) ?? 0) > 0 || keys.includes(k))
    return (
      <div style={{ minWidth: 0 }}>
        <div style={{ ...labelStyle, marginBottom: 4 }}>{title}</div>
        {ks.map(k => {
          const n = m.get(k as never) ?? 0
          if (k === 'Unknown' && n === 0) return null
          return (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13, color: k === hot ? 'var(--amber)' : '#ccc' }}>
              <span>{k === 'Q5' ? 'Q5 (most deprived)' : k === 'Q1' ? 'Q1 (least)' : k}</span><span>{shown(n)}</span>
            </div>
          )
        })}
      </div>
    )
  }
  return (
    <div style={{ marginTop: 12 }}>
      <div style={{ fontSize: 13, color: '#aaa', marginBottom: 6 }}>Reach: {shown(r.total)} new this term</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
        {group('Age', AGE_BANDS, r.age as Map<string, number>)}
        {group('Sex', SEXES.filter(s => s !== 'Unknown'), r.sex as Map<string, number>)}
        {group('Ethnicity', ETHNIC_GROUPS, r.ethnicity as Map<string, number>)}
        {group('Deprivation', QUINTILES, r.deprivation as Map<string, number>, 'Q5')}
      </div>
    </div>
  )
}

export default function ScorecardPanel({ head }: { head: boolean }) {
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<{ rows: ScoreCardRow[]; term: string } | null>(null)

  useEffect(() => {
    let gone = false
    ;(async () => {
      const user = await getSessionUser()
      if (!user) return
      const now = new Date()
      const today = nzWallClock(now).date
      const since = `${Number(today.slice(0, 4)) - 1}-01-01`
      const [board, data] = await Promise.all([
        loadWeeklyBoard(supabase, null, now),
        loadScoreData(supabase, since, addDays(today, -7 * TREND_WEEKS)),
      ])
      if (!board || !data || gone) return
      const att = attendance(data.sessions, data.played)
      const ids = new Set(gamesFor({ me: user.id, head, games: board.games, sessions: data.sessions, today }))
      const games = sortWeekly(board.games.filter(g => ids.has(g.id)))
      const people = head ? await loadPeople(supabase, [...att.first.keys()]) : null
      if (gone) return
      const siteName = (g: WeeklyGame) => board.sites.find((s: Site) => s.id === g.site_id)?.name ?? 'Game'
      const card = (gameId: string | null) => scorecard({ gameId, att, bookings: data.bookings, cancellations: data.cancellations, today })
      const rows: ScoreCardRow[] = [
        ...(head ? [{ key: 'all', title: 'All games', sub: '', card: card(null), reach: people && reach(att, null, people, today) }] : []),
        ...games.map(g => ({
          key: g.id, title: siteName(g), sub: slotLabel(g, now),
          card: card(g.id), reach: people && reach(att, g.id, people, today),
        })),
      ]
      setState({ rows, term: termLabel(termOf(today)) })
    })().catch(() => {})
    return () => { gone = true }
  }, [supabase, head])

  if (!state) return null
  return <ScorecardView rows={state.rows} term={state.term} head={head} />
}
