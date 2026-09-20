import { redirect } from 'next/navigation'

// ─── /log is retired ─────────────────────────────────────────────────────────
// Logging a workout is now planning a personal game and playing it on the same
// screen an official game uses (app/workout/new). The route stays so old links,
// bookmarks and anything still pointing here land in the right place.

export default function LogRedirect() {
  redirect('/workout/new')
}
