'use client'

// ─── New Game: which game is this? ───────────────────────────────────────────
// Every session belongs to a game (20261123035106, MULTI_LOCATION_PLAN.md §2),
// so New Game asks which one: a game this Kaiārahi may start today, or a
// POP-UP, a one-off community game made on the spot at a site. Before a new
// site is added, sites within 500 m (or with the same name) are offered first,
// so one park does not become three sites.
//
// Props only, no Supabase: the host page loads the board and does the writes.

import { useMemo, useState, type CSSProperties } from 'react'
import type { Site, WeeklyGame } from '@/lib/weeklyGames'
import { gameKind, slotLabel, sortWeekly } from '@/lib/weeklyGames'
import { formatMetres, nearbySites, pinFromMapUrl, pinOf, distanceMetres, sameNameSites, type Pin } from '@/lib/sites'

export type PopUpChoice =
  | { kind: 'site'; siteId: string; listed: boolean }
  | { kind: 'new-site'; name: string; address: string; pin: Pin | null; listed: boolean }

export type GameChoice = { kind: 'game'; gameId: string } | { kind: 'popup'; popup: PopUpChoice } | null

const label: CSSProperties = {
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, color: '#777',
  letterSpacing: '0.12em', textTransform: 'uppercase', display: 'block', marginBottom: 8,
}
const input: CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8, padding: '10px 14px',
  color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)', boxSizing: 'border-box', minHeight: 44, colorScheme: 'dark',
}
const chip = (on: boolean): CSSProperties => ({
  textAlign: 'left', background: on ? '#16202b' : '#0a0a0a', border: `1px solid ${on ? 'var(--blue)' : '#2a2a2a'}`,
  borderRadius: 10, padding: '10px 14px', color: '#fff', cursor: 'pointer', minHeight: 44, width: '100%',
  fontFamily: 'var(--font-body)', fontSize: 15,
})

