'use client'

// ─── /leaderboard ────────────────────────────────────────────────────────────
// The board exists so players who could never play together — a woman of 65,
// a U14 boy, a Men's player — can compete anyway. ONE board, SEASON: this
// calendar year, a tab for each year (colours are earned per year, Tāne
// 13 Oct 2026).
//
// Two sections since 18 Nov 2026 (Tāne):
//   1. COLOUR. Players with a game this season, ranked on their top colour
//      the way HOME shows it: the overall colour (the average of the ten
//      domain colours conferred this year, rounded down, capped by this
//      year's games), then the rankByColours tie-breaks, then the season's
//      colour score (every colour total from official games, added up;
//      player_game_colours), which replaced the place points (100, 99, 98 …,
//      28 Sept 2026) and is shown with average and best game. Top ten,
//      expandable to a hundred, the visitor's own row pinned beneath when it
//      is further down. Rules: lib/seasonColourBoard.ts.
//   2. EVENT RECORDS. The season's best Men's, Women's and Juniors score in
//      every event, by domain (components/EventRecords.tsx, lib/eventRecords.ts),
//      loaded as its own chunk because it needs the whole roster.
//
// The colours are computed on the server by the recheck route (strength rungs need the
// private bodyweight) and published; this page only reads and ranks them.
// All-Divisions opens first, and a division chip narrows both sections.

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase-browser'
import { gradeForRung } from '@/lib/grading'
import { colourStanding } from '@/lib/colourBoard'
import { loadGameCounts } from '@/lib/gameCounts'
import { nzYear } from '@/lib/seasonYear'
import { divisionPool } from '@/lib/rating'
import { loadSeasonGames, loadGameColours } from '@/lib/leaderboardData'
import { seasonColourBoard, seasonHighlights, type SeasonGame, type GameColourRow, type ColourStanding } from '@/lib/seasonColourBoard'
import { formatNZDate } from '@/lib/dates'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { RAINBOW, DOMAIN_COLORS } from '@/lib/domainColours'
import { GradeDot } from '@/components/GradeDot'

// Its own chunk: the records need lib/eventData.ts, the whole roster with
// every event's how-to prose, which the colour board does not.
const EventRecords = dynamic(() => import('@/components/EventRecords'), {
  ssr: false,
  loading: () => <div style={{ height: 224, maxWidth: 720, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12 }} />,
})

/** The board shows ten, then a hundred. */
const TOP = 10
const MORE = 100

type ActiveSession = {
  id: string
  session_date: string
  started_at: string | null
  location: string
  is_championship: boolean
}

type SessionResult = { player_id: string | null; player_name: string | null; placement: number | null }

// Shape returned by the `leaderboard_page(p_season)` RPC. Called for the
// active game and because it heals expired sessions first (20260827211610);
// its `stats` bundle is no longer read here.
type LeaderboardPayload = {
  /**
   * Conferred colours, from grade_awards, highest per domain per year.
   * season_year is absent before 20261012230318, when every award was this year's.
   */
  grades?: { player_id: string; domain_number: number; rung: number; season_year?: number }[]
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

type BoardRow = ColourStanding

const tabs = [
  { key: 'all-divisions', label: 'All-Divisions', division: null, color: '#F9B051' },
  { key: 'mens', label: "Men's", division: "Men's", color: '#2371BB' },
  { key: 'womens', label: "Women's", division: "Women's", color: '#EA4742' },
  { key: 'juniors', label: 'Juniors', division: 'Juniors', color: '#4DB26E' },
] as const

// No age tabs (Tāne, 20 Oct 2026): age is in the colour standards, so it is
// not a division.
const SHORT_DIVISION: Record<string, string> = {
  "Men's": 'Men', "Women's": 'Women', Juniors: 'Junior',
}

const inTab = (division: string | null, tab: typeof tabs[number]) =>
  tab.division == null || divisionPool(division) === divisionPool(tab.division)

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

// No one is shown leading: a game's places come from colour scores when it closes.
function LiveGame({ session }: { session: ActiveSession }) {
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
        <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: '#4DB26E' }}>Watch →</span>
      </div>
    </Link>
  )
}


const RANK_INK = ['var(--medal-gold)', 'var(--medal-silver)', 'var(--medal-bronze)']

/** One decimal only when there is one: 54, 54.5. */
const num = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1))

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="lb-stat">
      <span className="lb-stat-label">{label}</span>
      <span className="lb-stat-value">{value}</span>
      {sub && <span className="lb-stat-sub">{sub}</span>}
    </div>
  )
}

