import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase-server'

export default async function ScoringLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServerClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/play')

  const { data: player } = await supabase
    .from('players')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!player || player.role !== 'judge') redirect('/dashboard')

  return <>{children}</>
}
