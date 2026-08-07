'use client'
// The LIVE half of the colour alert, shown on the Kaiwhakawā tab during a
// session. This is the point of the whole feature: the coach finds out while
// the player is still in the room, not after the close trigger runs.
//
// Two states, and the difference is the safety story:
//   'earned'    the crossing holds even at the player's guaranteed worst case
//               (min placement + banked effort, no ranking involved), so it is
//               safe to announce out loud. Gets the Celebrated button.
//   'on-track'  the optimistic projection. Can retract if the player slips, so
//               it deliberately has NO button and says so.

import { colourChipStyle, colourOnDark, RAINBOW } from '@/lib/colours'
import type { ColourAlert } from '@/lib/colourAlerts'

export default function ColourAlertBanner({
  alerts,
  claimingPlayerId,
  onCelebrate,
}: {
  alerts: ColourAlert[]
  /** Player whose claim is in flight — disables that row's button. */
  claimingPlayerId: string | null
  onCelebrate: (alert: ColourAlert) => void
}) {
  if (alerts.length === 0) return null

  return (
    <>
      {alerts.map(alert => {
        const earned = alert.state === 'earned'
        const claiming = claimingPlayerId === alert.playerId
        return (
          <div
            key={`${alert.playerId}-${alert.colour.rung}`}
            data-testid={`colour-alert-${alert.playerId}`}
            data-state={alert.state}
            style={{
              position: 'relative', overflow: 'hidden',
              background: earned ? '#14110a' : '#0d0d0d',
              border: `1px solid ${earned ? '#F9B05166' : '#1e1e1e'}`,
              borderLeft: `4px solid ${earned ? '#F9B051' : '#333'}`,
              borderRadius: '12px', padding: '12px 14px', marginBottom: '10px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}
          >
            {earned && (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', background: RAINBOW }} />
            )}
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', flexShrink: 0, ...colourChipStyle(alert.colour) }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '18px', color: '#fff', lineHeight: 1.15 }}>
                <span style={{ color: '#EA4742' }}>{alert.playerName}</span>
                {earned ? ' has earned ' : ' is on track for '}
                <span style={{ color: colourOnDark(alert.colour) }}>{alert.colour.name}</span>
              </div>
              <div style={{ fontSize: '11px', color: '#666', fontFamily: 'Barlow Condensed, sans-serif', letterSpacing: '0.06em', marginTop: '2px' }}>
                {earned
                  ? 'Confirmed — safe to announce'
                  : `${alert.shortfall} more guaranteed pts needed · could still slip`}
              </div>
            </div>
            {earned && (
              <button
                onClick={() => onCelebrate(alert)}
                disabled={claiming}
                style={{
                  flexShrink: 0, minHeight: '44px', padding: '0 16px',
                  background: '#F9B051', border: 'none', borderRadius: '10px',
                  color: '#000', cursor: 'pointer', fontWeight: 700,
                  fontFamily: 'Barlow Condensed, sans-serif', fontSize: '14px',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                  opacity: claiming ? 0.6 : 1,
                }}
              >
                {claiming ? 'Saving…' : 'Celebrated'}
              </button>
            )}
          </div>
        )
      })}
    </>
  )
}
