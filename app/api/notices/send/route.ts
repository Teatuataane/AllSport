// ─── POST /api/notices/send ──────────────────────────────────────────────────
// Sends one weekly game notice (phase 2, v0.55.0.0). The kaiwhakawā's panel
// saves the notice (it shows on HOME at once), then calls this with its id.
//
//   1. Every phone a registered player turned notices on for gets a web push.
//   2. Every registered player whose phones all failed, or who has none, gets
//      an email instead. A child is reached through their parent's login.
//   3. Push subscriptions the push service says are gone are dropped, and the
//      notice records how many phones and emails it reached.
//
// NO SERVICE KEY. Everything runs under the caller's own login: recipients
// come from notice_recipients(), which refuses anyone but a kaiwhakawā, and
// the record goes through record_notice_sent(), likewise. The caller sends
// only a notice id; the words, the game and the people are all read here.
//
// Each channel needs its secrets on the server, and a missing one is skipped
// and reported, never an error: the notice is already saved and on HOME.
//   web push: NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT
//   email:    RESEND_API_KEY, NOTICE_EMAIL_FROM (an address on a domain
//             verified with Resend, e.g. "AllSport <notices@allsport.nz>")

import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import {
  emailTargets, emailText, isGone, noticeText, type Recipients,
} from '@/lib/noticeDelivery'

export const dynamic = 'force-dynamic'

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: Request) {
  const db = await createSupabaseServerClient()
  // getUser(), not getSession(): a security boundary verifies the token.
  const { data: { user } } = await db.auth.getUser()
  if (!user) return json({ error: 'not signed in' }, 401)

  let noticeId: unknown
  try { noticeId = ((await req.json()) as { noticeId?: unknown }).noticeId } catch { /* checked below */ }
  if (typeof noticeId !== 'string' || !UUID.test(noticeId)) return json({ error: 'noticeId needed' }, 400)

  const { data, error } = await db.rpc('notice_recipients', { p_notice_id: noticeId })
  if (error) {
    if (error.code === '42501') return json({ error: 'kaiwhakawā only' }, 403)
    if (error.code === 'PGRST202' || error.code === '42883') return json({ error: 'sending is not live yet', live: false }, 503)
    return json({ error: 'could not read recipients' }, 500)
  }
  if (!data) return json({ error: 'no such notice' }, 404)
  const r = data as Recipients
  const text = noticeText(r.notice)
  const origin = new URL(req.url).origin

  // ── 1. Web push ────────────────────────────────────────────────────────────
  const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY
  const pushReady = !!(vapidPublic && vapidPrivate)
  const pushedOk = new Set<string>()
  const gone: string[] = []
  let pushCount = 0
  if (pushReady && r.push.length > 0) {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'https://allsport.nz', vapidPublic!, vapidPrivate!)
    const payload = JSON.stringify({ title: text.title, body: text.body, url: text.url, tag: `notice-${r.notice.id}` })
    const results = await Promise.allSettled(r.push.map(p => webpush.sendNotification(
      { endpoint: p.endpoint, keys: { p256dh: p.p256dh, auth: p.auth } },
      payload,
      // A rain call an hour before the game is worthless the next morning.
      { TTL: 6 * 60 * 60, urgency: 'high' },
    )))
    results.forEach((res, i) => {
      const target = r.push[i]
      if (res.status === 'fulfilled') {
        pushCount++
        pushedOk.add(target.account_id)
      } else if (isGone((res.reason as { statusCode?: number })?.statusCode)) {
        gone.push(target.endpoint)
      }
    })
  }

  // ── 2. Email for everyone push did not reach ─────────────────────────────
  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.NOTICE_EMAIL_FROM
  const emailReady = !!(resendKey && from)
  const toEmail = emailTargets(r.accounts, pushedOk)
  let emailCount = 0
  let emailFailed = false
  if (emailReady && toEmail.length > 0) {
    const body = emailText(text, origin)
    // One message per person (never a shared To line), up to 100 per batch.
    for (let i = 0; i < toEmail.length; i += 100) {
      const batch = toEmail.slice(i, i + 100).map(t => ({
        from, to: [t.email], subject: text.subject, text: body,
      }))
      try {
        const res = await fetch('https://api.resend.com/emails/batch', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(batch),
        })
        if (res.ok) emailCount += batch.length
        else emailFailed = true
      } catch {
        emailFailed = true
      }
    }
  }

  // ── 3. Record it ──────────────────────────────────────────────────────────
  await db.rpc('record_notice_sent', {
    p_notice_id: r.notice.id, p_push_count: pushCount, p_email_count: emailCount, p_gone_endpoints: gone,
  })

  return json({
    pushCount, emailCount,
    players: r.accounts.length,
    pushReady, emailReady, emailFailed,
    // Registered players nothing reached: no phone took it and no email went.
    unreached: r.accounts.length - pushedOk.size - emailCount,
  })
}
