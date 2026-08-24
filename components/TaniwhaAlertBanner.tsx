'use client'

// The live kaiwhakawā banner. A crown is landing while the player is in front
// of you — the whole point of the feature.
//
// Two states, and the difference matters out loud:
//   earned    both the points room and the act hold at the player's guaranteed
//             worst case, so no other result can take it back. Safe to announce.
//   on-track  leans on a provisional placement or a win that has not been
//             banked yet. It can retract. NEVER announce it as a result.

import { taniwhaOnDark, WIN_TARGET } from '@/lib/taniwha'
import type { TaniwhaAlert } from '@/lib/taniwhaAlerts'

export default function TaniwhaAlertBanner({
  alerts,
  claimingPlayerId,
  onCelebrate,
}: {
  alerts: TaniwhaAlert[]
  /** Player whose claim is in flight — disables that row's button. */
  claimingPlayerId: string | null
  onCelebrate: (alert: TaniwhaAlert) => void
}) {
  if (alerts.length === 0) return null

  return (
    <>
      {alerts.map(alert => {
        const earned = alert.state === 'earned'
        const claiming = claimingPlayerId === alert.playerId
        const ink = taniwhaOnDark(alert.taniwha)
        return (
          <div
            key={`${alert.playerId}-${alert.taniwha.slug}`}
            data-testid={`taniwha-alert-${alert.playerId}`}
            data-state={alert.state}
            style={{
              position: 'relative', overflow: 'hidden',
              background: earned ? '#14110a' : '#0d0d0d',
              border: `1px solid ${earned ? '#F9B05166' : '#1e1e1e'}`,
              borderRadius: '12px', padding: '13px 15px', marginBottom: '10px',
              display: 'flex', alignItems: 'center', gap: '12px',
            }}
          >
            <div style={{
              width: '12px', height: '12px', borderRadius: '4px', flexShrink: 0,
              background: alert.taniwha.accent.startsWith('linear-gradient') ? undefined : alert.taniwha.accent,
              backgroundImage: alert.taniwha.accent.startsWith('linear-gradient') ? alert.taniwha.accent : undefined,
            }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'var(--font-body)', fontWeight: 600 }}>
                {alert.playerName}
                <span style={{ color: ink, fontWeight: 400 }}> · {alert.taniwha.name}</span>
              </div>
              <div style={{ fontSize: '11px', color: earned ? '#F9B051' : '#666', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '3px' }}>
                {earned
                  ? `HAS EARNED CROWN #${alert.crownOrdinal} — SAFE TO CALL IT`
                  : alert.winsShortfall > 0
                  ? `ON TRACK — NEEDS THE ${WIN_TARGET}TH WIN TO HOLD`
                  : `ON TRACK — ${alert.pointsShortfall.toLocaleString()} PTS ON CURRENT PLACING`}
              </div>
            </div>
            {earned && (
              <button
                onClick={() => onCelebrate(alert)}
                disabled={claiming}
                style={{
                  flexShrink: 0, padding: '8px 14px', borderRadius: '8px', cursor: claiming ? 'default' : 'pointer',
                  background: claiming ? '#333' : '#F9B051', border: 'none', color: '#000',
                  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '12px',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
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
