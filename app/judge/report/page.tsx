'use client'

// ─── A funder or school report ───────────────────────────────────────────────
// /judge/report?kind=funder&programme=<id>&from=YYYY-MM-DD&to=YYYY-MM-DD
// /judge/report?kind=school&school=<id>&from=…&to=…
// Kaiwhakawā only (multi-location games step 14). Print or save as PDF from
// the browser; Download CSV gives the same numbers. The site's bars and
// buttons are hidden when printing.

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient, getSessionUser } from '@/lib/supabase-browser'
import { isHead } from '@/lib/kaiarahi'
import { loadOwnLevel } from '@/lib/kaiarahiData'
import { funderCsv, schoolCsv, type FunderReport, type SchoolReport } from '@/lib/reports'
import { loadFunderReport, loadSchoolReport } from '@/lib/reportsData'
import { FunderReportView, SchoolReportView } from '@/components/ReportViews'

const PRINT_CSS = `
@media print {
  nav, footer, .no-print { display: none !important; }
  html, body, main { background: #fff !important; }
  .report { padding: 0 !important; max-width: none !important; }
  @page { margin: 16mm; }
}`

const DATE = /^\d{4}-\d{2}-\d{2}$/

type Loaded = { kind: 'funder'; report: FunderReport } | { kind: 'school'; report: SchoolReport }

function Report() {
  const router = useRouter()
  const params = useSearchParams()
  const [supabase] = useState(() => createClient())
  const [state, setState] = useState<Loaded | 'loading' | 'missing'>('loading')
  const kind = params.get('kind')
  const from = params.get('from') ?? ''
  const to = params.get('to') ?? ''
  const programme = params.get('programme')
  const school = params.get('school')

  useEffect(() => {
    let gone = false
    ;(async () => {
      const user = await getSessionUser()
      if (!user) { router.push('/play'); return }
      const level = await loadOwnLevel(supabase, user.id, null)
      if (!isHead(level)) { router.push('/judge'); return }
      if (!DATE.test(from) || !DATE.test(to) || from > to) { if (!gone) setState('missing'); return }
      if (kind === 'funder' && programme) {
        const report = await loadFunderReport(supabase, programme, from, to)
        if (!gone) setState(report ? { kind: 'funder', report } : 'missing')
      } else if (kind === 'school' && school && /^\d+$/.test(school)) {
        const report = await loadSchoolReport(supabase, Number(school), from, to)
        if (!gone) setState(report ? { kind: 'school', report } : 'missing')
      } else if (!gone) setState('missing')
    })().catch(() => { if (!gone) setState('missing') })
    return () => { gone = true }
  }, [supabase, router, kind, from, to, programme, school])

  const download = () => {
    if (typeof state !== 'object') return
    const text = state.kind === 'funder' ? funderCsv(state.report) : schoolCsv(state.report)
    const name = state.kind === 'funder' ? state.report.programme.name : state.report.school
    const url = URL.createObjectURL(new Blob(['﻿', text], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `allsport-${state.kind}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${from}-${to}.csv`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const button = { background: 'transparent', color: '#ddd', border: '1px solid #333', borderRadius: 999, padding: '0 16px', minHeight: 40,
    fontFamily: 'var(--font-label)', fontWeight: 700, fontSize: 13, letterSpacing: '0.06em', textTransform: 'uppercase' as const, cursor: 'pointer' }

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', padding: '24px 16px 60px' }}>
      <style>{PRINT_CSS}</style>
      <div className="no-print" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 820, margin: '0 auto 16px' }}>
        <Link href="/judge#reports" className="press" style={{ ...button, display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>← Back</Link>
        <span style={{ flexGrow: 1 }} />
        <button type="button" className="press" style={button} disabled={typeof state !== 'object'} onClick={download}>Download CSV</button>
        <button type="button" className="press" style={{ ...button, background: 'var(--blue)', color: '#0a0a0a', border: 'none' }}
          disabled={typeof state !== 'object'} onClick={() => window.print()}>Print or save PDF</button>
      </div>
      {state === 'loading' && <div style={{ color: '#777', textAlign: 'center' }}>Building the report…</div>}
      {state === 'missing' && <div style={{ color: '#aaa', textAlign: 'center' }}>That report could not be made. Go back and choose again.</div>}
      {typeof state === 'object' && (state.kind === 'funder'
        ? <FunderReportView report={state.report} />
        : <SchoolReportView report={state.report} />)}
    </div>
  )
}

export default function ReportPage() {
  return <Suspense fallback={null}><Report /></Suspense>
}
