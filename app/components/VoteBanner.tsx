'use client'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

type VoteBannerProps = {
  userId: string
  isJudge: boolean
}

type ActiveVote = {
  id: string
  name: string
  event_date: string
  voting_closes_at: string
  is_active: boolean
}

type VoteResponse = {
  domain_number: number
  is_final: boolean
}

function formatCountdown(ms: number): string {
  if (ms <= 0) return 'Closed'
  const totalSeconds = Math.floor(ms / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`
  } else if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`
  } else {
    return `${minutes}m ${seconds}s`
  }
}

export default function VoteBanner({ userId, isJudge }: VoteBannerProps) {
  const supabase = createClient()
  const [vote, setVote] = useState<ActiveVote | null>(null)
  const [responses, setResponses] = useState<VoteResponse[]>([])
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

      if (!voteData) {
        setLoading(false)
        return
      }

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

  // Live countdown tick
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  if (loading || !vote) return null

  const closesAt = new Date(vote.voting_closes_at).getTime()
  const msLeft = closesAt - now
  const countdown = formatCountdown(msLeft)

  const hasFinal = responses.some(r => r.is_final)
  const hasPartial = responses.length > 0 && !hasFinal
  const answeredCount = responses.length

  let voteState: 'voted' | 'partial' | 'not_voted'
  if (hasFinal) {
    voteState = 'voted'
  } else if (hasPartial) {
    voteState = 'partial'
  } else {
    voteState = 'not_voted'
  }

  const formattedDate = new Date(vote.event_date).toLocaleDateString('en-NZ', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #0d0a1a, #1a0d2e)',
        border: '1px solid #B87DB5',
        borderRadius: '12px',
        marginBottom: '20px',
        overflow: 'hidden',
      }}
    >
      {/* Rainbow stripe */}
      <div style={{
        height: '3px',
        background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)',
      }} />

      <div style={{ padding: '16px 18px' }}>
        {/* Vote name + date */}
        <div style={{ marginBottom: '10px' }}>
          <div style={{
            fontFamily: 'Bebas Neue, cursive',
            fontSize: '20px',
            color: '#fff',
            letterSpacing: '0.05em',
            lineHeight: 1.1,
          }}>
            {vote.name}
          </div>
          <div style={{
            fontSize: '12px',
            color: '#888',
            marginTop: '3px',
            fontFamily: 'Barlow Condensed, sans-serif',
            letterSpacing: '0.05em',
          }}>
            Event date: {formattedDate}
          </div>
        </div>

        {/* Countdown */}
        <div style={{
          fontSize: '13px',
          fontFamily: 'Barlow Condensed, sans-serif',
          letterSpacing: '0.08em',
          color: voteState === 'voted' ? '#4DB26E' : '#F9B051',
          marginBottom: '14px',
          fontWeight: 700,
        }}>
          {msLeft > 0 ? `VOTING CLOSES IN: ${countdown}` : 'VOTING CLOSED'}
        </div>

        {/* CTA row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {voteState === 'voted' ? (
            <>
              <div style={{
                fontSize: '13px',
                color: '#4DB26E',
                fontFamily: 'Barlow Condensed, sans-serif',
                letterSpacing: '0.05em',
                fontWeight: 700,
              }}>
                ✓ You've voted
              </div>
              <Link href={`/vote/${vote.id}/results`} style={{
                padding: '9px 16px',
                borderRadius: '8px',
                border: '1px solid #B87DB5',
                background: '#1a0d2e',
                color: '#B87DB5',
                fontSize: '13px',
                fontFamily: 'Barlow Condensed, sans-serif',
                fontWeight: 700,
                letterSpacing: '0.05em',
                textDecoration: 'none',
                display: 'inline-block',
              }}>
                View Results →
              </Link>
            </>
          ) : voteState === 'partial' ? (
            <Link href={`/vote/${vote.id}`} style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(90deg, #B87DB5, #2371BB)',
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'Bebas Neue, cursive',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              display: 'inline-block',
            }}>
              Continue Voting → ({answeredCount}/10 done)
            </Link>
          ) : (
            <Link href={`/vote/${vote.id}`} style={{
              padding: '10px 18px',
              borderRadius: '8px',
              border: 'none',
              background: 'linear-gradient(90deg, #B87DB5, #2371BB)',
              color: '#fff',
              fontSize: '14px',
              fontFamily: 'Bebas Neue, cursive',
              letterSpacing: '0.1em',
              textDecoration: 'none',
              display: 'inline-block',
            }}>
              Cast Your Vote →
            </Link>
          )}

          {isJudge && (
            <Link href="/dashboard#vote-panel" style={{
              fontSize: '12px',
              color: '#555',
              textDecoration: 'none',
              fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '0.05em',
              borderBottom: '1px solid #333',
              paddingBottom: '1px',
            }}>
              Manage Vote
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
