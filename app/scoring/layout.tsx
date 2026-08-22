import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export default async function ScoringLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()

  // KEEP getUser() HERE — do not swap this for getSession()/getSessionUser().
  // This is a server component, where supabase-js explicitly treats the stored
  // session as untrusted (it wraps the user in a warning proxy), because the
  // cookie is attacker-supplied and its JWT has not been verified. Client
  // components use getSessionUser() to skip this round trip; server-side gates
  // like this one must pay it. See lib/supabase-browser.ts.
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/play')

  return <>{children}</>
}
