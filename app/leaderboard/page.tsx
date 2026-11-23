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
//      28 Sept 2026) and is shown with average and best game. Rules:
//      lib/seasonColourBoard.ts.
//      Since v0.55.0.0 (Tāne, 19 Nov 2026) every player is a podium-style card
//      with best and worst domain, in one strip that scrolls right to the top
//      hundred, with no heading, explainer or season stats above it: the page
//      reads SEASON, the division chips, then the cards.
//      Since v0.56.0.0 (Tāne, 19 Nov 2026) the cards carry no numbers but the
//      rank: a larger colour and division, the best game as a colour
//      (bestGameRung), and best and worst domain with plain icons. The colour
//      score still ranks and breaks ties; it is just not shown.
//   2. EVENT RECORDS. The season's best Men's, Women's and Juniors score in
//      every event, by domain (components/EventRecords.tsx, lib/eventRecords.ts),
//      loaded as its own chunk because it needs the whole roster.
//
// The colours are computed on the server by the recheck route (strength rungs need the
// private bodyweight) and published; this page only reads and ranks them.
// All-Divisions opens first, and a division chip narrows both sections.

import { useState, useEffect, useMemo, useRef } from 'react'
import { readPageCache, writePageCache } from '@/lib/pageCache'
import { useLoadingBar } from '@/lib/useLoadingBar'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { createClient } from '@/lib/supabase-browser'
import { gradeForRung, DOMAIN_COUNT } from '@/lib/grading'
import { bestAndWorst } from '@/lib/leaderboardScores'
import { colourStanding } from '@/lib/colourBoard'
import { loadGameCounts } from '@/lib/gameCounts'
import { nzYear } from '@/lib/seasonYear'
import { divisionPool } from '@/lib/rating'
import { loadSeasonGames, loadGameColours } from '@/lib/leaderboardData'
import { seasonColourBoard, bestGameRung, type SeasonGame, type GameColourRow, type ColourStanding } from '@/lib/seasonColourBoard'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { RAINBOW, DOMAIN_COLORS } from '@/lib/domainColours'
import { GradeDot } from '@/components/GradeDot'
import DomainIcon from '@/components/DomainIcon'

// Literal, not derived from EVENTS: importing lib/eventData.ts would ship the
// how-to prose for every event to a page that needs ten names.
const DOMAIN_NAMES = ['Maximal Strength', 'Calisthenics', 'Power', 'Speed', 'Stamina',
  'Endurance', 'Flexibility', 'Control', 'Coordination', 'Aim']

// Its own chunk: the records need lib/eventData.ts, the whole roster with
// every event's how-to prose, which the colour board does not.
const EventRecords = dynamic(() => import('@/components/EventRecords'), {
  ssr: false,
  loading: () => <div style={{ height: 224, maxWidth: 720, background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: 12 }} />,
})

/** The strip runs to a hundred. */
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

type DomainColoursRow = { player_id: string; domain_rungs: number[]; updated_at?: string }

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



/** The player's colour: the overall one CONFERRED, or Mā, where every player starts. */
function ColourChip({ rung }: { rung: number }) {
  const g = gradeForRung(rung)
  return (
    <span className="lb-colour">
      <GradeDot grade={g} size={18} />
      {g.name}
    </span>
  )
}

// Domain icons are not coloured on this page (Tāne, 19 Nov 2026): the only
// colour on a domain row is the player's own colour dot.
const PLAIN_ICON = '#d4d4d4'

