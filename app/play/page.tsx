'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

function PlayPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const pendingCode = searchParams.get('code')

  const dashboardUrl = pendingCode ? `/dashboard?code=${pendingCode}` : '/dashboard'

  // Redirect to dashboard if already logged in, preserving any session code
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace(dashboardUrl)
    })
  }, [])

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      router.push(dashboardUrl)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      // Store pending code so /auth/callback can forward it to dashboard
      if (pendingCode) localStorage.setItem('pending_session_code', pendingCode)
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      })
      if (err) throw err
      // signInWithOAuth redirects the browser — googleLoading stays true during redirect
    } catch (e: any) {
      setError(e.message)
      setGoogleLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: 'var(--surface-2)', border: '1px solid var(--border-strong)',
    borderRadius: '10px', padding: '14px', color: 'var(--white)',
    fontSize: '16px', outline: 'none', boxSizing: 'border-box' as const,
    transition: 'border-color 0.2s, box-shadow 0.2s',
  }
  const labelStyle = {
    fontSize: '12px', color: 'var(--grey)', display: 'block', marginBottom: '6px',
    fontFamily: 'var(--font-label)', fontWeight: 600, letterSpacing: '0.12em',
    textTransform: 'uppercase' as const,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--dark)', color: 'var(--white)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <style>{`input:focus { border-color: var(--blue) !important; box-shadow: 0 0 0 3px rgba(35,113,187,0.35); }`}</style>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <img src="/logo.png" alt="AllSport" style={{ height: '80px', marginBottom: '12px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', letterSpacing: '0.09em' }}>
          ALL<span style={{ color: 'var(--red)' }}>SPORT</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ height: '4px', background: 'var(--rainbow)', borderRadius: '2px 2px 0 0' }} />

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '28px' }}>

          {/* Google — the primary way in, on both tabs */}
          <button onClick={handleGoogle} disabled={googleLoading} style={{
            width: '100%', padding: '15px', borderRadius: '999px', border: 'none',
            background: 'var(--white)', color: '#1a1a1a', fontWeight: 700, fontSize: '15px',
            fontFamily: 'var(--font-body)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', marginBottom: '16px', boxSizing: 'border-box' as const,
            boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
            opacity: googleLoading ? 0.7 : 1,
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {googleLoading ? 'Connecting...' : 'Continue with Google'}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-strong)' }} />
            <span style={{ color: '#555', fontSize: '12px', fontFamily: 'var(--font-label)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border-strong)' }} />
          </div>

          {/* Tabs — email paths */}
          <div style={{ display: 'flex', marginBottom: '20px', background: 'var(--dark)', borderRadius: '999px', padding: '4px', border: '1px solid var(--border)' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }} style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '999px', cursor: 'pointer',
                background: mode === m ? 'var(--blue)' : 'transparent',
                color: mode === m ? 'var(--white)' : '#555',
                fontWeight: 700, fontSize: '13px', letterSpacing: '0.08em',
                fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
                transition: 'all 0.15s',
              }}>
                {m === 'login' ? 'Log In' : 'Register'}
              </button>
            ))}
          </div>

          {mode === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div>
                <label style={labelStyle}>Password</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
              {error && <p style={{ color: 'var(--red)', fontSize: '13px', margin: 0 }}>{error}</p>}
              <button onClick={handleLogin} disabled={!email || !password || loading} className="btn btn-primary" style={{
                width: '100%', padding: '14px', fontSize: '15px',
                opacity: email && password ? 1 : 0.4,
                cursor: email && password ? 'pointer' : 'not-allowed',
                boxShadow: email && password ? undefined : 'none',
              }}>
                {loading ? 'Logging in...' : 'Log In →'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <p style={{ color: 'var(--grey)', fontSize: '14px', textAlign: 'center', margin: 0 }}>
                Create your AllSport account to track scores, earn colours, and compete on the leaderboard.
              </p>
              <Link href={pendingCode ? `/register?code=${pendingCode}` : '/register'} className="btn btn-blue" style={{
                display: 'flex', width: '100%', padding: '14px', fontSize: '15px',
                boxSizing: 'border-box' as const,
              }}>
                Create Account with Email →
              </Link>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: '#555', fontSize: '12px', marginTop: '20px' }}>
          AllSport Kura Kaha · Ōtautahi, Aotearoa
        </p>
      </div>
    </div>
  )
}

export default function PlayPage() {
  return <Suspense><PlayPageInner /></Suspense>
}