export default function GamePicker({
  games, sites, choice, onChange, canPopUp, here, onLocate, locating,
}: {
  /** Games this Kaiārahi may start (startableGames). */
  games: WeeklyGame[]
  sites: Site[]
  choice: GameChoice
  onChange: (c: GameChoice) => void
  /** False until 20261123035106 is live: no one-off games before it. */
  canPopUp: boolean
  /** Where the phone is, once asked. */
  here: Pin | null
  onLocate: () => void
  locating: boolean
}) {
  const siteName = (id: string) => sites.find(s => s.id === id)?.name ?? ''
  const popup = choice?.kind === 'popup' ? choice.popup : null
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [mapLink, setMapLink] = useState('')
  const [listed, setListed] = useState(true)

  // Existing sites, nearest first once the phone knows where it is.
  const siteList = useMemo(() => {
    const withDistance = sites.map(s => {
      const p = pinOf(s)
      return { site: s, metres: here && p ? distanceMetres(here, p) : null }
    })
    return withDistance.sort((a, b) => {
      const gap = (a.metres === null ? Infinity : a.metres) - (b.metres === null ? Infinity : b.metres)
      if (gap !== 0 && !Number.isNaN(gap)) return gap
      return a.site.name.localeCompare(b.site.name)
    })
  }, [sites, here])

  const newPin = pinFromMapUrl(mapLink) ?? here
  const lookalikes = useMemo(() => {
    const near = newPin ? nearbySites(sites, newPin) : []
    const named = sameNameSites(sites, newName)
    const seen = new Set<string>()
    return [...near, ...named].filter(s => (seen.has(s.id) ? false : (seen.add(s.id), true)))
  }, [sites, newPin, newName])

  const pickNew = (name: string, address: string, pin: Pin | null, l: boolean) =>
    onChange({ kind: 'popup', popup: { kind: 'new-site', name, address, pin, listed: l } })

  return (
    <div>
      <span style={label}>Which game</span>
      <div style={{ display: 'grid', gap: 6 }}>
        {sortWeekly(games).map(g => {
          const on = choice?.kind === 'game' && choice.gameId === g.id
          return (
            <button key={g.id} type="button" className="press" onClick={() => onChange({ kind: 'game', gameId: g.id })} style={chip(on)}>
              <span style={{ display: 'block', fontWeight: 600 }}>{slotLabel(g)} · {siteName(g.site_id)}</span>
              <span style={{ display: 'block', fontSize: 13, color: '#888' }}>
                {gameKind(g) === 'funded' ? 'Funded' : 'Community'}{g.listed === false ? ' · unlisted' : ''}{g.one_off_date ? ' · one-off' : ''}
              </span>
            </button>
          )
        })}
        {games.length === 0 && (
          <div style={{ fontSize: 14, color: '#888' }}>No game for you to start yet. Start a pop-up below.</div>
        )}
        {canPopUp && (
          <button type="button" className="press" onClick={() => onChange({ kind: 'popup', popup: popup ?? { kind: 'site', siteId: '', listed } })} style={chip(!!popup)}>
            <span style={{ display: 'block', fontWeight: 600 }}>Pop-up game</span>
            <span style={{ display: 'block', fontSize: 13, color: '#888' }}>A one-off community game, here and now</span>
          </button>
        )}
      </div>

      {popup && (
        <div style={{ marginTop: 14, padding: 14, border: '1px solid #2a2a2a', borderRadius: 10, display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <span style={{ ...label, marginBottom: 0 }}>Where</span>
            <button type="button" className="press" onClick={onLocate} disabled={locating} style={{
              background: 'none', border: '1px solid #333', borderRadius: 999, color: '#ddd', minHeight: 38, padding: '0 14px',
              fontFamily: 'var(--font-label)', fontSize: 13, fontWeight: 700, letterSpacing: '0.06em', cursor: 'pointer',
            }}>{locating ? 'Finding you…' : here ? 'Found you' : 'Use where I am'}</button>
          </div>

          <div style={{ display: 'grid', gap: 6 }}>
            {siteList.map(({ site, metres }) => (
              <button key={site.id} type="button" className="press"
                onClick={() => onChange({ kind: 'popup', popup: { kind: 'site', siteId: site.id, listed: popup.listed } })}
                style={chip(popup.kind === 'site' && popup.siteId === site.id)}>
                {site.name}{metres != null ? <span style={{ color: '#888' }}> · {formatMetres(metres)}</span> : null}
              </button>
            ))}
            <button type="button" className="press" onClick={() => pickNew(newName, newAddress, newPin, popup.listed)}
              style={chip(popup.kind === 'new-site')}>+ A new site</button>
          </div>

          {popup.kind === 'new-site' && (
            <div style={{ display: 'grid', gap: 10 }}>
              <label>
                <span style={label}>Site name</span>
                <input value={newName} maxLength={80} placeholder="e.g. Hagley Park, Riccarton end" style={input}
                  onChange={e => { setNewName(e.target.value); pickNew(e.target.value, newAddress, newPin, popup.listed) }} />
              </label>
              <label>
                <span style={label}>Address (optional)</span>
                <input value={newAddress} maxLength={200} style={input}
                  onChange={e => { setNewAddress(e.target.value); pickNew(newName, e.target.value, newPin, popup.listed) }} />
              </label>
              <label>
                <span style={label}>Map link (optional, instead of where you are)</span>
                <input value={mapLink} style={input} placeholder="Paste a Google Maps link"
                  onChange={e => { setMapLink(e.target.value); pickNew(newName, newAddress, pinFromMapUrl(e.target.value) ?? here, popup.listed) }} />
              </label>
              <div style={{ fontSize: 13, color: newPin ? '#8c8' : 'var(--amber)' }}>
                {newPin ? 'Pinned.' : 'Not pinned yet: use where you are, or paste a map link, so players can find it.'}
              </div>
              {lookalikes.length > 0 && (
                <div style={{ border: '1px solid var(--amber)', borderRadius: 10, padding: 12 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Is it one of these?</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {lookalikes.map(s => (
                      <button key={s.id} type="button" className="press"
                        onClick={() => onChange({ kind: 'popup', popup: { kind: 'site', siteId: s.id, listed: popup.listed } })}
                        style={chip(false)}>
                        {s.name}{'metres' in s ? <span style={{ color: '#888' }}> · {formatMetres((s as { metres: number }).metres)}</span> : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={listed} style={{ width: 18, height: 18 }}
              onChange={e => {
                setListed(e.target.checked)
                onChange({ kind: 'popup', popup: { ...popup, listed: e.target.checked } })
              }} />
            <span style={{ fontSize: 14 }}>Show it on Find a game <span style={{ color: '#888' }}>(untick for a private game)</span></span>
          </label>
        </div>
      )}
    </div>
  )
}

/** Ready to start? */
export function choiceReady(c: GameChoice): boolean {
  if (!c) return false
  if (c.kind === 'game') return !!c.gameId
  if (c.popup.kind === 'site') return !!c.popup.siteId
  return c.popup.name.trim().length > 0
}
