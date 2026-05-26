'use client'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

const supabase = createClient()

const TIERS = [
  { tier: 1, reward: 'Supporters Wall', icon: '🫶', color: '#888888', donationMin: 0, referralsNeeded: 1, referralPath: true },
  { tier: 2, reward: 'Digital Certificate', icon: '📜', color: '#2d9e4f', donationMin: 50, referralsNeeded: 3, referralPath: true },
  { tier: 3, reward: 'Sticker Pack', icon: '🎁', color: '#2563eb', donationMin: 200, referralsNeeded: 6, referralPath: true },
  { tier: 4, reward: 'Colours T-Shirt', icon: '👕', color: '#9333ea', donationMin: 500, referralsNeeded: 12, referralPath: true },
  { tier: 5, reward: 'Grading Hoodie', icon: '🧥', color: '#EA4742', donationMin: 1000, referralsNeeded: 18, referralPath: true },
  { tier: 6, reward: 'Clothing Stack', icon: '🎽', color: '#F9B051', donationMin: 2000, referralsNeeded: 25, referralPath: true },
  { tier: 7, reward: 'Personal Coaching — 20hrs', icon: '🏆', color: '#f4a226', donationMin: 2500, referralsNeeded: null, referralPath: false },
  { tier: 8, reward: 'Personal Coaching — 50hrs', icon: '🏆', color: '#f4a226', donationMin: 5000, referralsNeeded: null, referralPath: false },
  { tier: 9, reward: 'AllSport Comes To You', icon: '🌍', color: '#f4a226', donationMin: 10000, referralsNeeded: null, referralPath: false },
]

function getCurrentTier(totalDonated: number, qualifiedReferrals: number) {
  let current = null
  for (const t of TIERS) {
    const byDonation = totalDonated >= t.donationMin
    const byReferral = t.referralPath && t.referralsNeeded !== null && qualifiedReferrals >= t.referralsNeeded
    if (byDonation || byReferral) current = t
  }
  return current
}

function getNextTier(totalDonated: number, qualifiedReferrals: number) {
  const current = getCurrentTier(totalDonated, qualifiedReferrals)
  if (!current) return TIERS[0]
  const idx = TIERS.findIndex(t => t.tier === current.tier)
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null
}

