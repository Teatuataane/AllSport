// ─── The saved copy of a page ────────────────────────────────────────────────
// Players said pages were slow. Most of the wait is the database (a Nano
// compute the owner keeps on purpose, CLAUDE.md section 4), not the page, so
// the fastest page is one that does not wait for it at all: HOME, the
// leaderboard and My Events draw what the player saw last time AT ONCE, from
// this phone, and swap in the fresh numbers when they arrive. The top loading
// bar (components/LoadingBar.tsx) runs while that refresh is in flight, so a
// player can tell the numbers are being checked.
//
// Rules:
//  - It is a copy, never a source. Nothing is written to the database from it,
//    no colour is conferred from it, and every page still reads fresh data on
//    every visit. A copy older than MAX_AGE_MS, or written by another version
//    of the page (`version`), is ignored.
//  - It lives on the player's own device only, and is wiped on sign out
//    (clearPageCache, called from both sign out buttons) and whenever the
//    browser finds no session, so the next person on a shared phone never
//    sees it.
//  - A bodyweight is private by design (CLAUDE.md section 13). GradeState
//    carries the bodyweight of the day on each graded row (`bodyweightKg`);
//    the encoder drops that key, so no exact weight is ever written here.
//    Nothing the pages draw reads it.
//  - localStorage can throw (private window, blocked site data, full quota).
//    Every read and write is wrapped and fails to "no copy".
//
// Pure apart from localStorage, with no Supabase or React import, so it is
// safe in the global shell (lib/useActivePlayer.ts) and unit-testable.

const PREFIX = 'allsport_saved:'

/** A copy older than this is not worth showing: a month of games has moved on. */
export const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

/** Keys never written to the device. See the header. */
const PRIVATE_KEYS = new Set(['bodyweightKg'])

type Envelope = { v: string; at: number; data: unknown }

/** JSON with Map and Set kept, and private keys dropped. */
export function encodeSaved(value: unknown): string {
  return JSON.stringify(value, (key, v) => {
    if (PRIVATE_KEYS.has(key)) return undefined
    if (v instanceof Map) return { __map: [...v.entries()] }
    if (v instanceof Set) return { __set: [...v.values()] }
    return v
  })
}

export function decodeSaved<T>(text: string): T {
  return JSON.parse(text, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      if (Array.isArray(v.__map) && Object.keys(v).length === 1) return new Map(v.__map)
      if (Array.isArray(v.__set) && Object.keys(v).length === 1) return new Set(v.__set)
    }
    return v
  }) as T
}

/** The saved copy for `key`, or null when there is none worth showing. */
export function readPageCache<T>(key: string, version: string, now = Date.now()): T | null {
  if (typeof window === 'undefined') return null
  try {
    const text = window.localStorage.getItem(PREFIX + key)
    if (!text) return null
    const env = decodeSaved<Envelope>(text)
    if (!env || env.v !== version || typeof env.at !== 'number') return null
    if (now - env.at > MAX_AGE_MS || env.at > now + 60_000) return null
    return env.data as T
  } catch {
    return null
  }
}

export function writePageCache(key: string, version: string, data: unknown, now = Date.now()): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, encodeSaved({ v: version, at: now, data } satisfies Envelope))
  } catch {
    // Full or blocked. The page works without a copy; it is only slower next time.
  }
}

/** Whether any copy is stored under `key`, whatever its version or age. */
export function hasPageCache(key: string): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(PREFIX + key) !== null
  } catch {
    return false
  }
}

/** Wipe every saved copy. Called on sign out and when no session is found. */
export function clearPageCache(): void {
  if (typeof window === 'undefined') return
  try {
    const keys: string[] = []
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i)
      if (k && k.startsWith(PREFIX)) keys.push(k)
    }
    for (const k of keys) window.localStorage.removeItem(k)
  } catch {
    // Nothing to do.
  }
}
