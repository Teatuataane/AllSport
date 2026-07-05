'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

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

type Vote = {
  id: string
  name: string
  event_date: string
  voting_closes_at: string
  is_active: boolean
}

type Nomination = {
  domain_number: number
  event_name: string
}

type MyResponse = {
  domain_number: number
  chosen_event: string
  is_final: boolean
}

type VoteResult = {
  domain_number: number
  chosen_event: string
  vote_count: number
}

type VoteDetail = {
  domain_number: number
  chosen_event: string
  player_id: string
  display_name: string | null
  username: string | null
  division: string | null
  created_at: string
}

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

export default function VoteResultsPage() {
  const router = useRouter()
  const params = useParams()
  const voteId = params.voteId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [vote, setVote] = useState<Vote | null>(null)
  const [isJudge, setIsJudge] = useState(false)
  const [hasVoted, setHasVoted] = useState(false)
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [results, setResults] = useState<VoteResult[]>([])
  const [details, setDetails] = useState<VoteDetail[]>([])
  const [myResponses, setMyResponses] = useState<MyResponse[]>([])
  const [totalVoters, setTotalVoters] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [expandedDetails, setExpandedDetails] = useState<Record<number, boolean>>({})

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/play'); return }

      // Check judge role
      const { data: playerData } = await supabase
        .from('players')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()
      const judgeFlag = playerData?.role === 'judge'
      setIsJudge(judgeFlag)

      // Fetch vote
      const { data: voteData } = await supabase
        .from('event_votes')
        .select('*')
        .eq('id', voteId)
        .maybeSingle()

      if (!voteData) { router.push('/dashboard'); return }
      setVote(voteData)

      // Fetch player's responses
      const { data: myResp } = await supabase
        .from('event_vote_responses')
        .select('domain_number, chosen_event, is_final')
        .eq('vote_id', voteId)
        .eq('player_id', user.id)

      const myResponses = myResp || []
      setMyResponses(myResponses)
      const voted = myResponses.some(r => r.is_final)
      setHasVoted(voted)

      // Fetch nominations
      const { data: nomData } = await supabase
        .from('event_vote_nominations')
        .select('domain_number, event_name')
        .eq('vote_id', voteId)
        .order('domain_number')
      setNominations(nomData || [])

      // Fetch aggregate results if voted or judge
      if (voted || judgeFlag) {
        const { data: resultsData } = await supabase.rpc('get_vote_results', { p_vote_id: voteId })
        setResults(resultsData || [])
      }

      // Fetch full details if judge
      if (judgeFlag) {
        const { data: detailsData } = await supabase.rpc('get_vote_details', { p_vote_id: voteId })
        setDetails(detailsData || [])
      }

      // Total voter count
      const { data: voterCountData } = await supabase
        .from('event_vote_responses')
        .select('player_id')
        .eq('vote_id', voteId)
        .eq('is_final', true)
      const uniqueVoters = new Set((voterCountData || []).map(r => r.player_id)).size
      setTotalVoters(uniqueVoters)

      setLoading(false)
    }

    init()
  }, [voteId])

  // Live countdown
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !vote) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', fontFamily: 'var(--font-body)' }}>Loading results...</div>
      </div>
    )
  }

  const closesAt = new Date(vote.voting_closes_at).getTime()
  const msLeft = closesAt - now
  const isOpen = vote.is_active && msLeft > 0
  const countdown = formatCountdown(msLeft)

  const formattedDate = new Date(vote.event_date).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  const myResponseMap: Record<number, string> = {}
  for (const r of myResponses) {
    if (r.is_final) myResponseMap[r.domain_number] = r.chosen_event
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '480px', margin: '0 auto', padding: '0 0 60px' }}>
      {/* Rainbow header stripe */}
      <div style={{
        height: '4px',
        background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)',
      }} />

      {/* Header */}
      <div style={{ padding: '20px 16px' }}>
        <Link href="/dashboard" style={{
          fontSize: '12px', color: '#555', textDecoration: 'none',
          fontFamily: 'var(--font-label)', letterSpacing: '0.05em',
          display: 'inline-block', marginBottom: '16px',
        }}>
          ← Back to Dashboard
        </Link>

        <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '4px' }}>
          EVENT VOTE RESULTS · {formattedDate}
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', color: '#fff', lineHeight: 1.1, marginBottom: '12px' }}>
          {vote.name}
        </div>

        {/* Meta row */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '6px' }}>
          <div style={{ fontSize: '12px', color: '#888', fontFamily: 'var(--font-label)', letterSpacing: '0.05em' }}>
            {totalVoters} player{totalVoters !== 1 ? 's' : ''} voted
          </div>
          <div style={{
            fontSize: '12px',
            fontFamily: 'var(--font-label)',
            letterSpacing: '0.05em',
            color: isOpen ? '#F9B051' : '#4DB26E',
            fontWeight: 700,
          }}>
            {isOpen ? `OPEN · closes in ${countdown}` : 'CLOSED'}
          </div>
        </div>
      </div>

      {/* Spoiler-free view for non-voted, non-judge players */}
      {!hasVoted && !isJudge ? (
        <div style={{ padding: '0 16px' }}>
          <div style={{
            background: '#111',
            border: '1px solid #1e1e1e',
            borderRadius: '12px',
            padding: '32px 24px',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>🔒</div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: '24px',
              letterSpacing: '0.05em',
              color: '#fff',
              marginBottom: '8px',
            }}>
              Results Hidden Until You Vote
            </div>
            <div style={{ fontSize: '13px', color: '#888', fontFamily: 'var(--font-body)', marginBottom: '20px' }}>
              {totalVoters} player{totalVoters !== 1 ? 's' : ''} have already voted.
              Cast your vote to see how everyone chose.
            </div>
            {isOpen && (
              <Link href={`/vote/${voteId}`} style={{
                display: 'inline-block',
                padding: '12px 24px',
                borderRadius: '10px',
                background: 'linear-gradient(90deg, #B87DB5, #2371BB)',
                color: '#fff',
                fontFamily: 'var(--font-display)',
                fontSize: '18px',
                letterSpacing: '0.1em',
                textDecoration: 'none',
              }}>
                Vote Now →
              </Link>
            )}
          </div>
        </div>
      ) : (
        /* Results view */
        <div style={{ padding: '0 16px' }}>
          {DOMAINS.map(domain => {
            const domNominations = nominations.filter(n => n.domain_number === domain.number)
            const domResults = results.filter(r => r.domain_number === domain.number)
            const myPick = myResponseMap[domain.number]

            // Build vote counts (include 0 for nominations with no votes)
            const countsMap: Record<string, number> = {}
            for (const nom of domNominations) {
              countsMap[nom.event_name] = 0
            }
            for (const res of domResults) {
              countsMap[res.chosen_event] = Number(res.vote_count)
            }

            const maxVotes = Math.max(...Object.values(countsMap), 1)
            const totalDomainVotes = Object.values(countsMap).reduce((a, b) => a + b, 0)

            const domDetails = details.filter(d => d.domain_number === domain.number)
            const isExpanded = expandedDetails[domain.number]

            return (
              <div key={domain.number} style={{
                background: '#111',
                border: '1px solid #1e1e1e',
                borderRadius: '12px',
                padding: '16px',
                marginBottom: '12px',
              }}>
                {/* Domain header */}
                <div style={{ marginBottom: '14px' }}>
                  <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', marginBottom: '2px' }}>
                    DOMAIN {domain.number}
                  </div>
                  <div style={{ fontSize: '15px', fontFamily: 'var(--font-label)', fontWeight: 700, color: '#ccc', letterSpacing: '0.03em' }}>
                    {domain.name}
                  </div>
                </div>

                {/* Bar chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {Object.entries(countsMap)
                    .sort(([, a], [, b]) => b - a)
                    .map(([eventName, count]) => {
                      const isMyPick = eventName === myPick
                      const barWidth = maxVotes > 0 ? (count / maxVotes) * 100 : 0
                      const pct = totalDomainVotes > 0 ? Math.round((count / totalDomainVotes) * 100) : 0

                      return (
                        <div key={eventName}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {isMyPick && (
                                <span style={{ color: '#B87DB5', fontSize: '12px' }}>★</span>
                              )}
                              <span style={{
                                fontSize: '13px',
                                fontFamily: 'var(--font-body)',
                                color: isMyPick ? '#B87DB5' : '#ccc',
                                fontWeight: isMyPick ? 600 : 400,
                              }}>
                                {eventName}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span style={{ fontSize: '12px', color: '#888', fontFamily: 'var(--font-label)' }}>
                                {count}
                              </span>
                              {!isOpen && (
                                <span style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)' }}>
                                  {pct}%
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ background: '#1e1e1e', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%',
                              borderRadius: '4px',
                              width: `${barWidth}%`,
                              background: isMyPick ? '#B87DB5' : '#2371BB',
                              transition: 'width 0.4s ease',
                            }} />
                          </div>
                        </div>
                      )
                    })}
                </div>

                {/* Judge: Full Breakdown */}
                {isJudge && domDetails.length > 0 && (
                  <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid #1e1e1e' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <div style={{
                        fontSize: '10px',
                        color: '#F9B051',
                        fontFamily: 'var(--font-label)',
                        letterSpacing: '0.1em',
                      }}>
                        JUDGE VIEW — not visible to players
                      </div>
                      <button
                        onClick={() => setExpandedDetails(prev => ({ ...prev, [domain.number]: !isExpanded }))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#555',
                          cursor: 'pointer',
                          fontSize: '12px',
                          fontFamily: 'var(--font-label)',
                          letterSpacing: '0.05em',
                          padding: '2px 6px',
                        }}
                      >
                        {isExpanded ? 'Hide ▲' : 'Full Breakdown ▼'}
                      </button>
                    </div>

                    {isExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {domDetails.map((detail, idx) => (
                          <div key={idx} style={{
                            background: '#0a0a0a',
                            borderRadius: '6px',
                            padding: '8px 10px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}>
                            <div>
                              <div style={{ fontSize: '12px', color: '#ccc', fontFamily: 'var(--font-body)' }}>
                                {detail.display_name || detail.username || 'Unknown'}
                              </div>
                              <div style={{ fontSize: '10px', color: '#555', fontFamily: 'var(--font-label)', marginTop: '1px' }}>
                                {detail.division || '—'} · {new Date(detail.created_at).toLocaleTimeString('en-NZ', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <div style={{ fontSize: '12px', color: '#B87DB5', fontFamily: 'var(--font-label)', fontWeight: 700, textAlign: 'right', maxWidth: '50%' }}>
                              {detail.chosen_event}
                            </div>
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
  )
}
