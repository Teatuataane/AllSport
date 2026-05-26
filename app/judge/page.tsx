'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import JudgeCard from '@/app/components/JudgeCard'
import Link from 'next/link'

const supabase = createClient()

export default function JudgePage() {
  const router = useRouter()
  const [player, setPlayer] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/play'); return }

      const { data: playerData } = await supabase
        .from('players')
        .select('id, role, display_name, username')
        .eq('id', user.id)
        .single()

      if (!playerData || playerData.role !== 'judge') {
        router.push('/dashboard')
        return
      }

      setPlayer(playerData)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontFamily: 'Barlow, sans-serif' }}>Loading...</div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <div style={{ maxWidth: '680px', margin: '0 auto', padding: '24px 16px 48px' }}>

        {/* Back + header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '28px' }}>
          <Link href="/dashboard" style={{
            background: '#111', border: '1px solid #2a2a2a', borderRadius: '8px',
            padding: '8px 14px', color: '#888', textDecoration: 'none',
            fontFamily: 'Barlow Condensed, sans-serif', fontSize: '13px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}>
            ← Dashboard
          </Link>
          <div>
            <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '28px', letterSpacing: '0.05em', lineHeight: 1 }}>
              Kaiwāwao
            </div>
            <div style={{ fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.1em' }}>
              JUDGE PANEL
            </div>
          </div>
        </div>

        <JudgeCard playerRole={player.role} />
      </div>
    </div>
  )
}
