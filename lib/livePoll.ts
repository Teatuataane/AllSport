// ─── Background checks, kept cheap ───────────────────────────────────────────
// Second Disk IO warning, 11 Nov 2026. Measured on the server: about 430 MB of
// RAM, most of Supabase's own services in swap, and the system disk reading
// ~4 MB a second on a quiet weekday while Postgres itself read almost nothing.
// Every request wakes PostgREST and a Postgres connection out of swap, and a
// steady trickle keeps PostgREST's idle connections from ever closing. Half of
// the app's ~2,800 requests a day were the "is a game on?" checks: the navbar
// asked every 60s even in a hidden tab (a phone in a pocket asked all day), and
// each check first called close_expired_sessions(), a write transaction that
// pg_cron already runs every 5 minutes.
//
// So: checks run only while the page is visible, and expiry is read from
// started_at here instead of asking the server to close games first.

/** A game is 100 minutes; the database closes it from started_at the same way. */
const GAME_MS = 100 * 60 * 1000

export type LiveSessionRow = { is_active?: boolean | null; started_at: string | null }

/**
 * Is this session still a game a player can join? Open, and either not started
 * yet or inside its 100 minutes. A game past its time but not yet closed by
 * pg_cron (up to 5 minutes) reads as over, which is what the RPC used to make
 * true before the read.
 */
export function isLiveSession(s: LiveSessionRow | null | undefined, now: number = Date.now()): boolean {
  if (!s || s.is_active === false) return false
  if (!s.started_at) return true
  const start = new Date(s.started_at).getTime()
  if (Number.isNaN(start)) return true
  return now < start + GAME_MS
}

/**
 * Runs `check` now, then every `ms` while the page is visible, and once more
 * the moment a hidden page is shown again. A hidden tab makes no requests.
 * Returns the cleanup for a useEffect.
 */
export function pollWhileVisible(check: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setInterval> | undefined
  const start = () => { if (!timer) timer = setInterval(check, ms) }
  const stop = () => { if (timer) { clearInterval(timer); timer = undefined } }
  const onVisibility = () => {
    if (document.visibilityState === 'visible') { check(); start() } else stop()
  }
  check()
  if (document.visibilityState === 'visible') start()
  document.addEventListener('visibilitychange', onVisibility)
  return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
}