/** One domain with its colour: "BEST · [icon] Power · ● Kōwhai". */
function DomainStat({ kind, index, rung, compact = false }: { kind: 'Best' | 'Worst'; index: number; rung: number; compact?: boolean }) {
  const g = rung > 0 ? gradeForRung(rung) : null
  const name = DOMAIN_NAMES[index]
  return (
    <div className={compact ? 'lb-dstat lb-dstat-compact' : 'lb-dstat'} title={`${kind} domain: ${name}, ${g ? g.name : 'no colour yet'}`}>
      <span className="lb-dstat-label" style={{ color: kind === 'Best' ? '#4DB26E' : '#EA4742' }}>{kind}</span>
      <DomainIcon domainName={name} domainNumber={index + 1} size={compact ? 22 : 26} tint={PLAIN_ICON} />
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

/** Best and worst domain, or a plain note while nothing is held. */
function Domains({ rungs, compact = false }: { rungs: number[]; compact?: boolean }) {
  const { best, worst } = bestAndWorst(rungs)
  // With nothing held, best and worst would both name the first domain as
  // "Not yet", which reads like a real result.
  if (!(rungs[best] > 0)) return <span className="lb-nodomains">No domain colours yet</span>
  return (
    <>
      <DomainStat kind="Best" index={best} rung={rungs[best]} compact={compact} />
      <DomainStat kind="Worst" index={worst} rung={rungs[worst]} compact={compact} />
    </>
  )
}

// The medal inks (globals.css --medal-*), as hex because the card border appends alpha.
const MEDAL: Record<number, string> = { 1: '#D9B84A', 2: '#C9D0D9', 3: '#C08A5A' }

/** The best game as the colour it was played at: a tenth of its colour total, rounded down. */
function BestGame({ rung }: { rung: number }) {
  const g = gradeForRung(rung)
  return (
    <div className="lb-best" title={`Best game: ${g.name}`}>
      <div className="lb-best-label">Best game</div>
      <span className="lb-best-grade"><GradeDot grade={g} size={12} />{g.name}</span>
    </div>
  )
}

/** One player's card: rank, name, colour, division, best game as a colour, best and worst domain. No other numbers. */
function Card({ p, showDivision, mine, rungs }: { p: BoardRow; showDivision: boolean; mine: boolean; rungs: number[] }) {
  const medal = MEDAL[p.rank]
  return (
    <li className="lb-card" data-me={mine || undefined}
      style={{ borderColor: mine ? '#F9B051' : medal ? `${medal}55` : '#1e1e1e', background: mine ? '#14100a' : undefined }}>
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: p.rank === 1 ? RAINBOW : medal ?? '#1e1e1e' }} />
      <div className="lb-card-rank" style={{ color: medal ?? '#555' }}>{p.rank}</div>
      <div className="lb-card-name">{p.name}</div>
      <div className="lb-card-tags">
        <ColourChip rung={p.overall} />
        {showDivision && p.division && <span className="lb-div">{SHORT_DIVISION[p.division] ?? p.division}</span>}
      </div>
      <BestGame rung={bestGameRung(p.best)} />
      <div className="lb-card-domains"><Domains rungs={rungs} compact /></div>
    </li>
  )
}

/**
 * Every player as a card, in a strip that scrolls right to the top hundred
 * (Tāne, 19 Nov 2026: the podium cards, kept going). Arrows page it on a
 * desktop; a phone swipes. The visitor's own card is ringed in orange, a
 * "Me" button scrolls to it, and below the hundred it is added at the end.
 */
