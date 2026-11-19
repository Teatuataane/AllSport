'use client'
// The How to Play call to action (Tāne, 19 Nov 2026): a signed-in player goes
// HOME, anyone else to /play (sign in or join on one screen). The page itself
// stays a static server component, so the choice is made here from the auth
// cookie alone, with no Supabase bundle (lib/authCookie.ts).
//
// The server snapshot is /play, which is right for a visitor and still safe
// for a player: /play redirects a signed-in browser to /dashboard itself.
import { useSyncExternalStore } from 'react'
import Link from 'next/link'
import { hasAuthCookie } from '@/lib/authCookie'

// The cookie only changes across a navigation, so there is nothing to watch.
const subscribeNothing = () => () => {}

export default function FirstGameButton() {
  const signedIn = useSyncExternalStore(subscribeNothing, hasAuthCookie, () => false)
  return (
    <Link href={signedIn ? '/dashboard' : '/play'} className="btn btn-primary" style={{ fontSize: '17px' }}>
      Play Your First Game
    </Link>
  )
}
