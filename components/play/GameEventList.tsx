'use client'

// ─── The live game's event list ──────────────────────────────────────────────
// Domain by domain: a plain title, the official event, then whatever the player
// added in that domain. The order never changes as events are scored (Tāne,
// 26 Sept 2026 — rows used to jump from "Still to play" down to "Scored").
//
// The + on an official event opens that domain's other events; the ✕ on an
// added event takes it off again, but only while it has no score. Shared by the
// player tab and the kaiwhakawā tab so the two cannot drift apart.

import { domainGroups, type OfficialEvent, type PlaySlot, type DomainGroup } from '@/lib/gameSwaps'
import EventListRow, { RowCorner } from './EventListRow'
import type { EventData } from '@/lib/eventData'
import type { EntryRow } from './chrome'

export default function GameEventList({
  events, chosen, eventDataFor, rowsFor, noteFor, rungFor, canAdd, scoredSlugs, onOpen, onAdd, onRemove,
}: {
  events: readonly OfficialEvent[]
  chosen: readonly string[]
  eventDataFor: (slot: PlaySlot) => EventData | undefined
  rowsFor: (slot: PlaySlot) => EntryRow[]
  /** The line under an official score: the division rank. */
  noteFor: (slot: PlaySlot) => { label: string; color: string } | undefined
  /** The colour a slot's score reaches on the standards, 0 for none. */
  rungFor: (slot: PlaySlot) => number
  /** False for a guest (no account to store extras against) and after the game. */
  canAdd: boolean
  /** Added events that already carry a score, which cannot be removed. */
  scoredSlugs: ReadonlySet<string>
  onOpen: (id: string) => void
  onAdd: (group: DomainGroup) => void
  onRemove: (slug: string) => void
}) {
  const groups = domainGroups(events, chosen)
  return (
    <div>
      {groups.map(g => (
        <section key={g.domainNumber} aria-label={g.domainName}>
          <div style={{
            margin: '18px 4px 12px', fontFamily: 'var(--font-label)', fontSize: '11.5px', color: '#888',
            textTransform: 'uppercase', letterSpacing: '0.14em',
          }}>
            {g.domainNumber} · {g.domainName}
          </div>
          {g.official && (
            <EventListRow
              se={g.official.se}
              eventData={eventDataFor(g.official)}
              myResults={rowsFor(g.official)}
              note={noteFor(g.official)}
              gradeRung={rungFor(g.official)}
              showDomain={false}
              onOpen={() => onOpen(g.official!.se.id)}
              corner={canAdd
                ? <RowCorner variant="add" label={`Add ${g.domainName} events`} onClick={() => onAdd(g)} />
                : undefined}
            />
          )}
          {g.added.map(slot => (
            <div key={slot.se.id} style={{ marginLeft: 14 }}>
              <EventListRow
                se={slot.se}
                eventData={eventDataFor(slot)}
                myResults={rowsFor(slot)}
                note={{ label: 'Training only', color: '#B87DB5' }}
                gradeRung={rungFor(slot)}
                showDomain={false}
                tag={rowsFor(slot).length === 0 ? 'Added · training only' : 'Added'}
                onOpen={() => onOpen(slot.se.id)}
                corner={canAdd && !scoredSlugs.has(slot.se.id)
                  ? <RowCorner variant="remove" label={`Remove ${slot.se.event_name}`} onClick={() => onRemove(slot.se.id)} />
                  : undefined}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  )
}
