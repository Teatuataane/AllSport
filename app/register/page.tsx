'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import type { User } from '@supabase/supabase-js'
import GoogleSignInButton from '@/components/GoogleSignInButton'

function calculateAge(dob: string): number {
  const today = new Date()
  const birth = new Date(dob)
  let age = today.getFullYear() - birth.getFullYear()
  const m = today.getMonth() - birth.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--
  return age
}

// `gender` is collected for two purposes, both stated in /privacy: choosing a
// competition division, and choosing which grade standards apply where an event
// has separate men's and women's standards. Juniors share one division, so for
// them only the second applies. It used to be labelled "Gender" and "Other" silently produced a
// men's division, which asks a personal question and then quietly answers it
// on the player's behalf. Anyone who does not pick Male or Female now chooses
// their own starting division, and a kaiwhakawā can move anyone at any time.
//
// Age is not a division (Tāne, 20 Oct 2026): Masters and Grandmaster are gone,
// and the age allowance lives in the colour standards, read from the date of
// birth. Juniors are everyone who turns 16 or under THIS year, the same one
// age per year the standards use; a daily job moves them to Men's or Women's
// in the year they turn 17.
function calculateDivision(dob: string, gender: string, preferred: string): string {
  if (ageThisYear(dob) <= 16) return 'Juniors'
  const womens = gender === 'Female' || (gender === 'Other' && preferred === "Women's")
  return womens ? "Women's" : "Men's"
}

/** The age a player turns this calendar year, birthday or not. */
function ageThisYear(dob: string): number {
  return new Date().getFullYear() - Number(dob.slice(0, 4))
}

