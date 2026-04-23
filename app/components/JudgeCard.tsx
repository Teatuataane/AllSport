'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import { QRCodeSVG } from 'qrcode.react'

type Session = {
  id: string
  session_code: string
  session_date: string
  location: string
  is_active: boolean
  started_at: string | null
  duration_minutes: number | null
  points_awarded_at: string | null
}

type JudgeCardProps = {
  playerRole: string
}

export default function JudgeCard({ playerRole }: JudgeCardProps) {
  const router = useRouter()
  const supabase = createClient()
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
    const now = Date.now()
    const expiredIds = active
      .filter(s => s.started_at && s.duration_minutes && s.points_awarded_at === null)
      .filter(s => now > new Date(s.started_at!).getTime() + s.duration_minutes! * 60 * 1000)
      .map(s => s.id)
    if (expiredIds.length > 0) {
      const endedAt = new Date().toISOString()
      await Promise.all(expiredIds.map(id =>
        supabase.from('sessions').update({ is_active: false, ended_at: endedAt }).eq('id', id)
      ))
      // Re-fetch after closing expired sessions
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

  useEffect(() => {
    fetchSessions()
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
    // Points are awarded automatically by the award_session_points DB trigger
    // which fires when is_active changes true → false above.
    await fetchSessions()
    setEnding(null)
  }

  // Two-tap void confirmation — sets points_awarded_at so trigger skips point award
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
    // Setting points_awarded_at prevents the trigger from awarding points
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

      <div style={{
        background: '#111', border: '1px solid #1e3a5f', borderRadius: '12px',
        padding: '20px', marginBottom: '20px',
      }}>
        {/* Header: Te Reo label + start CTA */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#2371BB', letterSpacing: '0.05em', lineHeight: 1 }}>
              Kaiwāwao
            </div>
            <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em' }}>
              JUDGE PANEL
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
                      {/* Session code + player count — loudest element */}
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

                      {/* Action buttons — mobile stacks via flex-wrap */}
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => {
                            setExpandedQR(expandedQR === sess.id ? null : sess.id)
                          }}
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

                      {/* QR panel (expandable inline → tap for fullscreen) */}
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

                {/* Start button when session active — disabled, shown below active section */}
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

            {/* Empty active state */}
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

            {/* Recent sessions */}
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

            {/* Empty recent state — only show when no active sessions either (first time) */}
            {recentSessions.length === 0 && activeSessions.length === 0 && (
              <div style={{ color: '#333', fontSize: '12px', fontFamily: 'Barlow, sans-serif', textAlign: 'center', paddingTop: '4px' }}>
                Your session history will appear here
              </div>
            )}
          </>
        )}
      </div>
    </>
  )
}
