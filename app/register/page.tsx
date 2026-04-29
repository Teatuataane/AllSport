'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

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

  // Google OAuth users arrive already authenticated but with no player profile.
  // Detect this on mount so we can skip signUp() and use their existing auth ID.
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
        setStep(2) // skip account details — already authenticated
      }
    })
  }, [])

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    date_of_birth: '',
    username: '',
    division: '',
    address: '',
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

  const isYouthOrJunior = form.division === 'Youth' || form.division === 'Juniors'

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    try {
      let userId = existingUserId
      let newSession: any = null

      if (!userId) {
        // New registration via email/password
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
        username: form.username,
        division: form.division,
        address: form.address,
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

      // If email confirmation is disabled in Supabase, session is immediately available
      // and we can insert the player profile right now (auth.uid() = userId).
      // If email confirmation is enabled, session is null here — we still attempt the
      // insert using upsert so it works either way (RLS permissive on anon insert
      // for registration, or triggered later when user confirms).
      const { error: profileError } = await supabase.from('players').upsert(profilePayload, {
        onConflict: 'id',
        ignoreDuplicates: false,
      })
      if (profileError) {
        if (existingUserId || newSession) {
          // Authenticated user — profile insert should always succeed. Surface the error.
          throw new Error(`Profile save failed: ${profileError.message}`)
        }
        // Email/password with confirmation enabled — auth user created, profile deferred.
        console.warn('Profile insert deferred (email confirmation likely enabled):', profileError.message)
      }

      // OAuth users already have a session; email/password users may need confirmation
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

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', padding: '24px', maxWidth: '560px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: '#2371BB', marginBottom: '4px' }}>Register</h1>
        <p style={{ color: '#888', fontSize: '14px' }}>Join AllSport Kura Kaha</p>
        {/* Step indicator */}
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
            <label style={labelStyle}>PHONE</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputStyle} placeholder="+64 21 000 0000" />
          </div>
          <button
            onClick={() => setStep(2)}
            disabled={!form.full_name || !form.email || !form.password || !form.date_of_birth}
            style={{ padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', background: form.full_name && form.email && form.password && form.date_of_birth ? '#2371BB' : '#222', color: form.full_name && form.email && form.password && form.date_of_birth ? '#fff' : '#555' }}
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
            <div>
              <label style={labelStyle}>DATE OF BIRTH</label>
              <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} style={inputStyle} />
            </div>
          )}

          <div>
            <label style={labelStyle}>DIVISION</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {['Youth', 'Juniors', "Men's", "Women's", 'Masters Men', 'Masters Women', 'Grandmasters Men', 'Grandmasters Women'].map(div => (
                <button key={div} onClick={() => set('division', div)} style={{
                  padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '13px',
                  background: form.division === div ? '#2371BB' : '#111',
                  color: form.division === div ? '#fff' : '#555',
                  border: `1px solid ${form.division === div ? '#2371BB' : '#333'}`,
                }}>{div}</button>
              ))}
            </div>
          </div>

          {isYouthOrJunior && (
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
              disabled={!form.username || !form.division}
              style={{ flex: 2, padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer', background: form.username && form.division ? '#2371BB' : '#222', color: form.username && form.division ? '#fff' : '#555' }}
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
              { field: 'show_division', label: 'Show division', sub: "Men's, Women's or Juniors shown next to your name" },
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
            {form.show_division && <span style={{ color: '#888' }}> · {form.division || 'Division'}</span>}
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
