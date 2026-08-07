'use client'
// The PLANNING half of the colour alert: who is close to their next colour, so
// a kaiwhakawā can set the moment up before a session rather than finding out
// afterwards. The LIVE half is the banner on the Kaiwhakawā tab in-session.
//
// Measured in sessions, not points. "Meredith: Whero in ~2 sessions" is
// something a coach can act on; "190 points to Whero" is not.

import { colourChipStyle, colourOnDark } from '@/lib/colours'
import type { WatchlistEntry } from '@/lib/colourAlerts'

export default function ColourWatchlistPanel({ entries }: { entries: WatchlistEntry[] }) {
  if (entries.length === 0) return null

  return (
    <div style={{ marginBottom: '18px' }}>
      <div style={{
        fontFamily: 'Barlow Condensed, sans-serif', fontSize: '11px', color: '#F9B051',
        textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: '8px',
      }}>
        Approaching a colour
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {entries.map(w => {
          const c = w.colour
          return (
            <div key={w.playerId} style={{
              display: 'flex', alignItems: 'center', gap: '11px',
              background: '#0d0d0d', border: '1px solid #1e1e1e',
              borderRadius: '10px', padding: '9px 13px',
            }}>
              <div style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, ...colourChipStyle(c) }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', color: '#fff', fontFamily: 'Barlow, sans-serif' }}>
                  {w.playerName}
                  <span style={{ color: '#555' }}> → </span>
                  <span style={{ color: colourOnDark(c), fontWeight: 600 }}>{c.name}</span>
                </div>
                <div style={{
                  fontSize: '11px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif',
                  letterSpacing: '0.05em', marginTop: '1px',
                }}>
                  {w.pointsToGo.toLocaleString()} pts to go · averaging {w.avgPointsPerSession}/session
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={{ fontFamily: 'Bebas Neue, cursive', fontSize: '22px', color: '#F9B051', lineHeight: 1 }}>
                  {w.sessionsAway}
                </div>
                <div style={{
                  fontSize: '9.5px', color: '#555', fontFamily: 'Barlow Condensed, sans-serif',
                  letterSpacing: '0.1em', textTransform: 'uppercase',
                }}>
                  {w.sessionsAway === 1 ? 'session' : 'sessions'}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
