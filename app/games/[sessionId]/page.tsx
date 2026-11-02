'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { formatNZDate, toNZDateString } from '@/lib/dates'
import { useActivePlayer } from '@/lib/useActivePlayer'
import { getEventBySlug } from '@/lib/eventData'
import { usePlayerGames } from '@/lib/usePlayerGames'
import { averageBefore, awardsForGame, boardOrder, eventFlags, nextStep, type BoardPlace } from '@/lib/gameReport'
import {
  ColourScore, EarnedColours, NextTime, PlacementHeader, ReportEventRow, ReportLabel, type ReportEventLine,
} from '@/components/GameReportParts'
import { GameBoardList } from '@/components/GameBoardList'
import { loadGameBoard } from '@/lib/loadGamePlace'
import { prMoments, prsAtGame } from '@/lib/prCounts'

const supabase = createClient()

type SessionRow = {
  id: string
  session_date: string | null
  location: string | null
  is_championship: boolean | null
  is_active: boolean | null
}
type EventRow = { id: string; domain_number: number; domain_name: string; event_name: string }
type ResultRow = {
  player_id: string | null
  player_name: string | null
  event_id: string
  raw_score: number | null
  score_label: string | null
  difficulty_tier: string | null
  is_pr: boolean | null
}
type PlayerRow = { id: string; display_name: string | null; username: string | null; full_name: string | null }

type EventCell = { eventId: string; eventName: string; scoreLabel: string | null; hasScore: boolean }
/** `key` is the player id, or "guest:name" for a guest, who holds no place. */
type Person = { key: string; name: string; events: EventCell[] }

