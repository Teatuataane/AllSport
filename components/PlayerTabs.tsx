'use client'

// ─── Player switcher ─────────────────────────────────────────────────────────
// Sticky strip under the top bar, on every surface that renders per-player data.
//
// Renders NOTHING when the account has no family members, which is most
// accounts — a solo player should not pay 45px of chrome for a feature they
// cannot use.
//
// The active chip's accent is the player's conferred OVERALL colour (the
// average of their ten domain colours in grade_awards, overallRung), and anyone
// still on Mā overall gets the brand red. It was the points-ladder rung from player_totals
// until points retired in September 2026, which showed a colour the player no
// longer holds under the current system.

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { gradeForRung, overallRung } from '@/lib/grading'
import { loadGameCounts } from '@/lib/gameCounts'
import {
  useActivePlayer, playerLabel, type ActivePlayerRow,
} from '@/lib/useActivePlayer'

const supabase = createClient()

const FALLBACK_ACCENT = '#EA4742'

/** playerId → hex accent. Module-cached: the strip mounts on several pages. */
const accentCache = new Map<string, string>()

async function loadAccents(ids: string[]): Promise<Map<string, string>> {
  const missing = ids.filter(id => !accentCache.has(id))
  if (missing.length === 0) return new Map(accentCache)

  // The games count caps the overall colour, so it is read here too, by the
  // same rule as the leaderboard (lib/gameCounts.ts, paged past the row cap).
  const [awards, games] = await Promise.all([
    supabase.from('grade_awards').select('player_id, domain_number, rung').in('player_id', missing),
    loadGameCounts(supabase, missing),
  ])
  // Unknown games: show the brand red for now and cache NOTHING, so the next
  // mount retries the count rather than keeping a wrong chip all session.
  if (!games) {
    const out = new Map(accentCache)
    for (const id of missing) out.set(id, FALLBACK_ACCENT)
    return out
  }
  const held = new Map<string, Map<number, number>>()
  for (const a of (awards.data ?? []) as { player_id: string; domain_number: number; rung: number }[]) {
    const m = held.get(a.player_id) ?? new Map<number, number>()
    m.set(a.domain_number, Math.max(m.get(a.domain_number) ?? 0, a.rung))
    held.set(a.player_id, m)
  }
  for (const [id, m] of held) {
    const overall = overallRung(m.values(), games.get(id) ?? 0)
    if (overall === 0) continue
    const g = gradeForRung(overall)
    // A 6-digit hex, never a var(): it is suffixed with an alpha below. Taniwha
    // is black, which would vanish on the dark bar, so it takes white.
    accentCache.set(id, g.inverted ? '#ffffff' : g.hex)
  }

  // Anyone still unresolved gets the brand red, and is cached so we do not
  // re-query for them on every mount.
  for (const id of missing) if (!accentCache.has(id)) accentCache.set(id, FALLBACK_ACCENT)
  return new Map(accentCache)
}

function Avatar({ player, active, accent }: {
  player: ActivePlayerRow
  active: boolean
  accent: string
}) {
  const label = playerLabel(player)
  return (
    <div style={{
      width: 26, height: 26, borderRadius: 8, flexShrink: 0,
      background: active ? `${accent}22` : '#1a1a1a',
      border: `1px solid ${active ? `${accent}66` : '#2a2a2a'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: player.icon ? 13 : 12,
      fontFamily: player.icon ? undefined : 'var(--font-display)',
      color: active ? accent : '#666666',
      lineHeight: 1,
    }}>
      {player.icon || label.charAt(0).toUpperCase()}
    </div>
  )
}

export default function PlayerTabs() {
  const { familyMembers, self, activePlayerId, hasFamily, setActivePlayer } = useActivePlayer()
  const [accents, setAccents] = useState<Map<string, string>>(new Map())

  const roster: ActivePlayerRow[] = self ? [self, ...familyMembers] : familyMembers

  useEffect(() => {
    // Solo accounts never render the chips, so they never pay for the queries.
    if (roster.length === 0 || !hasFamily) return
    let cancelled = false
    loadAccents(roster.map(p => p.id)).then(m => { if (!cancelled) setAccents(m) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roster.map(p => p.id).join(','), hasFamily])

  // The whole point of the gate: most accounts never render this.
  if (!hasFamily) return null

  return (
    <div style={{
      position: 'sticky', top: 53, zIndex: 900,
      background: '#0a0a0a', borderBottom: '1px solid var(--border)',
    }}>
      <div style={{ position: 'relative' }}>
        <div style={{
          display: 'flex', alignItems: 'stretch', padding: '0 10px',
          overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}>
          {roster.map(p => {
            const active = p.id === activePlayerId
            const accent = accents.get(p.id) ?? FALLBACK_ACCENT
            return (
              <button
                key={p.id}
                onClick={() => setActivePlayer(p.id)}
                aria-pressed={active}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 12px 8px', flexShrink: 0, minHeight: 45,
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  borderBottom: `2px solid ${active ? accent : 'transparent'}`,
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <Avatar player={p} active={active} accent={accent} />
                <span style={{
                  fontFamily: 'var(--font-label)', textTransform: 'uppercase',
                  letterSpacing: '0.06em', fontWeight: 600, fontSize: 14,
                  color: active ? 'var(--white)' : '#666666', lineHeight: 1,
                }}>
                  {playerLabel(p)}
                </span>
              </button>
            )
          })}

          <Link
            href="/profile#family"
            aria-label="Add a family member"
            style={{
              display: 'flex', alignItems: 'center', padding: '9px 12px 8px',
              flexShrink: 0, minHeight: 45,
            }}
          >
            <span style={{
              width: 26, height: 26, borderRadius: 8, border: '1px dashed #333333',
              color: '#555555', fontSize: 15, lineHeight: 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              +
            </span>
          </Link>
        </div>

        {/* Fade mask: signals more chips off-screen without a scrollbar. */}
        <div aria-hidden style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: 46,
          pointerEvents: 'none',
          background: 'linear-gradient(90deg, rgba(10,10,10,0), #0a0a0a)',
        }} />
      </div>
    </div>
  )
}

/**
 * The banner that stops a parent misreading a child's numbers as their own.
 * Absent on your own tab on purpose — a badge that is always there stops being
 * read within a week.
 */
export function ViewingAsBanner() {
  const { activePlayer, isViewingSelf, hasFamily } = useActivePlayer()
  const [accent, setAccent] = useState(FALLBACK_ACCENT)

  useEffect(() => {
    if (!activePlayer || !hasFamily) return
    let cancelled = false
    loadAccents([activePlayer.id]).then(m => {
      if (!cancelled) setAccent(m.get(activePlayer.id) ?? FALLBACK_ACCENT)
    })
    return () => { cancelled = true }
  }, [activePlayer?.id, hasFamily])

  if (isViewingSelf || !hasFamily || !activePlayer) return null

  return (
    <div style={{
      background: `${accent}0f`, border: `1px solid ${accent}33`,
      borderRadius: 12, padding: '9px 13px', marginBottom: 14,
      display: 'flex', alignItems: 'center', gap: 9,
    }}>
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={accent}
           strokeWidth="2" strokeLinecap="round" aria-hidden>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
      <span style={{
        fontFamily: 'var(--font-label)', textTransform: 'uppercase',
        letterSpacing: '0.08em', fontWeight: 600, fontSize: 12, color: accent,
      }}>
        Viewing {playerLabel(activePlayer)}&rsquo;s stats
      </span>
    </div>
  )
}
