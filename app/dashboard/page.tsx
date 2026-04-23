'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
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

function DashboardInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
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
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [memberForm, setMemberForm] = useState({ full_name: '', username: '', date_of_birth: '', gender: 'male' as 'male' | 'female' })
  const [memberError, setMemberError] = useState('')
  // Username / display name editing
  const [editingUsername, setEditingUsername] = useState(false)
  const [usernameForm, setUsernameForm] = useState({ username: '', display_name: '' })
  const [usernameSaving, setUsernameSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  // Stats view — self or a family member
  const [statsPlayerId, setStatsPlayerId] = useState<string | null>(null)

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

      // Load linked family members
      const { data: children } = await supabase
        .from('players')
        .select('id, full_name, display_name, username, division, date_of_birth')
        .eq('parent_id', user.id)
        .order('full_name')
      setFamilyMembers(children || [])

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

  const [pendingAutoJoin, setPendingAutoJoin] = useState<string | null>(null)

  // Auto-join from QR code or /play?code= redirect
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

  // Year-dependent load — rankings filtered by selected year
  useEffect(() => {
    if (!userId) return
    const loadRanking = async () => {
      setRankingLoading(true)
      const targetId = statsPlayerId || userId
      const { data } = await supabase
        .from('rankings')
        .select('*')
        .eq('player_id', targetId)
        .eq('season_year', selectedYear)
        .maybeSingle()
      setRanking(data)
      setRankingLoading(false)
    }
    loadRanking()
  }, [userId, selectedYear, statsPlayerId])

  const handleJoinByCode = async (codeOverride?: string) => {
    const code = (codeOverride ?? sessionCode).trim()
    if (!code) return
    setJoining(true)
    setJoinError('')
    try {
      const { data: sess, error } = await supabase
        .from('sessions')
        .select('*')
        .ilike('session_code', code)
        .eq('is_active', true)
        .maybeSingle()
      if (error) throw new Error(`Query error: ${error.message}`)
      if (!sess) throw new Error('No active session found with that code. Double-check the code on the judge screen.')
      window.location.href = `/scoring/${sess.id}`
    } catch (e: any) {
      setJoinError(e.message)
    }
    setJoining(false)
  }

  // Fire auto-join once the player is confirmed loaded (auth ready)
  useEffect(() => {
    if (pendingAutoJoin && !loading) {
      setPendingAutoJoin(null)
      handleJoinByCode(pendingAutoJoin)
    }
  }, [pendingAutoJoin, loading])

  const isJunior = (dob: string) => {
    if (!dob) return false
    return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) < 17
  }

  const handleAddMember = async () => {
    if (!memberForm.full_name || !memberForm.username || !memberForm.date_of_birth) return
    setAddingMember(true); setMemberError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAddingMember(false); return }
    const division = isJunior(memberForm.date_of_birth) ? 'Juniors' : memberForm.gender === 'female' ? "Women's" : "Men's"
    const { data, error } = await supabase.from('players').insert({
      full_name: memberForm.full_name,
      username: memberForm.username,
      display_name: memberForm.username,
      date_of_birth: memberForm.date_of_birth,
      division,
      parent_id: user.id,
      show_username: true,
      show_division: true,
      is_active: true,
      country: 'New Zealand',
    }).select().single()
    if (error) {
      setMemberError(error.message)
    } else {
      setFamilyMembers(prev => [...prev, data])
      setMemberForm({ full_name: '', username: '', date_of_birth: '', gender: 'male' })
      setShowAddMember(false)
    }
    setAddingMember(false)
  }

  const handleRemoveMember = async (id: string) => {
    if (!confirm('Remove this family member? Their scores will remain on the leaderboard.')) return
    const { error } = await supabase.from('players').delete().eq('id', id)
    if (error) { alert('Could not remove family member — try again'); return }
    setFamilyMembers(prev => prev.filter(m => m.id !== id))
  }

  const handleSaveUsername = async () => {
    if (!usernameForm.username.trim()) { setUsernameError('Username is required'); return }
    setUsernameSaving(true); setUsernameError('')
    const { error } = await supabase.from('players').update({
      username: usernameForm.username.trim(),
      display_name: usernameForm.display_name.trim() || usernameForm.username.trim(),
    }).eq('id', player.id)
    if (error) {
      setUsernameError(error.message)
    } else {
      setPlayer((p: any) => ({ ...p, username: usernameForm.username.trim(), display_name: usernameForm.display_name.trim() || usernameForm.username.trim() }))
      setEditingUsername(false)
    }
    setUsernameSaving(false)
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{player.display_name || player.username}</div>
            {streak?.streak_active && (
              <div style={{
                background: '#2a1500', border: '1px solid #F9B051', borderRadius: '6px',
                padding: '2px 8px', fontSize: '12px', color: '#F9B051', fontWeight: 'bold',
              }}>
                🔥 {streak.streak_count}-session streak
              </div>
            )}
            <button
              onClick={() => { setUsernameForm({ username: player.username || '', display_name: player.display_name || '' }); setEditingUsername(true) }}
              style={{ fontSize: '11px', color: '#555', background: 'none', border: '1px solid #333', borderRadius: '5px', padding: '2px 8px', cursor: 'pointer' }}
            >
              Edit name
            </button>
          </div>
          <div style={{ fontSize: '13px', color: '#555', marginTop: '2px' }}>
            {player.division} · {player.city || 'Ōtautahi'}
          </div>
        </div>

        {/* Username edit form */}
        {editingUsername && (
          <div style={{ marginTop: '12px', background: '#0d0d0d', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>USERNAME (leaderboard)</label>
              <input value={usernameForm.username} onChange={e => setUsernameForm(f => ({ ...f, username: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '14px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>DISPLAY NAME (optional — defaults to username)</label>
              <input value={usernameForm.display_name} onChange={e => setUsernameForm(f => ({ ...f, display_name: e.target.value }))}
                style={{ width: '100%', boxSizing: 'border-box', background: '#111', border: '1px solid #2a2a2a', borderRadius: '6px', padding: '8px 10px', color: '#fff', fontSize: '14px' }} />
            </div>
            {usernameError && <div style={{ color: '#EA4742', fontSize: '12px' }}>{usernameError}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => setEditingUsername(false)} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer', fontSize: '13px' }}>Cancel</button>
              <button onClick={handleSaveUsername} disabled={usernameSaving} style={{ flex: 2, padding: '8px', borderRadius: '7px', border: 'none', background: '#2371BB', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', opacity: usernameSaving ? 0.6 : 1 }}>
                {usernameSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
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

      {/* Stats player switcher — shown only when family members exist */}
      {familyMembers.length > 0 && (
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
          {[{ id: null, label: player.display_name || player.username || 'Me' }, ...familyMembers.map(m => ({ id: m.id, label: m.display_name || m.username || m.full_name }))].map(p => {
            const active = statsPlayerId === p.id
            return (
              <button key={p.id ?? 'self'} onClick={() => setStatsPlayerId(p.id)} style={{
                padding: '5px 12px', borderRadius: '6px', border: `1px solid ${active ? '#2371BB' : '#333'}`,
                background: active ? '#0d1a2e' : 'transparent', color: active ? '#2371BB' : '#666',
                cursor: 'pointer', fontSize: '12px', fontWeight: active ? 700 : 400,
              }}>{p.label}</button>
            )
          })}
        </div>
      )}

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
        {joinError && (
          <div style={{ background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px', color: '#EA4742', fontSize: '14px', fontWeight: 'bold' }}>
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
              flex: 1, background: '#0a0a0a', border: '1px solid #333', borderRadius: '8px',
              padding: '12px', color: '#fff', fontSize: '22px', fontWeight: 'bold',
              letterSpacing: '6px', textAlign: 'center', boxSizing: 'border-box' as const,
            }}
            onKeyDown={e => e.key === 'Enter' && handleJoinByCode()}
          />
          <button onClick={() => handleJoinByCode()} disabled={sessionCode.trim().length < 6 || joining} style={{
            padding: '12px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer',
            background: sessionCode.trim().length >= 6 ? '#EA4742' : '#222',
            color: sessionCode.trim().length >= 6 ? '#fff' : '#555',
            fontWeight: 'bold', fontSize: '14px',
          }}>
            {joining ? '...' : 'Join'}
          </button>
        </div>
      </div>

      {/* Family members */}
      <div style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <div style={{ fontWeight: 'bold', fontSize: '15px' }}>Family</div>
            <div style={{ fontSize: '12px', color: '#555', marginTop: '2px' }}>Add whānau so you can submit scores for them during sessions</div>
          </div>
          <button onClick={() => { setShowAddMember(v => !v); setMemberError('') }} style={{
            background: showAddMember ? '#1e1e1e' : '#2371BB', color: '#fff',
            border: 'none', borderRadius: '8px', padding: '8px 14px',
            fontSize: '13px', fontWeight: 'bold', cursor: 'pointer', flexShrink: 0,
          }}>
            {showAddMember ? 'Cancel' : '+ Add'}
          </button>
        </div>

        {/* Add member form */}
        {showAddMember && (
          <div style={{ background: '#0a0a0a', borderRadius: '10px', padding: '16px', marginBottom: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>FULL NAME</label>
              <input
                value={memberForm.full_name}
                onChange={e => setMemberForm(f => ({ ...f, full_name: e.target.value }))}
                placeholder="e.g. Aroha Clement"
                style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' as const }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>USERNAME (appears on leaderboard)</label>
              <input
                value={memberForm.username}
                onChange={e => setMemberForm(f => ({ ...f, username: e.target.value }))}
                placeholder="e.g. aroha"
                style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' as const }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '4px' }}>DATE OF BIRTH (sets division automatically)</label>
              <input
                type="date"
                value={memberForm.date_of_birth}
                onChange={e => setMemberForm(f => ({ ...f, date_of_birth: e.target.value }))}
                style={{ width: '100%', background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '10px 12px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' as const }}
              />
            </div>
            {!isJunior(memberForm.date_of_birth) && (
              <div>
                <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '6px' }}>GENDER</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['male', 'female'] as const).map(g => (
                    <button key={g} onClick={() => setMemberForm(f => ({ ...f, gender: g }))} style={{
                      flex: 1, padding: '8px', borderRadius: '8px', border: `1px solid ${memberForm.gender === g ? '#2371BB' : '#2a2a2a'}`,
                      background: memberForm.gender === g ? '#0d1a2e' : 'transparent',
                      color: memberForm.gender === g ? '#fff' : '#555', cursor: 'pointer', fontSize: '13px',
                    }}>{g === 'male' ? "Men's" : "Women's"}</button>
                  ))}
                </div>
              </div>
            )}
            {memberForm.date_of_birth && (
              <div style={{ fontSize: '11px', color: isJunior(memberForm.date_of_birth) ? '#F9B051' : '#4DB26E' }}>
                Division: {isJunior(memberForm.date_of_birth) ? 'Juniors (×1.2 multiplier)' : memberForm.gender === 'female' ? "Women's (×1.2)" : "Men's"}
              </div>
            )}
            {memberError && <div style={{ color: '#EA4742', fontSize: '13px' }}>{memberError}</div>}
            <button
              onClick={handleAddMember}
              disabled={addingMember || !memberForm.full_name || !memberForm.username || !memberForm.date_of_birth}
              style={{
                background: memberForm.full_name && memberForm.username && memberForm.date_of_birth ? '#2371BB' : '#1a1a1a',
                color: memberForm.full_name && memberForm.username && memberForm.date_of_birth ? '#fff' : '#444',
                border: 'none', borderRadius: '8px', padding: '12px',
                fontWeight: 'bold', fontSize: '14px', cursor: 'pointer',
              }}
            >
              {addingMember ? 'Adding...' : 'Add Family Member'}
            </button>
          </div>
        )}

        {/* Member list */}
        {familyMembers.length === 0 && !showAddMember ? (
          <div style={{ color: '#444', fontSize: '13px', textAlign: 'center', padding: '12px 0' }}>
            No family members added yet
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {familyMembers.map(m => (
              <div key={m.id} style={{ background: '#0a0a0a', borderRadius: '8px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a1a2e', border: '1px solid #2371BB', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '15px', flexShrink: 0, color: '#2371BB' }}>
                  {(m.display_name || m.username || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', fontSize: '14px' }}>{m.display_name || m.username}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '1px' }}>
                    {m.division}
                    {m.date_of_birth && ` · born ${new Date(m.date_of_birth).getFullYear()}`}
                  </div>
                </div>
                <button onClick={() => handleRemoveMember(m.id)} style={{
                  background: 'transparent', border: 'none', color: '#333',
                  cursor: 'pointer', fontSize: '18px', padding: '4px 8px', flexShrink: 0,
                }}>×</button>
              </div>
            ))}
          </div>
        )}
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

export default function Dashboard() {
  return <Suspense><DashboardInner /></Suspense>
}
