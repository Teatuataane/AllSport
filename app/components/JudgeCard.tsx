'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { QRCodeSVG } from 'qrcode.react'
import Link from 'next/link'
import { EVENTS } from '@/lib/eventData'

type Session = {
  id: string
  session_code: string
  session_date: string
  location: string
  is_active: boolean
  started_at: string | null
  points_awarded_at: string | null
}

type ActiveVote = {
  id: string
  name: string
  event_date: string
  voting_closes_at: string
  is_active: boolean
  nominations_per_domain: number
}

type PastVote = {
  id: string
  name: string
  event_date: string
  voter_count: number
}

type JudgeCardProps = {
  playerRole: string
}

const DOMAINS = [
  { number: 1, name: 'Maximal Strength' },
  { number: 2, name: 'Calisthenics' },
  { number: 3, name: 'Power' },
  { number: 4, name: 'Speed' },
  { number: 5, name: 'Anaerobic Endurance' },
  { number: 6, name: 'Aerobic Endurance' },
  { number: 7, name: 'Flexibility' },
  { number: 8, name: 'Body Awareness' },
  { number: 9, name: 'Coordination' },
  { number: 10, name: 'Aim & Precision' },
]

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Closed'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}

export default function JudgeCard({ playerRole }: JudgeCardProps) {
  const router = useRouter()
  const supabase = createClient()

  // Session state
  const [activeSessions, setActiveSessions] = useState<Session[]>([])
  const [recentSessions, setRecentSessions] = useState<Session[]>([])
  const [playerCounts, setPlayerCounts] = useState<Record<string, number>>({})
  const [expandedQR, setExpandedQR] = useState<string | null>(null)
  const [fullscreenQR, setFullscreenQR] = useState<Session | null>(null)
  const [ending, setEnding] = useState<string | null>(null)
  const [endConfirm, setEndConfirm] = useState<string | null>(null)
  const [voiding, setVoiding] = useState<string | null>(null)
  const [voidConfirm, setVoidConfirm] = useState<string | null>(null)
  const [endError, setEndError] = useState('')
  const [loading, setLoading] = useState(true)

  // Vote state
  const [activeVote, setActiveVote] = useState<ActiveVote | null>(null)
  const [activeVoterCount, setActiveVoteVoterCount] = useState(0)
  const [pastVotes, setPastVotes] = useState<PastVote[]>([])
  const [voteLoading, setVoteLoading] = useState(true)
  const [closeVoteConfirm, setCloseVoteConfirm] = useState(false)
  const [closingVote, setClosingVote] = useState(false)
  const [voteError, setVoteError] = useState('')
  const [now, setNow] = useState(Date.now())

  // Tab + Players state
  const [judgeTab, setJudgeTab] = useState<'sessions' | 'votes' | 'players'>('sessions')
  const [playersList, setPlayersList] = useState<{ id: string; name: string; division: string; totalPoints: number; sessions: number; icon: string | null }[]>([])
  const [playersLoading, setPlayersLoading] = useState(false)
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null)
  const [playerHistory, setPlayerHistory] = useState<Record<string, any[]>>({})
  const [playerHistoryLoading, setPlayerHistoryLoading] = useState<Record<string, boolean>>({})

  // Create vote form state
  const [showCreateVote, setShowCreateVote] = useState(false)
  const [createStep, setCreateStep] = useState(1) // 1: details, 2: nominations, 3: review
  const [voteForm, setVoteForm] = useState({
    name: '',
    event_date: '',
    voting_closes_at: '',
    nominations_per_domain: 3,
  })
  // nominations: domain_number -> Set<event_name>
  const [voteNominations, setVoteNominations] = useState<Record<number, Set<string>>>({})
  const [expandedDomain, setExpandedDomain] = useState<number | null>(1)
  const [publishing, setPublishing] = useState(false)

  // Group EVENTS by domainNumber
  const eventsByDomain: Record<number, string[]> = {}
  for (const ev of EVENTS) {
    if (!eventsByDomain[ev.domainNumber]) eventsByDomain[ev.domainNumber] = []
    eventsByDomain[ev.domainNumber].push(ev.name)
  }

  const fetchSessions = async () => {
    const [activeResult, recentResult] = await Promise.all([
      supabase
        .from('sessions')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('sessions')
        .select('*')
        .eq('is_active', false)
        .order('created_at', { ascending: false })
        .limit(5),
    ])

    const active = activeResult.data || []

    // Auto-close sessions whose timer has expired
    const nowTs = Date.now()
    const expiredIds = active
      .filter(s => s.started_at && s.points_awarded_at === null)
      .filter(s => nowTs > new Date(s.started_at!).getTime() + 100 * 60 * 1000)
      .map(s => s.id)
    if (expiredIds.length > 0) {
      const endedAt = new Date().toISOString()
      await Promise.all(expiredIds.map(id =>
        supabase.from('sessions').update({ is_active: false, ended_at: endedAt }).eq('id', id)
      ))
      const [ar2, rr2] = await Promise.all([
        supabase.from('sessions').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(5),
        supabase.from('sessions').select('*').eq('is_active', false).order('created_at', { ascending: false }).limit(5),
      ])
      setActiveSessions(ar2.data || [])
      setRecentSessions(rr2.data || [])
      setLoading(false)
      return
    }

    setActiveSessions(active)
    setRecentSessions(recentResult.data || [])

    if (active.length > 0) {
      const counts: Record<string, number> = {}
      await Promise.all(
        active.map(async (sess) => {
          const { count } = await supabase
            .from('results')
            .select('*', { count: 'exact', head: true })
            .eq('session_id', sess.id)
          counts[sess.id] = count || 0
        })
      )
      setPlayerCounts(counts)
    }

    setLoading(false)
  }

  const fetchVotes = async () => {
    setVoteLoading(true)
    const nowIso = new Date().toISOString()

    // Active vote: is_active=true AND closes in future
    const { data: activeVoteData } = await supabase
      .from('event_votes')
      .select('*')
      .eq('is_active', true)
      .gt('voting_closes_at', nowIso)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    setActiveVote(activeVoteData || null)

    if (activeVoteData) {
      const { data: voterData } = await supabase
        .from('event_vote_responses')
        .select('player_id')
        .eq('vote_id', activeVoteData.id)
        .eq('is_final', true)
      const uniqueVoters = new Set((voterData || []).map(r => r.player_id)).size
      setActiveVoteVoterCount(uniqueVoters)
    }

    // Past votes
    const { data: pastData } = await supabase
      .from('event_votes')
      .select('id, name, event_date, voting_closes_at, is_active')
      .or(`is_active.eq.false,voting_closes_at.lt.${nowIso}`)
      .order('created_at', { ascending: false })
      .limit(5)

    if (pastData && pastData.length > 0) {
      const pastWithCounts = await Promise.all(
        pastData.map(async (v) => {
          const { data: vd } = await supabase
            .from('event_vote_responses')
            .select('player_id')
            .eq('vote_id', v.id)
            .eq('is_final', true)
          const count = new Set((vd || []).map(r => r.player_id)).size
          return { id: v.id, name: v.name, event_date: v.event_date, voter_count: count }
        })
      )
      setPastVotes(pastWithCounts)
    } else {
      setPastVotes([])
    }

    setVoteLoading(false)
  }

  useEffect(() => {
    fetchSessions()
    fetchVotes()
  }, [])

  // Countdown tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Realtime: keep player count live during active sessions
  useEffect(() => {
    if (activeSessions.length === 0) return
    const sessionId = activeSessions[0].id
    const ch = supabase
      .channel(`judge-count-${sessionId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        () => setPlayerCounts(prev => ({ ...prev, [sessionId]: (prev[sessionId] ?? 0) + 1 })))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'results', filter: `session_id=eq.${sessionId}` },
        () => setPlayerCounts(prev => ({ ...prev, [sessionId]: Math.max(0, (prev[sessionId] ?? 1) - 1) })))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [activeSessions.map(s => s.id).join(',')])

  // Two-tap end confirmation
  const handleEndTap = (sessionId: string) => {
    if (endConfirm === sessionId) {
      handleEndSession(sessionId)
      setEndConfirm(null)
    } else {
      setEndConfirm(sessionId)
      setVoidConfirm(null)
      setTimeout(() => setEndConfirm(c => c === sessionId ? null : c), 3000)
    }
  }

  const handleEndSession = async (sessionId: string) => {
    if (playerRole !== 'judge') return
    setEnding(sessionId)
    setEndError('')
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', sessionId)
    if (error) {
      setEndError(`Failed: ${error.message}`)
      setEnding(null)
      return
    }
    await fetchSessions()
    setEnding(null)
  }

  const handleVoidTap = (sessionId: string) => {
    if (voidConfirm === sessionId) {
      handleVoidSession(sessionId)
      setVoidConfirm(null)
    } else {
      setVoidConfirm(sessionId)
      setEndConfirm(null)
      setTimeout(() => setVoidConfirm(c => c === sessionId ? null : c), 3000)
    }
  }

  const handleVoidSession = async (sessionId: string) => {
    if (playerRole !== 'judge') return
    setVoiding(sessionId)
    setEndError('')
    const now = new Date().toISOString()
    const { error } = await supabase
      .from('sessions')
      .update({ is_active: false, ended_at: now, points_awarded_at: now })
      .eq('id', sessionId)
    if (error) {
      setEndError('Failed to void session — try again')
      setVoiding(null)
      return
    }
    await fetchSessions()
    setVoiding(null)
  }

  const joinUrl = (code: string) =>
    typeof window !== 'undefined' ? `${window.location.origin}/play?code=${code}` : ''

  const hasActive = activeSessions.length > 0

  // Vote form helpers
  const resetVoteForm = () => {
    setVoteForm({ name: '', event_date: '', voting_closes_at: '', nominations_per_domain: 3 })
    setVoteNominations({})
    setCreateStep(1)
    setShowCreateVote(false)
    setVoteError('')
  }

  const isStep1Valid = voteForm.name.trim() && voteForm.event_date && voteForm.voting_closes_at

  const allDomainsNominated = DOMAINS.every(d => {
    const sel = voteNominations[d.number]
    return sel && sel.size === voteForm.nominations_per_domain
  })

  const toggleNomination = (domainNumber: number, eventName: string) => {
    const current = new Set(voteNominations[domainNumber] || [])
    const willComplete = !current.has(eventName) && current.size + 1 === voteForm.nominations_per_domain

    setVoteNominations(prev => {
      const updated = new Set(prev[domainNumber] || [])
      if (updated.has(eventName)) {
        updated.delete(eventName)
      } else {
        if (updated.size < voteForm.nominations_per_domain) {
          updated.add(eventName)
        }
      }
      return { ...prev, [domainNumber]: updated }
    })

    if (willComplete) {
      setTimeout(() => {
        const nextDomain = DOMAINS.find(d => {
          if (d.number <= domainNumber) return false
          const sel = voteNominations[d.number] || new Set()
          return sel.size < voteForm.nominations_per_domain
        })
        setExpandedDomain(nextDomain ? nextDomain.number : null)
      }, 250)
    }
  }

  const handlePublishVote = async () => {
    setPublishing(true)
    setVoteError('')

    // 1. Insert vote
    const { data: newVote, error: voteErr } = await supabase
      .from('event_votes')
      .insert({
        name: voteForm.name.trim(),
        event_date: voteForm.event_date,
        voting_closes_at: new Date(voteForm.voting_closes_at).toISOString(),
        nominations_per_domain: voteForm.nominations_per_domain,
        is_active: true,
      })
      .select()
      .single()

    if (voteErr || !newVote) {
      setVoteError('Failed to create vote — try again')
      setPublishing(false)
      return
    }

    // 2. Batch insert nominations
    const nominations: { vote_id: string; domain_number: number; domain_name: string; event_name: string }[] = []
    for (const domain of DOMAINS) {
      const sel = voteNominations[domain.number] || new Set()
      for (const eventName of sel) {
        nominations.push({
          vote_id: newVote.id,
          domain_number: domain.number,
          domain_name: domain.name,
          event_name: eventName,
        })
      }
    }

    const { error: nomErr } = await supabase
      .from('event_vote_nominations')
      .insert(nominations)

    if (nomErr) {
      setVoteError('Vote created but failed to save nominations — contact admin')
      setPublishing(false)
      return
    }

    setPublishing(false)
    resetVoteForm()
    await fetchVotes()
  }

  const handleCloseVoteTap = () => {
    if (closeVoteConfirm) {
      handleCloseVote()
      setCloseVoteConfirm(false)
    } else {
      setCloseVoteConfirm(true)
      setTimeout(() => setCloseVoteConfirm(false), 3000)
    }
  }

  const handleCloseVote = async () => {
    if (!activeVote) return
    setClosingVote(true)
    setVoteError('')
    const { error } = await supabase
      .from('event_votes')
      .update({ is_active: false })
      .eq('id', activeVote.id)
    if (error) {
      setVoteError('Failed to close vote — try again')
    } else {
      await fetchVotes()
    }
    setClosingVote(false)
  }

  const loadPlayersList = async () => {
    setPlayersLoading(true)
    const currentYear = new Date().getFullYear()
    const [playersRes, rankingsRes] = await Promise.all([
      supabase.from('players').select('id, display_name, username, full_name, division, icon').eq('is_active', true).order('display_name', { ascending: true }),
      supabase.from('rankings').select('player_id, total_points, total_sessions').eq('season_year', currentYear),
    ])
    const rankMap: Record<string, number> = {}
    const sessMap: Record<string, number> = {}
    rankingsRes.data?.forEach(r => { rankMap[r.player_id] = r.total_points; sessMap[r.player_id] = r.total_sessions })
    const entries = (playersRes.data || []).map(p => ({
      id: p.id,
      name: (p.display_name || p.username || p.full_name || 'Unknown') as string,
      division: (p.division || '') as string,
      totalPoints: rankMap[p.id] ?? 0,
      sessions: sessMap[p.id] ?? 0,
      icon: p.icon as string | null,
    }))
    entries.sort((a, b) => b.totalPoints - a.totalPoints)
    setPlayersList(entries)
    setPlayersLoading(false)
  }

  const loadPlayerHistory = async (playerId: string) => {
    if (playerHistory[playerId]) return
    setPlayerHistoryLoading(prev => ({ ...prev, [playerId]: true }))
    const { data } = await supabase
      .from('session_player_summary')
      .select('session_id, total_placement_points, effort_points, effort_level, overall_placement, sessions(session_date, location)')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false })
      .limit(20)
    setPlayerHistory(prev => ({ ...prev, [playerId]: data || [] }))
    setPlayerHistoryLoading(prev => ({ ...prev, [playerId]: false }))
  }

  function ordinalJC(n: number) {
    const s = ['th', 'st', 'nd', 'rd']
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
  }

  return (
    <>
      {/* Fullscreen QR overlay */}
      {fullscreenQR && (
        <div
          onClick={() => setFullscreenQR(null)}
          style={{
            position: 'fixed', inset: 0, background: '#000', zIndex: 9999,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <div style={{ background: '#fff', padding: '32px', borderRadius: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
            <QRCodeSVG value={joinUrl(fullscreenQR.session_code)} size={280} />
            <div style={{
              fontFamily: 'Bebas Neue, cursive', fontSize: '48px', letterSpacing: '0.3em',
              color: '#0a0a0a', lineHeight: 1,
            }}>
              {fullscreenQR.session_code}
            </div>
            <div style={{ color: '#888', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}>
              Tap anywhere to close
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB BAR ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '4px', marginBottom: '12px' }}>
        {(['sessions', 'votes', 'players'] as const).map(tab => {
          const labels: Record<string, string> = { sessions: 'Sessions', votes: 'Votes', players: 'Players' }
          const active = judgeTab === tab
          return (
            <button
              key={tab}
              onClick={() => {
                setJudgeTab(tab)
                if (tab === 'players' && playersList.length === 0) loadPlayersList()
              }}
              style={{
                flex: 1, padding: '10px 0', borderRadius: '8px', border: 'none',
                cursor: 'pointer', fontFamily: 'Bebas Neue, cursive', fontSize: '15px',
                letterSpacing: '0.08em', minHeight: '40px',
                background: active ? '#1e3a5f' : '#111',
                color: active ? '#fff' : '#555',
                borderBottom: `2px solid ${active ? '#2371BB' : 'transparent'}`,
                transition: 'all 0.15s',
              }}
            >
              {labels[tab]}
            </button>
          )
        })}
      </div>

      {/* ─── SESSION PANEL ─────────────────────────────────────────────────── */}
      {judgeTab === 'sessions' && <div style={{
        background: '#111', border: '1px solid #1e3a5f', borderRadius: '12px',
        padding: '20px', marginBottom: '20px',
      }}>
        {/* Header: Te Reo label + start CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#2371BB', letterSpacing: '0.05em', lineHeight: 1 }}>
              Kaiwhakawā
            </div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
              KAIWHAKAWĀ PANEL
            </div>
          </div>
          {!hasActive && (
            <button
              onClick={() => router.push('/scoring')}
              style={{
                padding: '10px 18px', borderRadius: '8px', border: 'none',
                cursor: 'pointer',
                background: 'linear-gradient(90deg, #2371BB, #4DB26E)',
                color: '#fff',
                fontFamily: 'Bebas Neue, cursive', fontSize: '16px', letterSpacing: '0.08em',
                minHeight: '44px',
              }}
            >
              Start New Session →
            </button>
          )}
        </div>

        {endError && (
          <div style={{
            background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px',
            padding: '10px 14px', color: '#EA4742', fontSize: '13px',
            fontFamily: 'Barlow, sans-serif', marginBottom: '12px',
          }}>
            {endError}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#555', fontSize: '13px', padding: '8px 0', fontFamily: 'Barlow, sans-serif' }}>Loading sessions...</div>
        ) : (
          <>
            {/* Active sessions */}
            {activeSessions.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '10px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  Active
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeSessions.map(sess => (
                    <div key={sess.id} style={{
                      background: '#0d1f2d', border: '1px solid #1e3a5f', borderRadius: '10px', padding: '14px',
                    }}>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: '#2371BB22', border: '1px solid #2371BB',
                            color: '#2371BB', fontFamily: 'Bebas Neue, cursive',
                            fontSize: '32px', letterSpacing: '0.25em', padding: '4px 14px',
                            borderRadius: '6px', lineHeight: 1.1,
                          }}>
                            {sess.session_code}
                          </span>
                          <div>
                            <div style={{ fontSize: '20px', fontWeight: 'bold', color: '#fff' }}>
                              {playerCounts[sess.id] ?? '—'}
                            </div>
                            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>
                              joined
                            </div>
                          </div>
                        </div>
                        <div style={{ fontSize: '12px', color: '#555', marginTop: '6px', fontFamily: 'Barlow, sans-serif' }}>
                          {sess.location}
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => { setExpandedQR(expandedQR === sess.id ? null : sess.id) }}
                          style={{
                            padding: '10px 16px', borderRadius: '8px', border: '1px solid #333',
                            background: '#0a0a0a', color: '#ccc', cursor: 'pointer',
                            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
                            fontWeight: 700, letterSpacing: '0.05em', minHeight: '44px',
                            flex: '1 1 auto',
                          }}
                        >
                          {expandedQR === sess.id ? 'Hide QR' : 'Show QR'}
                        </button>
                        <button
                          onClick={() => router.push(`/scoring/${sess.id}`)}
                          style={{
                            padding: '10px 16px', borderRadius: '8px', border: '1px solid #2371BB',
                            background: '#2371BB22', color: '#2371BB', cursor: 'pointer',
                            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
                            fontWeight: 700, letterSpacing: '0.05em', minHeight: '44px',
                            flex: '1 1 auto',
                          }}
                        >
                          Continue →
                        </button>
                        <button
                          onClick={() => handleVoidTap(sess.id)}
                          disabled={voiding === sess.id || ending === sess.id}
                          style={{
                            padding: '10px 16px', borderRadius: '8px',
                            border: voidConfirm === sess.id ? '2px solid #F9B051' : '1px solid #F9B05166',
                            background: voidConfirm === sess.id ? '#F9B05122' : '#1a1200',
                            color: '#F9B051', cursor: voiding === sess.id ? 'not-allowed' : 'pointer',
                            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
                            fontWeight: 700, letterSpacing: '0.05em',
                            opacity: voiding === sess.id ? 0.6 : 1,
                            minHeight: '44px', flex: '1 1 auto',
                            transition: 'all 0.15s',
                          }}
                        >
                          {voiding === sess.id ? 'Voiding...' : voidConfirm === sess.id ? 'Confirm Void?' : 'Void'}
                        </button>
                        <button
                          onClick={() => handleEndTap(sess.id)}
                          disabled={ending === sess.id || voiding === sess.id}
                          style={{
                            padding: '10px 16px', borderRadius: '8px',
                            border: endConfirm === sess.id ? '2px solid #EA4742' : '1px solid #EA474266',
                            background: endConfirm === sess.id ? '#EA474222' : '#1a0808',
                            color: '#EA4742', cursor: ending === sess.id ? 'not-allowed' : 'pointer',
                            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
                            fontWeight: 700, letterSpacing: '0.05em',
                            opacity: ending === sess.id ? 0.6 : 1,
                            minHeight: '44px', flex: '1 1 auto',
                            transition: 'all 0.15s',
                          }}
                        >
                          {ending === sess.id ? 'Ending...' : endConfirm === sess.id ? 'Confirm End?' : 'End'}
                        </button>
                      </div>

                      {expandedQR === sess.id && (
                        <div
                          onClick={() => setFullscreenQR(sess)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center',
                            padding: '20px', background: '#fff', borderRadius: '10px',
                            marginTop: '12px', cursor: 'pointer',
                          }}
                        >
                          <QRCodeSVG value={joinUrl(sess.session_code)} size={180} />
                          <div style={{
                            marginTop: '10px', color: '#0a0a0a', fontFamily: 'Bebas Neue, cursive',
                            fontSize: '24px', letterSpacing: '0.2em',
                          }}>
                            {sess.session_code}
                          </div>
                          <div style={{ color: '#888', fontSize: '11px', marginTop: '4px', fontFamily: 'Barlow, sans-serif' }}>
                            Tap to fullscreen
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  onClick={() => router.push('/scoring')}
                  disabled
                  style={{
                    width: '100%', marginTop: '10px', padding: '12px', borderRadius: '8px',
                    border: 'none', cursor: 'not-allowed',
                    background: '#1a1a1a', color: '#444',
                    fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
                    fontWeight: 700, letterSpacing: '0.05em',
                  }}
                >
                  Session in progress — end it to start a new one
                </button>
              </div>
            )}

            {activeSessions.length === 0 && (
              <div style={{
                background: '#0a0a0a', borderRadius: '8px', padding: '20px',
                textAlign: 'center', marginBottom: '16px',
              }}>
                <div style={{ color: '#444', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}>
                  No active sessions
                </div>
                <div style={{ color: '#333', fontSize: '12px', marginTop: '4px', fontFamily: 'Barlow, sans-serif' }}>
                  Tap "Start New Session" above to begin
                </div>
              </div>
            )}

            {recentSessions.length > 0 && (
              <div>
                <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                  Recent
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {recentSessions.map(sess => (
                    <div key={sess.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      background: '#0a0a0a', borderRadius: '8px', padding: '10px 12px',
                    }}>
                      <div>
                        <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow, sans-serif' }}>{sess.location}</div>
                        <div style={{ fontSize: '11px', color: '#444', marginTop: '2px', fontFamily: 'Barlow, sans-serif' }}>
                          {sess.session_date
                            ? new Date(sess.session_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
                            : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '11px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>ENDED</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {recentSessions.length === 0 && activeSessions.length === 0 && (
              <div style={{ color: '#333', fontSize: '12px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', paddingTop: '4px' }}>
                Your session history will appear here
              </div>
            )}
          </>
        )}
      </div>}

      {/* ─── EVENT VOTES PANEL ─────────────────────────────────────────────── */}
      {judgeTab === 'votes' && <div id="vote-panel" style={{
        background: '#111', border: '1px solid #1e3a5f', borderRadius: '12px',
        padding: '20px', marginBottom: '20px',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#B87DB5', letterSpacing: '0.05em', lineHeight: 1 }}>
              Kōwhiringa Tūāhuatanga
            </div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
              EVENT VOTES
            </div>
          </div>
        </div>

        {voteError && (
          <div style={{
            background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px',
            padding: '10px 14px', color: '#EA4742', fontSize: '13px',
            fontFamily: 'Barlow, sans-serif', marginBottom: '12px',
          }}>
            {voteError}
          </div>
        )}

        {voteLoading ? (
          <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif' }}>Loading votes...</div>
        ) : activeVote ? (
          /* Active vote card */
          <div style={{
            background: 'linear-gradient(135deg, #0d0a1a, #1a0d2e)',
            border: '1px solid #B87DB5',
            borderRadius: '10px',
            overflow: 'hidden',
            marginBottom: '16px',
          }}>
            <div style={{ height: '3px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />
            <div style={{ padding: '14px 16px' }}>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '18px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1.1, marginBottom: '4px' }}>
                {activeVote.name}
              </div>
              <div style={{ fontSize: '12px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', marginBottom: '8px' }}>
                Event date: {new Date(activeVote.event_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
              </div>
              <div style={{ fontSize: '12px', color: '#F9B051', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '10px' }}>
                CLOSES IN: {formatCountdown(new Date(activeVote.voting_closes_at).getTime() - now)}
              </div>
              <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow, sans-serif', marginBottom: '14px' }}>
                {activeVoterCount} player{activeVoterCount !== 1 ? 's' : ''} voted so far
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <Link href={`/vote/${activeVote.id}/results`} style={{
                  flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #B87DB5',
                  background: '#1a0d2e', color: '#B87DB5', textDecoration: 'none',
                  fontSize: '13px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
                  letterSpacing: '0.05em', textAlign: 'center' as const, display: 'block',
                }}>
                  View Full Results →
                </Link>
                <button
                  onClick={handleCloseVoteTap}
                  disabled={closingVote}
                  style={{
                    padding: '10px 14px', borderRadius: '8px',
                    border: closeVoteConfirm ? '2px solid #EA4742' : '1px solid #EA474266',
                    background: closeVoteConfirm ? '#EA474222' : '#1a0808',
                    color: '#EA4742', cursor: closingVote ? 'not-allowed' : 'pointer',
                    fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
                    fontWeight: 700, letterSpacing: '0.05em',
                    opacity: closingVote ? 0.6 : 1,
                    transition: 'all 0.15s',
                    minHeight: '44px',
                  }}
                >
                  {closingVote ? 'Closing...' : closeVoteConfirm ? 'Confirm Close?' : 'Close Vote Early'}
                </button>
              </div>
            </div>
          </div>
        ) : !showCreateVote ? (
          /* No active vote — show create button */
          <div style={{ marginBottom: '16px' }}>
            <button
              onClick={() => setShowCreateVote(true)}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px',
                border: '1px solid #B87DB5', background: '#1a0d2e',
                color: '#B87DB5', cursor: 'pointer',
                fontFamily: 'Bebas Neue, cursive', fontSize: '16px', letterSpacing: '0.08em',
                minHeight: '44px',
              }}
            >
              + Create Vote
            </button>
          </div>
        ) : (
          /* Create vote form */
          <div style={{ marginBottom: '16px' }}>
            {/* Step indicator */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
              {[1, 2, 3].map(step => (
                <div key={step} style={{
                  flex: 1, height: '3px', borderRadius: '2px',
                  background: step <= createStep ? '#B87DB5' : '#1e1e1e',
                  transition: 'background 0.2s',
                }} />
              ))}
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '14px' }}>
              {createStep === 1 ? 'STEP 1 — VOTE DETAILS' : createStep === 2 ? 'STEP 2 — NOMINATE EVENTS' : 'STEP 3 — REVIEW & PUBLISH'}
            </div>

            {/* Step 1: Details */}
            {createStep === 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>VOTE NAME</label>
                  <input
                    value={voteForm.name}
                    onChange={e => setVoteForm(f => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. 2027 Championship Event Selection"
                    style={{
                      width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                      border: '1px solid #333', borderRadius: '8px', padding: '10px 12px',
                      color: '#fff', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>EVENT DATE</label>
                  <input
                    type="date"
                    value={voteForm.event_date}
                    onChange={e => setVoteForm(f => ({ ...f, event_date: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                      border: '1px solid #333', borderRadius: '8px', padding: '10px 12px',
                      color: '#fff', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>VOTING CLOSES</label>
                  <input
                    type="datetime-local"
                    value={voteForm.voting_closes_at}
                    onChange={e => setVoteForm(f => ({ ...f, voting_closes_at: e.target.value }))}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                      border: '1px solid #333', borderRadius: '8px', padding: '10px 12px',
                      color: '#fff', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
                    }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>EVENTS NOMINATED PER DOMAIN (2–10)</label>
                  <input
                    type="number"
                    min={2}
                    max={10}
                    value={voteForm.nominations_per_domain}
                    onChange={e => setVoteForm(f => ({ ...f, nominations_per_domain: Math.min(10, Math.max(2, Number(e.target.value))) }))}
                    style={{
                      width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                      border: '1px solid #333', borderRadius: '8px', padding: '10px 12px',
                      color: '#fff', fontSize: '14px', fontFamily: 'Barlow, sans-serif',
                    }}
                  />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={resetVoteForm}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #333',
                      background: 'transparent', color: '#888', cursor: 'pointer',
                      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setCreateStep(2)}
                    disabled={!isStep1Valid}
                    style={{
                      flex: 2, padding: '11px', borderRadius: '8px', border: 'none',
                      background: isStep1Valid ? '#B87DB5' : '#222',
                      color: isStep1Valid ? '#fff' : '#555',
                      cursor: isStep1Valid ? 'pointer' : 'not-allowed',
                      fontFamily: 'Bebas Neue, cursive', fontSize: '15px', letterSpacing: '0.08em',
                    }}
                  >
                    Next: Choose Events →
                  </button>
                </div>
              </div>
            )}

            {/* Step 2: Nominations */}
            {createStep === 2 && (
              <div>
                <div style={{ fontSize: '12px', color: '#888', fontFamily: 'Barlow, sans-serif', marginBottom: '14px' }}>
                  Select exactly {voteForm.nominations_per_domain} events per domain.
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {DOMAINS.map(domain => {
                    const sel = voteNominations[domain.number] || new Set()
                    const isComplete = sel.size === voteForm.nominations_per_domain
                    const domEvents = eventsByDomain[domain.number] || []

                    return (
                      <DomainAccordion
                        key={domain.number}
                        domain={domain}
                        events={domEvents}
                        selected={sel}
                        limit={voteForm.nominations_per_domain}
                        isComplete={isComplete}
                        isOpen={expandedDomain === domain.number}
                        onOpenChange={(open) => setExpandedDomain(open ? domain.number : null)}
                        onToggle={(eventName) => toggleNomination(domain.number, eventName)}
                      />
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setCreateStep(1)}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #333',
                      background: 'transparent', color: '#888', cursor: 'pointer',
                      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={() => setCreateStep(3)}
                    disabled={!allDomainsNominated}
                    style={{
                      flex: 2, padding: '11px', borderRadius: '8px', border: 'none',
                      background: allDomainsNominated ? '#B87DB5' : '#222',
                      color: allDomainsNominated ? '#fff' : '#555',
                      cursor: allDomainsNominated ? 'pointer' : 'not-allowed',
                      fontFamily: 'Bebas Neue, cursive', fontSize: '15px', letterSpacing: '0.08em',
                    }}
                  >
                    Review →
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Review & publish */}
            {createStep === 3 && (
              <div>
                <div style={{ background: '#0a0a0a', borderRadius: '10px', padding: '14px', marginBottom: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>VOTE NAME</span>
                    <span style={{ fontSize: '13px', color: '#fff', fontFamily: 'Barlow, sans-serif' }}>{voteForm.name}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>EVENT DATE</span>
                    <span style={{ fontSize: '13px', color: '#fff', fontFamily: 'Barlow, sans-serif' }}>
                      {new Date(voteForm.event_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'long', year: 'numeric' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>VOTING CLOSES</span>
                    <span style={{ fontSize: '13px', color: '#fff', fontFamily: 'Barlow, sans-serif' }}>
                      {new Date(voteForm.voting_closes_at).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>EVENTS PER DOMAIN</span>
                    <span style={{ fontSize: '13px', color: '#fff', fontFamily: 'Barlow, sans-serif' }}>{voteForm.nominations_per_domain}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px' }}>
                  {DOMAINS.map(domain => {
                    const sel = voteNominations[domain.number] || new Set<string>()
                    return (
                      <div key={domain.number} style={{
                        background: '#0a0a0a', borderRadius: '8px', padding: '10px 12px',
                      }}>
                        <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em', marginBottom: '4px' }}>
                          {domain.number}. {domain.name}
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                          {[...sel].map(eventName => (
                            <span key={eventName} style={{
                              padding: '3px 10px', borderRadius: '20px',
                              background: '#1a0d2e', border: '1px solid #B87DB5',
                              color: '#B87DB5', fontSize: '12px',
                              fontFamily: 'Barlow Condensed, sans-serif',
                            }}>
                              {eventName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setCreateStep(2)}
                    disabled={publishing}
                    style={{
                      flex: 1, padding: '11px', borderRadius: '8px', border: '1px solid #333',
                      background: 'transparent', color: '#888', cursor: 'pointer',
                      fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', fontWeight: 700,
                    }}
                  >
                    ← Back
                  </button>
                  <button
                    onClick={handlePublishVote}
                    disabled={publishing}
                    style={{
                      flex: 2, padding: '11px', borderRadius: '8px', border: 'none',
                      background: publishing ? '#333' : 'linear-gradient(90deg, #B87DB5, #2371BB)',
                      color: '#fff', cursor: publishing ? 'not-allowed' : 'pointer',
                      fontFamily: 'Bebas Neue, cursive', fontSize: '15px', letterSpacing: '0.08em',
                      opacity: publishing ? 0.6 : 1,
                    }}
                  >
                    {publishing ? 'Publishing...' : 'Publish Vote'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Vote History */}
        {pastVotes.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px', fontFamily: 'Barlow Condensed, sans-serif' }}>
              Vote History
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {pastVotes.map(v => (
                <div key={v.id} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  background: '#0a0a0a', borderRadius: '8px', padding: '10px 12px',
                }}>
                  <div>
                    <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow, sans-serif' }}>{v.name}</div>
                    <div style={{ fontSize: '11px', color: '#444', marginTop: '2px', fontFamily: 'Barlow, sans-serif' }}>
                      {new Date(v.event_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{v.voter_count} voter{v.voter_count !== 1 ? 's' : ''}
                    </div>
                  </div>
                  <Link href={`/vote/${v.id}/results`} style={{
                    fontSize: '12px', color: '#B87DB5', textDecoration: 'none',
                    fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em',
                    fontWeight: 700,
                  }}>
                    View Results →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>}

      {/* ─── PLAYERS PANEL ─────────────────────────────────────────────────── */}
      {judgeTab === 'players' && (
        <div style={{
          background: '#111', border: '1px solid #1e3a5f', borderRadius: '12px',
          padding: '20px', marginBottom: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
            <div>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#4DB26E', letterSpacing: '0.05em', lineHeight: 1 }}>
                Tāngata
              </div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
                ALL PLAYERS · {new Date().getFullYear()} POINTS
              </div>
            </div>
            <button
              onClick={loadPlayersList}
              style={{
                padding: '8px 14px', borderRadius: '8px', border: '1px solid #333',
                background: '#1a1a1a', color: '#888', cursor: 'pointer',
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px',
                letterSpacing: '0.05em',
              }}
            >
              Refresh
            </button>
          </div>

          {playersLoading ? (
            <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '20px 0' }}>
              Loading players...
            </div>
          ) : playersList.length === 0 ? (
            <div style={{ color: '#444', fontSize: '13px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '20px 0' }}>
              No players found
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {playersList.map((p, i) => {
                const isExpanded = expandedPlayerId === p.id
                const history = playerHistory[p.id]
                const histLoading = playerHistoryLoading[p.id]
                return (
                  <div key={p.id} style={{
                    background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', overflow: 'hidden',
                  }}>
                    <button
                      onClick={async () => {
                        if (isExpanded) {
                          setExpandedPlayerId(null)
                        } else {
                          setExpandedPlayerId(p.id)
                          await loadPlayerHistory(p.id)
                        }
                      }}
                      style={{
                        width: '100%', padding: '12px 14px', background: 'transparent',
                        border: 'none', cursor: 'pointer', textAlign: 'left' as const,
                        display: 'flex', alignItems: 'center', gap: '10px',
                      }}
                    >
                      <div style={{
                        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
                        background: '#1e1e1e', display: 'flex', alignItems: 'center',
                        justifyContent: 'center', fontSize: p.icon ? '14px' : '11px',
                        color: '#888', fontWeight: 700, fontFamily: 'Barlow Condensed, sans-serif',
                      }}>
                        {p.icon || p.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '14px', color: '#fff', fontWeight: 600, fontFamily: 'Barlow, sans-serif' }}>
                          {p.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#555', marginTop: '1px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>
                          {p.division || 'No division'} · {p.sessions} session{p.sessions !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Barlow, sans-serif' }}>
                          {p.totalPoints}
                        </div>
                        <div style={{ fontSize: '10px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif' }}>pts</div>
                      </div>
                      <span style={{ color: isExpanded ? '#4DB26E' : '#333', fontSize: '11px', flexShrink: 0 }}>
                        {isExpanded ? '▲' : '▼'}
                      </span>
                    </button>

                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #1e1e1e', padding: '12px 14px' }}>
                        {histLoading ? (
                          <div style={{ color: '#555', fontSize: '12px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '8px 0' }}>
                            Loading history...
                          </div>
                        ) : !history || history.length === 0 ? (
                          <div style={{ color: '#444', fontSize: '12px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', padding: '8px 0' }}>
                            No sessions yet
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ fontSize: '10px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '4px' }}>
                              SESSION HISTORY
                            </div>
                            {history.map((s: any) => {
                              const sess = s.sessions
                              const total = (s.total_placement_points || 0) + (s.effort_points || 0)
                              return (
                                <div key={s.session_id} style={{
                                  display: 'grid', gridTemplateColumns: '1fr auto auto',
                                  gap: '8px', alignItems: 'center',
                                  padding: '8px 0', borderBottom: '1px solid #1a1a1a',
                                }}>
                                  <div>
                                    <div style={{ fontSize: '12px', color: '#ccc', fontFamily: 'Barlow, sans-serif' }}>
                                      {sess?.location || 'Session'}
                                    </div>
                                    <div style={{ fontSize: '11px', color: '#444', marginTop: '1px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                      {sess?.session_date
                                        ? new Date(sess.session_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
                                        : ''}
                                      {s.overall_placement ? ` · ${ordinalJC(s.overall_placement)} place` : ''}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'center' }}>
                                    <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                      EL {s.effort_level ?? 0}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: 'right' }}>
                                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#4DB26E', fontFamily: 'Barlow, sans-serif' }}>
                                      +{total}
                                    </div>
                                    <div style={{ fontSize: '10px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif' }}>pts</div>
                                  </div>
                                </div>
                              )
                            })}
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
      )}
    </>
  )
}

// Accordion component for domain nominations (Step 2)
type DomainAccordionProps = {
  domain: { number: number; name: string }
  events: string[]
  selected: Set<string>
  limit: number
  isComplete: boolean
  isOpen: boolean
  onOpenChange: (open: boolean) => void
  onToggle: (eventName: string) => void
}

function DomainAccordion({ domain, events, selected, limit, isComplete, isOpen, onOpenChange, onToggle }: DomainAccordionProps) {
  return (
    <div style={{
      background: '#0a0a0a',
      borderRadius: '8px',
      border: isComplete ? '1px solid #4DB26E' : '1px solid #1e1e1e',
      overflow: 'hidden',
    }}>
      <button
        onClick={() => onOpenChange(!isOpen)}
        style={{
          width: '100%', padding: '12px 14px', background: 'transparent',
          border: 'none', cursor: 'pointer',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          textAlign: 'left' as const,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {isComplete && <span style={{ color: '#4DB26E', fontSize: '14px' }}>✓</span>}
          <span style={{ fontSize: '13px', color: isComplete ? '#4DB26E' : '#ccc', fontFamily: 'Barlow, sans-serif', fontWeight: isComplete ? 600 : 400 }}>
            {domain.number}. {domain.name}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif',
            color: isComplete ? '#4DB26E' : '#555',
            background: isComplete ? '#0d2e0d' : '#1a1a1a',
            padding: '2px 8px', borderRadius: '10px',
          }}>
            {selected.size}/{limit}
          </span>
          <span style={{ color: '#555', fontSize: '12px' }}>{isOpen ? '▲' : '▼'}</span>
        </div>
      </button>

      {isOpen && (
        <div style={{ padding: '8px 14px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {events.map(eventName => {
            const isSelected = selected.has(eventName)
            const isDisabled = !isSelected && selected.size >= limit
            return (
              <label
                key={eventName}
                style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  opacity: isDisabled ? 0.4 : 1,
                  padding: '6px 8px', borderRadius: '6px',
                  background: isSelected ? '#1a0d2e' : 'transparent',
                  border: isSelected ? '1px solid #B87DB5' : '1px solid transparent',
                  transition: 'all 0.15s',
                }}
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  disabled={isDisabled}
                  onChange={() => onToggle(eventName)}
                  style={{ accentColor: '#B87DB5', width: '16px', height: '16px', flexShrink: 0 }}
                />
                <span style={{ fontSize: '13px', color: isSelected ? '#B87DB5' : '#ccc', fontFamily: 'Barlow, sans-serif' }}>
                  {eventName}
                </span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
