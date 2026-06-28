'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { formatNZDate } from '@/lib/dates'

const supabase = createClient()

// Order divisions the way the rest of the app does.
const DIVISION_ORDER = [
  "Men's", "Women's", 'Juniors',
  'Masters Men', 'Masters Women',
  'Grandmaster Men', 'Grandmaster Women',
]

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
}
type PlayerRow = { id: string; display_name: string | null; username: string | null; full_name: string | null; division: string | null }

type EventCell = { eventId: string; eventName: string; scoreLabel: string | null; placement: number; hasScore: boolean }
type Standing = { playerKey: string; name: string; totalPlacement: number; rank: number; events: EventCell[] }
type DivisionReport = { division: string; participants: number; standings: Standing[] }

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

export default function GameReviewPage() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<SessionRow | null>(null)
  const [events, setEvents] = useState<EventRow[]>([])
  const [report, setReport] = useState<DivisionReport[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  useEffect(() => {
    async function load() {
      const [sessRes, evRes, resRes] = await Promise.all([
        supabase.from('sessions').select('id, session_date, location, is_championship, is_active').eq('id', sessionId).single(),
        supabase.from('session_events').select('id, domain_number, domain_name, event_name').eq('session_id', sessionId).order('domain_number'),
        supabase.from('results').select('player_id, player_name, event_id, raw_score, score_label, difficulty_tier').eq('session_id', sessionId).not('raw_score', 'is', null),
      ])

      const sess = (sessRes.data as SessionRow) ?? null
      const evs = (evRes.data as EventRow[]) ?? []
      const results = (resRes.data as ResultRow[]) ?? []

      // Resolve names + divisions for players who have an account.
      const playerIds = [...new Set(results.map(r => r.player_id).filter(Boolean))] as string[]
      const playerMap: Record<string, PlayerRow> = {}
      if (playerIds.length > 0) {
        const { data: players } = await supabase
          .from('players')
          .select('id, display_name, username, full_name, division')
          .in('id', playerIds)
        for (const p of (players as PlayerRow[]) ?? []) playerMap[p.id] = p
      }

      setSession(sess)
      setEvents(evs)
      setReport(buildReport(evs, results, playerMap))
      setLoading(false)
    }
    if (sessionId) load()
  }, [sessionId])

  if (loading) {
    return <Shell><div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>Loading game…</div></Shell>
  }
  if (!session) {
    return <Shell><div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>Game not found.</div></Shell>
  }

  return (
    <Shell>
      <div style={{ marginBottom: '28px' }}>
        <Link href="/dashboard" style={{ color: '#2371BB', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', textDecoration: 'none' }}>
          ← Back to dashboard
        </Link>
        <h1 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '40px', margin: '12px 0 4px', color: '#fff', letterSpacing: '0.02em' }}>
          Game Review
          {session.is_championship && (
            <span style={{ color: '#F9B051', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginLeft: '12px' }}>CHAMPIONSHIP</span>
          )}
          {session.is_active && (
            <span style={{ color: '#4DB26E', fontSize: '14px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginLeft: '12px' }}>LIVE</span>
          )}
        </h1>
        <div style={{ color: '#888', fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}>
          {formatNZDate(session.session_date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          {session.location ? ` · ${session.location}` : ''}
        </div>
        <div style={{ color: '#555', fontFamily: 'Barlow, sans-serif', fontSize: '13px', marginTop: '4px' }}>
          {events.length} event{events.length !== 1 ? 's' : ''} · placements computed from submitted scores (lower total = better; a missed event = last in division)
        </div>
      </div>

      {report.length === 0 && (
        <div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>No scores were submitted for this game.</div>
      )}

      {report.map(div => (
        <div key={div.division} style={{ marginBottom: '32px' }}>
          <h2 style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '26px', color: '#fff', margin: '0 0 4px', letterSpacing: '0.03em' }}>
            {div.division}
          </h2>
          <div style={{ color: '#555', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '0.08em', marginBottom: '12px' }}>
            {div.participants} PLAYER{div.participants !== 1 ? 'S' : ''}
          </div>

          {div.standings.map(s => {
            const key = `${div.division}::${s.playerKey}`
            const isOpen = !!expanded[key]
            const medal = s.rank === 1 ? '#F9B051' : s.rank === 2 ? '#C0C0C0' : s.rank === 3 ? '#CD7F32' : '#555'
            return (
              <div key={key} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', marginBottom: '8px', overflow: 'hidden' }}>
                <button
                  onClick={() => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                >
                  <div style={{ fontFamily: 'Bebas Neue, sans-serif', fontSize: '24px', color: medal, minWidth: '40px' }}>
                    {ordinal(s.rank)}
                  </div>
                  <div style={{ flex: 1, color: '#fff', fontFamily: 'Barlow, sans-serif', fontWeight: 600, fontSize: '16px' }}>
                    {s.name}
                  </div>
                  <div style={{ color: '#888', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px', letterSpacing: '0.05em' }}>
                    {s.totalPlacement} pts
                  </div>
                  <div style={{ color: '#555', fontSize: '12px' }}>{isOpen ? '▲' : '▼'}</div>
                </button>

                {isOpen && (
                  <div style={{ borderTop: '1px solid #1e1e1e', padding: '4px 16px 12px' }}>
                    {s.events.map(ec => (
                      <div key={ec.eventId} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #161616' }}>
                        <div style={{ flex: 1, color: ec.hasScore ? '#ddd' : '#555', fontFamily: 'Barlow, sans-serif', fontSize: '14px' }}>
                          {ec.eventName}
                        </div>
                        <div style={{ color: ec.hasScore ? '#aaa' : '#444', fontFamily: 'Barlow, sans-serif', fontSize: '13px', minWidth: '120px', textAlign: 'right' }}>
                          {ec.hasScore ? ec.scoreLabel : 'No score'}
                        </div>
                        <div style={{ color: '#666', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', minWidth: '50px', textAlign: 'right' }}>
                          {ordinal(ec.placement)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
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

// Build the per-division report. Mirrors the award_session_points trigger:
//   • rank scored players per event by raw_score DESC (ties shared)
//   • a player in the division with no score for an event = last place
//     (= number of players in the division who played the session)
//   • total placement = sum of event placements; lowest total wins.
function buildReport(events: EventRow[], results: ResultRow[], playerMap: Record<string, PlayerRow>): DivisionReport[] {
  const nameFor = (pid: string | null, fallback: string | null): string => {
    if (pid && playerMap[pid]) {
      const p = playerMap[pid]
      return p.display_name || p.username || p.full_name || fallback || 'Unknown'
    }
    return fallback || 'Guest'
  }
  const divFor = (pid: string | null): string => (pid && playerMap[pid]?.division) || 'Unspecified'
  const keyFor = (r: ResultRow): string => r.player_id ?? `guest:${r.player_name ?? 'unknown'}`

  // best raw per (playerKey, event)
  const best: Record<string, Record<string, number>> = {}
  const playerKeys = new Set<string>()
  const keyDivision: Record<string, string> = {}
  const keyName: Record<string, string> = {}
  const labelFor: Record<string, Record<string, string | null>> = {}

  for (const r of results) {
    const key = keyFor(r)
    playerKeys.add(key)
    keyDivision[key] = divFor(r.player_id)
    keyName[key] = nameFor(r.player_id, r.player_name)
    if (r.raw_score === null) continue
    best[key] ??= {}
    labelFor[key] ??= {}
    if (best[key][r.event_id] === undefined || r.raw_score > best[key][r.event_id]) {
      best[key][r.event_id] = r.raw_score
      labelFor[key][r.event_id] = r.score_label
    }
  }

  // group player keys by division
  const byDivision: Record<string, string[]> = {}
  for (const key of playerKeys) {
    const d = keyDivision[key]
    ;(byDivision[d] ??= []).push(key)
  }

  const reports: DivisionReport[] = []
  for (const division of Object.keys(byDivision)) {
    const keys = byDivision[division]
    const nDiv = keys.length

    const standings: Standing[] = keys.map(key => {
      let total = 0
      const cells: EventCell[] = events.map(ev => {
        const myRaw = best[key]?.[ev.id]
        if (myRaw === undefined) {
          total += nDiv // missed event = last place in division
          return { eventId: ev.id, eventName: ev.event_name, scoreLabel: null, placement: nDiv, hasScore: false }
        }
        // rank = 1 + number of division players with a strictly higher score for this event
        const better = keys.filter(k => {
          const r = best[k]?.[ev.id]
          return r !== undefined && r > myRaw
        }).length
        const placement = better + 1
        total += placement
        return { eventId: ev.id, eventName: ev.event_name, scoreLabel: labelFor[key]?.[ev.id] ?? null, placement, hasScore: true }
      })
      return { playerKey: key, name: keyName[key], totalPlacement: total, rank: 0, events: cells }
    })

    standings.sort((a, b) => a.totalPlacement - b.totalPlacement)
    // shared ranks: 1 + number of players with a strictly lower total
    standings.forEach(s => {
      s.rank = 1 + standings.filter(x => x.totalPlacement < s.totalPlacement).length
    })

    reports.push({ division, participants: nDiv, standings })
  }

  // order divisions canonically, unknown ones last
  reports.sort((a, b) => {
    const ia = DIVISION_ORDER.indexOf(a.division)
    const ib = DIVISION_ORDER.indexOf(b.division)
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib)
  })
  return reports
}
