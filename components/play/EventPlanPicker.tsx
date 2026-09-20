'use client'

// ─── Event plan picker ───────────────────────────────────────────────────────
// Choosing what will be played, in ONE component for both kinds of game:
//
//   · official  — a kaiwhakawā picks exactly one event per domain (the sport).
//   · personal  — a player picks any number, across any domains (their own
//                 workout), with "Draw for me" and "Copy today's game".
//
// Before this, the kaiwhakawā setup screen and the log form asked for the same
// thing in two different shapes, which is the first thing the September 2026
// customisation review called out.

import { useState } from 'react'
import { EVENTS, DOMAIN_ORDER, getEventBySlug } from '@/lib/eventData'
import { DOMAIN_COLORS } from '@/lib/domainColours'
import { PLAN_MAX, togglePlanned, sortPlan } from '@/lib/personalGame'
import EventIcon from '@/components/EventIcon'
import DomainIcon from '@/components/DomainIcon'

const DOMAINS = DOMAIN_ORDER.map((name, i) => ({
  number: i + 1,
  name,
  events: EVENTS.filter(e => e.domainNumber === i + 1),
}))

const label: React.CSSProperties = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
}

export type PlanMode = 'official' | 'personal'

export default function EventPlanPicker({
  mode, plan, onChange, search = true,
}: {
  mode: PlanMode
  /** Event slugs, in play order. */
  plan: string[]
  onChange: (next: string[]) => void
  search?: boolean
}) {
  // Every domain open at once is a wall of 120 chips on a phone, so a domain
  // opens on tap. In official mode the first unfilled domain leads.
  const [open, setOpen] = useState<number | null>(mode === 'official' ? 1 : null)
  const [query, setQuery] = useState('')

  const chosenInDomain = (n: number) =>
    plan.filter(s => getEventBySlug(s)?.domainNumber === n)

  const pick = (slug: string, domain: number) => {
    if (mode === 'official') {
      // One per domain: picking replaces whatever that domain held.
      const without = plan.filter(s => getEventBySlug(s)?.domainNumber !== domain)
      const next = sortPlan(plan.includes(slug) ? without : [...without, slug])
      onChange(next)
      if (!plan.includes(slug)) {
        // Auto-advance to the next domain still empty, the pattern the vote
        // nomination flow already uses.
        const nextEmpty = DOMAINS.find(d => d.number !== domain && !next.some(s => getEventBySlug(s)?.domainNumber === d.number))
        setTimeout(() => setOpen(nextEmpty?.number ?? null), 220)
      }
      return
    }
    onChange(togglePlanned(plan, slug))
  }

  const hits = query.trim().length >= 2
    ? EVENTS.filter(e => e.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : []

  return (
    <div>
      {search && (
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search events — deadlift, tennis, ride…"
          aria-label="Search events"
          style={{
            width: '100%', boxSizing: 'border-box', background: '#0d0d0d', border: '1px solid #2a2a2a',
            borderRadius: 10, padding: '11px 12px', color: '#fff', fontSize: 16,
            fontFamily: 'var(--font-body)', minHeight: 44, marginBottom: 12,
          }}
        />
      )}

      {hits.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
          {hits.map(e => {
            const on = plan.includes(e.slug)
            return (
              <button key={e.slug} type="button" onClick={() => pick(e.slug, e.domainNumber)} style={{
                display: 'flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 12px', borderRadius: 999,
                cursor: 'pointer', background: on ? DOMAIN_COLORS[e.domainNumber - 1] : '#131313',
                border: `1px solid ${on ? DOMAIN_COLORS[e.domainNumber - 1] : '#2a2a2a'}`,
                color: '#fff', fontFamily: 'var(--font-label)', fontSize: 13,
              }}>
                <EventIcon slug={e.slug} emoji={e.emoji} domainNumber={e.domainNumber} size={22} />
                {e.name}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {DOMAINS.map(d => {
          const colour = DOMAIN_COLORS[d.number - 1]
          const chosen = chosenInDomain(d.number)
          const isOpen = open === d.number
          return (
            <div key={d.number} style={{
              background: '#111', border: `1px solid ${chosen.length ? colour + '44' : '#1a1a1a'}`,
              borderRadius: 12, overflow: 'hidden',
            }}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : d.number)}
                aria-expanded={isOpen}
                style={{
                  width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 12px', background: 'none', border: 'none', cursor: 'pointer', color: '#fff', textAlign: 'left',
                }}
              >
                <DomainIcon domainName={d.name} domainNumber={d.number} size={26} />
                <span style={{ ...label, fontSize: 13, color: chosen.length ? '#fff' : '#888', flex: 1, minWidth: 0 }}>
                  {d.number}. {d.name}
                </span>
                {chosen.length > 0 && (
                  <span style={{
                    ...label, fontSize: 12, color: colour, background: colour + '22',
                    padding: '3px 10px', borderRadius: 6, maxWidth: 160,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {chosen.length === 1 ? getEventBySlug(chosen[0])?.name : `${chosen.length} events`}
                  </span>
                )}
                <span style={{ color: '#555', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>›</span>
              </button>
              {isOpen && (
                <div style={{ padding: '4px 10px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {d.events.map(e => {
                    const on = plan.includes(e.slug)
                    return (
                      <button key={e.slug} type="button" onClick={() => pick(e.slug, d.number)} style={{
                        minHeight: 44, padding: '0 12px', borderRadius: 999, cursor: 'pointer',
                        background: on ? colour : '#0d0d0d', border: `1px solid ${on ? colour : '#222'}`,
                        color: on ? '#fff' : '#888', fontFamily: 'var(--font-label)', fontSize: 13,
                        fontWeight: on ? 700 : 400, letterSpacing: '0.03em',
                      }}>
                        {e.name}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {mode === 'personal' && plan.length >= PLAN_MAX && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 10 }}>
          That is {PLAN_MAX} events — enough for one workout.
        </div>
      )}
    </div>
  )
}
