'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function PlayPage() {
  const router = useRouter()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) throw err
      router.push('/dashboard')
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setGoogleLoading(true)
    setError('')
    try {
      const { error: err } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/auth/callback` }
      })
      if (err) throw err
    } catch (e: any) {
      setError(e.message)
      setGoogleLoading(false)
    }
  }

  const inputStyle = {
    width: '100%', background: '#111', border: '1px solid #333',
    borderRadius: '8px', padding: '14px', color: '#fff',
    fontSize: '15px', boxSizing: 'border-box' as const,
  }
  const labelStyle = { fontSize: '12px', color: '#888', display: 'block', marginBottom: '6px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ marginBottom: '40px', textAlign: 'center' }}>
        <img src="/logo.png" alt="AllSport" style={{ height: '80px', marginBottom: '12px' }} />
        <div style={{ fontFamily: 'var(--font-bebas)', fontSize: '36px', letterSpacing: '4px' }}>
          ALL<span style={{ color: '#EA4742' }}>SPORT</span>
        </div>
      </div>

      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ height: '3px', background: 'linear-gradient(90deg, #EA4742, #F9B051, #F397C0, #B87DB5, #2371BB, #4DB26E)', borderRadius: '2px 2px 0 0' }} />

        <div style={{ background: '#111', border: '1px solid #1e1e1e', borderTop: 'none', borderRadius: '0 0 12px 12px', padding: '28px' }}>
          {/* Tabs */}
          <div style={{ display: 'flex', marginBottom: '24px', background: '#0a0a0a', borderRadius: '8px', padding: '4px' }}>
            {(['login', 'register'] as const).map(m => (
              <button key={m} onClick={() => { setMode(m); setError('') }} style={{
                flex: 1, padding: '10px', border: 'none', borderRadius: '6px', cursor: 'pointer',
                background: mode === m ? '#2371BB' : 'transparent',
                color: mode === m ? '#fff' : '#555',
                fontWeight: 'bold', fontSize: '13px', letterSpacing: '1px',
                fontFamily: 'var(--font-barlow-condensed)',
              }}>
                {m === 'login' ? 'LOG IN' : 'REGISTER'}
              </button>
            ))}
          </div>

          {/* Google button — shown on both tabs */}
          <button onClick={handleGoogle} disabled={googleLoading} style={{
            width: '100%', padding: '13px', borderRadius: '8px', border: '1px solid #333',
            background: '#fff', color: '#000', fontWeight: 'bold', fontSize: '14px',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '10px', marginBottom: '16px', boxSizing: 'border-box' as const,
          }}>
            <svg width="18" height="18" viewBox="0 0 48 48">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              <path fill="none" d="M0 0h48v48H0z"/>
            </svg>
            {googleLoading ? 'Connecting...' : `${mode === 'login' ? 'Log in' : 'Register'} with Google`}
          </button>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: '#222' }} />
            <span style={{ color: '#555', fontSize: '12px' }}>or</span>
            <div style={{ flex: 1, height: '1px', background: '#222' }} />
          </div>

          {mode === 'login' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={labelStyle}>EMAIL</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="your@email.com" style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
              <div>
                <label style={labelStyle}>PASSWORD</label>
                <input
                  type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" style={inputStyle}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
              {error && <p style={{ color: '#EA4742', fontSize: '13px', margin: 0 }}>{error}</p>}
              <button onClick={handleLogin} disabled={!email || !password || loading} style={{
                padding: '14px', borderRadius: '8px', border: 'none', fontWeight: 'bold',
                fontSize: '15px', cursor: 'pointer',
                background: email && password ? '#EA4742' : '#222',
                color: email && password ? '#fff' : '#555',
              }}>
                {loading ? 'Logging in...' : 'Log In →'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
              <p style={{ color: '#888', fontSize: '14px', textAlign: 'center', margin: 0 }}>
                Create your AllSport account to track scores, earn colours, and compete on the leaderboard.
              </p>
              <Link href="/register" style={{
                display: 'block', width: '100%', padding: '14px', borderRadius: '8px',
                background: '#2371BB', color: '#fff', textAlign: 'center',
                textDecoration: 'none', fontWeight: 'bold', fontSize: '15px',
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
