'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import JudgeCard from '@/app/components/JudgeCard'

const supabase = createClient()

const CHAMPIONSHIP_DATE = new Date('2027-03-14')

const GRADES = [
  { name: 'Mā', colour: '#ffffff', textColour: '#000', threshold: 0 },
  { name: 'Kiwikiwi', colour: '#888888', textColour: '#fff', threshold: 500 },
  { name: 'Whero', colour: '#EA4742', textColour: '#fff', threshold: 1000 },
  { name: 'Karaka', colour: '#F9B051', textColour: '#000', threshold: 2000 },
  { name: 'Kōwhai', colour: '#FFE566', textColour: '#000', threshold: 3000 },
  { name: 'Kākāriki', colour: '#4DB26E', textColour: '#fff', threshold: 4000 },
  { name: 'Kahurangi', colour: '#2371BB', textColour: '#fff', threshold: 5000 },
  { name: 'Poroporo', colour: '#B87DB5', textColour: '#fff', threshold: 6000 },
  { name: 'Uenuku', colour: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', textColour: '#fff', threshold: 8000 },
  { name: 'Taniwha', colour: '#000000', textColour: '#fff', threshold: 10000 },
]

function gradeStyle(colour: string): React.CSSProperties {
  return colour.startsWith('linear-gradient')
    ? { backgroundImage: colour }
    : { background: colour }
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

export default function Dashboard() {
  const router = useRouter()
  const [player, setPlayer] = useState<any>(null)
  const [userId, setUserId] = useState<string | null>(null)
  const [ranking, setRanking] = useState<any>(null)
  const [recentSessions, setRecentSessions] = useState<any[]>([])
  const [activeSession, setActiveSession] = useState<any>(null)
  const [streak, setStreak] = useState<{ streak_active: boolean; streak_count: number } | null>(null)
  const [personalBests, setPersonalBests] = useState<{ event_name: string; best_placement: number }[]>([])
  const [loading, setLoading] = useState(true)
  const [rankingLoading, setRankingLoading] = useState(false)
  const [sessionCode, setSessionCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())

  // Initial load — player, sessions, streak, PBs (not year-dependent)
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/play'); return }

      setUserId(user.id)

      const [playerResult, activeResult, resultsResult, streakResult, pbResult] = await Promise.all([
        supabase.from('players').select('*').eq('id', user.id).single(),

        supabase.from('results').select('session_id').eq('player_id', user.id).limit(1),

        supabase.from('results')
          .select('*, sessions(*)')
          .eq('player_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10),

        supabase.rpc('calculate_streak', { p_player_id: user.id }),

        supabase.from('results')
          .select('event_id, placement, session_events(event_name)')
          .eq('player_id', user.id)
          .not('placement', 'is', null),
      ])

      setPlayer(playerResult.data)
      setRecentSessions(resultsResult.data || [])

      // Streak — rpc returns array, take first row
      if (streakResult.data && streakResult.data.length > 0) {
        setStreak(streakResult.data[0])
      }

      // Personal bests — min placement per event, client-side
      if (pbResult.data && pbResult.data.length > 0) {
        const byEvent: Record<string, { event_name: string; best_placement: number }> = {}
        for (const row of pbResult.data) {
          const eventName = Array.isArray(row.session_events)
            ? row.session_events[0]?.event_name
            : (row.session_events as any)?.event_name
          if (!eventName || row.placement == null) continue
          if (!byEvent[row.event_id] || row.placement < byEvent[row.event_id].best_placement) {
            byEvent[row.event_id] = { event_name: eventName, best_placement: row.placement }
          }
        }
        setPersonalBests(Object.values(byEvent).sort((a, b) => a.event_name.localeCompare(b.event_name)))
      }

      // Active session check
      if (activeResult.data && activeResult.data.length > 0) {
        const { data: activeSess } = await supabase
          .from('sessions')
          .select('*')
          .eq('id', activeResult.data[0].session_id)
          .eq('is_active', true)
          .maybeSingle()
        if (activeSess) setActiveSession(activeSess)
      }

      setLoading(false)
    }
    load()
  }, [router])

  // Year-dependent load — rankings filtered by selected year
  useEffect(() => {
    if (!userId) return
    const loadRanking = async () => {
      setRankingLoading(true)
      const { data } = await supabase
        .from('rankings')
        .select('*')
        .eq('player_id', userId)
        .eq('season_year', selectedYear)
        .maybeSingle()
      setRanking(data)
      setRankingLoading(false)
    }
    loadRanking()
  }, [userId, selectedYear])

  const handleJoinByCode = async () => {
    if (!sessionCode.trim()) return
    setJoining(true)
    setJoinError('')
    try {
      const { data: sess, error } = await supabase
        .from('sessions')
        .select('*')
        .eq('session_code', sessionCode.trim().toUpperCase())
        .eq('is_active', true)
        .single()
      if (error || !sess) throw new Error('Session not found. Check the code and try again.')
      router.push(`/scoring/${sess.id}`)
    } catch (e: any) {
      setJoinError(e.message)
    }
    setJoining(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555' }}>Loading...</div>
    </div>
  )

  if (!player) return (
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
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i)

  // Championship banner: show within 8 weeks of 14 March 2027
  const weeksAway = Math.floor((CHAMPIONSHIP_DATE.getTime() - Date.now()) / (7 * 24 * 60 * 60 * 1000))
  const showChampionshipBanner = weeksAway <= 8 && weeksAway >= 0

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '680px', margin: '0 auto', padding: '24px 16px' }}>

      {/* Championship banner */}
      {showChampionshipBanner && (
        <div style={{
          background: 'linear-gradient(135deg, #1a1000, #2a1a00)', border: '1px solid #F9B051',
          borderRadius: '10px', padding: '14px 18px', marginBottom: '16px',
        }}>
          <div style={{ color: '#F9B051', fontWeight: 'bold', fontSize: '13px', marginBottom: '4px' }}>
            2027 ALLSPORT CHAMPIONSHIP — 14 MARCH
          </div>
          <div style={{ color: '#ccc', fontSize: '13px', marginBottom: '8px' }}>
            {ranking?.current_rank
              ? `You're currently ranked #${ranking.current_rank} in ${ranking.division || player.division}.`
              : `You're competing in ${player.division}.`
            }
            {' '}Invite a friend to join you.
          </div>
          <div style={{ fontSize: '12px', color: '#888' }}>
            Share: <span style={{ color: '#F9B051', userSelect: 'text' as const }}>
              {typeof window !== 'undefined' ? window.location.origin : ''}/register
            </span>
          </div>
        </div>
      )}

      {/* Judge panel OR active session banner */}
      {player.role === 'judge' ? (
        <JudgeCard playerRole={player.role} />
      ) : activeSession ? (
        <Link href={`/scoring/${activeSession.id}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: '#0d2e1a', border: '1px solid #4DB26E', borderRadius: '10px',
          padding: '14px 18px', marginBottom: '20px', textDecoration: 'none',
        }}>
          <div>
            <div style={{ color: '#4DB26E', fontWeight: 'bold', fontSize: '14px' }}>Active Session</div>
            <div style={{ color: '#888', fontSize: '12px', marginTop: '2px' }}>{activeSession.location} - tap to return</div>
          </div>
          <div style={{ color: '#4DB26E', fontSize: '20px' }}>→</div>
        </Link>
      ) : null}

      {/* Player header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '28px' }}>
        <div style={{
          width: '56px', height: '56px', borderRadius: '50%', display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: 'bold', flexShrink: 0,
          ...gradeStyle(grade.colour), color: grade.textColour, border: '2px solid #333',
        }}>
          {(player.display_name || player.username || '?')[0].toUpperCase()}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{player.display_name || player.username}</div>
            {streak?.streak_active && (
              <div style={{
                background: '#2a1500', border: '1px solid #F9B051', borderRadius: '6px',
                padding: '2px 8px', fontSize: '12px', color: '#F9B051', fontWeight: 'bold',
              }}>
                🔥 {streak.streak_count}-session streak
              </div>
            )}
          </div>
          <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>
            {player.division} · {player.city || 'Ōtautahi'}
          </div>
        </div>
      </div>

      {/* Grade + progress */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '16px', opacity: rankingLoading ? 0.6 : 1, transition: 'opacity 0.2s' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '6px', letterSpacing: '1px' }}>CURRENT GRADE</div>
            <div style={{
              ...gradeStyle(grade.colour), color: grade.textColour,
              padding: '4px 14px', borderRadius: '20px', fontSize: '14px', fontWeight: 'bold',
              display: 'inline-block',
            }}>
              {grade.name}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '28px', fontWeight: 'bold' }}>{points.toLocaleString()}</div>
            <div style={{ fontSize: '11px', color: '#555' }}>points · {selectedYear}</div>
          </div>
        </div>

        {nextGrade && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#555', marginBottom: '6px' }}>
              <span>{grade.name}</span>
              <span>{nextGrade.name} · {nextGrade.threshold.toLocaleString()} pts</span>
            </div>
            <div style={{ background: '#222', borderRadius: '4px', height: '8px', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '4px', width: `${Math.min(progress, 100)}%`,
                background: 'linear-gradient(90deg, #2371BB, #4DB26E)',
              }} />
            </div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', textAlign: 'right' }}>
              {(nextGrade.threshold - points).toLocaleString()} pts to {nextGrade.name}
            </div>
          </>
        )}

        <div style={{ display: 'flex', gap: '6px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #1e1e1e' }}>
          {years.map(y => (
            <button key={y} onClick={() => setSelectedYear(y)} style={{
              padding: '5px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer', fontSize: '12px',
              background: selectedYear === y ? '#2371BB' : '#1a1a1a',
              color: selectedYear === y ? '#fff' : '#555',
            }}>{y}</button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginBottom: '16px' }}>
        {[
          { label: 'Sessions', value: ranking?.total_sessions || 0 },
          { label: 'Rank', value: ranking?.current_rank ? `#${ranking.current_rank}` : '-' },
          { label: 'Avg Placement', value: ranking?.average_placement ? `#${Math.round(ranking.average_placement)}` : '-' },
        ].map(stat => (
          <div key={stat.label} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', padding: '14px', textAlign: 'center' }}>
            <div style={{ fontSize: '22px', fontWeight: 'bold' }}>{stat.value}</div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Personal bests */}
      {personalBests.length > 0 && (
        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '12px' }}>Personal Bests</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {personalBests.map(pb => (
              <div key={pb.event_name} style={{
                background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '8px',
                padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px',
              }}>
                <span style={{ color: '#888' }}>{pb.event_name}</span>
                <span style={{ color: '#4DB26E', fontWeight: 'bold' }}>#{pb.best_placement}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Join a session */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '4px' }}>Join a Session</div>
        <div style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>Enter the 6-digit code shown on the judge screen</div>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
          <input
            value={sessionCode}
            onChange={e => setSessionCode(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            style={{
              flex: 1, background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px',
              padding: '12px', color: '#fff', fontSize: '22px', fontWeight: 'bold',
              letterSpacing: '6px', textAlign: 'center', boxSizing: 'border-box' as const,
            }}
            onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
          />
          <button onClick={handleJoinByCode} disabled={sessionCode.length < 6 || joining} style={{
            padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: sessionCode.length === 6 ? '#EA4742' : '#222',
            color: sessionCode.length === 6 ? '#fff' : '#555',
            fontWeight: 'bold', fontSize: '14px',
          }}>
            {joining ? '...' : 'Join'}
          </button>
        </div>
        {joinError && <p style={{ color: '#EA4742', fontSize: '13px', margin: 0 }}>{joinError}</p>}
      </div>

      {/* Recent sessions */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '15px', marginBottom: '16px' }}>Recent Sessions</div>
        {recentSessions.length === 0 ? (
          <div style={{ color: '#555', fontSize: '13px', textAlign: 'center', padding: '24px 0' }}>
            No sessions yet — join your first game to get started
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {recentSessions.slice(0, 5).map((result, idx) => (
              <div key={idx} style={{ background: '#0a0a0a', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
                    {result.sessions?.location || 'Session'}
                    {result.sessions?.is_championship && <span style={{ color: '#F9B051', marginLeft: '6px', fontSize: '11px' }}>CHAMPIONSHIP</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>
                    {result.sessions?.session_date
                      ? new Date(result.sessions.session_date).toLocaleDateString('en-NZ', { day: 'numeric', month: 'short', year: 'numeric' })
                      : ''}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2371BB' }}>+{result.points_earned || 0}</div>
                  <div style={{ fontSize: '11px', color: '#555' }}>pts</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
