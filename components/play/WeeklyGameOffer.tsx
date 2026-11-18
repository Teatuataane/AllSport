'use client'

// ─── Walk-up: "Hear about this game every week" ──────────────────────────────
// Walk-ups are welcome (Tāne, 18 Nov 2026): a new player at the park scans the
// QR code, logs in and is straight into the game. Once there, this offers the
// weekly game the kaiwhakawā linked the game to, so next week's rain call
// reaches them. Shown only when the game has a weekly game, the player is not
// already registered, and they have not said "Not now" for it on this device.
//
// WeeklyGameOfferView is props-only; WeeklyGameOffer does the reads and write.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { slotLabel, type Site, type WeeklyGame } from '@/lib/weeklyGames'
import { isRegistered, joinWeeklyGame, loadWeeklyGame } from '@/lib/weeklyGamesData'

const dismissKey = (gameId: string) => `allsport_weekly_offer_dismissed_${gameId}`

function readDismissed(gameId: string): boolean {
  try { return window.localStorage.getItem(dismissKey(gameId)) === '1' } catch { return false }
}
function writeDismissed(gameId: string) {
  try { window.localStorage.setItem(dismissKey(gameId), '1') } catch { /* private window: shows again next time */ }
}

export function WeeklyGameOfferView({ game, site, state, onJoin, onDismiss }: {
  game: WeeklyGame
  site: Site
  state: 'offer' | 'saving' | 'joined' | 'error'
  onJoin: () => void
  onDismiss: () => void
}) {
  return (
    <div role="region" aria-label="Weekly game" style={{
      margin: '12px 16px 0', padding: '12px 14px', borderRadius: 'var(--radius-md, 12px)',
      background: 'var(--blue-tint)', border: '1px solid var(--blue-edge)',
    }}>
      {state === 'joined' ? (
        <div style={{ fontSize: 14, color: 'var(--white)' }}>
          Done. You will hear about {slotLabel(game)} at {site.name} on HOME.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 14, color: 'var(--white)', lineHeight: 1.45 }}>
            Come most weeks? Join <b style={{ fontWeight: 600 }}>{slotLabel(game)}</b> at {site.name} and hear if it is cancelled or moved.
          </div>
          {state === 'error' && (
            <div role="alert" style={{ fontSize: 13, color: 'var(--red)', marginTop: 6 }}>That did not save. Try again.</div>
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" className="press" onClick={onJoin} disabled={state === 'saving'} style={{
              background: 'var(--blue)', color: '#0a0a0a', border: 'none', borderRadius: 999,
              padding: '0 18px', minHeight: 40, fontFamily: 'var(--font-label)', fontWeight: 700,
              fontSize: 13, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer',
              opacity: state === 'saving' ? 0.6 : 1,
            }}>
              Join weekly game
            </button>
            <button type="button" className="press" onClick={onDismiss} style={{
              background: 'none', border: 'none', color: 'var(--grey-light)', fontSize: 13, cursor: 'pointer',
            }}>
              Not now
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default function WeeklyGameOffer({ weeklyGameId, playerId }: { weeklyGameId: string; playerId: string }) {
  const [loaded, setLoaded] = useState<{ key: string; game: WeeklyGame; site: Site } | null>(null)
  const [state, setState] = useState<'offer' | 'saving' | 'joined' | 'error' | 'hidden'>('offer')
  const key = `${weeklyGameId}|${playerId}`

  useEffect(() => {
    if (readDismissed(weeklyGameId)) return
    let cancelled = false
    const supabase = createClient()
    Promise.all([loadWeeklyGame(supabase, weeklyGameId), isRegistered(supabase, weeklyGameId, playerId)])
      .then(([wg, registered]) => {
        // Unknown (null) counts as registered: never nag on a failed read.
        if (cancelled || !wg || registered !== false) return
        setLoaded({ key: `${weeklyGameId}|${playerId}`, ...wg })
        setState('offer')
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [weeklyGameId, playerId])

  if (!loaded || loaded.key !== key || state === 'hidden') return null

  const join = async () => {
    setState('saving')
    const err = await joinWeeklyGame(createClient(), weeklyGameId, playerId, 'game')
    setState(err ? 'error' : 'joined')
  }
  const dismiss = () => { writeDismissed(weeklyGameId); setState('hidden') }

  return <WeeklyGameOfferView game={loaded.game} site={loaded.site} state={state} onJoin={join} onDismiss={dismiss} />
}
