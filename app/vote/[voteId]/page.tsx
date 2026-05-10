'use client'
import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const DOMAINS = [
  { number: 1, name: 'Maximal Strength' },
  { number: 2, name: 'Relative Strength' },
  { number: 3, name: 'Muscular Endurance' },
  { number: 4, name: 'Flexibility & Mobility' },
  { number: 5, name: 'Power' },
  { number: 6, name: 'Aerobic Endurance' },
  { number: 7, name: 'Speed & Agility' },
  { number: 8, name: 'Body Awareness' },
  { number: 9, name: 'Co-ordination' },
  { number: 10, name: 'Aim & Precision' },
]

type Vote = {
  id: string
  name: string
  event_date: string
  voting_closes_at: string
  is_active: boolean
  nominations_per_domain: number
}

type Nomination = {
  domain_number: number
  event_name: string
}

type Response = {
  domain_number: number
  chosen_event: string
  is_final: boolean
}

export default function VotePage() {
  const router = useRouter()
  const params = useParams()
  const voteId = params.voteId as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [vote, setVote] = useState<Vote | null>(null)
  const [nominations, setNominations] = useState<Nomination[]>([])
  const [responses, setResponses] = useState<Response[]>([])
  const [userId, setUserId] = useState<string | null>(null)

  // Current domain index (0-based)
  const [currentDomainIdx, setCurrentDomainIdx] = useState(0)
  // Selected events per domain (domain_number -> chosen_event)
  const [selections, setSelections] = useState<Record<number, string>>({})
  // Whether we're on the review screen
  const [showReview, setShowReview] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/play'); return }
      setUserId(user.id)

      const { data: voteData } = await supabase
        .from('event_votes')
        .select('*')
        .eq('id', voteId)
        .maybeSingle()

      if (!voteData) { router.push('/dashboard'); return }

      const now = new Date()
      const closesAt = new Date(voteData.voting_closes_at)
      if (!voteData.is_active || closesAt < now) {
        router.push(`/vote/${voteId}/results`)
        return
      }

      setVote(voteData)

      const [nomResult, respResult] = await Promise.all([
        supabase
          .from('event_vote_nominations')
          .select('domain_number, event_name')
          .eq('vote_id', voteId)
          .order('domain_number'),
        supabase
          .from('event_vote_responses')
          .select('domain_number, chosen_event, is_final')
          .eq('vote_id', voteId)
          .eq('player_id', user.id),
      ])

      setNominations(nomResult.data || [])

      const existingResponses = respResult.data || []

      // If any is_final → redirect to results
      if (existingResponses.some(r => r.is_final)) {
        router.push(`/vote/${voteId}/results`)
        return
      }

      setResponses(existingResponses)

      // Build selections from existing responses
      const existingSel: Record<number, string> = {}
      for (const r of existingResponses) {
        existingSel[r.domain_number] = r.chosen_event
      }
      setSelections(existingSel)

      // If all 10 answered, show review
      const answeredDomains = Object.keys(existingSel).map(Number)
      const allAnswered = DOMAINS.every(d => answeredDomains.includes(d.number))
      if (allAnswered) {
        setShowReview(true)
      } else {
        // Start at first unanswered domain
        const firstUnanswered = DOMAINS.findIndex(d => !answeredDomains.includes(d.number))
        setCurrentDomainIdx(firstUnanswered >= 0 ? firstUnanswered : 0)
      }

      setLoading(false)
    }

    init()
  }, [voteId])

  const currentDomain = DOMAINS[currentDomainIdx]
  const nominationsForDomain = nominations.filter(n => n.domain_number === currentDomain?.number)
  const selectedForCurrent = currentDomain ? selections[currentDomain.number] : undefined

  const answeredCount = Object.keys(selections).length

  const handleSelect = (event: string) => {
    if (!currentDomain) return
    setSelections(prev => ({ ...prev, [currentDomain.number]: event }))
  }

  const handleSaveAndContinue = async () => {
    if (!currentDomain || !userId || !selectedForCurrent) return
    setError('')
    setSubmitting(true)

    const { error: upsertError } = await supabase
      .from('event_vote_responses')
      .upsert({
        vote_id: voteId,
        player_id: userId,
        domain_number: currentDomain.number,
        chosen_event: selectedForCurrent,
        is_final: false,
      }, { onConflict: 'vote_id,player_id,domain_number' })

    if (upsertError) {
      setError('Failed to save — please try again')
      setSubmitting(false)
      return
    }

    setSubmitting(false)

    // If domain 10, or all domains answered → show review
    const newSelections = { ...selections, [currentDomain.number]: selectedForCurrent }
    const allAnswered = DOMAINS.every(d => newSelections[d.number])

    if (allAnswered) {
      setShowReview(true)
    } else {
      // Find next unanswered domain
      let next = currentDomainIdx + 1
      while (next < DOMAINS.length && newSelections[DOMAINS[next].number]) {
        next++
      }
      if (next < DOMAINS.length) {
        setCurrentDomainIdx(next)
      } else {
        setShowReview(true)
      }
    }
  }

  const handleBack = () => {
    if (showReview) {
      setShowReview(false)
      setCurrentDomainIdx(9) // go back to last domain
      return
    }
    if (currentDomainIdx > 0) {
      setCurrentDomainIdx(currentDomainIdx - 1)
    }
  }

  const handleSubmitFinal = async () => {
    if (!userId) return
    setSubmitting(true)
    setError('')

    // Update all responses to is_final = true
    const { error: updateError } = await supabase
      .from('event_vote_responses')
      .update({ is_final: true })
      .eq('vote_id', voteId)
      .eq('player_id', userId)

    if (updateError) {
      setError('Failed to submit — please try again')
      setSubmitting(false)
      return
    }

    router.push(`/vote/${voteId}/results`)
  }

  if (loading || !vote) {
    return (
      <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
      </div>
    )
  }

  const formattedDate = new Date(vote.event_date).toLocaleDateString('en-NZ', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', maxWidth: '480px', margin: '0 auto', padding: '0 0 40px' }}>
      {/* Rainbow header stripe */}
      <div style={{
        height: '4px',
        background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)',
      }} />

      {/* Vote header */}
      <div style={{ padding: '20px 16px 0' }}>
        <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '4px' }}>
          EVENT VOTE · {formattedDate}
        </div>
        <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '26px', letterSpacing: '0.05em', color: '#fff', lineHeight: 1.1, marginBottom: '20px' }}>
          {vote.name}
        </div>

        {/* Progress bar + dots */}
        {!showReview && (
          <div style={{ marginBottom: '24px' }}>
            <div style={{
              fontSize: '12px',
              color: '#888',
              fontFamily: 'Barlow Condensed, sans-serif',
              letterSpacing: '0.05em',
              marginBottom: '8px',
            }}>
              Domain {currentDomainIdx + 1} of 10 · {answeredCount}/10 answered
            </div>

            {/* Progress bar */}
            <div style={{ background: '#1e1e1e', borderRadius: '4px', height: '4px', marginBottom: '10px', overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                background: '#B87DB5',
                borderRadius: '4px',
                width: `${(answeredCount / 10) * 100}%`,
                transition: 'width 0.3s ease',
              }} />
            </div>

            {/* Dot indicators */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {DOMAINS.map((d, idx) => {
                const answered = !!selections[d.number]
                const isCurrent = idx === currentDomainIdx
                return (
                  <div
                    key={d.number}
                    style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      background: answered ? '#B87DB5' : isCurrent ? '#2a1a3e' : '#1e1e1e',
                      border: isCurrent ? '2px solid #B87DB5' : answered ? '2px solid #B87DB5' : '2px solid #333',
                      transition: 'all 0.2s',
                      flexShrink: 0,
                    }}
                  />
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* Review screen */}
      {showReview ? (
        <div style={{ padding: '0 16px' }}>
          <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', letterSpacing: '0.05em', color: '#fff', marginBottom: '6px' }}>
            Review Your Vote
          </div>
          <div style={{ fontSize: '12px', color: '#EA4742', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em', marginBottom: '20px' }}>
            Your vote is locked after submission and cannot be changed.
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
            {DOMAINS.map(domain => (
              <div key={domain.number} style={{
                background: '#111',
                border: '1px solid #1e1e1e',
                borderRadius: '10px',
                padding: '12px 16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.08em', marginBottom: '2px' }}>
                    DOMAIN {domain.number}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888', fontFamily: 'Barlow, sans-serif' }}>
                    {domain.name}
                  </div>
                </div>
                <div style={{ fontSize: '14px', color: '#B87DB5', fontWeight: 'bold', fontFamily: 'Barlow Condensed, sans-serif', textAlign: 'right', maxWidth: '55%' }}>
                  {selections[domain.number] || '—'}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div style={{
              background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px',
              padding: '10px 14px', color: '#EA4742', fontSize: '13px',
              fontFamily: 'Barlow, sans-serif', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleBack}
              disabled={submitting}
              style={{
                flex: 1, padding: '14px', borderRadius: '10px',
                border: '1px solid #333', background: 'transparent',
                color: '#888', cursor: 'pointer', fontSize: '14px',
                fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em',
                fontWeight: 700,
              }}
            >
              ← Back
            </button>
            <button
              onClick={handleSubmitFinal}
              disabled={submitting}
              style={{
                flex: 2, padding: '14px', borderRadius: '10px',
                border: 'none',
                background: submitting ? '#333' : 'linear-gradient(90deg, #B87DB5, #2371BB)',
                color: '#fff', cursor: submitting ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.1em',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting ? 'Submitting...' : 'Submit Vote ✓'}
            </button>
          </div>
        </div>
      ) : (
        /* Domain voting screen */
        <div style={{ padding: '0 16px' }}>
          <div style={{ marginBottom: '20px' }}>
            <div style={{ fontSize: '11px', color: '#B87DB5', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '4px' }}>
              DOMAIN {currentDomain.number}
            </div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', letterSpacing: '0.05em', color: '#fff', lineHeight: 1.1, marginBottom: '6px' }}>
              {currentDomain.name}
            </div>
            <div style={{ fontSize: '13px', color: '#888', fontFamily: 'Barlow, sans-serif' }}>
              Which event should we play?
            </div>
          </div>

          {/* Radio cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {nominationsForDomain.length === 0 ? (
              <div style={{ color: '#555', fontSize: '13px', fontFamily: 'Barlow, sans-serif', padding: '20px', textAlign: 'center' }}>
                No events nominated for this domain yet.
              </div>
            ) : (
              nominationsForDomain.map(nom => {
                const isSelected = selectedForCurrent === nom.event_name
                return (
                  <button
                    key={nom.event_name}
                    onClick={() => handleSelect(nom.event_name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '14px',
                      padding: '16px',
                      borderRadius: '10px',
                      border: isSelected ? '2px solid #B87DB5' : '1px solid #1e1e1e',
                      background: isSelected ? '#1a0d2e' : '#111',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Radio dot */}
                    <div style={{
                      width: '20px',
                      height: '20px',
                      borderRadius: '50%',
                      border: isSelected ? '2px solid #B87DB5' : '2px solid #333',
                      background: isSelected ? '#B87DB5' : 'transparent',
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      {isSelected && (
                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fff' }} />
                      )}
                    </div>
                    <div style={{
                      fontSize: '16px',
                      fontFamily: 'Barlow, sans-serif',
                      color: isSelected ? '#fff' : '#ccc',
                      fontWeight: isSelected ? 600 : 400,
                    }}>
                      {nom.event_name}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {error && (
            <div style={{
              background: '#2e0d0d', border: '1px solid #EA4742', borderRadius: '8px',
              padding: '10px 14px', color: '#EA4742', fontSize: '13px',
              fontFamily: 'Barlow, sans-serif', marginBottom: '16px',
            }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            {currentDomainIdx > 0 && (
              <button
                onClick={handleBack}
                style={{
                  flex: 1, padding: '14px', borderRadius: '10px',
                  border: '1px solid #333', background: 'transparent',
                  color: '#888', cursor: 'pointer', fontSize: '14px',
                  fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em',
                  fontWeight: 700,
                }}
              >
                ← Back
              </button>
            )}
            <button
              onClick={handleSaveAndContinue}
              disabled={!selectedForCurrent || submitting}
              style={{
                flex: 2, padding: '14px', borderRadius: '10px',
                border: 'none',
                background: selectedForCurrent && !submitting ? 'linear-gradient(90deg, #B87DB5, #2371BB)' : '#222',
                color: selectedForCurrent ? '#fff' : '#555',
                cursor: selectedForCurrent && !submitting ? 'pointer' : 'not-allowed',
                fontSize: '16px',
                fontFamily: 'Bebas Neue, cursive', letterSpacing: '0.1em',
                opacity: submitting ? 0.6 : 1,
              }}
            >
              {submitting
                ? 'Saving...'
                : currentDomainIdx === 9 || (Object.keys(selections).length === 9 && !selections[currentDomain.number])
                  ? 'Review →'
                  : 'Save & Continue →'
              }
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
