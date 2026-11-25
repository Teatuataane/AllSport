// ─── Funder and school reports: the printable sheet ──────────────────────────
// Props only (__tests__/reportViews.test.tsx). Rules in lib/reports.ts. Drawn
// as a white page on screen too, so what you see is what prints.

import type { CSSProperties, ReactNode } from 'react'
import { formatNZDate } from '@/lib/dates'
import { funderLines, reachRows, schoolLines, wellbeingLines, type FunderReport, type SchoolReport } from '@/lib/reports'
import { shown } from '@/lib/successMeasures'

const sheet: CSSProperties = {
  background: '#fff', color: '#111', borderRadius: 8, padding: '32px 28px', maxWidth: 820, margin: '0 auto',
  fontFamily: 'var(--font-body)', fontSize: 14, lineHeight: 1.45,
}
const h2: CSSProperties = { fontFamily: 'var(--font-display)', fontSize: 22, letterSpacing: '0.04em', margin: '24px 0 8px', color: '#111' }
const small: CSSProperties = { fontSize: 12, color: '#555' }

const nzDate = (d: string) => formatNZDate(d, { day: 'numeric', month: 'long', year: 'numeric' })

function Lines({ lines }: { lines: [string, string][] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <tbody>
        {lines.map(([k, v]) => (
          <tr key={k} style={{ borderBottom: '1px solid #e5e5e5' }}>
            <td style={{ padding: '6px 8px 6px 0' }}>{k}</td>
            <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Header({ title, sub, from, to }: { title: string; sub: ReactNode; from: string; to: string }) {
  return (
    <div style={{ borderBottom: '3px solid #111', paddingBottom: 12 }}>
      <div style={{ ...small, letterSpacing: '0.12em', textTransform: 'uppercase' }}>Allsport Aotearoa</div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 34, lineHeight: 1.05, color: '#111' }}>{title}</div>
      <div style={{ marginTop: 4 }}>{sub}</div>
      <div style={{ ...small, marginTop: 4 }}>{nzDate(from)} to {nzDate(to)}</div>
    </div>
  )
}

export function FunderReportView({ report: r }: { report: FunderReport }) {
  return (
    <article className="report" style={sheet} aria-label="Funder report">
      <Header title={r.programme.name} sub={<>Funder report for {r.programme.funder}</>} from={r.from} to={r.to} />
      <h2 style={h2}>Delivery</h2>
      <Lines lines={funderLines(r)} />
      <h2 style={h2}>Wellbeing</h2>
      <Lines lines={wellbeingLines(r.wellbeing)} />
      <p style={small}>From each player&apos;s first and latest check-in in this programme during the period. Shown only when 5 or more answered twice.</p>
      {([['Who played', r.reach], ['New players', r.newReach]] as const).map(([title, reach]) => (
        <section key={title}>
          <h2 style={h2}>{title}: {shown(reach.total)}</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 16 }}>
            {reachRows(reach).map(g => (
              <div key={g.group}>
                <div style={{ fontWeight: 700, marginBottom: 2 }}>{g.group}</div>
                <Lines lines={g.rows} />
              </div>
            ))}
          </div>
        </section>
      ))}
      <p style={{ ...small, marginTop: 20 }}>
        Groups of 1 to 4 people show as &ldquo;fewer than 5&rdquo;. A player counts once per game. Ethnicity is total
        response: a player who ticked more than one group counts in each. Deprivation is the NZDep2023 quintile of the
        player&apos;s suburb (Q5 most deprived).
      </p>
    </article>
  )
}

export function SchoolReportView({ report: r }: { report: SchoolReport }) {
  return (
    <article className="report" style={sheet} aria-label="School report">
      <Header title={r.school} sub="School report" from={r.from} to={r.to} />
      <h2 style={h2}>Your students at AllSport</h2>
      <Lines lines={schoolLines(r)} />
      <h2 style={h2}>Students</h2>
      {r.named.length === 0
        ? <p>No student&apos;s parent has agreed to share their name with the school yet.</p>
        : <Lines lines={r.named.map(n => [n.name, `${n.games} game${n.games === 1 ? '' : 's'}`])} />}
      <p style={{ ...small, marginTop: 20 }}>
        Names appear only where a parent agreed to share with the school. Groups of 1 to 4 show as &ldquo;fewer than
        5&rdquo;. This report never includes ethnicity, wellbeing answers or bodyweight.
      </p>
    </article>
  )
}
