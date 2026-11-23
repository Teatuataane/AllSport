'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import JudgeCard from '@/app/components/JudgeCard'
import WellbeingReport from '@/app/components/WellbeingReport'
import ActivityReport from '@/app/components/ActivityReport'
import WeeklyGamesAdmin from '@/app/components/WeeklyGamesAdmin'
import Link from 'next/link'
import { isHead, isKaiarahi, LEVEL_NAME, type KaiarahiLevel } from '@/lib/kaiarahi'
import { loadOwnLevel } from '@/lib/kaiarahiData'
import KaiarahiAdmin from '@/app/components/KaiarahiAdmin'
import RosterPanel from '@/app/components/RosterPanel'

const supabase = createClient()

export default function JudgePage() {
  const router = useRouter()
  const [player, setPlayer] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [level, setLevel] = useState<KaiarahiLevel | null>(null)

  useEffect(() => {
    const load = async () => {
      const user = await getSessionUser()
      if (!user) { router.push('/play'); return }

      const { data: playerData } = await supabase
        .from('players')
        .select('id, role, display_name, username')
        .eq('id', user.id)
        .single()

      // Any Kaiārahi may open the panel; what it shows depends on the level.
      // A Kaiwhakawā (head) gets everything; Kaimahi and Kaiako get their own
      // games (WeeklyGamesAdmin) and nothing about other players.
      const own = playerData ? await loadOwnLevel(supabase, user.id, playerData.role) : null
      if (!playerData || !isKaiarahi(own)) {
        router.push('/dashboard')
        return
      }

      setLevel(own)
      setPlayer(playerData)
      setLoading(false)
    }
    load()
  }, [router])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ color: '#555', fontFamily: 'var(--font-body)' }}>Loading…</div>
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
            fontFamily: 'var(--font-label)', fontSize: '13px',
            fontWeight: 700, letterSpacing: '0.05em',
          }}>
            ← Dashboard
          </Link>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '28px', letterSpacing: '0.05em', lineHeight: 1 }}>
              {level ? LEVEL_NAME[level] : 'Kaiārahi'}
            </div>
            <div style={{ fontSize: '12px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.1em' }}>
              KAIĀRAHI PANEL
            </div>
          </div>
        </div>

        {isHead(level) ? (
          <>
            <JudgeCard isHead playerId={player.id} />
            <RosterPanel />
            <WeeklyGamesAdmin judgeId={player.id} isHead />
            <KaiarahiAdmin />
            <WellbeingReport />
            <ActivityReport />
          </>
        ) : (
          <>
            <Link href="/scoring" className="press" style={{
              display: 'block', textAlign: 'center', background: 'var(--blue)', color: '#0a0a0a', borderRadius: 10,
              padding: '14px', marginBottom: 20, textDecoration: 'none',
              fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.08em',
            }}>New game</Link>
            <RosterPanel />
            <WeeklyGamesAdmin judgeId={player.id} isHead={false} />
          </>
        )}
      </div>
    </div>
  )
}