function Highlights({ h }: { h: ReturnType<typeof seasonHighlights> }) {
  return (
    <div className="lb-stats">
      <Stat label="Games" value={String(h.games)} />
      <Stat label="Players" value={String(h.players)} />
      <Stat label="Best game" value={h.topGame ? num(h.topGame.total) : '–'}
        sub={h.topGame ? `${h.topGame.name}${h.topGame.date ? `, ${formatNZDate(h.topGame.date, { day: 'numeric', month: 'short' })}` : ''}` : undefined} />
      <Stat label="Most games" value={h.mostGames ? String(h.mostGames.games) : '–'}
        sub={h.mostGames ? (h.mostGames.names.length > 2 ? `${h.mostGames.names.length} players` : h.mostGames.names.join(', ')) : undefined} />
    </div>
  )
}

/** The player's colour: the overall one CONFERRED, or Mā, where every player starts. */
function ColourChip({ rung }: { rung: number }) {
  const g = gradeForRung(rung)
  return (
    <span className="lb-colour">
      <GradeDot grade={g} size={14} />
      {g.name}
    </span>
  )
}

function Row({ p, showDivision, mine }: { p: BoardRow; showDivision: boolean; mine: boolean }) {
  return (
    <div className="lb-row" style={mine ? { borderColor: '#F9B05166', background: '#14100a' } : undefined}>
      <div className="lb-rank" style={{ color: RANK_INK[p.rank - 1] ?? '#444' }}>
        {p.rank}
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flexWrap: 'wrap' }}>
          <span className="lb-name">{p.name}</span>
          {showDivision && p.division && <span className="lb-div">{SHORT_DIVISION[p.division] ?? p.division}</span>}
        </div>
        <div className="lb-sub">{`${p.games} ${p.games === 1 ? 'game' : 'games'} · score ${num(p.total)}`}</div>
      </div>
      <div className="lb-num lb-wide">{p.games}</div>
      <div className="lb-num lb-wide">{num(p.average)}</div>
      <div className="lb-num lb-wide">{num(p.best)}</div>
      <div className="lb-num lb-wide">{num(p.total)}</div>
      <div className="lb-colcell"><ColourChip rung={p.overall} /></div>
    </div>
  )
}

