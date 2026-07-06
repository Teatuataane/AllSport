'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { useRouter } from 'next/navigation'
import { RainbowText } from '@/components/ui'

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function Login() {
  const router = useRouter()
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [loginMode, setLoginMode] = useState<'password' | 'magic'>('password')
  const [magicLinkSent, setMagicLinkSent] = useState(false)

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

  const handleMagicLink = async () => {
    if (!email) { setError('Enter your email above first.'); return }
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setError(error.message)
    } else {
      setMagicLinkSent(true)
    }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%',
    background: 'var(--surface-2)',
    border: '1px solid var(--border-strong)',
    color: 'var(--white)',
    padding: '14px 16px',
    fontSize: '16px',
    fontFamily: 'var(--font-body)',
    outline: 'none',
    borderRadius: '10px',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  }

  return (
    <>
      <style>{`input:focus { border-color: var(--blue) !important; box-shadow: 0 0 0 3px rgba(35,113,187,0.35); }`}</style>

      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', background: 'var(--black)', position: 'relative', overflow: 'hidden', paddingTop: '80px', paddingBottom: '40px' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(#141414 1px, transparent 1px), linear-gradient(90deg, #141414 1px, transparent 1px)', backgroundSize: '80px 80px', opacity: 0.5 }} />
        <div style={{ position: 'absolute', top: '20%', right: '10%', width: '400px', height: '400px', background: 'radial-gradient(circle, rgba(234,71,66,0.07) 0%, transparent 70%)', pointerEvents: 'none' }} />

        <div className="container" style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ maxWidth: '480px', margin: '0 auto' }}>

            <div style={{ textAlign: 'center', marginBottom: '40px' }}>
              <div className="tag" style={{ display: 'inline-flex' }}>Welcome Back</div>
              <h1 style={{ fontSize: 'clamp(48px, 7vw, 80px)', lineHeight: 0.95, marginBottom: '8px' }}>
                SIGN <RainbowText>IN</RainbowText>
              </h1>
              <div className="rainbow-line" style={{ width: '60px', margin: '16px auto 0', borderRadius: '2px' }} />
            </div>

            {/* Google — primary action */}
            <button
              onClick={handleGoogle}
              disabled={loading}
              style={{
                width: '100%', background: 'var(--white)', border: 'none',
                color: '#1a1a1a', padding: '16px', fontSize: '16px',
                fontFamily: 'var(--font-body)', fontWeight: 700,
                letterSpacing: '0.02em', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px',
                marginBottom: '16px', borderRadius: '999px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
                opacity: loading ? 0.7 : 1,
                transition: 'opacity 0.2s, transform 0.15s',
              }}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px' }}>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
              <span style={{ fontFamily: 'var(--font-label)', fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#444444' }}>or</span>
              <div style={{ flex: 1, height: '1px', background: 'var(--border)' }} />
            </div>

            {/* Mode toggle */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', background: 'var(--dark)', padding: '4px', borderRadius: '999px', border: '1px solid var(--border)' }}>
              {(['password', 'magic'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => { setLoginMode(mode); setError(''); setMagicLinkSent(false) }}
                  style={{
                    flex: 1, padding: '10px', border: 'none', borderRadius: '999px', cursor: 'pointer',
                    fontFamily: 'var(--font-label)', fontSize: '13px',
                    fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
                    background: loginMode === mode ? 'var(--border)' : 'transparent',
                    color: loginMode === mode ? 'var(--white)' : '#555',
                    transition: 'all 0.15s',
                  }}
                >
                  {mode === 'password' ? 'Password' : 'Email Link'}
                </button>
              ))}
            </div>

            {error && (
              <div style={{ background: '#1a0505', border: '1px solid rgba(234,71,66,0.3)', padding: '14px 16px', marginBottom: '20px', color: 'var(--red)', fontFamily: 'var(--font-label)', fontSize: '15px', borderRadius: '8px' }}>
                {error}
              </div>
            )}

            {/* Email field — shared between modes */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#666666', marginBottom: '8px' }}>Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                style={inputStyle}
                onKeyDown={e => e.key === 'Enter' && (loginMode === 'password' ? handleLogin() : handleMagicLink())}
              />
            </div>

            {/* Password mode */}
            {loginMode === 'password' && (
              <>
                <div style={{ marginBottom: '28px' }}>
                  <label style={{ display: 'block', fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#666666', marginBottom: '8px' }}>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Your password"
                    style={inputStyle}
                    onKeyDown={e => e.key === 'Enter' && handleLogin()}
                  />
                </div>
                <button
                  onClick={handleLogin}
                  disabled={loading || !email || !password}
                  className="btn btn-primary"
                  style={{ width: '100%', fontSize: '17px', padding: '16px', opacity: loading || !email || !password ? 0.5 : 1, cursor: loading || !email || !password ? 'not-allowed' : 'pointer' }}
                >
                  {loading ? 'Signing in...' : 'Sign In'}
                </button>
              </>
            )}

            {/* Magic link mode */}
            {loginMode === 'magic' && (
              magicLinkSent ? (
                <div style={{ textAlign: 'center', padding: '24px 0' }}>
                  <div style={{ width: 40, height: 4, borderRadius: 3, background: 'var(--rainbow)', margin: '0 auto 16px' }} />
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: '24px', color: 'var(--green)', letterSpacing: '0.05em', marginBottom: '8px' }}>Check your email</div>
                  <p style={{ color: 'var(--grey)', fontSize: '14px', fontFamily: 'var(--font-body)', lineHeight: 1.5 }}>
                    We sent a sign-in link to <strong style={{ color: 'var(--white)' }}>{email}</strong>. Click it to sign in — no password needed.
                  </p>
                  <button
                    onClick={() => { setMagicLinkSent(false); setEmail('') }}
                    style={{ marginTop: '16px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontFamily: 'var(--font-label)', fontSize: '13px', letterSpacing: '0.05em' }}
                  >
                    Use a different email
                  </button>
                </div>
              ) : (
                <>
                  <p style={{ color: '#666', fontSize: '13px', fontFamily: 'var(--font-body)', marginBottom: '20px', lineHeight: 1.5 }}>
                    We&apos;ll email you a one-time link. Tap it to sign in — no password ever needed.
                  </p>
                  <button
                    onClick={handleMagicLink}
                    disabled={loading || !email}
                    className="btn btn-primary"
                    style={{ width: '100%', fontSize: '16px', padding: '16px', opacity: loading || !email ? 0.5 : 1, cursor: loading || !email ? 'not-allowed' : 'pointer' }}
                  >
                    {loading ? 'Sending...' : 'Send Login Link'}
                  </button>
                </>
              )
            )}

            <p style={{ color: '#555555', fontSize: '14px', marginTop: '24px', textAlign: 'center' }}>
              Don&apos;t have a profile?{' '}
              <Link href="/register" style={{ color: 'var(--red)', borderBottom: '1px solid var(--red)', paddingBottom: '1px' }}>Register here</Link>
            </p>
          </div>
        </div>
      </section>
    </>
  )
}
