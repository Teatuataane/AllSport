'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

const supabase = createClient()

const PLAYER_ICONS = ['🏋️', '🤸', '🏃', '🚴', '🤼', '🏊', '🎯', '🏹', '⚽', '🏀', '🎾', '🏐', '🦅', '🐯', '🦁', '🦊', '🐺', '🦋', '🐬', '🐉']

const GRADES = [
  { name: 'Mā', colour: '#f0f0f0', textColour: '#1a1a1a', threshold: 0, borderColour: '#ccc' },
  { name: 'Kiwikiwi', colour: '#888888', textColour: '#fff', threshold: 500, borderColour: '#888' },
  { name: 'Whero', colour: '#EA4742', textColour: '#fff', threshold: 1000, borderColour: '#EA4742' },
  { name: 'Karaka', colour: '#F9B051', textColour: '#000', threshold: 2000, borderColour: '#F9B051' },
  { name: 'Kōwhai', colour: '#FFE566', textColour: '#000', threshold: 3000, borderColour: '#FFE566' },
  { name: 'Kākāriki', colour: '#4DB26E', textColour: '#fff', threshold: 4000, borderColour: '#4DB26E' },
  { name: 'Kahurangi', colour: '#2371BB', textColour: '#fff', threshold: 5000, borderColour: '#2371BB' },
  { name: 'Poroporo', colour: '#B87DB5', textColour: '#fff', threshold: 6000, borderColour: '#B87DB5' },
  { name: 'Uenuku', colour: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', textColour: '#fff', threshold: 8000, borderColour: '#B87DB5' },
  { name: 'Taniwha', colour: '#000000', textColour: '#F9B051', threshold: 10000, borderColour: '#F9B051' },
]

function getCurrentGrade(points: number) {
  let grade = GRADES[0]
  for (const g of GRADES) { if (points >= g.threshold) grade = g }
  return grade
}

function isJuniorDob(dob: string) {
  if (!dob) return false
  return Math.floor((Date.now() - new Date(dob).getTime()) / 31557600000) < 17
}

export default function ProfilePage() {
  const router = useRouter()

  const [userId, setUserId] = useState<string | null>(null)
  const [player, setPlayer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  // Active profile context
  const [activePlayerId, setActivePlayerId] = useState<string | null>(null)

  // Family members
  const [familyMembers, setFamilyMembers] = useState<any[]>([])
  const [showAddMember, setShowAddMember] = useState(false)
  const [addingMember, setAddingMember] = useState(false)
  const [memberForm, setMemberForm] = useState({
    full_name: '', username: '', date_of_birth: '', gender: 'male' as 'male' | 'female',
  })
  const [memberError, setMemberError] = useState('')

  // Editable profile fields
  const [form, setForm] = useState({
    username: '',
    display_name: '',
    icon: '',
    show_full_name: false,
    show_username: true,
    show_division: true,
    show_location: false,
  })

  // Rankings for grade display
  const [points, setPoints] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/play'); return }
      setUserId(user.id)

      const [playerResult, familyResult] = await Promise.all([
        supabase.from('players').select('*').eq('id', user.id).single(),
        supabase.from('players')
          .select('id, full_name, display_name, username, division, date_of_birth, icon, role')
          .eq('parent_id', user.id)
          .order('full_name'),
      ])

      const p = playerResult.data
      setPlayer(p)
      setFamilyMembers(familyResult.data || [])

      if (p) {
        setForm({
          username: p.username || '',
          display_name: p.display_name || '',
          icon: p.icon || '',
          show_full_name: p.show_full_name || false,
          show_username: p.show_username !== false,
          show_division: p.show_division !== false,
          show_location: p.show_location || false,
        })
      }

      // Restore active player
      const stored = typeof window !== 'undefined' ? localStorage.getItem('allsport_active_player_id') : null
      setActivePlayerId(stored || user.id)

      // Load ranking for grade display
      const { data: rankData } = await supabase
        .from('rankings')
        .select('total_points')
        .eq('player_id', user.id)
        .eq('season_year', new Date().getFullYear())
        .maybeSingle()
      setPoints(rankData?.total_points || 0)

      setLoading(false)
    }
    load()
  }, [router])

  const handleSave = async () => {
    if (!player) return
    if (!form.username.trim()) { setSaveError('Username is required'); return }
    setSaving(true); setSaveError(''); setSaved(false)

    const { error } = await supabase.from('players').update({
      username: form.username.trim(),
      display_name: form.display_name.trim() || form.username.trim(),
      icon: form.icon || null,
      show_full_name: form.show_full_name,
      show_username: form.show_username,
      show_division: form.show_division,
      show_location: form.show_location,
    }).eq('id', player.id)

    if (error) {
      setSaveError(error.message)
    } else {
      setPlayer((p: any) => ({
        ...p,
        username: form.username.trim(),
        display_name: form.display_name.trim() || form.username.trim(),
        icon: form.icon || null,
      }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    }
    setSaving(false)
  }

  const handleSwitchProfile = (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('allsport_active_player_id', id)
    }
    setActivePlayerId(id)
    router.push('/dashboard')
  }

  const handleAddMember = async () => {
    if (!memberForm.full_name || !memberForm.username || !memberForm.date_of_birth) return
    setAddingMember(true); setMemberError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAddingMember(false); return }
    const division = isJuniorDob(memberForm.date_of_birth)
      ? 'Juniors'
      : memberForm.gender === 'female' ? "Women's" : "Men's"
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
    if (error) { alert('Could not remove — try again'); return }
    setFamilyMembers(prev => prev.filter(m => m.id !== id))
    if (activePlayerId === id) handleSwitchProfile(userId!)
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontFamily: 'var(--font-body)' }}>Loading...</div>
    </div>
  )

  if (!player) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
      <div style={{ color: '#555' }}>No profile found.</div>
      <Link href="/register" style={{ color: '#2371BB' }}>Register</Link>
    </div>
  )

  const grade = getCurrentGrade(points)
  const displayName = form.display_name || form.username || player.full_name || '?'

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <div style={{ maxWidth: '520px', margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* Back */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
          <Link href="/dashboard" style={{
            background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px',
            padding: '8px 14px', color: '#888', textDecoration: 'none',
            fontFamily: 'var(--font-label)', fontSize: '13px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}>
            ← Dashboard
          </Link>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '26px', letterSpacing: '0.05em', lineHeight: 1 }}>
              Profile
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em' }}>
              {player.division} · {player.city || 'Ōtautahi'}
            </div>
          </div>
        </div>

        {/* ── Icon picker ────────────────────────────────────────────────────── */}
        <div style={{
          background: '#111', border: '1px solid #1e1e1e',
          borderRadius: '16px', padding: '22px', marginBottom: '16px',
        }}>
          {/* Current icon preview */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '18px' }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '34px', background: '#1a1a1a',
              border: `2px solid ${grade.borderColour}44`,
            }}>
              {form.icon || (
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '28px', color: grade.borderColour }}>
                  {displayName[0].toUpperCase()}
                </span>
              )}
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', letterSpacing: '0.04em' }}>
                {displayName}
              </div>
              <div style={{
                fontSize: '11px', color: '#555',
                fontFamily: 'var(--font-label)', letterSpacing: '0.08em',
              }}>
                {grade.name} · {player.division}
              </div>
              {form.icon && (
                <button onClick={() => setForm(f => ({ ...f, icon: '' }))} style={{
                  marginTop: '4px', background: 'none', border: 'none', cursor: 'pointer',
                  color: '#555', fontSize: '11px', fontFamily: 'var(--font-label)',
                  letterSpacing: '0.05em', padding: 0,
                }}>
                  Remove icon
                </button>
              )}
            </div>
          </div>

          <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '10px' }}>
            CHOOSE YOUR ICON
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
            {PLAYER_ICONS.map(icon => (
              <button
                key={icon}
                onClick={() => setForm(f => ({ ...f, icon: f.icon === icon ? '' : icon }))}
                style={{
                  background: form.icon === icon ? '#1a1a2e' : '#0a0a0a',
                  border: form.icon === icon ? '2px solid #2371BB' : '2px solid #222',
                  borderRadius: '10px', padding: '10px', fontSize: '24px',
                  cursor: 'pointer', transition: 'all 0.15s', lineHeight: 1,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {icon}
              </button>
            ))}
          </div>
        </div>

        {/* ── Profile edit ───────────────────────────────────────────────────── */}
        <div style={{
          background: '#111', border: '1px solid #1e1e1e',
          borderRadius: '16px', padding: '22px', marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '16px' }}>
            PROFILE DETAILS
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '5px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>
                USERNAME (leaderboard)
              </label>
              <input
                value={form.username}
                onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                  border: '1px solid #2a2a2a', borderRadius: '10px',
                  padding: '11px 14px', color: '#fff', fontSize: '15px',
                  fontFamily: 'var(--font-body)',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '5px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>
                DISPLAY NAME (optional — defaults to username)
              </label>
              <input
                value={form.display_name}
                onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
                style={{
                  width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                  border: '1px solid #2a2a2a', borderRadius: '10px',
                  padding: '11px 14px', color: '#fff', fontSize: '15px',
                  fontFamily: 'var(--font-body)',
                }}
              />
            </div>

            {/* Display prefs */}
            <div>
              <div style={{ fontSize: '11px', color: '#666', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', marginBottom: '10px' }}>
                LEADERBOARD DISPLAY
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {[
                  { key: 'show_username', label: 'Show username' },
                  { key: 'show_full_name', label: 'Show full name' },
                  { key: 'show_division', label: 'Show division' },
                  { key: 'show_location', label: 'Show location' },
                ].map(({ key, label }) => (
                  <label key={key} style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    cursor: 'pointer', padding: '8px 12px',
                    background: '#0a0a0a', borderRadius: '8px',
                    border: '1px solid #1e1e1e',
                  }}>
                    <input
                      type="checkbox"
                      checked={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))}
                      style={{ accentColor: '#2371BB', width: '16px', height: '16px' }}
                    />
                    <span style={{ fontSize: '13px', color: '#ccc', fontFamily: 'var(--font-body)' }}>
                      {label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {saveError && (
            <div style={{ color: '#EA4742', fontSize: '13px', marginTop: '12px', fontFamily: 'var(--font-body)' }}>
              {saveError}
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              width: '100%', marginTop: '18px',
              padding: '13px', borderRadius: '10px', border: 'none',
              background: saved ? '#4DB26E' : '#2371BB',
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'var(--font-display)', fontSize: '16px',
              letterSpacing: '0.08em', opacity: saving ? 0.7 : 1,
              transition: 'background 0.2s',
            }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved' : 'Save Profile'}
          </button>
        </div>

        {/* ── Player / family switcher ───────────────────────────────────────── */}
        <div style={{
          background: '#111', border: '1px solid #1e1e1e',
          borderRadius: '16px', padding: '22px', marginBottom: '16px',
        }}>
          <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', marginBottom: '14px' }}>
            ACTIVE PROFILE
          </div>

          {/* Own profile */}
          <button
            onClick={() => handleSwitchProfile(player.id)}
            style={{
              width: '100%', background: activePlayerId === player.id ? '#0d1a2e' : '#0a0a0a',
              border: `1px solid ${activePlayerId === player.id ? '#2371BB' : '#1e1e1e'}`,
              borderRadius: '10px', padding: '12px 14px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '12px',
              marginBottom: familyMembers.length > 0 ? '8px' : '0',
              textAlign: 'left' as const,
            }}
          >
            <div style={{
              width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '20px', background: '#111',
              border: `1px solid ${grade.borderColour}44`,
            }}>
              {form.icon || (
                <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: grade.borderColour }}>
                  {displayName[0].toUpperCase()}
                </span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>
                {displayName}
                <span style={{ marginLeft: '6px', fontSize: '10px', color: '#555', fontFamily: 'var(--font-label)' }}>
                  (you)
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '1px', fontFamily: 'var(--font-label)' }}>
                {player.division}
              </div>
            </div>
            {activePlayerId === player.id && (
              <div style={{ fontSize: '11px', color: '#2371BB', fontFamily: 'var(--font-label)', fontWeight: 700 }}>
                ACTIVE
              </div>
            )}
          </button>

          {/* Family members */}
          {familyMembers.map(m => {
            const isActive = activePlayerId === m.id
            const mName = m.display_name || m.username || m.full_name || '?'
            return (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
              }}>
                <button
                  onClick={() => handleSwitchProfile(m.id)}
                  style={{
                    flex: 1, background: isActive ? '#0d1a2e' : '#0a0a0a',
                    border: `1px solid ${isActive ? '#2371BB' : '#1e1e1e'}`,
                    borderRadius: '10px', padding: '12px 14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '12px',
                    textAlign: 'left' as const,
                  }}
                >
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '20px', background: '#111', border: '1px solid #2a2a2a',
                  }}>
                    {m.icon || (
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: '#555' }}>
                        {mName[0].toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>{mName}</div>
                    <div style={{ fontSize: '11px', color: '#555', marginTop: '1px', fontFamily: 'var(--font-label)' }}>
                      {m.division}
                      {m.date_of_birth ? ` · born ${new Date(m.date_of_birth).getFullYear()}` : ''}
                    </div>
                  </div>
                  {isActive && (
                    <div style={{ fontSize: '11px', color: '#2371BB', fontFamily: 'var(--font-label)', fontWeight: 700 }}>
                      ACTIVE
                    </div>
                  )}
                </button>
                <button
                  onClick={() => handleRemoveMember(m.id)}
                  style={{
                    background: 'transparent', border: '1px solid #2a2a2a',
                    borderRadius: '8px', color: '#444', cursor: 'pointer',
                    fontSize: '16px', padding: '8px 12px', flexShrink: 0,
                  }}
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>

        {/* ── Add family member ──────────────────────────────────────────────── */}
        <div style={{
          background: '#111', border: '1px solid #1e1e1e',
          borderRadius: '16px', padding: '22px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showAddMember ? '18px' : '0' }}>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff' }}>Whānau</div>
              <div style={{ fontSize: '11px', color: '#555', marginTop: '2px', fontFamily: 'var(--font-label)' }}>
                Add family members to submit scores for them
              </div>
            </div>
            <button
              onClick={() => { setShowAddMember(v => !v); setMemberError('') }}
              style={{
                background: showAddMember ? '#1e1e1e' : '#2371BB',
                color: '#fff', border: 'none', borderRadius: '8px',
                padding: '8px 14px', fontSize: '13px', fontWeight: 'bold',
                cursor: 'pointer', flexShrink: 0,
                fontFamily: 'var(--font-label)', letterSpacing: '0.05em',
              }}
            >
              {showAddMember ? 'Cancel' : '+ Add'}
            </button>
          </div>

          {showAddMember && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div>
                <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '5px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>
                  FULL NAME
                </label>
                <input
                  value={memberForm.full_name}
                  onChange={e => setMemberForm(f => ({ ...f, full_name: e.target.value }))}
                  placeholder="e.g. Aroha Clement"
                  style={{
                    width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                    border: '1px solid #2a2a2a', borderRadius: '10px',
                    padding: '11px 14px', color: '#fff', fontSize: '14px',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '5px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>
                  USERNAME
                </label>
                <input
                  value={memberForm.username}
                  onChange={e => setMemberForm(f => ({ ...f, username: e.target.value }))}
                  placeholder="e.g. aroha"
                  style={{
                    width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                    border: '1px solid #2a2a2a', borderRadius: '10px',
                    padding: '11px 14px', color: '#fff', fontSize: '14px',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '5px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>
                  DATE OF BIRTH
                </label>
                <input
                  type="date"
                  value={memberForm.date_of_birth}
                  onChange={e => setMemberForm(f => ({ ...f, date_of_birth: e.target.value }))}
                  style={{
                    width: '100%', boxSizing: 'border-box', background: '#0a0a0a',
                    border: '1px solid #2a2a2a', borderRadius: '10px',
                    padding: '11px 14px', color: '#fff', fontSize: '14px',
                    fontFamily: 'var(--font-body)',
                  }}
                />
              </div>
              {memberForm.date_of_birth && !isJuniorDob(memberForm.date_of_birth) && (
                <div>
                  <label style={{ fontSize: '11px', color: '#666', display: 'block', marginBottom: '8px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em' }}>
                    GENDER
                  </label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {(['male', 'female'] as const).map(g => (
                      <button key={g} onClick={() => setMemberForm(f => ({ ...f, gender: g }))} style={{
                        flex: 1, padding: '10px', borderRadius: '8px',
                        border: `1px solid ${memberForm.gender === g ? '#2371BB' : '#2a2a2a'}`,
                        background: memberForm.gender === g ? '#0d1a2e' : 'transparent',
                        color: memberForm.gender === g ? '#fff' : '#555',
                        cursor: 'pointer', fontSize: '13px', fontFamily: 'var(--font-body)',
                      }}>
                        {g === 'male' ? "Men's" : "Women's"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {memberForm.date_of_birth && (
                <div style={{ fontSize: '11px', color: isJuniorDob(memberForm.date_of_birth) ? '#F9B051' : '#4DB26E', fontFamily: 'var(--font-label)' }}>
                  Division: {isJuniorDob(memberForm.date_of_birth) ? 'Juniors' : memberForm.gender === 'female' ? "Women's" : "Men's"}
                </div>
              )}
              {memberError && <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-body)' }}>{memberError}</div>}
              <button
                onClick={handleAddMember}
                disabled={addingMember || !memberForm.full_name || !memberForm.username || !memberForm.date_of_birth}
                style={{
                  background: memberForm.full_name && memberForm.username && memberForm.date_of_birth ? '#2371BB' : '#1a1a1a',
                  color: memberForm.full_name && memberForm.username && memberForm.date_of_birth ? '#fff' : '#444',
                  border: 'none', borderRadius: '10px', padding: '13px',
                  fontFamily: 'var(--font-display)', fontSize: '16px', letterSpacing: '0.08em',
                  cursor: 'pointer', marginTop: '4px',
                }}
              >
                {addingMember ? 'Adding...' : 'Add Family Member'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