function ColourBoard({ rows, showDivision, myId }: { rows: BoardRow[]; showDivision: boolean; myId: string | null }) {
  const [expanded, setExpanded] = useState(false)
  const shown = rows.slice(0, expanded ? MORE : TOP)
  const me = myId ? rows.find(r => r.playerId === myId) : undefined
  const pinMe = me && !shown.some(r => r.playerId === me.playerId)
  return (
    <div className="lb-board">
      <div className="lb-row lb-headrow" aria-hidden>
        <span>#</span><span>Player</span>
        <span className="lb-wide">Games</span><span className="lb-wide">Avg</span><span className="lb-wide">Best</span>
        <span className="lb-wide">Score</span><span>Colour</span>
      </div>
      {shown.map(p => <Row key={p.playerId} p={p} showDivision={showDivision} mine={p.playerId === myId} />)}
      {pinMe && (
        <>
          <div className="lb-gap" aria-hidden>&middot; &middot; &middot;</div>
          <Row p={me} showDivision={showDivision} mine />
        </>
      )}
      {rows.length > TOP && (
        <button type="button" className="lb-more press" onClick={() => setExpanded(e => !e)}>
          {expanded ? `Show top ${TOP}` : rows.length > MORE ? `Show top ${MORE}` : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

export default function LeaderboardPage() {
  const [activeTab, setActiveTab] = useState<typeof tabs[number]['key']>('all-divisions')
  const [loading, setLoading] = useState(true)
  const [seasonFailed, setSeasonFailed] = useState(false)
  const [roster, setRoster] = useState<RosterPlayer[]>([])
  const [games, setGames] = useState<SeasonGame[]>([])
  const [colours, setColours] = useState<GameColourRow[]>([])
  // Every conferred colour, per year. Read once; a year tab picks its own.
  const [grades, setGrades] = useState<NonNullable<LeaderboardPayload['grades']>>([])
  // The season's official games per player, which cap the overall colour. Null = unknown.
  const [gamesPlayed, setGamesPlayed] = useState<Map<string, number> | null>(null)
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null)
  const [thisYear] = useState(() => nzYear())
  const [seasonYear, setSeasonYear] = useState(thisYear)
  const { activePlayerId } = useActivePlayer()

  // One parallel wave, then the season's colour totals once its games are
  // known. leaderboard_page() heals expired sessions before reading
  // (20260827211610) and carries the live game and conferred colours. The
  // roster comes from players_public — never a `players(...)` embed, which
  // reads the closed base table and takes the whole request down with 42501.
  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    ;(async () => {
      const [page, rosterRes, seasonGames, yearGames] = await Promise.all([
        supabase.rpc('leaderboard_page', { p_season: seasonYear }),
        supabase.from('players_public').select('id, display_name, username, division, is_guest, is_active'),
        loadSeasonGames(supabase, seasonYear),
        // That YEAR's official games, which cap the overall colour
        // (overallRung): colours are earned per year, and so is their cap.
        loadGameCounts(supabase, null, seasonYear),
      ])
      const totals = seasonGames ? await loadGameColours(supabase, seasonGames.map(g => g.id)) : null
      if (cancelled) return

      const d = (page.data ?? null) as LeaderboardPayload | null
      setGrades(d?.grades ?? [])
      setActiveSession(d?.active_session ?? null)
      setRoster(((rosterRes.data ?? []) as RosterPlayer[]).filter(p => !p.is_guest && p.is_active !== false))
      setGames(seasonGames ?? [])
      setColours(totals ?? [])
      setSeasonFailed(totals == null)
      setGamesPlayed(yearGames)
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [seasonYear])

  const tab = tabs.find(t => t.key === activeTab)!

  // A tab per year anyone holds a colour in, and always this year.
  const years = useMemo(() => [...new Set([thisYear, ...grades.map(g => g.season_year ?? thisYear)])]
    .sort((a, b) => b - a), [grades, thisYear])

  // The tab's year: highest conferred colour per domain per player.
  const held = useMemo(() => {
    const h = new Map<string, Map<number, number>>()
    for (const a of grades) {
      if ((a.season_year ?? thisYear) !== seasonYear) continue
      const m = h.get(a.player_id) ?? new Map<number, number>()
      m.set(a.domain_number, Math.max(m.get(a.domain_number) ?? 0, a.rung))
      h.set(a.player_id, m)
    }
    return h
  }, [grades, seasonYear, thisYear])

  // Everyone on the board, and the division chip's share of them.
  const allPlayers = useMemo(() => new Map(roster.map(p => [p.id, {
    name: p.display_name || p.username || 'Anonymous',
    division: p.division,
  }])), [roster])
  const players = useMemo(() => new Map([...allPlayers].filter(([, p]) => inTab(p.division, tab))), [allPlayers, tab])

  // Each player's colour as HOME shows it: the average of the ten conferred
  // domain colours, rounded down and capped by that year's games
  // (lib/colourBoard.ts). An unreadable count is unknown, not zero, so the cap
  // is left off rather than showing Mā.
  const rows: BoardRow[] = useMemo(() => seasonColourBoard(games, colours, players,
    id => colourStanding(held.get(id), gamesPlayed ? (gamesPlayed.get(id) ?? 0) : Number.MAX_SAFE_INTEGER),
  ), [games, colours, players, held, gamesPlayed])

  const highlights = useMemo(() => seasonHighlights(games, colours, players), [games, colours, players])

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

        .lb-chips { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin: 16px 0 28px; scrollbar-width: none; }
        .lb-chips::-webkit-scrollbar { display: none; }
        .lb-chip { flex-shrink: 0; min-height: 44px; padding: 0 16px; border-radius: 999px; cursor: pointer; border: 1px solid #1e1e1e; background: transparent;
          font-family: var(--font-label); font-weight: 700; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; color: #777; transition: color .15s, border-color .15s; }
        .lb-chip:hover { color: #fff; border-color: #333; }

        .lb-h3 { font-family: var(--font-display); font-size: clamp(26px, 4vw, 34px); line-height: 1; margin: 0 0 4px; color: #fff; letter-spacing: 0.02em; }
        .lb-lede { font-family: var(--font-body); font-size: 15px; color: #888; margin: 0 0 16px; max-width: 560px; }

        .lb-stats { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; max-width: 720px; margin-bottom: 16px; }
        @media (max-width: 560px) { .lb-stats { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        .lb-stat { display: flex; flex-direction: column; min-width: 0; padding: 12px 14px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 12px; }
        .lb-stat-label { font-family: var(--font-label); font-weight: 700; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #666; }
        .lb-stat-value { font-family: var(--font-display); font-size: 32px; line-height: 1.05; color: #fff; }
        .lb-stat-sub { font-family: var(--font-label); font-size: 13px; color: #999; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .lb-board { display: flex; flex-direction: column; gap: 6px; max-width: 720px; }
        .lb-row { display: grid; grid-template-columns: 44px minmax(0, 1fr) 48px 48px 48px 60px 120px; gap: 10px; align-items: center;
          padding: 12px 14px; background: #0d0d0d; border: 1px solid #1a1a1a; border-radius: 12px; }
        .lb-headrow { background: none; border-color: transparent; padding-top: 0; padding-bottom: 0;
          font-family: var(--font-label); font-weight: 700; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #555; }
        .lb-headrow > span:nth-child(n+3) { text-align: right; }
        .lb-rank { display: flex; flex-direction: column; font-family: var(--font-display); font-size: 26px; line-height: 1; }
        .lb-name { font-family: var(--font-label); font-weight: 700; font-size: 16px; color: #fff; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb-div { flex-shrink: 0; font-family: var(--font-label); font-weight: 700; font-size: 12px; letter-spacing: 0.08em; text-transform: uppercase;
          color: #777; border: 1px solid #262626; border-radius: 999px; padding: 1px 8px; }
        .lb-colcell { display: flex; justify-content: flex-end; }
        .lb-colour { display: inline-flex; align-items: center; gap: 7px; flex-shrink: 0; padding: 5px 12px 5px 8px; border: 1px solid #2a2a2a; border-radius: 999px;
          font-family: var(--font-label); font-weight: 700; font-size: 15px; letter-spacing: 0.04em; color: #fff; white-space: nowrap; }
        .lb-sub { display: none; font-family: var(--font-label); font-size: 13px; color: #777; margin-top: 4px; }
        .lb-num { font-family: var(--font-label); font-weight: 700; font-size: 16px; color: #aaa; text-align: right; }
        .lb-gap { text-align: center; color: #444; font-size: 14px; letter-spacing: 0.3em; }
        .lb-more { align-self: flex-start; min-height: 44px; margin-top: 6px; padding: 0 18px; border-radius: 999px; cursor: pointer;
          background: transparent; border: 1px solid #333; color: #fff; font-family: var(--font-label); font-weight: 700; font-size: 13px; letter-spacing: 0.1em; text-transform: uppercase; }
        @media (max-width: 560px) {
          .lb-row { grid-template-columns: 36px minmax(0, 1fr) auto; }
          .lb-wide { display: none; }
          .lb-sub { display: block; }
        }
      `}</style>

      <Banner />

      {activeSession && <LiveGame session={activeSession} />}

      <section className="section" style={{ background: '#0a0a0a', paddingTop: 40 }}>
        <div className="container">
          <h2 style={{ fontSize: 'clamp(32px, 5vw, 48px)', margin: 0, lineHeight: 1 }}>
            SEASON <span className="rainbow-text">{seasonYear}</span>
          </h2>

          {years.length > 1 && (
            <div role="group" aria-label="Season" className="lb-chips" style={{ margin: '16px 0 0' }}>
              {years.map(y => {
                const on = seasonYear === y
                return (
                  <button key={y} aria-pressed={on} className="lb-chip" onClick={() => { setLoading(true); setSeasonYear(y) }}
                    style={on ? { background: '#fff', borderColor: '#fff', color: '#000' } : undefined}>
                    {y}
                  </button>
                )
              })}
            </div>
          )}

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

          <h3 className="lb-h3">Colours</h3>
          <p className="lb-lede">Ranked on overall colour, as on HOME. A tie goes to the higher colour score: every colour earned in official games this season, added up.</p>

          {loading ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 720 }}>
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} style={{ height: 64, background: '#111', border: '1px solid #1a1a1a', borderRadius: 12, opacity: 1 - i * 0.15 }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '48px 0', fontFamily: 'var(--font-display)', fontSize: 32, color: '#333' }}>
              {seasonFailed ? 'Could not load the season. Refresh to try again.' : `No ${seasonYear} games yet`}
            </div>
          ) : (
            <>
              <Highlights h={highlights} />
              <ColourBoard key={`${seasonYear}-${activeTab}`} rows={rows} showDivision={tab.division == null} myId={activePlayerId} />
            </>
          )}

          <h3 className="lb-h3" style={{ marginTop: 56 }}>Event records</h3>
          <p className="lb-lede">The best score in each event this season, from official games. Contests decided by a win are not listed.</p>
          {!loading && (
            <EventRecords games={games} players={allPlayers} year={seasonYear}
              pool={tab.division == null ? null : divisionPool(tab.division)} />
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
