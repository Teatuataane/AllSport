'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { GOOGLE_CLIENT_ID, GSI_SCRIPT_URL, makeNonce } from '@/lib/googleSignIn'

/**
 * "Continue with Google", drawn by Google's own sign-in library.
 *
 * Why not supabase.auth.signInWithOAuth: that sends the player through
 * Supabase's auth server, so Google's account chooser says "continue to
 * pvutdyosuhpwnklrpczu.supabase.co". Players asked whether that was a scam.
 * Here the Google popup is opened from allsport.nz, so Google names our site,
 * and the ID token it returns is handed to Supabase with signInWithIdToken.
 * The session lands in the same cookies as before; nothing else changes.
 *
 * If Google's script cannot load (blocked, offline, slow), the old redirect
 * button is shown instead, so sign-in never disappears.
 */

type GoogleCredentialResponse = { credential: string }
type GoogleId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    nonce: string
    ux_mode: 'popup'
    auto_select: boolean
    itp_support: boolean
    context: 'signin' | 'signup' | 'use'
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      type: 'standard'
      theme: 'outline' | 'filled_blue' | 'filled_black'
      size: 'large'
      shape: 'pill'
      text: 'continue_with' | 'signin_with' | 'signup_with'
      logo_alignment: 'center' | 'left'
      width: number
    },
  ) => void
}
declare global {
  interface Window { google?: { accounts: { id: GoogleId } } }
}

// One load per page view, shared by every button.
let scriptPromise: Promise<GoogleId> | null = null
function loadGoogle(): Promise<GoogleId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GSI_SCRIPT_URL
    script.async = true
    script.onload = () =>
      window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('no gsi'))
    script.onerror = () => reject(new Error('gsi failed to load'))
    document.head.appendChild(script)
    setTimeout(() => reject(new Error('gsi timed out')), 8000)
  }).catch(err => {
    scriptPromise = null
    throw err
  })
  return scriptPromise
}

export type GoogleSignedIn = { userId: string; hasProfile: boolean }

export default function GoogleSignInButton({
  onSignedIn,
  onError,
  context = 'signin',
}: {
  /** Called once Supabase holds the session. hasProfile = a players row exists. */
  onSignedIn: (result: GoogleSignedIn) => void
  onError: (message: string) => void
  context?: 'signin' | 'signup'
}) {
  const holder = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'fallback' | 'working'>('loading')
  const [redirecting, setRedirecting] = useState(false)
  // Kept in refs so the Google callback, registered once, always sees the
  // latest handlers from the page.
  const signedIn = useRef(onSignedIn)
  const failed = useRef(onError)
  useEffect(() => {
    signedIn.current = onSignedIn
    failed.current = onError
  })

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()

    ;(async () => {
      try {
        const [google, nonce] = await Promise.all([loadGoogle(), makeNonce()])
        if (cancelled || !holder.current) return
        google.initialize({
          client_id: GOOGLE_CLIENT_ID,
          nonce: nonce.hashed,
          ux_mode: 'popup',
          auto_select: false,
          itp_support: true,
          context,
          callback: async ({ credential }) => {
            setState('working')
            const { data, error } = await supabase.auth.signInWithIdToken({
              provider: 'google',
              token: credential,
              nonce: nonce.raw,
            })
            if (error || !data.user) {
              setState('ready')
              failed.current(error?.message ?? 'Google sign-in failed. Please try again.')
              return
            }
            const { data: existing } = await supabase
              .from('players')
              .select('id')
              .eq('id', data.user.id)
              .maybeSingle()
            signedIn.current({ userId: data.user.id, hasProfile: !!existing })
          },
        })
        // Google's button has a fixed width in pixels (200 to 400).
        const width = Math.max(200, Math.min(400, Math.floor(holder.current.offsetWidth)))
        google.renderButton(holder.current, {
          type: 'standard',
          theme: 'outline',
          size: 'large',
          shape: 'pill',
          text: 'continue_with',
          logo_alignment: 'center',
          width,
        })
        setState('ready')
      } catch {
        if (!cancelled) setState('fallback')
      }
    })()

    return () => { cancelled = true }
  }, [context])

  const redirectFallback = async () => {
    setRedirecting(true)
    const { error } = await createClient().auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { failed.current(error.message); setRedirecting(false) }
  }

  if (state === 'fallback') {
    return (
      <button
        onClick={redirectFallback}
        disabled={redirecting}
        style={{
          width: '100%', background: 'var(--white)', border: 'none',
          color: '#1a1a1a', padding: '14px', fontSize: '15px',
          fontFamily: 'var(--font-body)', fontWeight: 700, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px',
          borderRadius: '999px', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
          opacity: redirecting ? 0.7 : 1, boxSizing: 'border-box',
        }}
      >
        <GoogleIcon />
        {redirecting ? 'Redirecting...' : 'Continue with Google'}
      </button>
    )
  }

  return (
    <div style={{ position: 'relative', minHeight: '44px' }}>
      <div
        ref={holder}
        style={{
          width: '100%', display: 'flex', justifyContent: 'center',
          // Dim Google's button while Supabase takes the token.
          opacity: state === 'working' ? 0.4 : 1,
          pointerEvents: state === 'working' ? 'none' : 'auto',
        }}
      />
      {state !== 'ready' && (
        <div
          aria-live="polite"
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: 'var(--grey)', fontFamily: 'var(--font-label)',
            fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase',
          }}
        >
          {state === 'working' ? 'Signing in...' : 'Loading Google...'}
        </div>
      )}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
