// ─── A colour swatch ─────────────────────────────────────────────────────────
// Its own module with no 'use client' and no hooks, so the SERVER-rendered
// colours guide (app/grades/page.tsx) can draw it without pulling the whole
// YOUR COLOURS card (and lib/eventData with it) into that page's bundle.

import { RAINBOW } from '@/lib/domainColours'
import { gradeFill, gradeRim, type GradeRung } from '@/lib/grading'

/** Uenuku is the rainbow; Taniwha a black dot with a rim; Mā an outlined white; the metals a sheen with a darker rim. */
export function GradeDot({ grade, size = 12 }: { grade: GradeRung; size?: number }) {
  return (
    <span aria-hidden style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'inline-block',
      background: grade.rainbow ? RAINBOW : gradeFill(grade),
      boxShadow: grade.rung === 0 ? 'inset 0 0 0 1px #444' : grade.inverted ? '0 0 0 1px #555' : grade.metal ? `inset 0 0 0 ${size >= 20 ? 2 : 1}px ${gradeRim(grade)}` : 'none',
    }} />
  )
}
