import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return cookieStore.getAll() },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {}
          },
        },
      }
    )
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // Ensure a player profile exists (may have been missed if email confirmation was enabled)
      const { data: existing } = await supabase
        .from('players')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle()

      if (!existing) {
        // Profile missing — create a minimal one so dashboard doesn't crash
        const email = data.user.email ?? ''
        const username = email.split('@')[0]
        await supabase.from('players').insert({
          id: data.user.id,
          email,
          full_name: data.user.user_metadata?.full_name ?? username,
          username,
          display_name: data.user.user_metadata?.full_name ?? username,
          division: "Men's",
          show_username: true,
          show_division: true,
          is_active: true,
        })
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}