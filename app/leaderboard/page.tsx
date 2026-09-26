'use client'

// ─── /leaderboard ────────────────────────────────────────────────────────────
// The board exists so players who could never play together — a Grandmaster
// woman, a U14 boy, a Men's player — can compete anyway. Settled with Tāne on
// 2026-09-25. ONE board, SEASON: this calendar year, every official event in
// every finished game scores the colour rung its result reached, summed. The
// colour ladder already shifts for age and sex and scales strength by
// bodyweight, so the points are comparable across every division.
//
// Each card also shows the player's conferred colour and their best and worst
// domain by the standards. A lifetime Skill board (the average domain colour)
// was built and removed the same day, at Tāne's call.
//
// Both numbers are computed on the server by the recheck route (strength rungs
// need the private bodyweight) and published in player_domain_colours /
// player_season_points. This page only reads and ranks them. All-Divisions
// opens first.

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { gradeForRung, DOMAIN_COUNT } from '@/lib/grading'
import { rankBy, bestAndWorst } from '@/lib/leaderboardScores'
import { colourStanding, displayOverall } from '@/lib/colourBoard'
import { loadGameCounts } from '@/lib/gameCounts'
import { RAINBOW, DOMAIN_COLORS } from '@/lib/domainColours'
import { GradeDot } from '@/components/GradeDot'
import DomainIcon from '@/components/DomainIcon'

// Literal, not derived from EVENTS: importing lib/eventData.ts would ship the
// how-to prose for every event to a page that needs ten names.
const DOMAIN_NAMES = ['Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Anaerobic Endurance',
  'Aerobic Endurance', 'Flexibility', 'Body Awareness', 'Coordination', 'Aim & Precision']

type ActiveSession = {
  id: string
  session_date: string
  started_at: string | null
  location: string
  is_championship: boolean
}

type SessionResult = { player_id: string | null; player_name: string | null; placement: number | null }
type SessionLeader = { name: string; eventsCompleted: number; totalPlacement: number }

// Shape returned by the `leaderboard_page(p_season)` RPC. Called for the
// active game and because it heals expired sessions first (20260827211610);
// its `stats` bundle is no longer read here.
type LeaderboardPayload = {
  /** Conferred colours, from grade_awards. Absent against a database before the retirement migration. */
  grades?: { player_id: string; domain_number: number; rung: number }[]
  active_session: ActiveSession | null
  active_session_results: SessionResult[]
}

/** The roster. Read from players_public, the only public path to a name. */
type RosterPlayer = {
  id: string
  display_name: string | null
  username: string | null
  division: string | null
  is_guest: boolean | null
  is_active: boolean | null
}

type DomainColoursRow = { player_id: string; domain_rungs: number[] }
type SeasonPointsRow = { player_id: string; points: number; games: number }

type BoardRow = {
  playerId: string
  name: string
  division: string | null
  domainRungs: number[]
  points: number
  games: number
  /** Overall CONFERRED colour (average of the ten domains, rounded down), or null while it is Mā. */
  overall: number | null
}

const tabs = [
  { key: 'all-divisions', label: 'All-Divisions', division: null, color: '#F9B051' },
  { key: 'mens', label: "Men's", division: "Men's", color: '#2371BB' },
  { key: 'womens', label: "Women's", division: "Women's", color: '#EA4742' },
  { key: 'juniors', label: 'Juniors', division: 'Juniors', color: '#4DB26E' },
  { key: 'masters-men', label: 'Masters Men', division: 'Masters Men', color: '#2371BB' },
  { key: 'masters-women', label: 'Masters Women', division: 'Masters Women', color: '#EA4742' },
  { key: 'grandmaster-men', label: 'Grandmaster Men', division: 'Grandmaster Men', color: '#B87DB5' },
  { key: 'grandmaster-women', label: 'Grandmaster Women', division: 'Grandmaster Women', color: '#F397C0' },
] as const

const SHORT_DIVISION: Record<string, string> = {
  "Men's": 'Men', "Women's": 'Women', Juniors: 'Junior', Youth: 'Junior',
  'Masters Men': 'Masters M', 'Masters Women': 'Masters W',
  'Grandmaster Men': 'Grandmaster M', 'Grandmaster Women': 'Grandmaster W',
}

const inTab = (division: string | null, tab: typeof tabs[number]) =>
  tab.division == null || division === tab.division || (tab.division === 'Juniors' && division === 'Youth')