const STEP_NAMES = ['Account Details', 'Your Profile', 'Display Preferences']

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

  const adoptSession = (u: User) => {
    setExistingUserId(u.id)
    setForm(prev => ({
      ...prev,
      email: u.email ?? prev.email,
      full_name: u.user_metadata?.full_name ?? u.user_metadata?.name ?? prev.full_name,
    }))
    setStep(2)
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) adoptSession(session.user)
    })
  }, [])

  const [form, setForm] = useState({
    full_name: '',
    email: '',
    password: '',
    phone: '',
    date_of_birth: '',
    gender: '' as 'Male' | 'Female' | 'Other' | '',
    // Only used when gender is 'Other' — the division that player picks for
    // themselves rather than one being assumed for them. Not stored: it feeds
    // `division`, which is what the DB actually keeps.
    division_preference: '' as "Men's" | "Women's" | '',
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

  // Juniors are Juniors regardless, so a division resolves without needing
  // the extra pick. Everyone else who chose 'Other' must choose a division.
  const needsDivisionPick =
    form.gender === 'Other' && !!form.date_of_birth && ageThisYear(form.date_of_birth) > 16

  const division = form.date_of_birth && form.gender && (!needsDivisionPick || form.division_preference)
    ? calculateDivision(form.date_of_birth, form.gender, form.division_preference)
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
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
    borderRadius: '10px', padding: '13px 14px', color: 'var(--white)',
    fontSize: '16px', outline: 'none', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  const labelStyle = {
    fontSize: '12px', color: 'var(--grey)', display: 'block', marginBottom: '6px',
    fontFamily: 'var(--font-label)', fontWeight: 600, letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  }
  const sectionStyle = { display: 'flex', flexDirection: 'column' as const, gap: '16px' }
  const genderBtnStyle = (active: boolean) => ({
    flex: 1, padding: '11px', borderRadius: '999px', cursor: 'pointer',
    fontWeight: 700, fontSize: '13px', letterSpacing: '0.06em',
    fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
    background: active ? 'var(--blue)' : 'var(--surface)',
    color: active ? 'var(--white)' : '#555',
    border: `1px solid ${active ? 'var(--blue)' : 'var(--border-strong)'}`,
    transition: 'all 0.15s',
  })
  const backBtnStyle = {
    flex: 1, padding: '14px', borderRadius: '999px', border: '1px solid var(--border-strong)',
    background: 'transparent', color: 'var(--grey)', cursor: 'pointer', fontWeight: 600,
    fontFamily: 'var(--font-label)', fontSize: '14px', letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
  }
  const nextBtnStyle = (enabled: boolean) => ({
    flex: 2, padding: '14px', borderRadius: '999px', border: 'none', fontWeight: 600,
    fontSize: '14px', letterSpacing: '0.06em', cursor: enabled ? 'pointer' : 'not-allowed',
    fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
    background: enabled ? 'var(--blue)' : '#222',
    color: enabled ? 'var(--white)' : '#555',
    boxShadow: enabled ? 'var(--glow-blue)' : 'none',
    transition: 'all 0.15s',
  })

  if (needsEmailConfirm) return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--white)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ width: 48, height: 4, borderRadius: 3, background: 'var(--rainbow)', margin: '0 auto 20px' }} />
        <h2 style={{ color: 'var(--amber)', fontSize: '30px', marginBottom: '12px' }}>Check your email</h2>
        <p style={{ color: 'var(--grey)', marginBottom: '8px' }}>We sent a confirmation link to <strong style={{ color: 'var(--white)' }}>{form.email}</strong>.</p>
        <p style={{ color: 'var(--grey)', marginBottom: '24px' }}>Click that link, then come back to log in and join the session.</p>
        <a href="/login" className="btn btn-blue" style={{ fontSize: '15px' }}>Go to Login</a>
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#444' }}>
          Tip: ask the Kaiwhakawā to disable email confirmation in Supabase to skip this step.
        </div>
      </div>
    </div>
  )

  // Asked on step 1 for email sign-ups and on step 2 for Google ones (who skip
  // step 1). One copy, so the Google path gets the "Another answer" division
  // pick too: it used to ask only Male/Female/Other with no pick.
  const divisionQuestion = (
    <div>
      <label style={labelStyle}>Which division do you compete in?</label>
      <div style={{ display: 'flex', gap: '8px' }}>
        {([['Male', "Men's"], ['Female', "Women's"], ['Other', 'Another answer']] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => set('gender', value)}
            style={genderBtnStyle(form.gender === value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: '#555', marginTop: '6px', lineHeight: 1.6 }}>
        This is the only thing we use it for. Your age allowance on the colour standards
        is worked out from your date of birth.
      </div>
      {needsDivisionPick && (
        <div style={{ marginTop: '10px', background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '10px', padding: '12px 14px' }}>
          <div style={{ fontSize: '12px', color: 'var(--grey-light)', marginBottom: '8px', lineHeight: 1.6 }}>
            Which division would you like to start in? A kaiwhakawā can move you at any time,
            before or after your first session.
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {(["Men's", "Women's"] as const).map(d => (
              <button
                key={d}
                onClick={() => set('division_preference', d)}
                style={genderBtnStyle(form.division_preference === d)}
              >
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  // full_name is deliberately NOT required. It is only used for insurance and
  // safeguarding, most players compete under a username, and asking for a legal
  // name as a condition of playing a koha-based community sport collects more
  // than the sport needs.
  const step1Valid = !!(form.email && form.password && form.date_of_birth && form.gender && division)
  // Google sign-ups give their date of birth and division on step 2, so it must
  // insist on a division as step 1 does. It used to check only the username,
  // which let a Google player reach "Create account" with no division and fail
  // players_division_check on an empty string (reported 19 Oct 2026).
  const step2Valid = !!(form.username && division)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--white)', padding: '24px', maxWidth: '560px', margin: '0 auto' }}>
      <style>{`input:focus { border-color: var(--blue) !important; box-shadow: 0 0 0 3px rgba(35,113,187,0.35); }`}</style>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '44px', marginBottom: '2px' }}>
          REGIS<span style={{ color: 'var(--red)' }}>TER</span>
        </h1>
        <p style={{ color: 'var(--grey)', fontSize: '14px' }}>Join AllSport — koha only, everyone welcome</p>
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          {[1, 2, 3].map(s => (
            <div key={s} style={{ flex: 1, height: '4px', borderRadius: '2px', background: step >= s ? 'var(--rainbow)' : '#222' }} />
          ))}
        </div>
        <div style={{ fontSize: '12px', color: '#555', marginTop: '8px', fontFamily: 'var(--font-label)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
          Step {step} of 3 — {STEP_NAMES[step - 1]}
        </div>
      </div>

      {/* Step 1 — Account */}
      {step === 1 && (
        <div style={sectionStyle}>
          {/* Google — quickest path */}
          <GoogleSignInButton
            context="signup"
            onSignedIn={({ hasProfile }) => {
              if (hasProfile) { router.push('/dashboard'); return }
              // New Google player: same as arriving here signed in (the
              // effect above), straight on to step 2 with name and email filled.
              supabase.auth.getSession().then(({ data: { session } }) => {
                if (session?.user) adoptSession(session.user)
              })
            }}
            onError={setError}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-strong)' }} />
            <span style={{ fontSize: '11px', color: '#444', fontFamily: 'var(--font-label)', letterSpacing: '0.12em' }}>OR REGISTER WITH EMAIL</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-strong)' }} />
          </div>

          <div>
            <label style={labelStyle}>Full Name <span style={{ color: '#555', fontWeight: 400 }}>— optional</span></label>
            <input value={form.full_name} onChange={e => set('full_name', e.target.value)} style={inputStyle} placeholder="Your legal name" />
            <div style={{ fontSize: '11px', color: '#555', marginTop: '4px', lineHeight: 1.6 }}>
              Only used for insurance and safeguarding records, and to know who you are at a session.
              It is never shown to other players unless you turn it on. You can play under a username instead.
            </div>
          </div>
          <div>
            <label style={labelStyle}>Email</label>
            <input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={inputStyle} placeholder="your@email.com" />
          </div>
          <div>
            <label style={labelStyle}>Password</label>
            <input type="password" value={form.password} onChange={e => set('password', e.target.value)} style={inputStyle} placeholder="Min 6 characters" />
          </div>
          <div>
            <label style={labelStyle}>Date of Birth</label>
            <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} style={inputStyle} />
          </div>
          {divisionQuestion}
          <div>
            <label style={labelStyle}>Phone</label>
            <input value={form.phone} onChange={e => set('phone', e.target.value)} style={inputStyle} placeholder="+64 21 000 0000" />
          </div>

          {/* Show calculated division preview. Gated on `division` rather than
              its inputs: someone who picked "Another answer" has no division
              until they choose one, and an empty "Division:" reads as broken. */}
          {division && (
            <div style={{ background: 'rgba(35,113,187,0.08)', border: '1px solid var(--blue)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: 'var(--grey)' }}>
              Division: <strong style={{ color: 'var(--white)' }}>{division}</strong>
              <span style={{ marginLeft: '8px', color: '#556', fontSize: '11px' }}>from your answer above and your age</span>
            </div>
          )}

          <button onClick={() => setStep(2)} disabled={!step1Valid} style={nextBtnStyle(step1Valid)}>
            Next →
          </button>
        </div>
      )}

      {/* Step 2 — Profile */}
      {step === 2 && (
        <div style={sectionStyle}>
          <div>
            <label style={labelStyle}>Username / Handle</label>
            <input value={form.username} onChange={e => set('username', e.target.value)} style={inputStyle} placeholder="How you'll appear on leaderboards" />
            <div style={{ fontSize: '11px', color: '#555', marginTop: '4px' }}>This is how other players will see you by default</div>
          </div>

          {existingUserId && (
            <>
              <div>
                <label style={labelStyle}>Date of Birth</label>
                <input type="date" value={form.date_of_birth} onChange={e => set('date_of_birth', e.target.value)} style={inputStyle} />
              </div>
              {divisionQuestion}
            </>
          )}

          {/* Division — read only, calculated from step 1 data */}
          {division && (
            <div>
              <label style={labelStyle}>Division</label>
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border-strong)', borderRadius: '10px', padding: '12px 14px', fontSize: '14px', color: 'var(--white)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{division}</span>
                <span style={{ fontSize: '11px', color: '#444' }}>calculated automatically</span>
              </div>
            </div>
          )}

          {isMinor && (
            <div style={{ background: 'rgba(35,113,187,0.08)', border: '1px solid var(--blue)', borderRadius: '12px', padding: '16px' }}>
              <div style={{ color: 'var(--blue)', fontWeight: 'bold', marginBottom: '12px', fontSize: '14px', fontFamily: 'var(--font-label)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Parent / Guardian Details Required</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>Parent Name</label>
                  <input value={form.parent_name} onChange={e => set('parent_name', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Parent Email</label>
                  <input value={form.parent_email} onChange={e => set('parent_email', e.target.value)} style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Parent Phone</label>
                  <input value={form.parent_phone} onChange={e => set('parent_phone', e.target.value)} style={inputStyle} />
                </div>
              </div>
            </div>
          )}

          <div>
            <label style={labelStyle}>City</label>
            <input value={form.city} onChange={e => set('city', e.target.value)} style={inputStyle} placeholder="Ōtautahi" />
          </div>
          <div>
            <label style={labelStyle}>Region</label>
            <input value={form.region} onChange={e => set('region', e.target.value)} style={inputStyle} placeholder="Canterbury" />
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(1)} style={backBtnStyle}>← Back</button>
            <button onClick={() => setStep(3)} disabled={!step2Valid} style={nextBtnStyle(step2Valid)}>
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Step 3 — Display preferences */}
      {step === 3 && (
        <div style={sectionStyle}>
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '12px', padding: '16px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px', fontSize: '15px' }}>What appears on leaderboards?</div>
            <div style={{ fontSize: '12px', color: '#555', marginBottom: '16px' }}>Choose what other players and the public can see about you</div>

            {[
              { field: 'show_username', label: 'Show username / handle', sub: 'Recommended — lets people know who you are without revealing personal details' },
              { field: 'show_full_name', label: 'Show full name', sub: 'Your legal name will be visible on public leaderboards' },
              { field: 'show_division', label: 'Show division', sub: 'Shows your division (Men, Women or Junior) next to your name. You are ranked in your division either way' },
            ].map(({ field, label, sub }) => (
              <label key={field} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={form[field as keyof typeof form] as boolean}
                  onChange={e => set(field, e.target.checked)}
                  style={{ width: '18px', height: '18px', accentColor: 'var(--blue)', marginTop: '2px', flexShrink: 0 }}
                />
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#555', marginTop: '2px' }}>{sub}</div>
                </div>
              </label>
            ))}
          </div>

          <div style={{ background: 'rgba(77,178,110,0.08)', border: '1px solid var(--green)', borderRadius: '10px', padding: '12px 16px', fontSize: '13px', color: 'var(--green)' }}>
            You&apos;ll appear as: <strong>{form.show_full_name ? form.full_name : form.username || 'your username'}</strong>
            {form.show_division && division && <span style={{ color: 'var(--grey)' }}> · {division}</span>}
          </div>

          {error && <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0 }}>{error}</p>}

          <p style={{ fontSize: '12px', color: '#666', lineHeight: 1.7, margin: 0 }}>
            Your scores and display name are public on leaderboards. Your email, phone and date of birth
            are not shown anywhere on the site. Read the{' '}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--grey-light)', textDecoration: 'underline' }}>
              privacy policy
            </a>{' '}
            for what we collect and why.
          </p>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setStep(2)} style={backBtnStyle}>← Back</button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              style={{
                flex: 2, padding: '14px', borderRadius: '999px', border: 'none', fontWeight: 600,
                fontSize: '14px', letterSpacing: '0.06em', cursor: 'pointer',
                fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
                background: 'var(--red)', color: 'var(--white)', boxShadow: 'var(--glow-red)',
                opacity: loading ? 0.7 : 1,
              }}
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
