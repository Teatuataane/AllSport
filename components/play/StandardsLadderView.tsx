'use client'

// The colour standards for one event, on the player's own ladder, in the event's
// own units. Presentational: lib/standardsLadder.ts decides every row, and the
// host passes the player, the bodyweight and whatever prompts for one (the entry
// sheet embeds BodyweightField, My Events its own field).
//
// `reached` is the colour the player has reached (0 for none). Rows at or below
// it show their colour; the one above is marked Next; the rest stay grey, so the
// colour a row is painted still means "you have this".

import type { ReactNode } from 'react'
import { gradeForRung, gradeInk } from '@/lib/grading'
import { RAINBOW } from '@/lib/domainColours'
import { standardsLadder, needsBodyweight, RATING_ONLY_NOTE } from '@/lib/standardsLadder'
import { STANDARDS } from '@/lib/standards'
import type { GradePlayer } from '@/lib/playerGrades'
import type { EventData } from '@/lib/eventData'

export default function StandardsLadderView({
  ev, player, bodyweightKg, reached = 0, bodyweightNote, bodyweightPrompt,
}: {
  ev: EventData | undefined
  player: GradePlayer | null
  bodyweightKg: number | null
  reached?: number
  /** Where the bodyweight comes from, e.g. "at 80 kg, 2 Oct". */
  bodyweightNote?: string
  /** A control that asks for a bodyweight. Shown only while there is none. */
  bodyweightPrompt?: ReactNode
}) {
  if (!ev || !player) return null
  const rows = standardsLadder(ev, player, bodyweightKg)
  if (rows.length === 0) return null
  const ratio = needsBodyweight(ev)
  const ratingOnly = STANDARDS[ev.slug]?.kind === 'rating'
  const next = reached + 1

  return (
    <div>
      {ratingOnly && <p style={{ fontSize: 13, color: '#999', margin: '0 0 8px' }}>{RATING_ONLY_NOTE}</p>}
      {ratio && bodyweightKg == null && (
        <div style={{ margin: '0 0 8px' }}>
          <p style={{ fontSize: 13, color: '#999', margin: '0 0 6px' }}>
            Strength is graded as a multiple of your bodyweight. Add yours to see the weights.
          </p>
          {bodyweightPrompt}
        </div>
      )}
      {ratio && bodyweightKg != null && bodyweightNote && (
        <p style={{ fontSize: 12.5, color: '#777', margin: '0 0 8px' }}>Weights are an estimated one-rep max {bodyweightNote}.</p>
      )}
      <div role="list" aria-label={`${ev.name} standards`}>
        {rows.map(r => {
          const g = gradeForRung(r.rung)
          const have = r.rung <= reached
          const ink = have ? gradeInk(g) : '#777'
          return (
            <div key={r.rung} role="listitem" style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '7px 8px', borderBottom: '1px solid #1e1e1e',
              borderRadius: r.rung === next ? 8 : 0,
              outline: r.rung === next ? '1px solid #444' : 'none',
            }}>
              <span style={{
                width: 84, flexShrink: 0, fontFamily: 'var(--font-label)', fontSize: 12.5, fontWeight: 600,
                letterSpacing: '0.08em', textTransform: 'uppercase',
                ...(have && g.rainbow ? { background: RAINBOW, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' } : { color: ink }),
              }}>{r.name}</span>
              <span style={{ flex: 1, fontSize: 13.5, color: have ? '#fff' : '#bbb' }}>{r.label}</span>
              {r.rung === next && (
                <span style={{ fontFamily: 'var(--font-label)', fontSize: 10.5, color: '#aaa', border: '1px solid #444', borderRadius: 999, padding: '0 7px', letterSpacing: '0.08em' }}>NEXT</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
