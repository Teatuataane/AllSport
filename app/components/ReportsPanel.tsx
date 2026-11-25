'use client'

// ─── Kaiārahi panel: reports (Kaiwhakawā only) ───────────────────────────────
// Multi-location games step 14. Choose a programme or a school and a period;
// the report opens at /judge/report, ready to print, save as PDF or download
// as CSV. The period starts as this school term to date.

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { nzWallClock } from '@/lib/weeklyGames'
import { termOf } from '@/lib/successMeasures'
import { loadNamedSchools, loadProgrammes, type Programme } from '@/lib/reportsData'

const labelStyle: CSSProperties = {
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 12, color: '#777',
  letterSpacing: '0.12em', textTransform: 'uppercase',
}
const inputStyle: CSSProperties = {
  width: '100%', background: '#0a0a0a', border: '1px solid #2a2a2a', borderRadius: 8,
  padding: '10px 12px', color: '#fff', fontSize: 16, fontFamily: 'var(--font-body)',
  boxSizing: 'border-box', minHeight: 44, colorScheme: 'dark',
}
const linkStyle: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', background: 'var(--blue)', color: '#0a0a0a', borderRadius: 999,
  padding: '0 16px', minHeight: 40, textDecoration: 'none',
  fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase',
}

/** The report's address, or null until everything is chosen. */
export function reportHref(kind: 'funder' | 'school', id: string, from: string, to: string): string | null {
  if (!id || !from || !to || from > to) return null
  const q = new URLSearchParams({ kind, [kind === 'funder' ? 'programme' : 'school']: id, from, to })
  return `/judge/report?${q.toString()}`
}

export default function ReportsPanel() {
  const [supabase] = useState(() => createClient())
  const [today] = useState(() => nzWallClock(new Date()).date)
  const [programmes, setProgrammes] = useState<Programme[]>([])
  const [schools, setSchools] = useState<{ id: number; name: string }[]>([])
  const [programme, setProgramme] = useState('')
  const [school, setSchool] = useState('')
  const [from, setFrom] = useState(() => termOf(nzWallClock(new Date()).date).start)
  const [to, setTo] = useState(today)

  useEffect(() => {
    let gone = false
    Promise.all([loadProgrammes(supabase), loadNamedSchools(supabase)]).then(([p, s]) => {
      if (gone) return
      setProgrammes(p); setSchools(s)
    }).catch(() => {})
    return () => { gone = true }
  }, [supabase])

  const funder = reportHref('funder', programme, from, to)
  const schoolHref = reportHref('school', school, from, to)

  return (
    <div id="reports" style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: 12, padding: 20, marginBottom: 20 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 24, letterSpacing: '0.05em', lineHeight: 1 }}>Reports</div>
      <div style={{ fontSize: 13, color: '#888', marginTop: 6 }}>For funders and schools: print, save as PDF, or download a CSV.</div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <label style={{ flex: 1 }}><span style={labelStyle}>From</span>
          <input type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} style={inputStyle} /></label>
        <label style={{ flex: 1 }}><span style={labelStyle}>To</span>
          <input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={inputStyle} /></label>
      </div>

      <Row title="Funder report">
        <select aria-label="Programme" value={programme} onChange={e => {
          setProgramme(e.target.value)
          const p = programmes.find(x => x.id === e.target.value)
          // A programme that started this term opens on its own start date.
          if (p && p.starts_on > from && p.starts_on <= to) setFrom(p.starts_on)
        }} style={inputStyle}>
          <option value="">{programmes.length ? 'Choose a programme' : 'No programmes yet'}</option>
          {programmes.map(p => <option key={p.id} value={p.id}>{p.name} · {p.funder}</option>)}
        </select>
        {funder ? <Link href={funder} className="press" style={linkStyle}>Open</Link> : null}
      </Row>

      <Row title="School report">
        <select aria-label="School" value={school} onChange={e => setSchool(e.target.value)} style={inputStyle}>
          <option value="">{schools.length ? 'Choose a school' : 'No student has named a school yet'}</option>
          {schools.map(s => <option key={s.id} value={String(s.id)}>{s.name}</option>)}
        </select>
        {schoolHref ? <Link href={schoolHref} className="press" style={linkStyle}>Open</Link> : null}
      </Row>

      <p style={{ fontSize: 13, color: '#777', margin: '14px 0 0', lineHeight: 1.5 }}>
        Groups of 1 to 4 show as fewer than 5. A school sees names only where a parent agreed, and never
        ethnicity, wellbeing or bodyweight.
      </p>
    </div>
  )
}

function Row({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ marginTop: 16 }}>
      <div style={labelStyle}>{title}</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>{children}</div>
    </div>
  )
}