/** The player's colour: the overall one CONFERRED, or Mā, where every player starts. */
function ColourChip({ rung, size = 'md' }: { rung: number | null; size?: 'sm' | 'md' }) {
  const g = gradeForRung(rung ?? 0)
  return (
    <span className="lb-colour" style={{ fontSize: size === 'sm' ? 11 : 12 }}>
      <GradeDot grade={g} size={size === 'sm' ? 9 : 11} />
      {g.name}
    </span>
  )
}

/** One domain with its colour: "BEST · [icon] Power · ● Kōwhai". */
function DomainStat({ kind, index, rung, compact = false }: { kind: 'Best' | 'Worst'; index: number; rung: number; compact?: boolean }) {
  const g = rung > 0 ? gradeForRung(rung) : null
  const name = DOMAIN_NAMES[index]
  return (
    <div className={compact ? 'lb-dstat lb-dstat-compact' : 'lb-dstat'} title={`${kind} domain: ${name}, ${g ? g.name : 'no colour yet'}`}>
      <span className="lb-dstat-label" style={{ color: kind === 'Best' ? '#4DB26E' : '#EA4742' }}>{kind}</span>
      <DomainIcon domainName={name} domainNumber={index + 1} size={compact ? 22 : 26} />
      <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span className="lb-dstat-name">{name}</span>
        <span className="lb-dstat-grade">
          {g ? <GradeDot grade={g} size={8} /> : null}
          {g ? g.name : 'Not yet'}
        </span>
      </span>
    </div>
  )
}

function Banner() {
  return (
    <section className="lb-banner">
      <div className="lb-grid" aria-hidden />
      {DOMAIN_COLORS.slice(0, 6).map((c, i) => (
        <span key={i} aria-hidden className="lb-glow" style={{ background: c, left: `${8 + i * 16}%`, animationDelay: `${i * -1.3}s` }} />
      ))}
      <div className="container lb-banner-inner">
        <h1 className="lb-title">
          LEADER<span className="rainbow-text">BOARD</span>
        </h1>
        <img
          className="lb-crest"
          src="/logo-hero-440.webp"
          srcSet="/logo-hero-440.webp 440w, /logo-hero-880.webp 880w"
          sizes="(max-width: 768px) 60vw, 360px"
          width={440}
          height={265}
          alt=""
          decoding="async"
        />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 5, background: RAINBOW }} />
    </section>
  )
}

function LiveGame({ session, leader }: { session: ActiveSession; leader: SessionLeader | null }) {
  const stat = (label: string, value: React.ReactNode, color = '#fff') => (
    <div>
      <div style={{ fontFamily: 'var(--font-label)', fontSize: 11, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#5a7a5a', marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, color, lineHeight: 1 }}>{value}</div>
    </div>
  )
  return (
    <Link href={`/scoring/${session.id}`} style={{ display: 'block', background: '#0a1a0a', borderBottom: '1px solid #1e2e1e', padding: '18px 0', textDecoration: 'none' }}>
      <div className="container" style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
        <span style={{ position: 'relative', width: 12, height: 12 }}>
          <span className="lb-ping" />
          <span style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: '#4DB26E' }} />
        </span>
        <span style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#4DB26E' }}>
          Game live{session.is_championship ? ' · Championship' : ''}
        </span>
        {leader && stat('Leading', leader.name)}
        {leader && stat('Events', `${leader.eventsCompleted} / 10`, '#888')}
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4DB26E' }}>Watch →</span>
      </div>
    </Link>
  )
}

const PODIUM = [
  { place: 2, color: '#c0c0c0', lift: 24 },
  { place: 1, color: '#F9B051', lift: 0 },
  { place: 3, color: '#cd7f32', lift: 40 },
] as const

