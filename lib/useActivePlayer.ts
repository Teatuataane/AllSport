'use client'

// ─── The active player ───────────────────────────────────────────────────────
// One hook over `allsport_active_player_id`, so every per-player surface agrees
// on whose numbers it is showing.
//
// THE BUG THIS EXISTS TO FIX: the key has been written by /profile since May
// 2026, but ONLY /dashboard ever read it. A parent switched to their child,
// tapped Personal Bests, and silently saw their own — no error, no empty state,
// just the wrong person's data under the child's name. Anything that renders
// per-player data reads this hook now.
//
// RLS shapes what is possible here. `players` SELECT is own row, your children
// (`parent_id = auth.uid()`), or kaiwhakawā via `public.is_judge()`. So the
// family query below returns rows for a parent and nothing for anyone else,
// which is exactly the guard we want — but it is a SILENT guard, because RLS
// returns zero rows rather than an error. `resolveActiveId` therefore refuses a
// stored id that is not in the household rather than trusting localStorage,
// which anyone can edit from a console.

import { useCallback, useEffect, useState } from 'react'
import { hasAuthCookie } from '@/lib/authCookie'
import {
  ACTIVE_PLAYER_KEY, resolveActiveId, playerLabel, type ActivePlayerRow,
} from '@/lib/activePlayer'

// Imported dynamically, NOT at module scope. This hook is reached from the
// global shell (Navbar -> useNavState -> here), so a static import would put
// the Supabase client and its realtime stack into every page's bundle — see
// lib/authCookie.ts for the measurement. Logged-out visitors never load it.
const supabaseModule = () => import('@/lib/supabase-browser')

// Re-exported so callers have one import for the whole feature. The definitions
// live in lib/activePlayer.ts, which has no Supabase client at module scope and
// is therefore unit-testable.
export { ACTIVE_PLAYER_KEY, resolveActiveId, playerLabel }
export type { ActivePlayerRow }

/** The columns every consumer needs. Kept in one place so a schema change is one edit. */
const FAMILY_COLUMNS = 'id, full_name, display_name, username, division, date_of_birth, icon'

// ── Cross-component sync ─────────────────────────────────────────────────────
// Two mounted consumers (the page and the tab strip) must not disagree. React
// state alone would leave the strip showing Felix while the page showed Tāne,
// because each copy owns its own useState. A module-level value plus a listener
// set keeps every hook instance in step within the tab, and the `storage` event
// covers a switch made in another tab.

let currentId: string | null = null
const listeners = new Set<(id: string | null) => void>()

function broadcast(id: string | null) {
  currentId = id
  for (const l of listeners) l(id)
}

function readStored(): string | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage.getItem(ACTIVE_PLAYER_KEY)
  } catch {
    // Private mode, blocked site data. Not an error — just no stored choice.
    return null
  }
}

function writeStored(id: string | null) {
  if (typeof window === 'undefined') return
  try {
    if (id) window.localStorage.setItem(ACTIVE_PLAYER_KEY, id)
    else window.localStorage.removeItem(ACTIVE_PLAYER_KEY)
  } catch {
    // Ignore: the switch still works for this page view, it just will not persist.
  }
}

export type UseActivePlayer = {
  loading: boolean
  /** The signed-in auth user. Null once we know there is no session. */
  userId: string | null
  /** The signed-in user's own player row. */
  self: ActivePlayerRow | null
  /** Children on this account, ordered as the database orders them. */
  familyMembers: ActivePlayerRow[]
  /** Whose data every per-player surface should render. */
  activePlayerId: string | null
  activePlayer: ActivePlayerRow | null
  /** False only when a parent is looking at a child. Drives the viewing-as banner. */
  isViewingSelf: boolean
  /** True when the account has anyone to switch between — the tab strip's gate. */
  hasFamily: boolean
  setActivePlayer: (id: string) => void
}

export function useActivePlayer(): UseActivePlayer {
  const [loading, setLoading] = useState(true)
  const [userId, setUserId] = useState<string | null>(null)
  const [self, setSelf] = useState<ActivePlayerRow | null>(null)
  const [familyMembers, setFamilyMembers] = useState<ActivePlayerRow[]>([])
  const [activeId, setActiveId] = useState<string | null>(currentId)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      // No auth cookie means nobody is signed in, and answering that costs one
      // string search instead of downloading and parsing the Supabase client.
      if (!hasAuthCookie()) {
        setUserId(null)
        setLoading(false)
        return
      }

      const { createClient, getSessionUser } = await supabaseModule()
      if (cancelled) return
      const supabase = createClient()

      const user = await getSessionUser()
      if (cancelled) return
      if (!user) {
        setUserId(null)
        setLoading(false)
        return
      }
      setUserId(user.id)

      const [selfResult, familyResult] = await Promise.all([
        supabase.from('players').select(`${FAMILY_COLUMNS}, role`).eq('id', user.id).single(),
        supabase.from('players').select(FAMILY_COLUMNS).eq('parent_id', user.id).order('full_name'),
      ])
      if (cancelled) return

      const family = (familyResult.data ?? []) as ActivePlayerRow[]
      setSelf((selfResult.data as ActivePlayerRow) ?? null)
      setFamilyMembers(family)

      const resolved = resolveActiveId(readStored(), user.id, family)
      // Write it back: a stored id we rejected must not survive to the next load.
      writeStored(resolved === user.id ? null : resolved)
      broadcast(resolved)
      setActiveId(resolved)
      setLoading(false)
    }

    // A rejected dynamic import would otherwise leave `loading` true forever,
    // and every consumer gates its render on it.
    load().catch(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Subscribe to switches made by any other mounted consumer.
  useEffect(() => {
    const onChange = (id: string | null) => setActiveId(id)
    listeners.add(onChange)
    return () => { listeners.delete(onChange) }
  }, [])

  // …and to switches made in another tab.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== ACTIVE_PLAYER_KEY || !userId) return
      broadcast(resolveActiveId(e.newValue, userId, familyMembers))
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [userId, familyMembers])

  const setActivePlayer = useCallback((id: string) => {
    if (!userId) return
    const resolved = resolveActiveId(id, userId, familyMembers)
    writeStored(resolved === userId ? null : resolved)
    broadcast(resolved)
  }, [userId, familyMembers])

  const activePlayerId = activeId ?? userId
  const activePlayer =
    activePlayerId === userId ? self : familyMembers.find(m => m.id === activePlayerId) ?? self

  return {
    loading,
    userId,
    self,
    familyMembers,
    activePlayerId,
    activePlayer,
    isViewingSelf: activePlayerId === userId,
    hasFamily: familyMembers.length > 0,
    setActivePlayer,
  }
}
