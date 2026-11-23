'use client'

// ─── Real load times from players' phones ────────────────────────────────────
// Vercel Speed Insights (v0.59.0.0): measures how long each page takes to
// appear and respond on the devices players actually use, so speed work rests
// on real numbers rather than a laptop on fast wifi (players said pages were
// slow; v0.57 and v0.58 are the first fixes).
//
// What it sends: the page's route, timings (Core Web Vitals), and the device
// type, browser and country Vercel reads from the request. No cookie, no
// player id, nothing that follows a person between visits. The script and the
// data both go to our own origin (/_vercel/speed-insights/...), so the CSP
// needs no new host.
//
// The query string is cut before anything leaves the page: a join link
// carries a game code (?code=), and an auth link can carry more. Next's
// component already reports dynamic pages by their pattern
// (/games/[sessionId]), so no game or workout id is sent either.
//
// A client wrapper because beforeSend is a function, which the server layout
// cannot hand to a component. It does nothing until Speed Insights is switched
// on for the project in the Vercel dashboard, and nothing in development.

import { SpeedInsights } from '@vercel/speed-insights/next'

export function stripQuery(url: string): string {
  const cut = url.search(/[?#]/)
  return cut === -1 ? url : url.slice(0, cut)
}

export default function SpeedTiming() {
  return <SpeedInsights beforeSend={e => ({ ...e, url: stripQuery(e.url) })} />
}
