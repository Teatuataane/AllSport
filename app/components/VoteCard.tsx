'use client'

// ─── The vote card ───────────────────────────────────────────────────────────
// Extracted verbatim from app/dashboard/page.tsx when the dashboard became a
// stats page. Unchanged in behaviour: it still renders nothing unless a vote is
// open, which is what lets the dashboard's action strip treat it as one of three
// mutually exclusive states.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

function BentoCard({ href, children, style = {} }: {
  href: string
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <Link href={href} style={{
      display: 'block', width: '100%', textDecoration: 'none',
      borderRadius: '16px', cursor: 'pointer',
      transition: 'opacity 0.15s, transform 0.1s',
      WebkitTapHighlightColor: 'transparent',
      ...style,
    }}>
      {children}
    </Link>
  )
}

// ── Vote card (bento-styled replacement for VoteBanner) ───────────────────────
export default function VoteCard({ userId, isJudge }: { userId: string; isJudge: boolean }) {
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