export default function MyKoha() {
  const router = useRouter()
  const [userId, setUserId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Data
  const [totalDonated, setTotalDonated] = useState(0)
  const [qualifiedReferrals, setQualifiedReferrals] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)

  // My referrer
  const [myReferral, setMyReferral] = useState<any>(null) // the referrals row where I'm the referred
  const [referrerPlayer, setReferrerPlayer] = useState<any>(null)

  // My referrals (where I'm the referrer)
  const [myReferrals, setMyReferrals] = useState<any[]>([])

  // Search state
  const [searchTerm, setSearchTerm] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [selectedCandidate, setSelectedCandidate] = useState<any>(null)
  const [nominating, setNominating] = useState(false)
  const [nominateError, setNominateError] = useState('')
  const [nominateSuccess, setNominateSuccess] = useState(false)

  // ── Auth + load ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/play'); return }
      setUserId(user.id)

      const [donationsRes, referralRowRes, myReferralsRes, sessionRes] = await Promise.all([
        supabase
          .from('koha_donations')
          .select('amount_nzd')
          .eq('player_id', user.id),
        supabase
          .from('referrals')
          .select('id, referrer_id, session_count, qualified_at')
          .eq('referred_id', user.id)
          .maybeSingle(),
        supabase
          .from('referrals')
          .select('id, session_count, qualified_at, referred_id')
          .eq('referrer_id', user.id)
          .order('qualified_at', { ascending: false, nullsFirst: false }),
        supabase
          .from('session_player_summary')
          .select('id')
          .eq('player_id', user.id),
      ])

      // Donations total
      const donated = (donationsRes.data || []).reduce((sum: number, d: any) => sum + d.amount_nzd, 0)
      setTotalDonated(donated)

      // My referrer row
      if (referralRowRes.data) {
        setMyReferral(referralRowRes.data)
        // Fetch referrer's display name
        const { data: rp } = await supabase
          .from('players')
          .select('display_name, username')
          .eq('id', referralRowRes.data.referrer_id)
          .maybeSingle()
        setReferrerPlayer(rp)
      }

      // My referrals — fetch referred player names
      const refs = myReferralsRes.data || []
      if (refs.length > 0) {
        const ids = refs.map((r: any) => r.referred_id)
        const { data: players } = await supabase
          .from('players')
          .select('id, display_name, username')
          .in('id', ids)
        const playersMap: Record<string, any> = {}
        for (const p of players || []) playersMap[p.id] = p

        const withNames = refs.map((r: any) => ({
          ...r,
          player: playersMap[r.referred_id] || null,
        }))
        setMyReferrals(withNames)
        setQualifiedReferrals(withNames.filter((r: any) => r.qualified_at).length)
      }

      setSessionCount((sessionRes.data || []).length)
      setLoading(false)
    }
    load()
  }, [router])

  // ── Debounced player search ──────────────────────────────────────────────────
  useEffect(() => {
    if (searchTerm.length < 2) { setSearchResults([]); return }
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      const { data } = await supabase.rpc('search_players_by_username', { p_query: searchTerm })
      // Filter out self
      setSearchResults((data || []).filter((p: any) => p.id !== userId))
      setSearchLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [searchTerm, userId])

  // ── Nominate referrer ────────────────────────────────────────────────────────
  const handleNominate = async () => {
    if (!selectedCandidate || !userId) return
    if (selectedCandidate.id === userId) {
      setNominateError('You cannot nominate yourself.')
      return
    }
    setNominating(true)
    setNominateError('')
    const { error } = await supabase
      .from('referrals')
      .insert({ referrer_id: selectedCandidate.id, referred_id: userId })
    if (error) {
      setNominateError(error.message.includes('unique') ? 'You already have a referrer.' : error.message)
      setNominating(false)
      return
    }
    setNominateSuccess(true)
    setMyReferral({ referrer_id: selectedCandidate.id, session_count: 0, qualified_at: null })
    setReferrerPlayer(selectedCandidate)
    setSelectedCandidate(null)
    setSearchTerm('')
    setNominating(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const currentTier = getCurrentTier(totalDonated, qualifiedReferrals)
  const nextTier = getNextTier(totalDonated, qualifiedReferrals)

  const qualifiedReferralsList = myReferrals.filter(r => r.qualified_at)
  const pendingReferralsList = myReferrals.filter(r => !r.qualified_at)

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
    </div>
  )

  return (
    <>
      <style>{`
        .my-koha-input {
          width: 100%;
          background: #111;
          border: 1px solid #333;
          border-radius: 10px;
          padding: 12px 14px;
          color: #fff;
          font-size: 14px;
          font-family: Barlow, sans-serif;
          box-sizing: border-box;
          outline: none;
        }
        .my-koha-input:focus { border-color: #555; }
        .search-result-item {
          padding: 10px 14px;
          border-bottom: 1px solid #1e1e1e;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 10px;
          transition: background 0.1s;
        }
        .search-result-item:hover { background: #1a1a1a; }
        .search-result-item:last-child { border-bottom: none; }
      `}</style>

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section style={{
        paddingTop: '152px', paddingBottom: '80px',
        background: '#000000', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)',
          backgroundSize: '80px 80px', opacity: 0.5,
        }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)' }} />
        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div className="tag">Koha &amp; Referrals</div>
          <h1 style={{ fontSize: 'clamp(56px, 8vw, 112px)', lineHeight: 0.95, marginBottom: '8px' }}>
            <span style={{
              background: 'linear-gradient(90deg, #2371BB, #4DB26E)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>MY KOHA</span>
          </h1>
          <div className="rainbow-line" style={{ width: '80px', marginBottom: '28px' }} />
          <p style={{ color: '#cccccc', fontSize: '18px', maxWidth: '580px', lineHeight: 1.7 }}>
            Track your contribution to AllSport — through koha or by growing the community.
          </p>
        </div>
      </section>

      {/* ── Section 1: Tier Status ───────────────────────────────────────────── */}
      <section className="section" style={{ background: '#0d0d0d', borderTop: '3px solid #2371BB' }}>
        <div className="container">
          <div className="tag">Your Status</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', marginBottom: '8px', lineHeight: 1 }}>
            YOUR <span style={{ color: '#2371BB' }}>TIER</span>
          </h2>
          <div className="divider" style={{ background: '#2371BB', marginBottom: '32px' }} />

          {/* Stat blocks */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px', maxWidth: '480px' }}>
            <div style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderTop: '3px solid #4DB26E', borderRadius: '12px', padding: '20px 22px',
            }}>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '44px', color: '#4DB26E', lineHeight: 1 }}>
                ${totalDonated.toLocaleString()}
              </div>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginTop: '4px' }}>
                TOTAL DONATED
              </div>
            </div>
            <div style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderTop: '3px solid #F9B051', borderRadius: '12px', padding: '20px 22px',
            }}>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '44px', color: '#F9B051', lineHeight: 1 }}>
                {qualifiedReferrals}
              </div>
              <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginTop: '4px' }}>
                QUALIFIED REFERRALS
              </div>
            </div>
          </div>

          {/* Current tier card */}
          {currentTier ? (
            <div style={{
              background: `${currentTier.color}18`,
              border: `2px solid ${currentTier.color}`,
              borderRadius: '16px', padding: '28px 28px',
              marginBottom: '20px', maxWidth: '480px',
              display: 'flex', alignItems: 'center', gap: '20px',
            }}>
              <div style={{ fontSize: '40px', flexShrink: 0 }}>{currentTier.icon}</div>
              <div>
                <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', letterSpacing: '0.12em', color: currentTier.color, marginBottom: '4px' }}>
                  TIER {currentTier.tier} — CURRENT
                </div>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', color: '#fff', lineHeight: 1 }}>
                  {currentTier.reward}
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: '#111', border: '1px solid #333',
              borderRadius: '16px', padding: '24px 28px',
              marginBottom: '20px', maxWidth: '480px',
              color: '#555', fontFamily: 'Barlow, sans-serif', fontSize: '14px',
            }}>
              No tier yet — donate any amount or refer 1 player who completes 10 sessions to reach Tier 1.
            </div>
          )}

          {/* Progress toward next tier */}
          {nextTier && (
            <div style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderLeft: `4px solid ${nextTier.color}`,
              borderRadius: '12px', padding: '20px 22px', maxWidth: '480px',
            }}>
              <div style={{
                fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px',
                letterSpacing: '0.1em', color: '#555', marginBottom: '8px',
              }}>
                NEXT: TIER {nextTier.tier} — {nextTier.reward.toUpperCase()}
              </div>

              {/* Donation path */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '12px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif',
                  marginBottom: '5px',
                }}>
                  <span>Donation path</span>
                  <span style={{ color: totalDonated >= nextTier.donationMin ? '#4DB26E' : '#888' }}>
                    ${totalDonated.toLocaleString()} / ${nextTier.donationMin.toLocaleString()}
                    {totalDonated >= nextTier.donationMin && ' ✓'}
                  </span>
                </div>
                <div style={{ height: '5px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: '#4DB26E', borderRadius: '3px',
                    width: `${Math.min((totalDonated / nextTier.donationMin) * 100, 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
              </div>

              {/* Referral path */}
              {nextTier.referralPath && nextTier.referralsNeeded !== null && (
                <div>
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    fontSize: '12px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif',
                    marginBottom: '5px',
                  }}>
                    <span>Referral path</span>
                    <span style={{ color: qualifiedReferrals >= nextTier.referralsNeeded ? '#F9B051' : '#888' }}>
                      {qualifiedReferrals} / {nextTier.referralsNeeded} referrals
                      {qualifiedReferrals >= nextTier.referralsNeeded && ' ✓'}
                    </span>
                  </div>
                  <div style={{ height: '5px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%', background: '#F9B051', borderRadius: '3px',
                      width: `${Math.min((qualifiedReferrals / nextTier.referralsNeeded) * 100, 100)}%`,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )}

              {!nextTier.referralPath && (
                <div style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '8px' }}>
                  Tier {nextTier.tier} requires a donation of ${nextTier.donationMin.toLocaleString()}+. No referral path.
                </div>
              )}
            </div>
          )}

          {!nextTier && currentTier && (
            <div style={{
              background: '#111', border: '1px solid #f4a22633',
              borderRadius: '12px', padding: '20px 22px', maxWidth: '480px',
              color: '#f4a226', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px',
            }}>
              Maximum tier reached — thank you for your incredible support of AllSport.
            </div>
          )}
        </div>
      </section>

      {/* ── Section 2: My Referrer ───────────────────────────────────────────── */}
      <section className="section" style={{ background: '#0a0a0a', borderTop: '3px solid #4DB26E' }}>
        <div className="container">
          <div className="tag">Who brought you here?</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', marginBottom: '8px', lineHeight: 1 }}>
            MY <span style={{ color: '#4DB26E' }}>REFERRER</span>
          </h2>
          <div className="divider" style={{ background: '#4DB26E', marginBottom: '16px' }} />
          <p style={{ color: '#888', fontSize: '15px', maxWidth: '540px', lineHeight: 1.7, marginBottom: '28px' }}>
            Who brought you to AllSport? Nominating them counts toward their Koha tier — a referral qualifies once you have completed 10 sessions.
          </p>

          {myReferral ? (
            /* Already has a referrer */
            <div style={{
              background: '#111', border: '1px solid #4DB26E33',
              borderLeft: '4px solid #4DB26E',
              borderRadius: '14px', padding: '22px 24px', maxWidth: '480px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
                <div style={{ fontSize: '24px' }}>🔒</div>
                <div>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', letterSpacing: '0.1em', color: '#555', marginBottom: '3px' }}>
                    YOUR REFERRER — PERMANENT
                  </div>
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#fff', lineHeight: 1 }}>
                    {referrerPlayer?.display_name || referrerPlayer?.username || 'AllSport Player'}
                  </div>
                  {referrerPlayer?.username && (
                    <div style={{ fontSize: '12px', color: '#555', fontFamily: 'Barlow, sans-serif', marginTop: '2px' }}>
                      @{referrerPlayer.username}
                    </div>
                  )}
                </div>
              </div>

              {/* Session progress */}
              <div style={{ background: '#0a0a0a', borderRadius: '10px', padding: '14px 16px' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between',
                  fontSize: '12px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif',
                  marginBottom: '6px',
                }}>
                  <span>Sessions completed</span>
                  <span style={{ color: myReferral.session_count >= 10 ? '#4DB26E' : '#888' }}>
                    {myReferral.session_count}/10
                    {myReferral.session_count >= 10 && ' — Qualified!'}
                  </span>
                </div>
                <div style={{ height: '6px', background: '#1a1a1a', borderRadius: '3px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', background: '#4DB26E', borderRadius: '3px',
                    width: `${Math.min((myReferral.session_count / 10) * 100, 100)}%`,
                    transition: 'width 0.5s ease',
                  }} />
                </div>
                {myReferral.session_count < 10 && (
                  <div style={{ fontSize: '11px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '6px' }}>
                    {10 - myReferral.session_count} more session{10 - myReferral.session_count !== 1 ? 's' : ''} to qualify your referrer
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* No referrer yet — search UI */
            <div style={{ maxWidth: '480px' }}>
              {nominateSuccess && (
                <div style={{
                  background: '#0d1f0d', border: '1px solid #4DB26E',
                  borderRadius: '10px', padding: '14px 16px', marginBottom: '16px',
                  color: '#4DB26E', fontFamily: 'Barlow, sans-serif', fontSize: '14px',
                }}>
                  Referrer nominated successfully.
                </div>
              )}

              {selectedCandidate ? (
                /* Confirm nomination */
                <div style={{
                  background: '#111', border: '1px solid #4DB26E',
                  borderRadius: '14px', padding: '22px 24px',
                }}>
                  <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '18px', color: '#fff', marginBottom: '6px' }}>
                    Confirm Nomination
                  </div>
                  <p style={{ color: '#888', fontSize: '14px', fontFamily: 'Barlow, sans-serif', lineHeight: 1.6, marginBottom: '16px' }}>
                    Nominate <strong style={{ color: '#fff' }}>{selectedCandidate.display_name || selectedCandidate.username}</strong> as your referrer? This is permanent and cannot be changed.
                  </p>
                  {nominateError && (
                    <div style={{ color: '#EA4742', fontSize: '13px', marginBottom: '12px', fontFamily: 'Barlow, sans-serif' }}>
                      {nominateError}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => { setSelectedCandidate(null); setNominateError('') }}
                      style={{
                        flex: 1, padding: '11px', borderRadius: '8px',
                        border: '1px solid #333', background: 'transparent',
                        color: '#888', cursor: 'pointer', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700,
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleNominate}
                      disabled={nominating}
                      style={{
                        flex: 2, padding: '11px', borderRadius: '8px',
                        border: 'none', background: '#4DB26E',
                        color: '#fff', cursor: 'pointer',
                        fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '14px',
                      }}
                    >
                      {nominating ? 'Saving...' : 'Confirm'}
                    </button>
                  </div>
                </div>
              ) : (
                /* Search input */
                <div>
                  <div style={{ marginBottom: '8px', fontSize: '13px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.05em' }}>
                    Search by username
                  </div>
                  <input
                    className="my-koha-input"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="Start typing a username..."
                  />
                  {searchLoading && (
                    <div style={{ fontSize: '12px', color: '#555', padding: '10px 0', fontFamily: 'Barlow, sans-serif' }}>
                      Searching...
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div style={{
                      background: '#111', border: '1px solid #333',
                      borderRadius: '10px', marginTop: '6px', overflow: 'hidden',
                    }}>
                      {searchResults.map(p => (
                        <div
                          key={p.id}
                          className="search-result-item"
                          onClick={() => { setSelectedCandidate(p); setSearchTerm(''); setSearchResults([]) }}
                        >
                          <div>
                            <div style={{ color: '#fff', fontSize: '14px', fontFamily: 'Barlow, sans-serif', fontWeight: 600 }}>
                              {p.display_name || p.username}
                            </div>
                            {p.username && (
                              <div style={{ color: '#555', fontSize: '11px', fontFamily: 'Barlow Condensed, sans-serif' }}>
                                @{p.username}
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {searchTerm.length >= 2 && !searchLoading && searchResults.length === 0 && (
                    <div style={{ fontSize: '13px', color: '#444', padding: '10px 0', fontFamily: 'Barlow, sans-serif' }}>
                      No players found.
                    </div>
                  )}
                  <div style={{ fontSize: '12px', color: '#444', marginTop: '10px', fontFamily: 'Barlow Condensed, sans-serif', lineHeight: 1.5 }}>
                    Optional — only nominate someone if they genuinely introduced you to AllSport.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 3: My Referrals ──────────────────────────────────────────── */}
      <section className="section" style={{ background: '#000', borderTop: '3px solid #F9B051' }}>
        <div className="container">
          <div className="tag">Your referrals</div>
          <h2 style={{ fontSize: 'clamp(32px, 4vw, 52px)', marginBottom: '8px', lineHeight: 1 }}>
            MY <span style={{ color: '#F9B051' }}>REFERRALS</span>
          </h2>
          <div className="divider" style={{ background: '#F9B051', marginBottom: '16px' }} />
          <p style={{ color: '#888', fontSize: '15px', maxWidth: '540px', lineHeight: 1.7, marginBottom: '20px' }}>
            Players who have nominated you as their referrer. A referral qualifies once they have completed 10 sessions.
          </p>

          {/* Summary */}
          {myReferrals.length > 0 && (
            <div style={{
              display: 'inline-flex', gap: '20px', marginBottom: '24px',
              background: '#111', border: '1px solid #1e1e1e',
              borderRadius: '10px', padding: '12px 20px',
            }}>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: '#F9B051' }}>
                <strong>{qualifiedReferralsList.length}</strong> qualified
              </span>
              <span style={{ color: '#333' }}>·</span>
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px', color: '#888' }}>
                <strong>{pendingReferralsList.length}</strong> pending
              </span>
            </div>
          )}

          {myReferrals.length === 0 ? (
            <div style={{
              background: '#111', border: '1px solid #1e1e1e',
              borderRadius: '12px', padding: '28px 24px', maxWidth: '480px',
              color: '#555', fontFamily: 'Barlow, sans-serif', fontSize: '14px', textAlign: 'center',
            }}>
              No referrals yet. Share your AllSport invite link to grow the community.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '560px' }}>
              {/* Qualified */}
              {qualifiedReferralsList.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', color: '#F9B051', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginTop: '4px', marginBottom: '4px' }}>
                    QUALIFIED
                  </div>
                  {qualifiedReferralsList.map(r => (
                    <ReferralRow key={r.id} referral={r} />
                  ))}
                </>
              )}

              {/* Pending */}
              {pendingReferralsList.length > 0 && (
                <>
                  <div style={{ fontSize: '11px', color: '#888', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginTop: qualifiedReferralsList.length > 0 ? '12px' : '4px', marginBottom: '4px' }}>
                    PENDING
                  </div>
                  {pendingReferralsList.map(r => (
                    <ReferralRow key={r.id} referral={r} />
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Section 4: Donate ────────────────────────────────────────────────── */}
      <section style={{ padding: '80px 0', background: '#000', borderTop: '1px solid #1a1a1a', textAlign: 'center' }}>
        <div className="container">
          <div className="tag">Support the kaupapa</div>
          <h2 style={{ fontSize: 'clamp(36px, 5vw, 72px)', marginBottom: '8px' }}>
            SUPPORT THE <span style={{
              background: 'linear-gradient(90deg, #2d9e4f, #2371BB)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>KAUPAPA</span>
          </h2>
          <div className="rainbow-line" style={{ width: '60px', margin: '0 auto 24px' }} />
          <p style={{ color: '#888', fontSize: '16px', maxWidth: '480px', margin: '0 auto 32px', lineHeight: 1.7 }}>
            Donations are manually recorded. Contact Tane after donating to have your total updated.
          </p>

          {/* Bank details */}
          <div style={{
            background: '#111', border: '1px solid #1e1e1e',
            borderRadius: '14px', padding: '28px 32px', maxWidth: '440px',
            margin: '0 auto 24px', textAlign: 'left',
          }}>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '20px', color: '#fff', marginBottom: '16px', letterSpacing: '0.05em' }}>
              Bank Transfer
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '2px' }}>ACCOUNT NAME</div>
                <div style={{ color: '#fff', fontFamily: 'Barlow, sans-serif', fontSize: '15px' }}>AllSport Aotearoa</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '2px' }}>BANK DETAILS</div>
                <div style={{ color: '#888', fontFamily: 'Barlow, sans-serif', fontSize: '14px' }}>Contact Tane for bank details</div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em', marginBottom: '2px' }}>REFERENCE</div>
                <div style={{ color: '#888', fontFamily: 'Barlow, sans-serif', fontSize: '14px' }}>Your name or username</div>
              </div>
            </div>
          </div>

          {/* IRD callout */}
          <div style={{
            background: '#111', border: '1px solid #f4a22633',
            borderRadius: '12px', padding: '18px 24px', maxWidth: '440px',
            margin: '0 auto 24px', display: 'flex', alignItems: 'center', gap: '14px', textAlign: 'left',
          }}>
            <div style={{ fontSize: '24px', flexShrink: 0 }}>💸</div>
            <div>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '18px', color: '#f4a226', marginBottom: '2px' }}>IRD 33% Tax Rebate</div>
              <p style={{ color: '#aaa', fontSize: '13px', lineHeight: 1.6, margin: 0 }}>
                Your koha qualifies for a 33% IRD tax credit. Your $100 contribution effectively costs $67.
              </p>
            </div>
          </div>

          <Link href="/koha" style={{
            color: '#2371BB', fontFamily: 'Barlow Condensed, sans-serif',
            fontSize: '14px', letterSpacing: '0.08em', textDecoration: 'none',
          }}>
            View full tier breakdown on /koha →
          </Link>
        </div>
      </section>
    </>
  )
}

function ReferralRow({ referral }: { referral: any }) {
  const name = referral.player?.display_name || referral.player?.username || 'AllSport Player'
  const sc = referral.session_count ?? 0
  const qualified = !!referral.qualified_at

  return (
    <div style={{
      background: '#111', border: `1px solid ${qualified ? '#F9B05133' : '#1e1e1e'}`,
      borderRadius: '10px', padding: '14px 16px',
      display: 'flex', alignItems: 'center', gap: '14px',
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontSize: '14px', fontFamily: 'Barlow, sans-serif', fontWeight: 600 }}>
          {name}
        </div>
        {/* Progress bar */}
        <div style={{ marginTop: '6px' }}>
          <div style={{ height: '4px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              height: '100%', background: qualified ? '#F9B051' : '#444', borderRadius: '2px',
              width: `${Math.min((sc / 10) * 100, 100)}%`,
            }} />
          </div>
          <div style={{ fontSize: '10px', color: '#444', fontFamily: 'Barlow Condensed, sans-serif', marginTop: '3px' }}>
            {sc}/10 sessions
          </div>
        </div>
      </div>
      {qualified && (
        <div style={{
          background: '#F9B05122', border: '1px solid #F9B051',
          borderRadius: '6px', padding: '4px 10px',
          fontSize: '10px', color: '#F9B051',
          fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.08em',
          flexShrink: 0,
        }}>
          QUALIFIED
        </div>
      )}
    </div>
  )
}
