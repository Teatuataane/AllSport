// @vitest-environment jsdom
//
// ── Report sheets (multi-location step 14) ──────────────────────────────────
// What this pins: the school sheet names only consenting students and says
// what it never includes; the funder sheet shows reach with small groups hidden.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup, screen } from '@testing-library/react'
import { FunderReportView, SchoolReportView } from '@/components/ReportViews'
import type { FunderReport, SchoolReport } from '@/lib/reports'

afterEach(cleanup)

const school: SchoolReport = {
  school: 'A School', from: '2026-09-26', to: '2026-11-26', students: 7, attendances: 30, often: 5,
  age: [['5-11', 'fewer than 5'], ['12-17', '5']], named: [{ name: 'Aroha Smith', games: 6 }], unnamed: 6,
}

const funder: FunderReport = {
  programme: { name: 'Rangatahi', funder: 'A trust' }, from: '2026-09-26', to: '2026-11-26', games: ['g'],
  summary: {
    sessions: 10, attendances: 80, players: Array.from({ length: 12 }, (_, i) => `p${i}`), turnUp: 8, regulars: 6,
    newPlayers: ['p1', 'p2'], comeback: { of: 2, yes: 1 }, showUp: { of: 20, yes: 15 }, cancelled: [],
  },
  reach: { total: 12, age: new Map([['12-17', 9], ['25-44', 3]]), sex: new Map(), ethnicity: new Map(), deprivation: new Map([['Q5', 7]]) },
  newReach: { total: 2, age: new Map(), sex: new Map(), ethnicity: new Map(), deprivation: new Map() },
  wellbeing: null, paidMinutes: 1500,
}

describe('report sheets', () => {
  it('a school sheet names only consenting students', () => {
    render(<SchoolReportView report={school} />)
    expect(screen.getByText('A School')).toBeTruthy()
    expect(screen.getByText('Aroha Smith')).toBeTruthy()
    expect(screen.getByText('6 games')).toBeTruthy()
    expect(screen.getByText(/never includes ethnicity, wellbeing answers or bodyweight/)).toBeTruthy()
  })

  it('a funder sheet shows delivery and reach, small groups hidden', () => {
    render(<FunderReportView report={funder} />)
    expect(screen.getByText('Funder report for A trust')).toBeTruthy()
    expect(screen.getByText('Who played: 12')).toBeTruthy()
    expect(screen.getByText('New players: fewer than 5')).toBeTruthy()
    expect(screen.getByText('25.0')).toBeTruthy() // paid hours
    expect(screen.getAllByText('Q5 (most deprived)')).toHaveLength(2)
  })
})