export default function GameReviewPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionRow | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [results, setResults] = useState<ResultRow[]>([])
  const { activePlayerId } = useActivePlayer()
  const games = usePlayerGames(supabase, activePlayerId)
  const [board, setBoard] = useState<{ sessionId: string; rows: BoardPlace[] | null } | null>(null)

  // Everyone's place, once the game has closed. A player's own place is only
  // trusted when every registered player in it has a published total: a partial
  // field would read too high.
  const closed = session ? !session.is_active : false
  const registered = new Set(results.map(r => r.player_id).filter(Boolean)).size
  useEffect(() => {
    if (!closed) return
    let cancelled = false
    loadGameBoard(supabase, sessionId).then(rows => {
      if (!cancelled) setBoard({ sessionId, rows })
    })
    return () => { cancelled = true }
  }, [sessionId, closed])
  const places = board?.sessionId === sessionId ? board.rows : null
  const mineOnBoard = places?.find(b => b.playerId === activePlayerId) ?? null
  const wholeGame = mineOnBoard && mineOnBoard.of >= registered ? mineOnBoard : null

  useEffect(() => {
    async function load() {
      const [sessRes, evRes, resRes] = await Promise.all([
        supabase.from('sessions').select('id, session_date, location, is_championship, is_active').eq('id', sessionId).single(),
        supabase.from('session_events').select('id, domain_number, domain_name, event_name').eq('session_id', sessionId).order('domain_number'),
        supabase.from('results').select('player_id, player_name, event_id, raw_score, score_label, difficulty_tier, is_pr').eq('session_id', sessionId).not('raw_score', 'is', null),
      ])

      const sess = (sessRes.data as SessionRow) ?? null
      const evs = (evRes.data as EventRow[]) ?? []
      const results = (resRes.data as ResultRow[]) ?? []

      // Resolve names + divisions for players who have an account.
      const playerIds = [...new Set(results.map(r => r.player_id).filter(Boolean))] as string[]
      const playerMap: Record<string, PlayerRow> = {}
      if (playerIds.length > 0) {
        // players_public: any logged-in player can open a game report, so this
        // resolves other players' names through the safe roster view. full_name
        // comes back NULL unless that player opted into showing it, which is why
        // display_name is coalesced in the view and is never blank.
        const { data: players } = await supabase
          .from('players_public')
          .select('id, display_name, username, full_name')
          .in('id', playerIds)
        for (const p of (players as PlayerRow[]) ?? []) playerMap[p.id] = p
      }

      setSession(sess)
      setEvents(evs)
      setResults(results)
      setPeople(buildPeople(evs, results, playerMap))
      setLoading(false)
    }
    if (sessionId) load()
  }, [sessionId])

  // The viewer's own game: colour score and colours from their grade inputs.
  // Nobody else's colour score is shown, only the order it puts them in.
  const mine = activePlayerId ? people.find(p => p.key === activePlayerId) ?? null : null
  const myGame = (() => {
    if (!mine || !games) return null
    const score = games.scores.get(sessionId)
    const flags = eventFlags(games.scores, sessionId)
    // Worked out from the scores (lib/prCounts.ts), not results.is_pr, which
    // froze when lifts moved to estimated 1RM.
    const prd = prsAtGame(prMoments(games.inputs), sessionId)
    const lines: ReportEventLine[] = mine.events.map(cell => ({
      eventName: cell.eventName,
      scoreLabel: cell.hasScore ? cell.scoreLabel ?? '' : null,
      rung: score?.rungs.get(cell.eventName) ?? 0,
      isPR: prd.has(cell.eventName),
      firstTime: flags.get(cell.eventName)?.firstTime,
      colourUp: flags.get(cell.eventName)?.colourUp,
    }))
    // Events added on top at this game: a workout linked to the session, never
    // in the score or the placement.
    const added = new Map<string, { label: string | null; raw: number }>()
    for (const e of games.inputs.entries) {
      if (e.workouts?.session_id !== sessionId || !e.event_slug || e.raw_score == null) continue
      const prev = added.get(e.event_slug)
      if (!prev || e.raw_score > prev.raw) added.set(e.event_slug, { label: e.score_label ?? null, raw: e.raw_score })
    }
    return {
      score,
      prs: prd.size,
      average: averageBefore(games.scores, sessionId),
      lines,
      added: [...added.entries()],
      colours: awardsForGame(games.state.allAwards, games.scores, sessionId)
        .map(a => ({ domainNumber: a.domain_number, rung: a.rung })),
      next: nextStep(events.map(e => e.event_name), games.state.grades, games.player,
        games.inputs.bodyweights ?? [], toNZDateString(new Date())),
    }
  })()

  if (loading) {
    return <Shell><div style={{ color: '#555', fontFamily: 'var(--font-body)' }}>Loading game…</div></Shell>
  }
  if (!session) {
    return <Shell><div style={{ color: '#555', fontFamily: 'var(--font-body)' }}>Game not found.</div></Shell>
  }

  return (
    <Shell>
      <div style={{ marginBottom: '28px' }}>
        <Link href="/dashboard" style={{ color: '#2371BB', fontFamily: 'var(--font-label)', fontSize: '14px', textDecoration: 'none' }}>
          ← Back
        </Link>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '40px', margin: '12px 0 4px', color: '#fff', letterSpacing: '0.02em' }}>
          Game report
          {session.is_championship && (
            <span style={{ color: '#F9B051', fontSize: '14px', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginLeft: '12px' }}>CHAMPIONSHIP</span>
          )}
          {session.is_active && (
            <span style={{ color: '#4DB26E', fontSize: '14px', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginLeft: '12px' }}>LIVE</span>
          )}
        </h1>
        <div style={{ color: '#888', fontFamily: 'var(--font-body)', fontSize: '15px' }}>
          {formatNZDate(session.session_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {session.location ? ` · ${session.location}` : ''}
        </div>
      </div>

      {mine && (
        <div style={{ marginBottom: '36px' }}>
          <ReportLabel>Your game</ReportLabel>
          <PlacementHeader game={wholeGame} />
          {myGame?.score && <ColourScore points={myGame.score.points} average={myGame.average} prs={myGame.prs} />}
          {myGame?.next && <NextTime step={myGame.next} />}
          {myGame && <EarnedColours colours={myGame.colours} />}

          <ReportLabel>Your events</ReportLabel>
          <div>
            {(myGame?.lines ?? mine.events.map(cell => ({
              eventName: cell.eventName, scoreLabel: cell.hasScore ? cell.scoreLabel ?? '' : null, rung: 0,
            }))).map(line => <ReportEventRow key={line.eventName} line={line} />)}
          </div>
          {myGame && myGame.added.length > 0 && (
            <>
              <ReportLabel>Added · not in the score</ReportLabel>
              {myGame.added.map(([slug, a]) => (
                <div key={slug} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #1a1a1a', fontSize: '14px' }}>
                  <span style={{ flex: 1, color: '#ccc' }}>{getEventBySlug(slug)?.name ?? slug}</span>
                  <span style={{ color: '#888', fontSize: '13px' }}>{a.label}</span>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      <ReportLabel>Everyone</ReportLabel>
      <div style={{ color: '#555', fontFamily: 'var(--font-body)', fontSize: '13px', marginBottom: '16px' }}>
        {events.length} event{events.length !== 1 ? 's' : ''} · {closed
          ? 'one list for the whole game, ranked on colour score, which is scaled for age and sex'
          : 'places come from colour scores when the game closes'}
      </div>

      {people.length === 0 && (
        <div style={{ color: '#555', fontFamily: 'var(--font-body)' }}>No scores were submitted for this game.</div>
      )}

      <GameBoardList entries={boardOrder(people, places).map(p => ({
        key: p.key, name: p.name, place: p.place, isMe: p.key === activePlayerId,
        events: p.events.map(c => ({ eventName: c.eventName, scoreLabel: c.hasScore ? c.scoreLabel ?? '' : null })),
      }))} />
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '90px 20px 60px' }}>
        {children}
      </div>
    </div>
  )
}

// Everyone with a result, and their best score in each event.
function buildPeople(events: EventRow[], results: ResultRow[], playerMap: Record<string, PlayerRow>): Person[] {
  const nameFor = (pid: string | null, fallback: string | null): string => {
    if (pid && playerMap[pid]) {
      const p = playerMap[pid]
      return p.display_name || p.username || p.full_name || fallback || 'Unknown'
    }
    return fallback || 'Guest'
  }
  const keyFor = (r: ResultRow): string => r.player_id ?? `guest:${r.player_name ?? 'unknown'}`

  const names = new Map<string, string>()
  const best = new Map<string, { raw: number; label: string | null }>()
  for (const r of results) {
    const key = keyFor(r)
    names.set(key, nameFor(r.player_id, r.player_name))
    if (r.raw_score === null) continue
    const at = `${key}::${r.event_id}`
    const cur = best.get(at)
    if (!cur || r.raw_score > cur.raw) best.set(at, { raw: r.raw_score, label: r.score_label })
  }
  return [...names].map(([key, name]) => ({
    key, name,
    events: events.map(ev => {
      const b = best.get(`${key}::${ev.id}`)
      return { eventId: ev.id, eventName: ev.event_name, scoreLabel: b?.label ?? null, hasScore: !!b }
    }),
  }))
}
