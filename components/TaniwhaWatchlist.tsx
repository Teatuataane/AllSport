'use client'

// The "Approaching a crown" panel on the /judge Players tab.
//
// The colour version led with "N sessions away", which was the whole story when
// there was one axis. A crown has two — the points and the act — so this leads
// with WHAT IS ACTUALLY HOLDING THEM UP. Telling a coach "two sessions away"
// when the player is four wins short would send them to coach the wrong thing.

import { WIN_TARGET, taniwhaOnDark, BODY_PARTS_PER_TANIWHA } from '@/lib/taniwha'
import type { TaniwhaWatchEntry } from '@/lib/taniwhaAlerts'

const BLOCKER: Record<TaniwhaWatchEntry['blocker'], { label: string; colour: string }> = {
  ready:  { label: 'READY',  colour: '#F9B051' },
  points: { label: 'POINTS', colour: '#4DB26E' },
  wins:   { label: 'WINS',   colour: '#2371BB' },
  body:   { label: 'PARTS',  colour: '#888888' },
}

function detail(e: TaniwhaWatchEntry): string {
  switch (e.blocker) {
    case 'ready':
      return 'Crown is theirs the moment this session closes'
    case 'points':
      return `${e.pointsToGo.toLocaleString()} pts — about ${e.sessionsAway} session${e.sessionsAway === 1 ? '' : 's'} at ${e.avgPointsPerSession}/session`
    case 'wins':
      return e.taniwha.kind === 'whanau'
        ? 'Needs one qualified referral — someone they invited, ten sessions in'
        : `${e.winsToGo} more event win${e.winsToGo === 1 ? '' : 's'} of ${WIN_TARGET}`
    case 'body':
      return `${e.partsToGo} of ${BODY_PARTS_PER_TANIWHA} parts still to place`
  }
}

export default function TaniwhaWatchlist({ entries }: { entries: TaniwhaWatchEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div style={{ marginBottom: '24px' }}>
      <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '11px', letterSpacing: '0.15em', textTransform: 'uppercase', color: '#555', marginBottom: '10px' }}>
        Approaching a crown
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {entries.map(e => {
          const b = BLOCKER[e.blocker]
          return (
            <div
              key={e.playerId}
              data-testid={`taniwha-watch-${e.playerId}`}
              data-blocker={e.blocker}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', background: '#111', border: `1px solid ${e.blocker === 'ready' ? '#F9B05144' : '#1e1e1e'}`, borderRadius: '10px', padding: '11px 14px' }}
            >
              <div style={{
                width: '10px', height: '10px', borderRadius: '3px', flexShrink: 0,
                background: e.taniwha.accent.startsWith('linear-gradient') ? undefined : e.taniwha.accent,
                backgroundImage: e.taniwha.accent.startsWith('linear-gradient') ? e.taniwha.accent : undefined,
              }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff', fontFamily: 'var(--font-body)' }}>
                  {e.playerName}
                  <span style={{ color: taniwhaOnDark(e.taniwha), fontWeight: 400 }}> · {e.taniwha.name}</span>
                </div>
                <div style={{ fontSize: '11px', color: '#666', fontFamily: 'var(--font-label)', letterSpacing: '0.04em', marginTop: '2px' }}>
                  {detail(e)}
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.1em', color: b.colour, border: `1px solid ${b.colour}55`, borderRadius: '4px', padding: '3px 7px', flexShrink: 0 }}>
                {b.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
