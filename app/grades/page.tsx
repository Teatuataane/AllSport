// ─── The colours guide ───────────────────────────────────────────────────────
// What the COLOURS tab opens. Since the home colours rework (24 September 2026,
// docs/designs/home-colours-rework-spec.md) this page explains the system and
// shows NO personal data: a player's own colours, event by event, live on HOME
// (components/GradesCard.tsx). Public, like How to Play, so a newcomer or a
// parent can read it before signing up.
//
// A server component: nothing here depends on who is looking. Every number is
// read from lib/grading.ts, never typed, so the guide cannot drift from the
// engine that awards the colours. The worked examples are computed by the
// engine itself (domainGrade, overallRung).

import Link from 'next/link'
import {
  GRADES, MA, GAMES_REQUIRED, AGE_SHIFT, DOMAIN_TOP_EVENTS,
  DRILL_CAP, RATING_FLOOR, RATING_STEP, MIN_RATED_GAMES, gradeForRung, gradeInk, overallRung, averageRung,
  domainGrade,
} from '@/lib/grading'
import { GradeDot } from '@/components/GradeDot'

export const metadata = {
  title: 'Colours · AllSport',
  description: 'Mā to Taniwha: how AllSport colours are earned, domain by domain.',
}

const label = {
  fontFamily: 'var(--font-label)', textTransform: 'uppercase' as const,
  letterSpacing: '0.1em', fontWeight: 600,
}

const card = {
  background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16,
  padding: '18px 16px', marginBottom: 14,
}

const ENGLISH: Record<string, string> = {
  grey: 'Grey', red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', blue: 'Blue',
  purple: 'Purple', bronze: 'Bronze', silver: 'Silver', gold: 'Gold', rainbow: 'Rainbow', black: 'Black',
}

function H2({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)', fontSize: 26, letterSpacing: '0.04em',
      lineHeight: 1.05, margin: '0 0 8px',
    }}>
      <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>{n}</span>{children}
    </h2>
  )
}

function P({ children }: { children: React.ReactNode }) {
  return <p style={{ color: 'var(--grey-light)', fontSize: 14.5, lineHeight: 1.6, margin: '0 0 10px' }}>{children}</p>
}

