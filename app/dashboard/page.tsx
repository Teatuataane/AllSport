'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
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

  // Active session (non-judges)
  const [activeSession, setActiveSession] = useState<any>(null)

  // Join game
  const [sessionCode, setSessionCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)
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

  // ── Active session (non-judge) ───────────────────────────────────────────────
  useEffect(() => {
    if (!userId) return
    const checkActive = async () => {
      const { data: result } = await supabase
        .from('results')
        .select('session_id')
        .eq('player_id', userId)
        .limit(1)
      if (result && result.length > 0) {
        const { data: sess } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', result[0].session_id)
          .eq('is_active', true)
          .maybeSingle()
        setActiveSession(sess)
      }
    }
    checkActive()
  }, [userId])

  // ── Auto-join from QR / ?code= ───────────────────────────────────────────────
  useEffect(() => {
    const codeFromUrl = searchParams.get('code')
    const codeFromStorage = typeof window !== 'undefined' ? localStorage.getItem('pending_session_code') : null
    const code = codeFromUrl || codeFromStorage
    if (code) {
      const upper = code.toUpperCase()
      setSessionCode(upper)
      setPendingAutoJoin(upper)
      if (codeFromStorage) localStorage.removeItem('pending_session_code')
    }
  }, [searchParams])

  useEffect(() => {
    if (pendingAutoJoin && !loading) {
      setPendingAutoJoin(null)
      handleJoinByCode(pendingAutoJoin)
    }
  }, [pendingAutoJoin, loading])

  // ── Join handler ─────────────────────────────────────────────────────────────
  const handleJoinByCode = async (codeOverride?: string) => {
    const code = (codeOverride ?? sessionCode).trim().toUpperCase()
    if (!code) return
    setJoining(true); setJoinError('')
    try {
      const { data: sess, error } = await supabase
        .from('sessions')
        .select('id, session_code, is_active, location')
        .ilike('session_code', code)
        .maybeSingle()
      if (error) throw new Error(`Session lookup failed: ${error.message}`)
      if (!sess) throw new Error(`No session found with code "${code}". Ask the judge to confirm the code.`)
      if (!sess.is_active) throw new Error(`Session "${code}" has ended.`)
      window.location.href = `/scoring/${sess.id}`
    } catch (e: any) {
      setJoinError(e.message)
      setJoining(false)
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
      <div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
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
                fontFamily: 'Bebas Neue, cursive', fontSize: '22px',
                color: '#2371BB', letterSpacing: '0.06em', lineHeight: 1,
              }}>
                Kaiwāwao
              </div>
              <div style={{
                fontSize: '11px', color: '#4a7ab5',
                fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '0.1em', marginTop: '3px',
              }}>
                JUDGE PANEL · Start session or create vote
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
              <div style={{ color: '#4DB26E', fontWeight: 'bold', fontSize: '14px', fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.06em' }}>
                Session in Progress
              </div>
              <div style={{ color: '#888', fontSize: '12px', marginTop: '2px', fontFamily: 'Barlow, sans-serif' }}>
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
                fontFamily: 'Bebas Neue, cursive', fontSize: '26px',
                color: grade.borderColour,
              }}>
                {displayName[0].toUpperCase()}
              </span>
            )}
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontFamily: 'Bebas Neue, cursive', fontSize: '22px',
              letterSpacing: '0.04em', color: '#fff', lineHeight: 1,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              {displayName}
            </div>
            <div style={{
              fontSize: '12px', color: '#666',
              fontFamily: 'Barlow Condensed, sans-serif',
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
                <span style={{ fontSize: '10px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>TOP EVENT</span>
                <span style={{ fontSize: '11px', color: '#ccc', fontFamily: 'Barlow, sans-serif', fontWeight: 600 }}>
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
                fontFamily: 'Bebas Neue, cursive', fontSize: '28px',
                color: grade.textColour, letterSpacing: '0.05em', lineHeight: 1,
              }}>
                {grade.name}
              </div>
              <div style={{
                fontSize: '11px', color: grade.textColour,
                opacity: 0.6, fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '0.1em', marginTop: '2px',
              }}>
                COLOURS · TAP FOR HISTORY
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '30px', fontWeight: 'bold', color: grade.textColour, lineHeight: 1 }}>
                {points.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: grade.textColour, opacity: 0.6, fontFamily: 'Barlow Condensed, sans-serif' }}>
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
                fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '5px',
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
            <div style={{ fontSize: '12px', color: grade.textColour, opacity: 0.8, fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>
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
                  cursor: 'pointer', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif',
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
              fontFamily: 'Bebas Neue, cursive', fontSize: '20px',
              color: '#fff', letterSpacing: '0.05em', lineHeight: 1,
            }}>
              My Personal Bests
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', marginTop: '3px' }}>
              All 100 events — your best scores
            </div>
          </div>
          <div style={{ color: '#2371BB', fontSize: '22px' }}>→</div>
        </div>
      </BentoCard>

      {/* ── Card 7: Invite Friends ─────────────────────────────────────────── */}
      {player?.referral_code && (
        <ReferralCard userId={userId!} referralCode={player.referral_code} />
      )}

      {/* ── Card 8: Join a Game ─────────────────────────────────────────────── */}
      <div style={{
        background: hasNoSessions ? '#061a0d' : '#0d0d0d',
        border: hasNoSessions ? '1px solid #4DB26E' : '1px solid #1e1e1e',
        borderLeft: `4px solid ${hasNoSessions ? '#4DB26E' : '#333'}`,
        borderRadius: '16px',
        padding: '20px 22px',
        ...(hasNoSessions ? { boxShadow: '0 0 20px #4DB26E18' } : {}),
      }}>
        <div style={{
          fontFamily: 'Bebas Neue, cursive', fontSize: '20px',
          color: hasNoSessions ? '#4DB26E' : '#fff',
          letterSpacing: '0.05em', marginBottom: '4px', lineHeight: 1,
        }}>
          {hasNoSessions ? 'Join Your First Game' : 'Join a Game'}
        </div>
        <div style={{
          fontSize: '11px', color: '#555',
          fontFamily: 'Barlow Condensed, sans-serif',
          letterSpacing: '0.05em', marginBottom: '14px',
        }}>
          Enter the 6-digit code shown on the judge screen
        </div>

        {joinError && (
          <div style={{
            background: '#2e0d0d', border: '2px solid #EA4742',
            borderRadius: '8px', padding: '12px 14px', marginBottom: '12px',
            color: '#EA4742', fontSize: '13px', fontWeight: 'bold', lineHeight: 1.4,
          }}>
            ⚠ {joinError}
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            value={sessionCode}
            onChange={e => setSessionCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            style={{
              flex: 1, background: '#0a0a0a',
              border: '1px solid #333', borderRadius: '10px',
              padding: '13px', color: '#fff', fontSize: '22px',
              fontWeight: 'bold', letterSpacing: '6px',
              textAlign: 'center', boxSizing: 'border-box' as const,
            }}
            onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
          />
          <button
            onClick={() => handleJoinByCode()}
            disabled={sessionCode.trim().length < 6 || joining}
            style={{
              padding: '13px 22px', borderRadius: '10px', border: 'none',
              cursor: sessionCode.trim().length < 6 ? 'not-allowed' : 'pointer',
              background: sessionCode.trim().length >= 6 ? '#EA4742' : '#1a1a1a',
              color: sessionCode.trim().length >= 6 ? '#fff' : '#444',
              fontWeight: 'bold', fontSize: '14px', fontFamily: 'Bebas Neue, cursive',
              letterSpacing: '0.05em',
            }}
          >
            {joining ? '...' : 'JOIN'}
          </button>
        </div>
      </div>

      {/* ── Points History Modal ─────────────────────────────────────────────── */}
      {showHistory && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(10,10,10,0.97)',
          zIndex: 400, overflowY: 'auto',
        }}>
          <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 16px 40px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', letterSpacing: '0.05em', lineHeight: 1 }}>
                  Points History
                </div>
                <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginTop: '2px' }}>
                  {displayName.toUpperCase()} · {selectedYear}
                </div>
              </div>
              <button onClick={() => setShowHistory(false)} style={{
                background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px',
                color: '#888', cursor: 'pointer', padding: '10px 16px',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700,
              }}>
                Close
              </button>
            </div>

            {/* Year tabs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
              {years.map((y: number) => (
                <button key={y} onClick={() => setSelectedYear(y)} style={{
                  padding: '6px 14px', borderRadius: '6px', border: 'none',
                  cursor: 'pointer', fontSize: '12px',
                  background: selectedYear === y ? '#2371BB' : '#1a1a1a',
                  color: selectedYear === y ? '#fff' : '#555',
                  fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em',
                }}>
                  {y}
                </button>
              ))}
            </div>

            {historyLoading ? (
              <div style={{ color: '#555', textAlign: 'center', padding: '40px 0', fontFamily: 'Barlow, sans-serif' }}>
                Loading history...
              </div>
            ) : historySessions.length === 0 ? (
              <div style={{ color: '#444', textAlign: 'center', padding: '40px 0', fontFamily: 'Barlow, sans-serif' }}>
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
                              <span style={{ color: '#F9B051', marginLeft: '8px', fontSize: '10px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
                                CHAMPIONSHIP
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '12px', color: '#555', marginTop: '2px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                            {sess?.session_date
                              ? new Date(sess.session_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
                              : ''}
                            {s.overall_placement ? ` · ${ordinal(s.overall_placement)} place` : ''}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
                          <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#4DB26E' }}>
                            +{totalPts}
                          </div>
                          <div style={{ fontSize: '10px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif' }}>
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
                                <div style={{ fontSize: '10px', color: '#555', marginTop: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>{stat.label}</div>
                              </div>
                            ))}
                          </div>

                          {/* Events */}
                          {!evData ? (
                            <div style={{ color: '#555', fontSize: '12px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '8px 0' }}>
                              Loading events...
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <div style={{ fontSize: '10px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '6px' }}>
                                EVENTS
                              </div>
                              {evData.map((ev: any) => (
                                <div key={ev.id} style={{
                                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                  padding: '6px 0', borderBottom: '1px solid #1a1a1a',
                                }}>
                                  <span style={{ fontSize: '12px', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>
                                    {ev.event_name}
                                  </span>
                                  <span style={{
                                    fontSize: '12px',
                                    color: ev.result ? '#4DB26E' : '#444',
                                    fontFamily: 'Barlow Condensed, sans-serif',
                                  }}>
                                    {ev.result ? ev.result.score_label : 'No score'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Referral card ─────────────────────────────────────────────────────────────
const REFERRAL_TIERS = [
  { label: 'Digital Certificate', count: 1 },
  { label: 'Sticker Pack', count: 3 },
  { label: 'Colours T-Shirt', count: 6 },
  { label: 'Clothing Stack', count: 12 },
  { label: 'Personal Coaching', count: 25 },
  { label: 'AllSport Comes To You', count: 50 },
]

function ReferralCard({ userId, referralCode }: { userId: string; referralCode: string }) {
  const [referrals, setReferrals] = useState<any[]>([])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase
      .from('referrals')
      .select('session_count, qualified_at')
      .eq('referrer_id', userId)
      .then(({ data }) => setReferrals(data || []))
  }, [userId])

  const qualified = referrals.filter(r => r.qualified_at).length
  const pending = referrals.filter(r => !r.qualified_at).length
  const nextTier = REFERRAL_TIERS.find(t => qualified < t.count)
  const currentTier = [...REFERRAL_TIERS].reverse().find(t => qualified >= t.count) || null
  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/join/${referralCode}`
    : `/join/${referralCode}`

  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{
      background: '#111',
      border: '1px solid #1e1e1e',
      borderLeft: '4px solid #4DB26E',
      borderRadius: '16px',
      padding: '20px 22px',
      marginBottom: '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
        <div>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '20px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1 }}>
            Invite Friends
          </div>
          <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', marginTop: '3px' }}>
            Share your link — earn Koha rewards when they play 10 sessions
          </div>
        </div>
        <div style={{ display: 'flex', gap: '12px', flexShrink: 0, marginLeft: '12px' }}>
          {pending > 0 && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#F9B051', lineHeight: 1 }}>{pending}</div>
              <div style={{ fontSize: '9px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>PENDING</div>
            </div>
          )}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#4DB26E', lineHeight: 1 }}>{qualified}</div>
            <div style={{ fontSize: '9px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>QUALIFIED</div>
          </div>
        </div>
      </div>

      {/* Link + copy button */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
        <div style={{
          flex: 1, background: '#0a0a0a', border: '1px solid #333', borderRadius: '10px',
          padding: '10px 12px', fontSize: '12px', color: '#666',
          fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.04em',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
        }}>
          allsport.nz/join/<strong style={{ color: '#aaa' }}>{referralCode}</strong>
        </div>
        <button
          onClick={copyLink}
          style={{
            padding: '10px 16px', borderRadius: '10px', border: 'none',
            cursor: 'pointer', flexShrink: 0,
            background: copied ? '#4DB26E' : '#1a1a1a',
            color: copied ? '#fff' : '#888',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', fontWeight: 700,
            letterSpacing: '0.05em', transition: 'all 0.2s',
          }}
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Tier progress */}
      {nextTier && (
        <div style={{ background: '#0a0a0a', borderRadius: '8px', padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
              {currentTier ? currentTier.label.toUpperCase() : 'NO TIER YET'}
            </div>
            <div style={{ fontSize: '11px', color: '#4DB26E', fontFamily: 'Barlow Condensed, sans-serif' }}>
              {qualified}/{nextTier.count} → {nextTier.label}
            </div>
          </div>
          <div style={{ height: '4px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: '2px', background: '#4DB26E',
              width: `${Math.min((qualified / nextTier.count) * 100, 100)}%`,
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}
      {!nextTier && qualified >= 50 && (
        <div style={{ fontSize: '12px', color: '#4DB26E', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'center', padding: '8px 0' }}>
          All Koha tiers unlocked via referrals
        </div>
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
              fontFamily: 'Bebas Neue, cursive', fontSize: '20px',
              color: '#fff', letterSpacing: '0.05em', lineHeight: 1,
            }}>
              {vote.name}
            </div>
            <div style={{
              fontSize: '11px', color: '#888',
              fontFamily: 'Barlow Condensed, sans-serif', marginTop: '3px',
            }}>
              {new Date(vote.event_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <div style={{
              fontSize: '12px', fontWeight: 700, marginTop: '6px',
              fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em',
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
