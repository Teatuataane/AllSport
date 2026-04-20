'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'

export default function Login() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError('Incorrect email or password. Please try again.')
    } else {
      router.push('/dashboard')
    }
    setLoading(false)
  }

  const handleGoogle = async () => {
    setLoading(true)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) setError(error.message)
    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    background: '#111111',
    border: '1px solid #2a2a2a',
    color: '#ffffff',
    padding: '14px 16px',
    fontSize: '15px',
    fontFamily: 'Barlow, sans-serif',
    outline: 'none',
    transition: 'border-color 0.2s',
  }

  return (
    <>
      <style>{`input:focus { border-color: #e63946 !important; }`}</style>

      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', background: '#000000', position: 'relative', overflow: 'hidden', paddingTop: '80px' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(230,57,70,0.06) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '48px' }}>
              <div className="tag" style={{ display: 'inline-block' }}>Welcome Back</div>
              <h1 style={{ fontSize: 'clamp(48px, 7vw, 80px)', lineHeight: 0.95, marginBottom: '8px' }}>
                SIGN <span style={{ background: 'linear-gradient(90deg, #e63946, #f4a226)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>IN</span>
              </h1>
              <div className="rainbow-line" style={{ width: '60px', margin: '16px auto 0' }} />
            </div>

            {/* Google */}
            <button onClick={handleGoogle} disabled={loading} style={{ width: '100%', background: '#111111', border: '1px solid #2a2a2a', color: '#ffffff', padding: '16px', fontSize: '16px', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '24px', transition: 'border-color 0.2s' }}>
              <svg width="20" height="20" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
              <div style={{ flex: 1, height: '1px', background: '#1e1e1e' }} />
              <span style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444444' }}>or sign in with email</span>
              <div style={{ flex: 1, height: '1px', background: '#1e1e1e' }} />
            </div>

            {error && (
              <div style={{ background: '#1a0505', border: '1px solid #e6394633', padding: '14px 16px', marginBottom: '20px', color: '#e63946', fontFamily: 'Barlow Condensed, sans-serif', fontSize: '15px' }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '28px' }}>
              <div>
                <label style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#666666', marginBottom: '8px' }}>Email Address</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
              <div>
                <label style={{ display: 'block', fontFamily: 'Barlow Condensed, sans-serif', fontWeight: 700, fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#666666', marginBottom: '8px' }}>Password</label>
                <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Your password" style={inputStyle} onKeyDown={e => e.key === 'Enter' && handleLogin()} />
              </div>
            </div>

            <button onClick={handleLogin} disabled={loading || !email || !password} className="btn btn-primary" style={{ width: '100%', fontSize: '20px', padding: '16px', opacity: loading || !email || !password ? 0.5 : 1, cursor: loading || !email || !password ? 'not-allowed' : 'pointer' }}>
              {loading ? 'Signing in...' : 'Sign In'}
            </button>

            <p style={{ color: '#555555', fontSize: '14px', marginTop: '24px', textAlign: 'center' }}>
              Don't have a profile?{' '}
              <Link href="/register" style={{ color: '#e63946', borderBottom: '1px solid #e63946', paddingBottom: '1px' }}>Register here</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  )
}