export default function ColoursGuide() {
  const firstRatingColour = gradeForRung(DRILL_CAP + 1)
  const exampleRungs = [5, 5, 5, 5, 5, 5, 5, 2, 2, 2]
  const exampleSum = exampleRungs.reduce((a, b) => a + b, 0)
  // The overall example, capped: its average needs more games than this.
  const exampleGames = GAMES_REQUIRED[averageRung(exampleRungs)] - 1
  const exampleCapped = gradeForRung(overallRung(exampleRungs, exampleGames))
  const exampleUncapped = gradeForRung(averageRung(exampleRungs))

  // The domain example: four events played, two slots still empty.
  const domainExample = [10, 9, 6, 3]
  const domainSlugs = Array.from({ length: 12 }, (_, i) => `e${i}`)
  const domainResult = domainGrade({
    domainNumber: 1,
    eventSlugs: domainSlugs,
    rungByEvent: new Map(domainExample.map((r, i) => [domainSlugs[i], r])),
  })
  const domainSum = domainExample.reduce((a, b) => a + b, 0)

  return (
    <div style={{ maxWidth: 620, margin: '0 auto', padding: '22px 16px 56px', color: 'var(--white)' }}>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 14 }} aria-hidden>
        {[MA, ...GRADES].map(g => <GradeDot key={g.rung} grade={g} size={14} />)}
      </div>
      <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 52, lineHeight: 0.95, margin: 0, letterSpacing: '0.02em' }}>
        MĀ TO TANIWHA
      </h1>
      <p style={{ fontSize: 17, lineHeight: 1.5, margin: '12px 0 22px', color: 'var(--grey-light)' }}>
        Every event has twelve standards. A domain&apos;s colour is the average of your best{' '}
        {DOMAIN_TOP_EVENTS} events there. Your colour is the average of all ten.
      </p>
      <div style={{ display: 'flex', gap: 8, marginBottom: 26, flexWrap: 'wrap' }}>
        <Link href="/dashboard" style={{
          minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 18px',
          borderRadius: 999, background: 'var(--blue)', color: 'var(--white)', ...label, fontSize: 13,
        }}>
          See your colours →
        </Link>
        <Link href="/workout/new" style={{
          minHeight: 44, display: 'inline-flex', alignItems: 'center', padding: '0 18px',
          borderRadius: 999, background: 'var(--purple)', color: '#0a0a0a', ...label, fontSize: 13,
        }}>
          + Log a workout
        </Link>
      </div>

      {/* ── 1. The ladder ────────────────────────────────────────────────── */}
      <section style={card}>
        <H2 n={1}>The twelve colours</H2>
        <P>
          Everyone starts at Mā. Each colour&apos;s standards are aimed at a shrinking share of players:
          Whero at the top 90%, down to Taniwha for the top one percent. Your overall colour also needs a
          total number of official games played in the room.
        </P>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 62px 56px', gap: '0 8px', marginTop: 8 }}>
          {['Colour', 'Aimed at', 'Games'].map((h, i) => (
            <span key={h} style={{ ...label, fontSize: 10, color: '#555', textAlign: i ? 'right' : 'left', paddingBottom: 6 }}>{h}</span>
          ))}
          {[MA, ...GRADES].map(g => (
            <Row key={g.rung} cells={[
              <span key="n" style={{ display: 'inline-flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                <GradeDot grade={g} size={14} />
                <span style={{ minWidth: 0 }}>
                  <span style={{ ...label, display: 'block', fontSize: 13, color: g.rung ? gradeInk(g) : 'var(--white)' }}>{g.name}</span>
                  <span style={{ display: 'block', fontSize: 11.5, color: 'var(--text-muted)' }}>{g.rung ? ENGLISH[g.colour] ?? '' : 'White · the start'}</span>
                </span>
              </span>,
              g.rung === 0 ? '—' : g.populationTarget == null ? 'Everyone' : `Top ${g.populationTarget}%`,
              g.rung === 0 ? '—' : String(GAMES_REQUIRED[g.rung]),
            ]} />
          ))}
        </div>
      </section>

      {/* ── 2. A domain colour ───────────────────────────────────────────── */}
      <section style={card}>
        <H2 n={2}>A domain colour</H2>
        <P>
          Each event you play earns its own colour against its standards. A domain&apos;s colour is the
          average of your best {DOMAIN_TOP_EVENTS} events in it, rounded down. An event you have not played
          counts as Mā, so until you have {DOMAIN_TOP_EVENTS} on the board every new event lifts the domain.
          After that, a new event counts when it beats one of your {DOMAIN_TOP_EVENTS}.
        </P>
        <P>
          A domain colour lands by itself the moment your scores reach it, and it can climb several colours at once.
          Logged workouts count toward it as well as games.
        </P>
        <div style={{ background: '#0b0b0b', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }} aria-hidden>
            {Array.from({ length: DOMAIN_TOP_EVENTS }, (_, i) => (
              <GradeDot key={i} grade={gradeForRung(domainExample[i] ?? 0)} size={16} />
            ))}
          </div>
          <div style={{ fontSize: 14, color: 'var(--grey-light)', lineHeight: 1.55 }}>
            {domainExample.map(r => gradeForRung(r).name).join(', ')}, and {DOMAIN_TOP_EVENTS - domainExample.length} events
            not played yet: {domainSum} ÷ {DOMAIN_TOP_EVENTS} = {(domainSum / DOMAIN_TOP_EVENTS).toFixed(1)}, so{' '}
            <span style={{ color: gradeInk(gradeForRung(domainResult.rung)), fontWeight: 600 }}>
              {gradeForRung(domainResult.rung).name}
            </span>. Two more events at {gradeForRung(domainExample[domainExample.length - 1]).name} would lift it
            {' '}to {gradeForRung(Math.floor((domainSum + 2 * domainExample[domainExample.length - 1]) / DOMAIN_TOP_EVENTS)).name}.
          </div>
        </div>
        <div style={{ height: 10 }} />
        <P>
          If a kaiwhakawā confirms you cannot do an event (an injury or a disability), it leaves the domain,
          and a domain with fewer than {DOMAIN_TOP_EVENTS} events left averages over what you have.
        </P>
      </section>

      {/* ── 3. Overall ───────────────────────────────────────────────────── */}
      <section style={card}>
        <H2 n={3}>Your overall colour</H2>
        <P>
          The average of your ten domain colours, rounded down. Every domain you raise lifts it, and a domain
          still on Mā counts as zero, so skipping one holds you back.
        </P>
        <P>
          It also needs the games in the table above. Your domains can be built anywhere, but your overall
          colour only goes as high as the official games you have played.
        </P>
        <div style={{ background: '#0b0b0b', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }} aria-hidden>
            {exampleRungs.map((r, i) => <GradeDot key={i} grade={gradeForRung(r)} size={16} />)}
          </div>
          <div style={{ fontSize: 14, color: 'var(--grey-light)', lineHeight: 1.55 }}>
            Seven domains at {gradeForRung(5).name} (colour 5) and three at {gradeForRung(2).name} (colour 2):
            {' '}{exampleSum} ÷ 10 = {(exampleSum / 10).toFixed(1)}, so{' '}
            <span style={{ color: gradeInk(exampleUncapped), fontWeight: 600 }}>{exampleUncapped.name}</span>,
            once you have played {GAMES_REQUIRED[exampleUncapped.rung]} games. With {exampleGames} games it is{' '}
            <span style={{ color: gradeInk(exampleCapped), fontWeight: 600 }}>{exampleCapped.name}</span>.
          </div>
        </div>
      </section>

      {/* ── 4. Fairness ──────────────────────────────────────────────────── */}
      <section style={card}>
        <H2 n={4}>Fair at every age and size</H2>
        <P>
          Younger and older players get a head start of whole colours: under 14 and Grandmasters (60+)
          {' '}{AGE_SHIFT.U14}, ages 14 to 16 and Masters (40+) {AGE_SHIFT.U16}.
          Men and women have their own standards.
        </P>
        <P>
          Lifts and loaded carries are measured against your bodyweight, which you are asked for on the
          scoring screen on any day you play or train one. Without it those events count as not met.
        </P>
      </section>

      {/* ── 5. Game events ───────────────────────────────────────────────── */}
      <section style={card}>
        <H2 n={5}>Sports and games</H2>
        <P>
          On events that end in a real game, the drills take you as far as {gradeForRung(DRILL_CAP).name}.
          From {firstRatingColour.name} up, the colour comes from a head-to-head rating: after{' '}
          {MIN_RATED_GAMES} games that both players recorded, a rating of {RATING_FLOOR.toLocaleString()} gives{' '}
          {firstRatingColour.name}, and every {RATING_STEP} more gives the next colour.
        </P>
      </section>

      {/* ── 6. Keeping it ────────────────────────────────────────────────── */}
      <section style={card}>
        <H2 n={6}>A colour stays</H2>
        <P>
          A change to the standards never takes a colour away. The only way to lose one is a kaiwhakawā
          removing the score it rested on.
        </P>
        <Link href="/events" style={{ ...label, fontSize: 12.5, color: 'var(--blue)' }}>
          Every event and its tiers →
        </Link>
      </section>
    </div>
  )
}

function Row({ cells }: { cells: React.ReactNode[] }) {
  return (
    <>
      {cells.map((c, i) => (
        <span key={i} style={{
          display: 'flex', alignItems: 'center', justifyContent: i ? 'flex-end' : 'flex-start',
          padding: '8px 0', borderTop: '1px solid #181818', fontSize: 13,
          color: i ? 'var(--grey-light)' : undefined, minWidth: 0,
          fontVariantNumeric: 'tabular-nums',
        }}>
          {c}
        </span>
      ))}
    </>
  )
}