function ColourStrip({ rows, showDivision, myId, rungsOf }: { rows: BoardRow[]; showDivision: boolean; myId: string | null; rungsOf: (id: string) => number[] }) {
  const ref = useRef<HTMLOListElement>(null)
  const shown = rows.slice(0, MORE)
  const me = myId ? rows.find(r => r.playerId === myId) : undefined
  const pinMe = me && !shown.some(r => r.playerId === me.playerId)
  const smooth = (): ScrollBehavior =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
  const page = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: smooth() })
  }
  const toMe = () => {
    const el = ref.current
    const card = el?.querySelector<HTMLElement>('[data-me]')
    if (el && card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft - 8, behavior: smooth() })
  }
  const card = (p: BoardRow) => <Card key={p.playerId} p={p} showDivision={showDivision} mine={p.playerId === myId} rungs={rungsOf(p.playerId)} />
  return (
    <div className="lb-strip-wrap">
      <ol ref={ref} className="lb-strip" aria-label="Season colour board">
        {shown.map(card)}
        {pinMe && (
          <>
            <li className="lb-strip-gap" aria-hidden>&middot; &middot; &middot;</li>
            {card(me)}
          </>
        )}
      </ol>
      {(shown.length > 1 || me) && (
        <div className="lb-strip-nav">
          <button type="button" className="lb-nav press" aria-label="Back" onClick={() => page(-1)}>&larr;</button>
          <button type="button" className="lb-nav press" aria-label="Next" onClick={() => page(1)}>&rarr;</button>
          {me && <button type="button" className="lb-nav lb-nav-me press" onClick={toMe}>{`Me · ${me.rank}`}</button>}
        </div>
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
  const [domainColours, setDomainColours] = useState<Map<string, DomainColoursRow>>(new Map())
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
  // The saved copy (lib/pageCache.ts): the board as last seen for this year
  // draws at once and the fresh read replaces it. Public data only. The live
  // game banner is never drawn from it: a game seen yesterday is not on now.
  type SavedBoard = {
    grades: NonNullable<LeaderboardPayload['grades']>
    roster: RosterPlayer[]
    domainColours: Map<string, DomainColoursRow>
    games: SeasonGame[]
    colours: GameColourRow[]
    gamesPlayed: Map<string, number> | null
  }
  // The year whose board is fresh this visit; the top bar runs until it is.
  const [freshYear, setFreshYear] = useState<number | null>(null)
  useLoadingBar(freshYear !== seasonYear)

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false
    const savedKey = `leaderboard:${seasonYear}`
    const SAVED_VERSION = 'board-1'
    const saved = readPageCache<SavedBoard>(savedKey, SAVED_VERSION)
    ;(async () => {
      // Drawn before the first await, so it lands in the same frame.
      if (saved) {
        setGrades(saved.grades)
        setRoster(saved.roster)
        setDomainColours(saved.domainColours)
        setGames(saved.games)
        setColours(saved.colours)
        setSeasonFailed(false)
        setGamesPlayed(saved.gamesPlayed)
        setLoading(false)
      }
      const [page, rosterRes, domainRes, seasonGames, yearGames] = await Promise.all([
        supabase.rpc('leaderboard_page', { p_season: seasonYear }),
        supabase.from('players_public').select('id, display_name, username, division, is_guest, is_active'),
        supabase.from('player_domain_colours').select('player_id, domain_rungs, updated_at'),
        loadSeasonGames(supabase, seasonYear),
        // That YEAR's official games, which cap the overall colour
        // (overallRung): colours are earned per year, and so is their cap.
        loadGameCounts(supabase, null, seasonYear),
      ])
      const totals = seasonGames ? await loadGameColours(supabase, seasonGames.map(g => g.id)) : null
      if (cancelled) return

      const d = (page.data ?? null) as LeaderboardPayload | null
      setActiveSession(d?.active_session ?? null)
      setFreshYear(seasonYear)
      // A failed read keeps the saved board on screen rather than blanking it.
      if (saved && (page.error || rosterRes.error || totals == null)) return
      const board: SavedBoard = {
        grades: d?.grades ?? [],
        roster: ((rosterRes.data ?? []) as RosterPlayer[]).filter(p => !p.is_guest && p.is_active !== false),
        // A missing table reads as empty: no best or worst domain shown.
        domainColours: new Map(((domainRes.data ?? []) as DomainColoursRow[]).map(r => [r.player_id, r])),
        games: seasonGames ?? [],
        colours: totals ?? [],
        gamesPlayed: yearGames,
      }
      setGrades(board.grades)
      setRoster(board.roster)
      setDomainColours(board.domainColours)
      setGames(board.games)
      setColours(board.colours)
      setSeasonFailed(totals == null)
      setGamesPlayed(board.gamesPlayed)
      setLoading(false)
      if (!page.error && !rosterRes.error && totals != null) writePageCache(savedKey, SAVED_VERSION, board)
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

  // Best and worst domain on each card. This year: the published standards
  // colours, but only once recomputed this year (a row from last year is last
  // year's colours until the player's next recheck). A past year: the colours
  // conferred in it.
  const rungsOf = (id: string): number[] => {
    const dc = seasonYear === thisYear ? domainColours.get(id) : undefined
    if (dc && (!dc.updated_at || nzYear(dc.updated_at) === thisYear)) return dc.domain_rungs
    const past = seasonYear !== thisYear ? held.get(id) : undefined
    return Array.from({ length: DOMAIN_COUNT }, (_, i) => past?.get(i + 1) ?? 0)
  }

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

        .lb-strip-wrap { margin-bottom: 8px; }
        /* The fade on the right shows there is more; the end padding lets the last card clear it. */
        .lb-strip { list-style: none; margin: 0; padding: 8px 48px 14px 2px; display: flex; gap: 12px; overflow-x: auto;
          mask-image: linear-gradient(90deg, #000 calc(100% - 48px), transparent);
          scroll-snap-type: x mandatory; scroll-padding-left: 2px; overscroll-behavior-x: contain;
          scrollbar-width: thin; scrollbar-color: #2a2a2a transparent; }
        .lb-card { position: relative; overflow: hidden; flex: 0 0 min(232px, 70vw); scroll-snap-align: start;
          background: #111; border: 1px solid; border-radius: 16px; padding: 22px 12px 18px; text-align: center; }
        .lb-card-rank { font-family: var(--font-display); font-size: 48px; line-height: 1; }
        .lb-card-name { font-family: var(--font-label); font-weight: 700; font-size: 15px; color: #fff; margin: 6px 0 8px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb-card-tags { display: flex; flex-direction: column; align-items: center; gap: 8px; margin-bottom: 14px; }
        .lb-card-tags .lb-colour { gap: 9px; padding: 7px 16px 7px 10px; font-size: 18px; }
        .lb-card-tags .lb-div { font-size: 13px; padding: 4px 12px; color: #aaa; border-color: #333; }
        .lb-best { border: 1px solid #1e1e1e; border-radius: 10px; padding: 8px 4px; }
        .lb-best-label { font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; color: #666; margin-bottom: 5px; }
        .lb-best-grade { display: inline-flex; align-items: center; gap: 6px; font-family: var(--font-label); font-weight: 700; font-size: 14px; color: #ddd; }
        .lb-card-domains { display: flex; flex-direction: column; gap: 8px; margin-top: 14px; padding-top: 12px; border-top: 1px solid #1e1e1e; text-align: left; }
        .lb-strip-gap { flex: 0 0 auto; align-self: center; color: #444; font-size: 14px; letter-spacing: 0.3em; }
        .lb-strip-nav { display: flex; gap: 8px; }
        .lb-nav { min-width: 44px; min-height: 44px; padding: 0 14px; border-radius: 999px; cursor: pointer; background: transparent; border: 1px solid #333;
          color: #fff; font-family: var(--font-label); font-weight: 700; font-size: 15px; letter-spacing: 0.1em; text-transform: uppercase; }
        .lb-nav:hover { border-color: #666; }
        .lb-nav-me { margin-left: auto; border-color: #F9B05166; color: #F9B051; font-size: 13px; }
        .lb-div { flex-shrink: 0; font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: 0.1em; text-transform: uppercase;
          color: #777; border: 1px solid #262626; border-radius: 999px; padding: 2px 8px; }
        .lb-colour { display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0; padding: 3px 9px 3px 6px; border: 1px solid #262626; border-radius: 999px;
          font-family: var(--font-label); font-weight: 700; letter-spacing: 0.06em; color: #ddd; }
        .lb-dstat { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .lb-dstat-label { width: 38px; flex-shrink: 0; font-family: var(--font-label); font-weight: 700; font-size: 10px; letter-spacing: 0.14em; text-transform: uppercase; }
        .lb-dstat-name { font-family: var(--font-label); font-weight: 700; font-size: 13px; color: #ccc; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .lb-dstat-grade { display: inline-flex; align-items: center; gap: 5px; font-family: var(--font-label); font-size: 12px; color: #777; }
        .lb-nodomains { font-family: var(--font-label); font-size: 12px; letter-spacing: 0.06em; color: #555; }
        .lb-dstat-compact .lb-dstat-label { width: auto; writing-mode: vertical-rl; transform: rotate(180deg); font-size: 8px; letter-spacing: 0.1em; }
        .lb-dstat-compact .lb-dstat-name { font-size: 11px; }
        .lb-dstat-compact .lb-dstat-grade { font-size: 10px; }
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

          {loading ? (
            <div className="lb-strip" aria-hidden>
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="lb-card" style={{ height: 300, borderColor: '#1a1a1a', opacity: 1 - i * 0.18 }} />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div style={{ padding: '48px 0', fontFamily: 'var(--font-display)', fontSize: 32, color: '#333' }}>
              {seasonFailed ? 'Could not load the season. Refresh to try again.' : `No ${seasonYear} games yet`}
            </div>
          ) : (
            <ColourStrip key={`${seasonYear}-${activeTab}`} rows={rows} showDivision={tab.division == null} myId={activePlayerId} rungsOf={rungsOf} />
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
