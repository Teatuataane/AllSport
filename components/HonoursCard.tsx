'use client'

// ─── Honours ─────────────────────────────────────────────────────────────────
// The profile's lifetime record (Scoring v2 decision 8, Tāne 15 Oct 2026):
// colours reset every 1 January, so each year's overall colour, games, PRs and
// best domain colour are kept here for good. Rules in lib/honours.ts.
//
// HonoursList takes props only, so it can be tested; HonoursCard loads them.

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'
import { EVENTS } from '@/lib/eventData'
import { gradeForRung, gradeInk } from '@/lib/grading'
import { loadGradeInputs, gradeStateFrom } from '@/lib/loadGrades'
import { honoursByYear, type YearHonours } from '@/lib/honours'
import { prMoments, prsByYear } from '@/lib/prCounts'
import { nzYear } from '@/lib/seasonYear'
import { ColourCircle } from '@/components/GradesCard'

const domainName = (n: number) => EVENTS.find(e => e.domainNumber === n)?.domain ?? ''

export default function HonoursCard({ playerId }: { playerId: string }) {
  const [loaded, setLoaded] = useState<{ id: string; years: YearHonours[] } | null>(null)

  useEffect(() => {
    let cancelled = false
    // Created here, not at module scope, so HonoursList can be tested.
    loadGradeInputs(createClient(), playerId).then(inputs => {
      if (cancelled || !inputs) return
      // allAwards and gamesByYear cover every year whichever year is graded.
      const state = gradeStateFrom(playerId, inputs)
      setLoaded({ id: playerId, years: honoursByYear(state.allAwards, state.gamesByYear, prsByYear(prMoments(inputs))) })
    }).catch(() => { /* no card rather than a wrong one */ })
    return () => { cancelled = true }
  }, [playerId])

  if (!loaded || loaded.id !== playerId || loaded.years.length === 0) return null
  return <HonoursList years={loaded.years} thisYear={nzYear()} />
}

export function HonoursList({ years, thisYear }: { years: readonly YearHonours[]; thisYear: number }) {
  return (
    <div data-testid="honours" style={{
      background: '#111', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '22px', marginBottom: '16px',
    }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: '22px', color: '#fff', letterSpacing: '0.04em', marginBottom: '4px' }}>
        Honours
      </div>
      <div style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
        Colours start again each year. What you earned stays here.
      </div>
      {years.map(y => {
        const overall = gradeForRung(y.overall)
        return (
          <div key={y.year} data-testid="honours-year" style={{ padding: '10px 0', borderTop: '1px solid #1e1e1e' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: '18px', color: '#fff', width: '48px', flexShrink: 0 }}>{y.year}</span>
              <ColourCircle rung={y.overall} size={12} />
              <span style={{ fontSize: '14px', color: y.overall ? gradeInk(overall) : '#888' }}>
                {overall.name}{y.year === thisYear ? ' so far' : ''}
              </span>
            </div>
            <div style={{ fontSize: '12.5px', color: '#888', marginTop: '4px', marginLeft: '58px' }}>
              {y.games} {y.games === 1 ? 'game' : 'games'} · {y.prs} {y.prs === 1 ? 'PR' : 'PRs'}
              {y.best && <> · best {domainName(y.best.domainNumber)} {gradeForRung(y.best.rung).name}</>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
