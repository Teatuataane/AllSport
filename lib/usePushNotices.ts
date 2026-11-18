'use client'

// ─── This phone's weekly game notices ────────────────────────────────────────
// Works out whether this browser can take push notices, and turns them on or
// off: register /sw.js, ask permission, subscribe with the VAPID public key,
// and hand the subscription to save_push_subscription() (migration
// 20261118234820). The rules are in lib/noticeDelivery.ts (pushState).
//
// A subscription belongs to the signed-in LOGIN, not the profile on screen: a
// parent's phone gets their children's notices because the send route reaches
// a child through the parent.
//
// Null state = not offered at all: no VAPID key configured yet, or still
// checking.

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { pushState, urlBase64ToUint8Array, type PushState } from '@/lib/noticeDelivery'

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ''

function readEnv(subscribed: boolean): PushState {
  const nav = navigator as Navigator & { standalone?: boolean }
  const ua = navigator.userAgent
  // iPadOS reports as a Mac; a touch Mac is an iPad.
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const standalone = nav.standalone === true || window.matchMedia?.('(display-mode: standalone)').matches === true
  return pushState({
    hasServiceWorker: 'serviceWorker' in navigator,
    hasPushManager: 'PushManager' in window,
    hasNotification: 'Notification' in window,
    isIOS, standalone,
    permission: 'Notification' in window ? Notification.permission : null,
    subscribed,
  })
}

async function currentSubscription(): Promise<PushSubscription | null> {
  if (!('serviceWorker' in navigator)) return null
  const reg = await navigator.serviceWorker.getRegistration('/')
  return (await reg?.pushManager.getSubscription()) ?? null
}

export function usePushNotices(): {
  state: PushState | null
  busy: boolean
  error: string
  turnOn: () => Promise<void>
  turnOff: () => Promise<void>
} {
  const [state, setState] = useState<PushState | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return
    let cancelled = false
    currentSubscription()
      .then(sub => { if (!cancelled) setState(readEnv(!!sub)) })
      .catch(() => { if (!cancelled) setState(readEnv(false)) })
    return () => { cancelled = true }
  }, [])

  const turnOn = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') { setState(readEnv(false)); return }
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription())
        ?? await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
        })
      const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
      const { error: e } = await createClient().rpc('save_push_subscription', {
        p_endpoint: json.endpoint, p_p256dh: json.keys?.p256dh, p_auth: json.keys?.auth,
      })
      if (e) {
        await sub.unsubscribe().catch(() => {})
        setError('Notices could not be turned on. Try again.')
        setState(readEnv(false))
        return
      }
      setState(readEnv(true))
    } catch {
      setError('Notices could not be turned on on this phone.')
      setState(readEnv(false))
    } finally {
      setBusy(false)
    }
  }, [])

  const turnOff = useCallback(async () => {
    setBusy(true)
    setError('')
    try {
      const sub = await currentSubscription()
      if (sub) {
        await createClient().from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        await sub.unsubscribe()
      }
      setState(readEnv(false))
    } catch {
      setError('Could not turn notices off. Try again.')
    } finally {
      setBusy(false)
    }
  }, [])

  return { state, busy, error, turnOn, turnOff }
}
