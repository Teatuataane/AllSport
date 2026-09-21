'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import {
  sessionWins,
  type RatingEventRow, type RatingSessionRow, type RatingPlayerRow,
} from '@/lib/rating'
import {
  computePercentiles, strongestEvent, topDomain as pctTopDomain, eventPctLabel,
} from '@/lib/percentile'
import { gradeForRung, DOMAIN_COUNT, GRADES } from '@/lib/grading'
import { rankByColours } from '@/lib/colourBoard'
import { seasonMedals, rankMedals, type MedalRow, type MedalCount } from '@/lib/medalTable'
import { GradeDot } from '@/components/GradesCard'

/**
 * The colour cell, shared by the wide table and the narrow cards.
 *
 * It shows the overall colour a kaiwhakawā has CONFERRED: the lowest of the ten
 * domain colours, once all ten are held. Conferred colours are public
 * (grade_awards). A player's live, computed colours are not, because computing
 * them needs their bodyweight band and, for a junior, their sex. Until the
 * overall exists the cell counts the domains that hold a colour instead.
 */
function ColourCell({ player, size = 'wide' }: { player: EnrichedPlayer; size?: 'wide' | 'narrow' }) {
  const g = player.overall != null ? gradeForRung(player.overall) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
      {g && <GradeDot grade={g} size={size === 'wide' ? 10 : 9} />}
      <span style={{
        fontFamily: 'var(--font-label)', fontWeight: 700,
        fontSize: size === 'wide' ? '13px' : '12px',
        color: g ? '#ffffff' : player.domainsHeld > 0 ? '#999999' : '#444444',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {g ? g.name : player.domainsHeld > 0 ? `${player.domainsHeld} of ${DOMAIN_COUNT} domains` : 'No colour yet'}
      </span>
    </div>
  )
}

const DOMAIN_NAMES = Array.from({ length: 10 }, (_, i) => EVENTS.find(e => e.domainNumber === i + 1)?.domain ?? '')
const EVENT_DOMAIN = new Map(EVENTS.map(e => [e.name, e.domainNumber]))

type ActiveSession = {
  id: string
  session_date: string
  started_at: string | null
  location: string
  is_championship: boolean
}

type SessionResult = {
  player_id: string | null
  player_name: string | null
  placement: number | null
}

type SessionLeader = {
  name: string
  eventsCompleted: number
  totalPlacement: number
}

/** The roster. Read from players_public, the only public path to a name. */
type RosterPlayer = {
  id: string
  display_name: string | null
  username: string | null
  division: string | null
  is_guest: boolean | null
}

type StatsBundle = {
  results: { player_id: string | null; session_id: string; event_id: string; raw_score: number | null; placement: number | null }[]
  events: RatingEventRow[]
  sessions: RatingSessionRow[]
  players: RatingPlayerRow[]
}

const MEDAL_COLOURS = { gold: '#F9B051', silver: '#c0c0c0', bronze: '#cd7f32' } as const

/**
 * The season medal table. One grid for every width: six narrow columns fit a
 * phone, unlike the colours table, so it needs no separate card layout.
 */
function MedalTable({ data, accentColor, loading, year }: { data: MedalRow[]; accentColor: string; loading: boolean; year: number }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: '52px', background: '#111', border: '1px solid #1a1a1a', borderRadius: '8px', opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    )
  }
  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '8px' }}>No games yet in {year}</div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px' }}>Medals appear once a game in this division closes.</p>
      </div>
    )
  }
  // Fixed narrow columns: minmax tracks grow to their max before `1fr` gets
  // anything, which crushed the name column on a phone.
  const cols = '26px minmax(0, 1fr) 36px 36px 36px 46px'
  const head = { fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase' as const, textAlign: 'center' as const, overflow: 'hidden' }
  const count = (n: number, colour: string) => (
    <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', textAlign: 'center', color: n > 0 ? colour : '#2a2a2a' }}>{n}</div>
  )
  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: cols, gap: '4px', padding: '8px 10px' }}>
        <div style={{ ...head, color: '#444', textAlign: 'left' }}>#</div>
        <div style={{ ...head, color: '#444', textAlign: 'left' }}>Player</div>
        <div style={{ ...head, color: MEDAL_COLOURS.gold }}>1st</div>
        <div style={{ ...head, color: MEDAL_COLOURS.silver }}>2nd</div>
        <div style={{ ...head, color: MEDAL_COLOURS.bronze }}>3rd</div>
        <div style={{ ...head, color: '#444' }}>Games</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {data.map(p => (
          <div key={p.playerId} style={{
            display: 'grid', gridTemplateColumns: cols, gap: '4px', padding: '12px 10px', alignItems: 'center',
            border: '1px solid', borderColor: p.rank === 1 ? `${accentColor}33` : '#1a1a1a', background: '#0d0d0d', borderRadius: '8px',
          }}>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: p.rank <= 3 ? '#F9B051' : '#333333' }}>{p.rank}</div>
            <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '15px', color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
            {count(p.gold, MEDAL_COLOURS.gold)}
            {count(p.silver, MEDAL_COLOURS.silver)}
            {count(p.bronze, MEDAL_COLOURS.bronze)}
            <div style={{ fontFamily: 'var(--font-label)', fontSize: '15px', textAlign: 'center', color: '#555' }}>{p.games}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Shape returned by the `leaderboard_page(p_season)` RPC
// (supabase/migrations/20260915054550_retire_taniwha.sql). It still carries a
// seasonal `rankings` key from the points era; the board no longer reads it.
type LeaderboardPayload = {
  /** Conferred colours, from grade_awards. Absent against a database before the retirement migration. */
  grades?: { player_id: string; domain_number: number; rung: number }[]
  active_session: ActiveSession | null
  active_session_results: SessionResult[]
  stats: StatsBundle
}

type EnrichedPlayer = {
  rank: number
  username: string
  sessions: number
  wins: number
  topDomain: string
  topDomainPct: string
  topEvent: string
  topEventPct: string
  /** The overall conferred colour (the lowest domain), or null until all ten are held. */
  overall: number | null
  /** Domains holding a conferred colour. */
  domainsHeld: number
}

const DIVISION_MAP: Record<string, string> = {
  'all-divisions': '',
  juniors: 'Juniors',
  mens: "Men's",
  womens: "Women's",
  'masters-men': 'Masters Men',
  'masters-women': 'Masters Women',
  'grandmaster-men': 'Grandmaster Men',
  'grandmaster-women': 'Grandmaster Women',
}

const tabs = [
  { key: 'all-divisions', label: 'All-Divisions', color: '#F9B051' },
  { key: 'juniors', label: 'Juniors', color: '#4DB26E' },
  { key: 'mens', label: "Men's", color: '#2371BB' },
  { key: 'womens', label: "Women's", color: '#EA4742' },
  { key: 'masters-men', label: 'Masters Men', color: '#4DB26E' },
  { key: 'masters-women', label: 'Masters Women', color: '#EA4742' },
  { key: 'grandmaster-men', label: 'Grandmaster Men', color: '#888888' },
  { key: 'grandmaster-women', label: 'Grandmaster Women', color: '#F397C0' },
]

/** Podium sub-line: the overall colour, or how many domains hold one. */
function podiumColourLabel(p: EnrichedPlayer | undefined): string {
  if (!p) return '—'
  if (p.overall != null) return gradeForRung(p.overall).name
  if (p.domainsHeld > 0) return `${p.domainsHeld} of ${DOMAIN_COUNT} domains`
  return 'Getting started'
}

function LeaderboardTable({ data, accentColor, loading }: { data: EnrichedPlayer[]; accentColor: string; loading: boolean }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} style={{ height: '56px', background: '#111', border: '1px solid #1a1a1a', borderRadius: '4px', opacity: 1 - i * 0.15 }} />
        ))}
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '80px 0', color: '#444' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '32px', marginBottom: '8px' }}>No rankings yet</div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: '15px' }}>Rankings appear once sessions begin.</p>
      </div>
    )
  }

  return (
    <>
      {/* Top 3 podium */}
      {data.length >= 2 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', maxWidth: '680px', marginBottom: '40px' }}>
          {/* 2nd */}
          <div style={{ background: '#111111', border: '1px solid #c0c0c022', padding: '24px 16px', textAlign: 'center', marginTop: '28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#c0c0c0' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '44px', color: '#c0c0c0', lineHeight: 1 }}>2</div>
            <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', color: '#ffffff', marginTop: '6px' }}>{data[1]?.username ?? '—'}</div>
            <div style={{ color: '#F9B051', fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{podiumColourLabel(data[1])}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: '#666666', marginTop: '8px' }}>{data[1]?.sessions ?? 0} <span style={{ fontSize: '0.55em', color: '#555' }}>games</span></div>
          </div>
          {/* 1st */}
          <div style={{ background: 'linear-gradient(180deg, #0d0505 0%, #111111 100%)', border: `1px solid ${accentColor}44`, padding: '32px 16px 24px', textAlign: 'center', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: `linear-gradient(90deg, ${accentColor}, var(--amber))` }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '56px', color: accentColor, lineHeight: 1 }}>1</div>
            <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '16px', color: '#ffffff', marginTop: '6px' }}>{data[0]?.username ?? '—'}</div>
            <div style={{ color: '#F9B051', fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{podiumColourLabel(data[0])}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: accentColor, marginTop: '8px' }}>{data[0]?.sessions ?? 0} <span style={{ fontSize: '0.55em', color: '#555' }}>games</span></div>
          </div>
          {/* 3rd */}
          <div style={{ background: '#111111', border: '1px solid #cd7f3222', padding: '24px 16px', textAlign: 'center', marginTop: '28px', position: 'relative' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '2px', background: '#cd7f32' }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '44px', color: '#cd7f32', lineHeight: 1 }}>3</div>
            <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', color: '#ffffff', marginTop: '6px' }}>{data[2]?.username ?? '—'}</div>
            <div style={{ color: '#F9B051', fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: '3px' }}>{podiumColourLabel(data[2])}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: '#666666', marginTop: '8px' }}>{data[2]?.sessions ?? 0} <span style={{ fontSize: '0.55em', color: '#555' }}>games</span></div>
          </div>
        </div>
      )}

      {/* ── Narrow: one card per player ───────────────────────────────────────
          The wide table needs 860px inside a 342px column on a phone, so four
          of its eight columns were off-screen behind a scroll with no
          scrollbar, no fade and no affordance — including the Colour column
          the board is sorted by. A phone gets
          cards instead: rank, name and colour on one line, then the meta the
          table spends four columns on. */}
      <div className="lb-narrow" style={{ flexDirection: 'column', gap: '8px' }}>
        {data.map(player => (
          <div key={player.username + player.rank} style={{
            border: '1px solid', borderColor: player.rank === 1 ? `${accentColor}33` : '#1a1a1a',
            background: '#0d0d0d', borderRadius: '10px', padding: '13px 14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '11px' }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '24px', lineHeight: 1, flexShrink: 0,
                minWidth: '26px',
                color: player.rank <= 3 ? '#F9B051' : '#333333',
              }}>
                {player.rank}
              </span>
              <span style={{
                fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '16px',
                color: '#ffffff', flexGrow: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {player.username}
              </span>
              <span style={{ flexShrink: 0 }}>
                <ColourCell player={player} size="narrow" />
              </span>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
              marginTop: '9px', paddingLeft: '37px',
            }}>
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: '#666' }}>
                {player.sessions} game{player.sessions === 1 ? '' : 's'}
              </span>
              {player.wins > 0 && (
                <>
                  <span style={{ color: '#2a2a2a' }}>·</span>
                  <span style={{ fontFamily: 'var(--font-label)', fontSize: '12px', color: accentColor, fontWeight: 700 }}>
                    {player.wins} win{player.wins === 1 ? '' : 's'}
                  </span>
                </>
              )}
            </div>

            {(player.topDomain !== '—' || player.topEvent !== '—') && (
              <div style={{
                marginTop: '7px', paddingLeft: '37px',
                fontFamily: 'var(--font-label)', fontSize: '11.5px', color: '#777',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {player.topDomain !== '—' && (
                  <>{player.topDomain}{player.topDomainPct && ` ${player.topDomainPct}`}</>
                )}
                {player.topDomain !== '—' && player.topEvent !== '—' && ' · '}
                {player.topEvent !== '—' && (
                  <span style={{ color: player.topEventPct === '1st' ? '#F9B051' : '#777' }}>
                    {player.topEvent}{player.topEventPct && ` ${player.topEventPct}`}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Wide: the full table, unchanged. */}
      <div className="lb-wide" style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: '860px' }}>
          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '56px 1fr 90px 70px 150px 150px 110px 150px', gap: '16px', padding: '10px 24px' }}>
            {['#', 'Player', 'Games', 'Wins', 'Top Domain', 'Top Event', 'Domains', 'Colour'].map(h => (
              <div key={h} style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444444' }}>{h}</div>
            ))}
          </div>

          {/* Rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {data.map(player => (
              <div key={player.username + player.rank} style={{ display: 'grid', gridTemplateColumns: '56px 1fr 90px 70px 150px 150px 110px 150px', gap: '16px', padding: '14px 24px', alignItems: 'center', border: '1px solid', borderColor: player.rank === 1 ? `${accentColor}22` : '#1a1a1a', background: '#0d0d0d', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: player.rank <= 3 ? '#F9B051' : '#333333' }}>{player.rank}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '16px', color: '#ffffff' }}>{player.username}</div>
                <div style={{ color: '#555555', fontSize: '15px', fontFamily: 'var(--font-label)' }}>{player.sessions}</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: player.wins > 0 ? accentColor : '#333333' }}>{player.wins}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', color: player.topDomain === '—' ? '#333333' : '#cccccc' }}>
                  {player.topDomain}
                  {player.topDomainPct && <span style={{ color: '#777777', fontWeight: 400 }}> · {player.topDomainPct}</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '13px', color: player.topEvent === '—' ? '#333333' : '#cccccc' }}>
                  {player.topEvent}
                  {player.topEventPct && <span style={{ color: player.topEventPct === '1st' ? '#F9B051' : '#777777', fontWeight: player.topEventPct === '1st' ? 700 : 400 }}> · {player.topEventPct}</span>}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: player.domainsHeld > 0 ? '#ffffff' : '#333333' }}>{player.domainsHeld}<span style={{ fontSize: '14px', color: '#444' }}> / {DOMAIN_COUNT}</span></div>
                <ColourCell player={player} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

function computeLeader(results: SessionResult[]): SessionLeader | null {
  // Only count rows where we have a placement and a player name
  const valid = results.filter(r => r.placement != null && (r.player_name || r.player_id))
  if (valid.length === 0) return null

  const totals: Record<string, { name: string; total: number; count: number }> = {}
  for (const r of valid) {
    const key = r.player_id ?? r.player_name ?? 'unknown'
    const name = r.player_name ?? r.player_id ?? 'Unknown'
    if (!totals[key]) totals[key] = { name, total: 0, count: 0 }
    totals[key].total += r.placement!
    totals[key].count += 1
  }

  // Lowest total placement wins
  const sorted = Object.values(totals).sort((a, b) => a.total - b.total || b.count - a.count)
  if (sorted.length === 0) return null
  const leader = sorted[0]
  return { name: leader.name, eventsCompleted: leader.count, totalPlacement: leader.total }
}

export default function Leaderboard() {
  const [activeTab, setActiveTab] = useState('all-divisions')
  // Two boards over the same division tabs: colours (lifetime) and the season
  // medal table (this calendar year's 1st/2nd/3rd finishes).
  const [board, setBoard] = useState<'colours' | 'season'>('colours')
  const seasonYear = new Date().getFullYear()
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  // Conferred colours per player: domain -> highest colour held. This is what
  // the board ranks on (lib/colourBoard.ts).
  const [gradesByPlayer, setGradesByPlayer] = useState<Map<string, Map<number, number>>>(new Map())
  const [loading, setLoading] = useState(true)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [sessionLeader, setSessionLeader] = useState<SessionLeader | null>(null)
  const [statsData, setStatsData] = useState<StatsBundle | null>(null)

  // Per-player games and wins + percentile-derived top domain/event. All
  // lifetime: colours never reset, so neither does the board.
  const playerStats = useMemo(() => {
    if (!statsData) return null
    const wins = sessionWins(statsData.results)
    const games = new Map<string, Set<string>>()
    for (const r of statsData.results) {
      if (!r.player_id) continue
      const g = games.get(r.player_id) ?? new Set<string>()
      g.add(r.session_id)
      games.set(r.player_id, g)
    }
    const pct = computePercentiles(statsData.results, statsData.events, statsData.players)
    const out = new Map<string, { games: number; wins: number; topDomain: string; topDomainPct: string; topEvent: string; topEventPct: string }>()
    for (const p of statsData.players) {
      const mine = pct.get(p.id)
      const td = pctTopDomain(mine, EVENT_DOMAIN, DOMAIN_NAMES)
      const te = strongestEvent(mine, EVENT_DOMAIN)
      out.set(p.id, {
        games: games.get(p.id)?.size ?? 0,
        wins: wins.get(p.id) ?? 0,
        topDomain: td?.domainName ?? '—',
        topDomainPct: td ? `Top ${td.topPct}%` : '',
        topEvent: te?.eventName ?? '—',
        topEventPct: te ? eventPctLabel(te.ep) : '',
      })
    }
    return out
  }, [statsData])

  // ONE request for the whole page. This used to be four separate effects firing
  // seven concurrent PostgREST queries, which is what made the page slow: against
  // this project a request costs ~2.7s as one of seven in flight and ~134ms alone.
  // Conferred colours ride along in the same payload. See PERF_AGGREGATION_PLAN.md.
  //
  // Player NAMES come back inside this payload, joined server-side against
  // players_public. Do NOT reintroduce a PostgREST embed here — the
  // `players(display_name, username)` embed that used to live in this effect
  // reads the players BASE table, which 20260813000003 closed AND revoked the
  // anon grant on. Measured against production while it was still live:
  //
  //   rankings?select=...,players(display_name,username)
  //     -> 401 {"code":"42501","message":"permission denied for table players"}
  //   rankings?select=...  (no embed)
  //     -> 200, 20 rows
  //
  // It took the board DOWN rather than showing "Anonymous": a privilege error is
  // raised rather than filtered, and PostgREST fails the WHOLE request when an
  // embedded table is unreadable, so `rankings` came back empty too. When
  // debugging, look for a 401 with 42501 and an empty board, NOT null names.
  // (A pure RLS denial with the grant intact would be the silent, null-names
  // case.) A `from('players')` grep does not find an embed — grep `players(` too.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    const load = async () => {
      // ONE round trip. leaderboard_page() now heals expired sessions itself,
      // as its first statement, before reading anything (migration
      // 20260827211610).
      //
      // The heal matters: until it existed, a game nobody closed stayed
      // "active" forever and recorded no placements, because
      // award_session_points only fires on the is_active true -> false
      // transition. It derives expiry from started_at server-side, so it can
      // never end a game that is still running.
      //
      // It used to be a separate `await` in front of this one, because the heal
      // WRITES while leaderboard_page() was STABLE, and because the payload has
      // to observe the heal or it reports a just-ended session as still live.
      // Measured against production: 298 ms sequential, 237 ms in parallel
      // (the two requests contend), 172 ms as this single call. Running them
      // concurrently was the worst of both — it recovered a third of the time
      // and gave up the ordering guarantee.
      //
      // REQUIRES migration 20260827211610. Against an older database this still
      // returns the right payload; it just stops healing here, and pg_cron
      // picks the session up within five minutes.
      //
      // The roster runs alongside, not after: players_public is anon-readable
      // and the only public source of names. It used to arrive through the
      // seasonal `rankings` rows, which would have emptied the board every
      // January now that nothing about the board is seasonal.
      const [{ data, error }, rosterRes] = await Promise.all([
        supabase.rpc('leaderboard_page', { p_season: new Date().getFullYear() }),
        supabase.from('players_public').select('id, display_name, username, division, is_guest'),
      ])
      if (cancelled) return

      if (error || !data) {
        // Leave the board empty rather than half-populated.
        setLoading(false)
        return
      }

      const d = data as LeaderboardPayload
      setRoster(((rosterRes.data ?? []) as RosterPlayer[]).filter(p => !p.is_guest))

      // Conferred colours ride in the same payload (the retirement migration),
      // so the board stays one round trip. Absent against an older database.
      const held = new Map<string, Map<number, number>>()
      for (const a of d.grades ?? []) {
        const m = held.get(a.player_id) ?? new Map<number, number>()
        m.set(a.domain_number, Math.max(m.get(a.domain_number) ?? 0, a.rung))
        held.set(a.player_id, m)
      }
      setGradesByPlayer(held)
      setStatsData(d.stats)
      setActiveSession(d.active_session ?? null)
      setSessionLeader(d.active_session ? computeLeader(d.active_session_results ?? []) : null)
      setLoading(false)
    }

    load()

    return () => { cancelled = true }
  }, [])

  // Realtime for the live-session leader chip. Split from the initial load so the
  // subscription can key off the session id the payload above returned, and so a
  // score coming in refetches only this one small query — never the whole page.
  useEffect(() => {
    const sessionId = activeSession?.id
    if (!sessionId) return

    const supabase = createClient()
    const refresh = async () => {
      const { data } = await supabase
        .from('results')
        .select('player_id, player_name, placement')
        .eq('session_id', sessionId)
      setSessionLeader(computeLeader((data ?? []) as SessionResult[]))
    }

    const channel = supabase
      .channel(`leaderboard-session-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'results',
        filter: `session_id=eq.${sessionId}`,
      }, refresh)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [activeSession?.id])

  const getTabData = (tabKey: string): EnrichedPlayer[] => {
    const division = DIVISION_MAP[tabKey]
    const inTab = (d: string | null) => tabKey === 'all-divisions'
      || d === division || (tabKey === 'juniors' && d === 'Youth')
    // Only players who have played: a colour needs games in the room.
    const players = roster
      .filter(p => inTab(p.division) && (playerStats?.get(p.id)?.games ?? 0) > 0)
      .map(p => ({
        playerId: p.id,
        name: p.display_name || p.username || 'Anonymous',
        held: gradesByPlayer.get(p.id),
        games: playerStats?.get(p.id)?.games ?? 0,
      }))
    return rankByColours(players).map(r => {
      const stats = playerStats?.get(r.playerId)
      return {
        rank: r.rank,
        username: r.name,
        sessions: r.games,
        wins: stats?.wins ?? 0,
        topDomain: stats?.topDomain ?? '—',
        topDomainPct: stats?.topDomainPct ?? '',
        topEvent: stats?.topEvent ?? '—',
        topEventPct: stats?.topEventPct ?? '',
        overall: r.overall,
        domainsHeld: r.domainsHeld,
      }
    })
  }

  const medals = useMemo(
    () => (statsData ? seasonMedals(statsData.results, statsData.sessions, seasonYear) : new Map<string, MedalCount>()),
    [statsData, seasonYear],
  )

  // The medal table for a tab. A player sits under their CURRENT division, the
  // same rule the colours board uses; each placement was earned in the division
  // they were in on the day.
  const getMedalData = (tabKey: string): MedalRow[] => {
    const division = DIVISION_MAP[tabKey]
    const inTab = (d: string | null) => tabKey === 'all-divisions'
      || d === division || (tabKey === 'juniors' && d === 'Youth')
    return rankMedals(roster
      .filter(p => inTab(p.division) && medals.has(p.id))
      .map(p => ({ playerId: p.id, name: p.display_name || p.username || 'Anonymous', ...medals.get(p.id)! })))
  }

  const activeTabData = tabs.find(t => t.key === activeTab)!
  const tabData = getTabData(activeTab)

  return (
    <>
      <style>{`
        .rank-pill { display: flex; align-items: center; gap: 10px; padding: 10px 16px; background: #0d0d0d; border: 1px solid #1a1a1a; transition: background 0.2s; }
        .rank-pill:hover { background: #111111; }
        .tab-btn { font-family: var(--font-display); font-size: 22px; letter-spacing: 0.08em; padding: 12px 32px; cursor: pointer; border: 1px solid #1e1e1e; background: #0d0d0d; color: #555555; transition: all 0.2s; }
        .tab-btn:hover { color: #ffffff; border-color: #333; }
        .tab-btn.active { color: #ffffff; }
        /* 768px is the app's existing phone boundary — the same one
           .bottom-nav switches on in globals.css. Keep them in step. */
        .lb-narrow { display: flex; }
        .lb-wide { display: none; }
        @media (min-width: 769px) {
          .lb-narrow { display: none; }
          .lb-wide { display: block; }
        }
      `}</style>

      {/* Hero */}
      <section style={{ paddingTop: '152px', paddingBottom: '80px', background: '#000000', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Standings</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, marginBottom: '8px' }}>
            LEADER<br />
            <span className="rainbow-text">BOARD</span>
          </h1>
          <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />
          <p style={{ color: '#cccccc', fontSize: '20px', maxWidth: '560px', lineHeight: 1.7 }}>
            Two boards. <strong style={{ color: '#ffffff' }}>Colours</strong> are earned against published standards, confirmed by a kaiwhakawā and yours for good, so that board never resets. The <strong style={{ color: '#ffffff' }}>Season</strong> board counts every game you finish 1st, 2nd or 3rd in your division this year, and starts fresh each January.
          </p>
        </div>
      </section>

      {/* Active session banner */}
      {activeSession && (
        <section style={{ background: '#0a1a0a', borderTop: '3px solid #4DB26E', borderBottom: '1px solid #1e2e1e', padding: '28px 0' }}>
          <div className="container">
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              {/* Pulse dot */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <style>{`
                  @keyframes ping { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }
                  .pulse-ring { position: absolute; inset: 0; border-radius: 50%; background: #4DB26E; animation: ping 1.4s cubic-bezier(0,0,0.2,1) infinite; }
                `}</style>
                <div style={{ position: 'relative', width: '12px', height: '12px' }}>
                  <div className="pulse-ring" />
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#4DB26E', position: 'relative', zIndex: 1 }} />
                </div>
              </div>

              <div className="tag" style={{ margin: 0, color: '#4DB26E', borderColor: '#4DB26E22', background: '#4DB26E11' }}>
                Session in progress
              </div>

              {sessionLeader ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '32px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '2px' }}>Current Leader</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#ffffff', lineHeight: 1 }}>{sessionLeader.name}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '2px' }}>Total Placement</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#4DB26E', lineHeight: 1 }}>{sessionLeader.totalPlacement}</div>
                  </div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '2px' }}>Events Done</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: '#888', lineHeight: 1 }}>{sessionLeader.eventsCompleted} / 10</div>
                  </div>
                </div>
              ) : (
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '15px', color: '#555' }}>No scores recorded yet — session underway</div>
              )}

              {activeSession.is_championship && (
                <div className="tag" style={{ margin: 0, color: '#F9B051', borderColor: '#F9B05122', background: '#F9B05111' }}>
                  Championship
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Tabs + table */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: `3px solid ${activeTabData.color}` }}>
        <div className="container">
          <div role="group" aria-label="Board" style={{ display: 'inline-flex', gap: '4px', padding: '4px', marginBottom: '20px', background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '999px' }}>
            {([['colours', 'Colours'], ['season', `Season ${seasonYear}`]] as const).map(([key, text]) => (
              <button key={key} aria-pressed={board === key} onClick={() => setBoard(key)}
                style={{
                  minHeight: '44px', padding: '0 20px', borderRadius: '999px', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase',
                  background: board === key ? '#ffffff' : 'transparent', color: board === key ? '#000000' : '#777777',
                }}>
                {text}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '48px', flexWrap: 'wrap' }}>
            {tabs.map(tab => (
              <button key={tab.key} className={`tab-btn${activeTab === tab.key ? ' active' : ''}`} onClick={() => setActiveTab(tab.key)}
                style={{ background: activeTab === tab.key ? tab.color : '#0d0d0d', borderColor: activeTab === tab.key ? tab.color : '#1e1e1e', color: activeTab === tab.key ? '#ffffff' : '#555555', fontSize: '16px', padding: '10px 20px' }}>
                {tab.label}
              </button>
            ))}
          </div>
          <div className="tag">{activeTabData.label}</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 48px)', marginBottom: '16px' }}>
            <span style={{ color: activeTabData.color }}>{activeTabData.label.toUpperCase()}</span> {board === 'season' ? `SEASON ${seasonYear}` : 'RANKINGS'}
          </h2>

          {board === 'season' ? (
            <>
              <p style={{ color: 'var(--grey)', fontSize: '14px', lineHeight: 1.7, maxWidth: '680px', margin: '0 0 28px' }}>
                Every game finished 1st, 2nd or 3rd in your division this year, ranked the Olympic way: most 1sts first,
                then 2nds, then 3rds. Only the official ten events decide a game. Starts fresh every January.
              </p>
              <MedalTable data={getMedalData(activeTab)} accentColor={activeTabData.color} loading={loading} year={seasonYear} />
            </>
          ) : (<>

          {/* How the numbers work — comprehension helper */}
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '18px 22px', marginBottom: '32px', maxWidth: '780px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: '4px', background: 'var(--rainbow)' }} />
            <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--grey-light)', marginBottom: '8px', paddingLeft: '12px' }}>How to read this board</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px 24px', paddingLeft: '12px' }}>
              <p style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: 'var(--white)' }}>The order</strong> — overall colour first, then the colours held across your ten domains, then games played. Players who tie on all of them share a place.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: 'var(--white)' }}>Wins</strong> — games finished 1st in your division. Within a game, the lowest total placement across all 10 events wins.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                <strong style={{ color: 'var(--white)' }}>Top domain &amp; top event</strong> — where you rank highest against your division. <strong style={{ color: 'var(--white)' }}>Top X%</strong> means only that few players who’ve played it beat your best; <strong style={{ color: 'var(--white)' }}>1st</strong> means no one has. Open My events, under More, for the full breakdown.
              </p>
              <p style={{ color: 'var(--grey)', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                {(
                  <>
                    <strong style={{ color: 'var(--white)' }}>Domains &amp; colour</strong> — how many of your ten domains hold a colour, and your overall colour: the lowest of the ten, shown once a kaiwhakawā has confirmed all ten. Never lost. See the key below.
                  </>
                )}
              </p>
            </div>
          </div>

          <LeaderboardTable data={tabData} accentColor={activeTabData.color} loading={loading} />
          </>)}
        </div>
      </section>

      {/* The colour key: the twelve grades. The colours era (colour_awards)
          lives on in each player's play history. */}
    <section className="section" style={{ background: '#0a0a0a' }}>
      <div style={{ height: '3px', background: 'var(--rainbow)', marginTop: '-80px', marginBottom: '80px' }} />
      <div className="container">
        <div className="tag">The Ladder</div>
        <h2 style={{ fontSize: 'clamp(36px, 4vw, 56px)', marginBottom: '8px' }}>
          COLOUR <span className="rainbow-text">KEY</span>
        </h2>
        <div className="rainbow-line" style={{ width: '60px', marginBottom: '16px' }} />
        <p style={{ color: '#888888', fontSize: '15px', maxWidth: '620px', marginBottom: '10px', lineHeight: 1.7 }}>
          Twelve colours, earned against published standards in every event. A domain&apos;s colour is the highest
          one you meet in at least six of its events; your overall colour is the lowest of the ten.
        </p>
        <p style={{ color: '#666666', fontSize: '14px', maxWidth: '620px', marginBottom: '40px', lineHeight: 1.7 }}>
          Each colour is a share of the general population, not of this club, so nobody loses a colour because
          someone else joined. Uenuku is within reach of anyone who trains for years. Taniwha is one in a hundred.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '8px' }}>
          {GRADES.map(g => (
            <div key={g.rung} className="rank-pill">
              <GradeDot grade={g} size={16} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '17px', color: '#ffffff', lineHeight: 1.1 }}>{g.name}</div>
                <div style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#555555' }}>
                  {g.populationTarget == null ? 'Anyone' : g.inverted ? 'One in a hundred' : g.rainbow ? 'Years of training' : `Top ${g.populationTarget}%`}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: '24px' }}>
          <Link href="/koha" style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--green)', borderBottom: '1px solid var(--green)', paddingBottom: '2px' }}>
            Learn about Koha rewards →
          </Link>
        </div>
      </div>
    </section>

      {/* CTA */}
      <section style={{ padding: '80px 0', background: '#000000', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', marginBottom: '16px' }}>
            GET ON THE <span className="rainbow-text">BOARD</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px' }} />
          <p style={{ color: '#888888', fontSize: '16px', maxWidth: '400px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            The only way to appear on this leaderboard is to register and compete. Your first colour starts with your first session.
          </p>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: '20px' }}>Register Now</Link>
        </div>
      </section>
    </>
  )
}
