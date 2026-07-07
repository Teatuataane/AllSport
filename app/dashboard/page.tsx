'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { formatNZDate } from '@/lib/dates'
import { EVENTS } from '@/lib/eventData'
import { domainColor } from '@/components/EventIcon'
import Link from 'next/link'

const supabase = createClient()

const GRADES = [
  { name: 'Mā',        colour: '#f0f0f0',   textColour: '#1a1a1a', threshold: 0,     borderColour: '#ccc' },
  { name: 'Kiwikiwi',  colour: '#888888',   textColour: '#fff',    threshold: 500,   borderColour: '#888' },
  { name: 'Whero',     colour: '#EA4742',   textColour: '#fff',    threshold: 1000,  borderColour: '#EA4742' },
  { name: 'Karaka',    colour: '#F9B051',   textColour: '#000',    threshold: 2000,  borderColour: '#F9B051' },
  { name: 'Kōwhai',    colour: '#FFE566',   textColour: '#000',    threshold: 3000,  borderColour: '#FFE566' },
  { name: 'Kākāriki',  colour: '#4DB26E',   textColour: '#fff',    threshold: 4000,  borderColour: '#4DB26E' },
  { name: 'Kahurangi', colour: '#2371BB',   textColour: '#fff',    threshold: 5000,  borderColour: '#2371BB' },
  { name: 'Poroporo',  colour: '#B87DB5',   textColour: '#fff',    threshold: 6000,  borderColour: '#B87DB5' },
  { name: 'Uenuku',    colour: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', textColour: '#fff', threshold: 8000, borderColour: '#B87DB5' },
  { name: 'Taniwha',   colour: '#000000',   textColour: '#F9B051', threshold: 10000, borderColour: '#F9B051' },
]

const PLAYER_ICONS = ['🏋️', '🤸', '🏃', '🚴', '🤼', '🏊', '🎯', '🏹', '⚽', '🏀', '🎾', '🏐', '🦅', '🐯', '🦁', '🦊', '🐺', '🦋', '🐬', '🐉']

function gradeCardStyle(grade: typeof GRADES[0]): React.CSSProperties {
  if (grade.colour.startsWith('linear-gradient')) {
    return { backgroundImage: grade.colour }
  }
  return { background: grade.colour }
}

function getCurrentGrade(points: number) {
  let grade = GRADES[0]
  for (const g of GRADES) { if (points >= g.threshold) grade = g }
  return grade
}

function getNextGrade(points: number) {
  for (const g of GRADES) { if (points < g.threshold) return g }
  return null
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}

// Next session from the fixed weekly schedule — Tue & Thu 4:30pm, Sat 9:00am, NZ time.
// Works on NZ wall-clock minutes so it's correct wherever the device is.
function nextScheduledSession(now = new Date()): { label: string; relative: string } {
  const SLOTS = [
    { dow: 2, mins: 16 * 60 + 30, label: 'Tuesday 4:30pm' },
    { dow: 4, mins: 16 * 60 + 30, label: 'Thursday 4:30pm' },
    { dow: 6, mins: 9 * 60, label: 'Saturday 9:00am' },
  ]
  const parts = new Intl.DateTimeFormat('en-NZ', {
    timeZone: 'Pacific/Auckland', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(now)
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0'
  const dowIdx = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'))
  const nowMins = parseInt(get('hour')) * 60 + parseInt(get('minute'))
  let best = { label: SLOTS[0].label, delta: Infinity }
  for (const s of SLOTS) {
    let delta = ((s.dow - dowIdx + 7) % 7) * 1440 + (s.mins - nowMins)
    if (delta <= 0) delta += 7 * 1440
    if (delta < best.delta) best = { label: s.label, delta }
  }
  const hrs = Math.round(best.delta / 60)
  const relative = best.delta < 60
    ? `in ${best.delta} minute${best.delta === 1 ? '' : 's'}`
    : best.delta < 48 * 60
      ? `in ${hrs} hour${hrs === 1 ? '' : 's'}`
      : `in ${Math.round(best.delta / 1440)} days`
  return { label: best.label, relative }
}

// ── Bento card wrapper ────────────────────────────────────────────────────────
function BentoCard({
  onClick, href, children, style = {},
}: {
  onClick?: () => void
  href?: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    display: 'block', width: '100%', textDecoration: 'none',
    borderRadius: '16px', cursor: 'pointer',
    transition: 'opacity 0.15s, transform 0.1s',
    WebkitTapHighlightColor: 'transparent',
    ...style,
  }
  if (href) {
    return <Link href={href} style={base}>{children}</Link>
  }
  return (
    <button onClick={onClick} style={{ ...base, border: 'none', padding: 0, textAlign: 'left' as const }}>
      {children}
    </button>
  )
}

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Auth state
  const [userId, setUserId] = useState<string | null>(null)
  const [player, setPlayer] = useState<any>(null) // auth user's player record
  const [loading, setLoading] = useState(true)

  // Active profile context (may be a family member)
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)
  const [activePlayer, setActivePlayer] = useState<any>(null)
  const [familyMembers, setFamilyMembers] = useState<any[]>([])

  // Rankings
  const [ranking, setRanking] = useState<any>(null)
  const [allRankings, setAllRankings] = useState<any[]>([])
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [rankingLoading, setRankingLoading] = useState(false)

  // Top event
  const [topEvent, setTopEvent] = useState<{ event_name: string; player_rank: number; total_players: number } | null>(null)

  // My 100 — distinct event names ever played (null while loading)
  const [playedEvents, setPlayedEvents] = useState<Set<string> | null>(null)

  // Active session (non-judges)
  const [activeSession, setActiveSession] = useState<any>(null)   // player already has results in this session
  const [anyActiveSession, setAnyActiveSession] = useState<any>(null) // any currently running session

  // Join game
  const [joinError, setJoinError] = useState('')
  const [pendingAutoJoin, setPendingAutoJoin] = useState<string | null>(null)

  // Colours history modal
  const [showHistory, setShowHistory] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historySessions, setHistorySessions] = useState<any[]>([])
  const [expandedSession, setExpandedSession] = useState<string | null>(null)
  const [sessionEvents, setSessionEvents] = useState<Record<string, any[]>>({})

  // ── Initial load ────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/play'); return }
      setUserId(user.id)

      const [playerResult, familyResult] = await Promise.all([
        supabase.from('players').select('*').eq('id', user.id).single(),
        supabase.from('players')
          .select('id, full_name, display_name, username, division, date_of_birth, icon')
          .eq('parent_id', user.id)
          .order('full_name'),
      ])

      setPlayer(playerResult.data)
      setFamilyMembers(familyResult.data || [])

      // Restore active profile from localStorage
      const stored = typeof window !== 'undefined' ? localStorage.getItem('allsport_active_player_id') : null
      const members = familyResult.data || []
      if (stored && stored !== user.id && members.find((m: any) => m.id === stored)) {
        setActivePlayerId(stored)
        setActivePlayer(members.find((m: any) => m.id === stored))
      } else {
        setActivePlayerId(user.id)
        setActivePlayer(playerResult.data)
      }

      setLoading(false)
    }
    load()
  }, [router])

  // Re-sync active player when family members or player changes
  useEffect(() => {
    if (!activePlayerId || !player) return
    if (activePlayerId === player.id) {
      setActivePlayer(player)
    } else {
      const member = familyMembers.find(m => m.id === activePlayerId)
      if (member) setActivePlayer(member)
    }
  }, [player, familyMembers, activePlayerId])

  // ── Year-dependent data ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!activePlayerId) return
    const loadRanking = async () => {
      setRankingLoading(true)
      const [singleResult, allResult] = await Promise.all([
        supabase.from('rankings').select('*').eq('player_id', activePlayerId).eq('season_year', selectedYear).maybeSingle(),
        supabase.from('rankings').select('season_year, total_points').eq('player_id', activePlayerId).gt('total_points', 0).order('season_year', { ascending: false }),
      ])
      setRanking(singleResult.data)
      setAllRankings(allResult.data || [])
      setRankingLoading(false)
    }
    loadRanking()
  }, [activePlayerId, selectedYear])

  // ── My 100: lifetime event coverage ─────────────────────────────────────────
  useEffect(() => {
    if (!activePlayerId) return
    setPlayedEvents(null)
    supabase
      .from('results')
      .select('session_events!inner(event_name)')
      .eq('player_id', activePlayerId)
      .then(({ data }) => {
        const names = new Set<string>()
        for (const r of (data ?? []) as any[]) {
          const n = r.session_events?.event_name
          if (n) names.add(n)
        }
        setPlayedEvents(names)
      })
  }, [activePlayerId])

  // ── Top event ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activePlayerId || !activePlayer?.division) return
    const loadTopEvent = async () => {
      const { data } = await supabase.rpc('get_player_top_event', {
        p_player_id: activePlayerId,
        p_division: activePlayer.division,
      })
      if (data && data.length > 0) setTopEvent(data[0])
      else setTopEvent(null)
    }
    loadTopEvent()
  }, [activePlayerId, activePlayer?.division])

  // ── Active session detection ─────────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const checkActive = async () => {
      // Find any currently running session
      const { data: anyActive } = await supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .maybeSingle()
      setAnyActiveSession(anyActive)

      if (anyActive) {
        // Check if this player already has a result in this session
        const { data: result } = await supabase
          .from('results')
          .select('id')
          .eq('player_id', userId)
          .eq('session_id', anyActive.id)
          .limit(1)
        if (result && result.length > 0) setActiveSession(anyActive)
      }
    }
    checkActive()
  }, [userId])

  // ── Auto-join from QR / ?code= (silent, no UI — QR code fallback) ───────────
  useEffect(() => {
    const codeFromUrl = searchParams.get('code')
    const codeFromStorage = typeof window !== 'undefined' ? localStorage.getItem('pending_session_code') : null
    const code = codeFromUrl || codeFromStorage
    if (code) {
      setPendingAutoJoin(code.toUpperCase())
      if (codeFromStorage) localStorage.removeItem('pending_session_code')
    }
  }, [searchParams])

  useEffect(() => {
    if (pendingAutoJoin && !loading) {
      setPendingAutoJoin(null)
      handleJoinByCode(pendingAutoJoin)
    }
  }, [pendingAutoJoin, loading])

  const handleJoinByCode = async (code: string) => {
    setJoinError('')
    try {
      const { data: sess, error } = await supabase
        .from('sessions')
        .select('id, session_code, is_active, location')
        .ilike('session_code', code)
        .maybeSingle()
      if (error) throw new Error(`Session lookup failed: ${error.message}`)
      if (!sess) throw new Error(`No session found with code "${code}". Ask the Kaiwhakawā to confirm the code on their screen.`)
      if (!sess.is_active) throw new Error(`Session "${code}" has ended.`)
      window.location.href = `/scoring/${sess.id}`
    } catch (e: any) {
      setJoinError(e.message)
    }
  }

  // ── Points history ───────────────────────────────────────────────────────────
  const loadHistory = async () => {
    if (!activePlayerId) return
    setHistoryLoading(true)
    setShowHistory(true)

    // Try session_player_summary first, fall back to results
    const { data: summaries } = await supabase
      .from('session_player_summary')
      .select('*, sessions(id, session_date, location, is_championship)')
      .eq('player_id', activePlayerId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (summaries && summaries.length > 0) {
      setHistorySessions(summaries)
    } else {
      // Fallback: group results by session
      const { data: results } = await supabase
        .from('results')
        .select('session_id, placement, points_earned, effort_task_completions, sessions(id, session_date, location, is_championship)')
        .eq('player_id', activePlayerId)
        .not('points_earned', 'is', null)
        .order('created_at', { ascending: false })
        .limit(100)

      if (results) {
        const bySession: Record<string, any> = {}
        for (const r of results) {
          const sid = r.session_id
          if (!bySession[sid]) {
            bySession[sid] = {
              session_id: sid,
              sessions: r.sessions,
              overall_placement: r.placement,
              total_placement_points: r.points_earned || 0,
              effort_points: 0,
              effort_level: 0,
              _fallback: true,
            }
          }
        }
        setHistorySessions(Object.values(bySession))
      }
    }

    setHistoryLoading(false)
  }

  const loadSessionEvents = async (sessionId: string) => {
    if (sessionEvents[sessionId]) return
    const [eventsResult, resultsResult] = await Promise.all([
      supabase.from('session_events').select('*').eq('session_id', sessionId).order('domain_number'),
      supabase.from('results').select('event_id, score_label, raw_score, placement').eq('session_id', sessionId).eq('player_id', activePlayerId!).not('raw_score', 'is', null),
    ])
    const evs = eventsResult.data || []
    const res = resultsResult.data || []
    // Attach result to each event
    const merged = evs.map((ev: any) => ({
      ...ev,
      result: res.find((r: any) => r.event_id === ev.id) || null,
    }))
    setSessionEvents(prev => ({ ...prev, [sessionId]: merged }))
  }

  // ── Derived values ────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontFamily: 'var(--font-body)' }}>Loading...</div>
    </div>
  )

  if (!player || !activePlayer) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ color: '#555' }}>No player profile found.</div>
      <a href="/register" style={{ color: '#2371BB' }}>Complete registration</a>
    </div>
  )

  const points = ranking?.total_points || 0
  const grade = getCurrentGrade(points)
  const nextGrade = getNextGrade(points)
  const progress = nextGrade
    ? ((points - grade.threshold) / (nextGrade.threshold - grade.threshold)) * 100
    : 100

  const currentYear = new Date().getFullYear()
  const yearsWithData = allRankings.map((r: any) => r.season_year)
  const years = [...new Set([currentYear, ...yearsWithData])].filter((y: number) => y >= 2025).sort((a: number, b: number) => b - a)

  const isJudge = player.role === 'judge'
  const hasNoSessions = !ranking || ranking.total_sessions === 0
  const nextSession = nextScheduledSession()

  // My 100 coverage per domain — event names stored as strings, so legacy
  // orphan names simply don't match; that's fine
  const my100 = Array.from({ length: 10 }, (_, i) => {
    const domainNum = i + 1
    const domainEvents = EVENTS.filter(e => e.domainNumber === domainNum)
    const played = playedEvents ? domainEvents.filter(e => playedEvents.has(e.name)).length : 0
    return { domainNum, played }
  })
  const my100Total = Math.min(100, my100.reduce((s, d) => s + d.played, 0))
  const icon = activePlayer.icon || null
  const displayName = activePlayer.display_name || activePlayer.username || '?'

  // ── Colours card bar ─────────────────────────────────────────────────────────
  const isTaniwha = grade.name === 'Taniwha'
  const isUenuku = grade.name === 'Uenuku'
  const barBg: React.CSSProperties = isTaniwha
    ? { background: '#F9B051' }
    : isUenuku
    ? { backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.9), rgba(255,255,255,0.5))' }
    : grade.textColour === '#fff'
    ? { background: 'rgba(255,255,255,0.9)' }
    : { background: 'rgba(0,0,0,0.3)' }

  const barTrackBg: React.CSSProperties = isTaniwha
    ? { background: '#222' }
    : { background: 'rgba(0,0,0,0.2)' }

  return (
    <div style={{
      minHeight: '100vh', background: '#0a0a0a', color: '#fff',
      maxWidth: '520px', margin: '0 auto', padding: '20px 16px 40px',
    }}>

      {/* ── Card 1: Judge Panel ─────────────────────────────────────────────── */}
      {isJudge && (
        <BentoCard href="/judge" style={{ marginBottom: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #061428, #0d2140)',
            border: '1px solid #2371BB44',
            borderLeft: '4px solid #2371BB',
            borderRadius: '16px',
            padding: '20px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            minHeight: '80px',
          }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '22px',
                color: '#2371BB', letterSpacing: '0.06em', lineHeight: 1,
              }}>
                Kaiwhakawā
              </div>
              <div style={{
                fontSize: '11px', color: '#4a7ab5',
                fontFamily: 'var(--font-label)',
                letterSpacing: '0.1em', marginTop: '3px',
              }}>
                KAIWHAKAWĀ PANEL · Start session or create vote
              </div>
            </div>
            <div style={{ color: '#2371BB', fontSize: '24px', marginLeft: '16px' }}>→</div>
          </div>
        </BentoCard>
      )}

      {/* ── Card 2: Active session return (non-judge) ───────────────────────── */}
      {!isJudge && activeSession && (
        <BentoCard href={`/scoring/${activeSession.id}`} style={{ marginBottom: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #061a0d, #0d2e1a)',
            border: '1px solid #4DB26E44',
            borderLeft: '4px solid #4DB26E',
            borderRadius: '16px',
            padding: '18px 22px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div>
              <div style={{ color: '#4DB26E', fontWeight: 'bold', fontSize: '14px', fontFamily: 'var(--font-display)', letterSpacing: '0.06em' }}>
                Session in Progress
              </div>
              <div style={{ color: '#888', fontSize: '12px', marginTop: '2px', fontFamily: 'var(--font-body)' }}>
                {activeSession.location} — tap to return
              </div>
            </div>
            <div style={{ color: '#4DB26E', fontSize: '24px' }}>→</div>
          </div>
        </BentoCard>
      )}

      {/* ── Card 3: Event Vote (injected as a bento card when active) ──────── */}
      {userId && player && (
        <VoteCard userId={userId} isJudge={isJudge} />
      )}

      {/* ── Card 4: Player Profile ──────────────────────────────────────────── */}
      <BentoCard href="/profile" style={{ marginBottom: '12px' }}>
        <div style={{
          background: '#111',
          border: '1px solid #1e1e1e',
          borderLeft: `4px solid ${grade.borderColour}`,
          borderRadius: '16px',
          padding: '20px 22px',
          minHeight: '110px',
          display: 'flex', alignItems: 'center', gap: '18px',
        }}>
          {/* Icon */}
          <div style={{
            width: '56px', height: '56px', borderRadius: '14px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '30px', flexShrink: 0,
            background: '#1a1a1a', border: `1px solid ${grade.borderColour}33`,
          }}>
            {icon || (
              <span style={{
                fontFamily: 'var(--font-display)', fontSize: '26px',
                color: grade.borderColour,
              }}>
                {displayName[0].toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '22px',
              letterSpacing: '0.04em', color: '#fff', lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {displayName}
            </div>
            <div style={{
              fontSize: '12px', color: '#666',
              fontFamily: 'var(--font-label)',
              letterSpacing: '0.05em', marginTop: '4px',
            }}>
              {activePlayer.division}
              {ranking?.current_rank ? ` · #${ranking.current_rank} in division` : ''}
            </div>
            {topEvent && (
              <div style={{
                marginTop: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px',
                background: '#1a1a1a', border: `1px solid ${grade.borderColour}44`,
                borderRadius: '6px', padding: '3px 10px',
              }}>
                <span style={{ fontSize: '10px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>TOP EVENT</span>
                <span style={{ fontSize: '11px', color: '#ccc', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                  {topEvent.event_name}
                </span>
                {topEvent.total_players > 1 && (
                  <span style={{ fontSize: '10px', color: grade.borderColour }}>
                    #{topEvent.player_rank}
                  </span>
                )}
              </div>
            )}
          </div>

          <div style={{ color: '#444', fontSize: '20px', flexShrink: 0 }}>→</div>
        </div>
      </BentoCard>

      {/* ── Card 5: Colours ─────────────────────────────────────────────────── */}
      <BentoCard onClick={loadHistory} style={{ marginBottom: '12px' }}>
        <div style={{
          ...gradeCardStyle(grade),
          borderRadius: '16px',
          padding: '22px',
          minHeight: '140px',
          opacity: rankingLoading ? 0.7 : 1,
          transition: 'opacity 0.2s',
          ...(isTaniwha ? { border: '2px solid #F9B051' } : {}),
        }}>
          {/* Header row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '28px',
                color: grade.textColour, letterSpacing: '0.05em', lineHeight: 1,
              }}>
                {grade.name}
              </div>
              <div style={{
                fontSize: '11px', color: grade.textColour,
                opacity: 0.6, fontFamily: 'var(--font-label)',
                letterSpacing: '0.1em', marginTop: '2px',
              }}>
                COLOURS · TAP FOR HISTORY
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '30px', fontWeight: 'bold', color: grade.textColour, lineHeight: 1 }}>
                {points.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: grade.textColour, opacity: 0.6, fontFamily: 'var(--font-label)' }}>
                pts · {selectedYear}
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {nextGrade ? (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between',
                fontSize: '10px', color: grade.textColour, opacity: 0.7,
                fontFamily: 'var(--font-label)', marginBottom: '5px',
              }}>
                <span style={{ fontWeight: 700 }}>{grade.name}</span>
                <span>{nextGrade.name} — {(nextGrade.threshold - points).toLocaleString()} pts to go</span>
              </div>
              <div style={{ height: '6px', borderRadius: '3px', overflow: 'hidden', ...barTrackBg }}>
                <div style={{
                  height: '100%', borderRadius: '3px',
                  width: `${Math.min(progress, 100)}%`,
                  transition: 'width 0.6s ease', ...barBg,
                }} />
              </div>
            </>
          ) : (
            <div style={{ fontSize: '12px', color: grade.textColour, opacity: 0.8, fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>
              Taniwha — Peak Grade
            </div>
          )}

          {/* Year tabs */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '14px' }}>
            {years.map((y: number) => (
              <button
                key={y}
                onClick={e => { e.stopPropagation(); setSelectedYear(y) }}
                style={{
                  padding: '4px 12px', borderRadius: '5px', border: 'none',
                  cursor: 'pointer', fontSize: '11px', fontFamily: 'var(--font-label)',
                  background: selectedYear === y ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.15)',
                  color: grade.textColour,
                  opacity: selectedYear === y ? 1 : 0.5,
                  fontWeight: selectedYear === y ? 700 : 400,
                }}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      </BentoCard>

      {/* ── Card 6: Personal Bests ───────────────────────────────────────────── */}
      <BentoCard href="/prs" style={{ marginBottom: '12px' }}>
        <div style={{
          background: '#111',
          border: '1px solid #1e1e1e',
          borderLeft: '4px solid #2371BB',
          borderRadius: '16px',
          padding: '20px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: '76px',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '20px',
              color: '#fff', letterSpacing: '0.05em', lineHeight: 1,
            }}>
              My Personal Bests
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '3px' }}>
              All 100 events — your best scores
            </div>
          </div>
          <div style={{ color: '#2371BB', fontSize: '22px' }}>→</div>
        </div>
      </BentoCard>

      {/* ── Card 6b: My 100 — lifetime event coverage ────────────────────────── */}
      <BentoCard href="/prs" style={{ marginBottom: '12px' }}>
        <div style={{
          background: '#111',
          border: '1px solid #1e1e1e',
          borderLeft: '4px solid #F397C0',
          borderRadius: '16px',
          padding: '20px 22px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: '20px',
                color: '#fff', letterSpacing: '0.05em', lineHeight: 1,
              }}>
                My 100
              </div>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '3px' }}>
                {playedEvents ? `${my100Total} of 100 events played` : 'Loading your events…'}
              </div>
            </div>
            <div style={{ color: '#F397C0', fontSize: '22px' }}>→</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {my100.map(d => (
              <div key={d.domainNum} style={{ display: 'flex', gap: '6px' }}>
                {Array.from({ length: 10 }, (_, i) => (
                  <div key={i} style={{
                    flex: 1, height: '10px', borderRadius: '99px',
                    background: i < Math.min(d.played, 10) ? domainColor(d.domainNum) : '#1e1e1e',
                  }} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </BentoCard>

      {/* ── Card 7: My Koha ──────────────────────────────────────────────── */}
      <BentoCard href="/my-koha" style={{ marginBottom: '12px' }}>
        <div style={{
          background: '#111',
          border: '1px solid #1e1e1e',
          borderLeft: '4px solid #4DB26E',
          borderRadius: '16px',
          padding: '20px 22px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          minHeight: '76px',
        }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '20px',
              color: '#fff', letterSpacing: '0.05em', lineHeight: 1,
            }}>
              My Koha
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '3px' }}>
              Donations, referrals &amp; tier status
            </div>
          </div>
          <div style={{ color: '#4DB26E', fontSize: '22px' }}>→</div>
        </div>
      </BentoCard>

      {/* ── Card 8: Join a Game / next session countdown ────────────────────── */}
      {!isJudge && !activeSession && (
        <div style={{
          background: anyActiveSession && hasNoSessions ? '#061a0d' : anyActiveSession ? '#0a120a' : '#0d0d0d',
          border: anyActiveSession ? `1px solid ${hasNoSessions ? '#4DB26E' : '#2a4a2a'}` : '1px solid #1e1e1e',
          borderLeft: `4px solid ${anyActiveSession ? '#4DB26E' : '#2371BB'}`,
          borderRadius: '16px',
          padding: '20px 22px',
          ...(anyActiveSession && hasNoSessions ? { boxShadow: '0 0 24px #4DB26E22' } : {}),
        }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: '20px',
            color: anyActiveSession ? (hasNoSessions ? '#4DB26E' : '#6ecf8a') : '#fff',
            letterSpacing: '0.05em', marginBottom: '4px', lineHeight: 1,
          }}>
            {anyActiveSession
              ? (hasNoSessions ? 'Join Your First Game' : 'Join a Game')
              : `Next session: ${nextSession.label}`}
          </div>
          <div style={{
            fontSize: '11px', color: '#555',
            fontFamily: 'var(--font-label)',
            letterSpacing: '0.05em', marginBottom: anyActiveSession ? '14px' : 0,
          }}>
            {anyActiveSession
              ? anyActiveSession.location || 'AllSport HQ'
              : <><span style={{ color: '#7ab4ff' }}>{nextSession.relative}</span> · Tue &amp; Thu 4:30pm — Sat 9:00am</>}
          </div>

          {anyActiveSession && (
            <>
              {joinError && (
                <div style={{
                  background: '#2e0d0d', border: '1px solid #EA4742',
                  borderRadius: '8px', padding: '10px 14px', marginBottom: '12px',
                  color: '#EA4742', fontSize: '12px', lineHeight: 1.4,
                }}>
                  ⚠ {joinError}
                </div>
              )}
              <button
                onClick={() => { window.location.href = `/scoring/${anyActiveSession.id}` }}
                style={{
                  width: '100%', padding: '15px', borderRadius: '10px', border: 'none',
                  cursor: 'pointer',
                  background: hasNoSessions
                    ? 'linear-gradient(135deg, #2d7d46, #4DB26E)'
                    : '#1a3d22',
                  color: '#fff', fontWeight: 'bold', fontSize: '18px',
                  fontFamily: 'var(--font-display)', letterSpacing: '0.08em',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                Join Session Now →
              </button>
            </>
          )}
        </div>
      )}

      {/* ── Points History Modal ─────────────────────────────────────────────── */}
      {showHistory && (
        <>
          {/* Fixed header bar — always on screen regardless of scroll */}
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1100,
            background: '#0a0a0a', borderBottom: '1px solid #222',
            padding: '14px 16px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ maxWidth: '520px', width: '100%', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', lineHeight: 1, color: '#fff' }}>
                  Points History
                </div>
                <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginTop: '1px' }}>
                  {displayName.toUpperCase()} · {selectedYear}
                </div>
              </div>
              <button onClick={() => setShowHistory(false)} style={{
                background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px',
                color: '#ccc', cursor: 'pointer', padding: '10px 18px',
                fontFamily: 'var(--font-label)', fontSize: '14px', fontWeight: 700,
                minHeight: '44px', flexShrink: 0,
              }}>
                ← Back
              </button>
            </div>
          </div>

          {/* Scrollable overlay — sits behind the fixed header */}
          <div style={{
            position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.97)',
            zIndex: 1050, overflowY: 'auto',
            paddingTop: '72px', /* clears the fixed header */
          }}>
          <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 16px 40px' }}>

            {/* Year tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
              {years.map((y: number) => (
                <button key={y} onClick={() => setSelectedYear(y)} style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  cursor: 'pointer', fontSize: '12px',
                  background: selectedYear === y ? '#2371BB' : '#1a1a1a',
                  color: selectedYear === y ? '#fff' : '#555',
                  fontFamily: 'var(--font-label)', letterSpacing: '0.05em',
                }}>
                  {y}
                </button>
              ))}
            </div>

            {historyLoading ? (
              <div style={{ color: '#555', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-body)' }}>
                Loading history...
              </div>
            ) : historySessions.length === 0 ? (
              <div style={{ color: '#444', textAlign: 'center', padding: '40px 0', fontFamily: 'var(--font-body)' }}>
                No sessions found for {selectedYear}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {historySessions.map((s: any) => {
                  const sess = s.sessions
                  const sid = s.session_id
                  const isExpanded = expandedSession === sid
                  const evData = sessionEvents[sid]
                  const totalPts = (s.total_placement_points || 0) + (s.effort_points || 0)

                  return (
                    <div key={sid} style={{
                      background: '#111', border: '1px solid #1e1e1e',
                      borderRadius: '12px', overflow: 'hidden',
                    }}>
                      {/* Summary row */}
                      <button
                        onClick={async () => {
                          if (isExpanded) {
                            setExpandedSession(null)
                          } else {
                            setExpandedSession(sid)
                            await loadSessionEvents(sid)
                          }
                        }}
                        style={{
                          width: '100%', padding: '16px 18px',
                          background: 'transparent', border: 'none',
                          cursor: 'pointer', textAlign: 'left' as const,
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                            {sess?.location || 'Session'}
                            {sess?.is_championship && (
                              <span style={{ color: '#F9B051', marginLeft: '8px', fontSize: '10px', fontFamily: 'var(--font-label)', letterSpacing: '0.1em' }}>
                                CHAMPIONSHIP
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#555', marginTop: '2px', fontFamily: 'var(--font-label)' }}>
                            {formatNZDate(sess?.session_date)}
                            {s.overall_placement ? ` · ${ordinal(s.overall_placement)} place` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4DB26E' }}>
                            +{totalPts}
                          </div>
                          <div style={{ fontSize: '10px', color: '#555', fontFamily: 'var(--font-label)' }}>
                            pts total
                          </div>
                        </div>
                      </button>

                      {/* Expanded breakdown */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid #1e1e1e', padding: '14px 18px' }}>
                          {/* Points breakdown */}
                          <div style={{
                            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                            gap: '8px', marginBottom: '14px',
                          }}>
                            {[
                              { label: 'Placement', value: `+${s.total_placement_points || 0}` },
                              { label: 'Effort', value: `+${s.effort_points || 0}` },
                              { label: 'Effort Level', value: s.effort_level || 0 },
                            ].map(stat => (
                              <div key={stat.label} style={{
                                background: '#0a0a0a', borderRadius: '8px', padding: '10px',
                                textAlign: 'center',
                              }}>
                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#fff' }}>{stat.value}</div>
                                <div style={{ fontSize: '10px', color: '#555', marginTop: '2px', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>{stat.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Events */}
                          {!evData ? (
                            <div style={{ color: '#555', fontSize: '12px', fontFamily: 'var(--font-body)', textAlign: 'center', padding: '8px 0' }}>
                              Loading events...
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', color: '#444', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '6px' }}>
                                EVENTS
                              </div>
                              {evData.map((ev: any) => (
                                <div key={ev.id} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '6px 0', borderBottom: '1px solid #1a1a1a',
                                }}>
                                  <span style={{ fontSize: '12px', color: '#ccc', fontFamily: 'var(--font-body)' }}>
                                    {ev.event_name}
                                  </span>
                                  <span style={{
                                    fontSize: '12px',
                                    color: ev.result ? '#4DB26E' : '#444',
                                    fontFamily: 'var(--font-label)',
                                  }}>
                                    {ev.result ? ev.result.score_label : 'No score'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}

                          <Link
                            href={`/games/${sid}`}
                            style={{
                              display: 'block', marginTop: '14px', textAlign: 'center',
                              padding: '10px', borderRadius: '8px', background: '#0a0a0a',
                              border: '1px solid #2371BB', color: '#2371BB', textDecoration: 'none',
                              fontFamily: 'var(--font-label)', fontSize: '13px', letterSpacing: '0.08em',
                            }}
                          >
                            VIEW FULL GAME — ALL PLAYERS
                          </Link>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </div>{/* end scrollable overlay */}
        </>
      )}
    </div>
  )
}

// ── Vote card (bento-styled replacement for VoteBanner) ───────────────────────
function VoteCard({ userId, isJudge }: { userId: string; isJudge: boolean }) {
  const [vote, setVote] = useState<any>(null)
  const [responses, setResponses] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const fetchVote = async () => {
      const nowIso = new Date().toISOString()
      const { data: voteData } = await supabase
        .from('event_votes')
        .select('id, name, event_date, voting_closes_at, is_active')
        .eq('is_active', true)
        .gt('voting_closes_at', nowIso)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!voteData) { setLoading(false); return }
      setVote(voteData)

      const { data: responseData } = await supabase
        .from('event_vote_responses')
        .select('domain_number, is_final')
        .eq('vote_id', voteData.id)
        .eq('player_id', userId)

      setResponses(responseData || [])
      setLoading(false)
    }
    fetchVote()
  }, [userId])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !vote) return null

  const closesAt = new Date(vote.voting_closes_at).getTime()
  const msLeft = closesAt - now
  const hasFinal = responses.some(r => r.is_final)
  const hasPartial = responses.length > 0 && !hasFinal
  const voteState = hasFinal ? 'voted' : hasPartial ? 'partial' : 'not_voted'

  function fmt(ms: number) {
    if (ms <= 0) return 'Closed'
    const s = Math.floor(ms / 1000)
    const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${sec}s`
    return `${m}m ${sec}s`
  }

  const href = voteState === 'voted' ? `/vote/${vote.id}/results` : `/vote/${vote.id}`

  return (
    <BentoCard href={href} style={{ marginBottom: '12px' }}>
      <div style={{
        background: 'linear-gradient(135deg, #0d0a1a, #1a0d2e)',
        border: '1px solid #B87DB544',
        borderLeft: '4px solid #B87DB5',
        borderRadius: '16px',
        overflow: 'hidden',
        minHeight: '100px',
      }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />
        <div style={{ padding: '18px 22px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: '20px',
              color: '#fff', letterSpacing: '0.05em', lineHeight: 1,
            }}>
              {vote.name}
            </div>
            <div style={{
              fontSize: '11px', color: '#888',
              fontFamily: 'var(--font-label)', marginTop: '3px',
            }}>
              {new Date(vote.event_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{
              fontSize: '12px', fontWeight: 700, marginTop: '6px',
              fontFamily: 'var(--font-label)', letterSpacing: '0.05em',
              color: voteState === 'voted' ? '#4DB26E' : '#F9B051',
            }}>
              {voteState === 'voted'
                ? '✓ Voted — tap to view results'
                : voteState === 'partial'
                ? `${responses.length}/10 done — tap to continue`
                : msLeft > 0 ? `CLOSES IN: ${fmt(msLeft)}` : 'CLOSED'}
            </div>
          </div>
          <div style={{ color: '#B87DB5', fontSize: '24px', flexShrink: 0, marginLeft: '12px' }}>→</div>
        </div>
      </div>
    </BentoCard>
  )
}

export default function Dashboard() {
  return <Suspense><DashboardInner /></Suspense>
}
