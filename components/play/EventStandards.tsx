'use client'

// The "Standards" toggle under an event on My Events. Collapsed by default so
// the page stays scannable, and the profile is only read once it is opened.
//
// Strength is a multiple of bodyweight. Here the weights use the player's most
// recent declaration, labelled with its date, and the prompt appears only if
// they have never declared one: a weight typed there is recorded for today
// through record_bodyweight(), as everywhere else. The weight is read for the
// player's own ladder only and is never sent anywhere.

import { useState } from 'react'
import StandardsLadderView from '@/components/play/StandardsLadderView'
import BodyweightField from '@/components/play/BodyweightField'
import { useGradeProfile } from '@/lib/useGradeProfile'
import { scoreRung, type ScoreRow } from '@/lib/scoreColour'
import { formatNZDate } from '@/lib/dates'
import type { EventData } from '@/lib/eventData'

function Open({ ev, playerId, today, rows }: { ev: EventData; playerId: string; today: string; rows: readonly ScoreRow[] }) {
  const gp = useGradeProfile(playerId, today)
  if (!gp.player) return <p style={{ fontSize: 13, color: '#777', margin: '8px 0 0' }}>Loading your standards…</p>
  // The colour reached on the player's best scores, read against the latest
  // bodyweight. A heavier past self can read a rung off, which only moves a highlight.
  const reached = scoreRung(ev, rows, gp.player, gp.bodyweightKg)
  return (
    <div style={{ marginTop: 8 }}>
      <StandardsLadderView
        ev={ev} player={gp.player} bodyweightKg={gp.bodyweightKg} reached={reached}
        bodyweightNote={gp.bodyweightKg != null && gp.bodyweightOn
          ? `at ${gp.bodyweightKg} kg, ${formatNZDate(gp.bodyweightOn)}` : undefined}
        bodyweightPrompt={<BodyweightField playerId={playerId} eventSlugs={[ev.slug]} day={today} onSaved={gp.setBodyweightKg} />}
      />
    </div>
  )
}

export default function EventStandards({
  ev, playerId, today, rows,
}: {
  ev: EventData
  playerId: string
  /** The NZ day, 'YYYY-MM-DD'. */
  today: string
  /** The player's results on this event, for the colour reached. */
  rows: readonly ScoreRow[]
}) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} style={{
        background: 'none', border: 'none', padding: '4px 0', cursor: 'pointer',
        fontFamily: 'var(--font-label)', fontSize: '11px', color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase',
      }}>
        Standards {open ? '▴' : '▾'}
      </button>
      {open && <Open ev={ev} playerId={playerId} today={today} rows={rows} />}
    </div>
  )
}
