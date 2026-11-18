// ─── Weekly game notices: what to say, and to whom (pure) ────────────────────
// Phase 2 of weekly games (v0.55.0.0). A kaiwhakawā's notice goes by web push
// to every phone a registered player turned notices on for, and by email to a
// registered player with no phone that took it (none subscribed, or every push
// failed). The send route (app/api/notices/send/route.ts) does the network
// work; the rules are here so they are tested.
//
// No Supabase, React or Node imports.

import { dateLabel, slotLabel, type NoticeKind } from '@/lib/weeklyGames'

/** The `notice` part of notice_recipients(). */
export type NoticeInfo = {
  id: string
  kind: NoticeKind
  message: string | null
  game_date: string
  dow: number
  start_time: string
  site_name: string
}

export type Account = { id: string; email: string | null }
export type PushTarget = { account_id: string; endpoint: string; p256dh: string; auth: string }

/** What notice_recipients() returns. */
export type Recipients = { notice: NoticeInfo; accounts: Account[]; push: PushTarget[] }

export type NoticeText = {
  /** Notification title and email subject's lead. */
  title: string
  /** One or two short sentences. */
  body: string
  subject: string
  /** Where tapping it lands. */
  url: string
}

/** 'today', 'tomorrow' or 'on Sat 21 Nov', for the middle of a sentence. */
export function whenWords(date: string, now: Date): string {
  const d = dateLabel(date, now)
  return d === 'Today' || d === 'Tomorrow' ? d.toLowerCase() : `on ${d}`
}

export function noticeText(n: NoticeInfo, now: Date = new Date()): NoticeText {
  const title = `${slotLabel(n)} · ${n.site_name}`
  const when = whenWords(n.game_date, now)
  const words = (n.message ?? '').trim()
  let body: string
  let lead: string
  switch (n.kind) {
    case 'cancelled':
      lead = 'Cancelled'
      // The kaiwhakawā's default text already says "Cancelled because of
      // rain."; do not say "Cancelled" twice.
      body = words && /^cancel/i.test(words)
        ? `${words.replace(/\.$/, '')} ${when}.`
        : `No game ${when}.${words ? ` ${words}` : ''}`
      break
    case 'on':
      lead = 'Back on'
      body = `The game is back on ${when}.${words ? ` ${words}` : ''}`
      break
    case 'moved':
      lead = 'New place'
      body = `${when.charAt(0).toUpperCase()}${when.slice(1)} the game is at ${words}.`
      break
    default:
      lead = 'Note'
      body = words
  }
  return { title, body, subject: `${lead}: ${title}`, url: '/dashboard' }
}

/**
 * Who gets an email: every account with an address and no push that got
 * through. `pushedOk` holds the accounts at least one phone accepted for.
 */
export function emailTargets(accounts: Account[], pushedOk: ReadonlySet<string>): { id: string; email: string }[] {
  const seen = new Set<string>()
  const out: { id: string; email: string }[] = []
  for (const a of accounts) {
    if (pushedOk.has(a.id) || !a.email || seen.has(a.id)) continue
    seen.add(a.id)
    out.push({ id: a.id, email: a.email })
  }
  return out
}

/** A push service's answer that means "this subscription is gone for good". */
export const isGone = (status: number | undefined) => status === 404 || status === 410

/** Plain-text email: the notice, then why they got it and how to stop. */
export function emailText(t: NoticeText, siteOrigin: string): string {
  return [
    t.body,
    '',
    `${t.title}`,
    `Your weekly games: ${siteOrigin}${t.url}`,
    '',
    'You get this because you joined this weekly game on AllSport. To stop, leave it on HOME, or turn notices on for your phone there and you will get them as notifications instead.',
  ].join('\n')
}

// ── The browser side ────────────────────────────────────────────────────────

export type PushState =
  /** This browser cannot do web push at all. */
  | 'unsupported'
  /** iPhone/iPad Safari: push only works once AllSport is on the Home Screen. */
  | 'ios-install'
  /** The person said no; only the browser's settings can undo it. */
  | 'denied'
  /** Supported and not yet on. */
  | 'off'
  | 'on'

export function pushState(env: {
  hasServiceWorker: boolean
  hasPushManager: boolean
  hasNotification: boolean
  isIOS: boolean
  standalone: boolean
  permission: 'default' | 'granted' | 'denied' | null
  subscribed: boolean
}): PushState {
  // iOS hides PushManager entirely until the site is opened from the Home
  // Screen, so this check comes before the support check.
  if (env.isIOS && !env.standalone) return 'ios-install'
  if (!env.hasServiceWorker || !env.hasPushManager || !env.hasNotification) return 'unsupported'
  if (env.permission === 'denied') return 'denied'
  return env.permission === 'granted' && env.subscribed ? 'on' : 'off'
}

/** The VAPID public key (base64url) as the bytes PushManager.subscribe wants. */
export function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(padded)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
