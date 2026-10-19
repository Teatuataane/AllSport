'use client'
import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'
import GoogleSignInButton from '@/components/GoogleSignInButton'

function PlayPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
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
        <img src="/logo-mark.webp" alt="AllSport" width={133} height={80} style={{ height: '80px', width: 'auto', marginBottom: '12px' }} />
        <div style={{ fontFamily: 'var(--font-display)', fontSize: '36px', letterSpacing: '0.09em' }}>
          ALL<span style={{ color: 'var(--red)' }}>SPORT</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ height: '4px', background: 'var(--rainbow)', borderRadius: '2px 2px 0 0' }} />

        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '28px' }}>

          {/* Google — the primary way in, on both tabs */}
          <div style={{ marginBottom: '16px' }}>
            <GoogleSignInButton
              onSignedIn={({ hasProfile }) => router.push(hasProfile ? dashboardUrl : '/register')}
              onError={setError}
            />
          </div>

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
          AllSport · Ōtautahi, Aotearoa
        </p>
      </div>
    </div>
  )
}

export default function PlayPage() {
  return <Suspense><PlayPageInner /></Suspense>
}