function Podium({ rows }: { rows: (BoardRow & { rank: number })[] }) {
  if (rows.length < 3) return null
  const top = rows.slice(0, 3)
  return (
    <div className="lb-podium">
      {PODIUM.map(({ place, color, lift }) => {
        const p = top[place - 1]
        const bw = bestAndWorst(p.domainRungs)
        return (
          <div key={place} className="lb-podium-card" style={{ marginTop: lift, borderColor: `${color}33` }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: place === 1 ? RAINBOW : color }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: place === 1 ? 52 : 40, color, lineHeight: 1 }}>{p.rank}</div>
            <div className="lb-podium-name">{p.name}</div>
            <div style={{ display: 'flex', justifyContent: 'center', margin: '-2px 0 10px' }}><ColourChip rung={p.overall} size="sm" /></div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: place === 1 ? 32 : 26, color: '#fff', lineHeight: 1 }}>{p.points}<span style={{ fontSize: 13, color: '#666', marginLeft: 3 }}>PTS</span></div>
            <div className="lb-podium-domains">
              {p.domainRungs[bw.best] > 0 ? (
                <>
                  <DomainStat kind="Best" index={bw.best} rung={p.domainRungs[bw.best]} compact />
                  <DomainStat kind="Worst" index={bw.worst} rung={p.domainRungs[bw.worst]} compact />
                </>
              ) : <span className="lb-nodomains">No domain colours yet</span>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function BoardList({ rows, showDivision }: { rows: (BoardRow & { rank: number })[]; showDivision: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {rows.map(p => {
        const { best, worst } = bestAndWorst(p.domainRungs)
        return (
          <div key={p.playerId} className="lb-row" style={{ borderColor: p.rank <= 3 ? '#F9B05126' : '#1a1a1a' }}>
            <div className="lb-rank" style={{ color: p.rank === 1 ? '#F9B051' : p.rank === 2 ? '#c0c0c0' : p.rank === 3 ? '#cd7f32' : '#3a3a3a' }}>{p.rank}</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
                <span className="lb-name">{p.name}</span>
                <ColourChip rung={p.overall} />
                {showDivision && p.division && <span className="lb-div">{SHORT_DIVISION[p.division] ?? p.division}</span>}
              </div>
              <div className="lb-domains">
                {/* With nothing held, best and worst would both name the first
                    domain as "Not yet", which reads like a real result. */}
                {p.domainRungs[best] > 0 ? (
                  <>
                    <DomainStat kind="Best" index={best} rung={p.domainRungs[best]} />
                    <DomainStat kind="Worst" index={worst} rung={p.domainRungs[worst]} />
                  </>
                ) : <span className="lb-nodomains">No domain colours yet</span>}
              </div>
            </div>
            <div style={{ textAlign: 'right', alignSelf: 'start' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, color: '#fff', lineHeight: 1 }}>{p.points}</span>
              <div className="lb-unit">{`Pts · ${p.games} ${p.games === 1 ? 'game' : 'games'}`}</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function computeLeader(sessionResults: SessionResult[]): SessionLeader | null {
  if (sessionResults.length === 0) return null
  const byPlayer = new Map<string, { name: string; events: number; total: number }>()
  for (const r of sessionResults) {
    const key = r.player_id ?? r.player_name ?? 'unknown'
    const name = r.player_name ?? 'Unknown'
    const cur = byPlayer.get(key) ?? { name, events: 0, total: 0 }
    cur.events++
    cur.total += r.placement ?? 99
    byPlayer.set(key, cur)
  }
  let best: SessionLeader | null = null
  for (const v of byPlayer.values()) {
    if (!best || v.total < best.totalPlacement || (v.total === best.totalPlacement && v.events > best.eventsCompleted)) {
      best = { name: v.name, eventsCompleted: v.events, totalPlacement: v.total }
    }
  }
  return best
}

/** The NZ calendar year, which is the season: 1 January NZ is still 31 December in UTC. */
const nzYear = () => Number(new Intl.DateTimeFormat('en-NZ', { timeZone: 'Pacific/Auckland', year: 'numeric' }).format(new Date()))

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['key']>('all-divisions')
  const [loading, setLoading] = useState(true)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [domainColours, setDomainColours] = useState<Map<string, DomainColoursRow>>(new Map())
  const [season, setSeason] = useState<Map<string, SeasonPointsRow>>(new Map())
  const [held, setHeld] = useState<Map<string, Map<number, number>>>(new Map())
  // Lifetime official games per player, which cap the overall colour. Null = unknown.
  const [gamesPlayed, setGamesPlayed] = useState<Map<string, number> | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [sessionLeader, setSessionLeader] = useState<SessionLeader | null>(null)
  const [seasonYear] = useState(nzYear)

  // Four reads in ONE parallel wave. leaderboard_page() heals expired sessions
  // before reading (20260827211610) and carries the live game and conferred
  // colours. The roster comes from players_public — never a `players(...)`
  // embed, which reads the closed base table and takes the whole request down
  // with 42501. The two score tables are public and written only by the server.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const [page, rosterRes, domainRes, seasonRes, lifetimeGames] = await Promise.all([
        supabase.rpc('leaderboard_page', { p_season: seasonYear }),
        supabase.from('players_public').select('id, display_name, username, division, is_guest, is_active'),
        supabase.from('player_domain_colours').select('player_id, domain_rungs'),
        supabase.from('player_season_points').select('player_id, points, games').eq('season_year', seasonYear),
        // LIFETIME official games, which cap the overall colour (overallRung).
        // Not the season's games: a colour is lifetime, so is its cap.
        loadGameCounts(supabase, null),
      ])
      if (cancelled) return

      const d = (page.data ?? null) as LeaderboardPayload | null
      const h = new Map<string, Map<number, number>>()
      for (const a of d?.grades ?? []) {
        const m = h.get(a.player_id) ?? new Map<number, number>()
        m.set(a.domain_number, Math.max(m.get(a.domain_number) ?? 0, a.rung))
        h.set(a.player_id, m)
      }
      setHeld(h)
      setActiveSession(d?.active_session ?? null)
      setSessionLeader(d?.active_session ? computeLeader(d.active_session_results ?? []) : null)
      setRoster(((rosterRes.data ?? []) as RosterPlayer[]).filter(p => !p.is_guest && p.is_active !== false))
      // A missing table (PGRST205, before 20260924213359) reads as empty.
      setDomainColours(new Map(((domainRes.data ?? []) as DomainColoursRow[]).map(r => [r.player_id, r])))
      setSeason(new Map(((seasonRes.data ?? []) as SeasonPointsRow[]).map(r => [r.player_id, r])))
      setGamesPlayed(lifetimeGames)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [seasonYear])

  // A score coming in refetches only the live leader, never the whole page.
  useEffect(() => {
    const sessionId = activeSession?.id
    if (!sessionId) return
    const supabase = createClient()
    const refresh = async () => {
      const { data } = await supabase.from('results').select('player_id, player_name, placement').eq('session_id', sessionId)
      setSessionLeader(computeLeader((data ?? []) as SessionResult[]))
    }
    const channel = supabase
      .channel(`leaderboard-session-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` }, refresh)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [activeSession?.id])

  const tab = tabs.find(t => t.key === activeTab)!

  const rows = useMemo(() => {
    const all: BoardRow[] = roster.map(p => {
      const dc = domainColours.get(p.id)
      const sp = season.get(p.id)
      return {
        playerId: p.id,
        name: p.display_name || p.username || 'Anonymous',
        division: p.division,
        domainRungs: dc?.domain_rungs ?? Array(DOMAIN_COUNT).fill(0),
        points: sp?.points ?? 0,
        games: sp?.games ?? 0,
        // The average of the ten conferred domain colours, rounded down and
        // capped by lifetime games (lib/colourBoard.ts). An unreadable count is
        // unknown, not zero, so the cap is left off rather than showing Mā.
        overall: displayOverall(colourStanding(held.get(p.id), gamesPlayed ? (gamesPlayed.get(p.id) ?? 0) : Number.MAX_SAFE_INTEGER)),
      }
    }).filter(r => inTab(r.division, tab))
    return rankBy(all.filter(r => r.points > 0 || r.games > 0), r => [r.points, r.games])
  }, [roster, domainColours, season, held, gamesPlayed, tab])

  return (
    <>
      <style>{`
        .lb-banner { position: relative; overflow: hidden; background: #000; padding: 140px 0 64px; }
        .lb-grid { position: absolute; inset: 0; opacity: 0.45;
          background-image: linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px);
          background-size: 64px 64px; mask-image: linear-gradient(180deg, #000 30%, transparent); }
        .lb-glow { position: absolute; bottom: -140px; width: 260px; height: 260px; border-radius: 50%; filter: blur(90px); opacity: 0.35;
          animation: lbDrift 9s ease-in-out infinite alternate; }
        @keyframes lbDrift { from { transform: translateY(0) scale(1); } to { transform: translateY(-40px) scale(1.15); } }
        .lb-banner-inner { position: relative; z-index: 1; display: flex; align-items: center; justify-content: space-between; gap: 24px; }
        .lb-title { font-size: clamp(64px, 11vw, 148px); line-height: 0.9; margin: 0; letter-spacing: 0.01em; }
        .lb-crest { width: min(360px, 34vw); height: auto; filter: drop-shadow(0 12px 40px #0008); animation: lbFloat 6s ease-in-out infinite; }
        @keyframes lbFloat { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
        @media (max-width: 640px) {
          .lb-banner { padding: 112px 0 44px; }
          .lb-banner-inner { flex-direction: column-reverse; align-items: flex-start; gap: 8px; }
          .lb-crest { width: 46vw; }
        }
        @media (prefers-reduced-motion: reduce) { .lb-glow, .lb-crest { animation: none; } }

        .lb-ping { position: absolute; inset: 0; border-radius: 50%; background: #4DB26E; animation: lbPing 1.4s cubic-bezier(0,0,0.2,1) infinite; }
        @keyframes lbPing { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }

        .lb-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin: 16px 0 32px; scrollbar-width: none; }
        .lb-chips::-webkit-scrollbar { display: none; }
        .lb-chip { flex-shrink: 0; min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer; border: 1px solid #1e1e1e; background: transparent;
          font-family: var(--font-label); font-weight: 700; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #777; transition: color .15s, border-color .15s; }
        .lb-chip:hover { color: #fff; border-color: #333; }

        .lb-podium { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; max-width: 720px; margin-bottom: 28px; }
        .lb-podium-card { position: relative; overflow: hidden; background: #111; border: 1px solid; border-radius: 16px; padding: 22px 10px 18px; text-align: center; }
        .lb-podium-name { font-family: var(--font-label); font-weight: 700; font-size: 14px; color: #fff; margin: 6px 0 10px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .lb-row { display: grid; grid-template-columns: 40px minmax(0, 1fr) auto; gap: 12px; align-items: center; max-width: 720px;
          padding: 14px 16px; background: #0d0d0d; border: 1px solid; border-radius: 12px; }
        .lb-rank { font-family: var(--font-display); font-size: 26px; line-height: 1; }
        .lb-name { font-family: var(--font-label); font-weight: 700; font-size: 16px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb-div { flex-shrink: 0; font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
          color: #777; border: 1px solid #262626; border-radius: 999px; padding: 2px 8px; }
        .lb-colour { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 3px 9px 3px 6px; border: 1px solid #262626; border-radius: 999px;
          font-family: var(--font-label); font-weight: 700; letter-spacing: 0.06em; color: #ddd; }
        .lb-domains { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; margin-top: 12px; }
        @media (max-width: 520px) { .lb-domains { grid-template-columns: 1fr; } }
        .lb-dstat { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .lb-dstat-label { width: 38px; flex-shrink: 0; font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
        .lb-dstat-name { font-family: var(--font-label); font-weight: 700; font-size: 13px; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb-dstat-grade { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-label); font-size: 12px; color: #777; }
        .lb-nodomains { font-family: var(--font-label); font-size: 12px; letter-spacing: 0.06em; color: #555; }
        .lb-podium-domains { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #1e1e1e; text-align: left; }
        .lb-dstat-compact .lb-dstat-label { width: auto; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 8px; letter-spacing: 0.1em; }
        .lb-dstat-compact .lb-dstat-name { font-size: 11px; }
        .lb-dstat-compact .lb-dstat-grade { font-size: 10px; }
        @media (max-width: 520px) { .lb-dstat-compact { gap: 5px; } .lb-podium-card { padding-left: 8px; padding-right: 8px; } }
        .lb-unit { font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #444; margin-top: 2px; }
      `}</style>

      <Banner />

      {activeSession && <LiveGame session={activeSession} leader={sessionLeader} />}

      <section className="section" style={{ background: '#0a0a0a', paddingTop: 40 }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', margin: 0, lineHeight: 1 }}>
            SEASON <span className="rainbow-text">{seasonYear}</span>
          </h2>

          <div role="group" aria-label="Division" className="lb-chips">
            {tabs.map(t => {
              const on = activeTab === t.key
              return (
                <button key={t.key} aria-pressed={on} className="lb-chip" onClick={() => setActiveTab(t.key)}
                  style={on ? { background: t.color, borderColor: t.color, color: '#fff' } : undefined}>
                  {t.label}
                </button>
              )
            })}
          </div>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 720 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ height: 64, background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '72px 0', fontFamily: 'var(--font-display)', fontSize: 32, color: '#333' }}>
              {`No ${seasonYear} games yet`}
            </div>
          ) : (
            <>
              <Podium rows={rows} />
              <BoardList rows={rows.length >= 3 ? rows.slice(3) : rows} showDivision={tab.division == null} />
            </>
          )}
        </div>
      </section>

      <section style={{ padding: '64px 0', background: '#000', textAlign: 'center', borderTop: '1px solid #1a1a1a' }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(40px, 6vw, 72px)', margin: '0 0 24px' }}>
            YOUR NAME <span className="rainbow-text">HERE</span>
          </h2>
          <Link href="/register" className="btn btn-primary" style={{ fontSize: 20 }}>Join a game</Link>
        </div>
      </section>
    </>
  )
}
