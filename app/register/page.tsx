'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

function calculateAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

function calculateDivision(dob: string, gender: string): string {
  const age = calculateAge(dob)
  if (age <= 12) return 'Youth'
  if (age <= 16) return 'Juniors'
  if (gender === 'Female') {
    if (age < 40) return "Women's"
    if (age < 60) return 'Masters Women'
    return 'Grandmasters Women'
  }
  // Male + Other default to men's categories
  if (age < 40) return "Men's"
  if (age < 60) return 'Masters Men'
  return 'Grandmasters Men'
}

function RegisterInner() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [needsEmailConfirm, setNeedsEmailConfirm] = useState(false)
  const [existingUserId, setExistingUserId] = useState<string | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const pendingCode = searchParams.get('code')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        const u = session.user
        setExistingUserId(u.id)
        setForm(prev => ({
          ...prev,
          email: u.email ?? prev.email,
          full_name: u.user_metadata?.full_name ?? prev.full_name,
        }))
        setStep(2)
      }
    })
  }, [])

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    date_of_birth: '',
    gender: '' as 'Male' | 'Female' | 'Other' | '',
    username: '',
    city: '',
    region: '',
    country: 'New Zealand',
    parent_name: '',
    parent_email: '',
    parent_phone: '',
    show_full_name: false,
    show_username: true,
    show_division: true,
    show_location: false,
  })

  const set = (field: string, value: any) =>
    setForm(prev => ({ ...prev, [field]: value }))

  const division = form.date_of_birth && form.gender
    ? calculateDivision(form.date_of_birth, form.gender)
    : ''

  const isMinor = form.date_of_birth ? calculateAge(form.date_of_birth) < 17 : false

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      let userId = existingUserId
      let newSession: any = null

      if (!userId) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
        })
        if (authError) throw authError
        userId = authData.user?.id ?? null
        newSession = authData.session
        if (!userId) throw new Error('Registration failed — please try again')
      }

      const display_name = form.show_full_name ? form.full_name : form.username

      const profilePayload = {
        id: userId,
        full_name: form.full_name,
        email: form.email,
        phone: form.phone,
        date_of_birth: form.date_of_birth || null,
        gender: form.gender || null,
        username: form.username,
        division,
        city: form.city,
        region: form.region,
        country: form.country,
        parent_name: form.parent_name,
        parent_email: form.parent_email,
        parent_phone: form.parent_phone,
        show_full_name: form.show_full_name,
        show_username: form.show_username,
        show_division: form.show_division,
        show_location: form.show_location,
        display_name,
        is_active: true,
      }

      const { error: profileError } = await supabase.from('players').upsert(profilePayload, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      if (profileError) {
        if (existingUserId || newSession) {
          throw new Error(`Profile save failed: ${profileError.message}`)
        }
        console.warn('Profile insert deferred (email confirmation likely enabled):', profileError.message)
      }

      if (existingUserId || newSession) {
        router.push(pendingCode ? `/dashboard?code=${pendingCode}` : '/dashboard')
      } else {
        setNeedsEmailConfirm(true)
      }
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', background: '#111', border: '1px solid #333',
    borderRadius: '8px', padding: '12px', color: '#fff',
    fontSize: '14px', boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }
  const sectionStyle = { display: 'flex', flexDirection: 'column' as const, gap: '16px' }

  if (needsEmailConfirm) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📧</div>
        <h2 style={{ color: '#F9B051', fontSize: '24px', marginBottom: '12px' }}>Check your email</h2>
        <p style={{ color: '#888', marginBottom: '8px' }}>We sent a confirmation link to <strong style={{ color: '#fff' }}>{form.email}</strong>.</p>
        <p style={{ color: '#888', marginBottom: '24px' }}>Click that link, then come back to log in and join the session.</p>
        <a href="/login" style={{ background: '#2371BB', color: '#fff', padding: '12px 32px', borderRadius: '8px', textDecoration: 'none', fontWeight: 'bold', display: 'inline-block' }}>Go to Login</a>
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#444' }}>
          Tip: ask the judge to disable email confirmation in Supabase to skip this step.
        </div>
      </div>
    </div>
  )

  const step1Valid = !!(form.full_name && form.email && form.password && form.date_of_birth && form.gender)

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', padding: '24px', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#2371BB', marginBottom: '4px' }}>Register</h1>
        <p style={{ color: '#888', fontSize: '14px' }}>Join AllSport Kura Kaha</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {[1,2,3].map(s => (
            <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= s ? '#2371BB' : '#222' }} />
          ))}
        </div>
        <div style={{ fontSize: '12px', color: '#555', marginTop: '8px' }}>
          Step {step} of 3 — {step === 1 ? 'Account Details' : step === 2 ? 'Your Profile' : 'Display Preferences'}
        </div>
      </div>

      {/* Step 1 — Account */}
      {step === 1 && (
        <div style={sectionStyle}>
          <div>
            <label style={labelStyle}>FULL NAME</label>
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)} style={inputStyle} placeholder="Your legal name" />
          </div>
          <div>
            <label style={labelStyle}>EMAIL</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} placeholder="your@email.com" />
          </div>
          <div>
            <label style={labelStyle}>PASSWORD</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} style={inputStyle} placeholder="Min 6 characters" />
          </div>
          <div>
            <label style={labelStyle}>DATE OF BIRTH</label>
            <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>GENDER</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['Male', 'Female', 'Other'] as const).map(g => (
                <button
                  key={g}
                  onClick={() => set('gender', g)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                    fontWeight: 'bold', fontSize: '13px',
                    background: form.gender === g ? '#2371BB' : '#111',
                    color: form.gender === g ? '#fff' : '#555',
                    border: `1px solid ${form.gender === g ? '#2371BB' : '#333'}`,
                  }}
                >{g}</button>
              ))}
            </div>
            {form.gender === 'Other' && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: '#555' }}>
                You'll be placed in the Men's or Grandmasters equivalent by default. A judge can reassign you to any division before your first session.
              </div>
            )}
          </div>
          <div>
            <label style={labelStyle}>PHONE</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputStyle} placeholder="+64 21 000 0000" />
          </div>

          {/* Show calculated division preview */}
          {form.date_of_birth && form.gender && (
            <div style={{ background: '#0d1320', border: '1px solid #2371BB', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#888' }}>
              Division: <strong style={{ color: '#fff' }}>{division}</strong>
              <span style={{ marginLeft: '8px', color: '#444', fontSize: '11px' }}>auto-calculated from your age and gender</span>
            </div>
          )}

          <button
            onClick={() => setStep(2)}
            disabled={!step1Valid}
            style={{ padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', background: step1Valid ? '#2371BB' : '#222', color: step1Valid ? '#fff' : '#555' }}
          >
            Next →
          </button>
        </div>
      )}

      {/* Step 2 — Profile */}
      {step === 2 && (
        <div style={sectionStyle}>
          <div>
            <label style={labelStyle}>USERNAME / HANDLE</label>
            <input value={form.username} onChange={e => set('username', e.target.value)} style={inputStyle} placeholder="How you'll appear on leaderboards" />
            <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>This is how other players will see you by default</div>
          </div>

          {existingUserId && (
            <>
              <div>
                <label style={labelStyle}>DATE OF BIRTH</label>
                <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>GENDER</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {(['Male', 'Female', 'Other'] as const).map(g => (
                    <button
                      key={g}
                      onClick={() => set('gender', g)}
                      style={{
                        flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
                        fontWeight: 'bold', fontSize: '13px',
                        background: form.gender === g ? '#2371BB' : '#111',
                        color: form.gender === g ? '#fff' : '#555',
                        border: `1px solid ${form.gender === g ? '#2371BB' : '#333'}`,
                      }}
                    >{g}</button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Division — read only, calculated from step 1 data */}
          {division && (
            <div>
              <label style={labelStyle}>DIVISION</label>
              <div style={{ background: '#111', border: '1px solid #333', borderRadius: '8px', padding: '12px 14px', fontSize: '14px', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{division}</span>
                <span style={{ fontSize: '11px', color: '#444' }}>calculated automatically</span>
              </div>
            </div>
          )}

          {isMinor && (
            <div style={{ background: '#1a1a2e', border: '1px solid #2371BB', borderRadius: '8px', padding: '16px' }}>
              <div style={{ color: '#2371BB', fontWeight: 'bold', marginBottom: '12px', fontSize: '14px' }}>Parent / Guardian Details Required</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>PARENT NAME</label>
                  <input value={form.parent_name} onChange={e => set('parent_name', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>PARENT EMAIL</label>
                  <input value={form.parent_email} onChange={e => set('parent_email', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>PARENT PHONE</label>
                  <input value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>CITY</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} style={inputStyle} placeholder="Ōtautahi" />
          </div>
          <div>
            <label style={labelStyle}>REGION</label>
            <input value={form.region} onChange={e => set('region', e.target.value)} style={inputStyle} placeholder="Canterbury" />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(1)} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer', fontWeight: 'bold' }}>← Back</button>
            <button
              onClick={() => setStep(3)}
              disabled={!form.username}
              style={{ flex: 2, padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', background: form.username ? '#2371BB' : '#222', color: form.username ? '#fff' : '#555' }}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Display preferences */}
      {step === 3 && (
        <div style={sectionStyle}>
          <div style={{ background: '#111', border: '1px solid #222', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '15px' }}>What appears on leaderboards?</div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>Choose what other players and the public can see about you</div>

            {[
              { field: 'show_username', label: 'Show username / handle', sub: 'Recommended — lets people know who you are without revealing personal details' },
              { field: 'show_full_name', label: 'Show full name', sub: 'Your legal name will be visible on public leaderboards' },
              { field: 'show_division', label: 'Show division', sub: "Your division shown next to your name" },
              { field: 'show_location', label: 'Show location', sub: 'Your city and region will be visible' },
            ].map(({ field, label, sub }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={form[field as keyof typeof form] as boolean}
                  onChange={e => set(field, e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: '#2371BB', marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{sub}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ background: '#0d1f0d', border: '1px solid #4DB26E', borderRadius: '8px', padding: '12px 16px', fontSize: '13px', color: '#4DB26E' }}>
            You'll appear as: <strong>{form.show_full_name ? form.full_name : form.username || 'your username'}</strong>
            {form.show_division && division && <span style={{ color: '#888' }}> · {division}</span>}
            {form.show_location && form.city && <span style={{ color: '#888' }}> · {form.city}</span>}
          </div>

          {error && <p style={{ color: '#EA4742', fontSize: '13px', margin: 0 }}>{error}</p>}

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(2)} style={{ flex: 1, padding: '14px', borderRadius: '8px', border: '1px solid #333', background: 'transparent', color: '#888', cursor: 'pointer', fontWeight: 'bold' }}>← Back</button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{ flex: 2, padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', background: '#EA4742', color: '#fff' }}
            >
              {loading ? 'Creating account...' : 'Create Account →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Register() {
  return <Suspense><RegisterInner /></Suspense>
}
