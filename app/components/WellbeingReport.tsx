'use client'
// Kaiwhakawā wellbeing report — aggregate-only view of the quarterly wellbeing
// check-ins (get_wellbeing_report RPC; quarters with <3 respondents in a
// cohort are suppressed server-side). CSV export for funder evidence.
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const supabase = createClient()

type ReportRow = {
  quarter: string
  cohort: string
  respondents: number
  who5_score: number
  activity_days: number
  fitness: number
  confidence: number
  enjoyment: number
  belonging: number
}

const COLS: { key: keyof ReportRow; label: string }[] = [
  { key: 'quarter', label: 'Quarter' },
  { key: 'cohort', label: 'Cohort' },
  { key: 'respondents', label: 'N' },
  { key: 'who5_score', label: 'WHO-5 (0–100)' },
  { key: 'activity_days', label: 'Active days /7' },
  { key: 'fitness', label: 'Fitness /5' },
  { key: 'confidence', label: 'Confidence /5' },
  { key: 'enjoyment', label: 'Enjoyment /5' },
  { key: 'belonging', label: 'Belonging /5' },
]

export default function WellbeingReport() {
  const [rows, setRows] = useState<ReportRow[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.rpc('get_wellbeing_report').then(({ data, error: err }) => {
      if (err) { setError(err.message); return }
      setRows((data as ReportRow[]) ?? [])
    })
  }, [])

  const downloadCsv = () => {
    if (!rows) return
    const csv = [
      COLS.map(c => c.label).join(','),
      ...rows.map(r => COLS.map(c => String(r[c.key]).replace(/,/g, ' ')).join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `allsport-wellbeing-report-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <div style={{ background: '#111', border: '1px solid #1e1e1e', borderLeft: '4px solid #B87DB5', borderRadius: '16px', padding: '20px 22px', marginTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', gap: '12px' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '20px', color: '#fff', letterSpacing: '0.05em', lineHeight: 1 }}>
            Wellbeing Report
          </div>
          <div style={{ fontSize: '11px', color: '#555', fontFamily: 'var(--font-label)', letterSpacing: '0.05em', marginTop: '3px' }}>
            Quarterly check-in aggregates — individual answers are never shown
          </div>
        </div>
        {rows && rows.length > 0 && (
          <button onClick={downloadCsv} style={{
            background: '#1a1a1a', border: '1px solid #333', borderRadius: '999px', color: '#ccc',
            cursor: 'pointer', padding: '9px 16px', flexShrink: 0,
            fontFamily: 'var(--font-label)', fontSize: '12px', fontWeight: 700, letterSpacing: '0.08em',
          }}>
            CSV ↓
          </button>
        )}
      </div>

      {error && <div style={{ color: '#EA4742', fontSize: '13px', fontFamily: 'var(--font-label)' }}>{error}</div>}
      {!error && rows === null && <div style={{ color: '#555', fontSize: '13px', fontFamily: 'var(--font-body)' }}>Loading…</div>}
      {!error && rows !== null && rows.length === 0 && (
        <div style={{ color: '#555', fontSize: '13px', fontFamily: 'var(--font-body)' }}>
          No data yet — quarters appear once at least 3 players in a cohort have checked in.
        </div>
      )}
      {!error && rows !== null && rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: '640px' }}>
            <thead>
              <tr>
                {COLS.map(c => (
                  <th key={c.key} style={{ textAlign: 'left', padding: '6px 10px', fontFamily: 'var(--font-label)', fontSize: '10.5px', letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555', borderBottom: '1px solid #222' }}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  {COLS.map(c => (
                    <td key={c.key} style={{ padding: '7px 10px', fontSize: '13px', color: c.key === 'quarter' || c.key === 'cohort' ? '#ccc' : '#fff', fontFamily: c.key === 'cohort' ? 'var(--font-label)' : 'var(--font-body)', borderBottom: '1px solid #181818' }}>
                      {String(r[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
